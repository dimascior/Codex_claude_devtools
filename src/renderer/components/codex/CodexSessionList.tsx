/**
 * CodexSessionList - Codex rollouts grouped by working directory.
 *
 * Codex partitions rollouts by date on disk; grouping here uses the cwd each
 * rollout recorded. The live rollout (most recently written) is followed
 * automatically unless the user picks another session.
 */

import { useMemo, useState } from 'react';

import {
  COLOR_BORDER,
  COLOR_TEXT,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
  TAG_BG,
  TAG_BORDER,
  TAG_TEXT,
} from '@renderer/constants/cssVariables';
import { useStore } from '@renderer/store';
import { getCodexFollowTarget } from '@renderer/store/slices/codexSlice';
import { FolderGit2, GitBranch, Radio, RefreshCw } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

import { formatRelativeTime } from './codexFormatting';

import type { AgentSessionSummary } from '@shared/types';

/** Sessions shown per project before "Show all". */
const SESSIONS_PER_PROJECT = 6;

const LiveDot = ({ session }: { session: AgentSessionSummary }): React.JSX.Element => {
  if (session.turnInProgress) {
    return (
      <span className="relative flex size-2 shrink-0" title="Turn in progress">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-green-500" />
      </span>
    );
  }
  return (
    <span
      className="inline-flex size-2 shrink-0 rounded-full"
      style={{ backgroundColor: session.isLive ? '#22c55e' : 'var(--card-icon-muted)' }}
      title={session.isLive ? 'Written in the last 10 minutes' : 'Idle'}
    />
  );
};

interface SessionRowProps {
  session: AgentSessionSummary;
  isSelected: boolean;
  isFollowTarget: boolean;
  onSelect: (sessionId: string) => void;
}

const SessionRow = ({
  session,
  isSelected,
  isFollowTarget,
  onSelect,
}: SessionRowProps): React.JSX.Element => {
  const isSubagent = session.source?.startsWith('subagent') ?? false;
  return (
    <button
      type="button"
      onClick={(): void => onSelect(session.id)}
      className="flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-raised"
      style={{ backgroundColor: isSelected ? 'var(--color-surface-raised)' : undefined }}
      title={session.filePath}
    >
      <div className="flex items-center gap-2">
        <LiveDot session={session} />
        <span
          className="line-clamp-2 min-w-0 flex-1 text-xs"
          style={{ color: session.title ? COLOR_TEXT : COLOR_TEXT_MUTED }}
        >
          {isSubagent && <span style={{ color: COLOR_TEXT_MUTED }}>↳ </span>}
          {session.titleSource === 'agent_task' && (
            <span
              style={{ color: COLOR_TEXT_MUTED }}
              title="Task name given when the subagent was spawned; the task text is stored encrypted"
            >
              task{' '}
            </span>
          )}
          {session.title ??
            session.error ??
            (isSubagent ? '(no readable task recorded)' : '(no request recorded yet)')}
        </span>
      </div>
      <div
        className="ml-4 flex items-center gap-1.5 text-[10px]"
        style={{ color: COLOR_TEXT_MUTED }}
      >
        <span>{formatRelativeTime(session.updatedAt)}</span>
        {isFollowTarget && (
          <span className="font-semibold uppercase tracking-wider" style={{ color: '#22c55e' }}>
            live
          </span>
        )}
        {session.source && (
          <span
            className="rounded px-1"
            style={{ backgroundColor: TAG_BG, color: TAG_TEXT, border: `1px solid ${TAG_BORDER}` }}
          >
            {session.agentNickname ?? session.source}
          </span>
        )}
        {session.gitBranch && (
          <span className="inline-flex min-w-0 items-center gap-0.5 truncate">
            <GitBranch className="size-2.5 shrink-0" />
            {session.gitBranch}
          </span>
        )}
      </div>
    </button>
  );
};

