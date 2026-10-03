/**
 * Static analysis of Codex code-mode cells.
 *
 * In code mode the model sends one freeform `exec` call whose input is a
 * JavaScript program; the program dispatches the real operations through the
 * global `tools` object, e.g.
 *
 *   // @exec: {"yield_time_ms": 10000}
 *   const status = await tools.exec_command({ cmd: "git status --short" });
 *   const diff = await tools.exec_command({ cmd: "git diff" });
 *
 * When Codex persists the cell's nested call inventory
 * (`executed_tool_calls`) that record is authoritative. This module is the
 * fallback: it scans the source for `tools.<name>(<literal>)` calls without
 * executing anything. Calls in loops appear once and non-literal argument
 * parts are reported as `{ $expr: "<source>" }`.
 *
 * A command argument (`cmd`, `command`) that names a constant is resolved
 * from the script when that is unambiguous: the name is declared once in the
 * whole script, with `const`, bound to a quoted string or a template without
 * interpolation that ends the expression, never used as a parameter or any
 * other binding, and the call lies in the block the constant is declared in.
 * Codex often writes
 * `const command = "curl …"; await tools.exec_command({ cmd: command })`.
 * The resolution is recorded with the call (`resolved`). Scripts whose scopes
 * a scan cannot read (`with`, a direct `eval`, braces it does not see
 * balanced) resolve nothing.
 */

/** A call argument taken from a `const` declaration in the script. */
export interface ResolvedArgument {
  /** Argument key (`cmd`, `command`) */
  key: string;
  /** Constant it named */
  name: string;
  /** 1-based line of the declaration within the cell source */
  line: number;
}

export interface ScriptToolCall {
  /** Tool name as written in the script (`exec_command`, `mcp__server__tool`, …) */
  name: string;
  /** Statically known first argument, if any */
  args?: unknown;
  /** Whether the argument contains parts that are only known at runtime */
  dynamic: boolean;
  /** 1-based line of the call within the cell source */
  line: number;
  /** Arguments resolved from constants declared in the script */
  resolved?: ResolvedArgument[];
}

export interface ParsedCodeCell {
  /** Options from a leading `// @exec: {...}` pragma */
  pragma?: Record<string, unknown>;
  /** Script without the pragma line */
  code: string;
  calls: ScriptToolCall[];
}

/** Marker for argument parts that are not literals. */
export interface DynamicExpression {
  $expr: string;
}

const PRAGMA_RE = /^[ \t]*\/\/ @exec:([^\r\n]*)\r?\n/;
const IDENT_START_RE = /[A-Za-z_$]/;
const IDENT_PART_RE = /[\w$]/;
const IDENTIFIER_RE = /^[A-Za-z_$][\w$]*$/;
const IDENTIFIERS_RE = /[A-Za-z_$][\w$]*/g;
const LINE_END_RE = /[\n\r]/;

/** Arguments that carry a command, the only ones resolved from constants. */
const RESOLVABLE_KEYS = ['cmd', 'command'];
/** Keywords that declare variables (`using` too: it binds a name). */
const DECLARATION_KEYWORDS = new Set(['const', 'let', 'var', 'using']);
/** Keywords whose parenthesized head before a block is not a parameter list. */
const CONTROL_KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'with', 'catch']);

/** Upper bound on extracted calls, to keep pathological scripts cheap. */
const MAX_CALLS = 200;

/**
 * Parse a code-mode cell.
 */
export function parseCodeCell(input: string): ParsedCodeCell {
  let code = input;
  let pragma: Record<string, unknown> | undefined;
  const pragmaMatch = PRAGMA_RE.exec(input);
  if (pragmaMatch) {
    code = input.slice(pragmaMatch[0].length);
    try {
      const parsed: unknown = JSON.parse(pragmaMatch[1].trim());
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        pragma = parsed as Record<string, unknown>;
      }
    } catch {
      // Unparseable pragma options are ignored.
    }
  }

  let calls: ScriptToolCall[] = [];
  try {
    const located = new ScriptScanner(code).findToolCalls();
    if (located.length > 0) {
      resolveConstArguments(located, new ScriptScanner(code).findConstBindings());
    }
    calls = located.map(({ call }) => call);
  } catch {
    // Static analysis is best effort; never fail the session because of it.
    calls = [];
  }
  return { pragma, code, calls };
}

