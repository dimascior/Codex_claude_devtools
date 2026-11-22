# claude-devtools

Session viewer and debugging tool for **Claude Code** and **Codex CLI** sessions.

Reads session transcripts from `~/.claude/projects/` and Codex rollouts from `~/.codex/sessions/`, reconstructs the full execution timeline, and shows everything the terminal hides: thinking steps, tool calls, file edits, permission decisions, subagent activity, and token usage.

## Providers

| Provider | Sessions Location | Format |
|---|---|---|
| **Claude Code** | `~/.claude/projects/<encoded-path>/` | JSONL transcripts |
| **Codex CLI** | `~/.codex/sessions/YYYY/MM/DD/` | Rollout JSONL (plain or zstd) |

Both providers are scanned automatically on startup. File watchers detect new and changed sessions in real time.

## Features

**Claude Code sessions:**
- Full message timeline with thinking steps, tool calls, and results
- Inline diffs for file edits with syntax highlighting
- Subagent tree navigation (parent/child session linking)
- Token usage breakdown per message and cumulative
- Context injection tracking
- Session state detection (ongoing, completed, interrupted)

**Codex sessions:**
- Execution timeline with command tags and file changes
- Code cell analysis with tool call extraction
- Runtime state tracking (effective settings per turn, settings changes)
- Subagent spawn observation and parent-child navigation
- Rollout metadata extraction (model, thread, timestamps)
- Compressed rollout support (zstd)

**Shared:**
- Project grouping by git repository (worktrees grouped with parent)
- Full-text search across all sessions
- Notification system with custom triggers
- Dark/light theme
- SSH remote host support

## Install

```bash
# Clone and install
git clone https://github.com/dimascior/Codex_claude_devtools.git
cd Codex_claude_devtools
pnpm install

# Development
pnpm dev

# Build
pnpm build
```

## Usage

Launch the app. The sidebar shows projects grouped by repository. Click a project to see its sessions, click a session to see its full transcript.

**Codex sessions** are in a separate tab — click the Codex icon in the tab bar or use the menu.

### Autobot integration

When used with [Autobot](https://github.com/dimascior/Autobot), specialist sessions from isolated worktrees are automatically consolidated to the parent project directory. All specialist transcripts appear under one project — research, architecture, security review, verification — with the full execution context visible.

### Standalone mode

The main process can run without Electron for scripting and debugging:

```bash
node dist-electron/main/index.cjs --standalone
```

## Architecture

```text
src/
  main/
    providers/codex/   Codex CLI rollout provider
    services/          Claude Code session services
    http/              HTTP API (Fastify)
    ipc/               Electron IPC handlers
  renderer/
    components/
      chat/            Claude Code session viewer
      codex/           Codex rollout viewer
      sidebar/         Project navigation
```

The main process reads session files and serves them through both IPC (Electron) and HTTP (standalone/remote). The renderer is a React app.

## License

MIT
