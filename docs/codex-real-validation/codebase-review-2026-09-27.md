# Codex Adaptation Review, 2026-09-27

Review of the collector's commit `808033a` (full-corpus verification) and a
focused review of the whole Codex adaptation, followed by the corrections made
in the commit that adds this document. Evidence tags are those of
`local-full-corpus-verification-2026-09-27.md`. Upstream references are to the
`openai/codex` tag `rust-v0.153.0` unless noted.

## 1. `808033a`: the nine review properties

| # | Property | Verdict | Basis |
|---|---|---|---|
| 1 | `InheritedHistoryTracker` is deterministic | Holds | A one-way latch over the record sequence; its only other input is the first `session_meta` (later ones are ignored by both callers). A new tracker is built per normalization and per head read, and `CodexSessionService` re-normalizes the whole cached record list on every read, so incremental reads cannot change a decision. |
| 2 | UUID timestamps are compared only where the id format proves they apply | Held only partly; fixed | `uuidV7Millis` accepted any string starting with a v7-looking prefix (`01a08b57-0000-7000-zzzz` was read as a timestamp and ended the prefix). It now requires a canonical RFC 9562 UUIDv7 (version 7, variant `10xx`, full length). |
| 3 | Invalid or non-v7 ids fail conservatively | Holds after the fix | Without a timestamp the turn-id marker is not used; the declared boundary and the `thread_settings_applied` marker still apply (test: v4 thread id falls back to the declared boundary). |
| 4 | Scanner and normalizer share the same semantics | Same rule, two gaps; fixed | Both feed the same tracker in the same record order. (a) Regression: the session detail's summary lost `inheritedRecordCount` because `CodexSessionService` built it without one (the list had it). (b) The scanner reads at most 400 lines; for a longer copied prefix it reported a partial count. The detail now carries the normalizer's count, and the list reports none when its read ended inside the prefix. |
| 5 | Web-search adoption cannot merge unrelated items | Held only by id convention; fixed | Any item-created execution with the call's id qualified. Now only a top-level `WebSearch` item that no call has claimed is adopted. |
| 6 | `byItemId` / `byCallId` stay consistent | Holds | Adoption registers the call id on the item's execution. Calls without an id are registered under none. A repeated call id creates a new execution, as for every other call type (latest registration wins). |
| 7 | No item is rendered twice | Holds | Adoption returns no new timeline entry (fixture lines 155/156 are one execution; synthetic test). |
| 8 | Provenance survives the merge | Holds; two presentation fixes | `observed` is the call record, `result` the item record, both with line and id, plus an `explicit_id` link with its reason. The details panel labelled this top-level link "Cell link" although no cell is involved (now "Attribution" for top-level records), and a call without an `action` overwrote the item's arguments with `{}` (now kept). |
| 9 | Unresolved records remain visible | Holds | Id-less calls and their items stay separate executions; the items keep `unresolved` and the "unlinked record" badge and are counted in `stats.unattributed`. |

Verdict: `808033a` is architecturally sound. The tracker's behaviour is kept
unchanged; the corrections above are local.

## 2. Pattern B explained by upstream source

UPSTREAM SOURCE ONLY, consistent with the committed fixtures:

- Pattern A is how a child is created today: `LiveThread::create_with_inherited_model_context`
  (`thread-store/src/live_thread.rs:115-140`) sets
  `subagent_history_start_ordinal = persisted prefix count + 1`, writes the
  child's `session_meta` (ordinal 0), then the copied prefix; the child's own
  records follow at the boundary.
- Pattern B is a migrated legacy subagent rollout. For
  `RolloutMigrationKind::Subagent` (`thread-store/src/local/rollout_migration.rs:469`,
  `:714-736`) the migration writes the legacy content (a bounded model-context
  replay or a full replay) and then calls `rewrite_subagent_history_boundary`
  (`rollout_migration/publish.rs:157-179`) with the next ordinal after the last
  migrated record. The boundary therefore equals the record count. The
  canonicalizer drops additional `session_meta` lines
  (`rollout_migration/canonicalizer.rs:116`), which is why Pattern B files have
  one `session_meta` and Pattern A files two. "Legacy subagents copied the
  parent's full rollout into every child rollout" (`rollout_migration/subagent.rs:3`).