/** A call found in the script, with the offset of its `tools` reference. */
interface LocatedCall {
  call: ScriptToolCall;
  offset: number;
}

/**
 * A `const` bound to a plain string literal and the source range of the block
 * it is visible in; null when the name is not unambiguous.
 */
type ConstBinding = { value: string; line: number; scopeStart: number; scopeEnd: number } | null;

/** A block being scanned: where it opens, the brackets open at its brace, its constants. */
interface OpenBlock {
  start: number;
  nesting: number;
  names: string[];
}

/** A declaration whose declarator list may go on past an initializer the scan skipped. */
interface OpenDeclaration {
  block: OpenBlock;
  nesting: number;
}

interface SourceRange {
  start: number;
  end: number;
}

function containsDynamic(value: unknown): boolean {
  if (isDynamicExpression(value)) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.some(containsDynamic);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).some(containsDynamic);
  }
  return false;
}

/**
 * Replace a command argument that names an unambiguous string constant with
 * the constant's text, and record where it came from.
 */
function resolveConstArguments(located: LocatedCall[], bindings: Map<string, ConstBinding>): void {
  for (const { call, offset } of located) {
    const args = call.args;
    if (typeof args !== 'object' || args === null || Array.isArray(args)) {
      continue;
    }
    const record = args as Record<string, unknown>;
    const resolved: ResolvedArgument[] = [];
    for (const key of RESOLVABLE_KEYS) {
      const value = record[key];
      if (!isDynamicExpression(value) || !IDENTIFIER_RE.test(value.$expr)) {
        continue;
      }
      const binding = bindings.get(value.$expr);
      // Outside the constant's block the name means some other binding.
      if (!binding || offset < binding.scopeStart || offset > binding.scopeEnd) {
        continue;
      }
      record[key] = binding.value;
      resolved.push({ key, name: value.$expr, line: binding.line });
    }
    if (resolved.length > 0) {
      call.resolved = resolved;
      call.dynamic = containsDynamic(record);
    }
  }
}

/**
 * Whether a value (or anything inside it) is a dynamic expression marker.
 */
export function isDynamicExpression(value: unknown): value is DynamicExpression {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as DynamicExpression).$expr === 'string' &&
    Object.keys(value).length === 1
  );
}

/**
 * Render a statically-parsed value as display text (dynamic parts as ‹expr›).
 */
export function renderScriptValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (isDynamicExpression(value)) {
    return `‹${value.$expr}›`;
  }
  return JSON.stringify(value) ?? '';
}

class ScriptScanner {
  private pos = 0;

  constructor(private readonly src: string) {}

  findToolCalls(): LocatedCall[] {
    const calls: LocatedCall[] = [];
    const { src } = this;

    while (this.pos < src.length && calls.length < MAX_CALLS) {
      const ch = src[this.pos];

      if (ch === '/' && (src[this.pos + 1] === '/' || src[this.pos + 1] === '*')) {
        this.skipComment();
        continue;
      }
      if (ch === '"' || ch === "'") {
        this.readQuotedString(ch);
        continue;
      }
      if (ch === '`') {
        this.readTemplate();
        continue;
      }
      if (IDENT_START_RE.test(ch) && !this.isIdentifierPart(this.pos - 1)) {
        const start = this.pos;
        const ident = this.readIdentifier();
        if (ident === 'tools') {
          const call = this.tryReadToolCall(start);
          if (call) {
            calls.push({ call, offset: start });
          }
        }
        continue;
      }
      this.pos++;
    }
    return calls;
  }

