# Codex Real-Rollout Validation Evidence

These files were derived from actual Codex rollout files on a Windows workstation on 2026-09-27 and 2026-09-28.

They are NOT synthetic Codex fixtures.

Source location on the evidence-producing machine:

    %USERPROFILE%\.codex\sessions

The raw rollout files are intentionally not committed.

Local collection was performed by Copilot against the real filesystem.
Claude operating through GitHub does not have access to the source machine.
The 2026-09-28 runtime-state survey was collected by Claude Code on that
machine, from a frozen snapshot (see "2026-09-28 corpus" below).

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

## 2026-09-28 corpus

On 2026-09-28 the sessions directory held 61 rollouts, not 58. It was frozen
into a read-only local snapshot (`codex-corpus-2026-09-28`, outside the
repository, with a `sha256-manifest.csv`), and both 2026-09-28 reports were
generated from that snapshot at `6b9d872`, not from the live directory.

| | 2026-09-27 baseline | Report A: frozen corpus | Report B: original-58 membership |
|---|---|---|---|
| Rollouts | 58 | 61 | 58 |
| Size | 262.4 MB | 302,539,974 bytes (288.5 MB) | 297,655,522 bytes (283.9 MB) |
| Date range | 2025-10-02 → 2026-09-23 | 2025-10-02 → 2026-09-28 | 2025-10-02 → 2026-09-23 |
| Largest rollout | 106.7 MB, 70,234 lines (live) | 128.2 MB, 76,443 lines | same revision as A |
| Manifest SHA-256 | none recorded | `d51cd57bbdc7f9b1b870dd0b5957aca7f796c76d74ff8a5447f865e33e9623ea` | `3386b6c3377ca7bdba62cc5ce86c25e76fc8d563cdf23fa6356ead10684fea67` |

Membership of the original 58 is decided per file, not by count or age: the
UUIDv7 of each rollout's own id encodes its creation time. 58 rollouts were
created before the baseline survey ran (2026-09-27T13:45:36Z). Three were
created after it and are not members:

- `2026/09/27/rollout-2026-09-27T14-57-47-01a0e43b-01a5-7c10-8dd4-f8057ed243fb.jsonl`
  (created 2026-09-27T18:57:47Z; cli 0.42.0, codex_cli_rs)
- `2026/09/28/rollout-2026-09-28T01-09-05-01a0e66a-a85b-77e3-9b4d-a31413d9b7fe.jsonl`
  (2026-09-28T05:09:04Z; cli 0.157.1, codex-tui)
- `2026/09/28/rollout-2026-09-28T01-12-54-01a0e66e-28b8-7e03-8a56-fd228883a0e2.jsonl`
  (2026-09-28T05:12:54Z; cli 0.155.0-alpha.16.3, codex_vscode)

Report B's input equals the 58 members, with hashes identical to the snapshot
manifest, and matches the baseline in file count, date range, p50/p90 size,
files over 50 MB, project groups and originator/source split.

Revisions: 57 members were last written before the baseline survey (newest
2026-09-23T21:38Z), so they are unchanged since it by modification time; no
hashes were recorded at the time. One member was live during the baseline and
kept growing:

- `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl`:
  original corpus membership yes; original byte revision no; current
  revision 134,407,764 bytes, 76,443 lines (last written 2026-09-28T03:29Z),
  about +21.5 MB over the baseline's 106.7 MB. No copy or hash of the old
  bytes exists. Its 2026-09-27 structural transcript (70,343 lines, local
  only) matches the current file line by line on length, type, timestamp,
  ordinal and payload type with 0 mismatches, consistent with append-only
  growth of 6,100 lines: structural consistency, not byte identity.

Report B is "original-58 membership, current revisions", not the 2026-09-27
corpus. Report A is the evidence set for runtime state; what it shows about
cli 0.157.1, `session_meta.creator_*`, `memory_mode` and `history_mode: legacy`
comes from the three newer rollouts alone.

## Evidence levels

`rollout-survey-2026-09-27.md`
    Aggregate observations across the real corpus, produced by
    `scripts/codex-rollout-survey.ts --all`. Contains rollout file names and
    tool names but no content; model names are replaced by per-report aliases.
    It predates the survey's "Runtime state and relationships" section
    (settings records, their changes and relations, token usage records, turn
    lifecycle fields, subagent joins); see the 2026-09-28 reports.

