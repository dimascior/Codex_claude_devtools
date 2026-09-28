/**
 * CodexExecutionDetails - Expanded body of an execution: exact command,
 * execution facts (cwd, exit code, timing, files written, Codex's own command
 * classification), provenance (ids, records, links), input, output.
 */

import { CodeBlockViewer } from '@renderer/components/chat/viewers/CodeBlockViewer';
import { CopyablePath } from '@renderer/components/common/CopyablePath';
import { COLOR_TEXT, COLOR_TEXT_MUTED } from '@renderer/constants/cssVariables';
import { formatDuration } from '@renderer/utils/formatters';

import {
  commandActionLabel,
  commandActionTarget,
  describeFileWrite,
  durationSourceLabel,
  generationLabel,
} from './codexFormatting';
import { CodexOutputBlock } from './CodexOutputBlock';
import { CodexPatchView } from './CodexPatchView';
import { CodexProvenance } from './CodexProvenance';

import type { Execution } from '@shared/types';

interface CodexExecutionDetailsProps {
  execution: Execution;
}

interface Fact {
  label: string;
  value: React.ReactNode;
}

function patchText(exec: Execution): string | undefined {
  if (exec.kind !== 'patch') {
    return undefined;
  }
  if (exec.source === 'custom_tool_call') {
    return exec.input;
  }
  const fromArgs = exec.args?.input ?? exec.args?.patch;
  if (typeof fromArgs === 'string') {
    return fromArgs;
  }
  return exec.argv && exec.argv.length > 1 ? exec.argv[1] : undefined;
}

function buildFacts(exec: Execution): Fact[] {
  const facts: Fact[] = [];
  if (exec.cwd) {
    facts.push({
      label: 'Working dir',
      value: <CopyablePath displayText={exec.cwd} copyText={exec.cwd} className="font-mono" />,
    });
  }
  if (exec.shell) {
    facts.push({ label: 'Shell', value: exec.shell });
  }
  if (exec.exitCode !== undefined) {
    facts.push({ label: 'Exit code', value: String(exec.exitCode) });
  }
  if (exec.durationMs !== undefined) {
    facts.push({
      label: 'Duration',
      value: `${formatDuration(exec.durationMs)} (${durationSourceLabel(exec.durationSource)})`,
    });
  }
  if (exec.statusDetail) {
    facts.push({ label: 'Status', value: exec.statusDetail });
  }
  if (exec.processId) {
    facts.push({ label: 'Process session', value: exec.processId });
  }
  const generation = generationLabel(exec);
  facts.push({
    label: 'Recorded as',
    value: generation ? `${exec.source} (${generation})` : exec.source,
  });
  if (exec.fileWrites && exec.fileWrites.length > 0) {
    facts.push({
      label: 'Files written',
      value: (
        <ul className="space-y-0.5 font-mono">
          {exec.fileWrites.map((write) => (
            <li key={write.path}>{describeFileWrite(write)}</li>
          ))}
        </ul>
      ),
    });
  }
  if (exec.commandActions && exec.commandActions.length > 0) {
    facts.push({
      label: 'Codex tags',
      value: (
        <ul className="space-y-0.5">
          {exec.commandActions.map((action, index) => {
            const target = commandActionTarget(action);
            return (
              <li key={`${index}:${action.type}`}>
                <span className="font-semibold">{commandActionLabel(action)}</span>
                {target && <span className="font-mono"> {target}</span>}
                {action.type === 'read' && action.path && action.path !== target && (
                  <span className="font-mono" style={{ color: COLOR_TEXT_MUTED }}>
                    {' '}
                    ({action.path})
                  </span>
                )}
                {action.command && (
                  <div className="font-mono" style={{ color: COLOR_TEXT_MUTED }}>
                    {action.command}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ),
    });
  }
  return facts;
}

export const CodexExecutionDetails = ({
  execution: exec,
}: CodexExecutionDetailsProps): React.JSX.Element => {
  const facts = buildFacts(exec);
  const patch = patchText(exec);
  const outputCount = exec.outputCount ?? 0;
  const argvDiffers =
    exec.argv !== undefined && exec.argv.length > 0 && exec.argv.join(' ') !== exec.command;
  const showArgs =
    exec.kind !== 'command' &&
    exec.kind !== 'command_input' &&
    exec.kind !== 'code_cell' &&
    patch === undefined &&
    exec.args !== undefined &&
    Object.keys(exec.args).length > 0;

  return (
    <div className="space-y-2">
      {exec.command && exec.kind !== 'patch' && (
        <CodexOutputBlock
          label={exec.kind === 'command_input' ? 'Input' : 'Command'}
          text={exec.command}
          maxHeightClass="max-h-48"
        />
      )}
      {argvDiffers && (
        <CodexOutputBlock label="argv" text={JSON.stringify(exec.argv)} maxHeightClass="max-h-32" />
      )}

      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-xs">
        {facts.map((fact) => (
          <div key={fact.label} className="contents">
            <dt style={{ color: COLOR_TEXT_MUTED }}>{fact.label}</dt>
            <dd className="min-w-0 break-words" style={{ color: COLOR_TEXT }}>
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>

      <CodexProvenance execution={exec} />

      {exec.kind === 'code_cell' && exec.input && (
        <CodeBlockViewer
          fileName="exec cell (JavaScript)"
          content={exec.input}
          language="javascript"
          maxHeight="max-h-80"
        />
      )}
      {patch !== undefined && <CodexPatchView patch={patch} />}
      {showArgs && (
        <CodexOutputBlock
          label="Arguments"
          text={JSON.stringify(exec.args, null, 2)}
          maxHeightClass="max-h-64"
        />
      )}
      {!showArgs && exec.kind === 'tool' && exec.input && !exec.args && (
        <CodexOutputBlock label="Input" text={exec.input} maxHeightClass="max-h-64" />
      )}

      {(exec.output !== undefined || exec.status !== 'unknown') && (
        <CodexOutputBlock
          label="Output"
          meta={outputCount > 1 ? `${outputCount} outputs` : undefined}
          text={exec.output ?? ''}
          truncated={exec.outputTruncated}
          imageCount={exec.outputImageCount}
        />
      )}
    </div>
  );
};