  /**
   * Names bound by `const NAME = <plain string literal>` and nowhere else, each
   * with the block it is visible in. A name declared twice, with `let`, `var`
   * or `using`, in a `for` head, by destructuring, after an initializer that is
   * not a plain literal, as a function or class name, or used as a function,
   * arrow, method or catch parameter maps to null: a reference to it could mean
   * another binding. A script whose scopes this scan cannot read (`with`, a
   * direct `eval`, braces it does not see balanced, e.g. inside a regular
   * expression) yields no bindings.
   */
  findConstBindings(): Map<string, ConstBinding> {
    const bindings = new Map<string, ConstBinding>();
    const { src } = this;
    const blocks: OpenBlock[] = [{ start: 0, nesting: 0, names: [] }];
    // Offsets of the open parentheses and brackets
    const nesting: number[] = [];
    let declaration: OpenDeclaration | undefined;
    let lastParens: SourceRange | undefined;
    let lastIdent: SourceRange | undefined;

    while (this.pos < src.length) {
      const ch = src[this.pos];
      const block = blocks[blocks.length - 1];
      if (ch === '/' && (src[this.pos + 1] === '/' || src[this.pos + 1] === '*')) {
        this.skipComment();
        continue;
      }
      if (ch === '"' || ch === "'") {
        this.readQuotedString(ch);
        continue;
      }
      if (ch === '`') {
        this.readTemplate();
        continue;
      }
      if (ch === '{') {
        this.markMethodParameters(bindings, lastParens);
        blocks.push({ start: this.pos, nesting: nesting.length, names: [] });
        this.pos++;
        continue;
      }
      if (ch === '}') {
        if (blocks.length === 1) {
          return new Map(); // a brace the scan did not see open
        }
        blocks.pop();
        ScriptScanner.closeBlock(bindings, block, this.pos);
        if (nesting.length > block.nesting) {
          nesting.length = block.nesting;
        }
        if (declaration?.block === block) {
          declaration = undefined;
        }
        this.pos++;
        continue;
      }
      if (ch === '(' || ch === '[') {
        nesting.push(this.pos);
        this.pos++;
        continue;
      }
      if (ch === ')' || ch === ']') {
        const open = nesting.pop();
        if (ch === ')' && open !== undefined) {
          lastParens = { start: open, end: this.pos };
        }
        if (declaration && nesting.length < declaration.nesting) {
          declaration = undefined;
        }
        this.pos++;
        continue;
      }
      if (ch === '=' && src[this.pos + 1] === '>') {
        this.markArrowParameters(bindings, lastParens, lastIdent);
        this.pos += 2;
        continue;
      }
      const inDeclarationList =
        declaration?.block === block && declaration.nesting === nesting.length;
      if (ch === ',' && inDeclarationList) {
        this.pos++;
        // The next declarator; never resolvable, as the list may have ended unseen
        if (!this.readDeclarators(false, bindings, block)) {
          declaration = undefined;
        }
        continue;
      }
      if (ch === ';' && inDeclarationList) {
        declaration = undefined;
      }
      if (IDENT_START_RE.test(ch) && !this.isIdentifierPart(this.pos - 1)) {
        const start = this.pos;
        const ident = this.readIdentifier();
        lastIdent = { start, end: this.pos };
        if (DECLARATION_KEYWORDS.has(ident)) {
          // Inside parentheses a declaration is a `for` head, scoped to its loop.
          const resolvable = ident === 'const' && nesting.length === block.nesting;
          declaration = this.readDeclarators(resolvable, bindings, block)
            ? { block, nesting: nesting.length }
            : undefined;
        } else if (ident === 'function' || ident === 'catch') {
          this.markParenthesizedNames(bindings);
        } else if (ident === 'class') {
          this.markClassName(bindings);
        } else if (this.opensOpaqueScope(ident)) {
          return new Map();
        }
        continue;
      }
      this.pos++;
    }
    if (blocks.length !== 1) {
      return new Map(); // a brace the scan did not see closed
    }
    ScriptScanner.closeBlock(bindings, blocks[0], src.length);
    return bindings;
  }

  /** A block closed at `end`: where the scope of its constants ends. */
  private static closeBlock(
    bindings: Map<string, ConstBinding>,
    block: OpenBlock,
    end: number
  ): void {
    for (const name of block.names) {
      const binding = bindings.get(name);
      if (binding) {
        binding.scopeEnd = end;
      }
    }
  }

