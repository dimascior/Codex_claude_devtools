/**
 * Codex provider - reads Codex CLI rollouts (`$CODEX_HOME/sessions`) and
 * normalizes them into the provider-neutral domain (`@main/domain`).
 *
 * Pipeline: CodexScanner (discovery) → CodexRolloutParser (records) →
 * CodexExecutionNormalizer (+ CodexExecutionParser, CodexEventParser,
 * CodexMetadataParser) → AgentSessionDetail. Session relations:
 * CodexSpawnObservations (spawn call ↔ started SubAgentActivity) →
 * CodexSessionRelations → AgentSessionRelations. CodexSessionService is the
 * entry point used by IPC and HTTP handlers.
 */

export { CodexSessionService } from './CodexSessionService';
