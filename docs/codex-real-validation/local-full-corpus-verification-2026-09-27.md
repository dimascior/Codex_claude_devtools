# Local Full-Corpus Verification, 2026-09-27

Verification of the parser at `7f38892` against all 58 real Codex rollouts on
the evidence-producing Windows workstation, followed by two evidence-driven
parser corrections and a re-run. Raw rollouts were read locally only; nothing
below contains command text, output text, prompts, paths, URLs or account data.

Evidence classes used in this document:

| Tag | Meaning |
|---|---|
| VERIFIED RAW | measured directly on the raw rollout records (local only) |
| VERIFIED SANITIZED | reproducible from committed sanitized fixtures |
| STRUCTURAL INFERENCE | follows from record order, ids or timestamps, not from a persisted link |
| UPSTREAM SOURCE ONLY | asserted only by upstream Codex source, not observed here |
| UNRESOLVED | the raw data cannot settle it |

Corpus at the time of the run: 58 rollouts, 270.6 MB, cli_version values
0.42.0 (5), 0.137.0-alpha.4 (1), 0.140.0-alpha.2 (3), 0.142.0-alpha.1 (2),
0.142.0-alpha.6 (4), 0.142.5 (1), 0.144.0-alpha.4 (11), 0.145.0-alpha.30 (1),
0.147.0-alpha.6.6 (5), 0.148.0-alpha.15 (1), 0.153.0 (14), 0.153.4 (20 records
in 14 files), 0.155.0-alpha.16.3 (2). The newest rollout was live and grew
between runs (70,3xx to 73,4xx lines), so counts that include it drift by a few
units between survey runs; every comparison below states which run it comes
from.

## 1. Survey before / after

Three full-corpus survey runs: baseline (parser at be6c718, run at 09:45
local), after `7f38892` (13:24), after the local corrections in this commit
(17:58 UTC). Survey files stay in the local `real-data/` scratch area.

| Anomaly / rendering | be6c718 | 7f38892 | this commit | Why it changed |
|---|---:|---:|---:|---|
| command completed without an exit code | 326 (6 sess.) | 0 | 0 | 323 outputs are `Command blocked by PreToolUse hook:` -> declined (325 incl. 2 rejected-by-user forms); 3 are `Wall time / aborted by user` -> interrupted. VERIFIED RAW, section 3 and 4. |
| finished without a duration | 25 (3) | 51 (4) | 36 (4) | 25 hosted `web_search_call` records have no timing (VERIFIED RAW). 7f38892 also rendered each of the 25 WebSearch items as a second execution (50) plus one FileChange without timing. This commit merges the 15 id-linked item/call pairs (35 = 15 merged + 10 unlinkable calls + 10 unlinkable items, + 1 patch). |
| call without a result | 6 (4) | 4 (2) | 6 (4) | 7f38892 hid the two 2026-08-13 subagent cases as inherited history; they are the subagent's own final records (section 5, 8). This commit restores them. All 6 are "turn never closed: rollout ended mid-turn". |
| output without a matching call | not detected | 0 | 0 | No real rollout has an output whose call is absent (VERIFIED RAW: every `*_output.call_id` resolves in its own rollout). |
| recorded item not linked to a call or cell | not detected | 27 (5) | 12 (4) | 25 hosted WebSearch items (15 of them with an id equal to a `web_search_call.id`, now linked), 1 CommandExecution straddling two cells, 1 FileChange with 2 cells running. Remaining 10 are WebSearch items whose call carries no id (cli 0.137/0.140). |
| nested recorded, attributed by turn and order: patch | dropped | 4250 | 4268 | previously discarded `exec-` FileChange items; +18 from restored subagent sessions and live growth |
| nested recorded: command | 198 text + 203 appended | 351 turn_window + 110 content | 352 + 110 | positional fallback removed; content link only on unique command match |
| nested recorded: mcp | dropped | 377 | 419 | +42 from restored subagent sessions |
| nested recorded: web_search | not parsed | 85 | 126 | +41 from restored subagent sessions |
| nested recorded: tool (Extension web.search) | not parsed | 8 | 10 | +2 from restored subagent sessions |
| script-only nested operations | 11,448 cells "children script" | command 6137, patch 4081, command_input 1016, tool 921, mcp 338, plan 48 | 6188 / 4099 / 1016 / 965 / 382 / 48 | labelled static analysis; increases are restored subagent cells plus live growth |
| inherited subagent records | 0 (rendered as own) | 1607 records in 22 sessions (declared boundary) | 746 records in 22 sessions | see section 8: the declared boundary equals the record count in 10 rollouts |
| sessions with code cells | 33 | 26 | 33 | 7 subagent sessions had all cells classified inherited under 7f38892 |
| sessions with no executions | 8 | 17 | 8 | same cause |
| sessions with no model | 2 | 12 | 2 | same cause |
| sessions with no title | 2 | 24 | 24 | subagent tasks arrive as inter-agent `agent_message`, not user messages; the be6c718 title was the parent's copied prompt. Design question, not changed here. |

