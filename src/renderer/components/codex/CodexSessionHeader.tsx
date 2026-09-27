/**
 * CodexSessionHeader - What this session is, where it ran, and how its
 * executions went; plus the timeline filter.
 */

import { CopyablePath } from '@renderer/components/common/CopyablePath';
import {
  COLOR_BORDER,
  COLOR_TEXT,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
  TAG_BG,
  TAG_BORDER,
  TAG_TEXT,
} from '@renderer/constants/cssVariables';
import { formatTokensCompact } from '@renderer/utils/formatters';
import { FolderOpen } from 'lucide-react';

import { formatRelativeTime } from './codexFormatting';

import type { CodexTimelineFilter } from './codexFormatting';
import type { AgentSessionDetail } from '@shared/types';

interface CodexSessionHeaderProps {
  detail: AgentSessionDetail;
  filter: CodexTimelineFilter;
  onFilterChange: (filter: CodexTimelineFilter) => void;
}

const FILTERS: { id: CodexTimelineFilter; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'executions', label: 'Executions' },
  { id: 'problems', label: 'Problems' },
];

const Tag = ({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}): React.JSX.Element => (
  <span
    className="rounded px-1.5 py-px text-[11px]"
    style={{ backgroundColor: TAG_BG, color: TAG_TEXT, border: `1px solid ${TAG_BORDER}` }}
    title={title}
  >
    {children}
  </span>
);

export const CodexSessionHeader = ({
  detail,
  filter,
  onFilterChange,
}: CodexSessionHeaderProps): React.JSX.Element => {
  const { session, stats, tokenUsage } = detail;
  const problems = stats.failed + stats.declined + stats.interrupted;

  return (
    <div className="shrink-0 border-b px-4 py-3" style={{ borderColor: COLOR_BORDER }}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {session.turnInProgress ? (
              <span
                className="rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider"
                style={{ backgroundColor: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}
              >
                Running
              </span>
            ) : (
              session.isLive && (
                <span
                  className="rounded px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider"
                  style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' }}
                >
                  Live
                </span>
              )
            )}
            <h2
              className="min-w-0 truncate text-sm font-medium"
              style={{ color: COLOR_TEXT }}
              title={session.title}
            >
              {session.title ?? 'Codex session'}
            </h2>
          </div>
          {session.cwd && (
            <div
              className="mt-1 flex items-center gap-1.5 text-xs"
              style={{ color: COLOR_TEXT_SECONDARY }}
            >
              <FolderOpen className="size-3.5 shrink-0" />
              <CopyablePath
                displayText={session.cwd}
                copyText={session.cwd}
                className="font-mono"
              />
            </div>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {session.model && <Tag title="Model">{session.model}</Tag>}
            {session.source && <Tag title="Session source">{session.source}</Tag>}
            {session.cliVersion && <Tag title="Codex version">v{session.cliVersion}</Tag>}
            {session.gitBranch && (
              <Tag title={session.repositoryUrl}>
                {session.gitBranch}
                {session.gitCommit ? ` @ ${session.gitCommit.slice(0, 7)}` : ''}
              </Tag>
            )}
            {session.agentNickname && <Tag title="Sub-agent">{session.agentNickname}</Tag>}
            <span className="text-[11px]" style={{ color: COLOR_TEXT_MUTED }}>
              updated {formatRelativeTime(session.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      <div
        className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs"
        style={{ color: COLOR_TEXT_SECONDARY }}
      >
        <span>
          <span style={{ color: COLOR_TEXT }}>{stats.total}</span>{' '}
          {stats.total === 1 ? 'call' : 'calls'}
        </span>
        <span>
          <span style={{ color: COLOR_TEXT }}>{stats.commands}</span> commands
          {stats.nested > 0 && (
            <span style={{ color: COLOR_TEXT_MUTED }}> ({stats.nested} nested)</span>
          )}
        </span>
        {problems > 0 && (
          <span style={{ color: 'var(--tool-result-error-text)' }}>
            {stats.failed} failed
            {stats.declined > 0 && ` · ${stats.declined} declined`}
            {stats.interrupted > 0 && ` · ${stats.interrupted} interrupted`}
          </span>
        )}
        {stats.running > 0 && <span style={{ color: '#60a5fa' }}>{stats.running} running</span>}
        {tokenUsage && (
          <span
            title={`input ${tokenUsage.total.inputTokens} (cached ${tokenUsage.total.cachedInputTokens}) · output ${tokenUsage.total.outputTokens} (reasoning ${tokenUsage.total.reasoningOutputTokens})`}
          >
            <span style={{ color: COLOR_TEXT }}>
              {formatTokensCompact(tokenUsage.total.totalTokens)}
            </span>{' '}
            tokens
          </span>
        )}
        <span className="flex-1" />
        <div
          className="flex overflow-hidden rounded-md"
          style={{ border: `1px solid ${COLOR_BORDER}` }}
          role="group"
          aria-label="Timeline filter"
        >
          {FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={(): void => onFilterChange(option.id)}
              className="px-2 py-0.5 text-[11px] transition-colors"
              style={{
                backgroundColor:
                  filter === option.id ? 'var(--color-surface-raised)' : 'transparent',
                color: filter === option.id ? COLOR_TEXT : COLOR_TEXT_MUTED,
              }}
              aria-pressed={filter === option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
