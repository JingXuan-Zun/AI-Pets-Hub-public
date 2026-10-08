import { type AgentChatCommandResult, type AgentChatCommand, resolveAgentResultFollowUpActions } from '../../../agent';
import { type ChatAgentExecutionReceipt } from '../../../types';
import { AGENT_STOPPED_DETAIL_TEXT, AGENT_STOPPED_RECEIPT_TITLE } from './stoppedText';

export function resolveAgentReceiptStatus(result: AgentChatCommandResult): ChatAgentExecutionReceipt['status'] {
  if (result.receipt?.status) {
    return result.receipt.status;
  }

  if (result.ok === false) {
    return 'failed';
  }

  if (result.assessment?.status === 'failed') {
    return 'failed';
  }

  if (result.assessment?.status === 'unverified') {
    return 'unverified';
  }

  if (result.assessment?.status === 'needs-user') {
    return 'unverified';
  }

  return result.ok === true || result.verification || result.observations?.length
    ? 'success'
    : 'unverified';
}

export function getAgentRuntimeCoreEvidenceLines(result: AgentChatCommandResult) {
  const lines = [
    ...(result.receipt?.evidenceLines ?? []),
    ...(result.observations ?? []),
  ];
  const seen = new Set<string>();

  return lines.filter((line) => {
    const text = line.trim();
    if (!text.startsWith('RuntimeCore:') || seen.has(text)) {
      return false;
    }

    seen.add(text);
    return true;
  });
}

export function mergeAgentReceiptEvidenceLines(primaryLines: string[], runtimeCoreLines: string[]) {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const line of [
    ...runtimeCoreLines.slice(0, 4),
    ...primaryLines,
    ...runtimeCoreLines.slice(4),
  ]) {
    const text = line.trim();
    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    merged.push(text);
  }

  return merged.slice(0, 8);
}

export function createAgentExecutionReceipt(
  command: AgentChatCommand,
  result: AgentChatCommandResult,
): ChatAgentExecutionReceipt {
  const runtimeCoreLines = getAgentRuntimeCoreEvidenceLines(result);
  const stateEvidenceLines = [
    result.stateSummary?.observedState?.length ? `observedState: ${result.stateSummary.observedState.slice(0, 3).join(' | ')}` : '',
    result.stateSummary?.changedState?.length ? `changedState: ${result.stateSummary.changedState.slice(0, 3).join(' | ')}` : '',
    result.stateSummary?.verificationEvidence?.length ? `verificationEvidence: ${result.stateSummary.verificationEvidence.slice(0, 3).join(' | ')}` : '',
    result.stateSummary?.missingEvidence?.length ? `missingEvidence: ${result.stateSummary.missingEvidence.slice(0, 3).join(' | ')}` : '',
    result.stateSummary?.recommendedRecovery?.length ? `recommendedRecovery: ${result.stateSummary.recommendedRecovery.slice(0, 3).join(' | ')}` : '',
  ].filter(Boolean);

  if (result.receipt) {
    return {
      evidenceLines: mergeAgentReceiptEvidenceLines([
        ...(result.receipt.evidenceLines?.filter(Boolean) ?? []),
        ...stateEvidenceLines,
      ], runtimeCoreLines),
      status: result.receipt.status,
      stateSummary: result.stateSummary ?? result.receipt.stateSummary ?? null,
      summaryLines: result.receipt.summaryLines.filter(Boolean).slice(0, 6),
      title: result.receipt.title,
      toolName: result.receipt.toolName ?? command.toolCall?.name ?? command.kind,
      verification: result.receipt.verification ?? result.verification ?? null,
    };
  }

  const toolName = command.toolCall?.name ?? command.kind;
  return {
    evidenceLines: mergeAgentReceiptEvidenceLines([
      result.verification ? `verification: ${result.verification}` : '',
      ...(result.observations ?? []).map((observation) => `observation: ${observation}`),
      ...stateEvidenceLines,
    ].filter(Boolean), runtimeCoreLines),
    status: resolveAgentReceiptStatus(result),
    stateSummary: result.stateSummary ?? null,
    summaryLines: [
      `tool: ${toolName}`,
      result.ok === false ? 'result: failed' : 'result: tool returned data',
      result.responseText ? `evidence: ${result.responseText.slice(0, 160)}` : '',
    ].filter(Boolean),
    title: 'Execution receipt',
    toolName,
    verification: result.verification ?? null,
  };
}

export function createDeniedAgentExecutionReceipt(command: AgentChatCommand): ChatAgentExecutionReceipt {
  const toolName = command.toolCall?.name ?? command.kind;

  return {
    evidenceLines: ['User denied this Agent permission request before execution.'],
    status: 'blocked',
    summaryLines: [
      `tool: ${toolName}`,
      'result: user denied, tool was not executed',
    ],
    title: 'Execution receipt',
    toolName,
    verification: 'Permission was denied by the user.',
  };
}

export function createStoppedAgentExecutionReceipt(command: AgentChatCommand): ChatAgentExecutionReceipt {
  const toolName = command.toolCall?.name ?? command.kind;

  return {
    evidenceLines: [AGENT_STOPPED_DETAIL_TEXT],
    status: 'blocked',
    summaryLines: [
      `tool: ${toolName}`,
      'result: user stopped current Agent execution',
    ],
    title: AGENT_STOPPED_RECEIPT_TITLE,
    toolName,
    verification: AGENT_STOPPED_DETAIL_TEXT,
  };
}

export function formatAgentCommandResultForTrace(result: AgentChatCommandResult) {
  const followUpActions = resolveAgentResultFollowUpActions(result);
  const runtimeCoreLines = getAgentRuntimeCoreEvidenceLines(result).slice(0, 6);
  const receiptStatus = resolveAgentReceiptStatus(result);
  const statusLine = result.ok === false
    ? 'status: failed or needs more info'
    : receiptStatus === 'unverified'
      ? 'status: executed but still needs verification'
      : 'status: completed';
  const lines = [
    statusLine,
    result.responseText,
    result.assessment ? `assessment: ${result.assessment.summary}` : '',
    result.verification ? `verification: ${result.verification}` : '',
    result.errorText && result.ok === false ? `error: ${result.errorText}` : '',
    result.followUp ? `next: ${result.followUp}` : '',
    runtimeCoreLines.length ? `runtimeCore: ${runtimeCoreLines.join(' | ')}` : '',
    followUpActions.length ? `actions: ${followUpActions.map((action) => action.label).join(' | ')}` : '',
    result.observations?.length ? `observations: ${result.observations.slice(0, 4).join(' | ')}` : '',
  ].filter(Boolean);

  return lines.join('\n');
}
