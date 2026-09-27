# Parser findings against the real Codex evidence

Written 2026-09-27, before any parser change, from:

- `rollout-survey-2026-09-27.md` (58 real rollouts, survey of commit be6c718)
- `current-code-mode-shapes.txt`, `correlation-windows.md`
- `tests/fixtures/codex/real-observed/*.jsonl` (sanitized real records)
- the parser as of commit be6c718 (`src/main/providers/codex/`)
- upstream `openai/codex` at `main` 18344a9 (2026-09-27), for semantics only

Evidence levels used below:

| Tag | Meaning |
|---|---|
| **R** | verified from real committed evidence (fixture records or survey counts) |
| **S** | inferred from structural ordering or from counts that reconcile exactly |
| **U** | verified only by upstream Codex source. The real producers were 0.153 to 0.158 alphas, so upstream `main` may differ from them |
| **L** | still requires local raw-rollout inspection |

## 1. Findings

| # | Real observation | Current parser behavior | Actual persisted linkage | Root cause | Change required? |
|---|---|---|---|---|---|
| 1 | Newest rollout: 0 records carry `executed_tool_calls` or `cell_id` passthrough; the only custom tool is `exec` (**R**). Upstream records `executed_tool_calls` only when `Feature::ExecutedToolCallMetadata` is enabled; "missing evidence remains incomplete" (**U**). | Treats the passthrough inventory as the primary source of nested calls and static script parsing as the fallback, so 11,448 real cells got script-derived children (**R**, survey "children script"). | None: the producer did not persist an inventory. | Design assumption not met by the real producers. | Yes. Script-derived children must be labelled as static analysis only, and recorded items must become the primary execution evidence. |
| 2 | Nested operations are persisted as `event_msg/item_completed` items with ids `exec-<uuid>`: FileChange 2430, CommandExecution 141, McpToolCall 93, WebSearch 8 in the newest rollout (**R**). Upstream builds nested call ids as `format!("exec-{}", Uuid::new_v4())`, and the cell link (`cell_id`, `runtime_tool_call_id`) lives only in memory and telemetry (**U**). | FileChange and McpToolCall are looked up by `item.id` as a call id, not found, and **silently dropped**. WebSearch and Extension are not parsed. CommandExecution goes through content heuristics (row 3). | No identifier links an `exec-` item to its cell (0/2671). Shared: `turn_id` (2671/2671). Order: inside the call→output window (2671/2671; one straddle, Window 8) (**R**). | The join key the parser relies on (`item.id == call_id`) is never satisfied for code-mode items. | Yes. Keep every item as recorded evidence. Attach it to a cell only by a turn-scoped, ordered rule, or leave it unattributed. |
| 3 | CommandExecution: 402 items in 7 of 38 code-mode sessions, all `source = unified_exec_startup` (**R**). | Attributes to a script child by normalized command text, else to the **first unresolved child whose command is dynamic (`‹…›`)**, else appends an extra child (sets `childrenSource = 'recorded'`), else matches recent top-level commands by text. Survey: 198 matched script children, 203 appended, 1 standalone (**S**). | Turn and order only (**R**); command text is content (sanitized in fixtures). | The positional `‹` fallback and top-level text matching are not defensible. The appended children were mislabelled `recorded` (as if they came from an inventory). | Yes. Remove the positional and top-level fallbacks. Link to a script call only on a unique exact command match, labelled content-dependent. |
| 4 | `function_call js` (namespace `mcp__cua_repl` / `mcp__node_repl`) produces McpToolCall with `item.id == call_id` (15/15) (**R**). | Applied by id (explicit); duration and failure set. | Explicit id. | — | Keep; add provenance. |
| 5 | `function_call sleep` (namespace `clock`) produces `Extension kind=clock.sleep`, `item.id == call_id` (20/20), with `durationMs` plus `started_at_ms`/`completed_at_ms` (**R**). Upstream: the sleep item id is the call id and `duration_ms` is the requested duration (**U**). | Extension is ignored; the call's timing comes from envelope timestamps. | Explicit id. | Unparsed item type. | Yes. Parse it and use the provider timestamps (3012 ms in Window 3). Do not use `durationMs` as the measured duration: it is the requested sleep. |
| 6 | `wait` calls produce no `item_completed` (140/140) (**R**). They carry `cell_id` in their arguments, and exec output headers carry `Script running with cell ID …` (**R**, survey argument fields and header counts). | wait is linked to its cell by that id. | Explicit id, carried in harness-formatted text (arguments and outputs are sanitized in fixtures, **L**). | — | Keep. The cell's running window must stay open while it has yielded. |
| 7 | CommandExecution items carry `exit_code`, `duration {secs,nanos}`, `process_id`, `started_at_ms`/`completed_at_ms` (**R**). | Duration is marked "reported" (boolean). Item timestamps are ignored. | — | No distinction between a provider duration field, provider timestamps and envelope timestamps. | Yes. Record the duration source explicitly. |
| 8 | Window 8: a CommandExecution (line 66906) starts during exec A's window, completes after A's output, and sits before exec B's call (**R**). | Attached only if A is still `running`, otherwise text-matched to top-level commands or made standalone. | Order and time only; ambiguous (**R**). | — | Yes. Attribute only when exactly one cell of the same turn is open at the item's record position. Otherwise keep the item unattributed (never guess). |
| 9 | Window 6: five McpToolCall `exec-` items in one exec window (**R**). | All five dropped. | Turn and order only. They cannot be mapped to individual script calls. | Bug (row 2). | Yes. Keep all five as recorded children of that cell, in record order, not mapped to script calls. |
| 10 | WebSearch `exec-` items have no `status` and no `started_at_ms` (**R**). Upstream sets the hosted WebSearch item id to the `web_search_call.id` (**U**; not present in fixtures, **L**). | Not parsed. `web_search_call` is shown completed without a duration. | Turn/order (code mode); explicit id (hosted, per upstream). | Unparsed item type. | Yes. Parse it. Completion comes from the `item_completed` record itself; there is no duration. |
| 11 | FileChange items: `status`, `changes` (object keyed by path), `stdout`, sometimes `stderr`, no exit code (**R**). Upstream `PatchApplyStatus` is completed/failed/declined (**U**). | Dropped for `exec-` ids. | Turn/order. | Bug (row 2). | Yes. Keep them as recorded patch items with their files. |
| 12 | Forked subagent rollout: `session_meta.subagent_history_start_ordinal = 171`, and every record has ordinal 0–170 (**R**). Upstream: "first rollout ordinal that belongs to this subagent's projected history", and lines with `ordinal < start` are excluded from projection (**U**). 22/58 real sessions are subagents or forks (**R**). | Renders the inherited parent turns, messages and items as the child's own activity, all stamped at the fork time (05:55:53.049–.056 for days of history) (**R**). | Explicit schema field. | The schema field was ignored. | Yes. Exclude inherited records from the child's executions and timeline, and show one "inherited context" marker. |
| 13 | Output text `Command blocked by PreToolUse hook: …` family: 323 outputs (**S**, from skeletons `Command …: …` / `Command …: #`, which the upstream string collapses to exactly; plus variants `… Command:` and `REJECTED:`). Upstream string: `Command blocked by PreToolUse hook: {reason}. Command: {command}` (**U**). | Not recognized, so shown as **completed** commands with no exit code. | Harness-formatted text. | Missing outcome pattern. | Yes. Classify as declined (blocked by hook). An exit code does not apply. |
| 14 | `Wall time: N seconds` followed by `aborted by user` (3 outputs) (**S**+**U**). | Header rejected (no `Output:` line), so shown as completed. | — | Missing outcome pattern. | Yes. Interrupted, with the reported wall time. |
| 15 | `write_stdin failed: Unified exec process failed: …` (3 outputs) (**S**+**U**). | Completed. | — | Missing outcome pattern. | Yes. Failed. |
| 16 | 14 exec outputs have no script header (**R**, survey `exec → no header`). | The cell stays `running` and is later finalized as "No result was recorded", although an output **was** recorded. | Explicit (`call_id`). | Bug in finalization. | Yes. The status stays unknown, but the output counts as a recorded result. |
| 17 | 25 finished executions without a duration (**R**) match exactly `web_search → completed` 25 in 3 sessions (**S**). | Hosted `web_search_call` records have no timing fields (**R**). | — | Provider omission. | No parser change; the survey reports the anomaly by kind. |
| 18 | 6 calls without a result match exactly `code_cell → unknown` 6 in 4 sessions (**S**). | Finalized as "No result was recorded". | — | Unknown (**L**); see §4.3. | Row 12 removes inherited-prefix cases. The survey classifies the rest. |
| 19 | `thread_settings_applied`: 664 events in 40 sessions (**R**). | Ignored (unknown type). | Thread-level settings snapshot. In inherited prefixes it carries the parent's `thread_id` (**R**). | — | No rendering. Recognized and classified (§5). |
| 20 | `SubAgentActivity`: 128 items with ids `call_<opaque>` (started/interacted) or `subagent-completed-<uuid>` (**R**). | Ignored. | Probably the id of a `collaboration.*` call. The only fixture copy has no calls to check against (**L**). | — | Recognized and classified. Linking deferred until verified locally. |

