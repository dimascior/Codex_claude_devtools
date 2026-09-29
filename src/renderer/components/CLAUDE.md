# Components

UI components organized by feature domain.

## Structure
```
components/
├── chat/                    # Session message display
│   ├── items/               # Individual message/tool items
│   │   ├── linkedTool/      # Tool call/result display helpers
│   │   ├── BaseItem         # Base item wrapper
│   │   ├── baseItemHelpers  # Base item utility functions
│   │   ├── ExecutionTrace   # Execution trace display
│   │   ├── LinkedToolItem   # Tool call with linked result
│   │   ├── MetricsPill      # Metrics badge display
│   │   ├── SlashItem        # Slash command display
│   │   ├── SubagentItem     # Subagent execution display
│   │   ├── TeammateMessageItem  # Team message cards
│   │   ├── ThinkingItem     # Extended thinking display
│   │   └── TextItem         # Text output display
│   ├── viewers/             # Content viewers (JSON, code, diff)
│   ├── SessionContextPanel/ # Visible context tracking panel
│   │   ├── components/      # Section wrappers (ClaudeMdFilesSection, ToolOutputsSection, UserMessagesSection, etc.)
│   │   ├── items/           # Per-injection item renderers (ClaudeMdItem, ToolOutputItem, UserMessageItem, etc.)
│   │   ├── DirectoryTree/   # CLAUDE.md directory navigation
│   │   ├── utils/           # Formatting helpers
│   │   ├── index.tsx        # Main panel component
│   │   └── types.ts         # SectionType constants, panel props
│   ├── AIChatGroup.tsx      # AI response group display
│   ├── ChatHistory.tsx      # Chat timeline container
│   ├── ChatHistoryEmptyState.tsx  # Empty state display
│   ├── ChatHistoryItem.tsx  # Individual history item
│   ├── ChatHistoryLoadingState.tsx # Loading state display
│   ├── CompactBoundary.tsx  # Compaction event boundary marker
│   ├── ContextBadge.tsx     # Per-turn context injection popover badge
│   ├── DisplayItemList.tsx  # Display item list rendering
│   ├── LastOutputDisplay.tsx # Last output display
│   ├── SystemChatGroup.tsx  # System message group display
│   ├── UserChatGroup.tsx    # User message display
│   ├── markdownComponents.tsx # Custom markdown renderers
│   └── searchHighlightUtils.ts # Search highlight utilities
├── codex/                   # Codex rollout viewer (tab type 'codex')
│   ├── CodexView            # Session list + timeline layout, periodic refresh
│   ├── CodexSessionList     # Rollouts grouped by project, live dot, follow-live toggle
│   ├── CodexSessionHeader   # Session badges, "Spawned by" line, runtime line, execution stats, tokens, timeline filter
│   ├── CodexRuntimeSummary  # Header runtime: latest effective turn state (model, effort, approval, sandbox, profile) + "more"
│   ├── CodexTimeline        # Chronological entries, auto-scroll while following live, TurnRuntimeContext + CodexRelationsContext providers, focus on a spawn call
│   ├── CodexSettingsChangeItem # Settings change: recorded (solid) vs derived turn_context_diff (dashed), previous → next
│   ├── CodexExecutionCard   # One execution (command, code cell, file write, tool); spawn cards show their child session
│   ├── CodexExecutionDetails # Facts grid (incl. files written, Codex tags), provenance, session relation, effective runtime, argv, script, patch, args, output
│   ├── CodexChildSessionLink # Spawn card: child session + "Open child" (resolved relations only), else a status line
│   ├── CodexParentSessionLink # Subagent header: "Spawned by" + "Open parent" (opens the parent at its spawn call), evidence toggle
│   ├── CodexRelationDetails # Session relation evidence: explicit provider ID chain, spawn call, started record, threads, lines, candidates
│   ├── codexRelationFormatting.ts # Relation names, status lines and evidence rows
│   ├── codexRelationsContext.ts # CodexRelationsContext: spawned-child relations by spawn execution id, openRelated
│   ├── CodexProvenance      # Domain id, provider records (type, provider id, line), script call site, correlation methods
│   ├── codexProvenanceModel.ts # Provenance groups and evidence class, built from Execution.evidence only
│   ├── CodexRuntimeDetails  # "Effective runtime" of the execution's turn (via turnId), apart from provenance
│   ├── codexRuntimeContext.ts # TurnRuntimeContext: turn states by turn id
│   ├── codexRuntimeFormatting.ts # Setting labels/values, current runtime, settings-change wording
│   ├── CodexNestedExecutions # Code-cell children as a tree
│   ├── CodexCommandActions  # Codex's recorded read / list / search tags (parsed_cmd)
│   ├── CodexStatusBadge / CodexOutputBlock / CodexPatchView
│   ├── CodexMessageItem / CodexReasoningItem / CodexEventItem
│   └── codexFormatting.ts   # Status labels, icons, summaries, filterTimeline
├── common/                  # Shared UI primitives
│   ├── CopyButton           # Copy to clipboard button
│   ├── CopyablePath         # Clickable, copyable file path
│   ├── ErrorBoundary        # React error boundary
│   ├── OngoingIndicator     # Session in-progress indicator
│   ├── RepositoryDropdown   # Repository selector dropdown
│   ├── TokenUsageDisplay    # Token breakdown with context stats hover
│   └── WorktreeBadge        # Git worktree badge
├── dashboard/               # Overview and listing pages
├── layout/                  # App shell, sidebars, headers
├── notifications/           # Notification panels and badges
├── search/                  # Search UI and results
├── settings/                # Settings pages and controls
│   ├── components/          # Reusable setting controls (SettingRow, SettingsToggle, etc.)
│   ├── hooks/               # Settings-specific hooks
│   ├── sections/            # Setting sections (General, Notifications, Advanced)
│   └── NotificationTriggerSettings/  # Trigger config UI
│       ├── components/      # Trigger form components
│       ├── hooks/           # Trigger form hooks
│       └── utils/           # Trigger utilities
└── sidebar/                 # Project/session navigation
```

## Adding Components
1. Choose appropriate parent directory by feature
2. If used across features, place in `common/`
3. Use Tailwind with theme-aware CSS variables
4. Connect to store via `useStore()` hook if needed
5. Colocate related hooks/utils in same directory

## Component Guidelines
- One component per file, PascalCase naming
- Use functional components with hooks
- Prefer composition over prop drilling
- Use `TabUIContext` for per-tab UI state

## Virtual Scrolling
Use `@tanstack/react-virtual` for lists > 100 items:
- Session lists in sidebar
- Message lists in chat view
