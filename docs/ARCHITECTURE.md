# Architecture

claude-devtools is a standalone viewer for the session activity of coding
agents. It reads the session files that **Claude Code** and **Codex** already
persist on your machine and shows what the agent actually did: the session
chronology, messages, readable reasoning summaries, tool calls, shell commands,
patches, MCP calls, web searches, subagents, code-mode cells and their nested
operations, outputs, statuses and timing. It runs as an Electron desktop app or
as a standalone Node.js server that serves the same UI over HTTP.

It never writes to session files, never decodes encrypted content, and makes no
outbound network calls of its own (the Electron auto-updater is the one
exception, see [SECURITY.md](../SECURITY.md)).

```
Claude / Codex persisted session data
              │
              ▼
      provider-specific readers
              │
              ▼
       normalized session model
              │
              ▼
 execution / tool / result correlation
              │
              ▼
 timeline / execution tree / details
              │
              ▼
 Electron app + standalone HTTP viewer
```

## Providers

| Provider | Session files | Reader |
|---|---|---|
| Claude Code | `~/.claude/projects/<encoded-path>/*.jsonl` (plus `~/.claude/todos/`, project memory) | `src/main/services/` (parsing, discovery, analysis) |
| Codex (CLI, IDE extension, desktop app) | `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl[.zst]`, `CODEX_HOME` defaulting to `~/.codex` | `src/main/providers/codex/` |

Each provider keeps its own reader: the formats are not alike and are not
forced through one parser. Claude sessions are grouped into chunks
(`UserChunk`, `AIChunk`, …) for the chat view. Codex rollouts are normalized into
the provider-neutral model in `src/main/domain/` (`AgentSessionSummary`,
`AgentSessionDetail`, `TimelineEntry`, `Execution`), which the Codex view
renders. Compatibility logic for each producer version stays at the provider
boundary.

Codex rollouts are grouped by the working directory in their `session_meta`,
not by date directory. Three generations of command encoding are normalized
(`function_call` tools such as `exec_command`, `local_shell_call`, and code-mode
`exec` cells), along with hosted web search, MCP calls, patches and subagent
("collaboration") tools.

## Recorded vs inferred activity

The viewer keeps apart what the provider recorded and what the viewer
reconstructed. Every Codex `Execution` carries `evidence`:

| Class | Meaning |
|---|---|
| `observed` | a provider record shows the operation was attempted (a call record, an item record, an inventory entry) |
| `result` | a provider record carries its result (an output record or a completed item) |
| `code` | the operation appears in a code-mode script (static analysis only) |

A `tools.exec_command(...)` call site inside a persisted code cell proves that
the model wrote code for that operation, not that Codex ran it. Such children
keep the status `unknown` and the "script only" badge unless an independent
provider record is attributed to them.

Relations between records are labelled by how they were established:
`explicit_id` (records share an identifier), `turn_window` (same turn, recorded
while exactly one code cell of that turn was running; no identifier links them),
`content` (identical command text, used only when unique on both sides) and
`unresolved`. Statuses are `completed`, `failed`, `declined`, `interrupted`,
`running` and `unknown`; an operation without a recorded outcome stays
`unknown` rather than being reported as successful. Durations record whether
they were reported by the provider or computed from timestamps.

Examples from real rollouts: a command blocked by a PreToolUse hook is
`declined` (it never ran, no exit code applies); a user abort is `interrupted`;
a hosted web search item is linked to its call only when both carry the same
id; items recorded between two code cells stay unattributed. The evidence and
its limits are documented in [codex-real-validation/](codex-real-validation/).

## Code-mode nesting

A Codex code-mode cell is one `custom_tool_call` named `exec` whose JavaScript
dispatches nested tools. The cell is one timeline entry; its children are:

```
Code cell
 ├─ command        recorded (item attributed by turn window)
 ├─ file change    recorded
 ├─ MCP operation  recorded (linked by id)
 └─ command        script only (found in the code, no record)
```

A cell's running window opens with its call and closes with a terminal output
header, a header-less output, a `wait` that reports completion, or the end of
its turn; `Script running with cell ID …` (yield) and `notify()` outputs keep it
open. Subagent sessions start with a copy of the parent's history, which is
summarized by one "inherited context" entry; the subagent's title is its task
name, because the task text itself is stored encrypted.

## Live follow

- `CodexSessionWatcher` watches `$CODEX_HOME/sessions` recursively (100 ms
  per-file debounce) and polls today's and yesterday's date directories every
  3 s as a fallback.
- `CodexSessionService` reads rollouts incrementally: rollouts are append-only,
  so only bytes written since the last read are parsed; an unterminated last
  line is parsed provisionally and re-read once complete. Every read
  re-normalizes the cached records, so an incremental read gives the same result
  as a full parse (tested).
- Details carry a fingerprint (mtime, size, live state); a refresh with the
  current fingerprint returns `{ unchanged: true }`.
- Changes reach the renderer as IPC events in Electron and as server-sent
  events in standalone mode. A rollout modified in the last 10 minutes counts as
  live; the Codex view follows the most recently written live session until the
  user selects another one.

## Privacy expectations

- Session data is read locally and never sent anywhere by the viewer.
- Encrypted reasoning, encrypted inter-agent payloads and compaction history are
  never decoded; inline image data and encrypted blobs are dropped at parse time.
- Images referenced from Markdown in session content are not loaded; they are
  shown as links the user can open explicitly (an image URL can carry session
  data to its host).
- Real-derived test fixtures are sanitized by
  `scripts/codex-rollout-transcript.ts`: free text becomes `<string:N>`, chosen
  names (agent paths, task names, nicknames, roles, non-Codex tools) and model
  names become deterministic aliases, and a test checks that every committed
  fixture already satisfies the current rules. See the sanitizer contract in
  [codex-real-validation/README.md](codex-real-validation/README.md).

## Local HTTP trust boundary

The HTTP server (standalone mode, or the in-app server when enabled) serves
session contents without authentication, so it is local-only by default: it
binds to `127.0.0.1`, answers only `Host` headers naming `localhost`,
`127.0.0.0/8`, `[::1]` or an explicit `ALLOWED_HOSTS` entry (anything else gets
`403` before any route), and allows cross-origin reads from localhost origins
only. Serving other machines is an explicit configuration choice with a larger
trust boundary; remote serving has no authentication and is out of scope (see
[SECURITY.md](../SECURITY.md)).

## Known schema and version limitations

- Codex rollouts were validated against a real corpus written by producers
  0.42.0 and 0.137 to 0.155 (several alpha builds). New producer versions should
  be surveyed with
  `scripts/codex-rollout-survey.ts` before the parser is changed.
- Nested code-mode operations carry fresh `exec-<uuid>` ids that match no call.
  Attribution relies on the turn window; items recorded while no cell (or more
  than one cell) of their turn was running stay unattributed.
- Hosted web search calls from cli 0.137/0.140 carry no id and stay separate
  from their items.
- Script call sites without a provider record stay "script only"; real
  producers record no `executed_tool_calls` inventory.
- Subagent rollouts migrated from the legacy format declare an inherited-history
  boundary equal to their record count; the viewer ends the inherited prefix at
  the first record of the subagent's own history instead.
- `.jsonl.zst` rollouts need a runtime with `zlib.createZstdDecompress`
  (Node 22.15+/23.8+).
- Very large live sessions are re-normalized and re-sent in full on every
  change; see [ROADMAP.md](ROADMAP.md).
