/**
 * CodexPatchView - Renders an apply_patch envelope or a unified diff with
 * added/removed lines tinted, or a whole added or deleted file in one tint.
 */

import { useState } from 'react';

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

/**
 * `diff`: tint by line prefix. `added` / `removed` / `plain`: every line is
 * file content, tinted as added, removed or not at all.
 */
export type PatchViewTone = 'diff' | 'added' | 'removed' | 'plain';

interface CodexPatchViewProps {
  patch: string;
  tone?: PatchViewTone;
  /** Show only this many lines until "Show all" is clicked */
  previewLines?: number;
}

function lineStyle(line: string, tone: PatchViewTone): React.CSSProperties {
  if (tone === 'added') {
    return { backgroundColor: DIFF_ADDED_BG, color: DIFF_ADDED_TEXT };
  }
  if (tone === 'removed') {
    return { backgroundColor: DIFF_REMOVED_BG, color: DIFF_REMOVED_TEXT };
  }
  if (tone === 'plain') {
    return { color: COLOR_TEXT_SECONDARY };
  }
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

export const CodexPatchView = ({
  patch,
  tone = 'diff',
  previewLines,
}: CodexPatchViewProps): React.JSX.Element => {
  const [showAll, setShowAll] = useState(false);
  // A final newline ends the last line; it is not an empty line of its own.
  const lines = (patch.endsWith('\n') ? patch.slice(0, -1) : patch).split('\n');
  const previewing = !showAll && previewLines !== undefined && lines.length > previewLines;
  const shown = lines.slice(0, previewing ? previewLines : MAX_LINES);
  return (
    <div
      className="group relative overflow-hidden rounded-md"
      style={{ backgroundColor: CODE_BG, border: `1px solid ${CODE_BORDER}` }}
    >
      <CopyButton text={patch} />
      <div className="max-h-96 overflow-auto py-2 font-mono text-xs leading-relaxed">
        {shown.map((line, index) => (
          // Patch lines have no stable identity beyond their position.

          <div
            key={index}
            className="whitespace-pre-wrap break-words px-3"
            style={lineStyle(line, tone)}
          >
            {line || ' '}
          </div>
        ))}
        {previewing ? (
          <button
            type="button"
            onClick={(): void => setShowAll(true)}
            className="mx-3 mt-1 rounded px-1 font-sans transition-colors hover:bg-surface-raised"
            style={{ color: COLOR_TEXT_MUTED }}
          >
            Show all {lines.length} lines
          </button>
        ) : (
          lines.length > MAX_LINES && (
            <div className="px-3 pt-1" style={{ color: COLOR_TEXT_MUTED }}>
              … {lines.length - MAX_LINES} more lines
            </div>
          )
        )}
      </div>
    </div>
  );
};
