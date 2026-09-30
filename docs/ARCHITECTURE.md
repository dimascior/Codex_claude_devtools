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

Read, list and search tags on commands are Codex's own classification
(`parsed_cmd`), shown only where Codex saved it: it is persisted on few command
records, so most commands carry no tag, and the viewer never derives one from
the command text. Entries Codex classified as `unknown` stay in the details
without a tag. Patches are shown as file writes: each file with its change
(added, updated, deleted, moved), from the patch's own headers or from the
`changes` Codex recorded. A file counts as written only when Codex recorded the
change as applied: a completed patch, or a completed `FileChange` /
`patch_apply_end` record, whatever kind of execution it was recorded for. A
shell call that ran a patch stays a command with its own outcome; the file
change is shown with it (`fileChangeStatus`, and a "File change record" in
its provenance). Nothing is inferred from command text: redirects, `sed -i`,
`mv`, `rm`, formatters and MCP tools write files Codex does not record, so they
are not counted. Each file of a file-change record keeps the change text Codex
recorded with it (`FileWrite.diff`: the `unified_diff` of an update, the
`content` of an added or deleted file, up to 64K characters per file and 256K
per record, with the size of the rest), shown as "Recorded changes" in the
details of executions that have no patch text of their own: patches run from a
code cell, and shell calls that ran a patch. A script's `tools.apply_patch(...)`
argument is static analysis of the cell, never the change shown for a recorded
write. In the timeline every recorded write is an entry of its own, with its
changes visible without expanding it: a write recorded while a code cell ran is
placed at the line of its record, names that cell and how it was attributed
(turn and record order), and is no longer listed in the cell's tree, which
counts it. The domain is unchanged (the write stays in the cell's `children`);
only the rows differ (`codexTimelineRows.ts`).

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

## Runtime state

The Codex view shows the settings each turn ran under (model, reasoning effort,
approval policy, sandbox, permission profile, …) and when they changed
(`CodexRuntimeStateBuilder`, domain types in `src/main/domain/RuntimeState.ts`).
The rules below are what the frozen 61-rollout corpus shows
([runtime-state-survey-2026-09-28.md](codex-real-validation/runtime-state-survey-2026-09-28.md),
producers 0.42.0 and 0.137 to 0.157.1); they are observations about those
versions, not guarantees about future ones.

```
first turn_context of each turn
    = effective state of that turn (TurnRuntimeState, with its rollout line)

thread_settings_applied
    = recorded transition, effective from the next turn;
      the turn already running keeps its settings

turns no recorded transition covers
    = changes observed by comparing consecutive turn states (turn_context_diff)
```

- **Effective turn state.** Every turn with executions had its first
  `turn_context` before its first tool call. Codex writes the record again after
  a mid-turn compaction; all 124 repeats in the corpus had identical settings
  and are ignored. A later record for the same turn that differs keeps the first
  as the turn's state and adds a warning naming only line numbers and keys.
- **Recorded transitions.** Each `thread_settings_applied` for the rollout's own
  thread is compared with the thread settings recorded before it, on known
  fields only; unchanged fields are dropped and identical records (most of them)
  add nothing. The first record is the baseline. A change applies from the next
  turn (`next_turn`), or from the first turn when recorded before any
  (`first_turn`). A record written mid-turn names the running turn, whose state
  is not changed: in the corpus such a change never altered the running turn,
  and every change not reverted before the next turn appeared in that turn's
  `turn_context`.
- **Observed changes.** Whether a change was recorded is decided from the file,
  per turn boundary, never from the CLI version: two consecutive turn states are
  compared unless thread settings were already recorded before the earlier one.
  This covers sessions without `thread_settings_applied` (old producers, but
  also individual 0.145 and 0.157.1 sessions) and the turns before the first
  record in sessions that start recording mid-file (17 of the 37 sessions with
  thread settings, e.g. a session resumed by a newer producer). Such entries are
  `turn_context_diff`: the viewer observed a different effective state, which
  does not prove Codex emitted a settings event. They are shown dashed as
  "Runtime state changed · Derived from effective turn contexts", never as a
  Codex event.
- **Executions** carry no copy of the state: they are related to their turn's
  state through `turnId`. The execution details show it as "Effective runtime"
  (with its `turn_context` line), a section apart from Provenance: it describes
  the turn, not evidence about the execution.
- **Header.** The session header shows the latest effective turn state (Model,
  Effort, Approval, Sandbox, Profile; the other settings behind "more"). The
  session list still shows the model of the first turn context (see
  [ROADMAP.md](ROADMAP.md)).

Exceptions the corpus shows:

- `turn_context.summary` (`turnSummary`) is not `reasoning_summary`
  (`reasoningSummary`): before 0.155, turns record `auto` while the thread
  setting reads `detailed` or `none`. Both are kept; neither is mapped onto the
  other.
- `service_tier` was recorded only in thread settings. It is shown as thread
  state and in settings changes, never as a per-turn value.
- `active_permission_profile` appears in `turn_context` only from about 0.153;
  before that it is thread-level only and is not copied into turn states.
- Working directories are compared ignoring letter case and separator style on
  Windows paths (all 100 disagreements were letter case only) and are shown as
  Codex wrote them.
- Only the number of `workspace_roots` is kept; `runtime_workspace_roots` is a
  different field and is not read.
- A setting only one of two states records is not compared: coverage differs
  between producer versions.

## Subagent sessions

A Codex parent rollout and the subagent rollouts it spawned stay separate
sessions with separate timelines; the viewer links them. A `spawn_agent`
execution in the parent shows the child session it started, with an explicit
**Open child** button; a subagent's header shows **Spawned by** with **Open
parent**, which opens the parent rollout at the spawn call. Navigation uses the
viewer's session id (one rollout file), never a thread id: one Codex thread can
span several rollout files (a continuation is named
`rollout-<timestamp>-<thread>_<suffix>.jsonl`).

The only relation used is the id chain the committed full-corpus survey
verified (22 of 22 spawns resolved to exactly one child rollout, all agreeing
with the child's declared parent, no contradiction, cli 0.147.0-alpha.6.6,
0.153.0 and 0.153.4; `docs/codex-real-validation/`):

```
parent: function_call spawn_agent (namespace collaboration)   call_id = X
            │ same id
            ▼
parent: item_completed SubAgentActivity {kind: started}        id = X
            │ agent_thread_id = T
            ▼
child:  session_meta.id = T
```

- **Parent → child** (`CodexSessionRelations`): each spawn call of the parent's
  own history is joined to the `started` items carrying exactly its call id
  (`CodexSpawnObservations`); their `agent_thread_id` names the child thread,
  and the child is the one rollout file whose `session_meta.id` is that thread.
- **Child → parent**: the child's declared parent thread (`parent_thread_id`,
  else `source.subagent.thread_spawn.parent_thread_id`) only narrows the search
  to that thread's rollout files. The parent is the one file whose own history
  holds a spawn call whose `started` item names the child's thread; the
  relation carries that file and the spawn call (the execution to focus).
