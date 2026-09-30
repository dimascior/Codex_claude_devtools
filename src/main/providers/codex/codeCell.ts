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
 */

export interface ScriptToolCall {
  /** Tool name as written in the script (`exec_command`, `mcp__server__tool`, …) */
  name: string;
  /** Statically known first argument, if any */
  args?: unknown;
  /** Whether the argument contains parts that are only known at runtime */
  dynamic: boolean;
  /** 1-based line of the call within the cell source */
  line: number;
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
    calls = new ScriptScanner(code).findToolCalls();
  } catch {
    // Static analysis is best effort; never fail the session because of it.
    calls = [];
  }
  return { pragma, code, calls };
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

  findToolCalls(): ScriptToolCall[] {
    const calls: ScriptToolCall[] = [];
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
            calls.push(call);
          }
        }
        continue;
      }
      this.pos++;
    }
    return calls;
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