### Anomaly families by cli_version (VERIFIED RAW, raw recount of the be6c718 families)

| Family | cli_version | Tool | Count |
|---|---|---|---:|
| blocked by PreToolUse hook | 0.142.5 | exec_command | 148 |
| blocked by PreToolUse hook | 0.142.0-alpha.6 | shell_command | 106 |
| blocked by PreToolUse hook | 0.142.0-alpha.6 | exec_command | 10 |
| blocked by PreToolUse hook | 0.142.0-alpha.1 | shell_command | 41 |
| blocked by PreToolUse hook | 0.145.0-alpha.30 | shell_command | 18 |
| Wall time / aborted by user | 0.140.0-alpha.2 | shell_command | 3 |
| web_search_call without timing | 0.142.5 | hosted search | 15 |
| web_search_call without timing | 0.140.0-alpha.2 | hosted search | 7 |
| web_search_call without timing | 0.137.0-alpha.4 | hosted search | 3 |
| call without a result | 0.142.0-alpha.1 | exec cell | 3 |
| call without a result | 0.144.0-alpha.4 | exec cell | 1 |
| call without a result | 0.147.0-alpha.6.6 | exec cell | 2 |

## 2. Claude's seven local-only questions

### Q1. Do the 323 `Command ...:` outputs read `Command blocked by PreToolUse hook:`?

VERIFIED RAW. Exactly 323 tool outputs in the corpus begin with
`Command blocked by PreToolUse hook:`; none begin with
`Tool call blocked by PreToolUse hook:`. Tools: shell_command 165,
exec_command 158. No other shell_command/exec_command output begins with the
word `Command`. For each of the 323: no `item_completed` item and no `*_end`
event carries the call id (0/323), so no execution record exists for them;
7 mention an exit code inside the hook's reason text (content, not a header).
The call turns ended with `task_complete` 279, `turn_aborted` 34, and 10 calls
carry no turn id. Conclusion: an execution attempt that never ran; declined
is the correct outcome and no exit code applies.

### Q2. cli_version of the sessions behind Q1

VERIFIED RAW. 0.142.5 (148), 0.142.0-alpha.6 (116), 0.142.0-alpha.1 (41),
0.145.0-alpha.30 (18). Producer originators: codex_vscode and codex_cli_rs.

### Q3. The six calls without a result

VERIFIED RAW, each classified individually. None has an output anywhere in the
corpus (all 58 rollouts searched by call id). None is an `apply_patch`; all six
are `custom_tool_call exec` cells with `status: completed` on the call record.

