# Codex rollout survey

Generated 2026-09-28T13:01:30.901Z · commit 6b9d872 · Node v22.14.0 on win32/x64 · zstd not available in this Node (the app’s Electron runtime may still have it)

> No message text, commands, outputs, code, file paths or working directories. Model names are replaced by `<model-N>` aliases. Tool names, model provider ids and rollout file names are included: review before sharing.

## Rollout files

| | |
|---|---|
| Sessions directory | custom location (--sessions) |
| Rollout files | 61 (61 .jsonl, 0 .jsonl.zst) |
| Outside YYYY/MM/DD folders | 0 |
| Date range | 2025-10-02 → 2026-09-28 |
| Size | total 288.5 MB · p50 383 KB · p90 4.3 MB · max 128.2 MB |
| Files over 50 MB / 200 MB | 2 / 0 |
| Surveyed | 61 most recently written |

## Session list (what the app shows)

| | |
|---|---|
| Listed | 61 of 61 (the app lists the 500 most recent) |
| Scan time | 116 ms |
| Live session selected | no (nothing written in the last 10 minutes) |
| Projects | 6 groups from 10 distinct working directories |

#### Listed sessions

| Value | Count | Sessions |
|---|---:|---:|
| listed | 61 | 61 |
| subagent or forked | 22 | 22 |
| titled by subagent task name | 22 | 22 |
| no model | 2 | 2 |
| no title | 2 | 2 |

#### Project groups

| Value | Count |
|---|---:|
| projects with 2-5 sessions | 3 |
| projects with 6-20 sessions | 2 |
| projects with 21+ sessions | 1 |

#### Working directory formats

| Value | Count | Sessions |
|---|---:|---:|
| Windows drive path | 61 | 61 |

#### Originator and source

| Value | Count | Sessions |
|---|---:|---:|
| codex_vscode · source vscode | 26 | 26 |
| codex_work_desktop · source subagent:thread_spawn | 16 | 16 |
| codex_vscode · source subagent:thread_spawn | 6 | 6 |
| codex_cli_rs · source vscode | 5 | 5 |
| codex_work_desktop · source vscode | 4 | 4 |
| codex_exec · source exec | 2 | 2 |
| codex_cli_rs · source (none) | 1 | 1 |
| codex-tui · source vscode | 1 | 1 |

## Opening a session (read + normalize)

| | |
|---|---|
| Sessions timed | 61 |
| Open time | p50 4 ms · p90 53 ms · max 1.91 s |
| Throughput | 81.3 MB/s |
| Peak heap | 412.1 MB |
| Slowest #1 | 1.91 s (read 758 ms, normalize 1.15 s) · 128.2 MB · 76443 lines · `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl` |
| Slowest #2 | 633 ms (read 350 ms, normalize 283 ms) · 60.3 MB · 23722 lines · `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl` |
| Slowest #3 | 325 ms (read 152 ms, normalize 174 ms) · 30.2 MB · 13293 lines · `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl` |

## Parser anomalies

#### Anomalies

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| finished without a duration — A finished execution with no reported or observed duration. | 36 | 4 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:16319`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:155`<br>`2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:478` |
| recorded item not linked to a call or cell — An item record (item_completed, *_end) whose id matches no call and that no single running code cell could claim. | 12 | 4 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:66906`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:16319`<br>`2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:478` |
| call without a result — A call in a finished turn that never got an output. | 6 | 4 | `2026/08/13/rollout-2026-08-13T23-18-41-019ffe47-6c39-70f2-8806-c372d8151cfb.jsonl:66`<br>`2026/08/13/rollout-2026-08-13T23-18-27-019ffe47-34e4-74c2-ab5c-c4e70033dfc1.jsonl:69`<br>`2026/07/11/rollout-2026-07-11T18-46-59-019f535c-d115-7c62-a2f2-010729a75ea8.jsonl:122` |

#### Anomalies by execution kind

| Value | Count | Sessions |
|---|---:|---:|
| finished without a duration · web_search | 35 | 3 |
| recorded item not linked to a call or cell · web_search | 10 | 2 |
| call without a result · code_cell | 6 | 4 |
| finished without a duration · patch | 1 | 1 |
| recorded item not linked to a call or cell · command | 1 | 1 |
| recorded item not linked to a call or cell · patch | 1 | 1 |

#### Anomalies by CLI version (session_meta.cli_version)

| Value | Count | Sessions |
|---|---:|---:|
| finished without a duration · cli 0.142.5 | 15 | 1 |
| finished without a duration · cli 0.140.0-alpha.2 | 14 | 1 |
| recorded item not linked to a call or cell · cli 0.140.0-alpha.2 | 7 | 1 |
| finished without a duration · cli 0.137.0-alpha.4 | 6 | 1 |
| call without a result · cli 0.142.0-alpha.1 | 3 | 1 |
| recorded item not linked to a call or cell · cli 0.137.0-alpha.4 | 3 | 1 |
| call without a result · cli 0.147.0-alpha.6.6 | 2 | 2 |
| call without a result · cli 0.144.0-alpha.4 | 1 | 1 |
| finished without a duration · cli 0.142.0-alpha.6 | 1 | 1 |
| recorded item not linked to a call or cell · cli 0.142.0-alpha.6 | 1 | 1 |
| recorded item not linked to a call or cell · cli 0.155.0-alpha.16.3 | 1 | 1 |

#### Calls without a result, by structural family

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| turn never closed: rollout ended mid-turn | 6 | 4 | `2026/08/13/rollout-2026-08-13T23-18-41-019ffe47-6c39-70f2-8806-c372d8151cfb.jsonl:66`<br>`2026/08/13/rollout-2026-08-13T23-18-27-019ffe47-34e4-74c2-ab5c-c4e70033dfc1.jsonl:69`<br>`2026/07/11/rollout-2026-07-11T18-46-59-019f535c-d115-7c62-a2f2-010729a75ea8.jsonl:122` |

## What the app renders

#### Executions (kind → status)

| Value | Count | Sessions |
|---|---:|---:|
| code_cell → completed | 9637 | 35 |
| nested command → unknown | 6339 | 35 |
| nested patch → completed | 4370 | 27 |
| nested patch → unknown | 4201 | 27 |
| code_cell → failed | 3112 | 32 |
| code_wait → completed | 1599 | 18 |
| command → completed | 1114 | 11 |
| nested tool → unknown | 1034 | 18 |
| nested command_input → unknown | 1016 | 7 |
| nested mcp → completed | 512 | 7 |
| nested mcp → unknown | 494 | 4 |
| nested command → completed | 459 | 8 |
| command → declined | 325 | 6 |
| patch → completed | 316 | 6 |
| tool → completed | 130 | 24 |
| nested web_search → completed | 126 | 10 |
| mcp → completed | 104 | 3 |
| command → failed | 102 | 8 |
| nested plan → unknown | 48 | 4 |
| command_input → completed | 35 | 2 |
| web_search → completed | 35 | 3 |
| nested tool → completed | 26 | 3 |
| nested mcp → failed | 16 | 2 |
| tool_search → completed | 14 | 4 |
| code_cell → interrupted | 12 | 6 |
| nested command → failed | 11 | 3 |
| plan → completed | 11 | 2 |
| command → interrupted | 9 | 4 |
| code_cell → unknown | 6 | 4 |
| mcp → failed | 5 | 2 |
| command_input → failed | 3 | 2 |
| tool → failed | 3 | 1 |
| code_wait → interrupted | 1 | 1 |
| patch → failed | 1 | 1 |

#### Call generations

| Value | Count | Sessions |
|---|---:|---:|
| (none) · recorded as custom_tool_call | 13083 | 44 |
| (none) · recorded as function_call | 1853 | 38 |
| function_call · recorded as function_call | 1587 | 10 |
| (none) · recorded as item_completed/WebSearch | 25 | 3 |
| (none) · recorded as tool_search_call | 14 | 4 |
| (none) · recorded as web_search_call | 10 | 2 |
| code_mode · recorded as item_completed/CommandExecution | 1 | 1 |
| code_mode · recorded as item_completed/FileChange | 1 | 1 |

#### Code cells and their nested calls

| Value | Count | Sessions |
|---|---:|---:|
| cells with script-only | 7270 | 35 |
| child command → unknown | 6339 | 35 |
| cells with recorded + script-only | 4787 | 31 |
| child patch → completed | 4370 | 27 |
| child patch → unknown | 4201 | 27 |
| child tool → unknown | 1034 | 18 |
| child command_input → unknown | 1016 | 7 |
| child mcp → completed | 512 | 7 |
| child mcp → unknown | 494 | 4 |
| child command → completed · exit code | 459 | 8 |
| cells with no nested operations | 389 | 17 |
| cells with recorded | 321 | 8 |
| child web_search → completed | 126 | 10 |
| child plan → unknown | 48 | 4 |
| child tool → completed | 26 | 3 |
| child mcp → failed | 16 | 2 |
| child command → failed · exit code | 11 | 3 |

#### Evidence behind nested and unlinked executions

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| nested command: script call site only (static analysis) | 6339 | 35 |  |
| nested patch: recorded item attributed by turn and order | 4370 | 27 |  |
| nested patch: script call site only (static analysis) | 4201 | 27 |  |
| nested tool: script call site only (static analysis) | 1034 | 18 |  |
| nested command_input: script call site only (static analysis) | 1016 | 7 |  |
| nested mcp: recorded item attributed by turn and order | 528 | 7 |  |
| nested mcp: script call site only (static analysis) | 494 | 4 |  |
| nested command: recorded item attributed by turn and order | 352 | 4 |  |
| nested web_search: recorded item attributed by turn and order | 126 | 10 |  |
| nested command: script call site + recorded item (content link) | 118 | 7 |  |
| nested plan: script call site only (static analysis) | 48 | 4 |  |
| nested tool: recorded item attributed by turn and order | 26 | 3 |  |
| top-level web_search: call + recorded item linked by id | 15 | 1 |  |
| top-level web_search: recorded item, not linked: No call record with this id in the rollout | 10 | 2 |  |
| top-level command: recorded item, not linked: Dispatched from a code cell, but no cell of its turn was running when it was recorded | 1 | 1 |  |
| top-level patch: recorded item, not linked: Dispatched from a code cell, but 2 cells of its turn were running | 1 | 1 |  |

#### Other timeline entries

| Value | Count | Sessions |
|---|---:|---:|
| reasoning · summary · encrypted | 14882 | 16 |
| agent message · commentary | 8916 | 38 |
| reasoning · no summary · encrypted | 8794 | 50 |
| user message | 915 | 37 |
| agent message · final_answer | 783 | 46 |
| compaction | 128 | 12 |
| agent message · no phase · inter-agent | 104 | 27 |
| turn aborted | 66 | 18 |
| inherited context (subagent) | 22 | 22 |
| turn failed | 19 | 6 |
| agent message · no phase | 1 | 1 |

#### Surveyed sessions

| Value | Count | Sessions |
|---|---:|---:|
| sessions surveyed | 61 | 61 |
| subagent or forked session | 22 | 22 |
| subagent with inherited parent history | 22 | 22 |
| titled by subagent task name | 22 | 22 |
| no executions | 9 | 9 |
| no token usage | 5 | 5 |
| no model (no turn_context) | 2 | 2 |
| no title (no user request or subagent task name found) | 2 | 2 |

## Rollout format

#### Line formats

| Value | Count | Sessions |
|---|---:|---:|
| envelope {timestamp, type, payload, …} | 141286 | 61 |

#### Record types

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| response_item | 68493 | 61 |  |
| event_msg | 63027 | 59 |  |
| token_usage_record (not rendered, by design) | 8060 | 25 |  |
| turn_context | 1078 | 59 |  |
| world_state (not rendered, by design) | 309 | 47 |  |
| compacted | 140 | 24 |  |
| inter_agent_communication_metadata (not rendered, by design) | 104 | 27 |  |
| session_meta | 75 | 61 |  |

#### Envelope fields

| Value | Count | Sessions |
|---|---:|---:|
| {ordinal, payload, timestamp, type} | 131735 | 59 |
| {metadata, ordinal, payload, timestamp, type} | 6765 | 3 |
| {payload, timestamp, type} | 2473 | 2 |
| {metadata, payload, timestamp, type} | 313 | 1 |

#### Envelope metadata fields

| Value | Count | Sessions |
|---|---:|---:|
| {client_authored, fallback_token_limit_override} | 7058 | 4 |
| {client_authored, mcp_attribution, user_input_order} | 15 | 1 |
| {client_authored, user_input_order} | 4 | 1 |
| {client_authored, mcp_attribution} | 1 | 1 |

#### session_meta (instructions and tool lists are not read)

| Value | Count | Sessions |
|---|---:|---:|
| cwd Windows drive path | 75 | 61 |
| model_provider openai | 69 | 55 |
| git {branch, commit_hash, repository_url} | 59 | 45 |
| source vscode | 50 | 48 |
| originator codex_vscode | 34 | 32 |
| originator codex_work_desktop | 32 | 20 |
| fields {agent_nickname, agent_path, cli_version, context_window, cwd, forked_from_id, git, history_mode, id, model_provider, multi_agent_version, originator, parent_thread_id, session_id, source, subagent_history_start_ordinal, thread_source, timestamp} | 22 | 22 |
| source subagent.thread_spawn | 22 | 22 |
| fields {cli_version, context_window, cwd, git, history_mode, id, model_provider, originator, session_id, source, thread_source, timestamp} | 21 | 21 |
| cli_version 0.153.4 | 20 | 14 |
| cli_version 0.153.0 | 14 | 14 |
| cli_version 0.144.0-alpha.4 | 11 | 11 |
| fields {cli_version, context_window, cwd, git, history_base, history_mode, id, model_provider, originator, session_id, source, thread_source, timestamp} | 9 | 9 |
| fields {cli_version, cwd, git, history_mode, id, model_provider, originator, session_id, source, thread_source, timestamp} | 8 | 8 |
| cli_version 0.42.0 | 6 | 6 |
| model_provider (none) | 6 | 6 |
| originator codex_cli_rs | 6 | 6 |
| cli_version 0.147.0-alpha.6.6 | 5 | 5 |
| cli_version 0.155.0-alpha.16.3 | 5 | 3 |
| fields {cli_version, cwd, history_mode, id, model_provider, originator, session_id, source, timestamp} | 5 | 5 |
| cli_version 0.142.0-alpha.6 | 4 | 4 |
| cli_version 0.140.0-alpha.2 | 3 | 3 |
| fields {cli_version, context_window, cwd, git, history_mode, id, model_provider, originator, runtime_workspace_roots, session_id, source, thread_source, timestamp} | 3 | 3 |
| fields {cli_version, cwd, history_mode, id, model_provider, originator, session_id, source, thread_source, timestamp} | 3 | 3 |
| git {} | 3 | 3 |
| cli_version 0.142.0-alpha.1 | 2 | 2 |
| fields {cli_version, context_window, cwd, git, history_mode, id, memory_mode, model_provider, originator, runtime_workspace_roots, session_id, source, thread_source, timestamp} | 2 | 1 |
| originator codex_exec | 2 | 2 |
| source exec | 2 | 2 |
| cli_version 0.137.0-alpha.4 | 1 | 1 |
| cli_version 0.142.5 | 1 | 1 |
| cli_version 0.145.0-alpha.30 | 1 | 1 |
| cli_version 0.148.0-alpha.15 | 1 | 1 |
| cli_version 0.157.1 | 1 | 1 |
| fields {cli_version, context_window, creator_account_id, creator_user_id, cwd, git, history_mode, id, model_provider, originator, runtime_workspace_roots, session_id, source, thread_source, timestamp} | 1 | 1 |
| fields {cli_version, cwd, git, id, originator, timestamp} | 1 | 1 |
| git {branch, commit_hash} | 1 | 1 |
| git {branch, repository_url} | 1 | 1 |
| git {commit_hash, repository_url} | 1 | 1 |
| git {commit_hash} | 1 | 1 |

…and 3 more values.

#### turn_context

