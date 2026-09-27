import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

function compactAgentVisualPlanningSignalText(value: unknown, maxLength = 900) {
  const text = typeof value === 'string'
    ? value
    : value === undefined || value === null
      ? ''
      : JSON.stringify(value);
  const compactText = text.replace(/\s+/gu, ' ').trim();
  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

function getAgentVisualSignalToolInputAction(command: AgentChatCommand) {
  const action = command.toolCall?.input.action;
  return typeof action === 'string' ? action.trim() : '';
}

function isAgentVisualSignalToolName(toolName: string | null | undefined) {
  return toolName === 'summarize_visual_snapshot' || toolName === 'analyze_game_screen';
}

function isAgentVisualSignalToolCommand(command: AgentChatCommand) {
  const toolName = command.toolCall?.name;
  const action = getAgentVisualSignalToolInputAction(command);
  return isAgentVisualSignalToolName(toolName)
    || (
      toolName === 'execute_desktop_observation'
      && action === 'summarize_visual_snapshot'
    );
}

export function isAgentVisualContextToolCommand(command: AgentChatCommand) {
  const toolName = command.toolCall?.name;
  const action = getAgentVisualSignalToolInputAction(command);
  return isAgentVisualSignalToolCommand(command)
    || toolName === 'list_capture_sources'
    || (
      toolName === 'execute_desktop_observation'
      && action === 'list_capture_sources'
    );
}

export function createAgentRecentVisualContextText(
  toolResults: AgentRuntimeToolResultEntry[],
) {
  const visualEntries = toolResults
    .filter((entry) => isAgentVisualContextToolCommand(entry.command))
    .slice(-3);

  if (!visualEntries.length) {
    return '';
  }

  return visualEntries.map((entry, index) => {
    const toolName = entry.command.toolCall?.name ?? entry.command.kind;
    const input = entry.command.toolCall?.input ?? {};
    const sourceId = typeof input.sourceId === 'string' && input.sourceId.trim()
      ? `sourceId=${input.sourceId.trim()}`
      : '';
    const query = typeof input.query === 'string' && input.query.trim()
      ? `query=${input.query.trim()}`
      : '';
    const observedState = entry.result.stateSummary?.observedState?.length
      ? entry.result.stateSummary.observedState
      : entry.result.observations ?? [];

    return [
      `${index + 1}. tool=${toolName}`,
      `ok=${entry.result.ok === false ? 'false' : 'true'}`,
      sourceId,
      query,
      observedState.length
        ? `observed=${compactAgentVisualPlanningSignalText(observedState.slice(0, 5).join(' | '), 520)}`
        : '',
      entry.result.stateSummary?.missingEvidence?.length
        ? `uncertain=${compactAgentVisualPlanningSignalText(entry.result.stateSummary.missingEvidence.join(' | '), 360)}`
        : '',
      entry.result.stateSummary?.recommendedRecovery?.length
        ? `recommendedRecovery=${compactAgentVisualPlanningSignalText(entry.result.stateSummary.recommendedRecovery.join(' | '), 360)}`
        : '',
    ].filter(Boolean).join('\n');
  }).join('\n\n');
}

export function createAgentVisualRecoveryText(
  toolResults: AgentRuntimeToolResultEntry[],
) {
  const latestVisualEntry = [...toolResults].reverse().find((entry) => (
    isAgentVisualContextToolCommand(entry.command)
    && (
      entry.result.ok === false
      || Boolean(entry.result.stateSummary?.missingEvidence?.length)
      || Boolean(entry.result.stateSummary?.recommendedRecovery?.length)
    )
  ));

  if (!latestVisualEntry) {
    return '';
  }

  const toolName = latestVisualEntry.command.toolCall?.name ?? latestVisualEntry.command.kind;
  const result = latestVisualEntry.result;
  const candidateLines = (result.observations ?? [])
    .filter((line) => /capture source candidate|^\d+\. \[/iu.test(line))
    .slice(0, 8);

  return [
    `tool=${toolName}`,
    `ok=${result.ok === false ? 'false' : 'true'}`,
    result.errorText ? `errorText=${compactAgentVisualPlanningSignalText(result.errorText, 360)}` : '',
    result.followUp ? `followUp=${compactAgentVisualPlanningSignalText(result.followUp, 360)}` : '',
    result.stateSummary?.missingEvidence?.length
      ? `missingEvidence=${compactAgentVisualPlanningSignalText(result.stateSummary.missingEvidence.join(' | '), 520)}`
      : '',
    result.stateSummary?.recommendedRecovery?.length
      ? `recommendedRecovery=${compactAgentVisualPlanningSignalText(result.stateSummary.recommendedRecovery.join(' | '), 520)}`
      : '',
    candidateLines.length
      ? `candidateSources=${compactAgentVisualPlanningSignalText(candidateLines.join(' | '), 720)}`
      : '',
    'visualRecoveryPolicy=This signal is advisory/evidence-driven. Use it to reason about source/capture/visual gaps, but it does not mandate a fixed recovery tool chain.',
    'Before final_answer, decide from this signal whether to retry with an exact sourceId, call list_capture_sources/get_active_window_info, ask one short confirmation question, or report a vision settings/model problem. Do not claim visual precision beyond the evidence.',
  ].filter(Boolean).join('\n');
}
