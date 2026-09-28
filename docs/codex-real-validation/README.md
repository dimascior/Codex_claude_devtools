# Codex Real-Rollout Validation Evidence

These files were derived from actual Codex rollout files on a Windows workstation on 2026-09-27.

They are NOT synthetic Codex fixtures.

Source location on the evidence-producing machine:

    %USERPROFILE%\.codex\sessions

The raw rollout files are intentionally not committed.

Local collection was performed by Copilot against the real filesystem.
Claude operating through GitHub does not have access to the source machine.

## Observed corpus

- 58 rollout files
- All JSONL (0 `.jsonl.zst`)
- Approximately 262 MB; p50 331 KB, p90 5.9 MB, max 106.7 MB
- Date range 2025-10-02 to 2026-09-23
- Windows drive-path working directories
- Multiple producer/origin combinations:
  - codex_vscode (source vscode, and subagent:thread_spawn)
  - codex_work_desktop (source vscode, and subagent:thread_spawn)
  - codex_cli_rs (source vscode)
  - codex_exec (source exec)
  - 22 of 58 sessions are subagent or forked

## Current producer observations

The `codex` npm shim on PATH reported 0.42.0, but it was not the producer of the active rollout.

Observed running producer binaries included:

- Codex CLI 0.158.0-alpha.2.1 (`%LOCALAPPDATA%\OpenAI\Codex\bin\...\codex.exe`)
- VS Code Codex CLI 0.155.0-alpha.16.3 (`openai.chatgpt` extension bundle)

Use session_meta.cli_version when reasoning about the producer of an individual rollout.

The newest rollout (106.7 MB, ~70,300 lines) was still being written while it was surveyed.
Counts derived from it are a snapshot and may differ slightly between files in this package.

## Evidence levels

`rollout-survey-2026-09-27.md`
    Aggregate observations across the real corpus, produced by
    `scripts/codex-rollout-survey.ts --all`. Contains rollout file names and
    tool names but no content; model names are replaced by per-report aliases.
    It predates the survey's "Runtime state and relationships" section
    (settings records, their changes and relations, token usage records, turn
    lifecycle fields, subagent joins); that section needs a new run over the
    raw corpus.

`current-code-mode-shapes.txt`
    Record/payload-type and item_completed item-type histograms from the
    newest (live) rollout, plus nested code-mode passthrough findings.

`correlation-windows.md`
    Structural observations for each contiguous window in
    `current-code-mode-correlation-windows.jsonl`: which identifiers are
    shared between exec calls, function calls and item_completed events,
    and where correspondence is only chronological.

`local-full-corpus-verification-2026-09-27.md`
    Verification of the parser at 7f38892 against all 58 raw rollouts:
    before/after survey, Claude's seven local-only questions answered from
    raw data, turn-window and subagent-boundary measurements, and the two
    parser defects found and corrected (subagent boundary, hosted web
    search item-before-call).

`codebase-review-2026-09-27.md`
    Review of that commit against nine properties, the upstream source that
    explains subagent rollouts whose boundary equals their record count
    (legacy rollout migration), the subagent-title and id-less web search
    decisions, the defects corrected afterwards, the remaining unresolved
    cases, and known risks left for follow-up.