## 2. Why the survey shows thousands of `nested … → unknown`

Every nested row in the survey comes from **static analysis of the cell script**; the counts reconcile exactly with the `tools.*` call table (**S**):

| Survey row | Script calls behind it | Provider records that exist for that family | Why they stayed unknown |
|---|---:|---|---|
| nested command → unknown 6037 | exec_command 3903 + shell_command 2332 (6235); 198 got a result | CommandExecution 402, 7 sessions, all `unified_exec_startup` | Most calls have no per-call record at all: shell_command never produced an item, and exec_command produces one only when the process exits during startup. The rest failed the content heuristics. |
| nested patch → unknown 4035 | apply_patch 3930 (dynamic) + 105 | FileChange 4538 in 33 sessions | Records exist but were **dropped** (row 2). |
| nested command_input → unknown 1016 | write_stdin 1005 + 11 | none (no `unified_exec_interaction` item observed) | Provider omission. |
| nested tool → unknown 928 | clock__curr_time 681, web__run 136, codex_app__* 104, list_mcp_* 8, view_image 2 | WebSearch 162 and Extension 28 (web__run); nothing for curr_time or codex_app | WebSearch/Extension **not parsed**; the others are provider omissions. |
| nested mcp → unknown 132 | mcp__* 132 | McpToolCall `exec-` items | **Dropped** (row 2). |
| nested plan → unknown 48 | update_plan 48 | none observed | Provider omission. |

