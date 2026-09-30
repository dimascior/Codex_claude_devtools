/**
 * CodexReasoningItem - Reasoning as Codex persisted it.
 *
 * Codex stores a readable summary alongside encrypted reasoning content. The
 * summary is shown; the encrypted part is reported as unavailable and is
 * never decoded.
 */

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

import { markdownComponents } from '@renderer/components/chat/markdownComponents';
import { Brain, ChevronRight, Lock } from 'lucide-react';
import remarkGfm from 'remark-gfm';

import type { ReasoningEntry } from '@shared/types';

interface CodexReasoningItemProps {
  entry: ReasoningEntry;
}

/** Summaries longer than this start collapsed to their first section. */
const COLLAPSE_THRESHOLD_CHARS = 600;

export const CodexReasoningItem = ({ entry }: CodexReasoningItemProps): React.JSX.Element => {
  const summary = entry.summary.join('\n\n');
  const isLong = summary.length > COLLAPSE_THRESHOLD_CHARS;
  const [expanded, setExpanded] = useState(!isLong);
  const [showRaw, setShowRaw] = useState(false);
  const visibleSummary = expanded ? summary : (entry.summary[0] ?? '');
  const hasRaw = (entry.content?.length ?? 0) > 0;

  return (
    <div
      className="rounded-lg px-3 py-2"
      style={{
        backgroundColor: 'var(--thinking-bg)',
        border: '1px solid var(--thinking-border)',
      }}
    >
      <div
        className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--thinking-text)' }}
      >
        <Brain className="size-3.5" />
        <span>Reasoning</span>
        {entry.encrypted && (
          <span
            className="inline-flex items-center gap-1 font-normal normal-case tracking-normal"
            title="Codex stored the full reasoning encrypted; only the summary is readable."
          >
            <Lock className="size-3" />
            encrypted
          </span>
        )}
      </div>

      {summary ? (
        <div className="prose-sm mt-1 text-sm" style={{ color: 'var(--thinking-content-text)' }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
            {visibleSummary}
          </ReactMarkdown>
        </div>
      ) : (
        <div className="mt-1 text-xs italic" style={{ color: 'var(--thinking-text-muted)' }}>
          No reasoning summary was recorded.
        </div>
      )}
      {isLong && (
        <button
          type="button"
          onClick={(): void => setExpanded(!expanded)}
          className="mt-1 text-[11px] underline-offset-2 hover:underline"
          style={{ color: 'var(--thinking-text)' }}
        >
          {expanded ? 'Show less' : `Show full summary (${entry.summary.length} sections)`}
        </button>
      )}

      {entry.encrypted && !hasRaw && (
        <div className="mt-1 text-[11px]" style={{ color: 'var(--thinking-text-muted)' }}>
          Internal reasoning: encrypted / unavailable
        </div>
      )}
      {hasRaw && (
        <div className="mt-1">
          <button
            type="button"
            onClick={(): void => setShowRaw(!showRaw)}
            className="flex items-center gap-1 text-[11px]"
            style={{ color: 'var(--thinking-text)' }}
            aria-expanded={showRaw}
          >
            <ChevronRight className={`size-3 transition-transform ${showRaw ? 'rotate-90' : ''}`} />
            Raw reasoning ({entry.content?.length} part{entry.content?.length === 1 ? '' : 's'})
          </button>
          {showRaw && (
            <pre
              className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-xs"
              style={{ color: 'var(--thinking-content-text)' }}
            >
              {entry.content?.join('\n\n')}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