- In a migrated file the boundary separates pre-migration from post-migration
  records, not parent from child. Upstream projects no thread-history items
  below it (`thread_history_materialization.rs:213`), so upstream hides the
  child's own pre-migration turns as well. This viewer shows them: the
  tracker's structural markers separate the parent-era prefix from the child's
  own records, which is what the collector verified on all 22 files.
- The migration keeps the original `session_meta` apart from the history
  fields (`canonicalizer.rs` `write_head_session_meta`), so `cli_version` is
  the original writer's and the pattern cannot be keyed to a version. The
  tracker is not rewritten.
- That these 10 particular files went through the migration is an inference:
  the rollout does not record it. It needs local inspection (for example the
  Codex state database, where migration marks each thread paginated).

## 3. Decision: subagent titles (implemented)

Evidence:

- Upstream `InterAgentCommunication::to_model_input_item`
  (`protocol/src/protocol.rs:881-905`): with encrypted content, the readable
  part of the `agent_message` is only
  `Message Type: NEW_TASK|MESSAGE\nTask name: <recipient>\nSender: <author>\nPayload:\n`
  (`NEW_TASK` when `trigger_turn`); the task text is encrypted.
- `Session::record_inter_agent_communication` (`core/src/session/mod.rs:3651-3677`)
  persists `inter_agent_communication_metadata {trigger_turn}` and the message
  in one write, so they are adjacent.
- A spawned agent's path is its parent's path joined with the required
  `task_name` argument of `spawn_agent` (`core/src/tools/handlers/multi_agents_common.rs:111-131`,
  `multi_agents_spec.rs:118`).
- VERIFIED SANITIZED: in both subagent fixtures the task message directly
  follows `trigger_turn: true` metadata, and its readable text is 91 and 90
  characters, exactly the length of the `NEW_TASK` header for its author and
  recipient (the `MESSAGE` header would be one shorter).

Rule (`SubagentTaskNameFinder`, used by both the normalizer and the scanner):
for subagent sessions, the title is the last segment of the recipient path of
the first own `agent_message` that immediately follows
`inter_agent_communication_metadata` with `trigger_turn: true`. A user message
still takes precedence. Only records after the inherited prefix are seen, so an
inherited prompt is never used. The source is explicit (`titleSource:
'agent_task'`), the UI marks it as a task name, and it is kept apart from
execution evidence. The encrypted task text is not decoded. Producers that do
not write the metadata record get no title.

The same review found that the task message rendered as a "Codex" message
ending in a bare `Payload:`; it is now an inter-agent message marked "payload
encrypted / not shown" (`AgentMessageEntry.encrypted`).

## 4. Decision: hosted web search without an id (option A, keep separate)

The 10 cli 0.137/0.140 pairs share no identifier; the call carries no turn id
either. The only relation is adjacency (item one record before the call) and an
equal action type, which is STRUCTURAL INFERENCE. A weaker correlation class
would still be adjacency-based, which this project does not use to link
records. Newer producers (0.142.5) record the id and are linked explicitly, so
the cost of keeping them apart is two rows for each of 10 records from two old
alpha versions. Both rows stay visible; the item is marked unlinked.

## 5. `SubAgentActivity` completed events

VERIFIED RAW by the collector: `started`/`interacted`/`interrupted` items carry
the id of the collaboration call (`spawn_agent`, `send_message`/`followup_task`,
`interrupt_agent`); the 30 `completed` items carry `subagent-completed-<uuid>`
and match no call. They are lifecycle events, not tool calls. The parser renders
the collaboration calls themselves as executions and deliberately ignores
`SubAgentActivity` items; `completed` is not linked to a spawn (only
`agent_thread_id` relates them, STRUCTURAL INFERENCE).

## 6. Defects found and corrected

