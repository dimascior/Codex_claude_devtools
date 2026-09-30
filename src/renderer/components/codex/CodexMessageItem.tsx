/**
 * CodexMessageItem - A user request or an agent message in the Codex timeline.
 */

import ReactMarkdown from 'react-markdown';

import { markdownComponents } from '@renderer/components/chat/markdownComponents';
import {
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
  TAG_BG,
  TAG_BORDER,
  TAG_TEXT,
} from '@renderer/constants/cssVariables';
import { Bot, Lock, User } from 'lucide-react';
import remarkGfm from 'remark-gfm';

import type { AgentMessageEntry, UserMessageEntry } from '@shared/types';

interface CodexMessageItemProps {
  entry: UserMessageEntry | AgentMessageEntry;
}

const PHASE_LABELS: Record<NonNullable<AgentMessageEntry['phase']>, string> = {
  commentary: 'commentary',
  final_answer: 'final answer',
};

export const CodexMessageItem = ({ entry }: CodexMessageItemProps): React.JSX.Element => {
  const isUser = entry.kind === 'user_message';
  const phase = entry.kind === 'agent_message' ? entry.phase : undefined;
  const route =
    entry.kind === 'agent_message' && (entry.author || entry.recipient)
      ? `${entry.author ?? '?'} → ${entry.recipient ?? '?'}`
      : undefined;
  const encrypted = entry.kind === 'agent_message' && entry.encrypted === true;
  let label = 'Codex';
  if (isUser) {
    label = 'User request';
  } else if (route) {
    label = 'Inter-agent message';
  }

  return (
    <div
      className="rounded-lg px-3 py-2"
      style={
        isUser
          ? {
              backgroundColor: 'var(--chat-user-bg)',
              border: '1px solid var(--chat-user-border)',
              boxShadow: 'var(--chat-user-shadow)',
            }
          : { border: '1px solid var(--chat-ai-border)' }
      }
    >
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider">
        {isUser ? (
          <User className="size-3.5" style={{ color: COLOR_TEXT_SECONDARY }} />
        ) : (
          <Bot className="size-3.5" style={{ color: 'var(--chat-ai-icon)' }} />
        )}
        <span style={{ color: COLOR_TEXT_SECONDARY }}>{label}</span>
        {phase && (
          <span
            className="rounded px-1.5 py-px text-[10px] font-medium normal-case tracking-normal"
            style={{ backgroundColor: TAG_BG, color: TAG_TEXT, border: `1px solid ${TAG_BORDER}` }}
          >
            {PHASE_LABELS[phase]}
          </span>
        )}
        {route && (
          <span className="normal-case tracking-normal" style={{ color: COLOR_TEXT_MUTED }}>
            {route}
          </span>
        )}
      </div>
      <div
        className={`prose-sm min-w-0 break-words text-sm ${isUser ? 'max-h-96 overflow-y-auto' : ''}`}
        style={{ color: isUser ? 'var(--chat-user-text)' : 'var(--prose-body)' }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {entry.text}
        </ReactMarkdown>
      </div>
      {encrypted && (
        <div
          className="mt-1 flex items-center gap-1 text-[11px]"
          style={{ color: COLOR_TEXT_MUTED }}
          title="Codex stored this part of the message encrypted; it is not decoded."
        >
          <Lock className="size-3" />
          Payload encrypted / not shown
        </div>
      )}
      {entry.kind === 'user_message' && (entry.imageCount ?? 0) > 0 && (
        <div className="mt-1 text-[11px]" style={{ color: COLOR_TEXT_MUTED }}>
          {entry.imageCount} image(s) attached
        </div>
      )}
    </div>
  );
};
