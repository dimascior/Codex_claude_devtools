/**
 * Provider-neutral domain model shared by all session providers.
 *
 * Providers (see `src/main/providers/`) normalize their on-disk formats into
 * these types; the renderer consumes them via `@shared/types`.
 */

export type * from './Execution';
export type * from './Message';
export type * from './RuntimeState';
export type * from './Session';
export type * from './SessionRelation';