So the unknowns are three different things mixed together:

- **Operations only represented in code.** A `tools.x(...)` expression is not evidence that anything ran.
- **Provider records the parser discarded.** FileChange, McpToolCall (`exec-` ids), WebSearch and Extension.
- **Operations for which Codex persisted no per-call record.** shell_command, write_stdin, long-running exec_command, curr_time, update_plan.

Even with every record kept, a recorded item can be tied to its cell only by turn and order. It can be tied to a particular script call only by content.

## 3. Correlation classification

| Relationship | Class | Evidence |
|---|---|---|
| `custom_tool_call` ↔ `custom_tool_call_output` | explicit identifier (`call_id`) | 6110/6110 (**R**) |
| `function_call` ↔ `function_call_output` | explicit identifier | all in windows (**R**) |
| `function_call js` ↔ McpToolCall item | explicit identifier (`item.id == call_id`) | 15/15 (**R**) |
| `function_call sleep` ↔ Extension item | explicit identifier | 20/20 (**R**), sleep.rs (**U**) |
| direct `exec_command` ↔ CommandExecution | explicit identifier (item id = call id) | upstream mapping (**U**); no direct case in fixtures (**L**) |
| hosted `web_search_call` ↔ WebSearch item | explicit identifier | event_mapping.rs (**U**); not in fixtures (**L**) |
| `wait` ↔ exec cell | explicit identifier carried in harness text (`cell_id` argument ↔ `Script running with cell ID`) | survey fields (**R**); values sanitized (**L**) |
| `write_stdin` ↔ exec_command process | explicit identifier carried in harness text (`session_id` ↔ `Process running with session ID`) | survey fields (**R**); values sanitized (**L**) |
| exec cell ↔ `exec-` item (FileChange, CommandExecution, McpToolCall, WebSearch) | **turn-scoped + ordered**; no identifier | turn 2671/2671, window 2671/2671, 1 straddle (**R**) |
| `exec-` item ↔ one particular script call | **content-dependent** only (command text, file paths, server/tool, query) | unresolvable from sanitized evidence |
| item after its cell's output and before the next cell (Window 8) | **unresolvable** unless the cell is known to have yielded | (**R**) |
| SubAgentActivity ↔ `collaboration.*` call | probably explicit (`call_` id shape) | **L** |
| ContextCompaction item ↔ `compacted` record | ordered; duplicate signal | 40 vs 40 in the newest rollout (**R**) |
| `token_usage_record` ↔ `token_count` | turn-scoped; duplicate accounting | (**R**) |
| inherited prefix ↔ parent thread | explicit schema (`forked_from_id`, `subagent_history_start_ordinal`) | (**R**) + projection rule (**U**) |

