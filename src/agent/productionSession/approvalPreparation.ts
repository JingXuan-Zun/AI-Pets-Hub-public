import {
  getAgentProductionCandidateUiActions as getAgentSessionV2CandidateUiActions,
} from "./windowUiActionIntent";
import {
  getAgentVisualCandidateTextRelevanceScore as getAgentSessionV2CandidateTextRelevanceScore,
  getAgentVisualCandidateConfidenceScore as getAgentSessionV2CandidateConfidenceScore,
  isAgentVisualLoginRequiredEvidence as isAgentSessionV2LoginRequiredEvidence,
} from "./visualCandidateEvidence";
import {
  resolveAgentVisualCandidateScreenPoint as resolveAgentSessionV2CandidateScreenPoint,
} from "./visualCoordinates";
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolEvidence,
  type AgentToolCallName,
} from "../agentChatCommand";
import {
  buildAgentPermissionRoute,
  isAgentPermissionRouteSilentReadOnly,
} from "../agentPermissionRouter";
import {
  getAgentStructuredEvidence as getAgentStructuredEvidence,
} from "../runtime/agentPlanningSignalEvidence";
import {
  createAgentTargetSelectionApprovalReason,
} from "../runtime/agentApprovalReasonSignals";
import {
  createAgentToolCommand as createAgentToolCommand,
} from "../runtime/agentToolCommandFactory";
import {
  hasAgentDirectActionIntent as hasAgentDirectActionIntent,
} from "../runtime/agentActionCoverage";
import { type AgentRuntimeToolResultEntry, type AgentRuntimePendingApproval } from '../runtime/agentRuntimeContract';
import { type AgentModelParallelToolCall } from '../runtime/agentModelDecisionRuntime';
import { type createAgentProductionVisualRetryEvidence } from './visualRetryEvidence';
import { type createAgentProductionVisualSequenceCommands } from './visualSequenceCommands';