`runtime-state-survey-2026-09-28.md`
    Report A, the evidence set for runtime state: the same survey at 6b9d872
    over the frozen 61-rollout 2026-09-28 corpus, including "Runtime state and
    relationships" (settings fields by record family and CLI version, value
    changes, `thread_settings_applied` vs `turn_context`, `token_usage_record`
    relations, turn lifecycle fields, subagent joins).

`runtime-state-survey-2026-09-28-original58-membership.md`
    Report B: the same survey over the 58 rollouts of the 2026-09-27 survey at
    their 2026-09-28 revisions, for comparison with the baseline; not a
    reproduction of it.

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
    - `thread-settings-changes.jsonl`: four windows of one rollout of the
      2026-09-28 corpus (built from its v2 transcript): turns before any
      `thread_settings_applied`, the first record (line 1000) and the next
      `turn_context` changing approval, sandbox and permission profile
      (observed, not recorded as a change), mid-turn records changing model and
      effort (1010, 1011) that the running turn does not take, identical
      repeats, a between-turn effort change (3205) carried by the next turn,
      and an identical `turn_context` written again after a mid-turn
      compaction (4100/4111). `session_meta` names 0.142.0-alpha.6; the
      records from line 1000 on have newer record types and fields (a resume
      by a newer producer is consistent with that).

`parser-findings.md`
    Analysis of the Codex parser against this evidence: findings table,
    correlation classes, the three real anomaly classes, schema coverage,
    the changes made and a before/after survey on the committed fixtures.
    Regression tests: `test/main/providers/codex/realObserved.test.ts`.
    Its treatment of `thread_settings_applied` (recognized, not rendered)
    predates the runtime-state work; see "Runtime state" in
    `docs/ARCHITECTURE.md` and `test/main/providers/codex/runtimeState.test.ts`.

Tooling (not evidence):
    `scripts/codex-rollout-transcript.ts` is the sanitizer that produced the
    `real-observed` fixtures. `--select relations` and `--select file-changes`
    keep only the records one kind of evidence needs (with their real line
    numbers), for rollouts too large to transcribe whole. `test/scripts/codexRolloutTranscript.test.ts`
    checks that commands, outputs, cwd, paths, URLs, `parsed_cmd` name/path,
    chosen agent, task, role and tool names and model names cannot survive
    it, and that every committed fixture is unchanged by the current rules
    (so nothing the sanitizer would replace or alias is committed). The
    script demonstrates how the evidence was reduced; it says nothing about
    Codex behaviour by itself.

Synthetic fixtures elsewhere in the test suite:
    Developer-created regression material. They must not be treated as proof of compatibility with the actual Codex installations.

## Subagent relations

The viewer relates a parent rollout and the subagent rollouts it spawned
(`docs/ARCHITECTURE.md`, "Subagent sessions") only through the chain that
Report A (section F: "Join methods", "SubAgentActivity kinds and id forms") and
Q4 of `local-full-corpus-verification-2026-09-27.md` establish on raw data:

    spawn_agent call_id               = SubAgentActivity(kind started).id
    SubAgentActivity.agent_thread_id  = child session_meta.id

All 22 spawn calls with a `started` item (cli 0.147.0-alpha.6.6, 0.153.0,
0.153.4) resolved to exactly one child rollout, agreeing with the child's
declared parent, with no contradiction. The same tables are why nothing else
identifies a relation:

- `agent_thread_id` of other activity kinds: 110 records in all, 17 naming a
  thread with several rollouts and 2 contradicting the declared parent; they
  also name roots and siblings.
- a declared parent thread alone: one thread spans two rollout files (thread
  `01a07967-…`, the declared parent of `subagent-declared-boundary.jsonl`,
  continued in `rollout-…-01a07967-…_01a08987-….jsonl`), so a thread id does
  not choose a file.
- `session_meta.session_id`: the root session; it contradicts the direct
  parent for one child.
- agent paths and timing: structure and order, not identities.

The sanitized fixtures cannot show the join: sanitizer versions 1 and 2
replace `agent_thread_id` with `<string:36>`. `subagent-thread-spawn.jsonl`
still shows that a `started` item copied into a subagent's inherited prefix
(line 19) is not that subagent's own spawn. The join itself is
regression-tested on a labelled synthetic family
(`test/fixtures/codex/subagentFamily.ts`, used by
`test/main/providers/codex/sessionRelations.test.ts`), which is not
compatibility evidence. Real-derived join fixtures would need a sanitizer rule
that keeps `agent_thread_id` UUIDs and fixtures regenerated from the raw
rollouts on the evidence machine.

