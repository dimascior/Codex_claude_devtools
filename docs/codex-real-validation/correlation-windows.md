# Correlation Windows: Real Code-Mode Execution Stream

Source: the sanitized structural transcript of the newest (live) rollout,
thread `01a0cefe-b6c1-7b21-aa52-cdb658c6d54b`, cli_version as recorded in its
`session_meta`. Extracted 2026-09-27 from the already-sanitized transcript
only; the raw rollout was not re-read for this step.

Fixture: `tests/fixtures/codex/real-observed/current-code-mode-correlation-windows.jsonl`

Each window is a contiguous slice of the sanitized transcript. Records are
copied verbatim (original `line`, `timestamp`, `ordinal`, IDs, statuses and
numeric fields). Synthetic separator records are the only additions and are
identifiable by a leading-underscore key (`_evidence_package`,
`_evidence_window`); they carry no `type` field and are not Codex records.

Everything below is a structural observation. Nothing here is inferred from
command text, script source or output, none of which exist in the fixture.

## Corpus-level facts behind the window selection

Computed over the whole sanitized transcript (70,343 rollout lines at the
time of extraction; the rollout was still live) before choosing windows:

- 6110 `custom_tool_call` records with `name = exec`, each followed by a
  `custom_tool_call_output` with the same `call_id` within 2-10 records.
- 2635 of those exec windows contain at least one execution-relevant
  `item_completed` (FileChange 2430, CommandExecution 140, McpToolCall 93,
  WebSearch 8) between the call and its output.
- 2671 execution-relevant `item_completed` events fall inside an exec window;
  16 fall outside. Of the 16, 15 are `McpToolCall` items whose `item.id`
  equals the `call_id` of a preceding `function_call` named `js`, and 1 is a
  `CommandExecution` that completed after its nearest exec output (Window 8).
- Inside exec windows, `item_completed.turn_id` equals the exec call's
  `internal_chat_message_metadata_passthrough.turn_id` in 2671 of 2671 cases,
  and `completed_at_ms` lies within
  `[exec.create_time, output.create_time]` in 2671 of 2671 cases.
- No record in the transcript carries `executed_tool_calls` or `cell_id`.
- `item_completed.item.id` shapes: `exec-<uuid>` for FileChange (2430),
  CommandExecution (141), WebSearch (8) and 93 McpToolCall; `call_<opaque>`
  for 15 McpToolCall, 20 Extension and 1 AgentMessage; `item-<n>`,
  `rs_<opaque>`, `msg_<opaque>` or bare `<uuid>` for the rest.
- `function_call` windows: `js` -> `[McpToolCall]` (15 of 15),
  `sleep` -> `[]` but with an `Extension kind=clock.sleep` item whose id equals
  the call_id (20 of 20), `wait` -> `[]` (140), `request_user_input_async` ->
  `[]` (4).

## Identifier relationships observed

| Relationship | Persisted link | Observed |
|---|---|---|
| `custom_tool_call.call_id` <-> `custom_tool_call_output.call_id` | explicit, same value | 6110 / 6110 |
| `function_call.call_id` <-> `function_call_output.call_id` | explicit, same value | all in windows |
| `function_call(js).call_id` <-> `item_completed.McpToolCall.item.id` | explicit, same value | 15 / 15 |
| `function_call(sleep).call_id` <-> `item_completed.Extension.item.id` | explicit, same value | 20 / 20 |
| `custom_tool_call(exec)` <-> `item_completed.{FileChange,CommandExecution,McpToolCall,WebSearch}` | none: item ids are `exec-<uuid>`, never equal to `call_id`, `ctc_` id or `ctco_` id | 0 / 2671 |
| exec call <-> nested items, shared fields | `turn_id` (payload vs passthrough) and `thread_id` (item_completed only; exec records carry no thread_id) | 2671 / 2671 turn match |
| exec call <-> nested items, chronology | envelope order and `completed_at_ms` inside `[exec.create_time, output.create_time]` | 2671 / 2671; 1 counter-example straddles (Window 8) |

Conclusion: an `item_completed` execution item has no persisted pointer to the
`custom_tool_call: exec` that spawned it. Attribution of a FileChange /
CommandExecution / McpToolCall(exec-uuid) / WebSearch item to a specific exec
cell can only be reconstructed from (turn_id, record order, timestamps). When
an exec window contains more than one such item (Window 6, Window 8), the
persisted identifiers cannot say which nested operation each item is.

Note also that `custom_tool_call.status` is `completed` at the moment the call
record is written, before its nested `item_completed` events and before its
output record. That status is not a terminal-state indicator for the nested
execution stream.

## Windows

All windows share `thread_id = 01a0cefe-b6c1-7b21-aa52-cdb658c6d54b` on their
`item_completed` records. Exec/function call records carry `turn_id` only via
`internal_chat_message_metadata_passthrough`.

### Window 1: lines 12-30 (19 records)

Focus: exec with no nested execution item; then `function_call js` with an
explicitly linked McpToolCall.