## 4. Anomalies in the real survey

### 4.1 Command completed without an exit code (326)

The survey's unrecognized-header table accounts for all 326 (**S**):

- **exec_command** (158): `Command …: …` 145, `Command …: … / …` 5, `Command …: EXIT` 4, and 4 single variants, one of which continues with `… Command:`.
- **shell_command** (168): `Command …: # / …` families 165, plus `Wall time: # seconds / aborted …` 3.
- The remaining unrecognized outputs were already classified as interrupted, declined or failed.

Upstream writes `Command blocked by PreToolUse hook: {reason}. Command: {command}` (**U**). Under the survey's privacy filter that string collapses to exactly `Command …: <first reason token>`. The `REJECTED:` and `EXIT` variants are the first tokens of the hook's own reason text.

- **Schema generation.** These are function-tool sessions (exec_command `{cmd, max_output_tokens, workdir, yield_time_ms}`, shell_command `{command, timeout_ms, workdir, …}`) dated 2026-06-06 to 2026-07-23. The committed survey does not tie a `cli_version` to each file (**L**; the survey now reports anomalies by version).
- **Could another event carry the exit status?** No. There is no `exec_command_end` anywhere in the corpus, and CommandExecution appears only for `unified_exec_startup` (**R**). A hook block happens before dispatch, so there is no process (**U**).
- **Conclusion.** The exit code does not apply: the command was blocked and never ran. The parser should say "blocked by PreToolUse hook" instead of "completed". The 3 `aborted by user` cases were interrupted; they report a wall time but no exit code.

### 4.2 Finished without a duration (25)

- These are hosted `web_search_call` records, matched by exact count and session count (**S**).
- The record has only `{action, id, status, type}` plus a turn id (**R**).
- A WebSearch item has `completed_at_ms` but no `started_at_ms` (Window 4, **R**).
- No provider duration and no start time exist, so the duration is **not recoverable**. The anomaly stays; the survey now names the kind.

### 4.3 Call without a result (6)

- These are exactly the six `code_cell → unknown` rows (**S**).
- The committed evidence cannot show which families they belong to (**L**). Candidates the survey now distinguishes structurally:
  - **Inherited prefix** (row 12). A fork copies the parent's history while the parent's cell is still running, so the copy contains the call but not its output. Two of the three examples are sibling rollouts created 14 s apart on 2026-08-13, at lines 66 and 69 (**S**, consistent with parallel spawns).
  - **Rollout ended mid-turn**: no `task_complete` or `turn_aborted` for the turn, i.e. a persistence gap or process exit.
  - **Turn completed without the output**: a persistence gap.
  - **Output present but unrecognized.** Row 16 fixes the detail message; this is a parser bug, not a missing result.

## 5. Real schema coverage

Before = parser at be6c718, after = this change. Columns: parsed / rendered / execution relevant.

