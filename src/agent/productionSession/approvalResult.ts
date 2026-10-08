import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentRuntimePendingApproval, type AgentRuntimeResult, type AgentRuntimeStep, type AgentRuntimeToolResultEntry, type AgentRuntimeTraceEventDraft, type AgentRuntimeUnderstanding } from '../runtime/agentRuntimeContract';
import { diagnoseAgentCommandExplicitProhibition as diagnoseAgentSessionV2CommandExplicitProhibition } from '../runtime/agentActionCoverage';
import { createAgentRepeatedUnverifiedActionRetryRejection } from '../runtime/agentDecisionRejectionSignals';
import { resolveAgentWindowTargetBeforeDispatch } from '../runtime/agentWindowTargetResolutionRuntime';
import { buildAgentPermissionRoute } from '../agentPermissionRouter';
import { createAgentPendingApprovalAssembly, type AgentRuntimePendingApprovalAssembly } from '../runtime/agentPendingApprovalAssembly';
import { type createAgentProductionRetryEvidence } from './retryEvidence';

type RetryEvidence = ReturnType<typeof createAgentProductionRetryEvidence>;
interface AgentProductionApprovalResultDependencies {
  sourceText: string;
  userGoal: string;
  historyLines: string[];
  steps: AgentRuntimeStep[];
  toolResults: AgentRuntimeToolResultEntry[];
  findRepeatedRetry: RetryEvidence['findAgentProductionRetryRepeatedUnverifiedActionRetry'];
  countRetryRejections: RetryEvidence['countAgentProductionRetryRepeatedUnverifiedActionRetryRejections'];
  createRetryAnswer: RetryEvidence['createAgentProductionRetryRepeatedUnverifiedActionRetryAnswer'];
  createFinalResult: (options: {finalAnswer: string; status: 'failed' | 'needs-approval'; pendingApproval?: AgentRuntimePendingApproval | null}) => AgentRuntimeResult;
  appendTraceEvent: (event: AgentRuntimeTraceEventDraft) => unknown;
  appendPendingApprovalDiagnostic: (assembly: AgentRuntimePendingApprovalAssembly) => void;
}