- turn_id: `01a0cefe-bea5-7c42-a732-e29b93b80b17`
- exec call: line 15, `call_id = call_vpypg3dyBeQJuuXwcCcHbQY9`, ts 16:00:01.426Z, create_time 1790179200.362
- exec output: line 17, ts 16:00:10.758Z, create_time 1790179210.759
- execution-relevant item_completed inside exec window: none (only a `token_usage_record` at line 16)
- function_call `js`: line 24, `call_id = call_PICM3TMuuzYTRWwJCTl7h7tr`; output line 27
- item_completed McpToolCall: line 26, `item.id = call_PICM3TMuuzYTRWwJCTl7h7tr`, status completed, `duration {secs:1, nanos:625139800}`
- shared identifiers: McpToolCall `item.id` == function_call `call_id` (explicit); turn_id equal on all records
- explicit structural link: yes, for the js -> McpToolCall pair; the exec at line 15 has nothing to link to
- attribution caveat: whatever the exec at line 15 did, no execution item was recorded for it; absence of items is not evidence of no nested operations
- placeholders: 2 reasoning, 2 message, 6 item_completed Reasoning/AgentMessage (item-4 appears twice, lines 19-20), 2 token_usage_record, 2 token_count

### Window 2: lines 95-103 (9 records)

Focus: exec -> single FileChange -> output.

- turn_id: `01a0ceff-b303-7742-93e8-ac034e355a79`
- exec call: line 98, `call_id = call_1KEARIThuOXZr2mVVGLZW0UD`, ts 16:01:51.937Z, create_time 1790179302.544
- exec output: line 101, ts 16:01:52.200Z, create_time 1790179312.201
- item_completed FileChange: line 100, `item.id = exec-661aa5ec-1d56-45c4-863e-940791acb701`, status completed, keys `[type,id,changes,status,stdout]`
- shared identifiers: turn_id only
- explicit structural link: no
- correspondence: chronological and turn-scoped (item completed_at_ms 1790179312056 is inside the exec create_time..output create_time range)
- attribution: with exactly one item in the window, it is the only candidate, but the fixture cannot prove it was produced by this exec rather than being the only observable of several nested operations

### Window 3: lines 2880-2900 (21 records)

Focus: `function_call sleep` -> Extension `clock.sleep` (explicit id link), then an exec with a FileChange.

- turn_id: `01a0cfbb-1988-79f3-813b-4f60c6d72725`
- function_call `sleep`: line 2886, `call_id = call_ooHM4fQk1A9fZc4KCXBztkUe`; output line 2889
- item_completed Extension: line 2888, `item.id = call_ooHM4fQk1A9fZc4KCXBztkUe`, `kind = clock.sleep`, `durationMs = 3000`, started_at_ms 1790191814054, completed_at_ms 1790191817066
- exec call: line 2895, `call_id = call_WnvspaQEzs3XmPCqUZTHEKom`, ts 19:30:24.670Z
- exec output: line 2898, ts 19:30:44.417Z
- item_completed FileChange: line 2896, `item.id = exec-64704b9d-4af4-4b84-97cb-0d2f06aaacad`, status completed
- explicit structural link: yes for sleep -> Extension; no for exec -> FileChange
- note: the Extension item is the only place `clock.sleep` appears; the function_call itself is named `sleep`

### Window 4: lines 11594-11606 (13 records)

Focus: exec -> single WebSearch -> output.

- turn_id: `01a0d163-6484-7b50-a2ea-021e3a197a63`
- exec call: line 11599, `call_id = call_eRSLUt67Hh8iuroYVmauKQSF`, ts 04:48:13.641Z (2026-09-24), create_time 1790225252.290
- exec output: line 11602, ts 04:48:14.694Z, create_time 1790225294.694
- item_completed WebSearch: line 11601, `item.id = exec-bbd227e2-aaba-4cc9-9d53-a83c71115239`, no `status` field, no `started_at_ms`; keys `[type,id,query,action,results]`, `action.type = open_page`, 3 `text_result` entries
- shared identifiers: turn_id only
- explicit structural link: no
- correspondence: chronological and turn-scoped
- note: WebSearch is the only execution-relevant item type observed without a `status`

### Window 5: lines 13188-13210 (23 records)

Focus: `function_call wait` produces no item_completed; followed by an exec with a FileChange.

- turn_id: `01a0d356-633f-7281-bcb4-7a87c5a67e99`
- function_call `wait`: line 13195, `call_id = call_JibrnQJcvWuxxbKJxOyBI0Z4`; output line 13197 (138 ms later by envelope timestamp)
- execution-relevant item_completed between wait call and output: none
- exec call: line 13205, `call_id = call_u3aSeN4KC9Z70EVAi3n5pqnv`; output line 13208
- item_completed FileChange: line 13206, `item.id = exec-51344d0d-4548-4133-b412-abf70a603e89`, status completed
- explicit structural link: none for either pair (the `wait` arguments, which the survey shows carry a `cell_id`, are sanitized away and no item references them)
- note: a preceding exec output at line 13188 (`call_id = call_ZyRUuSXjHbSgMPJghY47B2ve`) opens the window; its call is outside the window