| Kind | Type | Count (corpus) | Before | After | Role |
|---|---|---:|---|---|---|
| record | `response_item` | 64479 | parsed | parsed | calls, outputs, messages, reasoning |
| record | `event_msg` | 58810 | parsed | parsed | turn lifecycle, items, tokens |
| record | `token_usage_record` | 7262 | ignored | intentionally ignored | per-response token accounting; duplicates `token_count` totals |
| record | `turn_context` | 1051 | parsed | parsed | turn id, cwd, model |
| record | `world_state` | 296 | ignored | intentionally ignored | instruction/environment snapshots; no execution content |
| record | `compacted` | 129 | parsed, rendered | parsed, rendered | compaction marker (canonical) |
| record | `inter_agent_communication_metadata` | 104 | ignored | intentionally ignored | marks the next `agent_message` as a turn trigger |
| record | `session_meta` | 70 | parsed | parsed, plus the fork boundary | metadata, `subagent_history_start_ordinal` |
| item | `reasoning` | 21682 | rendered | rendered | summary only; encrypted content never decoded |
| item | `custom_tool_call` (`exec`, `apply_patch`) | 12324 | rendered | rendered | code cells, patches (execution) |
| item | `custom_tool_call_output` | 12326 | parsed | parsed | cell/patch results (execution) |
| item | `message` | 11145 | rendered | rendered | user/assistant/developer text |
| item | `function_call` / `_output` | 3424 / 3421 | rendered | rendered | direct tools (execution) |
| item | `agent_message` | 104 | rendered | rendered | inter-agent messages |
| item | `web_search_call` | 25 | rendered | rendered | hosted search (execution, no timing) |
| item | `tool_search_call` / `_output` | 14 / 14 | rendered | rendered | tool discovery |
| event | `item_completed` | 39831 | partly | parsed | see the item types below |
| event | `token_count` | 16478 | parsed | parsed | token totals |
| event | `task_started` / `task_complete` | 930 / 842 | parsed | parsed | turn lifecycle, failed-turn marker |
| event | `turn_aborted` | 65 | rendered | rendered | interruptions |
| event | `thread_settings_applied` | 664 | unknown | recognized, intentionally not rendered | thread settings snapshot (model, effort, approval, permission profile, cwd); duplicates `turn_context` |
| turn item | Reasoning / AgentMessage / UserMessage | 23940 / 9321 / 910 | parsed | parsed | fallback text sources |
| turn item | FileChange | 4538 | dropped (`exec-` ids) | **rendered, execution evidence** | patch applied (status, files) |
| turn item | CommandExecution | 402 | heuristic | **rendered, execution evidence** | command result (exit, duration, timestamps) |
| turn item | McpToolCall | 280 | explicit ids only | **rendered, execution evidence** | MCP result |
| turn item | WebSearch | 162 | unsupported | **rendered, execution evidence** | search performed (no status, no timing) |
| turn item | SubAgentActivity | 128 | unsupported | recognized, not rendered | agent lifecycle; link to `collaboration.*` calls unverified (**L**) |
| turn item | ContextCompaction | 121 | unsupported | recognized, intentionally ignored | duplicate of the `compacted` record (40 = 40) |
| turn item | Extension | 28 | unsupported | **rendered, execution evidence** | `clock.sleep` (explicit id) and 8 search-like extension items |
| turn item | CollabAgentToolCall | 1 | unsupported | recognized, not rendered | collaboration tool state (**L**) |
| tool family | `exec` (custom) | 12008 | code cell | code cell | code mode |
| tool family | `apply_patch` (custom) | 316 | patch | patch | direct patch |
| tool family | `wait` | 1587 | cell poll | cell poll | code mode |
| tool family | `shell_command`, `exec_command`, `write_stdin` | 1077 / 472 / 38 | command | command | function-tool generation |
| tool family | `clock.sleep`, `web.run`, `update_plan`, `request_user_input_async`, `list_mcp_resources` | 20 / 2 / 11 / 4 / 1 | tool/plan | tool/plan | direct tools |
| tool family | `collaboration.*` (spawn/send/wait/followup/list/interrupt) | 106 | tool | tool | multi-agent control |
| tool family | `mcp__*` namespaces (`codex_apps__github`, `node_repl`, `cua_repl`) | 106 | mcp | mcp | MCP |

## 6. Questions for the local collector

1. Header labels of the 323 `Command …:` outputs: do they read `Command blocked by PreToolUse hook:`? The survey now prints header words that repeat across many outputs and sessions, which keeps it content-free.
2. `cli_version` of the six sessions behind §4.1. The survey now reports anomalies by version.
3. The six calls without a result. Are they in inherited prefixes, did the rollout end mid-turn, or did the turn complete without the output? The survey now classifies each one.
4. Does `SubAgentActivity.id` equal the `call_id` of a `collaboration.*` call in the parent's own rollout?
5. Do hosted `web_search_call` ids equal WebSearch item ids in the three sessions with hosted search?
6. For direct `apply_patch` custom tool calls (316), are FileChange item ids equal to the call id?
7. The 8 `Extension {action, kind, query, results}` items: which `kind`, and which call do they belong to?

## 7. Changes made (after the findings above)