export function createAgentProductionApprovalPreparation(options: {
  retryEvidence: Pick<ReturnType<typeof createAgentProductionVisualRetryEvidence>, 'hasAgentProductionSameRetryAvoidanceWindowUiCandidate'>;
  sequenceCommands: Pick<ReturnType<typeof createAgentProductionVisualSequenceCommands>, 'createAgentProductionTargetSelectionSequenceCommand'>;
  isLoginControlEvidence: (evidence: AgentStructuredToolEvidence | null) => boolean;
  toolNames: ReadonlySet<AgentToolCallName>;
  isPrimaryToolName: (tool: string | null | undefined) => boolean;
  rejectVideoSummarySearch: (options: {
    args: Record<string, unknown> | undefined;
    sourceText: string;
    toolName: AgentToolCallName;
    userGoal: string;
  }) => boolean;
  rejectTransitionalDesktopAction: (options: {
    args: Record<string, unknown> | undefined;
    toolName: AgentToolCallName;
  }) => boolean;
}) {
  const {
    isLoginControlEvidence: isAgentSessionV2LoginControlEvidence,
    toolNames: AGENT_SESSION_V2_TOOL_NAMES,
    isPrimaryToolName: isAgentSessionV2PrimaryToolName,
    rejectVideoSummarySearch: shouldRejectAgentSessionV2VideoSummarySearch,
    rejectTransitionalDesktopAction: shouldRejectAgentSessionV2TransitionalDesktopAction,
  } = options;
  const { hasAgentProductionSameRetryAvoidanceWindowUiCandidate: hasAgentSessionV2SameRetryAvoidanceWindowUiCandidate } = options.retryEvidence;
  const { createAgentProductionTargetSelectionSequenceCommand: createAgentSessionV2TargetSelectionSequenceCommand } = options.sequenceCommands;

  function resolveAgentProductionTargetSelectionCandidate(options: {
    evidence: AgentStructuredToolEvidence | null;
    sourceText: string;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
    userGoal: string;
  }) {
    const targetCandidates = Array.isArray(options.evidence?.targetCandidates)
      ? options.evidence.targetCandidates
      : [];
    return targetCandidates
      .map((candidate, index) => {
        if (candidate.selected === true || candidate.enabled === false || candidate.offscreen === true) {
          return null;
        }

        const point = resolveAgentSessionV2CandidateScreenPoint(candidate, options.evidence);
        const actions = getAgentSessionV2CandidateUiActions(candidate);
        const repeatedFailedCandidate = hasAgentSessionV2SameRetryAvoidanceWindowUiCandidate({
          candidate,
          evidence: options.evidence,
          toolResults: options.toolResults,
        });
        const relevanceScore = getAgentSessionV2CandidateTextRelevanceScore({
          candidate,
          evidence: options.evidence,
          sourceText: options.sourceText,
          userGoal: options.userGoal,
        });
        let score = getAgentSessionV2CandidateConfidenceScore(candidate.confidence) + relevanceScore - index;
        if (point) {
          score += 34;
        }
        if (actions.includes('select')) {
          score += repeatedFailedCandidate ? 6 : 36;
        }
        if (repeatedFailedCandidate && actions.includes('scroll-into-view')) {
          score += 46;
        }
        if (repeatedFailedCandidate && actions.includes('focus')) {
          score += 34;
        }
        if (candidate.selectionItem === true) {
          score += 24;
        }
        if (candidate.automationId?.trim()) {
          score += 16;
        }
        if (candidate.controlType?.trim()) {
          score += 8;
        }
        if (candidate.source === 'ui-automation' || candidate.source === 'uia-visual-fusion') {
          score += 16;
        }
        if (!point && !actions.includes('select')) {
          return null;
        }
        if (
          repeatedFailedCandidate
          && !actions.includes('scroll-into-view')
          && !actions.includes('focus')
          && !point
        ) {
          return null;
        }

        return {
          candidate,
          point,
          score,
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
      .sort((a, b) => b.score - a.score)
      .at(0) ?? null;
  }

  function resolveAgentProductionTargetSelectionApproval(options: {
    command: AgentChatCommand;
    result: AgentChatCommandResult;
    sourceText: string;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
    userGoal: string;
  }): AgentRuntimePendingApproval | null {
    if (!hasAgentDirectActionIntent(options.sourceText, options.userGoal) || options.result.ok === false) {
      return null;
    }

    const entry: AgentRuntimeToolResultEntry = {
      command: options.command,
      result: options.result,
    };
    const evidence = getAgentStructuredEvidence(entry);
    if (isAgentSessionV2LoginRequiredEvidence(evidence) || isAgentSessionV2LoginControlEvidence(evidence)) {
      return null;
    }

    const hasSelectableTargetCandidate = Array.isArray(evidence?.targetCandidates)
      && evidence.targetCandidates.some((candidate) => (
        candidate.selected !== true
        && candidate.enabled !== false
        && candidate.offscreen !== true
        && (
          Boolean(resolveAgentSessionV2CandidateScreenPoint(candidate, evidence))
          || getAgentSessionV2CandidateUiActions(candidate).includes('select')
        )
      ));
    if (
      evidence?.visualActionReadiness !== 'needs-target-selection'
      && !(evidence?.visualActionReadiness === 'needs-primary-action' && hasSelectableTargetCandidate)
      && evidence?.selectionVerificationStatus !== 'visible-only'
      && evidence?.selectionVerificationStatus !== 'mismatch'
    ) {
      return null;
    }

    const selectionCandidate = resolveAgentProductionTargetSelectionCandidate({
      evidence,
      sourceText: options.sourceText,
      toolResults: options.toolResults,
      userGoal: options.userGoal,
    });
    if (!selectionCandidate) {
      return null;
    }

    if (
      evidence?.confidence === 'low'
      || (
        selectionCandidate.candidate.confidence === 'low'
        && !getAgentSessionV2CandidateUiActions(selectionCandidate.candidate).includes('select')
      )
    ) {
      return null;
    }

    const command = createAgentSessionV2TargetSelectionSequenceCommand({
      candidate: selectionCandidate.candidate,
      entry,
      point: selectionCandidate.point,
      sourceText: options.sourceText,
      toolResults: options.toolResults,
      userGoal: options.userGoal,
    });
    if (!command) {
      return null;
    }

    const route = buildAgentPermissionRoute(command);
    if (!route.plan || route.blockedStep || !route.requiresApproval) {
      return null;
    }

    const targetText = selectionCandidate.candidate.label?.trim()
      || selectionCandidate.candidate.name?.trim()
      || evidence?.targetMatched?.trim()
      || 'target item';
    return {
      command,
      plan: route.plan,
      reason: createAgentTargetSelectionApprovalReason({
        currentSelection: evidence?.currentSelection,
        targetText,
        usingAlternateRecovery: hasAgentSessionV2SameRetryAvoidanceWindowUiCandidate({
          candidate: selectionCandidate.candidate,
          evidence,
          toolResults: options.toolResults,
        }),
      }),
      routeSummary: route.summary,
    };
  }

  const AGENT_PRODUCTION_BATCHABLE_SEQUENCE_TOOL_NAMES = new Set<AgentToolCallName>([
    'execute_desktop_action',
    'execute_desktop_input',
  ]);

  function resolveAgentProductionParallelApprovalBatchPostVerifyQuery(
    tools: AgentModelParallelToolCall[],
    sourceText: string,
    userGoal: string,
  ) {
    const candidates: unknown[] = [];
    for (const requestedTool of [...tools].reverse()) {
      const args = requestedTool.args ?? {};
      candidates.push(
        args.postVerifyVisualQuery,
        args.postVerifyQuery,
        args.visualVerifyQuery,
        args.verifyQuery,
        args.target,
        args.query,
        args.url,
        args.title,
        args.name,
      );
    }

    candidates.push(userGoal, sourceText);

    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }

    return '';
  }

  function createAgentProductionParallelApprovalBatch(options: {
    reason?: string | null;
    sourceText: string;
    tools: AgentModelParallelToolCall[];
    userGoal: string;
  }): AgentRuntimePendingApproval | null {
    if (!options.tools.length) {
      return null;
    }

    const steps: Array<{ args: Record<string, unknown>; reason: string; tool: AgentToolCallName }> = [];
    for (const requestedTool of options.tools.slice(0, 6)) {
      const toolName = requestedTool.tool as AgentToolCallName;
      const args = requestedTool.args ?? {};
      if (
        !AGENT_SESSION_V2_TOOL_NAMES.has(toolName)
        || !isAgentSessionV2PrimaryToolName(toolName)
        || !AGENT_PRODUCTION_BATCHABLE_SEQUENCE_TOOL_NAMES.has(toolName)
        || shouldRejectAgentSessionV2VideoSummarySearch({
          args,
          sourceText: options.sourceText,
          toolName,
          userGoal: options.userGoal,
        })
        || shouldRejectAgentSessionV2TransitionalDesktopAction({
          args,
          toolName,
        })
      ) {
        return null;
      }

      const primitiveCommand = createAgentToolCommand({
        args,
        sourceText: options.sourceText,
        toolName,
        userGoal: options.userGoal,
      });
      const primitiveRoute = buildAgentPermissionRoute(primitiveCommand);
      if (
        primitiveRoute.blockedStep
        || !primitiveRoute.requiresApproval
        || isAgentPermissionRouteSilentReadOnly(primitiveRoute)
      ) {
        return null;
      }

      steps.push({
        args,
        reason: requestedTool.reason?.trim()
          || `Run ${toolName} as part of the requested multi-step desktop action.`,
        tool: toolName,
      });
    }

    const postVerifyQuery = resolveAgentProductionParallelApprovalBatchPostVerifyQuery(
      options.tools,
      options.sourceText,
      options.userGoal,
    );
    const command = createAgentToolCommand({
      args: {
        ...(postVerifyQuery ? {
          postVerifyQuery,
          postVerifyVisualQuery: postVerifyQuery,
        } : {}),
        stepsJson: JSON.stringify(steps),
        stopOnError: true,
      },
      sourceText: options.sourceText,
      toolName: 'execute_desktop_sequence',
      userGoal: options.userGoal,
    });
    const route = buildAgentPermissionRoute(command);
    if (!route.plan || route.blockedStep || !route.requiresApproval) {
      return null;
    }

    return {
      command,
      plan: route.plan,
      reason: options.reason?.trim()
        || (steps.length > 1
          ? `Combine ${steps.length} approval-required desktop steps into one permission request.`
          : steps[0]?.reason ?? 'Route this approval-required desktop step through the permission request.'),
      routeSummary: route.summary,
    };
  }

  return {
    resolveAgentProductionTargetSelectionApproval,
    createAgentProductionParallelApprovalBatch,
  };
}