| # | Rollout (date, line) | cli_version | originator / source | Boundary position | Turn state | Classification |
|---|---|---|---|---|---|---|
| 1 | 2026-06-20, line 2714 | 0.142.0-alpha.1 | codex_vscode / vscode | root session (no boundary) | call has no passthrough turn id; next record is `task_started` of a new turn; no `task_complete`/`turn_aborted` for the call's turn | genuine incomplete persistence: turn superseded by a new turn |
| 2 | 2026-06-20, line 2810 | 0.142.0-alpha.1 | codex_vscode / vscode | root | as above; followed directly by another exec call (line 2811) then `task_started` | genuine incomplete persistence |
| 3 | 2026-06-20, line 2811 | 0.142.0-alpha.1 | codex_vscode / vscode | root | as above | genuine incomplete persistence |
| 4 | 2026-07-11, line 122 | 0.144.0-alpha.4 | codex_exec / exec | root | call is the last record of the file; turn has `task_started` only; file mtime equals the record timestamp | rollout ended mid-turn (process exit) |
| 5 | 2026-08-13 23:18:27, line 69 | 0.147.0-alpha.6.6 | codex_work_desktop / subagent:thread_spawn | ordinal 68 < declared boundary 69, but turn id minted after the subagent thread id: own history | last record of the file; turn has `task_started` only | rollout ended mid-turn; NOT inherited history |
| 6 | 2026-08-13 23:18:41, line 66 | 0.147.0-alpha.6.6 | codex_work_desktop / subagent:thread_spawn | ordinal 65 < declared boundary 66; own history (same reasoning) | last record of the file | rollout ended mid-turn; NOT inherited history |

Three further calls without outputs (2026-06-17 lines 332-333, 2026-06-19
line 361; shell_command, cli 0.140.0-alpha.2 and 0.142.0-alpha.1) sit in turns
closed by `turn_aborted` and are correctly reported as interrupted, not as
anomalies. No inherited-prefix call lacks its output in any of the 22 subagent
rollouts (0/22), so "copied inherited history" explains none of the six.

### Q4. Does `SubAgentActivity.id` equal a `collaboration.*` call id?

VERIFIED RAW. 128 items, 0 missing ids, 0 mismatches.

| kind | id shape | Matches | Count |
|---|---|---|---:|
| started | `call_<opaque>` | `spawn_agent` call in the same rollout | 22 |
| started | `call_<opaque>` | `spawn_agent` call in the parent rollout (item is in an inherited prefix) | 11 |
| interacted | `call_<opaque>` | `send_message` (43) or `followup_task` (13) call in the same rollout | 56 |
| interacted | `call_<opaque>` | `send_message` call in the parent rollout (inherited prefix) | 3 |
| interrupted | `call_<opaque>` | `interrupt_agent` call in the same rollout | 5 |
| interrupted | `call_<opaque>` | `interrupt_agent` call in the parent rollout (inherited prefix) | 1 |
| completed | `subagent-completed-<uuid>` | no call (lifecycle event, not a tool call) | 30 |

The raw `function_call.name` is `spawn_agent`, `send_message`, etc. with the
collaboration namespace in a separate field; the survey prints them joined.
`agent_thread_id` is present on 128/128 and resolves to a rollout in the
corpus 128/128; it is never the rollout's own thread id. Linking: `explicit_id`
for the 98 `call_` items; `completed` items can only be tied to a spawn via
`agent_thread_id` (STRUCTURAL INFERENCE).

### Q5. Do hosted `web_search_call` ids equal WebSearch item ids?

VERIFIED RAW across the three sessions (25 calls, 25 hosted items):

| cli_version | calls | call has `id` | item id == call id | item position | action type equal |
|---|---:|---|---:|---|---|
| 0.137.0-alpha.4 | 3 | no (fields `{type,status,action}`) | 0 | one record before the call | 3/3 |
| 0.140.0-alpha.2 | 7 | no | 0 | one record before the call | 7/7 |
| 0.142.5 | 15 | yes (`ws_<opaque>`, plus passthrough turn id) | 15/15 | one record before the call | 15/15 |