`../../tests/fixtures/codex/real-observed/*.jsonl`
    Sanitized structural records derived from real rollout records.
    - `subagent-thread-spawn.jsonl`: one complete 171-line subagent rollout
      (cli_version 0.153.0, source subagent:thread_spawn), every record.
    - `current-*.jsonl` and `thread-settings-applied.jsonl`: representative
      records from the newest rollout, selected by payload/item type.
    - `current-code-mode-correlation-windows.jsonl`: eight contiguous slices
      of the newest rollout preserving order around exec calls. Separator
      records with a leading-underscore key (`_evidence_window`) are
      synthetic; everything else is a sanitized record.
    - `subagent-declared-boundary.jsonl`: one complete subagent rollout whose
      declared `subagent_history_start_ordinal` is correct (two session_meta
      records; boundary at the subagent's `thread_settings_applied`).
      `subagent-thread-spawn.jsonl` is the other real pattern: the declared
      boundary equals the record count.
    - `hosted-web-search-windows.jsonl`: hosted `web_search_call` records and
      the WebSearch items persisted one record before them, with (cli 0.142.5)
      and without (cli 0.137) matching ids.

`parser-findings.md`
    Analysis of the Codex parser against this evidence: findings table,
    correlation classes, the three real anomaly classes, schema coverage,
    the changes made and a before/after survey on the committed fixtures.
    Regression tests: `test/main/providers/codex/realObserved.test.ts`.

Tooling (not evidence):
    `scripts/codex-rollout-transcript.ts` is the sanitizer that produced the
    `real-observed` fixtures. `test/scripts/codexRolloutTranscript.test.ts`
    checks that commands, outputs, cwd, paths, URLs, `parsed_cmd` name/path,
    chosen agent, task, role and tool names and model names cannot survive
    it, and that every committed fixture is unchanged by the current rules
    (so nothing the sanitizer would replace or alias is committed). The
    script demonstrates how the evidence was reduced; it says nothing about
    Codex behaviour by itself.

Synthetic fixtures elsewhere in the test suite:
    Developer-created regression material. They must not be treated as proof of compatibility with the actual Codex installations.

## Sanitizer contract (version 2)

Each transcript line is `{"line": N, "bytes": B, ...record}` where `line` is the
1-based line number in the real rollout and `bytes` is the raw line length.
Headers carry `sanitizer_version`.

Preserved, when the value has the shape its key allows: record type, payload
type, ordering, ordinals, ISO timestamps, CLI versions, provider-generated ids
(UUIDs, `call_…`/`ws_…`/`rs_…`-style opaque ids, counters such as `item-17`,
built-in `:…` ids), status, role, phase, single-token enum settings, model
provider ids Codex defines (`openai`, `ollama`, `lmstudio`, `amazon-bedrock…`),
tool names and namespaces that Codex defines (built-in tools, `clock`,
`collaboration`, `web`, `mcp__node_repl`, `mcp__cua_repl`,
`mcp__codex_apps…`), numeric values, booleans and content-item `type`
values. A value with spaces, path separators or a URL under one of these keys
becomes `<string:N>`.

Aliased (deterministic within one transcript; equal values get equal aliases,
the alias says nothing else): agent paths keep the root (`/root`) and alias
every segment below it (`/root/<task-1>`), task names (`<task-N>`), agent
nicknames (`<agent-N>`), agent roles (`<role-N>`), tool names and MCP servers
Codex does not define (`<tool-N>`, `mcp__<server-N>`), model identifiers
(`model`, `from_model`, `to_model`: `<model-N>`), other model provider ids
(`<provider-N>`), ids that are not provider-generated (`<id-N>`) and object
keys that are not plain identifiers (`<key-N>`).

Replaced: every other string becomes `<string:N>` (N = original length);
omitted arrays/objects become `<array:N>` / `<object:N>`. This covers message
text, reasoning, arguments, inputs, outputs, stdout/stderr, commands, cwd,
paths, URLs, git info, and `parsed_cmd` entries (only their `type` is kept).
Arrays other than `content` are truncated to 12 items.

`--resanitize TRANSCRIPT` applies these rules to an existing transcript,
keeping `line`, `bytes`, placeholders, aliases and `_evidence_*` separators.
The committed fixtures were produced by version 1 and brought to version 2
this way, because the raw rollouts are not available outside the evidence
machine: agent nicknames, inter-agent recipients and model names were
aliased, and values version 1 had already reduced (such as `agent_path`) stay
`<string:N>`. Regenerating a fixture from its raw rollout with version 2
aliases those as well.

## Interpretation caution

Do not infer that a nested operation executed merely because its source
code appears in a code-mode cell. Recorded execution and script-inferred
execution are distinct evidence classes.

In the newest rollout, no record carried `executed_tool_calls` or `cell_id`
passthrough metadata; the only `custom_tool_call` name was `exec`, and
`function_call` names were `js`, `wait`, `sleep`, `request_user_input_async`.
Nested operations in that rollout are therefore evidenced by `item_completed`
events (CommandExecution, FileChange, McpToolCall, WebSearch), not by
passthrough metadata. Those events carry `exec-<uuid>` item ids that never
equal the parent exec's `call_id`; see `correlation-windows.md`.
