# Codex rollout survey

Generated 2026-09-27T13:45:36.849Z · commit be6c718 · Node v22.14.0 on win32/x64 · zstd not available in this Node (the app’s Electron runtime may still have it)

> No message text, commands, outputs, code, file paths or working directories. Model names were replaced by per-report aliases after generation (`<model-1>` is the most frequent). Tool names and rollout file names are included: review before sharing.

## Rollout files

| | |
|---|---|
| Sessions directory | custom location (--sessions) |
| Rollout files | 58 (58 .jsonl, 0 .jsonl.zst) |
| Outside YYYY/MM/DD folders | 0 |
| Date range | 2025-10-02 → 2026-09-23 |
| Size | total 262.4 MB · p50 331 KB · p90 5.9 MB · max 106.7 MB |
| Files over 50 MB / 200 MB | 2 / 0 |
| Surveyed | 58 most recently written |

## Session list (what the app shows)

| | |
|---|---|
| Listed | 58 of 58 (the app lists the 500 most recent) |
| Scan time | 110 ms |
| Live session selected | yes (the newest file) |
| Projects | 6 groups from 10 distinct working directories |

#### Listed sessions

| Value | Count | Sessions |
|---|---:|---:|
| listed | 58 | 58 |
| subagent or forked | 22 | 22 |
| no model | 2 | 2 |
| no title | 2 | 2 |
| live | 1 | 1 |

#### Project groups

| Value | Count |
|---|---:|
| projects with 2-5 sessions | 4 |
| projects with 21+ sessions | 1 |
| projects with 6-20 sessions | 1 |

#### Working directory formats

| Value | Count | Sessions |
|---|---:|---:|
| Windows drive path | 58 | 58 |

#### Originator and source

| Value | Count | Sessions |
|---|---:|---:|
| codex_vscode · source vscode | 25 | 25 |
| codex_work_desktop · source subagent:thread_spawn | 16 | 16 |
| codex_vscode · source subagent:thread_spawn | 6 | 6 |
| codex_cli_rs · source vscode | 5 | 5 |
| codex_work_desktop · source vscode | 4 | 4 |
| codex_exec · source exec | 2 | 2 |

## Opening a session (read + normalize)

| | |
|---|---|
| Sessions timed | 58 |
| Open time | p50 3 ms · p90 54 ms · max 1.25 s |
| Throughput | 91.9 MB/s |
| Peak heap | 362.3 MB |
| Slowest #1 | 1.25 s (read 731 ms, normalize 515 ms) · 106.7 MB · 70234 lines · `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl` |
| Slowest #2 | 628 ms (read 389 ms, normalize 240 ms) · 60.3 MB · 23722 lines · `2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl` |
| Slowest #3 | 354 ms (read 187 ms, normalize 166 ms) · 30.2 MB · 13293 lines · `2026/08/11/rollout-2026-08-11T11-30-53-019ff172-b1ae-7dd0-b445-ba8902936661.jsonl` |

## Parser anomalies

#### Anomalies

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| command completed without an exit code — A command output without a recognized header; the exit code is unknown. | 326 | 6 | `2026/06/19/rollout-2026-06-19T08-57-24-019edff5-21b7-7a51-94c8-c631e47b8d3e.jsonl:160`<br>`2026/06/23/rollout-2026-06-23T10-37-59-019ef4ea-9fea-7b90-b572-6fb583171fbb.jsonl:1017`<br>`2026/07/23/rollout-2026-07-23T10-11-31-019f8f51-2041-76b1-804c-5032dc4f6a93.jsonl:14` |
| finished without a duration — A finished execution with no reported or observed duration. | 25 | 3 | `2026/07/08/rollout-2026-07-08T11-58-04-019f4273-37be-71d0-9db5-b1366be18944.jsonl:156`<br>`2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:479`<br>`2026/06/06/rollout-2026-06-06T14-58-00-019e9e4c-9940-7da1-8f21-f1df332ced69.jsonl:147` |
| call without a result — A call in a finished turn that never got an output. | 6 | 4 | `2026/08/13/rollout-2026-08-13T23-18-41-019ffe47-6c39-70f2-8806-c372d8151cfb.jsonl:66`<br>`2026/08/13/rollout-2026-08-13T23-18-27-019ffe47-34e4-74c2-ab5c-c4e70033dfc1.jsonl:69`<br>`2026/07/11/rollout-2026-07-11T18-46-59-019f535c-d115-7c62-a2f2-010729a75ea8.jsonl:122` |