In all 25 cases the `item_completed/WebSearch` record is persisted exactly one
record BEFORE its `web_search_call`. Items carry a `ws_` id, `query`, `action`
and turn id; no `status`, no `started_at_ms`. For 0.137/0.140 the call carries
neither an id nor a passthrough turn id, so the pair can only be related by
adjacency (STRUCTURAL INFERENCE); the parser leaves them unlinked.
Fixture: `hosted-web-search-windows.jsonl` (VERIFIED SANITIZED).

### Q6. Direct `apply_patch`: does `FileChange.id` equal the call id?

VERIFIED RAW. 316 `apply_patch` custom tool calls (6 sessions, cli
0.140.0-alpha.2 to 0.145.0-alpha.30). 315 have a FileChange item with
`item.id == call_id`, status `completed`, recorded after the call and before
the call's output. 1 has no FileChange item (2026-06-17, cli 0.140.0-alpha.2;
its output is the `apply_patch verification failed` form and the call's
output has no header). No FileChange item with a non-`exec-` id lacks a call
(0). All other 4285 FileChange items carry `exec-<uuid>` ids (code mode).
Linking: `explicit_id`.

### Q7. The 8 search-like `Extension` items

VERIFIED RAW. Distinct `kind` values across all 28 Extension items:
`clock.sleep` (20, fields `{durationMs,id,kind,type}`) and `web.search` (8,
fields `{action,id,kind,query,results,type}`).