### Window 6: lines 20790-20806 (17 records)

Focus: exec -> five McpToolCall items -> output.

- turn_id: `01a0d356-633f-7281-bcb4-7a87c5a67e99`
- exec call: line 20796, `call_id = call_73BC1Dy25M496VZY32hyqLtJ`, ts 16:13:35.133Z (2026-09-24), create_time 1790266409.897
- exec output: line 20803, ts 16:13:35.729Z, create_time 1790266415.729
- item_completed McpToolCall x5: lines 20798-20802, ids `exec-d514af07-...`, `exec-b1dc6df8-...`, `exec-8010465f-...`, `exec-6543d369-...`, `exec-6777816f-...`, all status completed, completed_at_ms 1790266415500 .. 1790266415693, keys include `server, tool, arguments, connectorId, linkId, appName, actionName, readOnlyHint, result, duration`
- shared identifiers: turn_id only
- explicit structural link: no
- attribution: impossible to map any one of the five items to a particular nested operation of the exec cell from persisted identifiers; even their count cannot be checked against the cell without its source
- note: these McpToolCall items use `exec-<uuid>` ids, unlike the 15 McpToolCall items produced by `function_call js`, which use the call_id

### Window 7: lines 64496-64506 (11 records)

Focus: exec -> single CommandExecution with `started_at_ms` -> output.

- turn_id: `01a0e0d9-7ce6-7753-9ecc-e50c0b0c0183`
- exec call: line 64500, `call_id = call_XVTNeYnfQiqE7096yB40xIkM`, ts 03:14:31.739Z (2026-09-27), create_time 1790478871.053, status completed at write time
- exec output: line 64503, ts 03:14:59.053Z, create_time 1790478899.054
- item_completed CommandExecution: line 64502, `item.id = exec-581175f1-6654-4eef-8807-4f020205afd0`, `source = unified_exec_startup`, status completed, `exit_code 0`, `duration {secs:0, nanos:25400}`, started_at_ms 1790478884017, completed_at_ms 1790478884018; `parsed_cmd = [{type: read}]`
- shared identifiers: turn_id only
- explicit structural link: no
- correspondence: chronological and turn-scoped; the item started ~13 s after the exec call was written and ~15 s before the exec output
- note: the exec call's `create_time` (1790478871.05) precedes its own envelope `timestamp` (1790478871.739) by ~0.7 s and equals the `create_time` of the `message` at line 64499, i.e. it is the model-side creation time of the response, not the harness write time

### Window 8: lines 66896-66930 (35 records)

Focus: a CommandExecution that completes after its nearest exec output; two consecutive execs in one turn.

- turn_id: `01a0e10c-ff5d-7041-9ea4-020b24daee93`
- exec A call: line 66901, `call_id = call_qxOzN8BCPY7xa2RbjHLvRFIa`, ts 04:35:39.291Z, create_time 1790483704.077
- item_completed FileChange: line 66902, `item.id = exec-06126881-...`, started_at_ms 1790483739321, completed_at_ms 1790483739322
- exec A output: line 66904, ts 04:36:04.494Z, create_time 1790483764.494
- item_completed CommandExecution: line 66906, `item.id = exec-2d4ed089-bcd1-4e41-b960-86b56a7551b3`, started_at_ms 1790483754340 (04:35:54.340, inside exec A's window), completed_at_ms 1790483769180 (04:36:09.180, after exec A's output), envelope ts 04:36:09.180Z
- exec B call: line 66923, `call_id = call_3Wkq2jzxxLg2DQr3EBz01qF8`, ts 04:36:51.049Z, create_time 1790483766.417 (04:36:06.4, before the CommandExecution at 66906 completed)
- item_completed FileChange: line 66924, `exec-bb999e6b-...`; item_completed CommandExecution: line 66926, `exec-2d75d9d0-...`, started 1790483821689, completed 1790483822526
- exec B output: line 66927, ts 04:37:17.550Z
- shared identifiers: turn_id only, identical for all 35 records
- explicit structural link: no
- attribution of line 66906: by record order it sits between exec A's output and exec B's call; by `started_at_ms` it began during exec A; by `completed_at_ms` it ended after exec A's output and after exec B's model-side create_time. Persisted identifiers cannot assign it to exec A or exec B. This is the single execution-relevant item in the transcript that lies outside every exec window without being a `js`-linked McpToolCall.
- exec B contains two items of different types (FileChange, CommandExecution); ordering within the window is the only evidence of their sequence

## What the fixture cannot show

- Whether a nested operation whose source appears in the exec cell actually ran, unless an `item_completed` was recorded.
- Which nested operation an `item_completed` corresponds to when a window holds more than one item, or when none of the persisted fields match.
- Anything about command text, file paths, URLs, MCP server or tool names inside McpToolCall items (sanitized to `<string:N>`), or outputs.

Extraction ranges are recorded in each `_evidence_window` separator so the
windows can be regenerated from a fresh sanitized transcript of the same
rollout with `scripts/codex-rollout-transcript.ts`.
