/**
 * CodexOutputBlock - Monospace block for command output and other raw text.
 */

import { CopyButton } from '@renderer/components/common/CopyButton';
import {
  CODE_BG,
  CODE_BORDER,
  CODE_HEADER_BG,
  COLOR_TEXT_MUTED,
  COLOR_TEXT_SECONDARY,
} from '@renderer/constants/cssVariables';

interface CodexOutputBlockProps {
  text: string;
  label?: string;
  /** Extra header text, e.g. "2 outputs" */
  meta?: string;
  truncated?: boolean;
  imageCount?: number;
  /** Tailwind max-height class for the scroll area */
  maxHeightClass?: string;
}

export const CodexOutputBlock = ({
  text,
  label,
  meta,
  truncated,
  imageCount,
  maxHeightClass = 'max-h-80',
}: CodexOutputBlockProps): React.JSX.Element => {
  const images = imageCount ?? 0;
  return (
    <div
      className="overflow-hidden rounded-md"
      style={{ backgroundColor: CODE_BG, border: `1px solid ${CODE_BORDER}` }}
    >
      {label && (
        <div
          className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider"
          style={{
            backgroundColor: CODE_HEADER_BG,
            borderBottom: `1px solid ${CODE_BORDER}`,
            color: COLOR_TEXT_MUTED,
          }}
        >
          <span>{label}</span>
          {meta && <span className="normal-case tracking-normal">{meta}</span>}
          <span className="flex-1" />
          {text && <CopyButton text={text} inline />}
        </div>
      )}
      <pre
        className={`overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-mono text-xs leading-relaxed ${maxHeightClass}`}
        style={{ color: text ? COLOR_TEXT_SECONDARY : COLOR_TEXT_MUTED }}
      >
        {text || '(no output)'}
      </pre>
      {(truncated === true || images > 0) && (
        <div
          className="px-3 py-1.5 text-[11px]"
          style={{ borderTop: `1px solid ${CODE_BORDER}`, color: COLOR_TEXT_MUTED }}
        >
          {truncated === true && 'Output truncated for display. '}
          {images > 0 && `${images} image(s) omitted.`}
        </div>
      )}
    </div>
  );
};
