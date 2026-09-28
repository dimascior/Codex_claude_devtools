---
globs: ["test/**/*", "**/*.test.ts", "**/*.spec.ts"]
---

# Testing Conventions

## Test Framework
Uses Vitest with `happy-dom` environment. Config in `vitest.config.ts`.

## Test Commands
```bash
pnpm test                 # Run all vitest tests
pnpm test:watch           # Watch mode
pnpm test:coverage        # Coverage report
pnpm test:coverage:critical # Critical path coverage
pnpm test:chunks          # Chunk building tests
pnpm test:semantic        # Semantic step extraction
pnpm test:noise           # Noise filtering tests
pnpm test:task-filtering  # Task tool filtering
```

## Test Structure
```
test/
├── fixtures/
│   └── codex/           # Synthetic Codex rollouts (function calls, code mode, paginated, legacy)
├── main/
│   ├── http/            # Host policy (loopback bind, Host allowlist)
│   ├── ipc/             # IPC handler tests
│   │   ├── configValidation.test.ts
│   │   └── guards.test.ts
│   ├── providers/
│   │   └── codex/       # Rollout parsing, normalization, output/command parsing, session service,
│   │                    # realObserved (real fixtures), evidenceLinking (linking rules),
│   │                    # CodexMetadataParser (UUIDv7 ids, inherited history, subagent task names),
│   │                    # recordedActions (parsed_cmd tags, file writes)
│   ├── services/        # Service tests
│   │   ├── analysis/    (ChunkBuilder)
│   │   ├── discovery/   (ProjectPathResolver, SessionSearcher)
│   │   ├── infrastructure/ (FileWatcher, HttpServer local exposure)
│   │   └── parsing/     (MessageClassifier, SessionParser)
│   └── utils/           # Main process utilities
│       ├── jsonl.test.ts
│       ├── pathDecoder.test.ts
│       ├── pathValidation.test.ts
│       ├── regexValidation.test.ts
│       └── tokenizer.test.ts
├── renderer/
│   ├── components/      # Component helpers (codexFormatting, renderOutput, markdownImages)
│   ├── hooks/           # Hook tests
│   │   ├── navigationUtils.test.ts
│   │   ├── useAutoScrollBottom.test.ts
│   │   ├── useSearchContextNavigation.test.ts
│   │   └── useVisibleAIGroup.test.ts
│   ├── store/           # Zustand store slices
│   │   ├── codexSlice.test.ts
│   │   ├── notificationSlice.test.ts
│   │   ├── paneSlice.test.ts
│   │   ├── pathResolution.test.ts
│   │   ├── sessionSlice.test.ts
│   │   ├── tabSlice.test.ts
│   │   └── tabUISlice.test.ts
│   └── utils/           # Renderer utilities
│       ├── claudeMdTracker.test.ts
│       ├── dateGrouping.test.ts
│       ├── formatters.test.ts
│       └── pathUtils.test.ts
├── scripts/             # Fixture sanitizer contract (codexRolloutTranscript)
├── shared/
│   └── utils/           # Shared utilities
│       ├── markdownSearchRendererAlignment.test.ts
│       ├── markdownTextSearch.test.ts
│       ├── modelParser.test.ts
│       └── tokenFormatting.test.ts
├── mocks/               # Test fixtures and mocks
└── setup.ts             # Test setup/config
```

## Files to Test After Changes
- `services/analysis/ChunkBuilder.ts` - Chunk building logic
- `services/parsing/SessionParser.ts` - JSONL parsing
- `services/parsing/MessageClassifier.ts` - Message classification
- `providers/codex/*` - Codex rollout parsing and normalization (`test/main/providers/codex/`)
- Store slices in `src/renderer/store/slices/`
- Utility functions in `*/utils/`

## Test Data
Test fixtures use real JSONL session data from `~/.claude/projects/`.
Codex fixtures in `test/fixtures/codex/` are synthetic rollouts in the current envelope format (plus one legacy file): regression tests, not compatibility proof.
Sanitized records from real Codex rollouts live in `tests/fixtures/codex/real-observed/` (see `docs/codex-real-validation/`); they take precedence over synthetic fixtures. Never alter their topology to make a test pass.
