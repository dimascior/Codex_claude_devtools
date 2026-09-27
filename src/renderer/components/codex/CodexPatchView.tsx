/**
 * CodexPatchView - Renders an apply_patch envelope with added/removed lines tinted.
 */

import { CopyButton } from '@renderer/components/common/CopyButton';
import {
  CODE_BG,
  CODE_BORDER,
  CODE_FILENAME,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
  DIFF_ADDED_BG,
  DIFF_ADDED_TEXT,
  DIFF_REMOVED_BG,
  DIFF_REMOVED_TEXT,
} from '@renderer/constants/cssVariables';

/** Very long patches are cut for display (the copy button copies everything). */
const MAX_LINES = 2000;

interface CodexPatchViewProps {
  patch: string;
}

function lineStyle(line: string): React.CSSProperties {
  if (line.startsWith('***')) {
    return { color: CODE_FILENAME };
  }
  if (line.startsWith('+')) {
    return { backgroundColor: DIFF_ADDED_BG, color: DIFF_ADDED_TEXT };
  }
  if (line.startsWith('-')) {
    return { backgroundColor: DIFF_REMOVED_BG, color: DIFF_REMOVED_TEXT };
  }
  if (line.startsWith('@@')) {
    return { color: COLOR_TEXT_MUTED };
  }
  return { color: COLOR_TEXT_SECONDARY };
}

export const CodexPatchView = ({ patch }: CodexPatchViewProps): React.JSX.Element => {
  const lines = patch.split('\n');
  const shown = lines.slice(0, MAX_LINES);
  return (
    <div
      className="group relative overflow-hidden rounded-md"
      style={{ backgroundColor: CODE_BG, border: `1px solid ${CODE_BORDER}` }}
    >
      <CopyButton text={patch} />
      <div className="max-h-96 overflow-auto py-2 font-mono text-xs leading-relaxed">
        {shown.map((line, index) => (
          // Patch lines have no stable identity beyond their position.

          <div key={index} className="whitespace-pre-wrap break-words px-3" style={lineStyle(line)}>
            {line || ' '}
          </div>
        ))}
        {lines.length > MAX_LINES && (
          <div className="px-3 pt-1" style={{ color: COLOR_TEXT_MUTED }}>
            … {lines.length - MAX_LINES} more lines
          </div>
        )}
      </div>
    </div>
  );
};