  /** Declare a name; a second declaration makes it ambiguous. */
  private static declare(
    bindings: Map<string, ConstBinding>,
    name: string,
    binding: ConstBinding
  ): void {
    bindings.set(name, bindings.has(name) ? null : binding);
  }

  /** Mark every identifier in `text` as not resolvable. */
  private static disqualify(bindings: Map<string, ConstBinding>, text: string): void {
    for (const match of text.matchAll(IDENTIFIERS_RE)) {
      bindings.set(match[0], null);
    }
  }

  /**
   * After a declaration keyword: read declarators while their initializers are
   * plain literals; only a resolvable `const` binds. Returns true when it
   * stopped at an initializer it does not read, after which the list may go on.
   */
  private readDeclarators(
    resolvable: boolean,
    bindings: Map<string, ConstBinding>,
    block: OpenBlock
  ): boolean {
    const { src } = this;
    for (;;) {
      this.skipTrivia();
      const ch = src[this.pos];
      if (ch === '{' || ch === '[') {
        // Destructuring declares every name in the pattern.
        const start = this.pos;
        this.skipBalanced(ch, ch === '{' ? '}' : ']');
        ScriptScanner.disqualify(bindings, src.slice(start, this.pos));
        return true;
      }
      if (!IDENT_START_RE.test(ch ?? '')) {
        return false;
      }
      const nameStart = this.pos;
      const name = this.readIdentifier();
      this.skipTrivia();
      if (src[this.pos] !== '=' || src[this.pos + 1] === '=') {
        // No initializer (`let a, b;`), or a `for (const x of …)` head
        ScriptScanner.declare(bindings, name, null);
        if (src[this.pos] !== ',') {
          return false;
        }
        this.pos++;
        continue;
      }
      this.pos++; // the `=`
      this.skipTrivia();
      const value = this.readPlainLiteral();
      if (value === undefined) {
        ScriptScanner.declare(bindings, name, null);
        return true;
      }
      if (resolvable) {
        const line = lineOf(src, nameStart);
        ScriptScanner.declare(bindings, name, {
          value,
          line,
          scopeStart: block.start,
          scopeEnd: src.length,
        });
        block.names.push(name);
      } else {
        ScriptScanner.declare(bindings, name, null);
      }
      if (src[this.pos] !== ',') {
        return false;
      }
      this.pos++;
    }
  }

  /**
   * A quoted string, or a template without interpolation, that ends its
   * expression; undefined otherwise (the cursor wherever reading stopped).
   */
  private readPlainLiteral(): string | undefined {
    const quote = this.src[this.pos];
    let value: string;
    if (quote === '`') {
      const template = this.readTemplate();
      if (template.interpolated) {
        return undefined;
      }
      value = template.value;
    } else if (quote === '"' || quote === "'") {
      value = this.readQuotedString(quote);
    } else {
      return undefined;
    }
    return this.atExpressionEnd() ? value : undefined;
  }

  /**
   * Whether the expression ends here, right after a literal: at `;`, `,`, `}`
   * or the end, or at a line end the next token cannot continue (automatic
   * semicolon insertion: not an operator, `(`, `[`, `.` or a template). Moves
   * past whitespace and comments.
   */
  private atExpressionEnd(): boolean {
    const { src } = this;
    const start = this.pos;
    this.skipTrivia();
    if (this.pos >= src.length) {
      return true;
    }
    const ch = src[this.pos];
    if (ch === ';' || ch === ',' || ch === '}') {
      return true;
    }
    if (!LINE_END_RE.test(src.slice(start, this.pos))) {
      return false;
    }
    if (ch === '{' || ch === '"' || ch === "'") {
      return true;
    }
    if (!IDENT_START_RE.test(ch)) {
      return false;
    }
    const save = this.pos;
    const word = this.readIdentifier();
    this.pos = save;
    return word !== 'in' && word !== 'instanceof';
  }

