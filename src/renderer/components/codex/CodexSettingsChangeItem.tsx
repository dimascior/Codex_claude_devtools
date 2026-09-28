/**
 * CodexSettingsChangeItem - A runtime settings change in the Codex timeline,
 * listing only the settings that changed (previous → next).
 *
 * A transition Codex recorded (`thread_settings_applied`) is a solid card; a
 * change observed between two turns' effective settings (`turn_context_diff`)
 * is dashed and never presented as a Codex event.
 */

import {
  CARD_BG,
  COLOR_TEXT,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
} from '@renderer/constants/cssVariables';
import { GitCompareArrows, SlidersHorizontal } from 'lucide-react';

import {
  changeRows,
  isRecordedChange,
  settingsChangeExplanation,
  settingsChangeOrigin,
  settingsChangeScope,
  settingsChangeTitle,
} from './codexRuntimeFormatting';

import type { SettingsChangeEntry } from '@shared/types';

interface CodexSettingsChangeItemProps {
  entry: SettingsChangeEntry;
}

export const CodexSettingsChangeItem = ({
  entry,
}: CodexSettingsChangeItemProps): React.JSX.Element => {
  const recorded = isRecordedChange(entry);
  const Icon = recorded ? SlidersHorizontal : GitCompareArrows;

  return (
    <div
      className="rounded-md px-3 py-2 text-xs"
      style={{
        backgroundColor: recorded ? CARD_BG : 'transparent',
        border: `1px ${recorded ? 'solid' : 'dashed'} var(--color-border-emphasis)`,
      }}
      title={settingsChangeExplanation(entry)}
      data-source={entry.source}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Icon className="size-3.5 shrink-0" style={{ color: COLOR_TEXT_SECONDARY }} />
        <span
          className="text-[11px] font-semibold uppercase tracking-wider"
          style={{ color: COLOR_TEXT_SECONDARY }}
        >
          {settingsChangeTitle(entry)}
        </span>
        <span style={{ color: COLOR_TEXT }}>{settingsChangeScope(entry)}</span>
        <span className={recorded ? '' : 'italic'} style={{ color: COLOR_TEXT_MUTED }}>
          {settingsChangeOrigin(entry)}
        </span>
      </div>
      <dl className="mt-1 grid grid-cols-[11rem_1fr] gap-x-3 gap-y-0.5 pl-[22px]">
        {changeRows(entry).map((row) => (
          <div key={row.field} className="contents">
            <dt style={{ color: COLOR_TEXT_MUTED }}>{row.label}</dt>
            <dd className="min-w-0 break-words" style={{ color: COLOR_TEXT }}>
              <span style={{ color: COLOR_TEXT_SECONDARY }}>{row.previous}</span>
              <span style={{ color: COLOR_TEXT_MUTED }}> → </span>
              {row.next}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};
