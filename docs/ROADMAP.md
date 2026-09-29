# Roadmap

Follow-up work for the standalone Claude/Codex session viewer, in priority
order. Each item is scoped on its own; none is required for the current
Codex provider to be correct.

## 1. Large-session performance

Real Codex corpora already contain sessions large enough to strain the current
design (the largest real rollout observed was about 107 MB and 70,000 lines).
A 70,000-record rollout built from the sanitized real records normalizes in
about 0.5 s and produces about 38,000 timeline entries and 21 MB of detail
JSON (see `docs/codex-real-validation/codebase-review-2026-09-27.md`).

```
large JSONL rollout
      ↓
full normalization on every change
      ↓
tens of thousands of timeline entries
      ↓
the whole detail sent over IPC/HTTP on every change
      ↓
every entry rendered (React work for all of them)
```

Scope of the next phase:

- **Timeline virtualization** with `@tanstack/react-virtual` (the renderer
  convention for lists over 100 items), keeping expandable cards, search and
  stable live-follow scrolling. The Codex session list needs the same.
- **Incremental session updates**: send only entries added or changed since the
  renderer's fingerprint instead of the whole normalized session. Rollouts are
  append-only, but late records (outputs, items, turn ends) update earlier
  executions, so a delta needs stable entry ids and "changed entry" semantics,
  not only appended ones.
- **Incremental normalization**: resume the normalizer from the last complete
  turn instead of re-running it over all cached records.
- **Lazy details**: load large outputs, scripts and patches when an execution is
  expanded rather than with the session.
- **Bounded memory**: cap the parsed-record cache by bytes instead of by session
  count, and measure renderer memory with the largest real sessions.

Acceptance: the largest real session opens and follows live without long main-
or renderer-thread stalls, with the full real-observed regression suite and the
incremental-vs-full parse equivalence tests unchanged.

## 2. Other follow-ups

- **Remote access**: the HTTP server has no authentication and is local-only by
  default. Serving other machines safely needs an authentication mechanism
  (token or proxy-based), not only a bind address.
- **Codex search and export**: text search within a Codex session and export of
  the normalized session, matching what the Claude view offers.
- **Provider layout**: move the Claude reader behind `src/main/providers/claude/`
  to mirror the Codex provider, without changing its behaviour.
- **List/detail parity**: the Codex session list shows the model of a
  session's first turn context (read from the head of the file), while the
  detail header shows the latest effective turn state (the first `turn_context`
  of the last turn). Making the list agree needs the tail of each rollout, not
  only its head, so it is left for the large-session work above.