export const CodexSessionList = (): React.JSX.Element => {
  const {
    list,
    loading,
    error,
    selectedId,
    followLive,
    fetchCodexSessions,
    selectCodexSession,
    setCodexFollowLive,
  } = useStore(
    useShallow((s) => ({
      list: s.codexSessions,
      loading: s.codexSessionsLoading,
      error: s.codexSessionsError,
      selectedId: s.codexSelectedSessionId,
      followLive: s.codexFollowLive,
      fetchCodexSessions: s.fetchCodexSessions,
      selectCodexSession: s.selectCodexSession,
      setCodexFollowLive: s.setCodexFollowLive,
    }))
  );
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  const sessionsById = useMemo(
    () => new Map((list?.sessions ?? []).map((session) => [session.id, session])),
    [list]
  );
  const followTarget = getCodexFollowTarget(list);

  const toggleProject = (key: string): void => {
    setExpandedProjects((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSelect = (sessionId: string): void => selectCodexSession(sessionId, { manual: true });

  return (
    <div
      className="flex w-72 shrink-0 flex-col border-r"
      style={{ backgroundColor: 'var(--color-surface-sidebar)', borderColor: COLOR_BORDER }}
    >
      <div className="flex items-center gap-2 px-3 pb-1 pt-3">
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: COLOR_TEXT_MUTED }}
        >
          Codex sessions {list && <span>({list.totalFiles})</span>}
        </span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={(): void => void fetchCodexSessions()}
          className="rounded p-1 transition-colors hover:bg-surface-raised"
          style={{ color: COLOR_TEXT_MUTED }}
          title="Rescan sessions"
          aria-label="Rescan Codex sessions"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={(): void => setCodexFollowLive(!followLive)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors"
          style={{
            backgroundColor: followLive ? 'rgba(34, 197, 94, 0.12)' : 'transparent',
            border: `1px solid ${followLive ? 'rgba(34, 197, 94, 0.35)' : COLOR_BORDER}`,
            color: followLive ? '#22c55e' : COLOR_TEXT_SECONDARY,
          }}
          aria-pressed={followLive}
          title="Automatically select the rollout Codex is writing to"
        >
          <Radio className="size-3.5" />
          {followLive ? 'Following live rollout' : 'Follow live rollout'}
        </button>
        {list && (
          <div
            className="mt-1 truncate text-[10px]"
            style={{ color: COLOR_TEXT_MUTED }}
            title={list.rootDir}
          >
            {list.rootDir}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {error && (
          <div className="p-2 text-xs" style={{ color: 'var(--tool-result-error-text)' }}>
            {error}
          </div>
        )}
        {list && !list.rootExists && (
          <div className="space-y-1 p-2 text-xs" style={{ color: COLOR_TEXT_MUTED }}>
            <p>No Codex sessions directory at</p>
            <p className="break-all font-mono">{list.rootDir}</p>
            <p>
              Codex writes rollouts there once a session starts. Set CODEX_HOME before launching if
              Codex uses a different home directory.
            </p>
          </div>
        )}
        {list?.rootExists && list.sessions.length === 0 && (
          <div className="p-2 text-xs" style={{ color: COLOR_TEXT_MUTED }}>
            No rollouts yet. Start a Codex session and it will appear here.
          </div>
        )}

        {list?.projects.map((project) => {
          const isExpanded = expandedProjects.has(project.key);
          const ids = isExpanded
            ? project.sessionIds
            : project.sessionIds.slice(0, SESSIONS_PER_PROJECT);
          // Keep the selected session visible even when its group is collapsed.
          if (selectedId && !ids.includes(selectedId) && project.sessionIds.includes(selectedId)) {
            ids.push(selectedId);
          }
          return (
            <div key={project.key} className="mt-2">
              <div
                className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium"
                style={{ color: COLOR_TEXT_SECONDARY }}
                title={project.cwd}
              >
                <FolderGit2 className="size-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                <span style={{ color: COLOR_TEXT_MUTED }}>{project.sessionIds.length}</span>
              </div>
              {ids.map((id) => {
                const session = sessionsById.get(id);
                return session ? (
                  <SessionRow
                    key={id}
                    session={session}
                    isSelected={id === selectedId}
                    isFollowTarget={id === followTarget && session.isLive}
                    onSelect={handleSelect}
                  />
                ) : null;
              })}
              {project.sessionIds.length > SESSIONS_PER_PROJECT && (
                <button
                  type="button"
                  onClick={(): void => toggleProject(project.key)}
                  className="ml-4 px-2 py-0.5 text-[11px] underline-offset-2 hover:underline"
                  style={{ color: COLOR_TEXT_MUTED }}
                >
                  {isExpanded ? 'Show fewer' : `Show all ${project.sessionIds.length}`}
                </button>
              )}
            </div>
          );
        })}

        {list && list.totalFiles > list.sessions.length && (
          <div className="px-2 pt-3 text-[10px]" style={{ color: COLOR_TEXT_MUTED }}>
            Showing the {list.sessions.length} most recent of {list.totalFiles} rollouts.
          </div>
        )}
      </div>
    </div>
  );
};
