# claude-devtools

Standalone viewer (Electron app + standalone HTTP server) for Claude Code and Codex session activity: it reads the session files those agents persist locally and shows what they did. Architecture: `docs/ARCHITECTURE.md`; planned work: `docs/ROADMAP.md`

## Tech Stack
Electron 28.x, React 18.x, TypeScript 5.x, Tailwind CSS 3.x, Zustand 4.x

## Commands
Always use pnpm (not npm/yarn) for this project.

- `pnpm install` - Install dependencies
- `pnpm dev` - Dev server with hot reload
- `pnpm build` - Production build
- `pnpm typecheck` - Type checking
- `pnpm lint:fix` - Lint and auto-fix
- `pnpm format` - Format code
- `pnpm test` - Run all vitest tests
- `pnpm test:watch` - Watch mode
- `pnpm test:coverage` - Coverage report
- `pnpm test:coverage:critical` - Critical path coverage
- `pnpm test:chunks` - Chunk building tests
- `pnpm test:semantic` - Semantic step extraction tests
- `pnpm test:noise` - Noise filtering tests
- `pnpm test:task-filtering` - Task tool filtering tests

## Path Aliases
Use path aliases for imports:
- `@main/*` → `src/main/*`
- `@renderer/*` → `src/renderer/*`
- `@shared/*` → `src/shared/*`
- `@preload/*` → `src/preload/*`

