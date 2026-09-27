/**
 * Raw Codex rollout types.
 *
 * Codex persists every session ("thread") as a JSONL rollout under
 * `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-<timestamp>-<thread-id>.jsonl`
 * (older, inactive rollouts may be compressed to `.jsonl.zst`).
 *
 * Current rollout lines are envelopes:
 *   {"timestamp":"…","ordinal":N,"type":"response_item","payload":{…},"metadata":{…}}
 *
 * Record types: session_meta, response_item, event_msg, turn_context, compacted,
 * token_usage_record, world_state, retained_context, security_risk_score,
 * inter_agent_communication, inter_agent_communication_metadata, realtime_item.
 *
 * Rollouts written before the envelope format stored a bare SessionMeta object
 * on the first line followed by bare ResponseItems. Both are accepted.
 *
 * Every field is optional: the schema evolves quickly and the parser must
 * degrade gracefully rather than reject a line.
 *
 * Source of truth: openai/codex `codex-rs/protocol/src/models.rs`,
 * `codex-rs/protocol/src/protocol.rs` and `codex-rs/history/src/rollout_payload.rs`.
 */

// =============================================================================
// Envelope
// =============================================================================

/**
 * One rollout line after envelope normalization.
 */
export interface CodexRolloutRecord {
  /** 1-based line number in the file */
  lineNumber: number;
  /** ISO timestamp from the envelope (absent in legacy rollouts) */
  timestamp?: string;
  /** Record type (`session_meta`, `response_item`, `event_msg`, …) */
  type: string;
  /** Record payload */
  payload: Record<string, unknown>;
  /** Harness metadata stored alongside response items */
  metadata?: Record<string, unknown>;
}

// =============================================================================
// Session metadata
// =============================================================================

export interface CodexGitInfo {
  commit_hash?: string;
  branch?: string;
  repository_url?: string;
}

/** `session_meta` payload (SessionMeta flattened with `git`). */
export interface CodexSessionMetaPayload {
  id?: string;
  session_id?: string;
  forked_from_id?: string;
  parent_thread_id?: string;
  timestamp?: string;
  cwd?: string;
  originator?: string;
  cli_version?: string;
  source?: unknown;
  model_provider?: string;
  agent_nickname?: string;
  agent_role?: string;
  agent_type?: string;
  agent_path?: string;
  git?: CodexGitInfo;
}

// =============================================================================
// Response items
// =============================================================================

/*
 * `response_item` payloads are read defensively (every field optional) by
 * CodexExecutionParser and CodexExecutionNormalizer. Shapes understood:
 *
 *   message                  { role, content: [{type, text}], phase? }
 *   agent_message            { author?, recipient?, content }
 *   reasoning                { summary: [{text}], content?, encrypted_content? }
 *   function_call            { name, namespace?, arguments: "<json>", call_id }
 *   function_call_output     { call_id, output: string | content items }
 *   local_shell_call         { call_id, status, action: { command[], working_directory?, timeout_ms? } }
 *   custom_tool_call         { name, namespace?, input: "<freeform>", call_id, status }
 *   custom_tool_call_output  { call_id, output }
 *   tool_search_call/_output { call_id, execution, arguments | tools }
 *   web_search_call          { status, action: { type, query?, url?, pattern? } }
 *   image_generation_call    { status, revised_prompt?, result }
 *   compaction               { encrypted_content? }
 *
 * Any item may carry `internal_chat_message_metadata_passthrough`:
 *   { turn_id?, cell_id?, executed_tool_calls?: [{name, arguments}], tool_calls_complete? }
 * which records the nested tool calls made by a code-mode `exec` cell.
 */

// =============================================================================
// Events (event_msg payloads)
// =============================================================================

export interface CodexTokenUsageRaw {
  input_tokens?: number;
  cached_input_tokens?: number;
  output_tokens?: number;
  reasoning_output_tokens?: number;
  total_tokens?: number;
}

/*
 * `event_msg` payloads parsed by CodexEventParser include token_count
 * ({ info: { total_token_usage, last_token_usage, model_context_window } }),
 * exec_command_end, patch_apply_end, mcp_tool_call_end, turn lifecycle events,
 * and `item_completed` TurnItems written by paginated rollouts, e.g.
 * CommandExecution { id, command[], cwd, source, status, exit_code,
 * duration: {secs, nanos}, aggregated_output, formatted_output }.
 */
