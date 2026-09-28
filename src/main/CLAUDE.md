# Main Process

Node.js runtime handling file system, IPC, and app lifecycle.

## Structure
- `index.ts` - App entry point, lifecycle management
- `ipc/` - IPC handlers organized by domain
- `services/` - Business logic by domain
- `domain/` - Provider-neutral session model (`Execution`, `TimelineEntry`, `AgentSession*`), re-exported via `@shared/types`
- `providers/codex/` - Codex CLI rollout provider (scanner, parsers, normalizer, `CodexSessionService`)
- `types/` - Type definitions
- `utils/` - Utility functions
- `constants/` - Shared constants (messageTags, worktreePatterns)

## IPC Organization
Handlers in `ipc/` by domain:
- `projects.ts` - Project listing
- `sessions.ts` - Session operations
- `search.ts` - Search functionality
- `subagents.ts` - Subagent details
- `validation.ts` - Path validation
- `utility.ts` - Shell & file operations
- `config.ts` - Configuration
- `notifications.ts` - Notifications
- `codex.ts` - Codex rollout listing and session detail

## Adding IPC Handler
1. Add to domain file in `ipc/`
2. If new domain, create file and register in `handlers.ts`
3. Add type in `preload/index.ts`
4. Implement in appropriate service

## File Watching
FileWatcher service monitors session files with 100ms debounce.
Notifies renderer of changes via IPC events.

`CodexSessionWatcher` watches `$CODEX_HOME/sessions` recursively (100ms per-file debounce, plus a
catch-up poll of today's and yesterday's date directories); `CodexSessionService` forwards changes
as `codex:session-change` (IPC) and SSE events (HTTP server).

## Codex Provider (`providers/codex/`)
| File | Role |
|------|------|
| `codexPaths.ts` | `$CODEX_HOME` resolution, session id ↔ path (ids are validated relative paths) |
| `CodexRolloutParser.ts` | Streaming line reader (plain/zstd), envelope + legacy normalization, payload sanitization |
| `CodexMetadataParser.ts` | `session_meta` parsing, project key/name from cwd, injected-context detection, subagent inherited-history tracking and task names |
| `CodexEventParser.ts` | `event_msg` parsing incl. paginated `item_completed` TurnItems (`parsed_cmd` tags, file changes) |
| `CodexExecutionParser.ts` | Call/output correlation into `Execution`s (unified exec polls, code cells, patches) |
| `codeCell.ts` | Static analysis of code-mode scripts (`tools.x({...})` calls) |
| `execOutput.ts` | Output header parsing (exit code, wall time, process/cell ids) |
| `shellCommand.ts` | argv display (unwraps `bash -lc`, PowerShell `-Command`, `cmd /c`) |
| `CodexExecutionNormalizer.ts` | `normalizeCodexRollout()` → timeline, executions, stats, token usage |
| `CodexScanner.ts` | Rollout discovery, head metadata cache, live selection, project grouping |
| `CodexSessionService.ts` | Entry point for IPC/HTTP: cached, incremental session detail |
