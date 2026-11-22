/**
 * Session providers.
 *
 * Each provider discovers one agent runtime's persisted sessions and
 * normalizes them into the provider-neutral domain in `@main/domain`.
 * Claude Code sessions are still served by `src/main/services`; Codex is the
 * first provider built on the normalized domain.
 */

export * from './codex';