- `clock.sleep`: `item.id == function_call(sleep).call_id` 20/20. `explicit_id`.
- `web.search`: ids are `exec-<uuid>`, matching no call (0/8). Each was recorded
  while exactly one exec cell of its turn was running (8/8), two records after
  that cell's call, with `started_at_ms`/`completed_at_ms`. Sessions: cli
  0.153.4 (4) and 0.153.0 (4). Action types `search`, `openPage`, `findInPage`.
  They are code-mode `tools.web__run` results; link by `turn_window`, never
  `explicit_id`. The parser at 7f38892 already does this (survey "nested tool:
  recorded item attributed by turn and order").

## 3. Turn-window rule measurement (VERIFIED RAW)

All `item_completed` items of type CommandExecution, FileChange, McpToolCall,
WebSearch or Extension whose id begins with `exec-`, over all 58 rollouts,
using record order only (call record to output record of each exec cell; the
item's turn from its payload, else the current `turn_context`, mirroring the
parser). No content was used.

| Measure | Count |
|---|---:|
| execution-relevant `exec-` items | 5306 |
| recorded while exactly one exec cell of the turn was running | 5272 (99.4%) |
| recorded while zero cells were running | 34 |
| of which: no exec call at all in the item's turn | 28 |
| of which: between one cell's terminal output and the next cell's call | 6 |
| of which: after the last cell / before the first cell of a turn | 0 / 0 |
| recorded while more than one cell was running | 0 |
| `exec-` id equal to any call id (would contradict turn-window attribution) | 0 |

The 28 "no exec call in turn" items are all inside inherited prefixes of
subagent rollouts (2026-08-13, 2026-09-05, 2026-09-13, 2026-09-16): the copied
history contains the parent's item events but not the parent's exec calls
(compacted). They are excluded once the prefix is classified correctly.

The 6 straddlers: 5 FileChange items in one 2026-06-23 turn (cli
0.142.0-alpha.6) and the 2026-09-23 CommandExecution already documented as
Window 8. Each sits after a cell's output and before the next cell's call in
the same turn, with no running custom tool call at that position. They are
correctly left unattributed.

By cli_version, the one-running bucket covers every version with code-mode
items: 0.155.0-alpha.16.3 (3029), 0.142.0-alpha.6 (732), 0.147.0-alpha.6.6
(612), 0.153.4 (539), 0.153.0 (167), 0.144.0-alpha.4 (112), 0.148.0-alpha.15
(65), 0.142.0-alpha.1 (16). The rule is empirically safe on this corpus: it
never had to choose between two running cells, and its only failures are
records with no cell open, which it refuses to attribute.

## 4. Subagent inherited-history handling (VERIFIED RAW)

22 rollouts carry `subagent_history_start_ordinal`. They fall into two
patterns.

Pattern A (12 rollouts; cli 0.153.4 x6, 0.153.0 x6; all children of one parent;
two `session_meta` records: the subagent's at ordinal 0 and a copy of the
parent's at ordinal 1):

- records below the boundary: 9 to 52; at/above: 14 to 117
- below-boundary envelope timestamps are restamped to the fork time (spread
  1-7 ms); `create_time` where present is the original parent-era time (>1 min
  older than the envelope in 81 of 91 records that carry it)
- below-boundary turn ids were minted before the subagent thread id (UUIDv7);
  the first at/above record is `thread_settings_applied` for the subagent's
  thread id at exactly the boundary ordinal (12/12), followed by `task_started`
  of a subagent-era turn
- below: user messages and turn_context, 0 tool calls, 0 `item_completed`
- no call below the boundary has its output at/above (0/12)

Pattern B (10 rollouts; cli 0.147.0-alpha.6.6 x4, 0.153.0 x6; one
`session_meta`; all files finished):

- `subagent_history_start_ordinal` equals the file's record count (10/10), so
  every record lies below it
- yet each file contains an inherited prefix (parent-era turn ids, restamped)
  FOLLOWED by the subagent's own turns: turn ids minted after the subagent
  thread id, its own `task_started`, tool calls with outputs, FileChange /
  McpToolCall / WebSearch items. 9 of the 10 contain the subagent's own tool
  calls: 9, 6, 9, 40, 19, 15, 17, 22, 3 (140 in total); the tenth has an
  aborted own turn
- the true prefix end, by the first subagent-era `task_started`, is ordinal
  21, 24, 27, 79 (0.147) and 11, 14, 20, 63, 20, 162 (0.153.0); in the 0.153.0
  files it is preceded by `thread_settings_applied` for the subagent's thread
  id at that ordinal minus one (6/6); the 0.147 files have no such event for
  the subagent thread
- no parent-era turn record follows the first subagent-era record (0/22
  interleaving); no call in the prefix has its output in the own section (0/22)

Conclusions: inherited records keep their original `create_time` and get a
restamped envelope timestamp; title and model inference should use only the
own section (all 22 own sections carry a `turn_context`; none carries a user
message, because the task arrives as an inter-agent `agent_message`); no
execution begun in inherited history finishes in the child-owned section, so
inherited history explains none of the missing exec outputs.

The meaning of the field in pattern B (why it equals the record count) is
UNRESOLVED from raw data alone; upstream source would be needed (UPSTREAM
SOURCE ONLY). The parser does not need to know: the own-history markers are
unambiguous in all 22 files.

## 5. Parser defects found and corrected

Both were demonstrated by the raw corpus, not by the committed excerpts.

### 5.1 Inherited-prefix rule emptied 10 of 22 subagent sessions

`7f38892` classified every record with ordinal below
`subagent_history_start_ordinal` as inherited. In pattern B that is every
record, so 10 real sessions rendered as a single "inherited context" entry: 9
sessions lost 140 tool calls and their items, 10 lost model/token usage, and
the two 2026-08-13 calls without a result disappeared from the anomaly count.

Correction (`CodexMetadataParser.InheritedHistoryTracker`, used by the
normalizer and the scanner head extractor): the prefix ends at the declared
boundary or at the first structural marker of the subagent's own history,
whichever comes first. Markers: a `thread_settings_applied` event whose
`thread_id` is the rollout's own thread id, or a `task_started` /
`turn_context` whose UUIDv7 turn id was minted at or after the rollout's own
UUIDv7 thread id. In pattern A both markers coincide with the declared boundary
(no behaviour change); in pattern B they recover the own section. The session
list's `inheritedRecordCount` now reports the records actually skipped instead
of `boundary - 1`.

Effect on the full corpus (this commit vs 7f38892): sessions with code cells
26 -> 33, with no executions 17 -> 8, with no model 12 -> 2, inherited records
1607 -> 746, calls without a result 4 -> 6 (the two restored cases are real).
All equal the be6c718 baseline where the baseline was right.

### 5.2 Hosted web search rendered twice

The WebSearch item precedes its `web_search_call` by one record (25/25). The
parser looked the item up by call id when the item arrived (nothing registered
yet), created an unlinked execution, then created a second execution for the
call. In cli 0.142.5 (15 cases) the ids are equal, so the link is explicit and
was being missed.

Correction (`CodexExecutionParser.handleCall`, `web_search_call`): if an item
with the call's id is already known and has no call evidence, the call is
adopted onto it (`explicit_id`, observed = call record, result = item record)
instead of registering a new execution. Calls without an id (cli 0.137/0.140,
10 cases) are unchanged: they and their items stay separate and unlinked.

Effect: finished without a duration 51 -> 36; unlinked items 27 -> 12;
`web_search -> completed` 50 -> 35 (15 merged pairs + 10 calls + 10 items).

### 5.3 Survey label

`scripts/codex-rollout-survey.ts` labels a top-level `explicit_id` link
("call + recorded item linked by id") instead of "other".

## 6. Unresolved relationships

- Hosted `web_search_call` without an id (cli 0.137.0-alpha.4, 0.140.0-alpha.2;
  10 cases): item precedes call by one record with the same action type
  (10/10), but no identifier exists. Left unlinked. STRUCTURAL INFERENCE only.
- `SubAgentActivity completed` (30): no call id; relates to a spawn only via
  `agent_thread_id`. Not linked.
- Meaning of `subagent_history_start_ordinal` when it equals the record count
  (pattern B). UNRESOLVED; the parser no longer depends on it there.
- 6 `exec-` items between two cells of one turn (5 FileChange 2026-06-23, 1
  CommandExecution 2026-09-23): unattributable by persisted data. Left
  unlinked by design.
- Subagent titles: the task arrives as an inter-agent `agent_message` (22/22
  own sections have no user message). Whether to derive the title from it is
  a design decision for the parser owner; not changed.

## 7. New fixtures (VERIFIED SANITIZED, produced by `scripts/codex-rollout-transcript.ts`)

- `tests/fixtures/codex/real-observed/subagent-declared-boundary.jsonl`: one
  complete pattern-A subagent rollout (30 records, cli 0.153.4): two
  `session_meta` records, declared boundary 16 equal to the
  `thread_settings_applied` marker, own turn from ordinal 17.
  Complements `subagent-thread-spawn.jsonl`, which is pattern B (boundary 171
  = record count, own history from ordinal 161/162).
- `tests/fixtures/codex/real-observed/hosted-web-search-windows.jsonl`: three
  contiguous windows: cli 0.142.5 item/call pair (lines 154-157) and a run of
  nine pairs (246-272); cli 0.137.0-alpha.4 calls without ids (146-153).

Tests pinning both corrections: `test/main/providers/codex/realObserved.test.ts`
("subagent with a correct declared boundary", "hosted web search", and the
updated pattern-B expectations for `subagent-thread-spawn.jsonl`).

## 8. Validation

`pnpm typecheck` clean; `pnpm lint` 0 errors, 5 warnings identical to HEAD;
`pnpm test` 64 files, 842 passed, 1 skipped; `pnpm build` succeeded. Full
survey re-run after the corrections (section 1, "this commit" column).

## 9. Privacy

The scan over `docs/codex-real-validation/*` and
`tests/fixtures/codex/real-observed/*` for the user path, account names,
hostname, token prefixes, key material, credential keywords and project names
returned no matches. Long preserved strings in the new fixtures are ids only.
`real-data/` is gitignored and was not committed.