## Data Sources
~/.claude/projects/{encoded-path}/*.jsonl - Session files
~/.claude/todos/{sessionId}.json - Todo data
$CODEX_HOME/sessions/YYYY/MM/DD/rollout-*.jsonl[.zst] - Codex rollouts (`CODEX_HOME` defaults to `~/.codex`)

Path encoding: `/Users/name/project` → `-Users-name-project`
Codex rollouts are grouped by the `cwd` in their `session_meta`, not by date directory.

## Critical Concepts

### isMeta Flag
- `isMeta: false` = Real user message (creates new chunks)
- `isMeta: true` = Internal message (tool results, system-generated)

### Chunk Structure
Independent chunk types for timeline visualization:
- **UserChunk**: Single user message with metrics
- **AIChunk**: All assistant responses with tool executions and spawned subagents
- **SystemChunk**: Command output/system messages
- **CompactChunk**: System metadata/structural messages

Each chunk has: timestamp, duration, metrics (tokens, cost, tools)

### Task/Subagent Filtering
Task tool_use blocks are filtered when subagent exists
Keep orphaned Task calls (no matching subagent) for visibility.

### Agent Teams
Claude Code's "Orchestrate Teams" feature: multiple sessions coordinate as a team.
- **Process.team?** `{ teamName, memberName, memberColor }` — enriched by SubagentResolver from Task call inputs and `teammate_spawned` tool results
- **Teammate messages** arrive as `<teammate-message teammate_id="..." color="..." summary="...">content</teammate-message>` in user messages (isMeta: false). Detected by `isParsedTeammateMessage()` — excluded from UserChunks, rendered as `TeammateMessageItem` cards
- **Session ongoing detection** treats `SendMessage` shutdown_response (approve: true) and its tool_result as ending events, not ongoing activity
- **Display summary** counts distinct teammates (by name) separately from regular subagents
- **Team tools**: TeamCreate, TaskCreate, TaskUpdate, TaskList, TaskGet, SendMessage, TeamDelete — have readable summaries in `toolSummaryHelpers.ts`

### Visible Context Tracking
Tracks what consumes tokens in Claude's context window across 6 categories (discriminated union on `category` field):

| Category | Type | Source |
|----------|------|--------|
| `claude-md` | `ClaudeMdContextInjection` | CLAUDE.md files (global, project, directory) |
| `mentioned-file` | `MentionedFileInjection` | User @-mentioned files |
| `tool-output` | `ToolOutputInjection` | Tool execution results (Read, Bash, etc.) |
| `thinking-text` | `ThinkingTextInjection` | Extended thinking + text output tokens |
| `team-coordination` | `TeamCoordinationInjection` | Team tools (SendMessage, TaskCreate, etc.) |
| `user-message` | `UserMessageInjection` | User prompt text per turn |

- **Types**: `src/renderer/types/contextInjection.ts` — `ContextInjection` union, `ContextStats`, `TokensByCategory`
- **Tracker**: `src/renderer/utils/contextTracker.ts` — `computeContextStats()`, `processSessionContextWithPhases()`
- **Context Phases**: Compaction events reset accumulated injections, tracked via `ContextPhaseInfo`
- **Display surfaces**: `ContextBadge` (per-turn popover), `TokenUsageDisplay` (hover breakdown), `SessionContextPanel` (full panel)

### Codex Provider
Codex CLI rollouts are parsed in `src/main/providers/codex/` and normalized into the provider-neutral domain in `src/main/domain/` (`Execution`, `TimelineEntry`, `AgentSessionDetail`).
- **Pipeline**: `CodexScanner` (discovery, live detection) → `CodexRolloutParser` (envelope + legacy lines, incremental byte offsets, `.zst`) → `normalizeCodexRollout()` (+ `CodexExecutionParser`, `CodexEventParser`, `CodexMetadataParser`) → `CodexSessionService` (cache, fingerprints, watcher)
- **Three call generations**: `function_call` (`exec_command`/`shell`, `write_stdin` polls), `local_shell_call` (direct argv), code mode (`custom_tool_call` named `exec` whose JS calls `tools.exec_command(...)`; `wait` resumes a yielded cell)
- **Evidence, not assumptions** (real rollouts: `docs/codex-real-validation/`): every `Execution` carries `evidence` — `code` (script call site, static analysis only), `observed` / `result` (provider records: `call`, `output`, `item`, `inventory`), `cellLink` / `callSiteLink` (`explicit_id` | `turn_window` | `content` | `unresolved`). A `tools.x(...)` call site is never evidence that something ran; script children stay `unknown`
- **Provenance in the details panel** (`codexProvenanceModel.ts`, rendered by `CodexProvenance.tsx`): the domain id (`<cell>:<n>` for script call sites, which is never a provider id), the observed/result records with type, provider call or item id (labelled by record kind) and rollout line, the script call site, and each correlation method with its meaning. Built from `evidence` only; it adds no link the parser did not record
- **Nested operations** are persisted as `item_completed` items (CommandExecution, FileChange, McpToolCall, WebSearch, Extension) with ids `exec-<uuid>` that match no call; real producers write no `executed_tool_calls`/`cell_id`. An item is attached to a cell only if it is the only running cell of the item's turn (`turn_window`), else it stays top-level and unlinked. Items whose id equals a call id (e.g. `js` → McpToolCall, `sleep` → Extension) link explicitly. Script call sites link to a recorded command only on unique identical command text (`content`)
- **Cells' running window**: opened by the call, kept open by `Script running with cell ID` (yield) and `notify()` outputs (they carry `name`), closed by a terminal header, a header-less output, a `wait` reporting completion, or turn end
- **Durations** keep their source (`durationSource`): `reported` (duration field or header wall time) vs `provider_timestamps` (`started_at_ms`/`completed_at_ms`) vs `record_timestamps` (envelope times)
- **Subagent forks**: the copied parent history (`InheritedHistoryTracker`) is summarized by one `inherited_context` timeline entry and excluded from executions, title and model. It ends at `session_meta.subagent_history_start_ordinal` or at the first own-history marker (`thread_settings_applied` for the rollout's thread, or a UUIDv7 turn id minted after the thread id), whichever comes first: migrated legacy subagent rollouts declare a boundary equal to their record count
- **Subagent titles**: own history has no user message; the title is the task name (last segment of the recipient of the first own `agent_message` right after `inter_agent_communication_metadata {trigger_turn: true}`), `titleSource: 'agent_task'`. The task text is encrypted and never decoded
- **Hosted web search**: the `WebSearch` item is persisted one record before its `web_search_call`; a call adopts an unclaimed top-level item with the same id (`explicit_id`). Calls without an id stay separate from their items
- **Harness messages** without a status header: `Command blocked by PreToolUse hook: …` → declined (no exit code applies), `Wall time … / aborted by user` → interrupted, `write_stdin failed: …` → failed
- **Reasoning**: only the readable summary is shown; `encrypted_content` is stripped at parse time and never decoded
- **Command tags**: `commandActions` are Codex's own `parsed_cmd` classification (`read`, `list_files`, `search`, `unknown`; other types kept verbatim) from `CommandExecution` items and legacy `exec_command_end`, also when the item is merged into a script call site. Codex persists it for few commands; never derive tags from command text. `unknown` shows in the details only and is not counted
- **File writes**: patch executions are labelled "file write"; `fileWrites` (`path`, `change`, `movedTo`) come from the call's own patch headers (`extractPatchWrites`), else from the `changes` map of `FileChange` / `patch_apply_end`. A file-change record linked to a non-patch call (e.g. a shell call that ran a patch) sets `fileWrites`, `fileChangeStatus` and `evidence.fileChange`, never the call's own status or result. `stats.filesWritten` counts distinct final paths of writes Codex recorded as applied, whatever the execution kind (`hasAppliedFileWrites`: completed file-change record, else a completed patch); never inferred from command text
- **Runtime state** (`CodexRuntimeState.ts` → `AgentSessionDetail.runtime`, types in `src/main/domain/RuntimeState.ts`; rules and exceptions in `docs/ARCHITECTURE.md` "Runtime state"): a turn's effective settings are its first `turn_context` (identical re-emissions after compaction are ignored; a differing one keeps the first and adds a warning with lines and keys only). `thread_settings_applied` for the own thread is diffed against the previous thread settings (known fields, first record = baseline, identical repeats add nothing) into `settings_change` entries (`source: 'thread_settings_applied'`, `appliesTo` `next_turn` / `first_turn`); the running turn's state never changes. Turn boundaries with no thread settings recorded before the earlier turn get `turn_context_diff` entries (`this_turn`), shown dashed and never as Codex events. Decided per file and boundary, never by CLI version. Keep `turnSummary` (`summary`) apart from `reasoningSummary`; `serviceTier` is thread-only; Windows cwd compared case/separator-insensitively, shown as written; only the `workspace_roots` count is kept. Executions get their turn's state through `turnId` (`TurnRuntimeContext`), never a copy
- **Subagent navigation** (`CodexSpawnObservations.ts` → `CodexSessionRelations.ts` → `AgentSessionRelations`, types in `src/main/domain/SessionRelation.ts`; rules in `docs/ARCHITECTURE.md` "Subagent sessions"): the only relation is the id chain verified 22/22 on the real corpus — `spawn_agent` `call_id` = `SubAgentActivity` (`kind: started`) `id`, whose `agent_thread_id` = the child rollout's `session_meta.id`. Parent → child: the one rollout file of that thread. Child → parent: the declared parent thread (`parent_thread_id` / `thread_spawn.parent_thread_id`) only narrows candidate files; the parent is the one whose own history holds the chain. `missing_session` / `ambiguous` / `unresolved` are kept, never guessed; only `resolved` navigates, by viewer session id (one thread can span several rollout files). Never identity: timestamps, `session_id`, parent thread alone, `agent_path`/names, other activity kinds, `CollabAgentToolCall`. Own history only (`InheritedHistoryTracker`). Relation evidence is separate from `Execution.evidence`. Listing reads no spawn records; a relation request reuses the detail's parsed records or reads with a byte pre-filter, incrementally
- **Live rollout**: modified within 10 minutes; `turnInProgress` from the tail of the file. The renderer follows it (`codexFollowLive`) until the user picks another session; relations are refetched (throttled) on every rollout change
- **IPC**: `codex:listSessions`, `codex:getSessionDetail` (fingerprint → `{ unchanged: true }`), `codex:getSessionRelations`, event `codex:session-change`; HTTP `/api/codex/*` (`sessions`, `session`, `relations`) + SSE in standalone mode
- **Survey**: `pnpm exec tsx scripts/codex-rollout-survey.ts [--all]` runs the scanner/reader/normalizer over real rollouts and writes a content-free report (types, fields, evidence classes, anomalies by kind and CLI version, with line locations, timings); `--from-transcripts tests/fixtures/codex/real-observed` surveys sanitized transcripts. Use it to check a new Codex version before changing the parser. Its last section, *Runtime state and relationships* (`scripts/codex-rollout-state.ts`), reports settings fields and their changes by CLI version (`turn_context`, `thread_settings_applied`, `session_meta`, `world_state`), how `thread_settings_applied` relates to the next `turn_context`, `token_usage_record` relations, turn lifecycle fields and subagent join methods; own history only, values only for allowlisted enum-like settings
- **Real evidence first**: `tests/fixtures/codex/real-observed/` (sanitized real records, `test/main/providers/codex/realObserved.test.ts`) outrank the synthetic fixtures in `test/fixtures/codex/`, which are regression tests, not compatibility proof

## Privacy & Local HTTP
- **HTTP server is local-only by default** (`src/main/http/hostPolicy.ts`): binds `127.0.0.1` (standalone `HOST` overrides), rejects any request whose `Host` is not `localhost` / `127.0.0.0/8` / `[::1]` / an `ALLOWED_HOSTS` entry with 403 before any route, CORS limited to localhost origins unless `CORS_ORIGIN` is set. No authentication exists; never make non-loopback serving a default
- **Markdown images in session content are not fetched** (`MarkdownImage`): every `ReactMarkdown` component map renders them as links to open explicitly
- **Real-derived fixtures** (`tests/fixtures/codex/real-observed/`) follow sanitizer contract v2 (`scripts/codex-rollout-transcript.ts`): free text → `<string:N>`, chosen names and model names → deterministic aliases (`/root/<task-1>`, `<agent-1>`, `<model-1>`). Regenerate or `--resanitize` through the script, never by hand; `test/scripts/codexRolloutTranscript.test.ts` fails if a committed fixture would change under the current rules

## Error Handling
- Main: try/catch, console.error, return safe defaults
- Renderer: error state in Zustand store
- IPC: parameter validation, graceful degradation

## Performance
- LRU Cache: Avoid re-parsing large JSONL files
- Streaming JSONL: Line-by-line processing
- Virtual Scrolling: For large session/message lists
- Debounced File Watching: 100ms debounce

## Troubleshooting

### Build Issues
```bash
rm -rf dist dist-electron node_modules
pnpm install
pnpm build
```

### Type Errors
```bash
pnpm typecheck
```

### Test Failures
Check for changes in message parsing or chunk building logic.

## TypeScript Conventions

### Naming
| Category | Convention | Example |
|----------|------------|---------|
| Services/Components | PascalCase | `ProjectScanner.ts` |
| Utilities | camelCase | `pathDecoder.ts` |
| Constants | UPPER_SNAKE_CASE | `PARALLEL_WINDOW_MS` |
| Type Guards | isXxx | `isRealUserMessage()` |
| Builders | buildXxx | `buildChunks()` |
| Getters | getXxx | `getResponses()` |

### Type Guards
```typescript
// Message type guards (src/main/types/messages.ts)
isParsedRealUserMessage(msg)      // isMeta: false, string content
isParsedInternalUserMessage(msg)  // isMeta: true, array content
isAssistantMessage(msg)           // type: "assistant"

// Chunk type guards
isUserChunk(chunk)          // type: "user"
isAIChunk(chunk)            // type: "ai"
isSystemChunk(chunk)        // type: "system"
isCompactChunk(chunk)       // type: "compact"

// Context injection type guards (component-scoped in ContextBadge.tsx, not exported)
isClaudeMdInjection(inj)          // category: "claude-md"
isMentionedFileInjection(inj)     // category: "mentioned-file"
isToolOutputInjection(inj)        // category: "tool-output"
isThinkingTextInjection(inj)      // category: "thinking-text"
isTeamCoordinationInjection(inj)  // category: "team-coordination"
isUserMessageInjection(inj)       // category: "user-message"
```

### Barrel Exports
`src/main/services/` and its domain subdirectories have barrel exports via index.ts:
```typescript
// Preferred
import { ChunkBuilder, ProjectScanner } from './services';
// Also valid
import { ChunkBuilder } from './services/analysis';
```
Note: renderer utils/hooks/types do NOT have barrel exports — import directly from files.

### Import Order
1. External packages
2. Path aliases (@main, @renderer, @shared)
3. Relative imports
