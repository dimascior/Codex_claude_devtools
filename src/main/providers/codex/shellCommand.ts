/**
 * Shell command display helpers.
 *
 * Codex frequently wraps the command it actually wants to run in a shell
 * invocation (`bash -lc "<script>"`, `powershell -Command "<script>"`,
 * `cmd /c <script>`). For display the script is what matters; the wrapping
 * shell is reported separately so the exact argv is never lost.
 */

export interface CommandDisplay {
  /** The command as a human would type it */
  command: string;
  /** Wrapping shell/interpreter, when one was detected */
  shell?: string;
}

const POSIX_SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh', 'fish', 'ash']);
const POWERSHELLS = new Set(['powershell', 'pwsh']);
const CMD_SHELLS = new Set(['cmd']);

/** PowerShell switches that take a value we should skip over. */
const POWERSHELL_VALUE_SWITCHES = new Set([
  '-executionpolicy',
  '-ep',
  '-workingdirectory',
  '-wd',
  '-windowstyle',
  '-outputformat',
  '-inputformat',
  '-configurationname',
]);

/**
 * Lower-cased executable base name without directory or `.exe` suffix.
 */
export function executableName(program: string): string {
  const base = program.split(/[/\\]/).pop() ?? program;
  return base.toLowerCase().replace(/\.exe$/, '');
}

/**
 * Describe an argv for display, unwrapping shell invocations.
 */
export function describeArgv(argv: readonly string[]): CommandDisplay {
  if (argv.length === 0) {
    return { command: '' };
  }
  const program = executableName(argv[0]);

  if (POSIX_SHELLS.has(program)) {
    const script = extractPosixScript(argv);
    if (script !== undefined) {
      return { command: script, shell: program };
    }
  }

  if (POWERSHELLS.has(program)) {
    const script = extractPowerShellScript(argv);
    if (script !== undefined) {
      return { command: script, shell: program };
    }
  }

  if (CMD_SHELLS.has(program)) {
    const index = argv.findIndex((arg, i) => i > 0 && /^\/[cCkK]$/.test(arg));
    if (index !== -1 && index < argv.length - 1) {
      return { command: argv.slice(index + 1).join(' '), shell: program };
    }
  }

  return { command: joinArgv(argv) };
}

/**
 * Shell name for display from a configured shell path (`/bin/zsh` → `zsh`).
 */
export function shellDisplayName(shell: unknown): string | undefined {
  if (typeof shell !== 'string' || !shell.trim()) {
    return undefined;
  }
  return executableName(shell.trim());
}

/**
 * Join argv with POSIX-style quoting where needed.
 */
function joinArgv(argv: readonly string[]): string {
  return argv.map(quoteArg).join(' ');
}

function quoteArg(arg: string): string {
  if (arg === '') {
    return "''";
  }
  if (/^[\w@%+=:,./-]+$/.test(arg)) {
    return arg;
  }
  const escaped = arg.replace(/'/g, "'\\''");
  return `'${escaped}'`;
}

/**
 * `bash -lc <script>` / `sh -c <script>` / `bash --login -c <script>`.
 */
function extractPosixScript(argv: readonly string[]): string | undefined {
  for (let i = 1; i < argv.length - 1; i++) {
    const arg = argv[i];
    if (!arg.startsWith('-')) {
      return undefined;
    }
    // Combined short flags that include `c` (e.g. -c, -lc, -ic, -lic).
    const flags = arg.slice(1);
    if (/^[a-zA-Z]+$/.test(flags) && flags.includes('c')) {
      return argv[i + 1];
    }
  }
  return undefined;
}

/**
 * `powershell -NoProfile -Command <script>` / `pwsh -c <script>` /
 * `powershell -EncodedCommand <base64 utf16le>`.
 */
function extractPowerShellScript(argv: readonly string[]): string | undefined {
  let i = 1;
  while (i < argv.length) {
    const lower = argv[i].toLowerCase();
    if (lower === '-command' || lower === '-c' || lower === '/c') {
      const rest = argv.slice(i + 1);
      return rest.length > 0 ? rest.join(' ') : undefined;
    }
    if (lower === '-encodedcommand' || lower === '-enc' || lower === '-e') {
      const encoded = argv[i + 1];
      return encoded ? decodePowerShellEncodedCommand(encoded) : undefined;
    }
    if (!lower.startsWith('-')) {
      // First positional argument is treated as the command by PowerShell.
      return argv.slice(i).join(' ');
    }
    // Skip the switch, and its value when it takes one.
    i += POWERSHELL_VALUE_SWITCHES.has(lower) ? 2 : 1;
  }
  return undefined;
}

function decodePowerShellEncodedCommand(encoded: string): string {
  try {
    const decoded = Buffer.from(encoded, 'base64').toString('utf16le');
    return decoded || encoded;
  } catch {
    return encoded;
  }
}