  /** After `function`/`catch`: the function's own name and its parameters. */
  private markParenthesizedNames(bindings: Map<string, ConstBinding>): void {
    const save = this.pos;
    this.skipTrivia();
    if (this.src[this.pos] === '*') {
      this.pos++;
      this.skipTrivia();
    }
    if (IDENT_START_RE.test(this.src[this.pos] ?? '')) {
      bindings.set(this.readIdentifier(), null);
      this.skipTrivia();
    }
    if (this.src[this.pos] !== '(') {
      this.pos = save;
      return;
    }
    const start = this.pos;
    this.skipBalanced('(', ')');
    ScriptScanner.disqualify(bindings, this.src.slice(start, this.pos));
  }

  /** After `class`: the class name. */
  private markClassName(bindings: Map<string, ConstBinding>): void {
    this.skipTrivia();
    if (IDENT_START_RE.test(this.src[this.pos] ?? '')) {
      bindings.set(this.readIdentifier(), null);
    }
  }

  /**
   * At `{` right after `(…)`: a method definition (`name(params) {`, also with
   * a computed name) unless a control statement's head precedes the brace. The
   * parameters are bindings.
   */
  private markMethodParameters(
    bindings: Map<string, ConstBinding>,
    parens: SourceRange | undefined
  ): void {
    const { src } = this;
    if (!parens || !this.onlyTriviaBetween(parens.end + 1, this.pos)) {
      return;
    }
    let end = parens.start;
    while (end > 0 && /\s/.test(src[end - 1])) {
      end--;
    }
    let start = end;
    while (start > 0 && IDENT_PART_RE.test(src[start - 1])) {
      start--;
    }
    if (!CONTROL_KEYWORDS.has(src.slice(start, end))) {
      ScriptScanner.disqualify(bindings, src.slice(parens.start, parens.end + 1));
    }
  }

  /** At `=>`: the arrow's parameters, the parenthesized list or the single name before it. */
  private markArrowParameters(
    bindings: Map<string, ConstBinding>,
    parens: SourceRange | undefined,
    ident: SourceRange | undefined
  ): void {
    const { src } = this;
    if (parens && this.onlyTriviaBetween(parens.end + 1, this.pos)) {
      ScriptScanner.disqualify(bindings, src.slice(parens.start, parens.end + 1));
    } else if (ident && this.onlyTriviaBetween(ident.end, this.pos)) {
      bindings.set(src.slice(ident.start, ident.end), null);
    }
  }

  /**
   * `with (…)` or a direct `eval(…)`: names may be bound at runtime, which no
   * scan can see. (Imported names need no rule: they live in the outermost
   * scope, where a constant of the same name could not be declared.)
   */
  private opensOpaqueScope(ident: string): boolean {
    if (ident !== 'with' && ident !== 'eval') {
      return false;
    }
    const save = this.pos;
    this.skipTrivia();
    const next = this.src[this.pos];
    this.pos = save;
    return next === '(';
  }