export function createAgentProductionApprovalResult(dependencies: AgentProductionApprovalResultDependencies) {
  const {sourceText, userGoal, historyLines, steps, toolResults, createFinalResult, appendTraceEvent,
    findRepeatedRetry: findAgentSessionV2RepeatedUnverifiedActionRetry,
    countRetryRejections: countAgentSessionV2RepeatedUnverifiedActionRetryRejections,
    createRetryAnswer: createAgentSessionV2RepeatedUnverifiedActionRetryAnswer,
    appendPendingApprovalDiagnostic: appendV3PilotShadowPendingApproval,
  } = dependencies;

  const rejectRepeatedUnverifiedActionRetry = (
      command: AgentChatCommand,
      stepIndex: number,
      understanding?: AgentRuntimeUnderstanding | null,
    ): { finalResult: AgentRuntimeResult | null; rejected: boolean } => {
      const repeatedRetry = findAgentSessionV2RepeatedUnverifiedActionRetry({
        command,
        toolResults,
      });
      if (!repeatedRetry) {
        return { finalResult: null, rejected: false };
      }

      const errorText = createAgentRepeatedUnverifiedActionRetryRejection({
        candidateSignature: repeatedRetry.candidateSignature,
        command,
        previousAttempt: repeatedRetry.previousAttempt,
      });
      const toolName = command.toolCall?.name ?? command.kind;
      if (countAgentSessionV2RepeatedUnverifiedActionRetryRejections(steps, command) >= 1) {
        historyLines.push([
          `Step ${stepIndex} loop guard:`,
          errorText,
        ].join('\n'));

        return {
          finalResult: createFinalResult({
            finalAnswer: createAgentSessionV2RepeatedUnverifiedActionRetryAnswer(
              command,
              repeatedRetry.previousAttempt,
            ),
            status: 'failed',
          }),
          rejected: true,
        };
      }

      historyLines.push([
        `Step ${stepIndex} rejected repeated unverified action retry:`,
        errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        args: command.toolCall?.input ?? {},
        errorText,
        index: steps.length + 1,
        ok: false,
        summary: errorText,
        tool: toolName,
        understanding: understanding ?? null,
      });
      return { finalResult: null, rejected: true };
    };
  const createAgentProductionProhibitedApprovalRejection = (
      command: AgentChatCommand,
      stepIndex: number,
      label: string,
    ): AgentRuntimeResult | null => {
      const prohibition = diagnoseAgentSessionV2CommandExplicitProhibition({
        command,
        sourceText,
        userGoal,
      });
      if (!prohibition.prohibitionConflict) {
        return null;
      }

      const toolName = command.toolCall?.name ?? command.kind;
      const finalAnswer = 'The pending action was not executed because it conflicts with an explicit action prohibition in the current task.';
      historyLines.push([
        `Step ${stepIndex} rejected prohibited approval before assembly:`,
        `tool=${toolName}`,
        `commandActionKinds=${prohibition.commandActionKinds.join(',') || 'none'}`,
        `prohibitedActionKinds=${prohibition.prohibitedActionKinds.join(',') || 'none'}`,
        `conflictingActionKinds=${prohibition.conflictingActionKinds.join(',') || 'none'}`,
      ].join('\n'));
      appendTraceEvent({
        details: {
          commandActionKinds: prohibition.commandActionKinds,
          conflictingActionKinds: prohibition.conflictingActionKinds,
          label,
          prohibitedActionKinds: prohibition.prohibitedActionKinds,
        },
        status: 'explicit-prohibition',
        stepIndex,
        summary: 'Approval was rejected because the pending action conflicts with an explicit task prohibition.',
        tool: toolName,
        type: 'decision_rejected',
      });
      return createFinalResult({
        finalAnswer,
        status: 'failed',
      });
    };
  const prepareAgentProductionPendingApprovalResult = (
      approval: AgentRuntimePendingApproval | null,
      stepIndex: number,
      label: string,
      understanding?: AgentRuntimeUnderstanding | null,
    ) => {
      if (!approval) {
        return { handled: false, result: null as AgentRuntimeResult | null };
      }

      const prohibitedApprovalResult = createAgentProductionProhibitedApprovalRejection(
        approval.command,
        stepIndex,
        label,
      );
      if (prohibitedApprovalResult) {
        return {
          handled: true,
          result: prohibitedApprovalResult,
        };
      }

      const approvalToolCall = approval.command.toolCall;
      const windowTargetResolution = resolveAgentWindowTargetBeforeDispatch({
        args: approvalToolCall?.input ?? {},
        sourceText,
        toolName: approvalToolCall?.name ?? '',
        toolResults,
        userGoal,
      });
      if (
        windowTargetResolution.kind === 'observe'
        || windowTargetResolution.kind === 'repair'
      ) {
        const suggestedPreflight = windowTargetResolution.kind === 'observe'
          ? windowTargetResolution.command.toolCall?.name ?? 'observe_windows_and_apps'
          : 'select one live HWND/PID from the latest window inventory';
        historyLines.push([
          `Step ${stepIndex} rejected unresolved window approval before assembly:`,
          windowTargetResolution.reason,
          `suggestedPreflight=${suggestedPreflight}`,
        ].join('\n'));
        appendTraceEvent({
          details: {
            args: approvalToolCall?.input ?? {},
            label,
            reason: windowTargetResolution.reason,
            suggestedPreflight,
          },
          status: 'window-target-unresolved',
          stepIndex,
          summary: 'Window approval was rejected until one live HWND/PID identity is selected.',
          tool: approvalToolCall?.name ?? approval.command.kind,
          type: 'decision_rejected',
        });
        return { handled: false, result: null as AgentRuntimeResult | null };
      }

      let resolvedApproval = approval;
      if (windowTargetResolution.kind === 'ready' && approvalToolCall) {
        const resolvedCommand: AgentChatCommand = {
          ...approval.command,
          toolCall: {
            ...approvalToolCall,
            input: windowTargetResolution.args,
          },
        };
        const resolvedRoute = buildAgentPermissionRoute(resolvedCommand);
        if (!resolvedRoute.plan || resolvedRoute.blockedStep || !resolvedRoute.requiresApproval) {
          historyLines.push([
            `Step ${stepIndex} rejected window approval after identity binding:`,
            `permission=${resolvedRoute.summary}`,
          ].join('\n'));
          return { handled: false, result: null as AgentRuntimeResult | null };
        }
        resolvedApproval = {
          ...approval,
          command: resolvedCommand,
          plan: resolvedRoute.plan,
          routeSummary: resolvedRoute.summary,
        };
      }

      const repeatedRetry = rejectRepeatedUnverifiedActionRetry(
        resolvedApproval.command,
        stepIndex,
        understanding ?? null,
      );
      if (repeatedRetry.finalResult) {
        return { handled: true, result: repeatedRetry.finalResult };
      }
      if (repeatedRetry.rejected) {
        return { handled: true, result: null };
      }

      const assembly = createAgentPendingApprovalAssembly({
        approval: resolvedApproval,
        label,
        stepIndex,
      });
      historyLines.push(assembly.historyLine);
      appendTraceEvent(assembly.traceEvent);
      appendV3PilotShadowPendingApproval(assembly);

      return {
        handled: true,
        result: createFinalResult({
          finalAnswer: assembly.finalAnswer,
          pendingApproval: assembly.pendingApproval,
          status: assembly.status,
        }),
      };
    };

  return {
    rejectRepeatedUnverifiedActionRetry,
    createAgentProductionProhibitedApprovalRejection,
    prepareAgentProductionPendingApprovalResult,
  };
}