## What the app renders

#### Executions (kind → status)

| Value | Count | Sessions |
|---|---:|---:|
| code_cell → completed | 8990 | 33 |
| nested command → unknown | 6037 | 34 |
| nested patch → unknown | 4035 | 26 |
| code_cell → failed | 3001 | 31 |
| code_wait → completed | 1586 | 18 |
| command → completed | 1440 | 11 |
| nested command_input → unknown | 1016 | 7 |
| nested tool → unknown | 928 | 17 |
| nested command → completed | 391 | 7 |
| patch → completed | 315 | 6 |
| nested mcp → unknown | 132 | 4 |
| tool → completed | 130 | 24 |
| mcp → completed | 106 | 3 |
| command → failed | 102 | 8 |
| nested plan → unknown | 48 | 4 |
| command_input → completed | 38 | 2 |
| web_search → completed | 25 | 3 |
| tool_search → completed | 14 | 4 |
| plan → completed | 11 | 2 |
| code_cell → interrupted | 10 | 5 |
| nested command → failed | 10 | 2 |
| code_cell → unknown | 6 | 4 |
| command → interrupted | 6 | 4 |
| tool → failed | 3 | 1 |
| command → declined | 2 | 1 |
| code_cell → running | 1 | 1 |
| code_wait → interrupted | 1 | 1 |
| patch → failed | 1 | 1 |

#### Call generations

| Value | Count | Sessions |
|---|---:|---:|
| (none) · recorded as custom_tool_call | 12324 | 42 |
| (none) · recorded as function_call | 1837 | 38 |
| function_call · recorded as function_call | 1587 | 10 |
| (none) · recorded as web_search_call | 25 | 3 |
| (none) · recorded as tool_search_call | 14 | 4 |
| (none) · recorded as command_execution | 1 | 1 |

#### Code cells and their nested calls

| Value | Count | Sessions |
|---|---:|---:|
| children script | 11448 | 37 |
| child command → unknown | 6037 | 34 |
| child patch → unknown | 4035 | 26 |
| child command_input → unknown | 1016 | 7 |
| child tool → unknown | 928 | 17 |
| child command → completed · exit code | 391 | 7 |
| children none | 359 | 15 |
| children recorded | 201 | 1 |
| child mcp → unknown | 132 | 4 |
| child plan → unknown | 48 | 4 |
| child command → failed · exit code | 10 | 2 |

#### Other timeline entries

| Value | Count | Sessions |
|---|---:|---:|
| reasoning · summary · encrypted | 13017 | 15 |
| reasoning · no summary · encrypted | 8665 | 49 |
| agent message · commentary | 8499 | 36 |
| user message | 957 | 56 |
| agent message · final_answer | 812 | 50 |
| compaction | 129 | 23 |
| agent message · no phase · inter-agent | 104 | 27 |
| turn aborted | 65 | 17 |
| turn failed | 33 | 15 |
| agent message · no phase | 1 | 1 |

#### Surveyed sessions

| Value | Count | Sessions |
|---|---:|---:|
| sessions surveyed | 58 | 58 |
| subagent or forked session | 22 | 22 |
| no executions | 8 | 8 |
| no token usage | 4 | 4 |
| no model (no turn_context) | 2 | 2 |
| no title (no user request found) | 2 | 2 |
| live (written in the last 10 minutes) | 1 | 1 |
| turn in progress | 1 | 1 |

## Rollout format

#### Line formats

| Value | Count | Sessions |
|---|---:|---:|
| envelope {timestamp, type, payload, …} | 132201 | 58 |

#### Record types

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| response_item | 64479 | 58 |  |
| event_msg | 58810 | 56 |  |
| token_usage_record | 7262 | 23 |  |
| turn_context | 1051 | 56 |  |
| world_state | 296 | 45 |  |
| compacted | 129 | 23 |  |
| inter_agent_communication_metadata | 104 | 27 |  |
| session_meta | 70 | 58 |  |

#### Envelope fields

| Value | Count | Sessions |
|---|---:|---:|
| {ordinal, payload, timestamp, type} | 125919 | 58 |
| {metadata, ordinal, payload, timestamp, type} | 6282 | 2 |