| Value | Count | Sessions |
|---|---:|---:|
| model <model-1> | 565 | 30 |
| model <model-2> | 287 | 11 |
| fields {approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, effort, model, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 254 | 8 |
| fields {approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, effort, file_system_sandbox_policy, model, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 203 | 1 |
| fields {active_permission_profile, approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, effort, model, multi_agent_version, permission_profile, personality, realtime_active, root_turn_id, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 166 | 22 |
| fields {approval_policy, collaboration_mode, comp_hash, current_date, cwd, effort, model, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 144 | 6 |
| model <model-3> | 122 | 17 |
| model <model-4> | 95 | 5 |
| fields {active_permission_profile, approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, disabled_plugin_ids, effort, model, multi_agent_version, permission_profile, personality, realtime_active, root_turn_id, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 90 | 3 |
| fields {approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, effort, model, multi_agent_mode, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 82 | 10 |
| fields {approval_policy, collaboration_mode, current_date, cwd, effort, model, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 70 | 1 |
| fields {approval_policy, collaboration_mode, current_date, cwd, effort, file_system_sandbox_policy, model, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 30 | 4 |
| fields {approval_policy, collaboration_mode, comp_hash, current_date, cwd, effort, model, multi_agent_mode, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 21 | 2 |
| model <model-5> | 8 | 3 |
| fields {approval_policy, cwd, model, sandbox_policy, summary} | 7 | 2 |
| fields {approval_policy, cwd, effort, model, sandbox_policy, summary} | 5 | 2 |
| fields {approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, effort, file_system_sandbox_policy, model, multi_agent_mode, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 4 | 4 |
| fields {approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, disabled_plugin_ids, effort, file_system_sandbox_policy, model, multi_agent_version, permission_profile, personality, realtime_active, root_turn_id, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 1 | 1 |
| fields {approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, effort, model, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id} | 1 | 1 |
| model <model-6> | 1 | 1 |

#### compacted (history fields are not read)

| Value | Count | Sessions |
|---|---:|---:|
| fields {compaction_response_id, first_window_id, latest_token_usage_record, message, previous_window_id, window_id, window_number} | 127 | 22 |
| fields {compaction_response_id, latest_token_usage_record, message} | 5 | 1 |
| fields {compaction_response_id, latest_token_usage_record, message, window_id, window_number} | 4 | 2 |
| fields {compaction_response_id, latest_token_usage_record, message, window_number} | 4 | 1 |

## Response items

#### Item types

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| reasoning | 23676 | 53 |  |
| custom_tool_call_output | 13086 | 44 |  |
| custom_tool_call | 13083 | 44 |  |
| message | 11614 | 61 |  |
| function_call | 3440 | 43 |  |
| function_call_output | 3437 | 43 |  |
| agent_message | 104 | 27 |  |
| web_search_call | 25 | 3 |  |
| tool_search_call | 14 | 4 |  |
| tool_search_output | 14 | 4 |  |

#### Item fields

| Value | Count | Sessions |
|---|---:|---:|
| reasoning {content, encrypted_content, id, internal_chat_message_metadata_passthrough, summary, type} | 18707 | 30 |
| custom_tool_call {call_id, id, input, internal_chat_message_metadata_passthrough, name, status, type} | 12522 | 40 |
| custom_tool_call_output {call_id, id, internal_chat_message_metadata_passthrough, output, type} | 11980 | 27 |
| message {content, id, internal_chat_message_metadata_passthrough, phase, role, type} | 8701 | 46 |
| reasoning {encrypted_content, id, internal_chat_message_metadata_passthrough, summary, type} | 3655 | 15 |
| function_call {arguments, call_id, id, internal_chat_message_metadata_passthrough, name, type} | 2094 | 18 |
| function_call_output {call_id, id, internal_chat_message_metadata_passthrough, output, type} | 1907 | 26 |
| message {content, id, internal_chat_message_metadata_passthrough, role, type} | 1168 | 34 |
| function_call_output {call_id, output, type} | 1107 | 10 |
| reasoning {content, encrypted_content, summary, type} | 973 | 7 |
| function_call {arguments, call_id, name, type} | 872 | 6 |
| message {content, phase, role, type} | 764 | 6 |
| custom_tool_call_output {call_id, output, type} | 558 | 5 |
| custom_tool_call_output {call_id, internal_chat_message_metadata_passthrough, output, type} | 539 | 13 |
| function_call_output {call_id, internal_chat_message_metadata_passthrough, output, type} | 423 | 9 |
| custom_tool_call {call_id, input, name, status, type} | 399 | 3 |
| message {content, internal_chat_message_metadata_passthrough, role, type} | 385 | 13 |
| reasoning {content, encrypted_content, id, summary, type} | 341 | 5 |
| message {content, role, type} | 317 | 16 |
| message {content, id, phase, role, type} | 275 | 5 |
| function_call {arguments, call_id, id, internal_chat_message_metadata_passthrough, name, namespace, type} | 237 | 24 |
| function_call {arguments, call_id, id, name, type} | 237 | 5 |
| custom_tool_call {call_id, id, input, name, status, type} | 162 | 3 |
| agent_message {author, content, id, internal_chat_message_metadata_passthrough, recipient, type} | 104 | 27 |
| web_search_call {action, id, internal_chat_message_metadata_passthrough, status, type} | 15 | 1 |
| tool_search_call {arguments, call_id, execution, id, internal_chat_message_metadata_passthrough, status, type} | 13 | 3 |
| tool_search_output {call_id, execution, id, internal_chat_message_metadata_passthrough, status, tools, type} | 12 | 2 |
| web_search_call {action, status, type} | 10 | 2 |
| custom_tool_call_output {call_id, id, internal_chat_message_metadata_passthrough, name, output, type} | 9 | 1 |
| message {content, id, role, type} | 4 | 4 |
| tool_search_call {arguments, call_id, execution, status, type} | 1 | 1 |
| tool_search_output {call_id, execution, internal_chat_message_metadata_passthrough, status, tools, type} | 1 | 1 |
| tool_search_output {call_id, execution, status, tools, type} | 1 | 1 |

#### Messages

| Value | Count | Sessions |
|---|---:|---:|
| assistant content output_text | 9741 | 55 |
| assistant · phase commentary | 8916 | 38 |
| user content input_text | 1414 | 61 |
| user | 1369 | 61 |
| assistant · phase final_answer | 824 | 52 |
| developer content input_text | 728 | 55 |
| developer | 504 | 55 |
| assistant | 1 | 1 |

#### Reasoning items

| Value | Count | Sessions |
|---|---:|---:|
| summary yes · content no · encrypted yes | 14882 | 16 |
| summary no · content no · encrypted yes | 8794 | 50 |

## Tools

#### Tool calls

| Value | Count | Sessions |
|---|---:|---:|
| custom_tool_call exec | 12767 | 40 |
| function_call wait | 1600 | 18 |
| function_call shell_command | 1077 | 7 |
| function_call exec_command | 472 | 4 |
| custom_tool_call apply_patch | 316 | 6 |
| function_call collaboration.send_message | 43 | 21 |
| function_call mcp__codex_apps__github._fetch_file | 41 | 1 |
| function_call write_stdin | 38 | 2 |
| function_call mcp__node_repl.js | 30 | 2 |
| function_call collaboration.spawn_agent | 22 | 6 |
| function_call clock.sleep | 20 | 1 |
| function_call mcp__cua_repl.js | 18 | 1 |
| function_call mcp__codex_apps__github._search | 16 | 1 |
| function_call collaboration.wait_agent | 15 | 5 |
| tool_search_call execution client | 14 | 4 |
| web_search_call action open_page | 14 | 3 |
| function_call collaboration.followup_task | 13 | 2 |
| function_call update_plan | 11 | 2 |
| web_search_call action search | 10 | 2 |
| function_call collaboration.list_agents | 8 | 3 |
| function_call collaboration.interrupt_agent | 5 | 2 |
| function_call request_user_input_async | 4 | 1 |
| function_call mcp__codex_apps__github._search_commits | 2 | 1 |
| function_call web.run | 2 | 1 |
| function_call list_mcp_resources | 1 | 1 |
| function_call mcp__codex_apps__github._compare_commits | 1 | 1 |
| function_call mcp__codex_apps__github._get_repo | 1 | 1 |
| web_search_call action find_in_page | 1 | 1 |

#### Tool argument fields

| Value | Count | Sessions |
|---|---:|---:|
| wait {cell_id, max_tokens, yield_time_ms} | 1594 | 18 |
| shell_command {command, timeout_ms, workdir} | 1055 | 7 |
| exec_command {cmd, max_output_tokens, workdir, yield_time_ms} | 384 | 4 |
| exec_command {cmd, max_output_tokens, workdir} | 58 | 1 |
| collaboration.send_message {message, target} | 43 | 21 |
| mcp__codex_apps__github._fetch_file {encoding, end_line, path, ref, repository_full_name, start_line} | 41 | 1 |
| write_stdin {chars, max_output_tokens, session_id, yield_time_ms} | 38 | 2 |
| exec_command {cmd, max_output_tokens, shell, workdir, yield_time_ms} | 29 | 1 |
| mcp__node_repl.js {code, timeout_ms, title} | 23 | 1 |
| clock.sleep {duration_ms} | 20 | 1 |
| mcp__cua_repl.js {code, title} | 18 | 1 |
| collaboration.spawn_agent {fork_turns, message, task_name} | 17 | 5 |
| collaboration.wait_agent {timeout_ms} | 15 | 5 |
| collaboration.followup_task {message, target} | 13 | 2 |
| mcp__codex_apps__github._search {query, repository_name, topn} | 12 | 1 |
| shell_command {command, justification, sandbox_permissions, timeout_ms, workdir} | 11 | 3 |
| shell_command {command, justification, prefix_rule, sandbox_permissions, timeout_ms, workdir} | 10 | 2 |
| collaboration.list_agents {} | 8 | 3 |
| mcp__node_repl.js {code, title} | 7 | 1 |
| update_plan {plan} | 7 | 2 |
| wait {cell_id, max_tokens, terminate, yield_time_ms} | 6 | 3 |
| collaboration.interrupt_agent {target} | 5 | 2 |
| collaboration.spawn_agent {message, task_name} | 5 | 2 |
| mcp__codex_apps__github._search {org, query, repository_name, topn} | 4 | 1 |
| request_user_input_async {questions} | 4 | 1 |
| update_plan {explanation, plan} | 4 | 1 |
| web.run {open, response_length} | 2 | 1 |
| exec_command {cmd, justification, max_output_tokens, workdir} | 1 | 1 |
| list_mcp_resources {} | 1 | 1 |
| mcp__codex_apps__github._compare_commits {base, head, repo_full_name} | 1 | 1 |
| mcp__codex_apps__github._get_repo {repository_full_name} | 1 | 1 |
| mcp__codex_apps__github._search_commits {order, query, repository_full_name, sort, topn} | 1 | 1 |
| mcp__codex_apps__github._search_commits {query, repository_full_name, topn} | 1 | 1 |
| shell_command {command, sandbox_permissions, timeout_ms, workdir} | 1 | 1 |

#### Status values

| Value | Count | Sessions |
|---|---:|---:|
| custom_tool_call status completed | 13083 | 44 |
| web_search_call status completed | 25 | 3 |

#### Code-mode exec cells

| Value | Count | Sessions |
|---|---:|---:|
| exec cells | 12767 | 40 |
| no tools.* calls found by static analysis | 593 | 17 |
| pragma field max_output_tokens | 81 | 4 |
| with // @exec pragma | 81 | 4 |
| pragma field yield_time_ms | 41 | 3 |

#### tools.* calls in exec cells (static analysis)

| Value | Count | Sessions |
|---|---:|---:|
| tools.apply_patch (dynamic arguments) | 4093 | 24 |
| tools.exec_command | 2847 | 28 |
| tools.shell_command | 1839 | 9 |
| tools.exec_command (dynamic arguments) | 1278 | 9 |
| tools.write_stdin | 1005 | 7 |
| tools.clock__curr_time | 769 | 6 |
| tools.shell_command (dynamic arguments) | 493 | 4 |
| tools.mcp__node_repl__js | 413 | 3 |
| tools.web__run | 154 | 13 |
| tools.apply_patch | 108 | 7 |
| tools.update_plan | 48 | 4 |
| tools.codex_app__automation_update | 43 | 1 |
| tools.codex_app__automation_update (dynamic arguments) | 43 | 1 |
| tools.mcp__node_repl__js (dynamic arguments) | 41 | 1 |
| tools.mcp__codex_apps__github_fetch_file | 18 | 3 |
| tools.write_stdin (dynamic arguments) | 11 | 1 |
| tools.codex_app__read_thread | 9 | 1 |
| tools.mcp__codex_apps__github_fetch_file (dynamic arguments) | 9 | 2 |
| tools.list_mcp_resources | 5 | 5 |
| tools.mcp__codex_apps__github_search | 4 | 1 |
| tools.codex_app__list_threads | 3 | 1 |
| tools.list_mcp_resource_templates | 3 | 3 |
| tools.mcp__codex_apps__github_search (dynamic arguments) | 3 | 2 |
| tools.codex_app__read_thread_terminal | 2 | 2 |
| tools.mcp__codex_apps__github_get_repo | 2 | 2 |
| tools.view_image | 2 | 1 |
| tools.codex_app__load_workspace_dependencies | 1 | 1 |
| tools.mcp__codex_apps__github__fetch_file (dynamic arguments) | 1 | 1 |
| tools.mcp__codex_apps__github_search_branches | 1 | 1 |
| tools.mcp__codex_apps__github_search_commits | 1 | 1 |
| tools.mcp__node_repl__js_reset | 1 | 1 |

#### Harness passthrough metadata

| Value | Count | Sessions |
|---|---:|---:|
| reasoning {turn_id} | 22362 | 44 |
| custom_tool_call {create_time, turn_id} | 7919 | 21 |
| custom_tool_call_output {create_time, turn_id} | 7919 | 21 |
| message {content_item_kinds, create_time, turn_id} | 7033 | 26 |
| custom_tool_call_output {turn_id} | 4609 | 20 |
| custom_tool_call {turn_id} | 4603 | 20 |
| message {turn_id} | 3055 | 20 |
| function_call {turn_id} | 2010 | 15 |
| function_call_output {turn_id} | 2009 | 15 |
| function_call {create_time, turn_id} | 321 | 21 |
| function_call_output {create_time, turn_id} | 321 | 21 |
| agent_message {create_time, turn_id} | 93 | 22 |
| message {content_item_kinds, turn_id} | 83 | 9 |
| message {create_time, turn_id} | 65 | 2 |
| message {content_item_kinds} | 18 | 18 |
| web_search_call {turn_id} | 15 | 1 |
| tool_search_call {turn_id} | 13 | 3 |
| tool_search_output {turn_id} | 13 | 3 |
| agent_message {turn_id} | 11 | 5 |

## Tool outputs

#### Output body shapes

| Value | Count | Sessions |
|---|---:|---:|
| custom_tool_call_output content items | 11476 | 40 |
| function_call_output text | 2108 | 36 |
| custom_tool_call_output text | 1610 | 21 |
| function_call_output content items | 1329 | 17 |

#### Exec output headers (fields the parser extracted)

| Value | Count | Sessions |
|---|---:|---:|
| exec → wallTimeMs + scriptStatus | 11445 | 40 |
| exec → wallTimeMs + scriptStatus + cellId | 1311 | 18 |
| wait → wallTimeMs + scriptStatus | 1310 | 18 |
| shell_command → exitCode + wallTimeMs | 871 | 7 |
| apply_patch → exitCode + wallTimeMs | 315 | 6 |
| exec_command → exitCode + wallTimeMs + chunkId + originalTokenCount | 291 | 4 |
| wait → wallTimeMs + scriptStatus + cellId | 289 | 8 |
| shell_command → no header | 168 | 4 |
| exec_command → no header | 159 | 3 |
| shell_command → exitCode + wallTimeMs + totalOutputLines | 32 | 5 |
| exec_command → wallTimeMs + processId + chunkId + originalTokenCount | 22 | 2 |
| write_stdin → exitCode + wallTimeMs + chunkId + originalTokenCount | 21 | 2 |
| exec → no header | 14 | 4 |
| write_stdin → wallTimeMs + processId + chunkId + originalTokenCount | 14 | 2 |
| shell_command → wallTimeMs | 3 | 1 |
| write_stdin → no header | 3 | 2 |
| apply_patch → no header | 1 | 1 |
| wait → no header | 1 | 1 |

#### Unrecognized exec output headers (labels only)

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| exec_command → Command …: … | 145 | 2 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:31`<br>`2026/06/30/rollout-2026-06-30T16-21-55-019f1a31-f9af-7910-b51b-b8cce55e2081.jsonl:221` |
| shell_command → Command …: # / …: … | 135 | 3 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:232`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1019`<br>`2026/07/23/rollout-2026-07-23T10-11-31-019f8f51-2041-76b1-804c-5032dc4f6a93.jsonl:15` |
| shell_command → Command …: # / # … | 12 | 2 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:167`<br>`2026/07/23/rollout-2026-07-23T10-11-31-019f8f51-2041-76b1-804c-5032dc4f6a93.jsonl:22` |
| shell_command → Command …: # / …: command … | 10 | 3 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:322`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:2689`<br>`2026/07/23/rollout-2026-07-23T10-11-31-019f8f51-2041-76b1-804c-5032dc4f6a93.jsonl:176` |
| exec → … # …: # of | 9 | 1 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:20362` |
| exec → aborted … # | 5 | 3 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:415`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:12687`<br>`2026/06/20/rollout-2026-06-20T01-50-17-019ee394-6258-7a11-b494-7f4f3de1b63c.jsonl:757` |
| exec_command → Command …: … / … | 5 | 1 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:1257` |
| exec_command → Command …: EXIT | 4 | 2 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:409`<br>`2026/06/30/rollout-2026-06-30T16-21-55-019f1a31-f9af-7910-b51b-b8cce55e2081.jsonl:306` |
| shell_command → Command …: # / … REJECTED: … # … | 4 | 3 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:527`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:4281`<br>`2026/07/23/rollout-2026-07-23T10-11-31-019f8f51-2041-76b1-804c-5032dc4f6a93.jsonl:195` |
| write_stdin → … failed: … process failed: | 3 | 2 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:964`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2304` |
| shell_command → … command rejected … | 2 | 1 | `2026/06/06/rollout-2026-06-06T14-58-00-019e9e4c-9940-7da1-8f21-f1df332ced69.jsonl:25` |
| shell_command → Command …: # / …: … / … # / … # / (blank) / … | 2 | 1 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:161` |
| apply_patch → … failed: Failed … / … # … | 1 | 1 | `2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:2383` |
| exec_command → aborted … # | 1 | 1 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:970` |
| exec_command → Command …: … / …: … / … / (blank) / …: … | 1 | 1 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:485` |
| exec_command → Command …: … / …: … / …: … / …: / (blank) / …: … | 1 | 1 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:397` |
| exec_command → Command …: … / …: … / (blank) / …: … | 1 | 1 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2856` |
| exec_command → Command …: … / …: … Command: | 1 | 1 | `2026/06/30/rollout-2026-06-30T16-21-55-019f1a31-f9af-7910-b51b-b8cce55e2081.jsonl:267` |
| shell_command → Command …: # / … REJECTED: … # … / … # / … # / (blank) / … | 1 | 1 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:186` |
| shell_command → Command …: # / …: … # command … | 1 | 1 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:4192` |
| shell_command → execution error: …: … | 1 | 1 | `2026/06/06/rollout-2026-06-06T14-58-00-019e9e4c-9940-7da1-8f21-f1df332ced69.jsonl:103` |
| wait → aborted … # | 1 | 1 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:16429` |

#### Harness messages in outputs without a status header (form only)

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| shell_command → Command blocked by PreToolUse hook: … | 165 | 3 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:161`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1019`<br>`2026/07/23/rollout-2026-07-23T10-11-31-019f8f51-2041-76b1-804c-5032dc4f6a93.jsonl:15` |
| exec_command → Command blocked by PreToolUse hook: … | 158 | 2 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:31`<br>`2026/06/30/rollout-2026-06-30T16-21-55-019f1a31-f9af-7910-b51b-b8cce55e2081.jsonl:221` |
| exec → (none of the known forms) | 9 | 1 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:20362` |
| exec → aborted by user after … | 5 | 3 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:415`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:12687`<br>`2026/06/20/rollout-2026-06-20T01-50-17-019ee394-6258-7a11-b494-7f4f3de1b63c.jsonl:757` |
| shell_command → Wall time: … / aborted by user | 3 | 1 | `2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:959` |
| write_stdin → write_stdin failed: … | 3 | 2 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:964`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2304` |
| shell_command → … rejected by user | 2 | 1 | `2026/06/06/rollout-2026-06-06T14-58-00-019e9e4c-9940-7da1-8f21-f1df332ced69.jsonl:25` |
| apply_patch → apply_patch verification failed … | 1 | 1 | `2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:2383` |
| exec_command → aborted by user after … | 1 | 1 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:970` |
| shell_command → execution error: … | 1 | 1 | `2026/06/06/rollout-2026-06-06T14-58-00-019e9e4c-9940-7da1-8f21-f1df332ced69.jsonl:103` |
| wait → aborted by user after … | 1 | 1 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:16429` |

## Events

#### event_msg types

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| item_completed | 42255 | 57 |  |
| token_count | 17279 | 56 |  |
| task_started | 942 | 58 |  |
| task_complete | 854 | 55 |  |
| agent_reasoning | 809 | 1 |  |
| thread_settings_applied (not rendered, by design) | 685 | 41 |  |
| patch_apply_end | 102 | 1 |  |
| turn_aborted | 67 | 18 |  |
| agent_message | 28 | 1 |  |
| user_message | 4 | 2 |  |
| context_compacted | 2 | 1 |  |

#### Rendered event fields

| Value | Count | Sessions |
|---|---:|---:|
| token_count {info, rate_limits, type} | 17279 | 56 |
| task_started {collaboration_mode_kind, model_context_window, started_at, turn_id, type} | 902 | 54 |
| agent_reasoning {text, type} | 809 | 1 |
| task_complete {completed_at, duration_ms, last_agent_message, started_at, time_to_first_token_ms, turn_id, type} | 508 | 32 |
| task_complete {completed_at, duration_ms, last_agent_message, time_to_first_token_ms, turn_id, type} | 307 | 21 |
| patch_apply_end {call_id, changes, status, stderr, stdout, success, turn_id, type} | 102 | 1 |
| task_started {collaboration_mode_kind, model_context_window, root_turn_id, started_at, turn_id, type} | 40 | 4 |
| turn_aborted {completed_at, duration_ms, reason, turn_id, type} | 37 | 10 |
| task_complete {completed_at, duration_ms, error, last_agent_message, started_at, time_to_first_token_ms, turn_id, type} | 33 | 15 |
| agent_message {memory_citation, message, phase, type} | 28 | 1 |
| turn_aborted {completed_at, duration_ms, reason, started_at, turn_id, type} | 28 | 7 |
| task_complete {completed_at, last_agent_message, turn_id, type} | 6 | 6 |
| user_message {audio, client_id, images, local_audio, local_images, message, text_elements, type} | 3 | 1 |
| context_compacted {type} | 2 | 1 |
| turn_aborted {reason, turn_id, type} | 1 | 1 |
| turn_aborted {reason, type} | 1 | 1 |
| user_message {kind, message, type} | 1 | 1 |

#### item_completed item types

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| Reasoning | 25421 | 18 |  |
| AgentMessage | 9722 | 53 |  |
| FileChange | 4601 | 33 |  |
| UserMessage | 933 | 45 |  |
| McpToolCall | 640 | 10 |  |
| CommandExecution | 471 | 8 |  |
| WebSearch | 162 | 14 |  |
| ContextCompaction (not rendered, by design) | 130 | 15 |  |
| SubAgentActivity (not rendered, by design) | 128 | 24 |  |
| Extension | 46 | 3 |  |
| CollabAgentToolCall (not rendered, by design) | 1 | 1 |  |

#### item_completed item fields

| Value | Count | Sessions |
|---|---:|---:|
| Reasoning {id, raw_content, summary_text, type} | 25421 | 18 |
| AgentMessage {content, id, phase, type} | 9720 | 52 |
| FileChange {changes, id, status, stdout, type} | 4111 | 27 |
| UserMessage {client_id, content, id, type} | 927 | 40 |
| FileChange {changes, id, status, stderr, stdout, type} | 490 | 7 |
| CommandExecution {aggregated_output, command, cwd, duration, exit_code, formatted_output, id, parsed_cmd, process_id, source, status, stderr, stdout, type} | 471 | 8 |
| McpToolCall {arguments, duration, id, readOnlyHint, result, server, status, tool, type} | 429 | 2 |
| ContextCompaction {id, type} | 130 | 15 |
| SubAgentActivity {agent_path, agent_thread_id, id, kind, type} | 128 | 24 |
| WebSearch {action, id, query, results, type} | 122 | 9 |
| McpToolCall {actionName, appName, arguments, connectorId, duration, id, linkId, result, server, status, tool, type} | 112 | 1 |
| McpToolCall {arguments, duration, id, result, server, status, tool, type} | 64 | 9 |
| WebSearch {action, id, query, type} | 40 | 5 |
| Extension {action, id, kind, query, results, type} | 26 | 3 |
| Extension {durationMs, id, kind, type} | 20 | 1 |
| McpToolCall {arguments, duration, id, pluginId, readOnlyHint, result, server, status, tool, type} | 18 | 1 |
| McpToolCall {actionName, appName, arguments, connectorId, duration, id, linkId, readOnlyHint, result, server, status, tool, type} | 17 | 1 |
| UserMessage {content, id, type} | 6 | 6 |
| AgentMessage {content, delivery, id, phase, questions, type} | 1 | 1 |
| AgentMessage {content, id, type} | 1 | 1 |
| CollabAgentToolCall {agents_states, id, receiver_agents, receiver_thread_ids, sender_thread_id, status, tool, type} | 1 | 1 |

#### Command result events

| Value | Count | Sessions |
|---|---:|---:|
| CommandExecution · source unified_exec_startup · status completed | 460 | 8 |
| CommandExecution · source unified_exec_startup · status failed | 11 | 3 |

## Runtime state and relationships

> Evidence for runtime-settings design. Values are shown only for enum-like settings fields; model names use the report aliases; ids, paths, dates, text and agent names are never shown. Records a forked subagent copied from its parent are excluded. Relations are reported as observed; none implies precedence. On sanitized transcripts (`--from-transcripts`) free-text values are placeholders, so comparisons involving them are reported as not comparable.

#### Records by CLI version (session_meta.cli_version of each rollout, own history only)

| CLI version | Sessions | turn_context | thread_settings_applied | session_meta | world_state | Copied parent records (excluded) |
|---|---:|---:|---:|---:|---:|---:|
| 0.42.0 | 6 | 12 | 0 | 6 | 0 | 0 |
| 0.137.0-alpha.4 | 1 | 9 | 0 | 1 | 0 | 0 |
| 0.140.0-alpha.2 | 3 | 91 | 0 | 3 | 0 | 0 |
| 0.142.0-alpha.1 | 2 | 102 | 9 | 2 | 1 | 0 |
| 0.142.0-alpha.6 | 4 | 249 | 193 | 4 | 51 | 0 |
| 0.142.5 | 1 | 48 | 16 | 1 | 3 | 0 |
| 0.144.0-alpha.4 | 11 | 77 | 70 | 11 | 17 | 0 |
| 0.145.0-alpha.30 | 1 | 1 | 0 | 1 | 1 | 0 |
| 0.147.0-alpha.6.6 | 5 | 217 | 198 | 5 | 43 | 147 |
| 0.148.0-alpha.15 | 1 | 6 | 4 | 1 | 4 | 0 |
| 0.153.0 | 14 | 43 | 35 | 14 | 30 | 488 |
| 0.153.4 | 8 | 51 | 50 | 8 | 33 | 105 |
| 0.155.0-alpha.16.3 | 3 | 90 | 89 | 5 | 59 | 0 |
| 0.157.1 | 1 | 1 | 0 | 1 | 1 | 0 |

### A. Settings fields by record family

Types, the CLI versions a field appears in, distinct values, and changes within a rollout (a repeat is a record that carries the same value as the previous record of its family in that rollout). Paths are relative to the record family shown in each heading.

#### Fields of `turn_context` (payload)

| Field | Type | Records | Sessions | CLI versions | Distinct values | Repeats | Changes | Sessions with changes |
|---|---|---:|---:|---|---:|---:|---:|---:|
| `active_permission_profile` | object | 184 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 1 | 159 | 0 | 0 |
| `active_permission_profile.id` | string | 184 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 1 | 159 | 0 | 0 |
| `approval_policy` | string | 997 | 59 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 935 | 3 | 2 |
| `approvals_reviewer` | string | 720 | 47 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 673 | 0 | 0 |
| `collaboration_mode` | object | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 15 | 914 | 16 | 7 |
| `collaboration_mode.mode` | string | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 930 | 0 | 0 |
| `collaboration_mode.settings` | object | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 15 | 914 | 16 | 7 |
| `collaboration_mode.settings.developer_instructions` | null [0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.153.0, 0.153.4] · string [0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1] | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 5 | 924 | 6 | 1 |
| `collaboration_mode.settings.model` | string | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 5 | 924 | 6 | 5 |
| `collaboration_mode.settings.reasoning_effort` | string | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 4 | 926 | 4 | 4 |
| `comp_hash` | string | 885 | 51 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 831 | 3 | 3 |
| `current_date` | string | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 56 | 885 | 45 | 17 |
| `cwd` | string | 997 | 59 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 7 | 938 | 0 | 0 |
| `disabled_plugin_ids` | array | 91 | 4 | 0.155.0-alpha.16.3, 0.157.1 | 1 | 87 | 0 | 0 |
| `effort` | string | 990 | 57 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 5 | 929 | 4 | 4 |
| `file_system_sandbox_policy` | object | 238 | 10 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 | 11 | 224 | 4 | 4 |
| `file_system_sandbox_policy.entries` | array | 238 | 10 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 | 11 | 224 | 4 | 4 |
| `file_system_sandbox_policy.kind` | string | 238 | 10 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 | 1 | 228 | 0 | 0 |
| `model` | string | 997 | 59 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 6 | 932 | 6 | 5 |
| `multi_agent_mode` | string | 107 | 15 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30 | 1 | 92 | 0 | 0 |
| `multi_agent_version` | string | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 930 | 0 | 0 |
| `permission_profile` | object | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 12 | 922 | 8 | 6 |
| `permission_profile.file_system` | object | 238 | 10 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 | 11 | 224 | 4 | 4 |
| `permission_profile.file_system.entries` | array | 238 | 10 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 | 11 | 224 | 4 | 4 |
| `permission_profile.file_system.type` | string | 238 | 10 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 | 1 | 228 | 0 | 0 |
| `permission_profile.network` | string | 238 | 10 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 | 1 | 228 | 0 | 0 |
| `permission_profile.type` | string | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 926 | 4 | 3 |
| `personality` | string | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 930 | 0 | 0 |
| `realtime_active` | boolean | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 930 | 0 | 0 |
| `root_turn_id` | string | 185 | 26 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 99 | 57 | 102 | 10 |
| `sandbox_policy` | object | 997 | 59 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 7 | 934 | 4 | 3 |
| `sandbox_policy.exclude_slash_tmp` | boolean | 242 | 11 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 | 1 | 231 | 0 | 0 |
| `sandbox_policy.exclude_tmpdir_env_var` | boolean | 242 | 11 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 | 1 | 231 | 0 | 0 |
| `sandbox_policy.mode` | string | 4 | 1 | 0.42.0 | 1 | 3 | 0 | 0 |
| `sandbox_policy.network_access` | boolean | 242 | 11 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 | 1 | 231 | 0 | 0 |
| `sandbox_policy.type` | string | 993 | 58 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 3 | 931 | 4 | 3 |
| `sandbox_policy.writable_roots` | array | 205 | 3 | 0.142.0-alpha.6, 0.145.0-alpha.30, 0.157.1 | 3 | 202 | 0 | 0 |
| `summary` | string | 997 | 59 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 938 | 0 | 0 |
| `timezone` | string | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 930 | 0 | 0 |
| `turn_id` | string | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 866 | 119 | 811 | 31 |
| `workspace_roots` | array | 984 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 13 | 923 | 6 | 3 |

#### Fields of `event_msg` `thread_settings_applied` (payload `thread_settings`)

| Field | Type | Records | Sessions | CLI versions | Distinct values | Repeats | Changes | Sessions with changes |
|---|---|---:|---:|---|---:|---:|---:|---:|
| `active_permission_profile` | object | 530 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 2 | 489 | 4 | 3 |
| `active_permission_profile.id` | string | 530 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 2 | 489 | 4 | 3 |
| `approval_policy` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 2 | 624 | 3 | 2 |
| `approvals_reviewer` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 1 | 627 | 0 | 0 |
| `collaboration_mode` | object | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 16 | 608 | 19 | 7 |
| `collaboration_mode.mode` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 1 | 627 | 0 | 0 |
| `collaboration_mode.settings` | object | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 16 | 608 | 19 | 7 |
| `collaboration_mode.settings.developer_instructions` | null [0.142.5, 0.153.0, 0.153.4] · string [0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3] | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 5 | 619 | 8 | 2 |
| `collaboration_mode.settings.model` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 5 | 621 | 6 | 5 |
| `collaboration_mode.settings.reasoning_effort` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 5 | 620 | 7 | 3 |
| `cwd` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 6 | 623 | 4 | 3 |
| `disabled_plugin_ids` | array | 111 | 5 | 0.153.0, 0.155.0-alpha.16.3 | 1 | 106 | 0 | 0 |
| `model` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 5 | 621 | 6 | 5 |
| `model_provider_id` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 1 | 627 | 0 | 0 |
| `permission_profile` | object | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 3 | 623 | 4 | 3 |
| `permission_profile.file_system` | object | 192 | 3 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4 | 2 | 189 | 0 | 0 |
| `permission_profile.file_system.entries` | array | 192 | 3 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4 | 2 | 189 | 0 | 0 |
| `permission_profile.file_system.type` | string | 192 | 3 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4 | 1 | 189 | 0 | 0 |
| `permission_profile.network` | string | 192 | 3 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4 | 1 | 189 | 0 | 0 |
| `permission_profile.type` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 2 | 623 | 4 | 3 |
| `personality` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 1 | 627 | 0 | 0 |
| `reasoning_effort` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 5 | 620 | 7 | 3 |
| `reasoning_summary` | string | 662 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 2 | 570 | 55 | 2 |
| `runtime_workspace_roots` | array | 90 | 3 | 0.153.0, 0.155.0-alpha.16.3 | 2 | 86 | 1 | 1 |
| `service_tier` | string | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 2 | 626 | 1 | 1 |

#### Fields of `session_meta` (payload)

| Field | Type | Records | Sessions | CLI versions | Distinct values | Repeats | Changes | Sessions with changes |
|---|---|---:|---:|---|---:|---:|---:|---:|
| `agent_nickname` | string | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 20 | 0 | 0 | 0 |
| `agent_path` | string | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 22 | 0 | 0 | 0 |
| `cli_version` | string | 63 | 61 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 14 | 2 | 0 | 0 |
| `context_window` | object | 46 | 44 | 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 43 | 2 | 0 | 0 |
| `context_window.window_id` | string | 46 | 44 | 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 43 | 2 | 0 | 0 |
| `creator_account_id` | string | 1 | 1 | 0.157.1 | 1 | 0 | 0 | 0 |
| `creator_user_id` | string | 1 | 1 | 0.157.1 | 1 | 0 | 0 | 0 |
| `cwd` | string | 63 | 61 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 10 | 2 | 0 | 0 |
| `forked_from_id` | string | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 5 | 0 | 0 | 0 |
| `git` | object | 55 | 53 | 0.42.0, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 15 | 2 | 0 | 0 |
| `git.branch` | string | 49 | 47 | 0.42.0, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 2 | 0 | 0 |
| `git.commit_hash` | string | 50 | 48 | 0.42.0, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 10 | 2 | 0 | 0 |
| `git.repository_url` | string | 50 | 48 | 0.42.0, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 3 | 2 | 0 | 0 |
| `history_base` | object | 1 | 1 | 0.153.4 | 1 | 0 | 0 | 0 |
| `history_base.end_byte_offset` | number | 1 | 1 | 0.153.4 | 1 | 0 | 0 | 0 |
| `history_base.end_ordinal_exclusive` | number | 1 | 1 | 0.153.4 | 1 | 0 | 0 | 0 |
| `history_base.thread_id` | string | 1 | 1 | 0.153.4 | 1 | 0 | 0 | 0 |
| `history_mode` | string | 62 | 60 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 2 | 0 | 0 |
| `id` | string | 63 | 61 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 60 | 2 | 0 | 0 |
| `memory_mode` | string | 2 | 1 | 0.155.0-alpha.16.3 | 1 | 1 | 0 | 0 |
| `model_provider` | null [0.42.0] · string [0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1] | 62 | 60 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 2 | 0 | 0 |
| `multi_agent_version` | string | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 1 | 0 | 0 | 0 |
| `originator` | string | 63 | 61 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 5 | 2 | 0 | 0 |
| `parent_thread_id` | string | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 5 | 0 | 0 | 0 |
| `runtime_workspace_roots` | array | 6 | 4 | 0.155.0-alpha.16.3, 0.157.1 | 2 | 2 | 0 | 0 |
| `session_id` | string | 62 | 60 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 37 | 2 | 0 | 0 |
| `source` | object [0.147.0-alpha.6.6, 0.153.0, 0.153.4] · string [0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1] | 62 | 60 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 24 | 2 | 0 | 0 |
| `source.subagent` | object | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 22 | 0 | 0 | 0 |
| `source.subagent.thread_spawn` | object | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 22 | 0 | 0 | 0 |
| `source.subagent.thread_spawn.agent_nickname` | string | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 20 | 0 | 0 | 0 |
| `source.subagent.thread_spawn.agent_path` | string | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 22 | 0 | 0 | 0 |
| `source.subagent.thread_spawn.agent_role` | null | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 1 | 0 | 0 | 0 |
| `source.subagent.thread_spawn.depth` | number | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 2 | 0 | 0 | 0 |
| `source.subagent.thread_spawn.parent_thread_id` | string | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 5 | 0 | 0 | 0 |
| `subagent_history_start_ordinal` | number | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | 19 | 0 | 0 | 0 |
| `thread_source` | string | 57 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 2 | 0 | 0 |
| `timestamp` | string | 63 | 61 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 61 | 2 | 0 | 0 |

#### Fields of `world_state` (payload; records with `full: false` carry only changed keys)

| Field | Type | Records | Sessions | CLI versions | Distinct values | Repeats | Changes | Sessions with changes |
|---|---|---:|---:|---|---:|---:|---:|---:|
| `full` | boolean | 243 | 47 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 129 | 67 | 11 |
| `state` | object | 243 | 47 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 131 | 82 | 114 | 17 |
| `state.agents_md` | object | 139 | 25 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 114 | 0 | 0 |
| `state.apps_instructions` | boolean | 142 | 25 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 114 | 3 | 2 |
| `state.collaboration_mode` | null [0.147.0-alpha.6.6] · object [0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1] · string [0.142.0-alpha.6] | 132 | 20 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 9 | 107 | 5 | 2 |
| `state.collaboration_mode.instructions` | string | 70 | 13 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 4 | 54 | 3 | 2 |
| `state.collaboration_mode.mode` | string | 84 | 10 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 74 | 0 | 0 |
| `state.collaboration_mode.model` | string | 87 | 10 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 3 | 74 | 3 | 2 |
| `state.context_window_guidance` | string | 62 | 8 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 54 | 0 | 0 |
| `state.environments` | object | 221 | 40 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 102 | 88 | 93 | 17 |
| `state.environments_instructions` | boolean | 121 | 12 | 0.142.0-alpha.6, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 109 | 0 | 0 |
| `state.git_attribution` | boolean | 120 | 11 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 109 | 0 | 0 |
| `state.host_skills` | object | 137 | 13 | 0.142.0-alpha.6, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 34 | 97 | 27 | 6 |
| `state.managed_developer_instructions` | object | 62 | 8 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 54 | 0 | 0 |
| `state.model` | string | 87 | 10 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 3 | 74 | 3 | 2 |
| `state.multi_agent_mode` | object | 128 | 28 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 11 | 91 | 9 | 3 |
| `state.multi_agent_mode.mode` | string | 86 | 10 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 74 | 2 | 2 |
| `state.multi_agent_mode.usage_hint_hash` | string | 87 | 27 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 4 | 57 | 3 | 2 |
| `state.multi_agent_usage_hint` | string | 88 | 28 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 4 | 57 | 3 | 2 |
| `state.orchestrator_skills` | object | 66 | 9 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | 1 | 57 | 0 | 0 |
| `state.permissions` | object [0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1] · string [0.142.0-alpha.6] | 121 | 11 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 4 | 109 | 1 | 1 |
| `state.persistent_mode` | object | 62 | 8 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 54 | 0 | 0 |
| `state.personality` | object | 32 | 6 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 | 4 | 21 | 5 | 2 |
| `state.personality.model` | string | 32 | 6 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 | 2 | 23 | 3 | 2 |
| `state.personality.personality` | string | 29 | 6 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 | 1 | 23 | 0 | 0 |
| `state.plugins_instructions` | boolean | 142 | 25 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 2 | 114 | 3 | 2 |
| `state.realtime` | object | 120 | 11 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 109 | 0 | 0 |
| `state.realtime.active` | boolean | 120 | 11 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 109 | 0 | 0 |
| `state.skills` | object | 139 | 25 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 | 1 | 114 | 0 | 0 |

#### Settings records not counted above

None found.

#### Values of enum-like settings (allowlisted fields only; `(text)` = a value that does not look like an enum)

| Record | Field | Value | Records | Sessions | CLI versions |
|---|---|---|---:|---:|---|
| session_meta | `cli_version` | 0.42.0 | 6 | 6 | 0.42.0 |
| session_meta | `cli_version` | 0.137.0-alpha.4 | 1 | 1 | 0.137.0-alpha.4 |
| session_meta | `cli_version` | 0.140.0-alpha.2 | 3 | 3 | 0.140.0-alpha.2 |
| session_meta | `cli_version` | 0.142.0-alpha.1 | 2 | 2 | 0.142.0-alpha.1 |
| session_meta | `cli_version` | 0.142.0-alpha.6 | 4 | 4 | 0.142.0-alpha.6 |
| session_meta | `cli_version` | 0.142.5 | 1 | 1 | 0.142.5 |
| session_meta | `cli_version` | 0.144.0-alpha.4 | 11 | 11 | 0.144.0-alpha.4 |
| session_meta | `cli_version` | 0.145.0-alpha.30 | 1 | 1 | 0.145.0-alpha.30 |
| session_meta | `cli_version` | 0.147.0-alpha.6.6 | 5 | 5 | 0.147.0-alpha.6.6 |
| session_meta | `cli_version` | 0.148.0-alpha.15 | 1 | 1 | 0.148.0-alpha.15 |
| session_meta | `cli_version` | 0.153.0 | 14 | 14 | 0.153.0 |
| session_meta | `cli_version` | 0.153.4 | 8 | 8 | 0.153.4 |
| session_meta | `cli_version` | 0.155.0-alpha.16.3 | 5 | 3 | 0.155.0-alpha.16.3 |
| session_meta | `cli_version` | 0.157.1 | 1 | 1 | 0.157.1 |
| session_meta | `history_mode` | legacy | 3 | 1 | 0.155.0-alpha.16.3 |
| session_meta | `history_mode` | paginated | 59 | 59 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| session_meta | `model_provider` | openai | 57 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| session_meta | `multi_agent_version` | v2 | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| session_meta | `originator` | codex-tui | 1 | 1 | 0.157.1 |
| session_meta | `originator` | codex_cli_rs | 6 | 6 | 0.42.0 |
| session_meta | `originator` | codex_exec | 2 | 2 | 0.144.0-alpha.4 |
| session_meta | `originator` | codex_vscode | 34 | 32 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.148.0-alpha.15, 0.153.0, 0.155.0-alpha.16.3 |
| session_meta | `originator` | codex_work_desktop | 20 | 20 | 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| session_meta | `runtime_workspace_roots` | 1 entry | 5 | 3 | 0.155.0-alpha.16.3 |
| session_meta | `runtime_workspace_roots` | 2 entries | 1 | 1 | 0.157.1 |
| session_meta | `source` | exec | 2 | 2 | 0.144.0-alpha.4 |
| session_meta | `source` | vscode | 38 | 36 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| session_meta | `source` | {subagent.thread_spawn} | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| session_meta | `source.subagent.thread_spawn.depth` | 1 | 21 | 21 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| session_meta | `source.subagent.thread_spawn.depth` | 2 | 1 | 1 | 0.153.0 |
| session_meta | `thread_source` | subagent | 22 | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| session_meta | `thread_source` | user | 35 | 33 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| thread_settings_applied | `active_permission_profile.id` | :danger-full-access | 338 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| thread_settings_applied | `active_permission_profile.id` | :workspace | 192 | 3 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4 |
| thread_settings_applied | `approval_policy` | never | 473 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| thread_settings_applied | `approval_policy` | on-request | 191 | 2 | 0.142.0-alpha.6, 0.142.5 |
| thread_settings_applied | `approvals_reviewer` | user | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| thread_settings_applied | `collaboration_mode.mode` | default | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| thread_settings_applied | `collaboration_mode.settings.model` | <model-2> | 24 | 3 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5 |
| thread_settings_applied | `collaboration_mode.settings.model` | <model-1> | 495 | 21 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |
| thread_settings_applied | `collaboration_mode.settings.model` | <model-6> | 2 | 1 | 0.144.0-alpha.4 |
| thread_settings_applied | `collaboration_mode.settings.model` | <model-3> | 54 | 15 | 0.153.0, 0.153.4 |
| thread_settings_applied | `collaboration_mode.settings.model` | <model-4> | 89 | 2 | 0.155.0-alpha.16.3 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | high | 1 | 1 | 0.153.0 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | low | 1 | 1 | 0.142.0-alpha.6 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | max | 34 | 1 | 0.155.0-alpha.16.3 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | ultra | 411 | 24 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | xhigh | 217 | 15 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.148.0-alpha.15, 0.153.0, 0.155.0-alpha.16.3 |
| thread_settings_applied | `disabled_plugin_ids` | 0 entries | 111 | 5 | 0.153.0, 0.155.0-alpha.16.3 |
| thread_settings_applied | `model` | <model-2> | 24 | 3 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5 |
| thread_settings_applied | `model` | <model-1> | 495 | 21 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |
| thread_settings_applied | `model` | <model-6> | 2 | 1 | 0.144.0-alpha.4 |
| thread_settings_applied | `model` | <model-3> | 54 | 15 | 0.153.0, 0.153.4 |
| thread_settings_applied | `model` | <model-4> | 89 | 2 | 0.155.0-alpha.16.3 |
| thread_settings_applied | `model_provider_id` | openai | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| thread_settings_applied | `permission_profile.file_system.type` | restricted | 192 | 3 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4 |
| thread_settings_applied | `permission_profile.type` | disabled | 472 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| thread_settings_applied | `permission_profile.type` | managed | 192 | 3 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4 |
| thread_settings_applied | `personality` | pragmatic | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| thread_settings_applied | `reasoning_effort` | high | 1 | 1 | 0.153.0 |
| thread_settings_applied | `reasoning_effort` | low | 1 | 1 | 0.142.0-alpha.6 |
| thread_settings_applied | `reasoning_effort` | max | 34 | 1 | 0.155.0-alpha.16.3 |
| thread_settings_applied | `reasoning_effort` | ultra | 411 | 24 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| thread_settings_applied | `reasoning_effort` | xhigh | 217 | 15 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.148.0-alpha.15, 0.153.0, 0.155.0-alpha.16.3 |
| thread_settings_applied | `reasoning_summary` | detailed | 404 | 19 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| thread_settings_applied | `reasoning_summary` | none | 258 | 20 | 0.142.0-alpha.1, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0 |
| thread_settings_applied | `runtime_workspace_roots` | 1 entry | 90 | 3 | 0.153.0, 0.155.0-alpha.16.3 |
| thread_settings_applied | `service_tier` | default | 482 | 12 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6 |
| thread_settings_applied | `service_tier` | priority | 182 | 26 | 0.142.0-alpha.1, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | `active_permission_profile.id` | :danger-full-access | 184 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | `approval_policy` | never | 750 | 50 | 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | `approval_policy` | on-request | 247 | 11 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.145.0-alpha.30, 0.157.1 |
| turn_context | `approvals_reviewer` | user | 720 | 47 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| turn_context | `collaboration_mode.mode` | default | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| turn_context | `collaboration_mode.settings.model` | <model-2> | 287 | 11 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5 |
| turn_context | `collaboration_mode.settings.model` | <model-1> | 538 | 29 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |
| turn_context | `collaboration_mode.settings.model` | <model-6> | 1 | 1 | 0.144.0-alpha.4 |
| turn_context | `collaboration_mode.settings.model` | <model-3> | 68 | 15 | 0.153.0, 0.153.4 |
| turn_context | `collaboration_mode.settings.model` | <model-4> | 91 | 4 | 0.155.0-alpha.16.3, 0.157.1 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | low | 1 | 1 | 0.157.1 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | max | 30 | 1 | 0.155.0-alpha.16.3 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | ultra | 464 | 28 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | xhigh | 490 | 29 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.155.0-alpha.16.3 |
| turn_context | `disabled_plugin_ids` | 0 entries | 91 | 4 | 0.155.0-alpha.16.3, 0.157.1 |
| turn_context | `effort` | high | 5 | 2 | 0.42.0 |
| turn_context | `effort` | low | 1 | 1 | 0.157.1 |
| turn_context | `effort` | max | 30 | 1 | 0.155.0-alpha.16.3 |
| turn_context | `effort` | ultra | 464 | 28 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| turn_context | `effort` | xhigh | 490 | 29 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.155.0-alpha.16.3 |
| turn_context | `file_system_sandbox_policy.kind` | restricted | 238 | 10 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 |
| turn_context | `model` | <model-5> | 8 | 3 | 0.42.0 |
| turn_context | `model` | <model-2> | 287 | 11 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5 |
| turn_context | `model` | <model-1> | 538 | 29 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |
| turn_context | `model` | <model-6> | 1 | 1 | 0.144.0-alpha.4 |
| turn_context | `model` | <model-3> | 68 | 15 | 0.153.0, 0.153.4 |
| turn_context | `model` | <model-4> | 95 | 5 | 0.42.0, 0.155.0-alpha.16.3, 0.157.1 |
| turn_context | `multi_agent_mode` | explicitRequestOnly | 107 | 15 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30 |
| turn_context | `multi_agent_version` | v1 | 393 | 8 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.142.5 |
| turn_context | `multi_agent_version` | v2 | 592 | 47 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| turn_context | `permission_profile.file_system.type` | restricted | 238 | 10 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 |
| turn_context | `permission_profile.type` | disabled | 747 | 48 | 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | `permission_profile.type` | managed | 238 | 10 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 |
| turn_context | `personality` | pragmatic | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| turn_context | `realtime_active` | false | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| turn_context | `sandbox_policy.exclude_slash_tmp` | false | 242 | 11 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 |
| turn_context | `sandbox_policy.exclude_tmpdir_env_var` | false | 242 | 11 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 |
| turn_context | `sandbox_policy.mode` | workspace-write | 4 | 1 | 0.42.0 |
| turn_context | `sandbox_policy.network_access` | false | 242 | 11 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 |
| turn_context | `sandbox_policy.type` | danger-full-access | 747 | 48 | 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | `sandbox_policy.type` | read-only | 8 | 3 | 0.42.0 |
| turn_context | `sandbox_policy.type` | workspace-write | 238 | 10 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.157.1 |
| turn_context | `sandbox_policy.writable_roots` | 1 entry | 2 | 2 | 0.145.0-alpha.30, 0.157.1 |
| turn_context | `sandbox_policy.writable_roots` | 2 entries | 203 | 1 | 0.142.0-alpha.6 |
| turn_context | `summary` | auto | 902 | 54 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |
| turn_context | `summary` | detailed | 95 | 5 | 0.42.0, 0.155.0-alpha.16.3, 0.157.1 |
| turn_context | `workspace_roots` | 1 entry | 487 | 35 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.148.0-alpha.15, 0.153.0, 0.155.0-alpha.16.3 |
| turn_context | `workspace_roots` | 2 entries | 238 | 20 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4, 0.157.1 |
| turn_context | `workspace_roots` | 3 entries | 259 | 2 | 0.142.0-alpha.6, 0.147.0-alpha.6.6 |
| world_state | `full` | false | 104 | 33 | 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| world_state | `full` | true | 139 | 25 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| world_state | `state.apps_instructions` | false | 61 | 7 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| world_state | `state.apps_instructions` | true | 81 | 20 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |
| world_state | `state.collaboration_mode.mode` | default | 84 | 10 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| world_state | `state.collaboration_mode.model` | <model-1> | 26 | 5 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |
| world_state | `state.collaboration_mode.model` | <model-3> | 6 | 3 | 0.153.0, 0.153.4 |
| world_state | `state.collaboration_mode.model` | <model-4> | 55 | 4 | 0.155.0-alpha.16.3, 0.157.1 |
| world_state | `state.environments_instructions` | false | 121 | 12 | 0.142.0-alpha.6, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| world_state | `state.git_attribution` | false | 120 | 11 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| world_state | `state.model` | <model-1> | 26 | 5 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |
| world_state | `state.model` | <model-3> | 6 | 3 | 0.153.0, 0.153.4 |
| world_state | `state.model` | <model-4> | 55 | 4 | 0.155.0-alpha.16.3, 0.157.1 |
| world_state | `state.multi_agent_mode.mode` | explicitRequestOnly | 60 | 7 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.155.0-alpha.16.3, 0.157.1 |
| world_state | `state.multi_agent_mode.mode` | proactive | 26 | 5 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| world_state | `state.personality.model` | <model-1> | 26 | 5 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |
| world_state | `state.personality.model` | <model-3> | 6 | 3 | 0.153.0, 0.153.4 |
| world_state | `state.personality.personality` | pragmatic | 29 | 6 | 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |
| world_state | `state.plugins_instructions` | false | 63 | 9 | 0.144.0-alpha.4, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| world_state | `state.plugins_instructions` | true | 79 | 18 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |
| world_state | `state.realtime.active` | false | 120 | 11 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |

### B. Setting changes within a rollout, by CLI version

#### Settings fields per CLI version (repeats = same value as the previous record; changes = a different value)

| Record | Field | CLI version | Records | Sessions | Distinct values | Repeats | Changes | Sessions with changes |
|---|---|---|---:|---:|---:|---:|---:|---:|
| session_meta | `cli_version` | 0.42.0 | 6 | 6 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.137.0-alpha.4 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.140.0-alpha.2 | 3 | 3 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.142.0-alpha.1 | 2 | 2 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.142.0-alpha.6 | 4 | 4 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.142.5 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.144.0-alpha.4 | 11 | 11 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.147.0-alpha.6.6 | 5 | 5 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.148.0-alpha.15 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.153.0 | 14 | 14 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.153.4 | 8 | 8 | 1 | 0 | 0 | 0 |
| session_meta | `cli_version` | 0.155.0-alpha.16.3 | 5 | 3 | 1 | 2 | 0 | 0 |
| session_meta | `cli_version` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.42.0 | 6 | 6 | 3 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.137.0-alpha.4 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.140.0-alpha.2 | 3 | 3 | 2 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.142.0-alpha.1 | 2 | 2 | 2 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.142.0-alpha.6 | 4 | 4 | 1 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.142.5 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.144.0-alpha.4 | 11 | 11 | 2 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.147.0-alpha.6.6 | 5 | 5 | 1 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.148.0-alpha.15 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.153.0 | 14 | 14 | 4 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.153.4 | 8 | 8 | 1 | 0 | 0 | 0 |
| session_meta | `cwd` | 0.155.0-alpha.16.3 | 5 | 3 | 1 | 2 | 0 | 0 |
| session_meta | `cwd` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.42.0 | 5 | 5 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.137.0-alpha.4 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.140.0-alpha.2 | 3 | 3 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.142.0-alpha.1 | 2 | 2 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.142.0-alpha.6 | 4 | 4 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.142.5 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.144.0-alpha.4 | 11 | 11 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.147.0-alpha.6.6 | 5 | 5 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.148.0-alpha.15 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.153.0 | 14 | 14 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.153.4 | 8 | 8 | 1 | 0 | 0 | 0 |
| session_meta | `history_mode` | 0.155.0-alpha.16.3 | 5 | 3 | 2 | 2 | 0 | 0 |
| session_meta | `history_mode` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.42.0 | 5 | 5 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.137.0-alpha.4 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.140.0-alpha.2 | 3 | 3 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.142.0-alpha.1 | 2 | 2 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.142.0-alpha.6 | 4 | 4 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.142.5 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.144.0-alpha.4 | 11 | 11 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.147.0-alpha.6.6 | 5 | 5 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.148.0-alpha.15 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.153.0 | 14 | 14 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.153.4 | 8 | 8 | 1 | 0 | 0 | 0 |
| session_meta | `model_provider` | 0.155.0-alpha.16.3 | 5 | 3 | 1 | 2 | 0 | 0 |
| session_meta | `model_provider` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `multi_agent_version` | 0.147.0-alpha.6.6 | 4 | 4 | 1 | 0 | 0 | 0 |
| session_meta | `multi_agent_version` | 0.153.0 | 12 | 12 | 1 | 0 | 0 | 0 |
| session_meta | `multi_agent_version` | 0.153.4 | 6 | 6 | 1 | 0 | 0 | 0 |
| session_meta | `originator` | 0.42.0 | 6 | 6 | 1 | 0 | 0 | 0 |
| session_meta | `originator` | 0.137.0-alpha.4 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `originator` | 0.140.0-alpha.2 | 3 | 3 | 1 | 0 | 0 | 0 |
| session_meta | `originator` | 0.142.0-alpha.1 | 2 | 2 | 1 | 0 | 0 | 0 |
| session_meta | `originator` | 0.142.0-alpha.6 | 4 | 4 | 1 | 0 | 0 | 0 |
| session_meta | `originator` | 0.142.5 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `originator` | 0.144.0-alpha.4 | 11 | 11 | 2 | 0 | 0 | 0 |
| session_meta | `originator` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `originator` | 0.147.0-alpha.6.6 | 5 | 5 | 1 | 0 | 0 | 0 |
| session_meta | `originator` | 0.148.0-alpha.15 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `originator` | 0.153.0 | 14 | 14 | 2 | 0 | 0 | 0 |
| session_meta | `originator` | 0.153.4 | 8 | 8 | 1 | 0 | 0 | 0 |
| session_meta | `originator` | 0.155.0-alpha.16.3 | 5 | 3 | 1 | 2 | 0 | 0 |
| session_meta | `originator` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `runtime_workspace_roots` | 0.155.0-alpha.16.3 | 5 | 3 | 1 | 2 | 0 | 0 |
| session_meta | `runtime_workspace_roots` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `source` | 0.42.0 | 5 | 5 | 1 | 0 | 0 | 0 |
| session_meta | `source` | 0.137.0-alpha.4 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `source` | 0.140.0-alpha.2 | 3 | 3 | 1 | 0 | 0 | 0 |
| session_meta | `source` | 0.142.0-alpha.1 | 2 | 2 | 1 | 0 | 0 | 0 |
| session_meta | `source` | 0.142.0-alpha.6 | 4 | 4 | 1 | 0 | 0 | 0 |
| session_meta | `source` | 0.142.5 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `source` | 0.144.0-alpha.4 | 11 | 11 | 2 | 0 | 0 | 0 |
| session_meta | `source` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `source` | 0.147.0-alpha.6.6 | 5 | 5 | 5 | 0 | 0 | 0 |
| session_meta | `source` | 0.148.0-alpha.15 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `source` | 0.153.0 | 14 | 14 | 13 | 0 | 0 | 0 |
| session_meta | `source` | 0.153.4 | 8 | 8 | 7 | 0 | 0 | 0 |
| session_meta | `source` | 0.155.0-alpha.16.3 | 5 | 3 | 1 | 2 | 0 | 0 |
| session_meta | `source` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `source.subagent.thread_spawn.depth` | 0.147.0-alpha.6.6 | 4 | 4 | 1 | 0 | 0 | 0 |
| session_meta | `source.subagent.thread_spawn.depth` | 0.153.0 | 12 | 12 | 2 | 0 | 0 | 0 |
| session_meta | `source.subagent.thread_spawn.depth` | 0.153.4 | 6 | 6 | 1 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.137.0-alpha.4 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.140.0-alpha.2 | 3 | 3 | 1 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.142.0-alpha.1 | 2 | 2 | 1 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.142.0-alpha.6 | 4 | 4 | 1 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.142.5 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.144.0-alpha.4 | 11 | 11 | 1 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.147.0-alpha.6.6 | 5 | 5 | 2 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.148.0-alpha.15 | 1 | 1 | 1 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.153.0 | 14 | 14 | 2 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.153.4 | 8 | 8 | 2 | 0 | 0 | 0 |
| session_meta | `thread_source` | 0.155.0-alpha.16.3 | 5 | 3 | 1 | 2 | 0 | 0 |
| session_meta | `thread_source` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| thread_settings_applied | `active_permission_profile` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `active_permission_profile` | 0.142.0-alpha.6 | 193 | 1 | 2 | 191 | 1 | 1 |
| thread_settings_applied | `active_permission_profile` | 0.142.5 | 16 | 1 | 2 | 13 | 2 | 1 |
| thread_settings_applied | `active_permission_profile` | 0.144.0-alpha.4 | 70 | 8 | 2 | 61 | 1 | 1 |
| thread_settings_applied | `active_permission_profile` | 0.147.0-alpha.6.6 | 64 | 1 | 1 | 63 | 0 | 0 |
| thread_settings_applied | `active_permission_profile` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `active_permission_profile` | 0.153.0 | 35 | 14 | 1 | 21 | 0 | 0 |
| thread_settings_applied | `active_permission_profile` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `active_permission_profile` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `active_permission_profile.id` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `active_permission_profile.id` | 0.142.0-alpha.6 | 193 | 1 | 2 | 191 | 1 | 1 |
| thread_settings_applied | `active_permission_profile.id` | 0.142.5 | 16 | 1 | 2 | 13 | 2 | 1 |
| thread_settings_applied | `active_permission_profile.id` | 0.144.0-alpha.4 | 70 | 8 | 2 | 61 | 1 | 1 |
| thread_settings_applied | `active_permission_profile.id` | 0.147.0-alpha.6.6 | 64 | 1 | 1 | 63 | 0 | 0 |
| thread_settings_applied | `active_permission_profile.id` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `active_permission_profile.id` | 0.153.0 | 35 | 14 | 1 | 21 | 0 | 0 |
| thread_settings_applied | `active_permission_profile.id` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `active_permission_profile.id` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `approval_policy` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `approval_policy` | 0.142.0-alpha.6 | 193 | 1 | 2 | 191 | 1 | 1 |
| thread_settings_applied | `approval_policy` | 0.142.5 | 16 | 1 | 2 | 13 | 2 | 1 |
| thread_settings_applied | `approval_policy` | 0.144.0-alpha.4 | 70 | 8 | 1 | 62 | 0 | 0 |
| thread_settings_applied | `approval_policy` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `approval_policy` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `approval_policy` | 0.153.0 | 35 | 14 | 1 | 21 | 0 | 0 |
| thread_settings_applied | `approval_policy` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `approval_policy` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `approvals_reviewer` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `approvals_reviewer` | 0.142.0-alpha.6 | 193 | 1 | 1 | 192 | 0 | 0 |
| thread_settings_applied | `approvals_reviewer` | 0.142.5 | 16 | 1 | 1 | 15 | 0 | 0 |
| thread_settings_applied | `approvals_reviewer` | 0.144.0-alpha.4 | 70 | 8 | 1 | 62 | 0 | 0 |
| thread_settings_applied | `approvals_reviewer` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `approvals_reviewer` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `approvals_reviewer` | 0.153.0 | 35 | 14 | 1 | 21 | 0 | 0 |
| thread_settings_applied | `approvals_reviewer` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `approvals_reviewer` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `collaboration_mode` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `collaboration_mode` | 0.142.0-alpha.6 | 193 | 1 | 4 | 189 | 3 | 1 |
| thread_settings_applied | `collaboration_mode` | 0.142.5 | 16 | 1 | 3 | 13 | 2 | 1 |
| thread_settings_applied | `collaboration_mode` | 0.144.0-alpha.4 | 70 | 8 | 2 | 61 | 1 | 1 |
| thread_settings_applied | `collaboration_mode` | 0.147.0-alpha.6.6 | 198 | 1 | 3 | 191 | 6 | 1 |
| thread_settings_applied | `collaboration_mode` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `collaboration_mode` | 0.153.0 | 35 | 14 | 6 | 17 | 4 | 1 |
| thread_settings_applied | `collaboration_mode` | 0.153.4 | 50 | 8 | 3 | 40 | 2 | 1 |
| thread_settings_applied | `collaboration_mode` | 0.155.0-alpha.16.3 | 89 | 2 | 2 | 86 | 1 | 1 |
| thread_settings_applied | `collaboration_mode.mode` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.mode` | 0.142.0-alpha.6 | 193 | 1 | 1 | 192 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.mode` | 0.142.5 | 16 | 1 | 1 | 15 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.mode` | 0.144.0-alpha.4 | 70 | 8 | 1 | 62 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.mode` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.mode` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.mode` | 0.153.0 | 35 | 14 | 1 | 21 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.mode` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.mode` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings` | 0.142.0-alpha.6 | 193 | 1 | 4 | 189 | 3 | 1 |
| thread_settings_applied | `collaboration_mode.settings` | 0.142.5 | 16 | 1 | 3 | 13 | 2 | 1 |
| thread_settings_applied | `collaboration_mode.settings` | 0.144.0-alpha.4 | 70 | 8 | 2 | 61 | 1 | 1 |
| thread_settings_applied | `collaboration_mode.settings` | 0.147.0-alpha.6.6 | 198 | 1 | 3 | 191 | 6 | 1 |
| thread_settings_applied | `collaboration_mode.settings` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings` | 0.153.0 | 35 | 14 | 6 | 17 | 4 | 1 |
| thread_settings_applied | `collaboration_mode.settings` | 0.153.4 | 50 | 8 | 3 | 40 | 2 | 1 |
| thread_settings_applied | `collaboration_mode.settings` | 0.155.0-alpha.16.3 | 89 | 2 | 2 | 86 | 1 | 1 |
| thread_settings_applied | `collaboration_mode.settings.model` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings.model` | 0.142.0-alpha.6 | 193 | 1 | 2 | 191 | 1 | 1 |
| thread_settings_applied | `collaboration_mode.settings.model` | 0.142.5 | 16 | 1 | 2 | 14 | 1 | 1 |
| thread_settings_applied | `collaboration_mode.settings.model` | 0.144.0-alpha.4 | 70 | 8 | 2 | 61 | 1 | 1 |
| thread_settings_applied | `collaboration_mode.settings.model` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings.model` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings.model` | 0.153.0 | 35 | 14 | 2 | 20 | 1 | 1 |
| thread_settings_applied | `collaboration_mode.settings.model` | 0.153.4 | 50 | 8 | 2 | 40 | 2 | 1 |
| thread_settings_applied | `collaboration_mode.settings.model` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | 0.142.0-alpha.6 | 193 | 1 | 3 | 189 | 3 | 1 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | 0.142.5 | 16 | 1 | 1 | 15 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | 0.144.0-alpha.4 | 70 | 8 | 1 | 62 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | 0.153.0 | 35 | 14 | 3 | 18 | 3 | 1 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | 0.155.0-alpha.16.3 | 89 | 2 | 2 | 86 | 1 | 1 |
| thread_settings_applied | `cwd` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `cwd` | 0.142.0-alpha.6 | 193 | 1 | 1 | 192 | 0 | 0 |
| thread_settings_applied | `cwd` | 0.142.5 | 16 | 1 | 2 | 13 | 2 | 1 |
| thread_settings_applied | `cwd` | 0.144.0-alpha.4 | 70 | 8 | 2 | 62 | 0 | 0 |
| thread_settings_applied | `cwd` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `cwd` | 0.148.0-alpha.15 | 4 | 1 | 2 | 2 | 1 | 1 |
| thread_settings_applied | `cwd` | 0.153.0 | 35 | 14 | 4 | 20 | 1 | 1 |
| thread_settings_applied | `cwd` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `cwd` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `disabled_plugin_ids` | 0.153.0 | 22 | 3 | 1 | 19 | 0 | 0 |
| thread_settings_applied | `disabled_plugin_ids` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `model` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `model` | 0.142.0-alpha.6 | 193 | 1 | 2 | 191 | 1 | 1 |
| thread_settings_applied | `model` | 0.142.5 | 16 | 1 | 2 | 14 | 1 | 1 |
| thread_settings_applied | `model` | 0.144.0-alpha.4 | 70 | 8 | 2 | 61 | 1 | 1 |
| thread_settings_applied | `model` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `model` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `model` | 0.153.0 | 35 | 14 | 2 | 20 | 1 | 1 |
| thread_settings_applied | `model` | 0.153.4 | 50 | 8 | 2 | 40 | 2 | 1 |
| thread_settings_applied | `model` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `model_provider_id` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `model_provider_id` | 0.142.0-alpha.6 | 193 | 1 | 1 | 192 | 0 | 0 |
| thread_settings_applied | `model_provider_id` | 0.142.5 | 16 | 1 | 1 | 15 | 0 | 0 |
| thread_settings_applied | `model_provider_id` | 0.144.0-alpha.4 | 70 | 8 | 1 | 62 | 0 | 0 |
| thread_settings_applied | `model_provider_id` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `model_provider_id` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `model_provider_id` | 0.153.0 | 35 | 14 | 1 | 21 | 0 | 0 |
| thread_settings_applied | `model_provider_id` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `model_provider_id` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `permission_profile` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `permission_profile` | 0.142.0-alpha.6 | 193 | 1 | 2 | 191 | 1 | 1 |
| thread_settings_applied | `permission_profile` | 0.142.5 | 16 | 1 | 2 | 13 | 2 | 1 |
| thread_settings_applied | `permission_profile` | 0.144.0-alpha.4 | 70 | 8 | 2 | 61 | 1 | 1 |
| thread_settings_applied | `permission_profile` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `permission_profile` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `permission_profile` | 0.153.0 | 35 | 14 | 1 | 21 | 0 | 0 |
| thread_settings_applied | `permission_profile` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `permission_profile` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `permission_profile.file_system.type` | 0.142.0-alpha.6 | 190 | 1 | 1 | 189 | 0 | 0 |
| thread_settings_applied | `permission_profile.file_system.type` | 0.142.5 | 1 | 1 | 1 | 0 | 0 | 0 |
| thread_settings_applied | `permission_profile.file_system.type` | 0.144.0-alpha.4 | 1 | 1 | 1 | 0 | 0 | 0 |
| thread_settings_applied | `permission_profile.type` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `permission_profile.type` | 0.142.0-alpha.6 | 193 | 1 | 2 | 191 | 1 | 1 |
| thread_settings_applied | `permission_profile.type` | 0.142.5 | 16 | 1 | 2 | 13 | 2 | 1 |
| thread_settings_applied | `permission_profile.type` | 0.144.0-alpha.4 | 70 | 8 | 2 | 61 | 1 | 1 |
| thread_settings_applied | `permission_profile.type` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `permission_profile.type` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `permission_profile.type` | 0.153.0 | 35 | 14 | 1 | 21 | 0 | 0 |
| thread_settings_applied | `permission_profile.type` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `permission_profile.type` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `personality` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `personality` | 0.142.0-alpha.6 | 193 | 1 | 1 | 192 | 0 | 0 |
| thread_settings_applied | `personality` | 0.142.5 | 16 | 1 | 1 | 15 | 0 | 0 |
| thread_settings_applied | `personality` | 0.144.0-alpha.4 | 70 | 8 | 1 | 62 | 0 | 0 |
| thread_settings_applied | `personality` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `personality` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `personality` | 0.153.0 | 35 | 14 | 1 | 21 | 0 | 0 |
| thread_settings_applied | `personality` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `personality` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `reasoning_effort` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `reasoning_effort` | 0.142.0-alpha.6 | 193 | 1 | 3 | 189 | 3 | 1 |
| thread_settings_applied | `reasoning_effort` | 0.142.5 | 16 | 1 | 1 | 15 | 0 | 0 |
| thread_settings_applied | `reasoning_effort` | 0.144.0-alpha.4 | 70 | 8 | 1 | 62 | 0 | 0 |
| thread_settings_applied | `reasoning_effort` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `reasoning_effort` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `reasoning_effort` | 0.153.0 | 35 | 14 | 3 | 18 | 3 | 1 |
| thread_settings_applied | `reasoning_effort` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `reasoning_effort` | 0.155.0-alpha.16.3 | 89 | 2 | 2 | 86 | 1 | 1 |
| thread_settings_applied | `reasoning_summary` | 0.142.0-alpha.1 | 9 | 1 | 1 | 8 | 0 | 0 |
| thread_settings_applied | `reasoning_summary` | 0.142.0-alpha.6 | 193 | 1 | 1 | 192 | 0 | 0 |
| thread_settings_applied | `reasoning_summary` | 0.142.5 | 14 | 1 | 1 | 13 | 0 | 0 |
| thread_settings_applied | `reasoning_summary` | 0.144.0-alpha.4 | 70 | 8 | 1 | 62 | 0 | 0 |
| thread_settings_applied | `reasoning_summary` | 0.147.0-alpha.6.6 | 198 | 1 | 2 | 143 | 54 | 1 |
| thread_settings_applied | `reasoning_summary` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `reasoning_summary` | 0.153.0 | 35 | 14 | 2 | 20 | 1 | 1 |
| thread_settings_applied | `reasoning_summary` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `reasoning_summary` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| thread_settings_applied | `runtime_workspace_roots` | 0.153.0 | 1 | 1 | 1 | 0 | 0 | 0 |
| thread_settings_applied | `runtime_workspace_roots` | 0.155.0-alpha.16.3 | 89 | 2 | 2 | 86 | 1 | 1 |
| thread_settings_applied | `service_tier` | 0.142.0-alpha.1 | 9 | 1 | 2 | 7 | 1 | 1 |
| thread_settings_applied | `service_tier` | 0.142.0-alpha.6 | 193 | 1 | 1 | 192 | 0 | 0 |
| thread_settings_applied | `service_tier` | 0.142.5 | 16 | 1 | 1 | 15 | 0 | 0 |
| thread_settings_applied | `service_tier` | 0.144.0-alpha.4 | 70 | 8 | 1 | 62 | 0 | 0 |
| thread_settings_applied | `service_tier` | 0.147.0-alpha.6.6 | 198 | 1 | 1 | 197 | 0 | 0 |
| thread_settings_applied | `service_tier` | 0.148.0-alpha.15 | 4 | 1 | 1 | 3 | 0 | 0 |
| thread_settings_applied | `service_tier` | 0.153.0 | 35 | 14 | 1 | 21 | 0 | 0 |
| thread_settings_applied | `service_tier` | 0.153.4 | 50 | 8 | 1 | 42 | 0 | 0 |
| thread_settings_applied | `service_tier` | 0.155.0-alpha.16.3 | 89 | 2 | 1 | 87 | 0 | 0 |
| turn_context | `active_permission_profile` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `active_permission_profile` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `active_permission_profile` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `active_permission_profile.id` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `active_permission_profile.id` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `active_permission_profile.id` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `approval_policy` | 0.42.0 | 12 | 4 | 1 | 8 | 0 | 0 |
| turn_context | `approval_policy` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `approval_policy` | 0.140.0-alpha.2 | 91 | 3 | 2 | 87 | 1 | 1 |
| turn_context | `approval_policy` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `approval_policy` | 0.142.0-alpha.6 | 249 | 4 | 2 | 243 | 2 | 1 |
| turn_context | `approval_policy` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `approval_policy` | 0.144.0-alpha.4 | 77 | 11 | 1 | 66 | 0 | 0 |
| turn_context | `approval_policy` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `approval_policy` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `approval_policy` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `approval_policy` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `approval_policy` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `approval_policy` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `approval_policy` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `approvals_reviewer` | 0.142.0-alpha.1 | 8 | 1 | 1 | 7 | 0 | 0 |
| turn_context | `approvals_reviewer` | 0.142.0-alpha.6 | 212 | 1 | 1 | 211 | 0 | 0 |
| turn_context | `approvals_reviewer` | 0.142.5 | 14 | 1 | 1 | 13 | 0 | 0 |
| turn_context | `approvals_reviewer` | 0.144.0-alpha.4 | 77 | 11 | 1 | 66 | 0 | 0 |
| turn_context | `approvals_reviewer` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `approvals_reviewer` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `approvals_reviewer` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `approvals_reviewer` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `approvals_reviewer` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `approvals_reviewer` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `approvals_reviewer` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `collaboration_mode` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `collaboration_mode` | 0.140.0-alpha.2 | 91 | 3 | 1 | 88 | 0 | 0 |
| turn_context | `collaboration_mode` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `collaboration_mode` | 0.142.0-alpha.6 | 249 | 4 | 3 | 243 | 2 | 1 |
| turn_context | `collaboration_mode` | 0.142.5 | 48 | 1 | 2 | 46 | 1 | 1 |
| turn_context | `collaboration_mode` | 0.144.0-alpha.4 | 77 | 11 | 3 | 65 | 1 | 1 |
| turn_context | `collaboration_mode` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `collaboration_mode` | 0.147.0-alpha.6.6 | 217 | 5 | 5 | 205 | 7 | 1 |
| turn_context | `collaboration_mode` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `collaboration_mode` | 0.153.0 | 43 | 14 | 5 | 27 | 2 | 1 |
| turn_context | `collaboration_mode` | 0.153.4 | 51 | 8 | 3 | 41 | 2 | 1 |
| turn_context | `collaboration_mode` | 0.155.0-alpha.16.3 | 90 | 3 | 2 | 86 | 1 | 1 |
| turn_context | `collaboration_mode` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.140.0-alpha.2 | 91 | 3 | 1 | 88 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.142.0-alpha.6 | 249 | 4 | 1 | 245 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.144.0-alpha.4 | 77 | 11 | 1 | 66 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `collaboration_mode.mode` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `collaboration_mode.settings` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `collaboration_mode.settings` | 0.140.0-alpha.2 | 91 | 3 | 1 | 88 | 0 | 0 |
| turn_context | `collaboration_mode.settings` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `collaboration_mode.settings` | 0.142.0-alpha.6 | 249 | 4 | 3 | 243 | 2 | 1 |
| turn_context | `collaboration_mode.settings` | 0.142.5 | 48 | 1 | 2 | 46 | 1 | 1 |
| turn_context | `collaboration_mode.settings` | 0.144.0-alpha.4 | 77 | 11 | 3 | 65 | 1 | 1 |
| turn_context | `collaboration_mode.settings` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `collaboration_mode.settings` | 0.147.0-alpha.6.6 | 217 | 5 | 5 | 205 | 7 | 1 |
| turn_context | `collaboration_mode.settings` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `collaboration_mode.settings` | 0.153.0 | 43 | 14 | 5 | 27 | 2 | 1 |
| turn_context | `collaboration_mode.settings` | 0.153.4 | 51 | 8 | 3 | 41 | 2 | 1 |
| turn_context | `collaboration_mode.settings` | 0.155.0-alpha.16.3 | 90 | 3 | 2 | 86 | 1 | 1 |
| turn_context | `collaboration_mode.settings` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `collaboration_mode.settings.model` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `collaboration_mode.settings.model` | 0.140.0-alpha.2 | 91 | 3 | 1 | 88 | 0 | 0 |
| turn_context | `collaboration_mode.settings.model` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `collaboration_mode.settings.model` | 0.142.0-alpha.6 | 249 | 4 | 2 | 244 | 1 | 1 |
| turn_context | `collaboration_mode.settings.model` | 0.142.5 | 48 | 1 | 2 | 46 | 1 | 1 |
| turn_context | `collaboration_mode.settings.model` | 0.144.0-alpha.4 | 77 | 11 | 2 | 65 | 1 | 1 |
| turn_context | `collaboration_mode.settings.model` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `collaboration_mode.settings.model` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `collaboration_mode.settings.model` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `collaboration_mode.settings.model` | 0.153.0 | 43 | 14 | 2 | 28 | 1 | 1 |
| turn_context | `collaboration_mode.settings.model` | 0.153.4 | 51 | 8 | 2 | 41 | 2 | 1 |
| turn_context | `collaboration_mode.settings.model` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `collaboration_mode.settings.model` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.140.0-alpha.2 | 91 | 3 | 1 | 88 | 0 | 0 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.142.0-alpha.6 | 249 | 4 | 2 | 244 | 1 | 1 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.144.0-alpha.4 | 77 | 11 | 1 | 66 | 0 | 0 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.147.0-alpha.6.6 | 217 | 5 | 2 | 211 | 1 | 1 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.153.0 | 43 | 14 | 2 | 28 | 1 | 1 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.155.0-alpha.16.3 | 90 | 3 | 2 | 86 | 1 | 1 |
| turn_context | `collaboration_mode.settings.reasoning_effort` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `cwd` | 0.42.0 | 12 | 4 | 3 | 8 | 0 | 0 |
| turn_context | `cwd` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `cwd` | 0.140.0-alpha.2 | 91 | 3 | 2 | 88 | 0 | 0 |
| turn_context | `cwd` | 0.142.0-alpha.1 | 102 | 2 | 2 | 100 | 0 | 0 |
| turn_context | `cwd` | 0.142.0-alpha.6 | 249 | 4 | 1 | 245 | 0 | 0 |
| turn_context | `cwd` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `cwd` | 0.144.0-alpha.4 | 77 | 11 | 2 | 66 | 0 | 0 |
| turn_context | `cwd` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `cwd` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `cwd` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `cwd` | 0.153.0 | 43 | 14 | 2 | 29 | 0 | 0 |
| turn_context | `cwd` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `cwd` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `cwd` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `disabled_plugin_ids` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `disabled_plugin_ids` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `effort` | 0.42.0 | 5 | 2 | 1 | 3 | 0 | 0 |
| turn_context | `effort` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `effort` | 0.140.0-alpha.2 | 91 | 3 | 1 | 88 | 0 | 0 |
| turn_context | `effort` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `effort` | 0.142.0-alpha.6 | 249 | 4 | 2 | 244 | 1 | 1 |
| turn_context | `effort` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `effort` | 0.144.0-alpha.4 | 77 | 11 | 1 | 66 | 0 | 0 |
| turn_context | `effort` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `effort` | 0.147.0-alpha.6.6 | 217 | 5 | 2 | 211 | 1 | 1 |
| turn_context | `effort` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `effort` | 0.153.0 | 43 | 14 | 2 | 28 | 1 | 1 |
| turn_context | `effort` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `effort` | 0.155.0-alpha.16.3 | 90 | 3 | 2 | 86 | 1 | 1 |
| turn_context | `effort` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `file_system_sandbox_policy` | 0.137.0-alpha.4 | 9 | 1 | 2 | 7 | 1 | 1 |
| turn_context | `file_system_sandbox_policy` | 0.140.0-alpha.2 | 21 | 3 | 4 | 15 | 3 | 3 |
| turn_context | `file_system_sandbox_policy` | 0.142.0-alpha.6 | 203 | 1 | 1 | 202 | 0 | 0 |
| turn_context | `file_system_sandbox_policy` | 0.144.0-alpha.4 | 3 | 3 | 2 | 0 | 0 | 0 |
| turn_context | `file_system_sandbox_policy` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `file_system_sandbox_policy` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `file_system_sandbox_policy.kind` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `file_system_sandbox_policy.kind` | 0.140.0-alpha.2 | 21 | 3 | 1 | 18 | 0 | 0 |
| turn_context | `file_system_sandbox_policy.kind` | 0.142.0-alpha.6 | 203 | 1 | 1 | 202 | 0 | 0 |
| turn_context | `file_system_sandbox_policy.kind` | 0.144.0-alpha.4 | 3 | 3 | 1 | 0 | 0 | 0 |
| turn_context | `file_system_sandbox_policy.kind` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `file_system_sandbox_policy.kind` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `model` | 0.42.0 | 12 | 4 | 2 | 8 | 0 | 0 |
| turn_context | `model` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `model` | 0.140.0-alpha.2 | 91 | 3 | 1 | 88 | 0 | 0 |
| turn_context | `model` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `model` | 0.142.0-alpha.6 | 249 | 4 | 2 | 244 | 1 | 1 |
| turn_context | `model` | 0.142.5 | 48 | 1 | 2 | 46 | 1 | 1 |
| turn_context | `model` | 0.144.0-alpha.4 | 77 | 11 | 2 | 65 | 1 | 1 |
| turn_context | `model` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `model` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `model` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `model` | 0.153.0 | 43 | 14 | 2 | 28 | 1 | 1 |
| turn_context | `model` | 0.153.4 | 51 | 8 | 2 | 41 | 2 | 1 |
| turn_context | `model` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `model` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `multi_agent_mode` | 0.142.0-alpha.1 | 25 | 2 | 1 | 23 | 0 | 0 |
| turn_context | `multi_agent_mode` | 0.142.0-alpha.6 | 4 | 1 | 1 | 3 | 0 | 0 |
| turn_context | `multi_agent_mode` | 0.144.0-alpha.4 | 77 | 11 | 1 | 66 | 0 | 0 |
| turn_context | `multi_agent_mode` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.140.0-alpha.2 | 91 | 3 | 1 | 88 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.142.0-alpha.6 | 249 | 4 | 2 | 245 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.144.0-alpha.4 | 77 | 11 | 1 | 66 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `multi_agent_version` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `permission_profile` | 0.137.0-alpha.4 | 9 | 1 | 2 | 7 | 1 | 1 |
| turn_context | `permission_profile` | 0.140.0-alpha.2 | 91 | 3 | 5 | 84 | 4 | 3 |
| turn_context | `permission_profile` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `permission_profile` | 0.142.0-alpha.6 | 249 | 4 | 2 | 243 | 2 | 1 |
| turn_context | `permission_profile` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `permission_profile` | 0.144.0-alpha.4 | 77 | 11 | 3 | 65 | 1 | 1 |
| turn_context | `permission_profile` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `permission_profile` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `permission_profile` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `permission_profile` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `permission_profile` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `permission_profile` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `permission_profile` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `permission_profile.file_system.type` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `permission_profile.file_system.type` | 0.140.0-alpha.2 | 21 | 3 | 1 | 18 | 0 | 0 |
| turn_context | `permission_profile.file_system.type` | 0.142.0-alpha.6 | 203 | 1 | 1 | 202 | 0 | 0 |
| turn_context | `permission_profile.file_system.type` | 0.144.0-alpha.4 | 3 | 3 | 1 | 0 | 0 | 0 |
| turn_context | `permission_profile.file_system.type` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `permission_profile.file_system.type` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `permission_profile.type` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `permission_profile.type` | 0.140.0-alpha.2 | 91 | 3 | 2 | 87 | 1 | 1 |
| turn_context | `permission_profile.type` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `permission_profile.type` | 0.142.0-alpha.6 | 249 | 4 | 2 | 243 | 2 | 1 |
| turn_context | `permission_profile.type` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `permission_profile.type` | 0.144.0-alpha.4 | 77 | 11 | 2 | 65 | 1 | 1 |
| turn_context | `permission_profile.type` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `permission_profile.type` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `permission_profile.type` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `permission_profile.type` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `permission_profile.type` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `permission_profile.type` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `permission_profile.type` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `personality` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `personality` | 0.140.0-alpha.2 | 91 | 3 | 1 | 88 | 0 | 0 |
| turn_context | `personality` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `personality` | 0.142.0-alpha.6 | 249 | 4 | 1 | 245 | 0 | 0 |
| turn_context | `personality` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `personality` | 0.144.0-alpha.4 | 77 | 11 | 1 | 66 | 0 | 0 |
| turn_context | `personality` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `personality` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `personality` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `personality` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `personality` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `personality` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `personality` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `realtime_active` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `realtime_active` | 0.140.0-alpha.2 | 91 | 3 | 1 | 88 | 0 | 0 |
| turn_context | `realtime_active` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `realtime_active` | 0.142.0-alpha.6 | 249 | 4 | 1 | 245 | 0 | 0 |
| turn_context | `realtime_active` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `realtime_active` | 0.144.0-alpha.4 | 77 | 11 | 1 | 66 | 0 | 0 |
| turn_context | `realtime_active` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `realtime_active` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `realtime_active` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `realtime_active` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `realtime_active` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `realtime_active` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `realtime_active` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `sandbox_policy` | 0.42.0 | 12 | 4 | 2 | 8 | 0 | 0 |
| turn_context | `sandbox_policy` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `sandbox_policy` | 0.140.0-alpha.2 | 91 | 3 | 2 | 87 | 1 | 1 |
| turn_context | `sandbox_policy` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `sandbox_policy` | 0.142.0-alpha.6 | 249 | 4 | 2 | 243 | 2 | 1 |
| turn_context | `sandbox_policy` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `sandbox_policy` | 0.144.0-alpha.4 | 77 | 11 | 2 | 65 | 1 | 1 |
| turn_context | `sandbox_policy` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `sandbox_policy` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `sandbox_policy` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `sandbox_policy` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `sandbox_policy` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `sandbox_policy` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `sandbox_policy` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `sandbox_policy.mode` | 0.42.0 | 4 | 1 | 1 | 3 | 0 | 0 |
| turn_context | `sandbox_policy.type` | 0.42.0 | 8 | 3 | 1 | 5 | 0 | 0 |
| turn_context | `sandbox_policy.type` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `sandbox_policy.type` | 0.140.0-alpha.2 | 91 | 3 | 2 | 87 | 1 | 1 |
| turn_context | `sandbox_policy.type` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `sandbox_policy.type` | 0.142.0-alpha.6 | 249 | 4 | 2 | 243 | 2 | 1 |
| turn_context | `sandbox_policy.type` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `sandbox_policy.type` | 0.144.0-alpha.4 | 77 | 11 | 2 | 65 | 1 | 1 |
| turn_context | `sandbox_policy.type` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `sandbox_policy.type` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `sandbox_policy.type` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `sandbox_policy.type` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `sandbox_policy.type` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `sandbox_policy.type` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `sandbox_policy.type` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `sandbox_policy.writable_roots` | 0.142.0-alpha.6 | 203 | 1 | 1 | 202 | 0 | 0 |
| turn_context | `sandbox_policy.writable_roots` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `sandbox_policy.writable_roots` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `summary` | 0.42.0 | 12 | 4 | 2 | 8 | 0 | 0 |
| turn_context | `summary` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `summary` | 0.140.0-alpha.2 | 91 | 3 | 1 | 88 | 0 | 0 |
| turn_context | `summary` | 0.142.0-alpha.1 | 102 | 2 | 1 | 100 | 0 | 0 |
| turn_context | `summary` | 0.142.0-alpha.6 | 249 | 4 | 1 | 245 | 0 | 0 |
| turn_context | `summary` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `summary` | 0.144.0-alpha.4 | 77 | 11 | 1 | 66 | 0 | 0 |
| turn_context | `summary` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `summary` | 0.147.0-alpha.6.6 | 217 | 5 | 1 | 212 | 0 | 0 |
| turn_context | `summary` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `summary` | 0.153.0 | 43 | 14 | 1 | 29 | 0 | 0 |
| turn_context | `summary` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `summary` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `summary` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `workspace_roots` | 0.137.0-alpha.4 | 9 | 1 | 1 | 8 | 0 | 0 |
| turn_context | `workspace_roots` | 0.140.0-alpha.2 | 91 | 3 | 2 | 88 | 0 | 0 |
| turn_context | `workspace_roots` | 0.142.0-alpha.1 | 102 | 2 | 3 | 98 | 2 | 1 |
| turn_context | `workspace_roots` | 0.142.0-alpha.6 | 249 | 4 | 3 | 244 | 1 | 1 |
| turn_context | `workspace_roots` | 0.142.5 | 48 | 1 | 1 | 47 | 0 | 0 |
| turn_context | `workspace_roots` | 0.144.0-alpha.4 | 77 | 11 | 3 | 66 | 0 | 0 |
| turn_context | `workspace_roots` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| turn_context | `workspace_roots` | 0.147.0-alpha.6.6 | 216 | 5 | 3 | 208 | 3 | 1 |
| turn_context | `workspace_roots` | 0.148.0-alpha.15 | 6 | 1 | 1 | 5 | 0 | 0 |
| turn_context | `workspace_roots` | 0.153.0 | 43 | 14 | 3 | 29 | 0 | 0 |
| turn_context | `workspace_roots` | 0.153.4 | 51 | 8 | 1 | 43 | 0 | 0 |
| turn_context | `workspace_roots` | 0.155.0-alpha.16.3 | 90 | 3 | 1 | 87 | 0 | 0 |
| turn_context | `workspace_roots` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| world_state | `full` | 0.142.0-alpha.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| world_state | `full` | 0.142.0-alpha.6 | 51 | 1 | 2 | 30 | 20 | 1 |
| world_state | `full` | 0.142.5 | 3 | 1 | 1 | 2 | 0 | 0 |
| world_state | `full` | 0.144.0-alpha.4 | 17 | 11 | 2 | 2 | 4 | 3 |
| world_state | `full` | 0.145.0-alpha.30 | 1 | 1 | 1 | 0 | 0 | 0 |
| world_state | `full` | 0.147.0-alpha.6.6 | 43 | 5 | 2 | 18 | 20 | 1 |
| world_state | `full` | 0.148.0-alpha.15 | 4 | 1 | 2 | 1 | 2 | 1 |
| world_state | `full` | 0.153.0 | 30 | 14 | 2 | 12 | 4 | 2 |
| world_state | `full` | 0.153.4 | 33 | 8 | 2 | 18 | 7 | 2 |
| world_state | `full` | 0.155.0-alpha.16.3 | 59 | 3 | 2 | 46 | 10 | 1 |
| world_state | `full` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| world_state | `state.collaboration_mode` | 0.142.0-alpha.6 | 36 | 1 | 1 | 35 | 0 | 0 |
| world_state | `state.collaboration_mode` | 0.147.0-alpha.6.6 | 24 | 5 | 2 | 19 | 0 | 0 |
| world_state | `state.collaboration_mode` | 0.148.0-alpha.15 | 2 | 1 | 1 | 1 | 0 | 0 |
| world_state | `state.collaboration_mode` | 0.153.0 | 9 | 7 | 4 | 0 | 2 | 1 |
| world_state | `state.collaboration_mode` | 0.153.4 | 6 | 2 | 3 | 1 | 3 | 1 |
| world_state | `state.collaboration_mode` | 0.155.0-alpha.16.3 | 54 | 3 | 1 | 51 | 0 | 0 |
| world_state | `state.collaboration_mode` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| world_state | `state.collaboration_mode.mode` | 0.147.0-alpha.6.6 | 20 | 1 | 1 | 19 | 0 | 0 |
| world_state | `state.collaboration_mode.mode` | 0.148.0-alpha.15 | 2 | 1 | 1 | 1 | 0 | 0 |
| world_state | `state.collaboration_mode.mode` | 0.153.0 | 3 | 2 | 1 | 1 | 0 | 0 |
| world_state | `state.collaboration_mode.mode` | 0.153.4 | 4 | 2 | 1 | 2 | 0 | 0 |
| world_state | `state.collaboration_mode.mode` | 0.155.0-alpha.16.3 | 54 | 3 | 1 | 51 | 0 | 0 |
| world_state | `state.collaboration_mode.mode` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| world_state | `state.collaboration_mode.model` | 0.147.0-alpha.6.6 | 20 | 1 | 1 | 19 | 0 | 0 |
| world_state | `state.collaboration_mode.model` | 0.148.0-alpha.15 | 2 | 1 | 1 | 1 | 0 | 0 |
| world_state | `state.collaboration_mode.model` | 0.153.0 | 4 | 2 | 2 | 1 | 1 | 1 |
| world_state | `state.collaboration_mode.model` | 0.153.4 | 6 | 2 | 2 | 2 | 2 | 1 |
| world_state | `state.collaboration_mode.model` | 0.155.0-alpha.16.3 | 54 | 3 | 1 | 51 | 0 | 0 |
| world_state | `state.collaboration_mode.model` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| world_state | `state.model` | 0.147.0-alpha.6.6 | 20 | 1 | 1 | 19 | 0 | 0 |
| world_state | `state.model` | 0.148.0-alpha.15 | 2 | 1 | 1 | 1 | 0 | 0 |
| world_state | `state.model` | 0.153.0 | 4 | 2 | 2 | 1 | 1 | 1 |
| world_state | `state.model` | 0.153.4 | 6 | 2 | 2 | 2 | 2 | 1 |
| world_state | `state.model` | 0.155.0-alpha.16.3 | 54 | 3 | 1 | 51 | 0 | 0 |
| world_state | `state.model` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| world_state | `state.multi_agent_mode` | 0.142.0-alpha.6 | 21 | 1 | 1 | 20 | 0 | 0 |
| world_state | `state.multi_agent_mode` | 0.147.0-alpha.6.6 | 22 | 1 | 4 | 18 | 3 | 1 |
| world_state | `state.multi_agent_mode` | 0.148.0-alpha.15 | 2 | 1 | 1 | 1 | 0 | 0 |
| world_state | `state.multi_agent_mode` | 0.153.0 | 16 | 13 | 7 | 0 | 3 | 1 |
| world_state | `state.multi_agent_mode` | 0.153.4 | 12 | 8 | 4 | 1 | 3 | 1 |
| world_state | `state.multi_agent_mode` | 0.155.0-alpha.16.3 | 54 | 3 | 1 | 51 | 0 | 0 |
| world_state | `state.multi_agent_mode` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| world_state | `state.multi_agent_mode.mode` | 0.147.0-alpha.6.6 | 21 | 1 | 2 | 19 | 1 | 1 |
| world_state | `state.multi_agent_mode.mode` | 0.148.0-alpha.15 | 2 | 1 | 1 | 1 | 0 | 0 |
| world_state | `state.multi_agent_mode.mode` | 0.153.0 | 4 | 2 | 2 | 1 | 1 | 1 |
| world_state | `state.multi_agent_mode.mode` | 0.153.4 | 4 | 2 | 1 | 2 | 0 | 0 |
| world_state | `state.multi_agent_mode.mode` | 0.155.0-alpha.16.3 | 54 | 3 | 1 | 51 | 0 | 0 |
| world_state | `state.multi_agent_mode.mode` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |
| world_state | `state.personality` | 0.147.0-alpha.6.6 | 20 | 1 | 1 | 19 | 0 | 0 |
| world_state | `state.personality` | 0.148.0-alpha.15 | 2 | 1 | 1 | 1 | 0 | 0 |
| world_state | `state.personality` | 0.153.0 | 4 | 2 | 3 | 0 | 2 | 1 |
| world_state | `state.personality` | 0.153.4 | 6 | 2 | 3 | 1 | 3 | 1 |
| world_state | `state.personality.model` | 0.147.0-alpha.6.6 | 20 | 1 | 1 | 19 | 0 | 0 |
| world_state | `state.personality.model` | 0.148.0-alpha.15 | 2 | 1 | 1 | 1 | 0 | 0 |
| world_state | `state.personality.model` | 0.153.0 | 4 | 2 | 2 | 1 | 1 | 1 |
| world_state | `state.personality.model` | 0.153.4 | 6 | 2 | 2 | 2 | 2 | 1 |
| world_state | `state.personality.personality` | 0.147.0-alpha.6.6 | 20 | 1 | 1 | 19 | 0 | 0 |
| world_state | `state.personality.personality` | 0.148.0-alpha.15 | 2 | 1 | 1 | 1 | 0 | 0 |
| world_state | `state.personality.personality` | 0.153.0 | 3 | 2 | 1 | 1 | 0 | 0 |
| world_state | `state.personality.personality` | 0.153.4 | 4 | 2 | 1 | 2 | 0 | 0 |
| world_state | `state.realtime` | 0.142.0-alpha.6 | 36 | 1 | 1 | 35 | 0 | 0 |
| world_state | `state.realtime` | 0.147.0-alpha.6.6 | 20 | 1 | 1 | 19 | 0 | 0 |
| world_state | `state.realtime` | 0.148.0-alpha.15 | 2 | 1 | 1 | 1 | 0 | 0 |
| world_state | `state.realtime` | 0.153.0 | 3 | 2 | 1 | 1 | 0 | 0 |
| world_state | `state.realtime` | 0.153.4 | 4 | 2 | 1 | 2 | 0 | 0 |
| world_state | `state.realtime` | 0.155.0-alpha.16.3 | 54 | 3 | 1 | 51 | 0 | 0 |
| world_state | `state.realtime` | 0.157.1 | 1 | 1 | 1 | 0 | 0 | 0 |

#### Value changes of enum-like settings

| Record | Field | Change | Count | Sessions | CLI versions | Examples |
|---|---|---|---:|---:|---|---|
| thread_settings_applied | `active_permission_profile.id` | :danger-full-access → :workspace | 1 | 1 | 0.142.5 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2955` |
| thread_settings_applied | `active_permission_profile.id` | :workspace → :danger-full-access | 3 | 3 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:17038`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2956`<br>`2026/07/12/rollout-2026-07-12T13-10-03-019f574e-af62-7e71-8c6c-d4b7daa83954.jsonl:38` |
| thread_settings_applied | `approval_policy` | never → on-request | 1 | 1 | 0.142.5 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2955` |
| thread_settings_applied | `approval_policy` | on-request → never | 2 | 2 | 0.142.0-alpha.6, 0.142.5 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:17038`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2956` |
| thread_settings_applied | `collaboration_mode.settings.model` | <model-2> → <model-1> | 2 | 2 | 0.142.0-alpha.6, 0.142.5 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1010`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2955` |
| thread_settings_applied | `collaboration_mode.settings.model` | <model-1> → <model-6> | 1 | 1 | 0.144.0-alpha.4 | `2026/07/12/rollout-2026-07-12T15-05-29-019f57b8-4b2a-7530-b1a9-32b3cdc32d09.jsonl:75` |
| thread_settings_applied | `collaboration_mode.settings.model` | <model-1> → <model-3> | 1 | 1 | 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:962` |
| thread_settings_applied | `collaboration_mode.settings.model` | <model-3> → <model-1> | 2 | 2 | 0.153.0, 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:315`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:153` |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | high → xhigh | 1 | 1 | 0.153.0 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:1136` |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | low → xhigh | 1 | 1 | 0.142.0-alpha.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1011` |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | ultra → xhigh | 1 | 1 | 0.153.0 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:885` |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | xhigh → high | 1 | 1 | 0.153.0 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:1135` |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | xhigh → low | 1 | 1 | 0.142.0-alpha.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1010` |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | xhigh → max | 1 | 1 | 0.155.0-alpha.16.3 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:60963` |
| thread_settings_applied | `collaboration_mode.settings.reasoning_effort` | xhigh → ultra | 1 | 1 | 0.142.0-alpha.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:3205` |
| thread_settings_applied | `model` | <model-2> → <model-1> | 2 | 2 | 0.142.0-alpha.6, 0.142.5 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1010`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2955` |
| thread_settings_applied | `model` | <model-1> → <model-6> | 1 | 1 | 0.144.0-alpha.4 | `2026/07/12/rollout-2026-07-12T15-05-29-019f57b8-4b2a-7530-b1a9-32b3cdc32d09.jsonl:75` |
| thread_settings_applied | `model` | <model-1> → <model-3> | 1 | 1 | 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:962` |
| thread_settings_applied | `model` | <model-3> → <model-1> | 2 | 2 | 0.153.0, 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:315`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:153` |
| thread_settings_applied | `permission_profile.type` | disabled → managed | 1 | 1 | 0.142.5 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2955` |
| thread_settings_applied | `permission_profile.type` | managed → disabled | 3 | 3 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:17038`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2956`<br>`2026/07/12/rollout-2026-07-12T13-10-03-019f574e-af62-7e71-8c6c-d4b7daa83954.jsonl:38` |
| thread_settings_applied | `reasoning_effort` | high → xhigh | 1 | 1 | 0.153.0 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:1136` |
| thread_settings_applied | `reasoning_effort` | low → xhigh | 1 | 1 | 0.142.0-alpha.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1011` |
| thread_settings_applied | `reasoning_effort` | ultra → xhigh | 1 | 1 | 0.153.0 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:885` |
| thread_settings_applied | `reasoning_effort` | xhigh → high | 1 | 1 | 0.153.0 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:1135` |
| thread_settings_applied | `reasoning_effort` | xhigh → low | 1 | 1 | 0.142.0-alpha.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1010` |
| thread_settings_applied | `reasoning_effort` | xhigh → max | 1 | 1 | 0.155.0-alpha.16.3 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:60963` |
| thread_settings_applied | `reasoning_effort` | xhigh → ultra | 1 | 1 | 0.142.0-alpha.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:3205` |
| thread_settings_applied | `reasoning_summary` | detailed → none | 27 | 1 | 0.147.0-alpha.6.6 | `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:10729`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:12323`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:3674` |
| thread_settings_applied | `reasoning_summary` | none → detailed | 28 | 2 | 0.147.0-alpha.6.6, 0.153.0 | `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:10623`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:11446`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:12423` |
| thread_settings_applied | `runtime_workspace_roots` | 1 entry → 1 entry | 1 | 1 | 0.155.0-alpha.16.3 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:64304` |
| thread_settings_applied | `service_tier` | default → priority | 1 | 1 | 0.142.0-alpha.1 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:387` |
| turn_context | `approval_policy` | never → on-request | 1 | 1 | 0.142.0-alpha.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1007` |
| turn_context | `approval_policy` | on-request → never | 2 | 2 | 0.140.0-alpha.2, 0.142.0-alpha.6 | `2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:318`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:17479` |
| turn_context | `collaboration_mode.settings.model` | <model-2> → <model-1> | 2 | 2 | 0.142.0-alpha.6, 0.142.5 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1034`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2964` |
| turn_context | `collaboration_mode.settings.model` | <model-1> → <model-6> | 1 | 1 | 0.144.0-alpha.4 | `2026/07/12/rollout-2026-07-12T15-05-29-019f57b8-4b2a-7530-b1a9-32b3cdc32d09.jsonl:79` |
| turn_context | `collaboration_mode.settings.model` | <model-1> → <model-3> | 1 | 1 | 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:970` |
| turn_context | `collaboration_mode.settings.model` | <model-3> → <model-1> | 2 | 2 | 0.153.0, 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:323`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:163` |
| turn_context | `collaboration_mode.settings.reasoning_effort` | ultra → xhigh | 1 | 1 | 0.153.0 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:891` |
| turn_context | `collaboration_mode.settings.reasoning_effort` | xhigh → max | 1 | 1 | 0.155.0-alpha.16.3 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:64307` |
| turn_context | `collaboration_mode.settings.reasoning_effort` | xhigh → ultra | 2 | 2 | 0.142.0-alpha.6, 0.147.0-alpha.6.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:3208`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:244` |
| turn_context | `effort` | ultra → xhigh | 1 | 1 | 0.153.0 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:891` |
| turn_context | `effort` | xhigh → max | 1 | 1 | 0.155.0-alpha.16.3 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:64307` |
| turn_context | `effort` | xhigh → ultra | 2 | 2 | 0.142.0-alpha.6, 0.147.0-alpha.6.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:3208`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:244` |
| turn_context | `model` | <model-2> → <model-1> | 2 | 2 | 0.142.0-alpha.6, 0.142.5 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1034`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2964` |
| turn_context | `model` | <model-1> → <model-6> | 1 | 1 | 0.144.0-alpha.4 | `2026/07/12/rollout-2026-07-12T15-05-29-019f57b8-4b2a-7530-b1a9-32b3cdc32d09.jsonl:79` |
| turn_context | `model` | <model-1> → <model-3> | 1 | 1 | 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:970` |
| turn_context | `model` | <model-3> → <model-1> | 2 | 2 | 0.153.0, 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:323`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:163` |
| turn_context | `permission_profile.type` | disabled → managed | 1 | 1 | 0.142.0-alpha.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1007` |
| turn_context | `permission_profile.type` | managed → disabled | 3 | 3 | 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4 | `2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:318`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:17479`<br>`2026/07/12/rollout-2026-07-12T13-10-03-019f574e-af62-7e71-8c6c-d4b7daa83954.jsonl:43` |
| turn_context | `sandbox_policy.type` | danger-full-access → workspace-write | 1 | 1 | 0.142.0-alpha.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1007` |
| turn_context | `sandbox_policy.type` | workspace-write → danger-full-access | 3 | 3 | 0.140.0-alpha.2, 0.142.0-alpha.6, 0.144.0-alpha.4 | `2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:318`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:17479`<br>`2026/07/12/rollout-2026-07-12T13-10-03-019f574e-af62-7e71-8c6c-d4b7daa83954.jsonl:43` |
| turn_context | `workspace_roots` | 1 entry → 1 entry | 2 | 1 | 0.142.0-alpha.1 | `2026/06/20/rollout-2026-06-20T01-50-17-019ee394-6258-7a11-b494-7f4f3de1b63c.jsonl:107`<br>`2026/06/20/rollout-2026-06-20T01-50-17-019ee394-6258-7a11-b494-7f4f3de1b63c.jsonl:2718` |
| turn_context | `workspace_roots` | 1 entry → 3 entries | 1 | 1 | 0.142.0-alpha.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1007` |
| turn_context | `workspace_roots` | 2 entries → 2 entries | 1 | 1 | 0.147.0-alpha.6.6 | `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:7434` |
| turn_context | `workspace_roots` | 2 entries → 3 entries | 1 | 1 | 0.147.0-alpha.6.6 | `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:7749` |
| turn_context | `workspace_roots` | 3 entries → 2 entries | 1 | 1 | 0.147.0-alpha.6.6 | `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:12427` |
| world_state | `full` | false → true | 31 | 7 | 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:10266`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:13027`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:14730` |
| world_state | `full` | true → false | 36 | 11 | 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:10068`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:12859`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:14560` |
| world_state | `state.apps_instructions` | false → true | 2 | 2 | 0.153.0, 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:322`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:162` |
| world_state | `state.apps_instructions` | true → false | 1 | 1 | 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:969` |
| world_state | `state.collaboration_mode.model` | <model-1> → <model-3> | 1 | 1 | 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:969` |
| world_state | `state.collaboration_mode.model` | <model-3> → <model-1> | 2 | 2 | 0.153.0, 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:322`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:162` |
| world_state | `state.model` | <model-1> → <model-3> | 1 | 1 | 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:969` |
| world_state | `state.model` | <model-3> → <model-1> | 2 | 2 | 0.153.0, 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:322`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:162` |
| world_state | `state.multi_agent_mode.mode` | explicitRequestOnly → proactive | 1 | 1 | 0.147.0-alpha.6.6 | `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:243` |
| world_state | `state.multi_agent_mode.mode` | proactive → explicitRequestOnly | 1 | 1 | 0.153.0 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:890` |
| world_state | `state.personality.model` | <model-1> → <model-3> | 1 | 1 | 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:969` |
| world_state | `state.personality.model` | <model-3> → <model-1> | 2 | 2 | 0.153.0, 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:322`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:162` |
| world_state | `state.plugins_instructions` | false → true | 2 | 2 | 0.153.0, 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:322`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:162` |
| world_state | `state.plugins_instructions` | true → false | 1 | 1 | 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:969` |

### C. `thread_settings_applied` and `turn_context`

Each `thread_settings_applied` is compared with the first `turn_context` after it; later `turn_context` records up to the next `thread_settings_applied` are counted separately. The field pairs below are the candidate equivalents under test (names differ for some):

#### Compared field pairs

| thread_settings_applied (thread_settings) | turn_context |
|---|---|
| `model` | `model` |
| `reasoning_effort` | `effort` |
| `reasoning_summary` | `summary` |
| `approval_policy` | `approval_policy` |
| `approvals_reviewer` | `approvals_reviewer` |
| `sandbox_policy` | `sandbox_policy` |
| `permission_profile` | `permission_profile` |
| `active_permission_profile` | `active_permission_profile` |
| `collaboration_mode` | `collaboration_mode` |
| `personality` | `personality` |
| `service_tier` | `service_tier` |
| `cwd` | `cwd` |
| `disabled_plugin_ids` | `disabled_plugin_ids` |

#### Sessions by record presence

| Records | Sessions | CLI versions |
|---|---:|---|
| both thread_settings_applied and turn_context | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| neither record | 2 | 0.42.0 |
| turn_context only | 22 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.155.0-alpha.16.3, 0.157.1 |

#### Where thread_settings_applied appears

| Position | Count | Sessions | CLI versions |
|---|---:|---:|---|
| before the first turn of the rollout | 21 | 21 | 0.144.0-alpha.4, 0.153.0, 0.153.4 |
| between turns | 580 | 19 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| inside a turn, after its turn_context | 62 | 7 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| inside a turn, before its turn_context | 1 | 1 | 0.147.0-alpha.6.6 |

#### thread_settings_applied thread_id

| Thread | Count | Sessions | CLI versions |
|---|---:|---:|---|
| the rollout's own thread | 174 | 24 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| thread_id missing | 490 | 13 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15 |

#### thread_settings_applied not compared with a turn_context

| What followed | Count | Sessions | CLI versions | Examples |
|---|---:|---:|---|---|
| followed by a different thread_settings_applied before any turn_context | 8 | 6 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.153.0, 0.155.0-alpha.16.3 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1011`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2667`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2956` |
| followed by an identical thread_settings_applied before any turn_context | 50 | 8 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:697`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1026`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:14195` |
| no turn_context after it | 3 | 3 | 0.153.0, 0.155.0-alpha.16.3 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:2133`<br>`2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:76401`<br>`2026/09/28/rollout-2026-09-28T01-12-54-01a0e66e-28b8-7e03-8a56-fd228883a0e2.jsonl:2675` |

#### Next turn_context after a thread_settings_applied, by field pair

| Field pair | Outcome | Count | Sessions | CLI versions | Examples |
|---|---|---:|---:|---|---|
| active_permission_profile ↔ active_permission_profile | agree | 134 | 24 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| active_permission_profile ↔ active_permission_profile | in neither | 133 | 1 | 0.147.0-alpha.6.6 |  |
| active_permission_profile ↔ active_permission_profile | only in thread_settings_applied | 336 | 13 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15 |  |
| approval_policy ↔ approval_policy | agree | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| approvals_reviewer ↔ approvals_reviewer | agree | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| collaboration_mode ↔ collaboration_mode | agree | 601 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| collaboration_mode ↔ collaboration_mode | disagree | 2 | 1 | 0.155.0-alpha.16.3 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:62040`<br>`2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:63488` |
| cwd ↔ cwd | agree | 503 | 28 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| cwd ↔ cwd | disagree | 100 | 11 | 0.142.0-alpha.1, 0.142.5, 0.144.0-alpha.4, 0.148.0-alpha.15, 0.153.0 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:154`<br>`2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:225`<br>`2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:258` |
| disabled_plugin_ids ↔ disabled_plugin_ids | agree | 60 | 2 | 0.155.0-alpha.16.3 |  |
| disabled_plugin_ids ↔ disabled_plugin_ids | in neither | 527 | 32 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 |  |
| disabled_plugin_ids ↔ disabled_plugin_ids | only in thread_settings_applied | 16 | 3 | 0.153.0 |  |
| model ↔ model | agree | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| permission_profile ↔ permission_profile | agree | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| personality ↔ personality | agree | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| reasoning_effort ↔ effort | agree | 601 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| reasoning_effort ↔ effort | disagree | 2 | 1 | 0.155.0-alpha.16.3 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:62040`<br>`2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:63488` |
| reasoning_summary ↔ summary | agree | 60 | 2 | 0.155.0-alpha.16.3 |  |
| reasoning_summary ↔ summary | disagree | 542 | 35 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:154`<br>`2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:225`<br>`2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:258` |
| reasoning_summary ↔ summary | only in turn_context | 1 | 1 | 0.142.5 |  |
| sandbox_policy ↔ sandbox_policy | only in turn_context | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| service_tier ↔ service_tier | only in thread_settings_applied | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |

#### Next turn_context after a thread_settings_applied, by CLI version

| Outcome | CLI version | Count | Sessions | Examples |
|---|---|---:|---:|---|
| at least one field disagrees | 0.142.0-alpha.1 | 8 | 1 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:154`<br>`2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:225`<br>`2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:258` |
| at least one field disagrees | 0.142.0-alpha.6 | 180 | 1 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:10038`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:10069`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1007` |
| at least one field disagrees | 0.142.5 | 14 | 1 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:1928`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2009`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2036` |
| at least one field disagrees | 0.144.0-alpha.4 | 67 | 8 | `2026/07/11/rollout-2026-07-11T01-45-37-019f4fb5-9d9e-7563-9226-9cb7addc2294.jsonl:118`<br>`2026/07/11/rollout-2026-07-11T01-45-37-019f4fb5-9d9e-7563-9226-9cb7addc2294.jsonl:17`<br>`2026/07/11/rollout-2026-07-11T01-45-37-019f4fb5-9d9e-7563-9226-9cb7addc2294.jsonl:204` |
| at least one field disagrees | 0.147.0-alpha.6.6 | 196 | 1 | `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:10045`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:10079`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:1018` |
| at least one field disagrees | 0.148.0-alpha.15 | 4 | 1 | `2026/09/02/rollout-2026-09-02T13-14-17-01a0631d-43f8-7d50-9449-9159105eb3d5.jsonl:543`<br>`2026/09/02/rollout-2026-09-02T13-14-17-01a0631d-43f8-7d50-9449-9159105eb3d5.jsonl:553`<br>`2026/09/02/rollout-2026-09-02T13-14-17-01a0631d-43f8-7d50-9449-9159105eb3d5.jsonl:601` |
| at least one field disagrees | 0.153.0 | 29 | 14 | `2026/09/05/rollout-2026-09-05T23-28-33-01a074c2-b8b8-7e03-813e-87187a43c9f9.jsonl:124`<br>`2026/09/05/rollout-2026-09-05T23-28-33-01a074c2-b8b8-7e03-813e-87187a43c9f9.jsonl:135`<br>`2026/09/05/rollout-2026-09-05T23-28-33-01a074c2-b8b8-7e03-813e-87187a43c9f9.jsonl:257` |
| at least one field disagrees | 0.153.4 | 45 | 8 | `2026/09/06/rollout-2026-09-06T21-07-02-01a07967-8252-7b21-8524-3164700549b1.jsonl:196`<br>`2026/09/06/rollout-2026-09-06T21-07-02-01a07967-8252-7b21-8524-3164700549b1.jsonl:303`<br>`2026/09/06/rollout-2026-09-06T21-07-02-01a07967-8252-7b21-8524-3164700549b1.jsonl:365` |
| at least one field disagrees | 0.155.0-alpha.16.3 | 2 | 1 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:62040`<br>`2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:63488` |
| every compared field agrees | 0.155.0-alpha.16.3 | 58 | 2 |  |

#### Disagreements with the next turn_context: do they persist?

| Field pair | What happened next | Count | Sessions | CLI versions | Examples |
|---|---|---:|---:|---|---|
| collaboration_mode ↔ collaboration_mode | no later turn_context agreed before the next thread_settings_applied | 2 | 1 | 0.155.0-alpha.16.3 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:62041`<br>`2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:63489` |
| cwd ↔ cwd | no later turn_context agreed before the next thread_settings_applied | 91 | 11 | 0.142.0-alpha.1, 0.142.5, 0.144.0-alpha.4, 0.148.0-alpha.15, 0.153.0 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:223`<br>`2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:256`<br>`2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:301` |
| cwd ↔ cwd | no later turn_context agreed before the rollout ended | 9 | 9 | 0.142.0-alpha.1, 0.142.5, 0.144.0-alpha.4, 0.153.0 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:820`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2971`<br>`2026/07/11/rollout-2026-07-11T01-45-37-019f4fb5-9d9e-7563-9226-9cb7addc2294.jsonl:511` |
| reasoning_effort ↔ effort | no later turn_context agreed before the next thread_settings_applied | 2 | 1 | 0.155.0-alpha.16.3 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:62041`<br>`2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:63489` |
| reasoning_summary ↔ summary | no later turn_context agreed before the next thread_settings_applied | 509 | 17 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:223`<br>`2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:256`<br>`2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:301` |
| reasoning_summary ↔ summary | no later turn_context agreed before the rollout ended | 33 | 33 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:820`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:23722`<br>`2026/07/11/rollout-2026-07-11T01-45-37-019f4fb5-9d9e-7563-9226-9cb7addc2294.jsonl:511` |

#### Later turn_context records under the same thread_settings_applied

| Field pair | Outcome | Count | Sessions | CLI versions | Examples |
|---|---|---:|---:|---|---|
| active_permission_profile ↔ active_permission_profile | agree | 44 | 9 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| approval_policy ↔ approval_policy | agree | 94 | 13 | 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| approvals_reviewer ↔ approvals_reviewer | agree | 94 | 13 | 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| collaboration_mode ↔ collaboration_mode | agree | 94 | 13 | 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| cwd ↔ cwd | agree | 92 | 11 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| cwd ↔ cwd | disagree | 2 | 2 | 0.144.0-alpha.4, 0.153.0 | `2026/07/13/rollout-2026-07-13T09-05-23-019f5b94-fb6a-7b13-a333-7353ec95e60f.jsonl:605`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:1301` |
| disabled_plugin_ids ↔ disabled_plugin_ids | agree | 27 | 2 | 0.155.0-alpha.16.3 |  |
| model ↔ model | agree | 94 | 13 | 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| permission_profile ↔ permission_profile | agree | 94 | 13 | 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| personality ↔ personality | agree | 94 | 13 | 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| reasoning_effort ↔ effort | agree | 94 | 13 | 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| reasoning_summary ↔ summary | agree | 27 | 2 | 0.155.0-alpha.16.3 |  |
| reasoning_summary ↔ summary | disagree | 67 | 11 | 0.142.0-alpha.6, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:10267`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:10825`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:11321` |

#### turn_context value changes relative to the previous turn_context

| turn_context field | Since the previous turn_context | Count | Sessions | CLI versions | Examples |
|---|---|---:|---:|---|---|
| approval_policy | a thread_settings_applied came after the previous turn_context | 2 | 1 | 0.142.0-alpha.6 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1007`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:17479` |
| approval_policy | no thread_settings_applied since the previous turn_context | 1 | 1 | 0.140.0-alpha.2 | `2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:318` |
| collaboration_mode | a thread_settings_applied came after the previous turn_context | 16 | 7 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1034`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:3208`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2964` |
| effort | a thread_settings_applied came after the previous turn_context | 4 | 4 | 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.153.0, 0.155.0-alpha.16.3 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:3208`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:244`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:891` |
| model | a thread_settings_applied came after the previous turn_context | 6 | 5 | 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.153.0, 0.153.4 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1034`<br>`2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:2964`<br>`2026/07/12/rollout-2026-07-12T15-05-29-019f57b8-4b2a-7530-b1a9-32b3cdc32d09.jsonl:79` |
| permission_profile | a thread_settings_applied came after the previous turn_context | 3 | 2 | 0.142.0-alpha.6, 0.144.0-alpha.4 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1007`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:17479`<br>`2026/07/12/rollout-2026-07-12T13-10-03-019f574e-af62-7e71-8c6c-d4b7daa83954.jsonl:43` |
| permission_profile | no thread_settings_applied since the previous turn_context | 5 | 4 | 0.137.0-alpha.4, 0.140.0-alpha.2 | `2026/06/06/rollout-2026-06-06T14-58-00-019e9e4c-9940-7da1-8f21-f1df332ced69.jsonl:18`<br>`2026/06/16/rollout-2026-06-16T14-01-51-019ed198-b7bc-73b2-a7a6-2c7bfb6ce744.jsonl:15`<br>`2026/06/16/rollout-2026-06-16T17-20-52-019ed24e-e334-7510-93cf-a4c1006697a0.jsonl:81` |
| sandbox_policy | a thread_settings_applied came after the previous turn_context | 3 | 2 | 0.142.0-alpha.6, 0.144.0-alpha.4 | `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1007`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:17479`<br>`2026/07/12/rollout-2026-07-12T13-10-03-019f574e-af62-7e71-8c6c-d4b7daa83954.jsonl:43` |
| sandbox_policy | no thread_settings_applied since the previous turn_context | 1 | 1 | 0.140.0-alpha.2 | `2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:318` |

#### Fields without a compared counterpart (present at a comparison)

| Record | Field | Count | Sessions | CLI versions |
|---|---|---:|---:|---|
| thread_settings_applied | model_provider_id | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| thread_settings_applied | runtime_workspace_roots | 60 | 2 | 0.155.0-alpha.16.3 |
| turn_context | comp_hash | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | current_date | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | file_system_sandbox_policy | 179 | 2 | 0.142.0-alpha.6, 0.144.0-alpha.4 |
| turn_context | multi_agent_mode | 75 | 9 | 0.142.0-alpha.1, 0.144.0-alpha.4 |
| turn_context | multi_agent_version | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | realtime_active | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | root_turn_id | 134 | 24 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | timezone | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | turn_id | 603 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| turn_context | workspace_roots | 602 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |

#### The same setting twice within one record

| Record | Fields | Outcome | Count | Sessions | CLI versions | Examples |
|---|---|---|---:|---:|---|---|
| thread_settings_applied | model vs collaboration_mode.settings.model | agree | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| thread_settings_applied | reasoning_effort vs collaboration_mode.settings.reasoning_effort | agree | 664 | 37 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |  |
| turn_context | effort vs collaboration_mode.settings.reasoning_effort | agree | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |  |
| turn_context | effort vs collaboration_mode.settings.reasoning_effort | in neither | 7 | 2 | 0.42.0 |  |
| turn_context | effort vs collaboration_mode.settings.reasoning_effort | only in effort | 5 | 2 | 0.42.0 |  |
| turn_context | model vs collaboration_mode.settings.model | agree | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |  |
| turn_context | model vs collaboration_mode.settings.model | only in model | 12 | 4 | 0.42.0 |  |

#### turn_context turn_id

| Relation to turn events | Count | Sessions | CLI versions |
|---|---:|---:|---|
| no turn_id | 8 | 3 | 0.42.0 |
| no turn_id (no turn events in the rollout so far) | 4 | 1 | 0.42.0 |
| turn_id of the open turn | 985 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |

#### turn_context position within its turn

| Position | Count | Sessions | CLI versions |
|---|---:|---:|---|
| after a tool call of its turn | 20 | 5 | 0.142.0-alpha.1, 0.142.0-alpha.6, 0.147.0-alpha.6.6, 0.155.0-alpha.16.3 |
| after tool calls of its turn | 99 | 11 | 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |
| before its turn's first tool call | 874 | 58 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| outside a started turn | 4 | 1 | 0.42.0 |

#### turn_context records per started turn

| Per turn | Turns | Sessions | CLI versions |
|---|---:|---:|---|
| no turn_context | 3 | 3 | 0.42.0 |
| one turn_context | 778 | 55 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| two or more turn_contexts | 88 | 11 | 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3 |

### D. Token usage records

#### token_usage_record by CLI version

| CLI version | Sessions | Records | Per session (min / median / max) |
|---|---:|---:|---:|
| 0.153.0 | 13 | 415 | 1 / 8 / 269 |
| 0.153.4 | 8 | 500 | 1 / 12 / 342 |
| 0.155.0-alpha.16.3 | 3 | 7136 | 1 / 318 / 6817 |
| 0.157.1 | 1 | 9 | 9 / 9 / 9 |

#### Token sources per session

| Sources | Sessions | CLI versions |
|---|---:|---|
| neither | 5 | 0.42.0 |
| token_count only | 31 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0 |
| token_usage_record and token_count | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |

#### Field shapes

| Object | Count | Sessions | CLI versions |
|---|---:|---:|---|
| payload {response_id, root_turn_id, session_id, thread_id, thread_token_usage, turn_id, turn_token_usage, usage} | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| thread_token_usage {cache_write_input_tokens, cached_input_tokens, input_tokens, output_tokens, reasoning_output_tokens, total_tokens} | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| token_count info {last_token_usage, model_context_window, total_token_usage} | 17160 | 56 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| turn_token_usage {cache_write_input_tokens, cached_input_tokens, input_tokens, output_tokens, reasoning_output_tokens, total_tokens} | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| usage {cache_write_input_tokens, cached_input_tokens, input_tokens, output_tokens, reasoning_output_tokens, total_tokens} | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |

#### Field presence in token_usage_record

| Field | Presence | Count | Sessions | CLI versions |
|---|---|---:|---:|---|
| context window field | absent | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| response_id | present | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| root_turn_id | present | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| session_id | present | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| thread_id | present | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| thread_token_usage | present | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| turn_id | present | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| turn_token_usage | present | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| usage | present | 8060 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |

#### Relations between usage objects (checked on every numeric field)

| Relation | Outcome | Records | Sessions | CLI versions | Examples |
|---|---|---:|---:|---|---|
| first record of a turn: turn_token_usage = usage | holds | 129 | 25 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |  |
| first record of the rollout: thread_token_usage = usage | fails | 1 | 1 | 0.153.4 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:14` |
| first record of the rollout: thread_token_usage = usage | holds | 24 | 24 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |  |
| later record of a turn: turn_token_usage = previous turn_token_usage + usage | holds | 7931 | 22 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |  |
| thread_token_usage = previous thread_token_usage + usage | holds | 8035 | 22 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |  |
| thread_token_usage.total_tokens never decreases | holds | 8035 | 22 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |  |

#### compacted.latest_token_usage_record (observed relations only; no compaction sizes are derived)

| Aspect | Observation | Count | Sessions | CLI versions | Examples |
|---|---|---:|---:|---|---|
| next thread_token_usage | latest_token_usage_record thread_token_usage + usage | 55 | 4 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:1060`<br>`2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:1767`<br>`2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:87` |
| next usage.input_tokens | lower than latest_token_usage_record's | 55 | 4 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:1060`<br>`2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:1767`<br>`2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:87` |
| preceding | identical to the preceding token_usage_record | 55 | 4 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:1053`<br>`2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:1756`<br>`2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:76` |
| shape | latest_token_usage_record null | 73 | 8 | 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.148.0-alpha.15 | `2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:1189`<br>`2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:1518`<br>`2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:2224` |
| shape | latest_token_usage_record {response_id, root_turn_id, session_id, thread_id, thread_token_usage, turn_id, turn_token_usage, usage} | 55 | 4 | 0.153.0, 0.153.4, 0.155.0-alpha.16.3 | `2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:1053`<br>`2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:1756`<br>`2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:76` |

### E. Turn lifecycle

#### Lifecycle events and the fields they carry (records with each field)

| Event | CLI version | Records | Sessions | `turn_id` | `started_at` | `completed_at` | `duration_ms` | `time_to_first_token_ms` | `error` | `reason` | `last_agent_message` | `model_context_window` | `collaboration_mode_kind` |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| task_complete | 0.42.0 | 2 | 2 | 2 | 0 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| task_complete | 0.137.0-alpha.4 | 9 | 1 | 9 | 0 | 9 | 9 | 9 | 0 | 0 | 9 | 0 | 0 |
| task_complete | 0.140.0-alpha.2 | 71 | 3 | 71 | 0 | 71 | 71 | 71 | 0 | 0 | 71 | 0 | 0 |
| task_complete | 0.142.0-alpha.1 | 80 | 2 | 80 | 0 | 80 | 80 | 80 | 0 | 0 | 80 | 0 | 0 |
| task_complete | 0.142.0-alpha.6 | 202 | 4 | 202 | 174 | 202 | 202 | 202 | 0 | 0 | 202 | 0 | 0 |
| task_complete | 0.142.5 | 45 | 1 | 45 | 0 | 45 | 45 | 45 | 0 | 0 | 45 | 0 | 0 |
| task_complete | 0.144.0-alpha.4 | 74 | 10 | 74 | 0 | 74 | 74 | 74 | 0 | 0 | 74 | 0 | 0 |
| task_complete | 0.145.0-alpha.30 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| task_complete | 0.147.0-alpha.6.6 | 187 | 2 | 187 | 187 | 187 | 187 | 187 | 0 | 0 | 187 | 0 | 0 |
| task_complete | 0.148.0-alpha.15 | 5 | 1 | 5 | 5 | 5 | 5 | 5 | 2 | 0 | 3 | 0 | 0 |
| task_complete | 0.153.0 | 35 | 12 | 35 | 35 | 35 | 35 | 35 | 1 | 0 | 34 | 0 | 0 |
| task_complete | 0.153.4 | 48 | 8 | 48 | 48 | 48 | 48 | 48 | 16 | 0 | 32 | 0 | 0 |
| task_complete | 0.155.0-alpha.16.3 | 35 | 2 | 35 | 35 | 35 | 35 | 35 | 0 | 0 | 35 | 0 | 0 |
| task_complete | 0.157.1 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| task_started | 0.42.0 | 3 | 3 | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| task_started | 0.137.0-alpha.4 | 9 | 1 | 9 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 9 | 9 |
| task_started | 0.140.0-alpha.2 | 86 | 3 | 86 | 86 | 0 | 0 | 0 | 0 | 0 | 0 | 86 | 86 |
| task_started | 0.142.0-alpha.1 | 97 | 2 | 97 | 97 | 0 | 0 | 0 | 0 | 0 | 0 | 97 | 97 |
| task_started | 0.142.0-alpha.6 | 214 | 4 | 214 | 214 | 0 | 0 | 0 | 0 | 0 | 0 | 214 | 214 |
| task_started | 0.142.5 | 47 | 1 | 47 | 47 | 0 | 0 | 0 | 0 | 0 | 0 | 47 | 47 |
| task_started | 0.144.0-alpha.4 | 76 | 11 | 76 | 76 | 0 | 0 | 0 | 0 | 0 | 0 | 76 | 76 |
| task_started | 0.145.0-alpha.30 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| task_started | 0.147.0-alpha.6.6 | 201 | 5 | 201 | 201 | 0 | 0 | 0 | 0 | 0 | 0 | 201 | 201 |
| task_started | 0.148.0-alpha.15 | 5 | 1 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 | 5 | 5 |
| task_started | 0.153.0 | 42 | 14 | 42 | 42 | 0 | 0 | 0 | 0 | 0 | 0 | 42 | 42 |
| task_started | 0.153.4 | 48 | 8 | 48 | 48 | 0 | 0 | 0 | 0 | 0 | 0 | 48 | 48 |
| task_started | 0.155.0-alpha.16.3 | 39 | 3 | 39 | 39 | 0 | 0 | 0 | 0 | 0 | 0 | 39 | 39 |
| task_started | 0.157.1 | 1 | 1 | 1 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| turn_aborted | 0.42.0 | 2 | 2 | 1 | 0 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 0 |
| turn_aborted | 0.140.0-alpha.2 | 15 | 3 | 15 | 0 | 15 | 15 | 0 | 0 | 15 | 0 | 0 | 0 |
| turn_aborted | 0.142.0-alpha.1 | 13 | 2 | 13 | 0 | 13 | 13 | 0 | 0 | 13 | 0 | 0 | 0 |
| turn_aborted | 0.142.0-alpha.6 | 12 | 3 | 12 | 6 | 12 | 12 | 0 | 0 | 12 | 0 | 0 | 0 |
| turn_aborted | 0.142.5 | 2 | 1 | 2 | 0 | 2 | 2 | 0 | 0 | 2 | 0 | 0 | 0 |
| turn_aborted | 0.144.0-alpha.4 | 1 | 1 | 1 | 0 | 1 | 1 | 0 | 0 | 1 | 0 | 0 | 0 |
| turn_aborted | 0.147.0-alpha.6.6 | 10 | 1 | 10 | 10 | 10 | 10 | 0 | 0 | 10 | 0 | 0 | 0 |
| turn_aborted | 0.153.0 | 7 | 3 | 7 | 7 | 7 | 7 | 0 | 0 | 7 | 0 | 0 | 0 |
| turn_aborted | 0.155.0-alpha.16.3 | 4 | 2 | 4 | 4 | 4 | 4 | 0 | 0 | 4 | 0 | 0 | 0 |

#### Lifecycle values (enum-like fields; error shapes without messages)

| Event | Value | Count | Sessions | CLI versions | Examples |
|---|---|---:|---:|---|---|
| task_complete | error {codex_error_info, message} · codex_error_info usage_limit_exceeded | 19 | 6 | 0.148.0-alpha.15, 0.153.0, 0.153.4 | `2026/09/02/rollout-2026-09-02T13-14-17-01a0631d-43f8-7d50-9449-9159105eb3d5.jsonl:538`<br>`2026/09/02/rollout-2026-09-02T13-14-17-01a0631d-43f8-7d50-9449-9159105eb3d5.jsonl:874`<br>`2026/09/06/rollout-2026-09-06T21-07-02-01a07967-8252-7b21-8524-3164700549b1.jsonl:190` |
| task_started | collaboration_mode_kind default | 869 | 58 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |  |
| turn_aborted | reason interrupted | 66 | 18 | 0.42.0, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.147.0-alpha.6.6, 0.153.0, 0.155.0-alpha.16.3 |  |

#### Turn pairing by turn_id

| Turn | Count | Sessions | CLI versions |
|---|---:|---:|---|
| last turn of the rollout, not ended | 4 | 4 | 0.144.0-alpha.4, 0.147.0-alpha.6.6 |
| started and ended (complete or aborted) | 860 | 54 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| started, not ended, before a later turn started | 5 | 2 | 0.142.0-alpha.1, 0.147.0-alpha.6.6 |
| turn_aborted without turn_id (not paired) | 1 | 1 | 0.42.0 |

### F. Subagent relationships

Joins are attempted only among the surveyed rollouts; a child whose parent rollout was not surveyed cannot be matched. Kinds: exact shared ID (both records carry the same identifier), deterministic structural relationship (equal values that are names, not ids), temporal association only (time order; never an identity). A method with no match in this corpus is unresolved here.

#### Sessions by kind

| Kind | Sessions | CLI versions |
|---|---:|---|
| child (session_meta.parent_thread_id) | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| child whose parent rollout was surveyed | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| root (no parent_thread_id) | 39 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| session_meta.session_id = own id | 38 | 0.42.0, 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| session_meta.session_id ≠ own id | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| thread id shared with another surveyed rollout | 2 | 0.153.4 |
| thread_source subagent | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| thread_source user | 33 | 0.137.0-alpha.4, 0.140.0-alpha.2, 0.142.0-alpha.1, 0.142.0-alpha.6, 0.142.5, 0.144.0-alpha.4, 0.145.0-alpha.30, 0.147.0-alpha.6.6, 0.148.0-alpha.15, 0.153.0, 0.153.4, 0.155.0-alpha.16.3, 0.157.1 |
| with forked_from_id | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| with source.subagent.thread_spawn | 22 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |

#### Join methods

| Method | Kind | Records with the key | Matched one surveyed rollout | Not among the surveyed rollouts | Matched several | Agrees with the declared parent | Contradicts it | Status here |
|---|---|---:|---:|---:|---:|---:|---:|---|
| child session_meta.parent_thread_id → parent session_meta.id | exact shared ID | 22 | 10 | 0 | 12 | 0 | 0 | joins |
| child session_meta.forked_from_id → parent session_meta.id | exact shared ID | 22 | 10 | 0 | 12 | 10 | 0 | joins |
| child source.subagent.thread_spawn.parent_thread_id → parent session_meta.id | exact shared ID | 22 | 10 | 0 | 12 | 10 | 0 | joins |
| child session_meta.session_id (≠ own id) → surveyed session_meta.id | exact shared ID | 22 | 10 | 0 | 12 | 9 | 1 | joins |
| parent SubAgentActivity.agent_thread_id → child session_meta.id | exact shared ID | 110 | 93 | 0 | 17 | 84 | 2 | joins |
| parent collaboration call output contains → child session_meta.id | exact shared ID | 0 | 0 | 0 | 0 | 0 | 0 | no records |
| parent CollabAgentToolCall.receiver_thread_ids → child session_meta.id | exact shared ID | 0 | 0 | 0 | 0 | 0 | 0 | no records |
| parent SubAgentActivity.agent_path = child session_meta.agent_path (among children declaring this parent) | deterministic structural relationship | 110 | 84 | 26 | 0 | 84 | 0 | joins |

#### Children with a surveyed parent: methods that reach the declared parent

| Methods | Children | Sessions | CLI versions |
|---|---:|---:|---|
| SubAgentActivity.agent_thread_id | 12 | 12 | 0.153.0, 0.153.4 |
| SubAgentActivity.agent_thread_id + forked_from_id + parent_thread_id + thread_spawn.parent_thread_id | 10 | 10 | 0.147.0-alpha.6.6, 0.153.0 |

#### SubAgentActivity kinds and id forms (parent side)

| Kind | Id form | Count | Sessions | CLI versions | Examples |
|---|---|---:|---:|---|---|
| completed | embeds a UUID that is not a surveyed thread id | 27 | 5 | 0.153.0, 0.153.4 | `2026/09/05/rollout-2026-09-05T23-28-33-01a074c2-b8b8-7e03-813e-87187a43c9f9.jsonl:110`<br>`2026/09/05/rollout-2026-09-05T23-28-33-01a074c2-b8b8-7e03-813e-87187a43c9f9.jsonl:99`<br>`2026/09/05/rollout-2026-09-05T23-28-51-01a074c2-ff7d-71f0-b2d2-c755f68839a4.jsonl:123` |
| interacted | equals the call_id of collaboration.followup_task | 13 | 2 | 0.153.4 | `2026/09/06/rollout-2026-09-06T21-07-02-01a07967-8252-7b21-8524-3164700549b1.jsonl:543`<br>`2026/09/06/rollout-2026-09-06T21-07-02-01a07967-8252-7b21-8524-3164700549b1.jsonl:715`<br>`2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:1023` |
| interacted | equals the call_id of collaboration.send_message | 43 | 21 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:7447`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:7572`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:7664` |
| interrupted | equals the call_id of collaboration.interrupt_agent | 5 | 2 | 0.147.0-alpha.6.6, 0.153.0 | `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:7546`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:7794`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:7798` |
| started | equals the call_id of collaboration.spawn_agent | 22 | 6 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 | `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:7384`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:7389`<br>`2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl:7394` |

#### Collaboration calls (own history)

| Tool | Output | Count | Sessions | CLI versions |
|---|---|---:|---:|---|
| collaboration.followup_task | no UUID in output (or no output) | 13 | 2 | 0.153.4 |
| collaboration.interrupt_agent | no UUID in output (or no output) | 5 | 2 | 0.147.0-alpha.6.6, 0.153.0 |
| collaboration.list_agents | no UUID in output (or no output) | 8 | 3 | 0.147.0-alpha.6.6, 0.153.0 |
| collaboration.send_message | no UUID in output (or no output) | 43 | 21 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| collaboration.spawn_agent | no UUID in output (or no output) | 22 | 6 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |
| collaboration.wait_agent | no UUID in output (or no output) | 15 | 5 | 0.147.0-alpha.6.6, 0.153.0, 0.153.4 |

#### Temporal association only (not an identity): child start after the nearest preceding spawn_agent call in its declared parent

| Measure | Value |
|---|---:|
| Children measured | 10 |
| Children with no earlier spawn_agent call in the parent | 0 |
| Gap in seconds (min / median / max) | 0.1 / 0.2 / 0.5 |