| Defect | Introduced | Correction | Regression test |
|---|---|---|---|
| Session detail summary had no `inheritedRecordCount` | `808033a` | The normalizer returns the count; the service passes it | `realObserved.test.ts` list/detail parity, both subagent fixtures |
| List count was partial when the copied prefix exceeded the 400-line head read | `808033a` | Count reported only when the read saw the prefix end or the whole file | `CodexSessionService.test.ts` 450-record prefix |
| `uuidV7Millis` accepted malformed ids with a v7-looking prefix | `808033a` | Full RFC 9562 v7 pattern | `CodexMetadataParser.test.ts` |
| Adoption accepted any item type sharing the call's id | `808033a` | Only an unclaimed top-level `WebSearch` item | `evidenceLinking.test.ts` |
| Adoption replaced the item's arguments with `{}` when the call had no `action` | `808033a` | Arguments replaced only when the call has an action | same |
| Top-level `explicit_id` link shown as "Cell link" | `808033a` (label from `7f38892`) | "Attribution" for top-level records | `codexFormatting.test.ts` |
| An inter-agent `agent_message` made the normalizer discard assistant replies recorded only as `item_completed` events | original implementation | Inter-agent messages kept in their own list | `CodexExecutionNormalizer.test.ts` |
| The last record before the reader's line cap was never offered to `stopWhen` | original implementation | `stopWhen` evaluated before the cap | `CodexRolloutParser.test.ts` |
| `isInheritedRecord` exported but no longer used outside the tracker (knip) | `808033a` | Module-internal `isBelowDeclaredBoundary` | knip |
| Subagent task message shown as a "Codex" message with a bare `Payload:`; subagents listed as "(no request recorded yet)" | original implementation | Section 3 | `realObserved.test.ts` titles and task entries |

Every regression test was run against the code without its correction and
fails there.

## 7. Remaining unresolved compatibility cases

- 6 exec cells without a result (rollouts that ended mid-turn or whose turn was
  superseded): shown as outcome unknown.
- 6 `exec-` items recorded between two cells of one turn: unattributed. (The 28
  in inherited prefixes are excluded with the prefix.)
- 10 hosted search calls without an id and their items: unlinked (section 4).
- 30 `SubAgentActivity completed` events: lifecycle only (section 5).
- A migrated (Pattern B) file whose own history has neither a
  `thread_settings_applied` for its thread nor a UUIDv7 turn minted after its
  thread id would be shown entirely as inherited, as upstream does. Not observed.
- Subagents from producers without `inter_agent_communication_metadata` get no
  title; the task text is always encrypted.
- Script call sites without a recorded result stay "script only" (static
  analysis).

## 8. Existing risks not changed here (follow-ups)

- Large sessions. A 70,000-record rollout built from the sanitized records
  normalizes in about 0.5 s and yields about 38,000 timeline entries and 21 MB
  of detail JSON. Every live change re-normalizes and re-sends the whole detail,
  and the timeline renders every entry (CSS `content-visibility` limits layout
  cost, not React work). The Codex timeline and session list do not use
  `@tanstack/react-virtual`, which the renderer conventions ask for lists of
  more than 100 items. The parsed-record cache holds up to 4 sessions
  regardless of size. Follow-up: virtualized timeline and session list,
  structural sharing or incremental normalization, and a byte-bounded cache.
- HTTP API. The Codex routes share the existing server's exposure: standalone
  mode binds `0.0.0.0` without authentication by default; the in-app server
  binds `127.0.0.1` and allows localhost origins only, but does not check the
  `Host` header, so a DNS-rebinding page could read `/api/codex/*` as it could
  the existing `/api/*` session routes. Follow-up: a `Host` allowlist for the
  in-app server.
- Sanitizer consistency. The fixtures keep `agent_message.author`/`recipient`
  (agent paths that contain the task names) but replace the same path in
  `session_meta.agent_path`. Confirm that task names are acceptable to publish.
- The session list takes the model from the first own `turn_context`, the
  detail view from the last one.

## 9. Validation

Linux, Node 22.22.2:

| Check | At `808033a` | After the corrections |
|---|---|---|
| `pnpm typecheck` | clean | clean |
| `pnpm lint` | 0 errors, 5 existing warnings | 0 errors, the same 5 warnings |
| `pnpm test` | 64 files, 843 passed | 65 files, 859 passed |
| `pnpm build` | ok | ok |
| `pnpm format:check` (`src/**`) | 19 existing files | the same 19; no changed file |
| Prettier on changed `.ts`/`.tsx` files | test file unformatted | clean |
| `npx knip` | `isInheritedRecord` unused export, plus existing items | existing items only |

The collector's 842 passed + 1 skipped is the same 843 tests: the skipped one
is the zstd test (`it.runIf(isZstdSupported())`), which needs a Node with
`zlib.createZstdDecompress`. The transcript survey
(`--from-transcripts tests/fixtures/codex/real-observed`) runs and reports the
two subagent transcripts titled by task name, 10 hosted search pairs linked by
id and the 3 id-less calls and items unlinked.