  /** Whether only whitespace and comments lie between two offsets. */
  private onlyTriviaBetween(start: number, end: number): boolean {
    const { src } = this;
    let i = start;
    while (i < end) {
      const ch = src[i];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        i++;
      } else if (ch === '/' && src[i + 1] === '/') {
        const lineEnd = src.indexOf('\n', i);
        i = lineEnd === -1 ? src.length : lineEnd;
      } else if (ch === '/' && src[i + 1] === '*') {
        const close = src.indexOf('*/', i + 2);
        i = close === -1 ? src.length : close + 2;
      } else {
        return false;
      }
    }
    return true;
  }

  /**
   * After reading `tools`, try to match `.name(`, `?.name(`, or `["name"](`.
   */
  private tryReadToolCall(start: number): ScriptToolCall | null {
    const { src } = this;
    const save = this.pos;
    this.skipTrivia();

    let name: string | null = null;
    let dotted = false;
    if (src.startsWith('?.', this.pos)) {
      this.pos += 2;
      dotted = true;
    } else if (src[this.pos] === '.') {
      this.pos++;
      dotted = true;
    }

    if (src[this.pos] === '[') {
      this.pos++;
      this.skipTrivia();
      const quote = src[this.pos];
      if (quote === '"' || quote === "'" || quote === '`') {
        name = quote === '`' ? this.readTemplate().value : this.readQuotedString(quote);
        this.skipTrivia();
        if (src[this.pos] !== ']') {
          this.pos = save;
          return null;
        }
        this.pos++;
      }
    } else if (dotted) {
      this.skipTrivia();
      if (IDENT_START_RE.test(src[this.pos] ?? '')) {
        name = this.readIdentifier();
      }
    }

    if (!name) {
      this.pos = save;
      return null;
    }

    this.skipTrivia();
    if (src.startsWith('?.', this.pos)) {
      this.pos += 2;
      this.skipTrivia();
    }
    if (src[this.pos] !== '(') {
      this.pos = save;
      return null;
    }
    this.pos++;
    this.skipTrivia();

    const line = lineOf(src, start);
    if (src[this.pos] === ')') {
      this.pos++;
      return { name, dynamic: false, line };
    }

    const { value, dynamic } = this.readValue();
    return { name, args: value, dynamic, line };
  }

  /**
   * Read a literal value; anything non-literal becomes a `$expr` marker.
   */
  private readValue(): { value: unknown; dynamic: boolean } {
    const { src } = this;
    this.skipTrivia();
    const ch = src[this.pos];

    if (ch === '{') {
      return this.readObject();
    }
    if (ch === '[') {
      return this.readArray();
    }
    if (ch === '"' || ch === "'") {
      const start = this.pos;
      const value = this.readQuotedString(ch);
      return this.literalOrExpression(value, start);
    }
    if (ch === '`') {
      const start = this.pos;
      const template = this.readTemplate();
      if (template.interpolated) {
        return this.expressionFrom(start);
      }
      return this.literalOrExpression(template.value, start);
    }

    const number = this.readNumber();
    if (number !== undefined) {
      return this.literalOrExpression(number.value, number.start);
    }

    for (const [keyword, literal] of [
      ['true', true],
      ['false', false],
      ['null', null],
    ] as const) {
      if (src.startsWith(keyword, this.pos) && !this.isIdentifierPart(this.pos + keyword.length)) {
        const start = this.pos;
        this.pos += keyword.length;
        return this.literalOrExpression(literal, start);
      }
    }

    return this.expressionFrom(this.pos);
  }

  /**
   * A literal followed by an operator (`"a" + b`) is really an expression.
   */
  private literalOrExpression(
    value: unknown,
    literalStart: number
  ): { value: unknown; dynamic: boolean } {
    this.skipTrivia();
    if (this.pos >= this.src.length || ',}])'.includes(this.src[this.pos])) {
      return { value, dynamic: false };
    }
    return this.expressionFrom(literalStart);
  }

  /**
   * Read a numeric literal (`-12`, `3.5`, `1e3`) at the cursor.
   */
  private readNumber(): { value: number; start: number } | undefined {
    const { src } = this;
    const start = this.pos;
    let end = start;
    if (src[end] === '-') {
      end++;
    }
    const digitsStart = end;
    while (end < src.length && /[\d.eE+-]/.test(src[end])) {
      // A sign is only part of the number right after an exponent marker.
      if ((src[end] === '+' || src[end] === '-') && !/[eE]/.test(src[end - 1] ?? '')) {
        break;
      }
      end++;
    }
    if (end === digitsStart || !/[\d.]/.test(src[digitsStart])) {
      return undefined;
    }
    const value = Number(src.slice(start, end));
    if (!Number.isFinite(value)) {
      return undefined;
    }
    this.pos = end;
    return { value, start };
  }

  private readObject(): { value: unknown; dynamic: boolean } {
    const { src } = this;
    const result: Record<string, unknown> = {};
    let dynamic = false;
    this.pos++; // skip the opening brace

    while (this.pos < src.length) {
      this.skipTrivia();
      const ch = src[this.pos];
      if (ch === '}') {
        this.pos++;
        return { value: result, dynamic };
      }
      if (ch === ',') {
        this.pos++;
        continue;
      }
      if (ch === ')' || ch === ']') {
        // Mismatched closer: the object literal is malformed; let the caller recover.
        return { value: result, dynamic: true };
      }
      if (src.startsWith('...', this.pos)) {
        const start = this.pos;
        this.pos += 3;
        this.skipExpression();
        result[`...${src.slice(start + 3, this.pos).trim()}`] = {
          $expr: src.slice(start, this.pos).trim(),
        };
        dynamic = true;
        continue;
      }

      let key: string | null = null;
      if (ch === '"' || ch === "'") {
        key = this.readQuotedString(ch);
      } else if (ch === '[') {
        const start = this.pos;
        this.skipBalanced('[', ']');
        key = src.slice(start, this.pos);
        dynamic = true;
      } else if (IDENT_START_RE.test(ch ?? '') || /\d/.test(ch ?? '')) {
        key = this.readIdentifierOrNumber();
      }

      if (key === null) {
        // Unknown syntax inside the object: skip it (always make progress).
        const before = this.pos;
        this.skipExpression();
        if (this.pos === before) {
          this.pos++;
        }
        dynamic = true;
        continue;
      }

      this.skipTrivia();
      if (src[this.pos] === ':') {
        this.pos++;
        const { value, dynamic: valueDynamic } = this.readValue();
        result[key] = value;
        dynamic ||= valueDynamic;
      } else if (src[this.pos] === '(') {
        // Method shorthand: `key() { ... }`
        const start = this.pos;
        this.skipBalanced('(', ')');
        this.skipTrivia();
        if (src[this.pos] === '{') {
          this.skipBalanced('{', '}');
        }
        result[key] = { $expr: `${key}${src.slice(start, this.pos)}` };
        dynamic = true;
      } else {
        // Shorthand property: `{ cmd }`
        result[key] = { $expr: key };
        dynamic = true;
      }
    }
    return { value: result, dynamic: true };
  }

  private readArray(): { value: unknown; dynamic: boolean } {
    const { src } = this;
    const result: unknown[] = [];
    let dynamic = false;
    this.pos++; // skip the opening bracket

    while (this.pos < src.length) {
      this.skipTrivia();
      const ch = src[this.pos];
      if (ch === ']') {
        this.pos++;
        return { value: result, dynamic };
      }
      if (ch === ',') {
        this.pos++;
        continue;
      }
      if (ch === ')' || ch === '}') {
        // Mismatched closer: the array literal is malformed; let the caller recover.
        return { value: result, dynamic: true };
      }
      const { value, dynamic: itemDynamic } = this.readValue();
      result.push(value);
      dynamic ||= itemDynamic;
    }
    return { value: result, dynamic: true };
  }

  private expressionFrom(start: number): { value: unknown; dynamic: boolean } {
    this.pos = start;
    this.skipExpression();
    return { value: { $expr: this.src.slice(start, this.pos).trim() }, dynamic: true };
  }

  /**
   * Skip an expression up to the next `,` / closing bracket at depth 0.
   */
  private skipExpression(): void {
    const { src } = this;
    while (this.pos < src.length) {
      const ch = src[this.pos];
      if (ch === ',' || ch === '}' || ch === ']' || ch === ')') {
        return;
      }
      if (ch === '(' || ch === '[' || ch === '{') {
        this.skipBalanced(ch, ch === '(' ? ')' : ch === '[' ? ']' : '}');
        continue;
      }
      if (ch === '"' || ch === "'") {
        this.readQuotedString(ch);
        continue;
      }
      if (ch === '`') {
        this.readTemplate();
        continue;
      }
      if (ch === '/' && (src[this.pos + 1] === '/' || src[this.pos + 1] === '*')) {
        this.skipComment();
        continue;
      }
      this.pos++;
    }
  }

  private skipBalanced(open: string, close: string): void {
    const { src } = this;
    let depth = 0;
    while (this.pos < src.length) {
      const ch = src[this.pos];
      if (ch === '"' || ch === "'") {
        this.readQuotedString(ch);
        continue;
      }
      if (ch === '`') {
        this.readTemplate();
        continue;
      }
      if (ch === '/' && (src[this.pos + 1] === '/' || src[this.pos + 1] === '*')) {
        this.skipComment();
        continue;
      }
      this.pos++;
      if (ch === open) {
        depth++;
      } else if (ch === close) {
        depth--;
        if (depth === 0) {
          return;
        }
      }
    }
  }

  private readQuotedString(quote: string): string {
    const { src } = this;
    let value = '';
    this.pos++; // opening quote
    while (this.pos < src.length) {
      const ch = src[this.pos];
      if (ch === quote) {
        this.pos++;
        return value;
      }
      if (ch === '\n') {
        // Unterminated string literal: stop at end of line.
        return value;
      }
      if (ch === '\\') {
        value += this.readEscape();
        continue;
      }
      value += ch;
      this.pos++;
    }
    return value;
  }

  /**
   * Read a template literal. Interpolations are kept verbatim in `value`.
   */
  private readTemplate(): { value: string; interpolated: boolean } {
    const { src } = this;
    let value = '';
    let interpolated = false;
    this.pos++; // opening backtick
    while (this.pos < src.length) {
      const ch = src[this.pos];
      if (ch === '`') {
        this.pos++;
        return { value, interpolated };
      }
      if (ch === '\\') {
        value += this.readEscape();
        continue;
      }
      if (ch === '$' && src[this.pos + 1] === '{') {
        interpolated = true;
        const start = this.pos;
        this.pos++; // skip the dollar sign
        this.skipBalanced('{', '}');
        value += src.slice(start, this.pos);
        continue;
      }
      value += ch;
      this.pos++;
    }
    return { value, interpolated };
  }

  private readEscape(): string {
    const { src } = this;
    const next = src[this.pos + 1];
    this.pos += 2;
    switch (next) {
      case 'n':
        return '\n';
      case 't':
        return '\t';
      case 'r':
        return '\r';
      case 'b':
        return '\b';
      case 'f':
        return '\f';
      case 'v':
        return '\v';
      case '0':
        return '\0';
      case 'x': {
        const hex = src.slice(this.pos, this.pos + 2);
        if (/^[0-9a-fA-F]{2}$/.test(hex)) {
          this.pos += 2;
          return String.fromCharCode(parseInt(hex, 16));
        }
        return 'x';
      }
      case 'u': {
        if (src[this.pos] === '{') {
          const end = src.indexOf('}', this.pos);
          const hex = end === -1 ? '' : src.slice(this.pos + 1, end);
          if (/^[0-9a-fA-F]{1,6}$/.test(hex)) {
            this.pos = end + 1;
            return String.fromCodePoint(parseInt(hex, 16));
          }
          return 'u';
        }
        const hex = src.slice(this.pos, this.pos + 4);
        if (/^[0-9a-fA-F]{4}$/.test(hex)) {
          this.pos += 4;
          return String.fromCharCode(parseInt(hex, 16));
        }
        return 'u';
      }
      case '\r':
        if (src[this.pos] === '\n') {
          this.pos++;
        }
        return '';
      case '\n':
        return '';
      case undefined:
        return '';
      default:
        return next;
    }
  }

  private skipComment(): void {
    const { src } = this;
    if (src[this.pos + 1] === '/') {
      const end = src.indexOf('\n', this.pos);
      this.pos = end === -1 ? src.length : end;
      return;
    }
    const end = src.indexOf('*/', this.pos + 2);
    this.pos = end === -1 ? src.length : end + 2;
  }

  private skipTrivia(): void {
    const { src } = this;
    while (this.pos < src.length) {
      const ch = src[this.pos];
      if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
        this.pos++;
        continue;
      }
      if (ch === '/' && (src[this.pos + 1] === '/' || src[this.pos + 1] === '*')) {
        this.skipComment();
        continue;
      }
      return;
    }
  }

  private readIdentifier(): string {
    const start = this.pos;
    while (this.pos < this.src.length && IDENT_PART_RE.test(this.src[this.pos])) {
      this.pos++;
    }
    return this.src.slice(start, this.pos);
  }

  private readIdentifierOrNumber(): string {
    return this.readIdentifier();
  }

  private isIdentifierPart(index: number): boolean {
    if (index < 0 || index >= this.src.length) {
      return false;
    }
    const ch = this.src[index];
    return IDENT_PART_RE.test(ch) || ch === '.';
  }
}

function lineOf(src: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < src.length; i++) {
    if (src.charCodeAt(i) === 10) {
      line++;
    }
  }
  return line;
}