- **Not resolved means not guessed**: no rollout of the named thread →
  `missing_session` (a live child whose file has not appeared yet, or a deleted
  one); several files, or `started` items naming different threads for one
  call → `ambiguous`, with the candidates listed and none chosen; a spawn call
  no `started` item confirms, or no candidate proving the chain → `unresolved`.
  Only `resolved` relations navigate.
- **Never used as identity**: timestamps or nearness to the spawn, a child's
  `session_id` (the root session, not the direct parent: wrong for a depth-2
  child), its declared parent thread alone, `agent_path` or agent names,
  working directories, the targets of other `SubAgentActivity` kinds
  (`interacted`, `interrupted`, `completed` also name roots and siblings) and
  `CollabAgentToolCall`. A fork's `forked_from_id` is not a spawn.
- **Inherited history**: records copied from the parent into a subagent
  rollout are skipped by the same `InheritedHistoryTracker` rules as the
  timeline, so a subagent never appears to have spawned its siblings.
- **Evidence**: a relation (`AgentSessionRelation`, `src/main/domain/SessionRelation.ts`)
  records its method (`explicit_id_chain`), the spawn call and `started` record
  with their rollout lines, and the thread ids. It is kept apart from execution
  evidence (`Execution.evidence` is unchanged) and shown in the spawn card's
  details and in the subagent header ("Evidence").
- **Cost**: listing reads no spawn records. A relation request reads the
  session's own spawn records (from the records its detail view already parsed,
  else with a byte-level line pre-filter that parses only lines that can carry
  them), stats the rollout files, and reads the heads of the files named for
  the threads it looks up; a subagent also reads the spawn records of its
  declared parent thread's files, and nothing else. Reads are incremental and
  cached per file stat. Rollout files are found by the thread id in their name
  (Codex names each rollout after its thread) or by a `session_meta` already
  read, and each is confirmed by its `session_meta.id`.

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
- Subagent relations of the selected session are fetched after its detail and
  refreshed (throttled) on every rollout change: a child whose rollout appears
  becomes navigable, and a deleted one stops being a target. Watcher add/unlink
  events refresh the relation layer's list of rollout files.

## Privacy expectations

- Session data is read locally and never sent anywhere by the viewer.
- Encrypted reasoning, encrypted inter-agent payloads and compaction history are
  never decoded; inline image data and encrypted blobs are dropped at parse time.
- Images referenced from Markdown in session content are not loaded; they are
  shown as links the user can open explicitly (an image URL can carry session
  data to its host).
- Real-derived test fixtures are sanitized by
  `scripts/codex-rollout-transcript.ts`: free text becomes `<string:N>`, chosen
  names (agent paths, task names, nicknames, roles, non-Codex tools), model
  names and file paths become deterministic aliases (file contents and diffs
  are dropped), and a test checks that every committed fixture already
  satisfies the current rules. See the sanitizer contract in
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
- Subagent relations are verified on the real corpus by the committed survey
  (22/22), not by real-derived fixtures: the sanitized fixtures replace
  `agent_thread_id` with `<string:36>`, so the join is regression-tested on a
  labelled synthetic family (`test/fixtures/codex/subagentFamily.ts`).
- Rollout files are located by the thread id in their name before their
  `session_meta.id` confirms them. A rollout whose name did not carry its own
  thread id, and whose head the listing never read, would not be found for a
  relation (Codex always names rollouts after their thread).
- `session_meta.cli_version` names the producer that created a rollout, not
  the one that wrote later records: resumed sessions can switch record types
  and fields mid-file (e.g. start writing `thread_settings_applied`). Runtime
  state therefore uses what each part of the file records, not the version.
- Turn contexts and executions without a turn id (legacy rollouts) cannot be
  told apart from re-emissions by id: a record naming no turn belongs to the
  turn that is open, if any.
- `.jsonl.zst` rollouts need a runtime with `zlib.createZstdDecompress`
  (Node 22.15+/23.8+).
- Very large live sessions are re-normalized and re-sent in full on every
  change; see [ROADMAP.md](ROADMAP.md).