| Finding | Change | Evidence level |
|---|---|---|
| 1, 3 | Execution evidence is explicit in the domain (`Execution.evidence`): `code` (script call site), `observed` and `result` (provider `call` / `output` / `item` / `inventory` records), `cellLink` and `callSiteLink` (`explicit_id`, `turn_window`, `content`, `unresolved`). Script call sites keep status `unknown` and are labelled "script only" in the UI. The positional `‹…›` fallback and top-level text matching are removed. | R (+U for the inventory feature flag) |
| 2, 8, 9, 10, 11 | Every `item_completed` execution item and legacy `*_end` event becomes recorded evidence. Explicit id → applied to that call. `exec-` id → attached to the only running cell of the item's turn (`turn_window`), otherwise a top-level unlinked record with the reason. Script call site ↔ recorded command only on unique identical command text (`content`). | R + S |
| 5, 7 | Durations keep their source: `reported`, `provider_timestamps`, `record_timestamps`. The Extension `durationMs` is not used as the measured duration. | R + U |
| 6, 16 | Cell windows: kept open by yield headers and `notify()` outputs (which carry `name`), closed by terminal headers, header-less outputs, a `wait` reporting completion, and turn end. A header-less final output leaves the status `unknown` with "Output recorded without a script status header", never "No result was recorded". | R + U |
| 12 | Records before `subagent_history_start_ordinal` are summarized as one `inherited_context` entry and excluded from executions, stats, title and model. The session list reports `inheritedRecordCount`. | R + U |
| 13, 14, 15 | Outcome forms: `(Command\|Tool call) blocked by PreToolUse hook:` → declined; `Wall time … / aborted by user` → interrupted with the reported wall time; `write_stdin failed:` / `Unified exec process failed:` / `Unknown process id` → failed. | S + U |
| 17, 18 | No parser change. The survey reports anomalies by execution kind and by `cli_version`, and classifies calls without a result by structural family. | — |
| 19, 20 | Recognized, not rendered. The survey labels them "(not rendered, by design)". | R |
| — | An output whose call record is missing now has an unknown outcome instead of "completed". | S |

## 8. Validation on the committed real evidence

The survey of the parser before the change (commit 371850a, parser as of be6c718) and after it, on the same 7 rollouts rebuilt from `tests/fixtures/codex/real-observed` with real line numbers:

| Anomaly / rendering | Before | After | Why |
|---|---:|---:|---|
| call without a result | 14 | 5 | 9 cells whose sanitized output has no status header were misreported as having no result (row 16). The 5 left are exec calls whose outputs are in a different fixture file; the survey classifies them as "turn never closed: rollout ended mid-turn" (fixture excerpt, not Codex). |
| output without a matching call | 7 | 7 | Unchanged: outputs whose calls are outside the excerpts. Their outcome is now unknown instead of completed. |
| recorded item not linked to a call or cell | (not detected) | 12 | 10 items in the by-type excerpt (no calls or cells in it), the Window 8 straddler, and a McpToolCall whose `js` call is not in its excerpt. Before, 10 of these were silently dropped. |
| finished without a duration | 0 | 4 | 2 FileChange and 2 WebSearch items that Codex recorded without timing. They are now kept, so their missing duration becomes visible. |
| nested command → completed | 3 | 2 | Before, all 3 CommandExecution items were appended to "the most recent running cell". That included the Window 8 straddler, attributed to exec A only because exec A's header-less output left it "running". |
| nested patch / mcp / web_search → completed | 0 | 5 / 5 / 1 | Previously dropped FileChange, McpToolCall and WebSearch items, now attributed by turn and order. |
| subagent timeline | 13 user messages, 7 final answers, 2 aborts, 1 inter-agent message (copied) | 1 inherited-context entry | Row 12. |

Expected effect on the full 58-rollout corpus. This is a prediction that has to be re-run locally with `scripts/codex-rollout-survey.ts --all`:

- **Command completed without an exit code (326).** Should drop to about 0 if the 323 `Command …:` outputs are PreToolUse hook blocks: they would show as declined. The 3 `aborted by user` outputs become interrupted. The survey's "Harness messages" table shows the form of each output.
- **Finished without a duration (25).** The 25 hosted web searches remain. New rows may appear for top-level recorded items without timing; the survey's by-kind table separates them.
- **Call without a result (6).** Cases inside inherited prefixes disappear; the rest are classified by family.
- **Nested `… → unknown`.** These remain for script call sites, now labelled script-only. New nested rows appear for FileChange, McpToolCall, WebSearch and Extension items, and for commands attributed by turn and order.