#### Envelope metadata fields

| Value | Count | Sessions |
|---|---:|---:|
| {client_authored, fallback_token_limit_override} | 6282 | 2 |

#### session_meta (instructions and tool lists are not read)

| Value | Count | Sessions |
|---|---:|---:|
| cwd Windows drive path | 70 | 58 |
| model_provider openai | 65 | 53 |
| git {branch, commit_hash, repository_url} | 54 | 42 |
| source vscode | 46 | 46 |
| originator codex_work_desktop | 32 | 20 |
| originator codex_vscode | 31 | 31 |
| fields {agent_nickname, agent_path, cli_version, context_window, cwd, forked_from_id, git, history_mode, id, model_provider, multi_agent_version, originator, parent_thread_id, session_id, source, subagent_history_start_ordinal, thread_source, timestamp} | 22 | 22 |
| source subagent.thread_spawn | 22 | 22 |
| fields {cli_version, context_window, cwd, git, history_mode, id, model_provider, originator, session_id, source, thread_source, timestamp} | 21 | 21 |
| cli_version 0.153.4 | 20 | 14 |
| cli_version 0.153.0 | 14 | 14 |
| cli_version 0.144.0-alpha.4 | 11 | 11 |
| fields {cli_version, context_window, cwd, git, history_base, history_mode, id, model_provider, originator, session_id, source, thread_source, timestamp} | 9 | 9 |
| fields {cli_version, cwd, git, history_mode, id, model_provider, originator, session_id, source, thread_source, timestamp} | 8 | 8 |
| cli_version 0.147.0-alpha.6.6 | 5 | 5 |
| cli_version 0.42.0 | 5 | 5 |
| fields {cli_version, cwd, history_mode, id, model_provider, originator, session_id, source, timestamp} | 5 | 5 |
| model_provider (none) | 5 | 5 |
| originator codex_cli_rs | 5 | 5 |
| cli_version 0.142.0-alpha.6 | 4 | 4 |
| cli_version 0.140.0-alpha.2 | 3 | 3 |
| fields {cli_version, cwd, history_mode, id, model_provider, originator, session_id, source, thread_source, timestamp} | 3 | 3 |
| git {} | 3 | 3 |
| cli_version 0.142.0-alpha.1 | 2 | 2 |
| cli_version 0.155.0-alpha.16.3 | 2 | 2 |
| fields {cli_version, context_window, cwd, git, history_mode, id, model_provider, originator, runtime_workspace_roots, session_id, source, thread_source, timestamp} | 2 | 2 |
| originator codex_exec | 2 | 2 |
| source exec | 2 | 2 |
| cli_version 0.137.0-alpha.4 | 1 | 1 |
| cli_version 0.142.5 | 1 | 1 |
| cli_version 0.145.0-alpha.30 | 1 | 1 |
| cli_version 0.148.0-alpha.15 | 1 | 1 |
| git {branch, commit_hash} | 1 | 1 |
| git {branch, repository_url} | 1 | 1 |
| git {commit_hash, repository_url} | 1 | 1 |
| git {commit_hash} | 1 | 1 |
| git {repository_url} | 1 | 1 |

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
| fields {approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, effort, model, multi_agent_mode, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 82 | 10 |
| fields {approval_policy, collaboration_mode, current_date, cwd, effort, model, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 70 | 1 |
| fields {active_permission_profile, approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, disabled_plugin_ids, effort, model, multi_agent_version, permission_profile, personality, realtime_active, root_turn_id, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 68 | 2 |
| model <model-4> | 68 | 2 |
| fields {approval_policy, collaboration_mode, current_date, cwd, effort, file_system_sandbox_policy, model, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 30 | 4 |
| fields {approval_policy, collaboration_mode, comp_hash, current_date, cwd, effort, model, multi_agent_mode, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 21 | 2 |
| model <model-5> | 8 | 3 |
| fields {approval_policy, cwd, model, sandbox_policy, summary} | 7 | 2 |
| fields {approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, effort, file_system_sandbox_policy, model, multi_agent_mode, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id, workspace_roots} | 4 | 4 |
| fields {approval_policy, approvals_reviewer, collaboration_mode, comp_hash, current_date, cwd, effort, model, multi_agent_version, permission_profile, personality, realtime_active, sandbox_policy, summary, timezone, turn_id} | 1 | 1 |
| fields {approval_policy, cwd, effort, model, sandbox_policy, summary} | 1 | 1 |
| model <model-6> | 1 | 1 |

#### compacted (history fields are not read)

| Value | Count | Sessions |
|---|---:|---:|
| fields {compaction_response_id, first_window_id, latest_token_usage_record, message, previous_window_id, window_id, window_number} | 116 | 21 |
| fields {compaction_response_id, latest_token_usage_record, message} | 5 | 1 |
| fields {compaction_response_id, latest_token_usage_record, message, window_id, window_number} | 4 | 2 |
| fields {compaction_response_id, latest_token_usage_record, message, window_number} | 4 | 1 |

## Response items

#### Item types

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| reasoning | 21682 | 52 |  |
| custom_tool_call_output | 12326 | 42 |  |
| custom_tool_call | 12324 | 42 |  |
| message | 11145 | 58 |  |
| function_call | 3424 | 43 |  |
| function_call_output | 3421 | 43 |  |
| agent_message | 104 | 27 |  |
| web_search_call | 25 | 3 |  |
| tool_search_call | 14 | 4 |  |
| tool_search_output | 14 | 4 |  |

#### Item fields

| Value | Count | Sessions |
|---|---:|---:|
| reasoning {content, encrypted_content, id, internal_chat_message_metadata_passthrough, summary, type} | 18707 | 30 |
| custom_tool_call {call_id, id, input, internal_chat_message_metadata_passthrough, name, status, type} | 11763 | 38 |
| custom_tool_call_output {call_id, id, internal_chat_message_metadata_passthrough, output, type} | 11220 | 25 |
| message {content, id, internal_chat_message_metadata_passthrough, phase, role, type} | 8272 | 44 |
| function_call {arguments, call_id, id, internal_chat_message_metadata_passthrough, name, type} | 2081 | 18 |
| function_call_output {call_id, id, internal_chat_message_metadata_passthrough, output, type} | 1891 | 26 |
| reasoning {encrypted_content, id, internal_chat_message_metadata_passthrough, summary, type} | 1661 | 14 |
| message {content, id, internal_chat_message_metadata_passthrough, role, type} | 1130 | 32 |
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
| message {content, role, type} | 315 | 15 |
| message {content, id, phase, role, type} | 275 | 5 |
| function_call {arguments, call_id, id, name, type} | 237 | 5 |
| function_call {arguments, call_id, id, internal_chat_message_metadata_passthrough, name, namespace, type} | 234 | 24 |
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
| assistant content output_text | 9312 | 53 |
| assistant · phase commentary | 8499 | 36 |
| user content input_text | 1383 | 58 |
| user | 1339 | 58 |
| assistant · phase final_answer | 812 | 50 |
| developer content input_text | 714 | 53 |
| developer | 494 | 53 |
| assistant | 1 | 1 |

#### Reasoning items

| Value | Count | Sessions |
|---|---:|---:|
| summary yes · content no · encrypted yes | 13017 | 15 |
| summary no · content no · encrypted yes | 8665 | 49 |

## Tools

#### Tool calls

| Value | Count | Sessions |
|---|---:|---:|
| custom_tool_call exec | 12008 | 38 |
| function_call wait | 1587 | 18 |
| function_call shell_command | 1077 | 7 |
| function_call exec_command | 472 | 4 |
| custom_tool_call apply_patch | 316 | 6 |
| function_call collaboration.send_message | 43 | 21 |
| function_call mcp__codex_apps__github._fetch_file | 41 | 1 |
| function_call write_stdin | 38 | 2 |
| function_call mcp__node_repl.js | 30 | 2 |
| function_call collaboration.spawn_agent | 22 | 6 |
| function_call clock.sleep | 20 | 1 |
| function_call mcp__codex_apps__github._search | 16 | 1 |
| function_call collaboration.wait_agent | 15 | 5 |
| function_call mcp__cua_repl.js | 15 | 1 |
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
| wait {cell_id, max_tokens, yield_time_ms} | 1583 | 18 |
| shell_command {command, timeout_ms, workdir} | 1055 | 7 |
| exec_command {cmd, max_output_tokens, workdir, yield_time_ms} | 384 | 4 |
| exec_command {cmd, max_output_tokens, workdir} | 58 | 1 |
| collaboration.send_message {message, target} | 43 | 21 |
| mcp__codex_apps__github._fetch_file {encoding, end_line, path, ref, repository_full_name, start_line} | 41 | 1 |
| write_stdin {chars, max_output_tokens, session_id, yield_time_ms} | 38 | 2 |
| exec_command {cmd, max_output_tokens, shell, workdir, yield_time_ms} | 29 | 1 |
| mcp__node_repl.js {code, timeout_ms, title} | 23 | 1 |
| clock.sleep {duration_ms} | 20 | 1 |
| collaboration.spawn_agent {fork_turns, message, task_name} | 17 | 5 |
| collaboration.wait_agent {timeout_ms} | 15 | 5 |
| mcp__cua_repl.js {code, title} | 15 | 1 |
| collaboration.followup_task {message, target} | 13 | 2 |
| mcp__codex_apps__github._search {query, repository_name, topn} | 12 | 1 |
| shell_command {command, justification, sandbox_permissions, timeout_ms, workdir} | 11 | 3 |
| shell_command {command, justification, prefix_rule, sandbox_permissions, timeout_ms, workdir} | 10 | 2 |
| collaboration.list_agents {} | 8 | 3 |
| mcp__node_repl.js {code, title} | 7 | 1 |
| update_plan {plan} | 7 | 2 |
| collaboration.interrupt_agent {target} | 5 | 2 |
| collaboration.spawn_agent {message, task_name} | 5 | 2 |
| mcp__codex_apps__github._search {org, query, repository_name, topn} | 4 | 1 |
| request_user_input_async {questions} | 4 | 1 |
| update_plan {explanation, plan} | 4 | 1 |
| wait {cell_id, max_tokens, terminate, yield_time_ms} | 4 | 2 |
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
| custom_tool_call status completed | 12324 | 42 |
| web_search_call status completed | 25 | 3 |

#### Code-mode exec cells

| Value | Count | Sessions |
|---|---:|---:|
| exec cells | 12008 | 38 |
| no tools.* calls found by static analysis | 560 | 15 |
| pragma field max_output_tokens | 81 | 4 |
| with // @exec pragma | 81 | 4 |
| pragma field yield_time_ms | 41 | 3 |

#### tools.* calls in exec cells (static analysis)

| Value | Count | Sessions |
|---|---:|---:|
| tools.apply_patch (dynamic arguments) | 3930 | 23 |
| tools.exec_command | 2677 | 26 |
| tools.shell_command | 1839 | 9 |
| tools.exec_command (dynamic arguments) | 1226 | 9 |
| tools.write_stdin | 1005 | 7 |
| tools.clock__curr_time | 681 | 5 |
| tools.shell_command (dynamic arguments) | 493 | 4 |
| tools.web__run | 136 | 13 |
| tools.apply_patch | 105 | 7 |
| tools.mcp__node_repl__js | 90 | 3 |
| tools.update_plan | 48 | 4 |
| tools.codex_app__automation_update | 43 | 1 |
| tools.codex_app__automation_update (dynamic arguments) | 43 | 1 |
| tools.mcp__codex_apps__github_fetch_file | 18 | 3 |
| tools.write_stdin (dynamic arguments) | 11 | 1 |
| tools.codex_app__read_thread | 9 | 1 |
| tools.mcp__codex_apps__github_fetch_file (dynamic arguments) | 9 | 2 |
| tools.list_mcp_resources | 5 | 5 |
| tools.mcp__codex_apps__github_search | 4 | 1 |
| tools.codex_app__list_threads | 3 | 1 |
| tools.list_mcp_resource_templates | 3 | 3 |
| tools.mcp__codex_apps__github_search (dynamic arguments) | 3 | 2 |
| tools.mcp__node_repl__js (dynamic arguments) | 3 | 1 |
| tools.codex_app__read_thread_terminal | 2 | 2 |
| tools.mcp__codex_apps__github_get_repo | 2 | 2 |
| tools.view_image | 2 | 1 |
| tools.codex_app__load_workspace_dependencies | 1 | 1 |
| tools.mcp__codex_apps__github__fetch_file (dynamic arguments) | 1 | 1 |
| tools.mcp__codex_apps__github_search_branches | 1 | 1 |
| tools.mcp__codex_apps__github_search_commits | 1 | 1 |

#### Harness passthrough metadata

| Value | Count | Sessions |
|---|---:|---:|
| reasoning {turn_id} | 20368 | 43 |
| custom_tool_call {create_time, turn_id} | 7160 | 19 |
| custom_tool_call_output {create_time, turn_id} | 7159 | 19 |
| message {content_item_kinds, create_time, turn_id} | 6566 | 24 |
| custom_tool_call_output {turn_id} | 4609 | 20 |
| custom_tool_call {turn_id} | 4603 | 20 |
| message {turn_id} | 3055 | 20 |
| function_call {turn_id} | 2010 | 15 |
| function_call_output {turn_id} | 2009 | 15 |
| function_call {create_time, turn_id} | 305 | 21 |
| function_call_output {create_time, turn_id} | 305 | 21 |
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
| custom_tool_call_output content items | 10722 | 38 |
| function_call_output text | 2103 | 36 |
| custom_tool_call_output text | 1604 | 21 |
| function_call_output content items | 1318 | 17 |

#### Exec output headers (fields the parser extracted)

| Value | Count | Sessions |
|---|---:|---:|
| exec → wallTimeMs + scriptStatus | 10695 | 38 |
| exec → wallTimeMs + scriptStatus + cellId | 1301 | 18 |
| wait → wallTimeMs + scriptStatus | 1300 | 18 |
| shell_command → exitCode + wallTimeMs | 871 | 7 |
| apply_patch → exitCode + wallTimeMs | 315 | 6 |
| exec_command → exitCode + wallTimeMs + chunkId + originalTokenCount | 291 | 4 |
| wait → wallTimeMs + scriptStatus + cellId | 286 | 8 |
| shell_command → no header | 171 | 5 |
| exec_command → no header | 159 | 3 |
| shell_command → exitCode + wallTimeMs + totalOutputLines | 32 | 5 |
| exec_command → wallTimeMs + processId + chunkId + originalTokenCount | 22 | 2 |
| write_stdin → exitCode + wallTimeMs + chunkId + originalTokenCount | 21 | 2 |
| exec → no header | 14 | 4 |
| write_stdin → wallTimeMs + processId + chunkId + originalTokenCount | 14 | 2 |
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
| shell_command → Wall time: # seconds / aborted … | 3 | 1 | `2026/06/17/rollout-2026-06-17T08-48-16-019ed5a0-0b12-79a1-b85d-e5d2ecf58cd3.jsonl:959` |
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

## Events

#### event_msg types

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| item_completed | 39831 | 56 |  |
| token_count | 16478 | 54 |  |
| task_started | 930 | 56 |  |
| task_complete | 842 | 53 |  |
| thread_settings_applied (not rendered) | 664 | 40 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:63`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:85`<br>`2026/09/16/rollout-2026-09-16T01-55-51-01a0a8c9-2bb8-7920-a65b-c88be2bc900f.jsonl:38` |
| turn_aborted | 65 | 17 |  |

#### Rendered event fields

| Value | Count | Sessions |
|---|---:|---:|
| token_count {info, rate_limits, type} | 16478 | 54 |
| task_started {collaboration_mode_kind, model_context_window, started_at, turn_id, type} | 902 | 54 |
| task_complete {completed_at, duration_ms, last_agent_message, started_at, time_to_first_token_ms, turn_id, type} | 496 | 30 |
| task_complete {completed_at, duration_ms, last_agent_message, time_to_first_token_ms, turn_id, type} | 307 | 21 |
| turn_aborted {completed_at, duration_ms, reason, turn_id, type} | 37 | 10 |
| task_complete {completed_at, duration_ms, error, last_agent_message, started_at, time_to_first_token_ms, turn_id, type} | 33 | 15 |
| task_started {collaboration_mode_kind, model_context_window, root_turn_id, started_at, turn_id, type} | 28 | 2 |
| turn_aborted {completed_at, duration_ms, reason, started_at, turn_id, type} | 27 | 7 |
| task_complete {completed_at, last_agent_message, turn_id, type} | 6 | 6 |
| turn_aborted {reason, turn_id, type} | 1 | 1 |

#### item_completed item types

| Value | Count | Sessions | Examples |
|---|---:|---:|---|
| Reasoning | 23940 | 18 |  |
| AgentMessage | 9321 | 52 |  |
| FileChange | 4538 | 33 |  |
| UserMessage | 910 | 44 |  |
| CommandExecution | 402 | 7 |  |
| McpToolCall | 280 | 10 |  |
| WebSearch (not rendered) | 162 | 14 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:11601`<br>`2026/09/05/rollout-2026-09-05T23-28-33-01a074c2-b8b8-7e03-813e-87187a43c9f9.jsonl:29`<br>`2026/09/05/rollout-2026-09-05T23-39-18-01a074cc-8ed7-7712-b5c8-33aff8b0faaf.jsonl:16` |
| SubAgentActivity (not rendered) | 128 | 24 | `2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:44`<br>`2026/09/16/rollout-2026-09-16T01-55-51-01a0a8c9-2bb8-7920-a65b-c88be2bc900f.jsonl:19`<br>`2026/09/13/rollout-2026-09-13T21-39-13-01a09d91-804f-75a2-8d3c-b484e6b28af0.jsonl:33` |
| ContextCompaction (not rendered) | 121 | 15 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:1596`<br>`2026/09/13/rollout-2026-09-13T21-37-43-01a09d90-2086-7f92-9e12-670bc277cf90.jsonl:1304`<br>`2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:81` |
| Extension (not rendered) | 28 | 3 | `2026/09/23/rollout-2026-09-23T11-59-54-01a0cefe-b6c1-7b21-aa52-cdb658c6d54b.jsonl:2888`<br>`2026/09/10/rollout-2026-09-10T00-15-28-01a07967-8252-7b21-8524-3164700549b1_01a08987-1c4e-7351-b1f4-b1b242a4b098.jsonl:1150`<br>`2026/09/11/rollout-2026-09-11T10-09-29-01a090cd-4f6b-7d80-a41f-64ebe9f2e710.jsonl:25` |
| CollabAgentToolCall (not rendered) | 1 | 1 | `2026/09/08/rollout-2026-09-08T22-39-58-01a08409-508a-7241-8739-90a4bab3848b.jsonl:77` |

#### item_completed item fields

| Value | Count | Sessions |
|---|---:|---:|
| Reasoning {id, raw_content, summary_text, type} | 23940 | 18 |
| AgentMessage {content, id, phase, type} | 9319 | 51 |
| FileChange {changes, id, status, stdout, type} | 4111 | 27 |
| UserMessage {client_id, content, id, type} | 904 | 39 |
| FileChange {changes, id, status, stderr, stdout, type} | 427 | 7 |
| CommandExecution {aggregated_output, command, cwd, duration, exit_code, formatted_output, id, parsed_cmd, process_id, source, status, stderr, stdout, type} | 402 | 7 |
| SubAgentActivity {agent_path, agent_thread_id, id, kind, type} | 128 | 24 |
| WebSearch {action, id, query, results, type} | 122 | 9 |
| ContextCompaction {id, type} | 121 | 15 |
| McpToolCall {actionName, appName, arguments, connectorId, duration, id, linkId, result, server, status, tool, type} | 112 | 1 |
| McpToolCall {arguments, duration, id, readOnlyHint, result, server, status, tool, type} | 72 | 2 |
| McpToolCall {arguments, duration, id, result, server, status, tool, type} | 64 | 9 |
| WebSearch {action, id, query, type} | 40 | 5 |
| Extension {durationMs, id, kind, type} | 20 | 1 |
| McpToolCall {actionName, appName, arguments, connectorId, duration, id, linkId, readOnlyHint, result, server, status, tool, type} | 17 | 1 |
| McpToolCall {arguments, duration, id, pluginId, readOnlyHint, result, server, status, tool, type} | 15 | 1 |
| Extension {action, id, kind, query, results, type} | 8 | 2 |
| UserMessage {content, id, type} | 6 | 6 |
| AgentMessage {content, delivery, id, phase, questions, type} | 1 | 1 |
| AgentMessage {content, id, type} | 1 | 1 |
| CollabAgentToolCall {agents_states, id, receiver_agents, receiver_thread_ids, sender_thread_id, status, tool, type} | 1 | 1 |

#### Command result events

| Value | Count | Sessions |
|---|---:|---:|
| CommandExecution · source unified_exec_startup · status completed | 392 | 7 |
| CommandExecution · source unified_exec_startup · status failed | 10 | 2 |