## Local pass: real-derived relation and file-change fixtures

The committed fixtures cannot show a subagent join or which files a change
touched (see above). Sanitizer version 3 keeps both, so the next fixtures cut
on the evidence machine can. Steps, from the repository root, against the
frozen snapshot `codex-corpus-2026-09-28` (never the live directory):

1. Children, whole files (small): regenerate `subagent-thread-spawn.jsonl`
   and `subagent-declared-boundary.jsonl` from the rollouts named in their
   headers, with
   `pnpm exec tsx scripts/codex-rollout-transcript.ts --file SNAPSHOT/… --out tests/fixtures/codex/real-observed/NAME.jsonl`.
2. Parents, relation records only: the rollout of thread
   `01a09d90-2086-7f92-9e12-670bc277cf90` (parent of the first child) and both
   rollouts of thread `01a07967-8252-7b21-8524-3164700549b1` (parent of the
   second: `2026/09/06/rollout-2026-09-06T21-07-02-01a07967-…` and its
   continuation `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-…_01a08987-…`),
   each with `--select relations` into a new `subagent-parent-*.jsonl`.
3. File changes: rollouts with `FileChange` items (the newest large rollout
   has many) and the one with `patch_apply_end` events, each with
   `--select file-changes` into a new `file-changes-*.jsonl`.
4. Run `pnpm exec tsx scripts/codex-rollout-survey.ts --all` and read "File
   lists (files written)": a row for a non-patch execution with a
   file-change record answers whether Codex records file changes under the
   id of a shell call.
5. Review every new fixture before committing (`pnpm test` checks the
   contract; paths must appear only as `<path-N>`), then add regression tests:
   parent → child and child → parent resolve over the transcripts written back
   as rollouts, only one of the two `01a07967-…` files holds the spawn of
   `01a08b56-…`, and parsed file changes keep their types, moves and counts.

## Sanitizer contract (version 3)

Each transcript line is `{"line": N, "bytes": B, ...record}` where `line` is the
1-based line number in the real rollout and `bytes` is the raw line length.
Headers carry `sanitizer_version`.

Preserved, when the value has the shape its key allows: record type, payload
type, ordering, ordinals, ISO timestamps, CLI versions, provider-generated ids
(UUIDs, `call_…`/`ws_…`/`rs_…`-style opaque ids, counters such as `item-17`,
built-in `:…` ids) including the thread a `SubAgentActivity` names
(`agent_thread_id`, since version 3), status, role, phase, single-token enum
settings, model
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
(`<provider-N>`), ids that are not provider-generated (`<id-N>`), object
keys that are not plain identifiers (`<key-N>`) and, since version 3, file
paths in file-change maps (`<path-N>`): the `changes` of `FileChange` items and
`patch_apply_end` events keep one entry per file, keyed by its path alias,
with the change `type` (`add`, `update`, `delete`) and an aliased `move_path`;
contents and diffs are replaced. One alias table per transcript, so a file
changed twice, or moved and changed again, keeps one alias.

Replaced: every other string becomes `<string:N>` (N = original length);
omitted arrays/objects become `<array:N>` / `<object:N>`. This covers message
text, reasoning, arguments, inputs, outputs, stdout/stderr, commands, cwd,
paths, URLs, git info, file contents and diffs, and `parsed_cmd` entries
(only their `type` is kept). A `changes` value that is not a map of files is
replaced by its size. Arrays other than `content` are truncated to 12 items.

`--resanitize TRANSCRIPT` applies these rules to an existing transcript,
keeping `line`, `bytes`, placeholders, aliases and `_evidence_*` separators.
The committed fixtures were produced by version 1 and brought to version 2
this way, because the raw rollouts are not available outside the evidence
machine: agent nicknames, inter-agent recipients and model names were
aliased, and values version 1 had already reduced (such as `agent_path`) stay
`<string:N>`. Bringing them to version 3 changed only their headers: their
`agent_thread_id` values are still `<string:36>` and their `changes` maps
`<object:N>`, so they show neither subagent joins nor which files changed.
Regenerating a fixture from its raw rollout with version 3 keeps both.

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
