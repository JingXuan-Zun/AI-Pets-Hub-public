import { type AgentChatCommand, type AgentStructuredToolCandidateEvidence, type AgentStructuredToolEvidence } from '../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { AGENT_RETRY_AVOIDANCE_POST_ACTION_STATES } from '../runtime/agentPlanningSignalEvidence';
import { resolveAgentVisualCandidateScreenPoint as resolveAgentSessionV2CandidateScreenPoint } from './visualCoordinates';
import { getAgentVisualPointDistance as getAgentSessionV2PointDistance } from './visualCandidateEvidence';

interface AgentProductionVisualRetryDependencies {
  findRecoverableUnverifiedActionAttempt: (entries: AgentRuntimeToolResultEntry[]) => AgentRuntimeToolResultEntry | null;
  resolveRecoveryPostActionState: (options: {
    entry: AgentRuntimeToolResultEntry | null;
    sourceText: string;
    userGoal: string;
  }) => string;
}

export function createAgentProductionVisualRetryEvidence(dependencies: AgentProductionVisualRetryDependencies) {
  function getAgentProductionCommandClickPoints(command: AgentChatCommand): Array<{ x: number; y: number }> {
    const toolName = command.toolCall?.name ?? '';
    const input = command.toolCall?.input ?? {};
    if (toolName === 'execute_desktop_action') {
      const action = typeof input.action === 'string' ? normalizeAgentProductionToolActionName(input.action) : '';
      const point = (action === 'interact_window_ui' || action === 'invoke_window_ui')
        ? getAgentProductionWindowUiInputPoint(input)
        : null;
      return point ? [point] : [];
    }

    if (toolName === 'execute_desktop_input') {
      const action = typeof input.action === 'string' ? normalizeAgentProductionToolActionName(input.action) : '';
      const x = Number(input.x);
      const y = Number(input.y);
    return (action === 'click' || action === 'double_click') && Number.isFinite(x) && Number.isFinite(y)
        ? [{ x: Math.round(x), y: Math.round(y) }]
        : [];
    }

    if (toolName !== 'execute_desktop_sequence' || typeof input.stepsJson !== 'string') {
      return [];
    }

    try {
      const steps = JSON.parse(input.stepsJson) as unknown;
      if (!Array.isArray(steps)) {
        return [];
      }

      return steps.flatMap((step) => {
        if (!step || typeof step !== 'object') {
          return [];
        }

        const record = step as Record<string, unknown>;
        const nestedTool = typeof record.tool === 'string' ? record.tool : '';
        const nestedArgs = record.args && typeof record.args === 'object'
          ? record.args as Record<string, unknown>
          : {};
        if (nestedTool === 'execute_desktop_action') {
          const action = typeof nestedArgs.action === 'string'
            ? normalizeAgentProductionToolActionName(nestedArgs.action)
            : '';
          const point = (action === 'interact_window_ui' || action === 'invoke_window_ui')
            ? getAgentProductionWindowUiInputPoint(nestedArgs)
            : null;
          return point ? [point] : [];
        }

        if (nestedTool !== 'execute_desktop_input') {
          return [];
        }

        const action = typeof nestedArgs.action === 'string'
          ? normalizeAgentProductionToolActionName(nestedArgs.action)
          : '';
        const x = Number(nestedArgs.x);
        const y = Number(nestedArgs.y);
        return (action === 'click' || action === 'double_click') && Number.isFinite(x) && Number.isFinite(y)
          ? [{ x: Math.round(x), y: Math.round(y) }]
          : [];
      });
    } catch {
      return [];
    }
  }

  function normalizeAgentProductionWindowUiSignatureValue(value: unknown) {
    return typeof value === 'string'
      ? value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ')
      : '';
  }

  function getAgentProductionWindowUiPointKey(point: { x: number; y: number }) {
    return `point:${Math.round(point.x / 12)}:${Math.round(point.y / 12)}`;
  }

  function getAgentProductionWindowUiInputPoint(input: Record<string, unknown>) {
    const x = Number(
      Number.isFinite(Number(input.x))
        ? input.x
        : input.fallbackX,
    );
    const y = Number(
      Number.isFinite(Number(input.y))
        ? input.y
        : input.fallbackY,
    );
    return Number.isFinite(x) && Number.isFinite(y)
      ? { x: Math.round(x), y: Math.round(y) }
      : null;
  }

  function getAgentProductionWindowUiIdentityKeysFromInput(input: Record<string, unknown>) {
    const keys: string[] = [];
    const hwnd = Number(input.hwnd);
    if (Number.isFinite(hwnd) && hwnd > 0) {
      keys.push(`hwnd:${Math.round(hwnd)}`);
    }

    const query = normalizeAgentProductionWindowUiSignatureValue(input.query);
    if (query) {
      keys.push(`query:${query}`);
    }

    keys.push('any');
    return [...new Set(keys)];
  }

  function getAgentProductionWindowUiIdentityKeysFromCandidate(candidate: AgentStructuredToolCandidateEvidence) {
    const keys: string[] = [];
    const hwnd = Number(candidate.window?.hwnd);
    if (Number.isFinite(hwnd) && hwnd > 0) {
      keys.push(`hwnd:${Math.round(hwnd)}`);
    }

    const title = normalizeAgentProductionWindowUiSignatureValue(candidate.window?.title);
    if (title) {
      keys.push(`query:${title}`);
    }

    const processName = normalizeAgentProductionWindowUiSignatureValue(candidate.window?.processName);
    if (processName) {
      keys.push(`process:${processName}`);
    }

    keys.push('any');
    return [...new Set(keys)];
  }

  function createAgentProductionWindowUiSignatureKeys(options: {
    automationId?: unknown;
    controlType?: unknown;
    identities: string[];
    point?: { x: number; y: number } | null;
    targetText?: unknown;
  }) {
    const keys: string[] = [];
    const automationId = normalizeAgentProductionWindowUiSignatureValue(options.automationId);
    const controlType = normalizeAgentProductionWindowUiSignatureValue(options.controlType);
    const targetText = normalizeAgentProductionWindowUiSignatureValue(options.targetText);
    const pointKey = options.point ? getAgentProductionWindowUiPointKey(options.point) : '';
    const identities = options.identities.length ? options.identities : ['any'];

    if (automationId) {
      for (const identity of identities) {
        keys.push(`uia:id:${identity}:${automationId}:${controlType}`);
      }
    }

    if (pointKey) {
      keys.push(`uia:${pointKey}`);
    }

    if (targetText && pointKey) {
      keys.push(`uia:text-point:${targetText}:${pointKey}:${controlType}`);
    }

    return [...new Set(keys)];
  }

  function getAgentProductionCommandWindowUiInputs(command: AgentChatCommand) {
    const toolName = command.toolCall?.name ?? '';
    const input = command.toolCall?.input ?? {};
    const isWindowUiInput = (value: Record<string, unknown>) => {
      const action = typeof value.action === 'string'
        ? normalizeAgentProductionToolActionName(value.action)
        : '';
      return action === 'interact_window_ui' || action === 'invoke_window_ui';
    };

    if (toolName === 'execute_desktop_action' && isWindowUiInput(input)) {
      return [input];
    }

    if (toolName !== 'execute_desktop_sequence' || typeof input.stepsJson !== 'string') {
      return [];
    }

    try {
      const steps = JSON.parse(input.stepsJson) as unknown;
      if (!Array.isArray(steps)) {
        return [];
      }

      return steps.flatMap((step) => {
        if (!step || typeof step !== 'object') {
          return [];
        }

        const record = step as Record<string, unknown>;
        const nestedTool = typeof record.tool === 'string' ? record.tool : '';
        const nestedArgs = record.args && typeof record.args === 'object'
          ? record.args as Record<string, unknown>
          : {};
        return nestedTool === 'execute_desktop_action' && isWindowUiInput(nestedArgs)
          ? [nestedArgs]
          : [];
      });
    } catch {
      return [];
    }
  }

  function getAgentProductionCommandWindowUiSignatureKeys(command: AgentChatCommand) {
    return [
      ...new Set(
        getAgentProductionCommandWindowUiInputs(command).flatMap((input) => createAgentProductionWindowUiSignatureKeys({
          automationId: input.automationId,
          controlType: input.controlType,
          identities: getAgentProductionWindowUiIdentityKeysFromInput(input),
          point: getAgentProductionWindowUiInputPoint(input),
          targetText: input.targetText,
        })),
      ),
    ];
  }

  function getAgentProductionPreviousUnverifiedWindowUiSignatureKeys(
    toolResults: AgentRuntimeToolResultEntry[] | null | undefined,
  ) {
    const previousAttempt = dependencies.findRecoverableUnverifiedActionAttempt(toolResults ?? []);
    const postActionState = dependencies.resolveRecoveryPostActionState({
      entry: previousAttempt,
      sourceText: previousAttempt?.command.sourceText ?? '',
      userGoal: previousAttempt?.command.toolCall?.goal ?? previousAttempt?.command.instruction ?? '',
    });
    return previousAttempt && AGENT_RETRY_AVOIDANCE_POST_ACTION_STATES.has(postActionState)
      ? getAgentProductionCommandWindowUiSignatureKeys(previousAttempt.command)
      : [];
  }

  function isAgentProductionSameUnverifiedWindowUiCandidate(options: {
    candidate: AgentStructuredToolCandidateEvidence;
    evidence: AgentStructuredToolEvidence | null;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
  }) {
    const previousAttempt = dependencies.findRecoverableUnverifiedActionAttempt(options.toolResults ?? []);
    const postActionState = dependencies.resolveRecoveryPostActionState({
      entry: previousAttempt,
      sourceText: previousAttempt?.command.sourceText ?? '',
      userGoal: previousAttempt?.command.toolCall?.goal ?? previousAttempt?.command.instruction ?? '',
    });
    if (
      !previousAttempt
      || !AGENT_RETRY_AVOIDANCE_POST_ACTION_STATES.has(postActionState)
    ) {
      return false;
    }

    const previousWindowUiSignatureKeys = getAgentProductionCommandWindowUiSignatureKeys(previousAttempt.command);
    if (!previousWindowUiSignatureKeys.length) {
      return false;
    }

    const candidateWindowUiSignatureKeys = getAgentProductionCandidateWindowUiSignatureKeys(
      options.candidate,
      options.evidence,
    );
    return candidateWindowUiSignatureKeys.some((key) => previousWindowUiSignatureKeys.includes(key));
  }

  function hasAgentProductionSameRetryAvoidanceWindowUiCandidate(options: {
    candidate: AgentStructuredToolCandidateEvidence;
    evidence: AgentStructuredToolEvidence | null;
    toolResults?: AgentRuntimeToolResultEntry[] | null;
  }) {
    return isAgentProductionSameUnverifiedWindowUiCandidate(options);
  }

  function getAgentProductionCandidateWindowUiSignatureKeys(
    candidate: AgentStructuredToolCandidateEvidence,
    evidence: AgentStructuredToolEvidence | null,
  ) {
    const point = resolveAgentSessionV2CandidateScreenPoint(candidate, evidence);
    return createAgentProductionWindowUiSignatureKeys({
      automationId: candidate.automationId,
      controlType: candidate.controlType,
      identities: getAgentProductionWindowUiIdentityKeysFromCandidate(candidate),
      point,
      targetText: candidate.name ?? candidate.label ?? evidence?.targetMatched,
    });
  }

  function getAgentProductionPreviousUnverifiedActionPoints(
    toolResults: AgentRuntimeToolResultEntry[] | null | undefined,
  ) {
    const previousAttempt = dependencies.findRecoverableUnverifiedActionAttempt(toolResults ?? []);
    return previousAttempt ? getAgentProductionCommandClickPoints(previousAttempt.command) : [];
  }

  function isAgentProductionNearPreviousActionPoint(
    point: { x: number; y: number },
    previousPoints: Array<{ x: number; y: number }>,
  ) {
    return previousPoints.some((previousPoint) => (
      getAgentSessionV2PointDistance(point, previousPoint) <= 12
    ));
  }

  function normalizeAgentProductionToolActionName(value: string) {
    return value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  }

  return {
    getAgentProductionCommandClickPoints,
    getAgentProductionPreviousUnverifiedWindowUiSignatureKeys,
    isAgentProductionSameUnverifiedWindowUiCandidate,
    hasAgentProductionSameRetryAvoidanceWindowUiCandidate,
    getAgentProductionCandidateWindowUiSignatureKeys,
    getAgentProductionPreviousUnverifiedActionPoints,
    isAgentProductionNearPreviousActionPoint,
    normalizeAgentProductionToolActionName,
  };
}
