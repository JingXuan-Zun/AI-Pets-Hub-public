import { type PetConfig } from '../types';
import { type AgentExternalSkillDefinition } from './agentExternalSkillLibrary';
import { formatActiveAgentImportedSkillInstruction, formatAgentImportedSkillCatalog, resolveExplicitAgentImportedSkillIntent } from './agentImportedSkillIntent';
import { resolveAgentProductionSessionInstruction } from './agentProductionSessionInstruction';
import {
  type AgentChatCommand,
  type AgentChatFollowUpAction,
  type AgentChatCommandResult,
  type AgentStructuredToolCandidateEvidence,
  type AgentStructuredToolEvidence,
  type AgentStructuredToolPointEvidence,
  type AgentStructuredToolRectEvidence,
  type AgentToolCallName,
} from './agentChatCommand';
import {
  evaluateAgentVisualSampleConsensus,
  evaluateAgentVisualTargetVerification,
} from './agentVisualTargetVerification';
import { type AgentWorkingMemorySnapshot } from './agentChatContext';
import {
  assessAgentCommandResult,
  resolveAgentResultFollowUpActions,
} from './agentResultAssessment';
import {
  buildAgentPermissionRoute,
  isAgentPermissionRouteSilentReadOnly,
} from './agentPermissionRouter';
import {
  extractPlannerExistingWindowMoveTargetFromText,
  extractPlannerOpenAndMoveTargetFromText,
  normalizePlannerDisplayMoveTarget,
} from './agentPlanner';
import { createAgentRuntimeCoreOpenMoveSequenceInput } from './agentRuntimeCore';
import { evaluateAgentEvidenceTerminal } from './runtime/agentEvidenceEngine';
import {
  type AgentRuntimeContinuation,
  type AgentRuntimeCoveredParallelToolCommand,
  type AgentRuntimeDecisionAction,
  type AgentRuntimeDiagnosticEnvelope,
  type AgentRuntimeParallelToolExecutionPlan,
  type AgentRuntimePendingApproval,
  type AgentRuntimeProgressEvent,
  type AgentRuntimeProgressEventType,
  type AgentRuntimeProgressHandler,
  type AgentRuntimeResult,
  type AgentRuntimeStatus,
  type AgentRuntimeStep,
  type AgentTaskRuntimeStateRecord,
  type AgentTaskRuntimeModelIterationAuthorizer,
  type AgentRuntimeTimingEntry,
  type AgentRuntimeTimingEntryKind,
  type AgentRuntimeTimingEntryStatus,
  type AgentRuntimeTimingStopReason,
  type AgentRuntimeTimingTrace,
  type AgentRuntimeToolExecutor,
  type AgentRuntimeToolExecutorContext,
  type AgentRuntimeToolResultEntry,
  type AgentRuntimeTraceEvent,
  type AgentRuntimeTraceEventType,
  type AgentRuntimeUnderstanding,
  type AgentRuntimeVerificationStatus,
  type AgentTaskRuntimeRecoveryAuthorizer,
} from './runtime/agentRuntimeContract';
import {
  createAgentRuntimeDiagnostic,
  upsertAgentRuntimeDiagnostic,
} from './runtime/agentRuntimeDiagnostics';
import {
  createAgentPlannerAvailableToolLines,
  listAgentToolNames,
} from './agentToolRegistry';
import {
  parseAgentDecisionContract,
  prepareAgentDecisionToolInput,
} from './runtime/agentDecisionContract';
import { bindAgentToolDisplayTargetToExplicitIntent } from './runtime/agentDisplayTargetIntent';
import {
  createAgentModelInput,
  createAgentPlanningContext,
  type AgentPlanningContext,
  type AgentPlanningContextAdapters,
} from './runtime/agentPlanningContextRuntime';
import { createAgentGuardedWorkingMemoryText } from './runtime/agentWorkingMemoryBias';
import { createAgentWorkingMemoryConflictSignalText } from './runtime/agentWorkingMemoryConflict';
import { createAgentTaskProgressText } from './runtime/agentTaskProgressSignal';
import { createAgentResultVerificationSignalText } from './runtime/agentResultVerificationSignal';
import { runAgentModelDecisionTurn } from './runtime/agentModelDecisionRuntime';
import {
  createAgentReplanSignalText,
  type AgentReplanSignalDependencies,
} from './runtime/agentReplanSignal';
import { createAgentTraceStuckSignalText } from './runtime/agentTraceStuckSignal';
import {
  createAgentApprovalRequiredTraceSummary,
  createAgentPermissionRoutedTraceSummary,
} from './runtime/agentDecisionTraceSummary';
import {
  AGENT_RETRY_AVOIDANCE_POST_ACTION_STATES as AGENT_RETRY_AVOIDANCE_POST_ACTION_STATES,
  AGENT_TRANSITIONAL_POST_ACTION_STATES as AGENT_TRANSITIONAL_POST_ACTION_STATES,
  createAgentActionPrimitiveSignature as createAgentActionPrimitiveSignature,
  createAgentToolCallSignature as createAgentToolCallSignature,
  getAgentActionEvidence as getAgentActionEvidence,
  getAgentPostActionState as getAgentPostActionState,
  getAgentStructuredEvidence as getAgentStructuredEvidence,
  getLatestAgentToolResult as getLatestAgentToolResult,
  hasAgentCandidateLocationEvidence as hasAgentCandidateLocationEvidence,
  isAgentActionResultTool as isAgentActionResultTool,
} from './runtime/agentPlanningSignalEvidence';
import {
  AGENT_TOOL_RESULT_CACHE_HIT_PREFIX,
  isAgentCachedToolResult,
} from './runtime/agentToolResultCacheEvidence';
import { formatAgentToolResultForModel } from './runtime/agentToolResultSummary';
import {
  createAgentRecentVisualContextText,
  createAgentVisualRecoveryText,
  isAgentVisualContextToolCommand,
} from './runtime/agentVisualPlanningSignals';
import {
  createAgentApprovalReadyFollowUpReason,
  createAgentApprovalRequiredToolReason,
  createAgentTargetSelectionApprovalReason,
  createAgentTargetSelectionCoordinateStepReason,
  createAgentTargetSelectionUiAutomationStepReason,
  createAgentVisualActionApprovalReason,
  createAgentVisualInputStepReason,
  createAgentVisualInvokeApprovalReason,
  createAgentVisualInvokeSubmitStepReason,
  createAgentVisualInvokeTextInputStepReason,
  createAgentVisualInvokeWindowUiStepReason,
  type AgentVisualInputFallbackMode,
} from './runtime/agentApprovalReasonSignals';
import { type AgentRecoveryStrategyRankingDependencies } from './runtime/agentRecoveryStrategyRanking';
import {
  resolveAgentDesktopAutoRecoveryQuery as resolveAgentDesktopAutoRecoveryQuery,
} from './capabilities/agentDesktopRecoveryCommandBuilder';
import {
  createAgentSubgoalId,
  createAgentToolCommand as createAgentToolCommand,
} from './runtime/agentToolCommandFactory';
import { createAgentVisibleClickActionablePreflightCommand } from './agentVisibleClickPreflight';
import {
  collectAgentDesktopAutoRecoveryEvidenceText as collectAgentDesktopAutoRecoveryEvidenceText,
  countAgentDesktopAutoRecoveryWaits as countAgentDesktopAutoRecoveryWaits,
  findLatestAgentDesktopAutoRecoverySourceEntry as findLatestAgentDesktopAutoRecoverySourceEntry,
  hasAgentDesktopAutoRecoveryWaitBudgetRemaining as hasAgentDesktopAutoRecoveryWaitBudgetRemaining,
  isAgentDesktopAutoRecoveryCommand as isAgentDesktopAutoRecoveryCommand,
  isAgentDesktopAutoRecoveryReadCommand as isAgentDesktopAutoRecoveryReadCommand,
  isAgentDesktopAutoRecoveryWaitCapReadCommand as isAgentDesktopAutoRecoveryWaitCapReadCommand,
  isAgentDesktopAutoRecoveryWaitCommand as isAgentDesktopAutoRecoveryWaitCommand,
  resolveAgentDesktopAutoRecoveryMaxWaits as resolveAgentDesktopAutoRecoveryMaxWaits,
} from './capabilities/agentDesktopRecoveryObservationBuilder';
import { createAgentDesktopRecoveryCapabilityAdapter } from './capabilities/agentDesktopRecoveryCapabilityAdapter';
import { createAgentVisualRefinementCommand } from './capabilities/agentVisualRefinementCapabilityAdapter';
import {
  AGENT_RECOVERY_CONTROLLER_DEFAULT_MAX_TRANSITIONS,
  createAgentRecoveryLoopState,
  decideAgentRecoveryTrigger,
  proposeAgentRecovery,
  transitionAgentRecoveryLoop,
  type AgentRecoveryTriggerDecision,
} from './runtime/agentRecoveryController';
import { runAgentTargetResolutionExecution } from './runtime/agentTargetResolutionExecutionRuntime';
import { isAgentTargetResolutionAvailable } from './runtime/agentTargetResolutionRuntime';
import {
  hasAgentActionableWindowTargetEvidence,
  resolveAgentObservedWindowTargetEvidence,
} from './runtime/agentTargetResolutionContext';
import { resolveAgentWindowTargetBeforeDispatch } from './runtime/agentWindowTargetResolutionRuntime';
import { runAgentRecoveryExecution } from './runtime/agentRecoveryExecutionRuntime';
import { runAgentVisualRefinementExecution } from './runtime/agentVisualRefinementExecutionRuntime';
import {
  collectAgentRuntimeLifecycleFacts,
  type AgentRuntimeLifecycleFact,
} from './runtime/agentProductionLifecycleFacts';
import {
  hasAgentAuthenticationHardGateCue,
  resolveAgentAuthenticationGate,
} from './runtime/agentAuthenticationGate';
import { runAgentVerificationExecution } from './runtime/agentVerificationRuntime';
import { runAgentCommandExecution } from './runtime/agentCommandExecutionRuntime';
import {
  dispatchAgentRuntimeContinuation,
  runAgentApprovedActionContinuation,
  runAgentToolOutcomeContinuation,
  runAgentVerificationContinuation,
} from './runtime/agentRuntimeContinuationDispatcher';
import {
  authorizeAgentTaskRuntimeModelIteration,
} from './runtime/agentTaskRuntime';
import { appendAgentRuntimeToolEvidence } from './runtime/agentRuntimeTaskEvidence';
import {
  createAgentAutoRecoveryLoopContinuedHistoryLine,
  createAgentAutoRecoveryLoopStoppedHistoryLine,
  createAgentPostActionTerminalStoppedHistoryLine,
} from './runtime/agentExecutionProgressSignals';
import {
  evaluateAgentPostActionTerminal as evaluateAgentPostActionTerminal,
  type AgentPostActionTerminalEvaluation,
  type AgentPostActionTerminalEvaluatorDependencies as AgentPostActionTerminalEvaluatorDependencies,
} from './runtime/agentPostActionTerminalEvaluator';
import {
  createAgentAttemptedActionCoverage as createAgentAttemptedActionCoverage,
  createAgentRequestedActionCoverage as createAgentRequestedActionCoverage,
  diagnoseAgentCommandExplicitProhibition as diagnoseAgentSessionV2CommandExplicitProhibition,
  hasAgentDirectActionIntent as hasAgentDirectActionIntent,
  hasAgentEffectiveDirectActionIntent as hasAgentEffectiveDirectActionIntent,
  hasAgentExplicitVideoSearchIntent as hasAgentExplicitVideoSearchIntent,
  isAgentActionKindCovered as isAgentActionKindCovered,
  isAgentPreviewOnlyIntent as isAgentPreviewOnlyIntent,
  isAgentVideoSummaryIntent as isAgentVideoSummaryIntent,
  normalizeAgentIntentText as normalizeAgentIntentText,
  type AgentActionCoverageDependencies as AgentActionCoverageDependencies,
  type AgentRequestedActionKind as AgentRequestedActionKind,
} from './runtime/agentActionCoverage';
import {
  hasAgentDisplayObservationEvidence as hasAgentSessionV2DisplayObservationEvidence,
  isAgentPostApprovalVerificationCommand as isAgentPostApprovalVerificationCommand,
  isAgentVerifiedTargetWindowObservation as isAgentVerifiedTargetWindowObservation,
} from './runtime/agentCommandEvidencePredicates';
import {
  inferAgentSelectionPostActionStateFromStructuredEvidence as inferAgentSelectionPostActionStateFromStructuredEvidence,
  resolveAgentRecoveryPostActionState as resolveAgentSessionV2RecoveryPostActionStateWithDependencies,
  type AgentPostActionStateResolverDependencies as AgentPostActionStateResolverDependencies,
} from './runtime/agentPostActionStateResolver';
import { createAgentPostActionRecoveryFollowUpText } from './runtime/agentPostActionRecoveryFollowUpSignal';
import { createAgentCompatibilityToolRejection } from './runtime/agentCompatibilityToolRejection';
import {
  createAgentInvalidModelOutputRepairText,
  createAgentInvalidToolInputRepairText,
  createAgentUnavailableToolRepairText,
} from './runtime/agentDecisionRepairSignal';
import {
  createAgentIncompleteTaskProgressFinalRejection,
  createAgentPrematureDesktopOrganizationFinalRejection,
  createAgentPrematureWindowMoveFinalRejection,
  createAgentReadonlyObservationFinalRejection,
  createAgentRecoverableUnverifiedRejection,
  createAgentUnattemptedRequestedActionFinalRejection,
  createAgentUnverifiedResultFinalRejection,
} from './runtime/agentFinalAnswerRejectionSignals';
import {
  createAgentPrematureActionConfirmationRejection,
  createAgentRepeatedFailedToolCallRejection,
  createAgentRepeatedUnverifiedActionRetryRejection,
  createAgentTransitionalDesktopActionRejection,
  createAgentVideoSummarySearchRejection,
} from './runtime/agentDecisionRejectionSignals';
import {
  compactAgentTraceDetails,
  createAgentToolFinishedTraceDetails,
  createAgentTraceRecorder,
} from './runtime/agentTraceEvents';
import {
  evaluateAgentActionRuntime,
  updateAgentActionRuntimeQueue,
  type AgentActionRuntimeQueue,
  type AgentActionRuntimeDependencies,
} from './agentActionRuntime';
import {
  runAgentDeferredToolTransactions,
  runAgentParallelToolTransaction,
} from './runtime/agentParallelToolTransactionExecutor';
import { prepareAgentParallelToolCommands as prepareAgentParallelToolCommands } from './runtime/agentParallelToolPreparation';
import { createAgentPendingApprovalAssembly as createAgentPendingApprovalAssembly } from './runtime/agentPendingApprovalAssembly';
import {
  createAgentFinalAnswerAcceptedTraceSummary,
  createAgentUnavailableToolRejectedTraceSummary,
} from './runtime/agentDecisionTraceSummary';
import {
  type AgentSessionV3PilotShadowInputCollector,
} from './agentSessionV3PilotShadowInputCollector';
import {
  type AgentSessionV3PilotShadowDebugSummaryOptions,
  type AgentSessionV3PilotShadowModeResult,
} from './agentSessionV3PilotShadowMode';
import {
  createAgentTaskRuntimeV4SessionV2Shadow,
  type AgentTaskRuntimeV4SessionV2ShadowResult,
} from './agentTaskRuntimeV4SessionV2ShadowAdapter';
import { resolveAgentDeterministicSkillRoute as resolveAgentDeterministicSkillRoute } from './runtime/agentDeterministicSkillRoute';

export type AgentSessionV2Status = AgentRuntimeStatus;
export type AgentSessionV2DecisionAction = AgentRuntimeDecisionAction;
export type AgentSessionV2VerificationStatus = AgentRuntimeVerificationStatus;
export type AgentSessionV2Understanding = AgentRuntimeUnderstanding;

export interface AgentSessionV2Decision {
  action: AgentSessionV2DecisionAction;
  args?: Record<string, unknown>;
  message?: string;
  reason?: string;
  tool?: string | null;
  tools?: AgentSessionV2ParallelToolCall[];
  understanding?: AgentSessionV2Understanding;
}

export interface AgentSessionV2ParallelToolCall {
  args?: Record<string, unknown>;
  reason?: string | null;
  tool: string;
}

export interface AgentSessionV2ModelRequest {
  settings: PetConfig['settings'];
  signal?: AbortSignal | null;
  systemInstruction: string;
  userInput: string;
}

export type AgentSessionV2ModelCaller = (
  request: AgentSessionV2ModelRequest,
) => Promise<string>;

export type AgentSessionV2ToolExecutor = AgentRuntimeToolExecutor;
export type AgentSessionV2ToolExecutorContext = AgentRuntimeToolExecutorContext;
export type AgentSessionV2ProgressEventType = AgentRuntimeProgressEventType;
export type AgentSessionV2ProgressEvent = AgentRuntimeProgressEvent;
export type AgentSessionV2ProgressHandler = AgentRuntimeProgressHandler;

export type AgentSessionV2TimingEntryKind = AgentRuntimeTimingEntryKind;
export type AgentSessionV2TimingEntryStatus = AgentRuntimeTimingEntryStatus;
export type AgentSessionV2TimingStopReason = AgentRuntimeTimingStopReason;
export type AgentSessionV2TimingEntry = AgentRuntimeTimingEntry;
export type AgentSessionV2TimingTrace = AgentRuntimeTimingTrace;

export type AgentSessionV2Step = AgentRuntimeStep;

export type AgentSessionV2ToolResultEntry = AgentRuntimeToolResultEntry;

export type AgentSessionV2TraceEventType = AgentRuntimeTraceEventType;
export type AgentSessionV2TraceEvent = AgentRuntimeTraceEvent;
export type AgentSessionV2ContinuationState = AgentRuntimeContinuation;
export type AgentSessionV2PendingApproval = AgentRuntimePendingApproval;

export interface AgentSessionV2V3PilotShadowOptions {
  debugSummary?: AgentSessionV3PilotShadowDebugSummaryOptions | null;
  enabled?: boolean | null;
  maxTransitions?: number | null;
}

export interface AgentSessionV2DebugInfo {
  v4TaskShadow?: AgentTaskRuntimeV4SessionV2ShadowResult | null;
  v3PilotShadow?: AgentSessionV3PilotShadowModeResult | null;
}

export interface AgentSessionV2Result extends AgentRuntimeResult {
  debug?: AgentSessionV2DebugInfo | null;
}

export interface RunAgentSessionV2Options {
  approvedToolResult?: AgentSessionV2ToolResultEntry | null;
  initialCommand?: AgentChatCommand | null;
  authorizeModelIteration?: AgentTaskRuntimeModelIterationAuthorizer | null;
  authorizeRecovery?: AgentTaskRuntimeRecoveryAuthorizer | null;
  cancellationSignal?: AbortSignal | null;
  continuation?: AgentSessionV2ContinuationState | null;
  maxDurationMs?: number;
  maxModelCalls?: number;
  maxSteps?: number;
  importedSkills?: readonly AgentExternalSkillDefinition[];
  maxToolCalls?: number;
  modelCaller?: AgentSessionV2ModelCaller;
  onProgress?: AgentSessionV2ProgressHandler;
  personaBehaviorContract?: string;
  settings: PetConfig['settings'];
  sourceText: string;
  toolExecutor?: AgentSessionV2ToolExecutor;
  userGoal: string;
  v3PilotShadow?: AgentSessionV2V3PilotShadowOptions | null;
  workingMemory?: AgentWorkingMemorySnapshot | null;
  workingMemoryText?: string | null;
}

const AGENT_SESSION_V2_MAX_STEPS = 6;
const AGENT_SESSION_V2_DEFAULT_MAX_DURATION_MS = 90_000;
const AGENT_SESSION_V2_DEFAULT_MAX_TOOL_CALLS = 16;
const AGENT_SESSION_V2_MODEL_OUTPUT_REPAIR_MAX_RUNS = 2;
const AGENT_SESSION_V2_TOOL_NAMES = new Set<AgentToolCallName>(listAgentToolNames());
const AGENT_SESSION_V2_PRIMARY_TOOL_NAMES = [
  'observe_windows_and_apps',
  'execute_desktop_action',
  'execute_desktop_observation',
  'execute_desktop_input',
  'execute_desktop_sequence',
  'execute_local_file_action',
  'execute_file_management_action',
  'execute_memory_action',
  'run_controlled_command',
  'control_browser',
  'locate_screen_elements',
  'analyze_game_screen',
  'manage_game_companion_loop',
  'organize_desktop_icons',
  'remember_local_app',
  'get_pet_settings',
  'update_pet_settings',
  'get_voice_status',
  'switch_tts_provider',
  'warmup_local_voice',
  'set_voice_input',
  'start_voice_input_session',
  'stop_voice_input_session',
  'list_agent_skills',
  'execute_agent_skill',
  'list_mcp_tools',
  'call_mcp_tool',
  'inspect_local_project',
  'run_local_project_action',
] satisfies readonly AgentToolCallName[];
const AGENT_SESSION_V2_PRIMARY_TOOL_NAME_SET = new Set<AgentToolCallName>(
  AGENT_SESSION_V2_PRIMARY_TOOL_NAMES,
);
const AGENT_SESSION_V2_AVAILABLE_TOOL_TEXT = createAgentPlannerAvailableToolLines({
  toolNames: AGENT_SESSION_V2_PRIMARY_TOOL_NAMES,
}).join('\n');
const AGENT_SESSION_V2_READ_ONLY_CACHE_TTL_MS = 3500;

function isAgentSessionV2PrimaryToolName(toolName: string | null | undefined): toolName is AgentToolCallName {
  return Boolean(
    toolName
    && AGENT_SESSION_V2_PRIMARY_TOOL_NAME_SET.has(toolName as AgentToolCallName),
  );
}

export const AGENT_SESSION_V2_SYSTEM_INSTRUCTION = [
  'You are AgentSessionV2, a model-driven desktop agent loop inside a desktop pet app.',
  'Your job is to understand the user need first, then decide one next action at a time.',
  'Return exactly one JSON object. Do not return markdown.',
  '',
  'Allowed JSON actions:',
  '{ "action": "tool_call", "tool": "registered_tool_name", "args": {}, "reason": "why this tool is needed", "understanding": { "userNeed": "what the user actually wants", "neededCapability": "what capability is needed", "successCriteria": "how we know the task is answered", "completedGoals": ["goals already satisfied by evidence"], "remainingGoals": ["goals still not satisfied"], "blockedGoals": ["goals attempted but blocked"], "verificationStatus": "unknown|partial|satisfied|blocked", "verificationEvidence": ["evidence that proves completed goals"], "verificationGaps": ["facts still missing"], "capabilityGap": "missing capability if any" } }',
  '{ "action": "tool_calls", "tools": [{ "tool": "registered_tool_name", "args": {}, "reason": "why this independent read-only observation is needed" }], "reason": "why these observations can run in parallel", "understanding": { "userNeed": "what the user actually wants", "neededCapability": "what capabilities are needed", "successCriteria": "how we know the task is answered", "completedGoals": [], "remainingGoals": [], "blockedGoals": [], "verificationStatus": "unknown", "verificationEvidence": [], "verificationGaps": [] } }',
  '{ "action": "ask_user", "message": "short Chinese question", "understanding": { "userNeed": "what is understood", "neededCapability": "missing detail needed", "completedGoals": [], "remainingGoals": [], "blockedGoals": [], "verificationStatus": "unknown|partial|blocked", "verificationEvidence": [], "verificationGaps": [] } }',
  '{ "action": "final_answer", "message": "short Chinese answer based on evidence", "understanding": { "userNeed": "what was answered", "successCriteria": "why this is enough", "completedGoals": ["goals satisfied by evidence"], "remainingGoals": [], "blockedGoals": [], "verificationStatus": "satisfied|blocked", "verificationEvidence": ["concrete evidence from tool results"], "verificationGaps": [] } }',
  '',
  'Available registered tools:',
  AGENT_SESSION_V2_AVAILABLE_TOOL_TEXT,
  '',
  'Rules:',
  '- Do not behave like a keyword router. First infer the user need, success criteria, and missing information.',
  '- Think in terms of a task loop: understand the need, observe with tools when needed, read the result, then decide the next action.',
  '- Maintain a task progress board in every understanding: completedGoals, remainingGoals, and blockedGoals. Use short concrete goal phrases. A final_answer is only allowed when remainingGoals is empty, or when the remaining work is honestly blocked and explained.',
  '- Maintain result verification in every understanding: verificationStatus, verificationEvidence, and verificationGaps. Tool ok=true only means a tool ran; it does not by itself prove the user goal is complete.',
  '- Before final_answer, compare successCriteria against the latest tool evidence. Use verificationStatus "satisfied" only when evidence proves the requested outcome; use "blocked" only after a concrete blocker is observed. If verificationStatus is "unknown" or "partial", call a verification/observation tool or ask one short necessary question instead of finishing.',
  '- For compound goals, do not final_answer after completing only the first verb. Continue until every requested action in the success criteria is satisfied, or explain the concrete failed action after attempting it.',
  '- Before ask_user, first use available read-only observation tools when the missing detail can be discovered locally. Ask the user only when the needed fact is private preference, ambiguous intent, absent from local evidence, or unsafe to infer.',
  '- On the first step of an action request, prefer a preflight observation batch with tool_calls when two or more independent silent read-only facts could affect the action. Useful preflight facts include running apps/windows, active window, default URI/app handling, display layout, capture sources, cursor position, local path facts, and remembered preferences only when the user refers to a preference, alias, prior choice, or remembered app.',
  '- For faster response, combine independent read-only preflight observations into one tool_calls step instead of calling them one at a time. For current app/window/browser/display/local-file tasks, prefer live local observation first: observe_windows_and_apps for window/app/display facts and execute_local_file_action for provided paths. Add memory recall only when the wording depends on stored preferences/aliases/history, such as "my usual browser", "last time", "remember", "常用", "上次", or a known remembered app alias.',
  '- Use one preflight, then one approval whenever possible: gather all independent read-only facts first, then choose one approval-required action or execute_desktop_sequence that covers the requested changes. Avoid asking the user to approve open/focus, then approve move/click/type as separate follow-ups when the remaining steps are already known.',
  '- Read-only observation can identify candidates, running state, and UI evidence, but it cannot count as opening, launching, clicking, focusing, moving, closing, or controlling anything. For an action request, do not final_answer as completed after only read-only observations.',
  '- If the first observation already proves the target, destination, and input coordinates/window are clear, do not run another confirmatory observation just to feel safer. Move to the permission-gated action and let the approval UI ask once.',
  '- During one Agent run, identical silent read-only observations may be served from a short-lived cache to avoid repeated local scans. If you need truly fresh state after the user or a tool changed something, add forceRefresh: true or observe a more specific fact.',
  '- If the user already gave a clear action goal, do not ask for confirmation just to confirm the action. Select the appropriate approval-required action tool when ready; the app permission UI will ask before changing the computer.',
  '- Use tool_calls when two or more independent read-only observations are useful before deciding. Examples: display info + running apps + active window, or provided local path facts + current windows. Include memory recall in that batch only when memory is relevant to the wording. tool_calls is only for silent read-only tools; never put launch, move, close, write, remember, file management execution, or any approval-required action in tool_calls.',
  '- For browser/app/resource requests, if the user names a broad target such as browser, website, app, or URL and the exact route is not known, observe current running/window/default-app state first; add remembered preference only when the user asks for their preferred/usual/remembered choice. Then decide whether to focus an existing window, open a resource, launch an app, or ask a short question.',
  '- For visual, current-screen, video, and game requests, identify the relevant active window or capture source before asking when local observation can resolve it. Do not search the web unless the user explicitly asks to search/find/lookup.',
  '- Do not answer current local computer facts from memory. Use desktop observation for live display, system, active-window, cursor, desktop-item, capture-source, and visible-content evidence.',
  '- For installed apps, taskbar pins, running windows, executable paths, active window, or display ownership, prefer observe_windows_and_apps because it gathers those related facts together.',
  '- For visual questions, distinguish source discovery from content understanding: source lists only identify observable screens/windows, while visual snapshots answer what is visible inside a screen or window.',
  '- If the user names a specific app/window/image viewer or asks about an image currently open in a named app, identify the capture source before summarizing visual content. Avoid guessing from a broad query when multiple windows or screens may exist.',
  '- If the user asks whether you can see or recognize what is on the current screen/window, treat it as a live visual observation test and answer from fresh visual evidence instead of a generic capability statement.',
  '- If the user asks what game they are playing, what is happening in gameplay, or wants the pet to understand game content, use analyze_game_screen. Use source/window observation first when the target game window is unclear.',
  '- analyze_game_screen is a single visual analysis step for visible game content, HUD, player situation, and uncertainty. It is not continuous companion mode.',
  '- If the user asks for ongoing game companionship, continuous watching, or comments while they play, use manage_game_companion_loop after the target source is reasonably clear. Use it to stop the loop when the user asks to stop watching/commenting.',
  '- For video watching or video summarization requests, first identify the source: provided URL/page, current browser tab/page, or current visible screen/window. Do not use web search tools for video summarization unless the user explicitly asks to search/find videos; ask one short question when the source is missing.',
  '- Current visual tools can summarize a visible frame/page and readable page text; they cannot honestly watch an entire video, hear audio, or extract a full transcript unless that text is available from a page/tool result. State that limitation when it affects the answer.',
  '- If the user asks where visible text, buttons, UI controls, or screen elements are, call locate_screen_elements. It is visual/OCR-like evidence and may return approximate elementRegion, elementCenter, elementCenterRatio, and coordinateConfidence; do not click based on uncertain visual evidence without confirmation.',
  '- If the user asks to open/start/play something inside another app or launcher (for example "閸?A 闁插本澧﹀鈧?閸氼垰濮?B", "open B in A", "start a game from a launcher"), treat it as an in-app UI operation, not as an OS lookup for B. First open/focus or observe the outer app/window A, then call locate_screen_elements on that app/window with sourceQuery/sourceId for A and targetText/targetDescription for B. Ask the visual tool to identify the target item, the primary open/start/play button associated with that target, approximate elementCenter/elementCenterRatio or screen region, confidence, and uncertainty. If the target and primary action are clear, use execute_desktop_sequence or execute_desktop_input so the app asks for one approval before clicking; prefer elementCenter coordinates over natural-language regions when available, include postVerifyQuery with the expected target/app/window/content name when known, then verify with observe_windows_and_apps or visual observation. If only an icon is recognized but the associated action/target relation is unclear, continue observing or ask one short question instead of declaring it impossible.',
  '- For launcher/list/detail UIs, visible target text is not proof that the target is selected/current. Prefer structuredEvidence.launcherVerification when present: status=ready with targetVisible=true, targetSelected/detailMatchesTarget not false, and primaryActionMatchesTarget=true can proceed; targetSelected=false, detailMatchesTarget=false, primaryActionMatchesTarget=false, or status needs-* requires recovery before launch. If only selectionVerificationStatus exists, selected means verified; visible-only, mismatch, or unknown means select/focus the target item and re-observe instead of claiming success or launching.',
  '- For app-internal operations, combine UI Automation and vision when useful: execute_desktop_observation action "inspect_window_ui" can read controls/buttons/text/inputs and their screen bounds from the active or named window; locate_screen_elements can visually verify small text, icons, and target/action relation. If UI Automation finds a candidate but relation is unclear, use a focused locate_screen_elements crop around that candidate before acting.',
  '- If UI Automation evidence shows the intended control supports invoke/select/toggle/expand-collapse/value, prefer approval-required execute_desktop_action action "interact_window_ui" with targetText/automationId/controlType/hwnd/query/uiAction from the evidence. If UI Automation interaction is unavailable or unsupported, fall back to approval-required execute_desktop_input coordinates only when the target/action/location are clear.',
  '- For locate_screen_elements results, use structuredEvidence.visualActionReadiness when present: ready means the target/action/location evidence is actionable and should flow into an approval-required desktop input/sequence tool; needs-target-selection, needs-primary-action, needs-coordinate, needs-relation, or low-confidence means recover the missing evidence before clicking.',
  '- Also use structuredEvidence.selectionVerificationStatus when present: selected means the target/current detail state is verified; visible-only means the target is only visible and still needs selection/detail verification; mismatch means the current selected/detail item is not the target; unknown means refresh UIA/visual evidence. visible-only/mismatch/unknown are not final success.',
  '- If visual evidence has captureTrusted=false, capture_black_frame, capture_low_entropy, or capture_untrusted, do not trust the visual content, do not click based on it, and do not claim selected/launched/opened from it. Recover by using screen fallback, a different source, a focused crop, or ask one short question.',
  '- If structuredEvidence.coordinateAuditStatus is coordinate_out_of_bounds, coordinate_display_mismatch, or coordinate_unknown, do not click based on that coordinate and do not claim a precise UI target was reached. Refresh capture sources, re-locate with a focused crop, or choose a matching screen/window source before acting.',
  '- If execute_desktop_input returns red-dot replay evidence with inputReplayChanged=false, inputReplayCoordinateClosure not coordinate_closure_ok, or untrusted before/after captures, treat the input action as only "sent", not as proof that the UI state changed. Verify with UIA/visual/window observation before claiming success.',
  '- For desktop action tools, prefer stateSummary.actionEvidence when present. actionEvidence.outcome changed means the action has supporting state-diff evidence; no-op means the action was sent but no state change was detected; uncertain means the action ran but the user-level outcome is not proven; blocked means the action did not safely complete. actionEvidence.snapshotProfile light means low-cost runtime fingerprints, replay means input replay evidence, and heavy means explicit post-action verification evidence; do not require heavy evidence as a fixed chain step. no-op, uncertain, and blocked cannot satisfy an action goal by themselves. Choose the next step from evidence gaps, confidence, targetRef, and recommendedRecovery; do not follow a fixed tool chain template.',
  '- If locate_screen_elements returns targetCandidates or actionCandidates, treat them as visual evidence candidates, not final proof. If exactly one high-confidence candidate already has target/action/relation/location evidence, continue toward the approval-required action. If candidates remain ambiguous and a candidate has centerRatio/bounds/region evidence, rerun locate_screen_elements or summarize_visual_snapshot with focusCenterRatioX/focusCenterRatioY plus focusWidthRatio/focusHeightRatio, or focusX/focusY/focusWidth/focusHeight with focusCoordinateSpace, to inspect that candidate region more closely before asking the user. For tiny text/buttons/icons, use focusScale 2-3 or rely on auto-upscaled focused crops.',
  '- After locate_screen_elements returns targetMatched, primaryAction, and usable elementCenter/elementCenterRatio/elementRegion with no missingEvidence/recommendedRecovery for a direct action request, do not ask_user or final_answer with "do you want me to click/continue". Select an approval-required desktop input/sequence tool; the app permission UI handles approval.',
  '- For visual source selection, use sourceId only when it came from capture-source or previous visual evidence. Do not invent a capture sourceId from hwnd/pid/window observations; if only the app/window name or hwnd is known, prefer sourceQuery with the app/window name and let the tool match the capture source.',
  '- Use execute_desktop_observation for generic desktop/environment perception. It should produce evidence before you answer display/system/window/cursor/desktop-item/capture/visual questions.',
  '- Use execute_desktop_observation action "inspect_window_ui" when the task is inside an existing app window and needs visible controls, buttons, text fields, list items, or UI Automation bounds. This is read-only and can be batched with other silent observations.',
  '- Use desktop item inventory when the user asks what desktop files/icons/items exist, which ones are images/documents/folders/shortcuts, or when you need a read-only inventory without moving anything.',
  '- Use desktop icon diagnosis when icon reading seems inconsistent, secondary-display icon ownership is uncertain, or before explaining why icon organization cannot proceed.',
  '- With execute_desktop_observation, read-only facts are safe to observe silently. Visual actions such as list_capture_sources and summarize_visual_snapshot may notify the user and should only be used when visual evidence is actually needed.',
  '- For local file observation, use execute_local_file_action. It is read-only and covers path facts, folder inventory, filename search, and small text/config/log reading when the relevant absolute path is known.',
'- For a compound local-folder request such as “find the folder and open it”, execute_local_file_action only discovers or verifies the path. Once a concrete absolute folder path is confirmed, continue with execute_desktop_action action "open_resource", target set to that path, and resourceType "folder". Do not use observe_windows_and_apps or locate_screen_elements to resolve or verify that folder-open request; the operating-system open-resource result is the relevant evidence.',
  '- With execute_local_file_action, ask for an absolute path if the path is missing or cannot be resolved from context. Do not use it for delete, move, rename, overwrite, or arbitrary command execution.',
  '- If the user gives a folder path and asks whether it contains an app/launcher/startup method/exe/shortcut, use execute_local_file_action action "search_files" with that folder as path and the app/launcher name as query. Prefer extensions ".exe,.lnk,.url,.appref-ms" and a bounded maxDepth before asking for more path details. A top-level list_directory alone is not enough to answer "is X inside this folder" when X may be nested.',
  '- For local file management, use execute_file_management_action. It handles planning/preview and approved filesystem changes such as move, copy, rename, folder creation, recycle-bin trashing, and desktop-file organization.',
  '- Preview uncertain file operations before changing files. Move/copy/rename/create/trash/organize desktop files actions require approval before execution.',
  '- If the user wants to organize desktop files into folders by type/category, preview the organization plan first; when the user has asked to proceed and the preview is acceptable, continue with the approved execution path.',
  '- Distinguish desktop icon layout from real file organization: organize_desktop_icons only changes icon positions; execute_file_management_action organize_desktop_files moves actual files into folders.',
  '- execute_file_management_action only accepts absolute local paths, never overwrites an existing path, and never permanently deletes files; trash_path moves items to the operating system recycle bin when available.',
  '- For durable user preferences, aliases, and facts, use execute_memory_action. It can recall, search, remember, update, and forget memory entries.',
  '- Use execute_memory_action recall/list as an observation step when remembered preferences may affect the decision. Use remember/forget only when the user explicitly asks to store or remove a long-term memory; the app will ask for approval before changing memory.',
  '- Do not store or answer current local computer facts from memory. Screens, windows, running apps, system hardware, files, and visible content must be observed with the appropriate current tool.',
  '- For app executable paths that should affect launching, prefer remember_local_app when the user provides a local exe/lnk/url/appref-ms path; use execute_memory_action for broader preferences such as preferred browser or naming conventions.',
  '- If the user asks how a local project/folder/program runs and provides a path, call inspect_local_project first. If the path is missing, ask the user for it.',
  '- If the user asks about the desktop pet settings or asks to change a pet setting, call get_pet_settings first unless the exact path and value are already established; use update_pet_settings only with a JSON object keyed by existing config paths.',
  '- Desktop pet settings are in-process configuration, not a screen-navigation task. Do not use locate_screen_elements, visual capture, or desktop-input tools to find or open a desktop pet setting. If the requested setting has no target value, read its current value then ask one short question for the desired value.',
  '- get_pet_settings may read every desktop pet configuration path, but sensitive values are redacted. update_pet_settings can set any existing configuration path after confirmation; never claim success before its normalized values are returned.',
  '- If the user asks about voice settings/status, call get_voice_status first.',
  '- For generic desktop app/window/browser/resource tasks, prefer execute_desktop_action when it can express the next primitive action.',
  '- For app/window tasks where the app choice is uncertain, prefer observe_windows_and_apps before acting because it can inspect installed entries, taskbar pins, running windows, active window, paths, and display ownership in one call.',
  '- When answering a read-only running-app list request, distinguish the running-window count from the distinct process/application count. Enumerate every returned running-window sample when the list is bounded; do not replace observed entries with an invented "other windows" bucket.',
  '- With execute_desktop_action, observe first when the target/default app/running window state is uncertain. Use precise target, resource, process, window, and new-instance arguments only when those facts are known or directly provided.',
  '- Use execute_desktop_sequence when the user requested a known multi-step desktop operation and the needed app/window/display/coordinate facts are already known from the user or prior observations. The app asks for permission once, then runs the approved generic steps in order and returns per-step evidence.',
  '- Do not use execute_desktop_sequence for observation-dependent decisions. First observe, read the result, then use execute_desktop_sequence only when the remaining action steps are clear. Do not put read-only observation tools inside the sequence.',
  '- Prefer execute_desktop_sequence over transitional single-action compound shortcuts when the plan is naturally a few generic primitives, such as open/focus resource then control the active window, focus a known window then type, or move/click/type after a known coordinate. Keep each step generic and explain the reason.',
  '- Approval batching rule: if the next approval-required action is only a prerequisite for another already-known approval-required action, combine them into execute_desktop_sequence instead of stopping for separate approvals. Examples: open/focus app then move window; focus launcher then click a located Start/Play button; open URL then focus/read controlled browser state after the page changes.',
  '- Do not choose transitional execute_desktop_action compound actions such as open_or_focus_then_control_window or open_or_focus_then_move_window_to_display for new decisions. They are compatibility-only; use execute_desktop_sequence instead.',
  '- For app/window actions, resolve ambiguity before acting: existing window vs new instance, target window vs active window, current display vs another display, and focus/open/close/control/move intent.',
  '- If one user request asks to open/focus an app/resource/URL and then control, move, type into, or press keys for the resulting window, prefer execute_desktop_sequence after the needed target/display/input facts are clear. Put the open/focus primitive before the control/input primitive.',
  '- When a desktop sequence depends on the visible UI state after clicking or typing, provide postVerifyVisualQuery so the runtime can inspect the screen after the action. Treat the post-action visual state as evidence, not as a fixed rule.',
  '- If structuredEvidence.postActionRecovery is present, treat its strategy, nextTool, and nextArgs as the preferred recovery path unless unsafe or contradicted by newer evidence.',
  '- If structuredEvidence.postActionState is loading or updating, do not final_answer or ask_user just to continue waiting. Call execute_desktop_observation action "wait_and_observe" with forceRefresh before deciding the next step. If login_required, first locate and use a safe login/continue/confirm control when credentials appear already filled or remembered; ask_user only for captcha, QR scan, 2FA/SMS verification, empty required credentials, admin/UAC confirmation, or another non-automatable private gate. If error or blocked, read visible error/blocker text before recovering; if unchanged or unknown, re-locate the element or ask one short question when the target is ambiguous.',
  '- When the model input contains "Current post-action recovery follow-up signal", treat it as the result of a safe recovery observation after an incomplete action. Continue the task: choose an approval-required retry/next action when clear, observe/focus-crop when evidence is ambiguous, wait when loading/updating, ask_user only for private/manual gates, or final_answer as blocked only with concrete evidence.',
  '- If a signal includes rankedRecoveryStrategies, prefer the highest-scored safe strategy unless newer evidence contradicts it. Use lower-ranked strategies when the top strategy is unsafe, unavailable, already tried without new evidence, or requires a private/manual user step.',
  '- If a rankedRecoveryStrategies item has budget=exhausted, do not choose that same strategy again. Use its fallback strategy, a lower-ranked available strategy, ask_user for the missing private/ambiguous detail, or final_answer as blocked with concrete evidence.',
  '- For an already available window move, observe windows and displays first when either side is unclear, then use an approval-required desktop action with the known target and display.',
  '- Before any window-target action, bind the target to one live window from observe_windows_and_apps and copy its exact hwnd and pid into execute_desktop_action. Do not rely on a translated, localized, or friendly app name alone when live window identity is available.',
  '- For a direct URL/domain (for example github.com or https://example.com), open the URL/resource with a desktop/browser control tool; do not treat it as a search query.',
  '- For a web search intent with keywords, use a desktop/browser search capability. Do not use search for direct URLs/domains.',
  '- For browser tasks that need controlled tabs, page reading, URL navigation, or tab focus, prefer control_browser over generic OS opening.',
  '- Use execute_desktop_input only for low-level click/type/hotkey/drag/mouse actions after the target window, coordinate, or input field is clear. Prefer window observation, cursor observation, and locate_screen_elements first. The app will ask approval before desktop input.',
  '- Use run_controlled_command only when existing dedicated tools cannot answer the request and a small diagnostic command is appropriate. Never use it to launch or retry an app/resource after launch_local_app or open_resource returned not-found, failed, or unverified; keep the app identity inside the dedicated launcher/observation path or report the unresolved identity as blocked. The command runtime returns stdout, stderr, exitCode, cwd, and safety-blocking details; it blocks destructive patterns, shell chaining, redirection, and pipes in v1.',
  '- If the user asks to organize desktop icons as an action, first use organize_desktop_icons with mode "preview" to observe displays, read desktop icons, classify items, and prepare a plan in one preflight call. Do not call list_desktop_items first for a direct organization request unless the user only asked to inspect or preview inventory.',
  '- For organize_desktop_icons, prefer tool-like structured arguments: targetDisplay is where the arranged icons should end up; sourceScope "display-icons" means only icons already on that display, and "all-icons" means arrange all desktop icons into targetDisplay. Use legacy displayTarget/scope only when needed for compatibility.',
  '- If the user says to organize icons on the secondary/primary display, use sourceScope "display-icons". If the user says to put/move/place the organized desktop onto a display, use sourceScope "all-icons" with targetDisplay. If this distinction is unclear, ask_user.',
  '- If you already used list_desktop_items for a request that asks to organize/arrange the desktop, do not final_answer after the inventory. Next call organize_desktop_icons with mode "preview" and carry over targetDisplay/sourceScope/groupBy when relevant.',
  '- If the preview succeeds and the user did not ask for preview-only/plan-only, continue to organize_desktop_icons with mode "execute"; the app will pause for permission before moving icons.',
  '- For custom desktop icon layout requests, preserve the user wording as placementIntent and let preview/execution evidence show what is supported. Do not compress an open-ended request into a rigid numbered menu unless evidence proves only those exact supported choices exist.',
  '- If current desktop icon tools cannot satisfy part of placementIntent, report that as a capability/evidence gap and continue with the safest preview or approval-required action when useful. Do not phrase it as "I can only do option 1 or option 2" unless those are actual registered capabilities.',
  '- For desktop icon organization, use groupBy "category" when the user wants images/documents/media/folders grouped together or says type/category/kind in a category sense, "kind" when they ask to separate files/folders/shortcuts/system icons, and "extension" when they ask for suffix/file-type-level grouping. Leave groupBy as "none" or omit it when the user only asks for positional cleanup.',
  '- Do not final_answer merely to ask whether to execute a prepared desktop organization plan when the original user request already asked you to organize/arrange it. Surface the permission-required execute step instead.',
  '- You may select approval-required action tools; the app will pause and ask the user before executing them.',
  '- Tool args are schema-validated before permission routing or execution. Use the exact args schema for the selected tool; missing required parameters or wrong primitive types will be rejected and must be corrected.',
  '- Use only the listed primary tool names for new decisions. Compatibility-only legacy tool names may appear in older history or tool results, but do not choose them for a new AgentSessionV2 decision.',
  '- If the user need requires an action tool that is not listed, explain the current capability gap instead of pretending to execute it.',
  '- After a tool result is provided, use criticalFacts first, then structuredEvidence, then rawEvidencePreview only if details are needed. Decide whether to answer, ask the user, or call another allowed tool.',
  '- If a tool result has receiptStatus=unverified, assessmentStatus=unverified, missingEvidence, or recommendedRecovery, do not claim the task is complete. First recover by observing, retrying a more precise primitive, or asking one short question when the target is ambiguous.',
  '- If a tool result has ok=false, do not repeat the same tool with the same args. Read errorText, observations, receiptEvidence, and followUp, then either try a different observation/action, ask the user for the missing detail, or give a concise failure answer.',
  '- If launch_local_app or open_resource cannot resolve or verify an app/window, do not substitute a shell command that guesses an executable or alias. A process started by an unrelated command is not launch evidence for the requested app; use a changed dedicated-app query, observe exact candidates, or ask for the app path/name.',
  '- If the model input contains "Current replanning signal", treat it as the highest-priority loop feedback. Update the task progress board, change tool/args when retrying, or explain a real blocker with evidence. Do not repeat a failed or rejected tool call unchanged.',
  '- If the model input contains "Current trace stuck signal", treat it as passive observability feedback from recent tool/permission/action evidence. Use it to avoid repeating no-op, blocked, invalid, or failed patterns; choose the next step from evidence gaps instead of following a fixed recovery chain.',
  '- If the model input contains "Current result verification signal", use it before final_answer. For action tools, compare the user-level success criteria to evidence, not merely to tool ok=true.',
  '- If a visual snapshot cannot find the requested source, use listed capture-source candidates or source/window observation before retrying. If the vision model/API itself fails, do not keep recapturing the same image; report the last error or ask for corrected vision settings.',
  '- If the model input contains "Current visual recovery signal", handle that signal before final_answer: retry with a concrete sourceId when the right source is evident, observe capture sources or active-window state when source choice is unclear, ask one short confirmation question when candidates are ambiguous, or report a vision settings/model problem when the API failed.',
  '- If a visual tool result includes missingEvidence, recommendedRecovery, or low confidence, do not make precise claims beyond the evidence. If the user goal depends on an unclear target, text, or visual state, ask one short confirmation question before acting.',
  '- If visual tool evidence includes targetCandidates/actionCandidates, use those candidate labels, regions, relations, and coordinates to decide the next observation/action. Prefer a focused visual crop around a promising candidate when small text, similar buttons, or target/action relation remains unclear. Do not discard candidates as a generic failure.',
  '- Use recent visual context for continuity across consecutive visual observations, but do not treat it as live state. If the user asks about what is visible now/currently, refresh with the appropriate visual or desktop observation tool.',
  '- Keep final answers concise and in Chinese.',
].join('\n');

function compactAgentSessionText(value: unknown, maxLength = 900) {
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

function clampAgentSessionV2Ratio(value: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0.05, Math.min(0.9, value));
}

function getAgentSessionV2CandidateConfidenceScore(
  confidence: AgentStructuredToolCandidateEvidence['confidence'] | AgentStructuredToolEvidence['confidence'],
) {
  switch (confidence) {
    case 'high':
      return 30;
    case 'medium':
      return 15;
    case 'low':
      return -20;
    default:
      return 0;
  }
}

function normalizeAgentSessionV2CandidateSearchText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').replace(/\s+/gu, '').trim().toLowerCase()
    : '';
}

function getAgentSessionV2SearchTokens(value: unknown) {
  return typeof value === 'string'
    ? (value
      .normalize('NFKC')
      .toLowerCase()
      .match(/[\p{L}\p{N}]{3,}/gu) ?? [])
      .filter((token) => !/^(?:agent|start|play|open|launch|run|enter|continue|install|update|resume|from|with|the|visible|launcher|app|application|button|control)$/iu.test(token))
    : [];
}

function getAgentSessionV2CandidateSearchText(candidate: AgentStructuredToolCandidateEvidence) {
  return [
    candidate.label,
    candidate.name,
    candidate.description,
    candidate.region,
    candidate.relation,
    candidate.controlType,
    candidate.automationId,
  ].map(normalizeAgentSessionV2CandidateSearchText).filter(Boolean).join(' ');
}

function getAgentSessionV2CandidateTextRelevanceScore(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  evidence: AgentStructuredToolEvidence | null;
  sourceText: string;
  userGoal: string;
}) {
  const candidateText = getAgentSessionV2CandidateSearchText(options.candidate);
  const contextText = normalizeAgentSessionV2CandidateSearchText([
    options.sourceText,
    options.userGoal,
    options.evidence?.targetMatched,
    options.evidence?.primaryAction,
  ].filter(Boolean).join(' '));
  if (!candidateText || !contextText) {
    return 0;
  }

  const labels = [
    options.candidate.label,
    options.candidate.name,
    options.candidate.automationId,
  ].map(normalizeAgentSessionV2CandidateSearchText).filter((value) => value.length >= 2);
  const directLabelMatch = labels.some((label) => contextText.includes(label) || label.includes(contextText));
  const targetText = normalizeAgentSessionV2CandidateSearchText(options.evidence?.targetMatched);
  const primaryActionText = normalizeAgentSessionV2CandidateSearchText(options.evidence?.primaryAction);
  return [
    directLabelMatch ? 22 : 0,
    targetText && candidateText.includes(targetText) ? 12 : 0,
    primaryActionText && candidateText.includes(primaryActionText) ? 10 : 0,
  ].reduce((sum, value) => sum + value, 0);
}

function getAgentSessionV2ActionOwnershipTargetText(evidence: AgentStructuredToolEvidence | null) {
  return normalizeAgentSessionV2CandidateSearchText(
    evidence?.targetMatched?.trim()
      || evidence?.currentSelection?.trim()
      || '',
  );
}

function hasAgentSessionV2UsefulActionOwnershipRelationText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  const text = value.normalize('NFKC').trim().toLowerCase();
  return Boolean(text)
    && !/(?:unknown|unclear|not\s+(?:found|visible|clear|confirmed|associated)|not\s+belong|does\s+not\s+belong|no\s+(?:relation|association)|none|null|n\/a|\u4e0d\u786e\u5b9a|\u4e0d\u6e05\u695a|\u672a\u77e5|\u672a\u627e\u5230|\u6ca1\u6709|\u65e0|\u4e0d\u5c5e\u4e8e|\u672a\u5173\u8054|\u65e0\u5173)/iu.test(text);
}

function isAgentSessionV2GenericPrimaryActionText(value: unknown) {
  const text = normalizeAgentSessionV2CandidateSearchText(value);
  return Boolean(text)
    && /^(?:start|play|open|launch|run|enter|continue|install|update|resume|\u542f\u52a8|\u5f00\u59cb|\u6253\u5f00|\u8fd0\u884c|\u8fdb\u5165|\u7ee7\u7eed|\u5b89\u88c5|\u66f4\u65b0|\u6062\u590d)$/iu.test(text);
}

function isAgentSessionV2DirectActionControlText(value: unknown) {
  const text = normalizeAgentSessionV2CandidateSearchText(value);
  return Boolean(text)
    && /(?:login|signin|logon|continue|allow|ok|confirm|submit|next|start|play|launch|open|enter|resume|install|update|\u767b\u5f55|\u767b\u9678|\u767b\u5165|\u786e\u8ba4|\u786e\u5b9a|\u5141\u8bb8|\u7ee7\u7eed|\u4e0b\u4e00\u6b65|\u5f00\u59cb|\u542f\u52a8|\u6253\u5f00|\u8fdb\u5165|\u64ad\u653e|\u8fd0\u884c|\u5b89\u88c5|\u66f4\u65b0|\u6062\u590d)/iu.test(text);
}

function createAgentSessionV2EffectiveVisualActionEvidence(
  evidence: AgentStructuredToolEvidence | null,
) {
  if (!evidence || isAgentSessionV2UsefulPrimaryAction(evidence.primaryAction)) {
    return evidence;
  }

  const directActionText = [
    evidence.targetMatched,
    evidence.elementDescription,
    evidence.elementRegion,
  ].find(isAgentSessionV2DirectActionControlText);
  if (!directActionText || typeof directActionText !== 'string') {
    return evidence;
  }

  return {
    ...evidence,
    primaryAction: directActionText.trim(),
    relation: evidence.relation?.trim()
      || `${directActionText.trim()} is the directly actionable target control.`,
  };
}

function collectAgentSessionV2VisualApprovalResultText(result: AgentChatCommandResult) {
  return [
    result.responseText,
    result.verification,
    result.errorText,
    result.assessment?.summary,
    result.receipt?.verification,
    result.receipt?.evidenceLines?.join('\n'),
    result.receipt?.summaryLines?.join('\n'),
    result.stateSummary?.observedState?.join('\n'),
    result.stateSummary?.verificationEvidence?.join('\n'),
    result.observations?.join('\n'),
  ].filter(Boolean).join('\n');
}

function hasAgentSessionV2ApproximateVisualEvidence(result: AgentChatCommandResult) {
  return /(?:approximate|estimated|estimate|uncertain|unclear|not\s+confirmed|cannot\s+confirm|rough|approximation|近似|估算|大致|不确定|不清楚|未确认|无法确认|无法可靠)/iu.test(
    collectAgentSessionV2VisualApprovalResultText(result),
  );
}

function hasAgentSessionV2SafeLoginContinuationApprovalEvidence(options: {
  evidence: AgentStructuredToolEvidence | null;
  result: AgentChatCommandResult;
}) {
  const evidence = options.evidence;
  if (!evidence) {
    return false;
  }

  const launcherVerification = evidence.launcherVerification;
  if (
    launcherVerification
    && (
      launcherVerification.status !== 'ready'
      || launcherVerification.primaryActionMatchesTarget !== true
    )
  ) {
    return false;
  }

  if (evidence.confidence === 'low' || evidence.coordinateConfidence === 'low') {
    return false;
  }

  if (evidence.visualActionReadiness !== 'ready') {
    return false;
  }

  const text = [
    collectAgentSessionV2VisualApprovalResultText(options.result),
  ].filter(Boolean).join('\n');
  const controlText = [
    evidence.targetMatched,
    evidence.primaryAction,
    evidence.elementDescription,
    evidence.elementRegion,
    evidence.relation,
  ].filter(Boolean).join('\n');
  if (hasAgentAuthenticationHardGateCue(text)) {
    return false;
  }
  const normalizedControlText = controlText
    .replace(/(?:\u8bc6\u522b|\u53d1\u73b0|\u68c0\u6d4b\u5230)\s*\u4f46\u4e0d\u70b9\u51fb[：:]?/gu, ' ')
    .replace(/(?:identified|detected|found)\s+but\s+do\s+not\s+click:?/giu, ' ');
  if (/(?:no\s+(?:clear|actionable|clickable)|do\s+not\s+click|needs?\s+(?:wait|retry|refin)|unclear|none|null|n\/a|\u65e0\u660e\u786e|\u4e0d\u8981\u70b9\u51fb|\u9700\u8981(?:\u7b49\u5f85|\u91cd\u8bd5|\u7cbe\u786e)|\u4e0d\u6e05\u695a|\u6ca1\u6709)/iu.test(normalizedControlText)) {
    return false;
  }

  return resolveAgentAuthenticationGate({
    controlText,
    postActionState: evidence.postActionState,
    text,
  }).canSubmit;
}

function hasAgentSessionV2CandidateTextOwnedActionEvidence(options: {
  candidate?: AgentStructuredToolCandidateEvidence | null;
  evidence: AgentStructuredToolEvidence | null;
  sourceText?: string;
  userGoal?: string;
}) {
  if (!options.candidate) {
    return false;
  }

  const candidateText = getAgentSessionV2CandidateSearchText(options.candidate);
  if (!candidateText) {
    return false;
  }

  const targetSourceText = [
    options.evidence?.targetMatched,
    options.evidence?.currentSelection,
    options.sourceText,
    options.userGoal,
  ]
    .map(normalizeAgentSessionV2CandidateSearchText)
    .filter((value) => value.length >= 3);
  const targetTokens = [
    options.evidence?.targetMatched,
    options.evidence?.currentSelection,
    options.sourceText,
    options.userGoal,
  ].flatMap(getAgentSessionV2SearchTokens);
  const candidateTokens = new Set(getAgentSessionV2SearchTokens(getAgentSessionV2CandidateSearchText(options.candidate)));
  const actionSourceText = [
    options.evidence?.primaryAction,
    options.candidate.label,
    options.candidate.name,
    options.candidate.automationId,
    options.candidate.description,
  ]
    .map(normalizeAgentSessionV2CandidateSearchText)
    .filter((value) => value.length >= 2);
  const hasTargetText = targetSourceText.some((text) => (
    candidateText.includes(text) || text.includes(candidateText)
  )) || targetTokens.some((token) => candidateTokens.has(token) || candidateText.includes(token));
  const hasActionText = actionSourceText.some((text) => (
    isAgentSessionV2GenericPrimaryActionText(text)
      ? candidateText.includes(text)
      : /(?:start|play|open|launch|run|enter|continue|install|update|resume|\u542f\u52a8|\u5f00\u59cb|\u6253\u5f00|\u8fd0\u884c|\u8fdb\u5165|\u7ee7\u7eed|\u5b89\u88c5|\u66f4\u65b0|\u6062\u590d)/iu.test(text)
  )) || /(?:start|play|open|launch|run|enter|continue|install|update|resume|\u542f\u52a8|\u5f00\u59cb|\u6253\u5f00|\u8fd0\u884c|\u8fdb\u5165|\u7ee7\u7eed|\u5b89\u88c5|\u66f4\u65b0|\u6062\u590d)/iu.test(candidateText);

  return hasTargetText && hasActionText;
}

function hasAgentSessionV2ActionOwnershipCandidateText(options: {
  candidate?: AgentStructuredToolCandidateEvidence | null;
  evidence: AgentStructuredToolEvidence | null;
}) {
  const targetText = getAgentSessionV2ActionOwnershipTargetText(options.evidence);
  if (!targetText) {
    return false;
  }

  const candidateText = options.candidate
    ? getAgentSessionV2CandidateSearchText(options.candidate)
    : '';
  const evidenceText = normalizeAgentSessionV2CandidateSearchText([
    options.evidence?.elementDescription,
    options.evidence?.elementRegion,
    options.evidence?.relation,
    options.evidence?.primaryAction,
  ].filter(Boolean).join(' '));
  return [candidateText, evidenceText].some((text) => (
    text.includes(targetText) || targetText.includes(text)
  ));
}

function hasAgentSessionV2SelectedTargetContext(evidence: AgentStructuredToolEvidence | null) {
  const launcherVerification = evidence?.launcherVerification;
  if (
    launcherVerification
    && (
      launcherVerification.targetSelected === true
      || launcherVerification.detailMatchesTarget === true
    )
    && launcherVerification.targetSelected !== false
    && launcherVerification.detailMatchesTarget !== false
  ) {
    return true;
  }

  const targetText = normalizeAgentSessionV2CandidateSearchText(evidence?.targetMatched);
  const currentSelectionText = normalizeAgentSessionV2CandidateSearchText(evidence?.currentSelection);
  return Boolean(
    evidence?.selectionVerificationStatus === 'selected'
      || (
        targetText
        && currentSelectionText
        && (targetText.includes(currentSelectionText) || currentSelectionText.includes(targetText))
      ),
  );
}

function isAgentSessionV2LauncherVerificationBlocking(evidence: AgentStructuredToolEvidence | null) {
  const launcherVerification = evidence?.launcherVerification;
  if (!launcherVerification) {
    return false;
  }

  return Boolean(
    launcherVerification.targetVisible === false
      || launcherVerification.targetSelected === false
      || launcherVerification.detailMatchesTarget === false
      || launcherVerification.primaryActionMatchesTarget === false
      || (
        launcherVerification.status
        && launcherVerification.status !== 'ready'
        && launcherVerification.status !== 'unknown'
      ),
  );
}

function isAgentSessionV2LoginRequiredEvidence(evidence: AgentStructuredToolEvidence | null) {
  return evidence?.postActionState === 'login_required';
}

function hasAgentSessionV2VerifiedLauncherActionOwnership(evidence: AgentStructuredToolEvidence | null) {
  const launcherVerification = evidence?.launcherVerification;
  if (!launcherVerification) {
    return false;
  }

  return Boolean(
    launcherVerification.status === 'ready'
      && launcherVerification.targetVisible !== false
      && launcherVerification.targetSelected !== false
      && launcherVerification.detailMatchesTarget !== false
      && launcherVerification.primaryActionMatchesTarget === true,
  );
}

function hasAgentSessionV2VerifiedPrimaryActionOwnership(options: {
  candidate?: AgentStructuredToolCandidateEvidence | null;
  evidence: AgentStructuredToolEvidence | null;
}) {
  const evidence = options.evidence;
  if (!evidence?.targetMatched || !isAgentSessionV2UsefulPrimaryAction(evidence.primaryAction)) {
    return false;
  }

  if (isAgentSessionV2LauncherVerificationBlocking(evidence)) {
    return false;
  }

  if (hasAgentSessionV2VerifiedLauncherActionOwnership(evidence)) {
    return true;
  }

  const relationText = [
    evidence.relation,
    options.candidate?.relation,
    options.candidate?.description,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).join(' | ');
  if (options.candidate) {
    const candidateHasOwnOwnershipEvidence = hasAgentSessionV2CandidateTextOwnedActionEvidence({
      candidate: options.candidate,
      evidence,
    });
    const candidateHasCrossSourceAgreement = getAgentSessionV2CandidateCrossSourceAgreementScore({
      candidate: options.candidate,
      evidence,
    }) > 0;
    const candidatePoint = resolveAgentSessionV2CandidateScreenPoint(options.candidate, evidence);
    const topLevelActionPoint = resolveAgentSessionV2VisualActionPoint(evidence);
    const candidateMatchesTopLevelActionPoint = Boolean(
      candidatePoint
        && topLevelActionPoint
        && getAgentSessionV2PointDistance(candidatePoint, topLevelActionPoint) <= 64,
    );
    if (
      !candidateHasOwnOwnershipEvidence
      && !candidateHasCrossSourceAgreement
      && !candidateMatchesTopLevelActionPoint
    ) {
      return false;
    }
  }

  if (
    hasAgentSessionV2UsefulActionOwnershipRelationText(relationText)
    && (
      hasAgentSessionV2ActionOwnershipCandidateText(options)
      || /(?:belongs\s+to|associated\s+with|for\s+(?:the\s+)?selected|current\s+detail|detail\s+page|owned\s+by|\u5c5e\u4e8e|\u5173\u8054|\u5bf9\u5e94|\u5f53\u524d\u8be6\u60c5|\u8be6\u60c5\u9875|\u5df2\u9009\u4e2d)/iu.test(relationText)
    )
  ) {
    return true;
  }

  const primaryActionIsGeneric = isAgentSessionV2GenericPrimaryActionText(evidence.primaryAction)
    || isAgentSessionV2GenericPrimaryActionText(options.candidate?.label)
    || isAgentSessionV2GenericPrimaryActionText(options.candidate?.name);
  if (!primaryActionIsGeneric) {
    return hasAgentSessionV2ActionOwnershipCandidateText(options);
  }

  return hasAgentSessionV2SelectedTargetContext(evidence)
    && hasAgentSessionV2UsefulActionOwnershipRelationText(relationText)
    && /(?:selected|current|detail|page|belongs|associated|\u5df2\u9009\u4e2d|\u5f53\u524d|\u8be6\u60c5|\u5c5e\u4e8e|\u5173\u8054|\u5bf9\u5e94)/iu.test(relationText);
}

function getAgentSessionV2CandidateSourceFamily(candidate: AgentStructuredToolCandidateEvidence) {
  const source = candidate.source?.trim().toLowerCase() ?? '';
  if (source.includes('ui-automation') || source.includes('uia')) {
    return 'uia';
  }

  if (source.includes('visual') || source.includes('ocr')) {
    return 'visual';
  }

  return source;
}

function getAgentSessionV2CandidateTextTokens(candidate: AgentStructuredToolCandidateEvidence) {
  const text = getAgentSessionV2CandidateSearchText(candidate);
  return new Set(text.match(/[\p{L}\p{N}]{2,}/gu) ?? []);
}

function getAgentSessionV2CandidateTextOverlapScore(
  candidate: AgentStructuredToolCandidateEvidence,
  other: AgentStructuredToolCandidateEvidence,
) {
  const candidateText = getAgentSessionV2CandidateSearchText(candidate);
  const otherText = getAgentSessionV2CandidateSearchText(other);
  if (!candidateText || !otherText) {
    return 0;
  }

  if (candidateText.includes(otherText) || otherText.includes(candidateText)) {
    return 18;
  }

  const candidateTokens = getAgentSessionV2CandidateTextTokens(candidate);
  const otherTokens = getAgentSessionV2CandidateTextTokens(other);
  if (!candidateTokens.size || !otherTokens.size) {
    return 0;
  }

  let overlap = 0;
  for (const token of candidateTokens) {
    if (otherTokens.has(token)) {
      overlap += 1;
    }
  }

  return Math.min(14, overlap * 7);
}

function getAgentSessionV2CandidateApproxPoint(
  candidate: AgentStructuredToolCandidateEvidence,
  evidence: AgentStructuredToolEvidence | null,
) {
  const screenPoint = resolveAgentSessionV2CandidateScreenPoint(candidate, evidence);
  if (screenPoint) {
    return {
      coordinateSpace: 'native-screen',
      x: screenPoint.x,
      y: screenPoint.y,
    };
  }

  const ratioPoint = normalizeAgentSessionV2RatioPoint(candidate.centerRatio);
  if (ratioPoint) {
    return {
      coordinateSpace: 'source-ratio',
      x: ratioPoint.x,
      y: ratioPoint.y,
    };
  }

  const bounds = createAgentSessionV2CandidateFocusBounds(candidate);
  if (bounds) {
    return {
      coordinateSpace: bounds.coordinateSpace,
      x: bounds.x + bounds.width / 2,
      y: bounds.y + bounds.height / 2,
    };
  }

  return null;
}

function getAgentSessionV2CandidateSpatialAgreementScore(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  evidence: AgentStructuredToolEvidence | null;
  other: AgentStructuredToolCandidateEvidence;
}) {
  const candidatePoint = getAgentSessionV2CandidateApproxPoint(options.candidate, options.evidence);
  const otherPoint = getAgentSessionV2CandidateApproxPoint(options.other, options.evidence);
  if (!candidatePoint || !otherPoint || candidatePoint.coordinateSpace !== otherPoint.coordinateSpace) {
    return 0;
  }

  const distance = Math.hypot(candidatePoint.x - otherPoint.x, candidatePoint.y - otherPoint.y);
  if (candidatePoint.coordinateSpace === 'source-ratio') {
    if (distance <= 0.035) {
      return 24;
    }
    if (distance <= 0.07) {
      return 14;
    }
    return 0;
  }

  if (distance <= 64) {
    return 24;
  }
  if (distance <= 140) {
    return 14;
  }

  return 0;
}

function getAgentSessionV2CandidateCrossSourceAgreementScore(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  evidence: AgentStructuredToolEvidence | null;
}) {
  const candidateSource = getAgentSessionV2CandidateSourceFamily(options.candidate);
  if (candidateSource !== 'uia' && candidateSource !== 'visual') {
    return 0;
  }

  const peers = getAgentSessionV2VisualEvidenceCandidates(options.evidence)
    .filter((peer) => peer !== options.candidate && peer.enabled !== false && peer.offscreen !== true);
  let bestScore = 0;

  for (const peer of peers) {
    const peerSource = getAgentSessionV2CandidateSourceFamily(peer);
    if (
      (peerSource !== 'uia' && peerSource !== 'visual')
      || peerSource === candidateSource
    ) {
      continue;
    }

    const spatialScore = getAgentSessionV2CandidateSpatialAgreementScore({
      candidate: options.candidate,
      evidence: options.evidence,
      other: peer,
    });
    const textScore = getAgentSessionV2CandidateTextOverlapScore(options.candidate, peer);
    const combinedScore = spatialScore && textScore
      ? spatialScore + textScore + 16
      : spatialScore >= 24
        ? spatialScore + 8
        : textScore >= 18
          ? textScore + 6
          : 0;
    bestScore = Math.max(bestScore, combinedScore);
  }

  return Math.min(58, bestScore);
}

function findAgentSessionV2HistoricalInvokableUiCandidateForVisualEvidence(options: {
  evidence: AgentStructuredToolEvidence | null;
  sourceText: string;
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
  userGoal: string;
}) {
  const point = resolveAgentSessionV2VisualActionPoint(options.evidence);
  if (
    !point
    || options.evidence?.visualActionReadiness !== 'ready'
    || options.evidence.confidence === 'low'
    || isAgentSessionV2LauncherVerificationBlocking(options.evidence)
  ) {
    return null;
  }

  const historyEntries = [...(options.toolResults ?? [])]
    .reverse()
    .slice(0, 8)
    .filter((entry) => entry.result.ok !== false);
  const candidates = historyEntries.flatMap((entry) => {
    const historicalEvidence = getAgentStructuredEvidence(entry);
    return getAgentSessionV2VisualEvidenceCandidates(historicalEvidence)
      .filter((candidate) => isAgentSessionV2InvokableUiCandidate(candidate))
      .filter((candidate) => !isAgentSessionV2SameUnverifiedWindowUiCandidate({
        candidate,
        evidence: historicalEvidence,
        toolResults: options.toolResults,
      }))
      .map((candidate) => ({
        candidate,
        evidence: historicalEvidence,
      }));
  });

  const ranked = candidates.map(({ candidate, evidence }, index) => {
    const candidatePoint = resolveAgentSessionV2CandidateScreenPoint(candidate, evidence);
    if (!candidatePoint) {
      return null;
    }

    const distance = getAgentSessionV2PointDistance(point, candidatePoint);
    const spatialScore = distance <= 24
      ? 70
      : distance <= 64
        ? 52
        : distance <= 120
          ? 30
          : 0;
    const currentCandidate: AgentStructuredToolCandidateEvidence = {
      center: {
        coordinateSpace: 'native-screen',
        source: options.evidence?.elementCenter?.source ?? 'visual',
        x: point.x,
        y: point.y,
      },
      confidence: options.evidence?.coordinateConfidence === 'low' ? 'low' : options.evidence?.confidence ?? null,
      description: options.evidence?.elementDescription ?? null,
      label: options.evidence?.primaryAction ?? options.evidence?.targetMatched ?? null,
      relation: options.evidence?.relation ?? null,
      source: 'visual',
    };
    const textScore = Math.max(
      getAgentSessionV2CandidateTextOverlapScore(candidate, currentCandidate),
      getAgentSessionV2CandidateTextRelevanceScore({
        candidate,
        evidence: options.evidence,
        sourceText: options.sourceText,
        userGoal: options.userGoal,
      }),
    );
    const selectorScore = candidate.automationId?.trim() ? 18 : candidate.name?.trim() ? 10 : 0;
    const sourceScore = getAgentSessionV2CandidateSourceFamily(candidate) === 'uia' ? 18 : 0;
    const confidenceScore = getAgentSessionV2CandidateConfidenceScore(candidate.confidence);
    const actionableScore = getAgentSessionV2CandidateUiActions(candidate).includes('invoke') ? 18 : 8;
    const score = spatialScore
      + textScore
      + selectorScore
      + sourceScore
      + confidenceScore
      + actionableScore
      - index;

    if (
      score < 95
      || !candidate.automationId?.trim()
      || (
        spatialScore <= 0
        && textScore < 18
      )
    ) {
      return null;
    }

    const fusedCandidate: AgentStructuredToolCandidateEvidence = {
      ...candidate,
      center: {
        coordinateSpace: 'native-screen',
        source: 'ui-automation+visual',
        x: point.x,
        y: point.y,
      },
      confidence: options.evidence?.confidence === 'high' && candidate.confidence !== 'low'
        ? 'high'
        : candidate.confidence ?? options.evidence?.confidence ?? null,
      description: [
        candidate.description?.trim(),
        options.evidence?.relation?.trim(),
        'Fused with current visual/OCR evidence.',
      ].filter(Boolean).join(' | '),
      label: candidate.label?.trim()
        || candidate.name?.trim()
        || options.evidence?.primaryAction?.trim()
        || options.evidence?.targetMatched?.trim()
        || null,
      relation: [
        candidate.relation?.trim(),
        options.evidence?.relation?.trim(),
      ].filter(Boolean).join(' | ') || 'UI Automation selector matches current visual/OCR action evidence.',
      source: 'ui-automation+visual',
    };

    return {
      candidate: fusedCandidate,
      point,
      score,
    };
  })
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((a, b) => b.score - a.score);

  return ranked.at(0) ?? null;
}

function getAgentSessionV2CandidateSmallTargetScore(candidate: AgentStructuredToolCandidateEvidence) {
  const boundsWidth = Number(candidate.bounds?.width);
  const boundsHeight = Number(candidate.bounds?.height);
  if (!Number.isFinite(boundsWidth) || !Number.isFinite(boundsHeight) || boundsWidth <= 0 || boundsHeight <= 0) {
    return 0;
  }

  const boundsSpace = candidate.bounds?.coordinateSpace?.trim().toLowerCase() ?? '';
  const ratioLikeBounds = boundsSpace.includes('ratio') || (boundsWidth <= 1 && boundsHeight <= 1);
  if (ratioLikeBounds) {
    return boundsWidth * boundsHeight <= 0.018 || Math.max(boundsWidth, boundsHeight) <= 0.16 ? 8 : 0;
  }

  return boundsWidth <= 260 || boundsHeight <= 150 ? 8 : 0;
}

function hasAgentSessionV2SmallVisualCandidate(candidate: AgentStructuredToolCandidateEvidence) {
  return getAgentSessionV2CandidateSmallTargetScore(candidate) > 0;
}

function getAgentSessionV2VisualEvidenceCandidates(evidence: AgentStructuredToolEvidence | null) {
  return [
    ...(Array.isArray(evidence?.actionCandidates) ? evidence.actionCandidates : []),
    ...(Array.isArray(evidence?.targetCandidates) ? evidence.targetCandidates : []),
  ];
}

function shouldRefineAgentSessionV2ReadyVisualEvidence(options: {
  evidence: AgentStructuredToolEvidence | null;
  hasActionPoint: boolean;
  hasRefinableEvidenceLocation: boolean;
}) {
  const { evidence } = options;
  if (evidence?.visualActionReadiness !== 'ready' || !options.hasRefinableEvidenceLocation) {
    return false;
  }

  const stablePoint = resolveAgentSessionV2VisualActionPoint(evidence);
  const stableVisualEvidence = Boolean(
    options.hasActionPoint
      && stablePoint
      && evidence.confidence === 'high'
      && evidence.coordinateConfidence === 'high'
      && evidence.captureSourceType === 'window'
      && evidence.captureTrusted !== false
      && hasAgentSessionV2VerifiedPrimaryActionOwnership({ evidence })
      && hasAgentSessionV2PointInsideActionableArea(evidence, stablePoint)
      && !isAgentSessionV2LauncherVerificationBlocking(evidence)
  );
  if (stableVisualEvidence) {
    return false;
  }

  if (
    options.hasActionPoint
    && evidence.coordinateAuditStatus === 'coordinate_ok'
    && evidence.captureSourceType === 'window'
    && evidence.captureTrusted !== false
    && hasAgentSessionV2VerifiedLauncherActionOwnership(evidence)
  ) {
    return false;
  }

  if (
    evidence.targetMatched
    && isAgentSessionV2UsefulPrimaryAction(evidence.primaryAction)
    && !hasAgentSessionV2VerifiedPrimaryActionOwnership({ evidence })
  ) {
    return true;
  }

  if (!options.hasActionPoint || evidence.coordinateConfidence === 'low') {
    return true;
  }

  const candidates = getAgentSessionV2VisualEvidenceCandidates(evidence)
    .filter((candidate) => candidate.enabled !== false && candidate.offscreen !== true);
  const hasVisualCandidate = candidates.some((candidate) => (
    getAgentSessionV2CandidateSourceFamily(candidate) === 'visual'
  ));
  const hasMultipleLocatedCandidates = candidates
    .filter(hasAgentCandidateLocationEvidence)
    .length > 1;
  const hasCrossSourceCandidateAgreement = candidates.some((candidate) => (
    getAgentSessionV2CandidateCrossSourceAgreementScore({
      candidate,
      evidence,
    }) > 0
  ));
  const hasSmallLocatedCandidate = candidates.some((candidate) => (
    hasAgentCandidateLocationEvidence(candidate)
    && hasAgentSessionV2SmallVisualCandidate(candidate)
  ));

  return Boolean(
    hasVisualCandidate
      && (
        evidence.confidence === 'medium'
        || evidence.coordinateConfidence === 'medium'
      )
      || (hasMultipleLocatedCandidates && hasCrossSourceCandidateAgreement)
      || (hasVisualCandidate && hasSmallLocatedCandidate)
  );
}

interface AgentSessionV2VisualRefinementCandidateChoice {
  candidate: AgentStructuredToolCandidateEvidence;
  candidateKind: 'action' | 'target';
  reason: string;
  score: number;
}

function scoreAgentSessionV2VisualRefinementCandidate(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  candidateKind: 'action' | 'target';
  evidence: AgentStructuredToolEvidence | null;
  index: number;
  sourceText: string;
  userGoal: string;
}): AgentSessionV2VisualRefinementCandidateChoice {
  const { candidate, candidateKind, evidence, index } = options;
  const readiness = evidence?.visualActionReadiness ?? null;
  const reasonParts: string[] = [];
  let score = getAgentSessionV2CandidateConfidenceScore(candidate.confidence) - index;
  if (candidate.confidence) {
    reasonParts.push(`confidence=${candidate.confidence}`);
  }
  if (
    Number.isFinite(Number(candidate.centerRatio?.x))
    && Number.isFinite(Number(candidate.centerRatio?.y))
  ) {
    score += 35;
    reasonParts.push('has centerRatio');
  }
  if (
    Number.isFinite(Number(candidate.bounds?.x))
    && Number.isFinite(Number(candidate.bounds?.y))
    && Number.isFinite(Number(candidate.bounds?.width))
    && Number.isFinite(Number(candidate.bounds?.height))
  ) {
    score += 30;
    reasonParts.push('has bounds');
  }
  if (
    Number.isFinite(Number(candidate.center?.x))
    && Number.isFinite(Number(candidate.center?.y))
  ) {
    score += 25;
    reasonParts.push('has screen center');
  }
  if (candidate.relation?.trim()) {
    score += 10;
    reasonParts.push('has relation');
  }
  if (candidate.label?.trim() || candidate.description?.trim()) {
    score += 5;
  }
  if (candidate.source === 'uia-visual-fusion') {
    score += 35;
    reasonParts.push('combined UIA target/action relation crop');
  }
  if (
    (candidateKind === 'target' && (readiness === 'needs-target-selection' || readiness === 'low-confidence'))
    || (candidateKind === 'action' && (
      readiness === 'needs-primary-action'
      || readiness === 'needs-coordinate'
      || readiness === 'needs-relation'
    ))
  ) {
    score += 14;
    reasonParts.push(`${candidateKind} matches readiness`);
  }
  if (
    candidateKind === 'action'
    && readiness === 'ready'
    && evidence?.targetMatched
    && isAgentSessionV2UsefulPrimaryAction(evidence.primaryAction)
    && !hasAgentSessionV2VerifiedPrimaryActionOwnership({ candidate, evidence })
  ) {
    score += 22;
    reasonParts.push('action ownership needs focused relation check');
  }
  const relevanceScore = getAgentSessionV2CandidateTextRelevanceScore({
    candidate,
    evidence,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  if (relevanceScore > 0) {
    score += relevanceScore;
    reasonParts.push(`text relevance +${relevanceScore}`);
  }
  const smallTargetScore = getAgentSessionV2CandidateSmallTargetScore(candidate);
  if (smallTargetScore > 0) {
    score += smallTargetScore;
    reasonParts.push('small target needs close crop');
  }

  return {
    candidate,
    candidateKind,
    reason: reasonParts.length ? reasonParts.join(', ') : 'candidate has usable location evidence',
    score,
  };
}

function resolveAgentSessionV2BestVisualRefinementCandidate(
  options: {
    evidence: AgentStructuredToolEvidence | null;
    sourceText: string;
    userGoal: string;
  },
): AgentSessionV2VisualRefinementCandidateChoice | null {
  const { evidence } = options;
  const readiness = evidence?.visualActionReadiness ?? null;
  const targetCandidates = Array.isArray(evidence?.targetCandidates)
    ? evidence.targetCandidates
    : [];
  const actionCandidates = Array.isArray(evidence?.actionCandidates)
    ? evidence.actionCandidates
    : [];
  const relationCandidate = createAgentSessionV2RelationVisualRefinementCandidate(evidence);
  const orderedCandidates = (
    readiness === 'needs-primary-action'
    || readiness === 'needs-coordinate'
    || readiness === 'needs-relation'
  )
    ? [
        ...(relationCandidate ? [{ candidate: relationCandidate, candidateKind: 'action' as const }] : []),
        ...actionCandidates.map((candidate) => ({ candidate, candidateKind: 'action' as const })),
        ...targetCandidates.map((candidate) => ({ candidate, candidateKind: 'target' as const })),
      ]
    : [
        ...targetCandidates.map((candidate) => ({ candidate, candidateKind: 'target' as const })),
        ...actionCandidates.map((candidate) => ({ candidate, candidateKind: 'action' as const })),
      ];
  const syntheticCandidate = createAgentSessionV2StructuredEvidenceVisualRefinementCandidate(evidence);
  if (
    syntheticCandidate
    && (
      !orderedCandidates.length
      || readiness === 'ready'
      || readiness === 'low-confidence'
      || readiness === 'needs-coordinate'
    )
  ) {
    orderedCandidates.push({
      candidate: syntheticCandidate,
      candidateKind: isAgentSessionV2UsefulPrimaryAction(evidence?.primaryAction) ? 'action' : 'target',
    });
  }

  return orderedCandidates
    .map((candidate, index) => ({ ...candidate, index }))
    .filter(({ candidate }) => (
      hasAgentCandidateLocationEvidence(candidate)
      && candidate.enabled !== false
      && candidate.offscreen !== true
    ))
    .map((candidate, index) => ({
      ...candidate,
      score: scoreAgentSessionV2VisualRefinementCandidate({
        candidate: candidate.candidate,
        candidateKind: candidate.candidateKind,
        evidence,
        index,
        sourceText: options.sourceText,
        userGoal: options.userGoal,
      }),
    }))
    .sort((a, b) => b.score.score - a.score.score)
    .at(0)?.score ?? null;
}

function createAgentSessionV2RelationVisualRefinementCandidate(
  evidence: AgentStructuredToolEvidence | null,
): AgentStructuredToolCandidateEvidence | null {
  const targetCandidates = Array.isArray(evidence?.targetCandidates)
    ? evidence.targetCandidates.filter((candidate) => candidate.enabled !== false && candidate.offscreen !== true)
    : [];
  const actionCandidates = Array.isArray(evidence?.actionCandidates)
    ? evidence.actionCandidates.filter((candidate) => candidate.enabled !== false && candidate.offscreen !== true)
    : [];
  if (!targetCandidates.length || !actionCandidates.length) {
    return null;
  }

  const targetCandidate = targetCandidates.find(hasAgentCandidateLocationEvidence) ?? null;
  const actionCandidate = actionCandidates.find(hasAgentCandidateLocationEvidence) ?? null;
  if (!targetCandidate || !actionCandidate) {
    return null;
  }

  const unionBounds = createAgentSessionV2CandidateUnionBounds(targetCandidate, actionCandidate);
  if (!unionBounds) {
    return null;
  }

  const targetLabel = targetCandidate.label?.trim()
    || targetCandidate.name?.trim()
    || evidence?.targetMatched?.trim()
    || 'target candidate';
  const actionLabel = actionCandidate.label?.trim()
    || actionCandidate.name?.trim()
    || evidence?.primaryAction?.trim()
    || 'action candidate';

  return {
    bounds: unionBounds,
    center: unionBounds.coordinateSpace === 'native-screen'
      ? {
          coordinateSpace: 'native-screen',
          source: 'uia-visual-fusion',
          x: Math.round(unionBounds.x + unionBounds.width / 2),
          y: Math.round(unionBounds.y + unionBounds.height / 2),
        }
      : null,
    centerRatio: unionBounds.coordinateSpace === 'source-ratio'
      ? {
          coordinateSpace: 'source-ratio',
          source: 'uia-visual-fusion',
          x: Math.max(0, Math.min(1, unionBounds.x + unionBounds.width / 2)),
          y: Math.max(0, Math.min(1, unionBounds.y + unionBounds.height / 2)),
        }
      : null,
    confidence: 'high',
    description: `Combined target/action area: ${targetLabel} + ${actionLabel}`,
    label: `${targetLabel} + ${actionLabel}`,
    region: 'combined target/action relation area',
    relation: 'Crop includes both UI Automation target and action candidates so vision/OCR can verify their relation.',
    source: 'uia-visual-fusion',
  };
}

function createAgentSessionV2CandidateUnionBounds(
  first: AgentStructuredToolCandidateEvidence,
  second: AgentStructuredToolCandidateEvidence,
) {
  const firstBounds = createAgentSessionV2CandidateFocusBounds(first);
  const secondBounds = createAgentSessionV2CandidateFocusBounds(second);
  if (!firstBounds || !secondBounds || firstBounds.coordinateSpace !== secondBounds.coordinateSpace) {
    return null;
  }

  const x = Math.min(firstBounds.x, secondBounds.x);
  const y = Math.min(firstBounds.y, secondBounds.y);
  const right = Math.max(firstBounds.x + firstBounds.width, secondBounds.x + secondBounds.width);
  const bottom = Math.max(firstBounds.y + firstBounds.height, secondBounds.y + secondBounds.height);

  return {
    coordinateSpace: firstBounds.coordinateSpace,
    height: Math.max(1, bottom - y),
    source: 'uia-visual-fusion',
    width: Math.max(1, right - x),
    x,
    y,
  };
}

function createAgentSessionV2CandidateFocusBounds(candidate: AgentStructuredToolCandidateEvidence) {
  const bounds = candidate.bounds;
  const boundsX = Number(bounds?.x);
  const boundsY = Number(bounds?.y);
  const boundsWidth = Number(bounds?.width);
  const boundsHeight = Number(bounds?.height);
  if (
    [boundsX, boundsY, boundsWidth, boundsHeight].every(Number.isFinite)
    && boundsWidth > 0
    && boundsHeight > 0
  ) {
    const coordinateSpace = bounds?.coordinateSpace?.trim().toLowerCase() ?? '';
    const ratioLikeBounds = coordinateSpace.includes('ratio') || (boundsWidth <= 1 && boundsHeight <= 1);
    return {
      coordinateSpace: ratioLikeBounds ? 'source-ratio' as const : 'native-screen' as const,
      height: boundsHeight,
      width: boundsWidth,
      x: boundsX,
      y: boundsY,
    };
  }

  const centerRatioX = Number(candidate.centerRatio?.x);
  const centerRatioY = Number(candidate.centerRatio?.y);
  if (
    Number.isFinite(centerRatioX)
    && Number.isFinite(centerRatioY)
    && centerRatioX >= 0
    && centerRatioX <= 1
    && centerRatioY >= 0
    && centerRatioY <= 1
  ) {
    return {
      coordinateSpace: 'source-ratio' as const,
      height: 0.16,
      width: 0.22,
      x: Math.max(0, centerRatioX - 0.11),
      y: Math.max(0, centerRatioY - 0.08),
    };
  }

  const centerX = Number(candidate.center?.x);
  const centerY = Number(candidate.center?.y);
  if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
    return {
      coordinateSpace: 'native-screen' as const,
      height: 140,
      width: 220,
      x: Math.max(0, centerX - 110),
      y: Math.max(0, centerY - 70),
    };
  }

  return null;
}

function createAgentSessionV2StructuredEvidenceVisualRefinementCandidate(
  evidence: AgentStructuredToolEvidence | null,
): AgentStructuredToolCandidateEvidence | null {
  if (!evidence) {
    return null;
  }

  const label = [
    evidence.primaryAction,
    evidence.targetMatched,
  ].filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).join(' for ');
  const candidate: AgentStructuredToolCandidateEvidence = {
    bounds: evidence.elementBounds ?? null,
    center: evidence.elementCenter ?? null,
    centerRatio: evidence.elementCenterRatio ?? null,
    confidence: evidence.coordinateConfidence === 'low' ? 'low' : evidence.confidence ?? null,
    description: evidence.elementDescription ?? null,
    label: label || null,
    region: evidence.elementRegion ?? null,
    relation: evidence.relation ?? null,
    source: 'structuredEvidence',
  };

  return hasAgentCandidateLocationEvidence(candidate) ? candidate : null;
}

function inferAgentSessionV2VisualRefinementFocusScale(candidate: AgentStructuredToolCandidateEvidence) {
  if (candidate.confidence === 'low') {
    return 3;
  }

  const boundsWidth = Number(candidate.bounds?.width);
  const boundsHeight = Number(candidate.bounds?.height);
  if (Number.isFinite(boundsWidth) && Number.isFinite(boundsHeight) && boundsWidth > 0 && boundsHeight > 0) {
    const boundsSpace = candidate.bounds?.coordinateSpace?.trim().toLowerCase() ?? '';
    const ratioLikeBounds = boundsSpace.includes('ratio') || (boundsWidth <= 1 && boundsHeight <= 1);
    if (ratioLikeBounds && (boundsWidth * boundsHeight <= 0.018 || Math.max(boundsWidth, boundsHeight) <= 0.16)) {
      return 3;
    }
    if (!ratioLikeBounds && (boundsWidth <= 260 || boundsHeight <= 150)) {
      return 3;
    }
  }

  return candidate.confidence === 'medium' ? 2 : 1;
}

function createAgentSessionV2VisualRefinementFocusArgs(
  candidate: AgentStructuredToolCandidateEvidence,
): Record<string, unknown> | null {
  const focusScale = inferAgentSessionV2VisualRefinementFocusScale(candidate);
  const scaleArgs = focusScale > 1 ? { focusScale } : {};
  const ratioX = Number(candidate.centerRatio?.x);
  const ratioY = Number(candidate.centerRatio?.y);
  if (
    Number.isFinite(ratioX)
    && Number.isFinite(ratioY)
    && ratioX >= 0
    && ratioX <= 1
    && ratioY >= 0
    && ratioY <= 1
  ) {
    const boundsWidth = Number(candidate.bounds?.width);
    const boundsHeight = Number(candidate.bounds?.height);
    const boundsSpace = candidate.bounds?.coordinateSpace?.trim().toLowerCase() ?? '';
    const canUseRatioBounds = (
      boundsSpace.includes('ratio')
      || (
        Number.isFinite(boundsWidth)
        && Number.isFinite(boundsHeight)
        && boundsWidth > 0
        && boundsWidth <= 1
        && boundsHeight > 0
        && boundsHeight <= 1
      )
    );
    return {
      focusCenterRatioX: ratioX,
      focusCenterRatioY: ratioY,
      focusHeightRatio: canUseRatioBounds
        ? clampAgentSessionV2Ratio(boundsHeight * 2.4, 0.24)
        : 0.24,
      ...scaleArgs,
      focusWidthRatio: canUseRatioBounds
        ? clampAgentSessionV2Ratio(boundsWidth * 2.4, 0.28)
        : 0.28,
    };
  }

  const bounds = candidate.bounds;
  const boundsX = Number(bounds?.x);
  const boundsY = Number(bounds?.y);
  const boundsWidth = Number(bounds?.width);
  const boundsHeight = Number(bounds?.height);
  if (
    [boundsX, boundsY, boundsWidth, boundsHeight].every(Number.isFinite)
    && boundsWidth > 0
    && boundsHeight > 0
  ) {
    return {
      focusCoordinateSpace: bounds?.coordinateSpace?.trim() || 'native-screen',
      focusHeight: Math.max(120, Math.round(boundsHeight * 2.2)),
      ...scaleArgs,
      focusWidth: Math.max(180, Math.round(boundsWidth * 2.2)),
      focusX: Math.max(0, Math.round(boundsX - boundsWidth * 0.6)),
      focusY: Math.max(0, Math.round(boundsY - boundsHeight * 0.6)),
    };
  }

  const centerX = Number(candidate.center?.x);
  const centerY = Number(candidate.center?.y);
  if (Number.isFinite(centerX) && Number.isFinite(centerY)) {
    return {
      focusCoordinateSpace: candidate.center?.coordinateSpace?.trim() || 'native-screen',
      focusHeight: 240,
      ...scaleArgs,
      focusWidth: 360,
      focusX: Math.max(0, Math.round(centerX - 180)),
      focusY: Math.max(0, Math.round(centerY - 120)),
    };
  }

  return null;
}

function findLatestFailedAgentSessionV2ToolCall(
  toolResults: AgentSessionV2ToolResultEntry[],
  toolName?: string | null,
  args?: Record<string, unknown> | null,
) {
  const signature = toolName && args
    ? createAgentToolCallSignature(toolName, args)
    : null;
  return [...toolResults].reverse().find((entry) => {
    if (entry.result.ok !== false || !entry.command.toolCall?.name) {
      return false;
    }

    if (!signature) {
      return true;
    }

    return entry.command.toolCall.name === toolName
      && createAgentToolCallSignature(
        entry.command.toolCall.name,
        entry.command.toolCall.input ?? {},
      ) === signature;
  }) ?? null;
}

function createAgentSessionV2PlanningContextAdapters(): AgentPlanningContextAdapters<Set<AgentRequestedActionKind>> {
  const recoveryStrategyDependencies: AgentRecoveryStrategyRankingDependencies = {
    countAutoRecoveryWaits: countAgentDesktopAutoRecoveryWaits,
    resolveAutoRecoveryMaxWaits: resolveAgentDesktopAutoRecoveryMaxWaits,
  };
  const signalDependencies: AgentReplanSignalDependencies = {
    recoveryStrategyDependencies,
  };

  return {
    createMemoryConflictSignalText: createAgentWorkingMemoryConflictSignalText,
    createPostActionRecoveryFollowUpText: (toolResults) => (
      createAgentPostActionRecoveryFollowUpText({
        dependencies: {
          findRecoverableUnverifiedActionAttempt: findLatestAgentSessionV2RecoverableUnverifiedActionAttempt,
          isAutoRecoveryCommand: (command) => isAgentDesktopAutoRecoveryCommand(command)
            || isAgentPostApprovalVerificationCommand(command),
          isReadOnlyRecoveryEvidenceCommand: (command) => command.toolCall?.name === 'observe_windows_and_apps'
            || command.toolCall?.name === 'execute_desktop_observation'
            || command.toolCall?.name === 'locate_screen_elements',
          recoveryStrategyDependencies,
        },
        toolResults,
      })
    ),
    createRecentVisualContextText: createAgentRecentVisualContextText,
    createReplanSignalText: (options) => createAgentReplanSignalText({
      dependencies: signalDependencies,
      ...options,
    }),
    createRequestedActionCoverage: ({ sourceText, userGoal }) => (
      createAgentRequestedActionCoverage({
        dependencies: agentSessionV2ActionCoverageDependencies,
        sourceText,
        userGoal,
      })
    ),
    createResultVerificationText: createAgentResultVerificationSignalText,
    createTaskProgressText: createAgentTaskProgressText,
    createTraceStuckSignalText: (options) => createAgentTraceStuckSignalText({
      dependencies: signalDependencies,
      ...options,
    }),
    createVisualRecoveryText: createAgentVisualRecoveryText,
  };
}

export function createAgentSessionV2PlanningContext(options: {
  sourceText: string;
  steps: AgentSessionV2Step[];
  toolResults: AgentSessionV2ToolResultEntry[];
  traceEvents: AgentSessionV2TraceEvent[];
  userGoal: string;
  workingMemory?: AgentWorkingMemorySnapshot | null;
  workingMemoryText?: string | null;
}): AgentPlanningContext {
  return createAgentPlanningContext({
    ...options,
    adapters: createAgentSessionV2PlanningContextAdapters(),
  });
}

function getAgentSessionV2ToolInputAction(command: AgentChatCommand) {
  const action = command.toolCall?.input.action;
  return typeof action === 'string' ? action.trim() : '';
}

function isAgentSessionV2VisualToolName(toolName: string | null | undefined) {
  return toolName === 'summarize_visual_snapshot' || toolName === 'analyze_game_screen';
}

function isAgentSessionV2VisualToolCommand(command: AgentChatCommand) {
  const toolName = command.toolCall?.name;
  const action = getAgentSessionV2ToolInputAction(command);
  return isAgentSessionV2VisualToolName(toolName)
    || (
      toolName === 'execute_desktop_observation'
      && action === 'summarize_visual_snapshot'
    );
}

export async function defaultAgentSessionV2ModelCaller(request: AgentSessionV2ModelRequest) {
  const { getAgentPlannerResponse } = await import('../services/geminiService');

  return getAgentPlannerResponse(
    request.userInput,
    request.systemInstruction,
    request.settings,
    request.signal,
  );
}

function countFailedAgentSessionV2ToolCalls(
  toolResults: AgentSessionV2ToolResultEntry[],
  toolName: string,
  args: Record<string, unknown>,
) {
  const signature = createAgentToolCallSignature(toolName, args);

  return toolResults.filter((entry) => (
    entry.result.ok === false
    && entry.command.toolCall?.name === toolName
    && createAgentToolCallSignature(
      entry.command.toolCall.name,
      entry.command.toolCall.input ?? {},
    ) === signature
  )).length;
}

function countAgentSessionV2RepeatedFailedToolCallRejections(
  steps: AgentSessionV2Step[],
  toolName: string,
  args: Record<string, unknown>,
) {
  const signature = createAgentToolCallSignature(toolName, args);

  return steps.filter((step) => (
    step.tool === toolName
    && step.errorText?.includes('Rejected repeated failed tool call before execution')
    && createAgentToolCallSignature(
      toolName,
      step.args ?? {},
    ) === signature
  )).length;
}

function getAgentSessionV2ToolAction(args: Record<string, unknown> | undefined) {
  const action = args?.action;
  return typeof action === 'string' ? action.trim().toLowerCase() : '';
}

function isAgentSessionV2VideoSummarySearchTool(
  toolName: AgentToolCallName,
  args: Record<string, unknown> | undefined,
) {
  if (toolName === 'browser_search' || toolName === 'search_web') {
    return true;
  }

  if (toolName !== 'control_browser' && toolName !== 'execute_desktop_action') {
    return false;
  }

  const action = getAgentSessionV2ToolAction(args);
  return action === 'search_web' || action === 'search';
}

function shouldRejectAgentSessionV2VideoSummarySearch(options: {
  args: Record<string, unknown> | undefined;
  sourceText: string;
  toolName: AgentToolCallName;
  userGoal: string;
}) {
  return isAgentVideoSummaryIntent(options.sourceText, options.userGoal)
    && !hasAgentExplicitVideoSearchIntent(options.sourceText, options.userGoal)
    && isAgentSessionV2VideoSummarySearchTool(options.toolName, options.args);
}

function isAgentSessionV2ApprovalReadyPlanningCommand(command: AgentChatCommand) {
  if (command.kind === 'desktop-organization') {
    return command.desktopOrganization?.mode !== 'execute';
  }

  if (command.toolCall?.name === 'organize_desktop_icons') {
    return command.toolCall.input?.mode !== 'execute';
  }

  if (command.toolCall?.name === 'execute_file_management_action') {
    const input = command.toolCall.input ?? {};
    const action = typeof input.action === 'string' ? input.action.toLowerCase() : '';
    const mode = typeof input.mode === 'string' ? input.mode.toLowerCase() : '';
    return action === 'preview' || mode === 'preview' || input.dryRun === true;
  }

  return false;
}

function resolveAgentSessionV2ApprovalReadyFollowUp(options: {
  command: AgentChatCommand;
  result: AgentChatCommandResult;
  sourceText: string;
  userGoal: string;
}): AgentSessionV2PendingApproval | null {
  if (
    options.result.ok === false
    || !isAgentSessionV2ApprovalReadyPlanningCommand(options.command)
    || !hasAgentDirectActionIntent(options.sourceText, options.userGoal)
  ) {
    return null;
  }

  const action = resolveAgentResultFollowUpActions(options.result).find((
    candidate,
  ): candidate is Extract<AgentChatFollowUpAction, { kind: 'run-command' }> => (
    candidate.kind === 'run-command' && candidate.requiresApproval === true
  ));
  if (!action) {
    return null;
  }

  const route = buildAgentPermissionRoute(action.command);
  if (!route.plan || route.blockedStep || !route.requiresApproval) {
    return null;
  }

  return {
    command: action.command,
    plan: route.plan,
    reason: createAgentApprovalReadyFollowUpReason({
      actionLabel: action.label,
    }),
    routeSummary: route.summary,
  };
}

const AGENT_SESSION_V2_CANCELLED_ANSWER = 'Agent run was cancelled by the user.';

function normalizeAgentSessionV2ScreenPoint(
  point: AgentStructuredToolPointEvidence | null | undefined,
) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  const coordinateSpace = point?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (coordinateSpace && coordinateSpace !== 'native-screen') {
    return null;
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
  };
}

function normalizeAgentSessionV2RectCenter(
  rect: AgentStructuredToolRectEvidence | null | undefined,
) {
  const x = Number(rect?.x);
  const y = Number(rect?.y);
  const width = Number(rect?.width);
  const height = Number(rect?.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  const coordinateSpace = rect?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (coordinateSpace && coordinateSpace !== 'native-screen') {
    return null;
  }

  return {
    x: Math.round(x + width / 2),
    y: Math.round(y + height / 2),
  };
}

function normalizeAgentSessionV2RatioPoint(
  point: AgentStructuredToolPointEvidence | null | undefined,
) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 1 || y < 0 || y > 1) {
    return null;
  }

  return { x, y };
}

function resolveAgentSessionV2RatioPointFromSourceBounds(
  evidence: AgentStructuredToolEvidence | null,
) {
  const ratioPoint = normalizeAgentSessionV2RatioPoint(evidence?.elementCenterRatio);
  const sourceBounds = evidence?.sourceBounds;
  const x = Number(sourceBounds?.x);
  const y = Number(sourceBounds?.y);
  const width = Number(sourceBounds?.width);
  const height = Number(sourceBounds?.height);
  if (
    !ratioPoint
    || ![x, y, width, height].every(Number.isFinite)
    || width <= 0
    || height <= 0
  ) {
    return null;
  }

  const coordinateSpace = sourceBounds?.coordinateSpace?.trim().toLowerCase() || 'native-screen';
  if (coordinateSpace && coordinateSpace !== 'native-screen') {
    return null;
  }

  return {
    x: Math.round(x + width * ratioPoint.x),
    y: Math.round(y + height * ratioPoint.y),
  };
}

function resolveAgentSessionV2VisualActionPoint(evidence: AgentStructuredToolEvidence | null) {
  const coordinateAuditStatus = evidence?.coordinateAuditStatus ?? evidence?.coordinateAudit?.status ?? null;
  if (coordinateAuditStatus && coordinateAuditStatus !== 'coordinate_ok') {
    return null;
  }

  return normalizeAgentSessionV2RectCenter(evidence?.elementBounds)
    ?? normalizeAgentSessionV2ScreenPoint(evidence?.elementCenter)
    ?? resolveAgentSessionV2RatioPointFromSourceBounds(evidence);
}

function resolveAgentSessionV2NativePoint(
  point: AgentStructuredToolPointEvidence | null | undefined,
  evidence: AgentStructuredToolEvidence | null,
) {
  const x = Number(point?.x);
  const y = Number(point?.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  const coordinateSpace = point?.coordinateSpace?.trim().toLowerCase() ?? 'native-screen';
  if (!coordinateSpace.includes('ratio')) {
    return { x, y };
  }
  const sourceBounds = evidence?.sourceBounds;
  const sourceX = Number(sourceBounds?.x);
  const sourceY = Number(sourceBounds?.y);
  const sourceWidth = Number(sourceBounds?.width);
  const sourceHeight = Number(sourceBounds?.height);
  if (
    sourceBounds?.coordinateSpace?.trim().toLowerCase() !== 'native-screen'
    || ![sourceX, sourceY, sourceWidth, sourceHeight].every(Number.isFinite)
    || sourceWidth <= 0
    || sourceHeight <= 0
  ) {
    return null;
  }
  return {
    x: sourceX + sourceWidth * x,
    y: sourceY + sourceHeight * y,
  };
}

function isAgentSessionV2NativePointInsideBounds(
  point: { x: number; y: number },
  bounds: AgentStructuredToolRectEvidence | null | undefined,
  evidence: AgentStructuredToolEvidence | null,
) {
  const left = resolveAgentSessionV2NativePoint({
    coordinateSpace: bounds?.coordinateSpace,
    x: bounds?.x,
    y: bounds?.y,
  }, evidence);
  const right = resolveAgentSessionV2NativePoint({
    coordinateSpace: bounds?.coordinateSpace,
    x: Number(bounds?.x) + Number(bounds?.width),
    y: Number(bounds?.y) + Number(bounds?.height),
  }, evidence);
  return Boolean(
    left
    && right
    && Number(bounds?.width) > 0
    && Number(bounds?.height) > 0
    && point.x >= left.x
    && point.x <= right.x
    && point.y >= left.y
    && point.y <= right.y,
  );
}

function hasAgentSessionV2PointInsideActionableArea(
  evidence: AgentStructuredToolEvidence | null,
  point: { x: number; y: number },
) {
  const getDeclaredCandidatePoint = (candidate: AgentStructuredToolCandidateEvidence) => {
    if (candidate.center) {
      return resolveAgentSessionV2NativePoint(candidate.center, evidence);
    }
    if (candidate.centerRatio) {
      return resolveAgentSessionV2NativePoint(candidate.centerRatio, evidence);
    }
    return null;
  };
  const actionCandidates = (evidence?.actionCandidates ?? [])
    .filter((candidate) => candidate.enabled !== false && candidate.offscreen !== true)
    .filter((candidate) => candidate.bounds);
  if (actionCandidates.length) {
    return actionCandidates.some((candidate) => (
      (!getDeclaredCandidatePoint(candidate)
        || isAgentSessionV2NativePointInsideBounds(
          getDeclaredCandidatePoint(candidate)!,
          candidate.bounds,
          evidence,
        ))
      &&
      isAgentSessionV2NativePointInsideBounds(point, candidate.bounds, evidence)
    ));
  }
  return isAgentSessionV2NativePointInsideBounds(point, evidence?.elementBounds, evidence);
}

function resolveAgentSessionV2CandidateScreenPoint(
  candidate: AgentStructuredToolCandidateEvidence,
  evidence: AgentStructuredToolEvidence | null,
) {
  return normalizeAgentSessionV2RectCenter(candidate.bounds)
    ?? normalizeAgentSessionV2ScreenPoint(candidate.center)
    ?? resolveAgentSessionV2RatioPointFromSourceBounds({
      elementCenterRatio: candidate.centerRatio,
      sourceBounds: evidence?.sourceBounds,
    } as AgentStructuredToolEvidence);
}

function getAgentSessionV2CommandClickPoints(command: AgentChatCommand): Array<{ x: number; y: number }> {
  const toolName = command.toolCall?.name ?? '';
  const input = command.toolCall?.input ?? {};
  if (toolName === 'execute_desktop_action') {
    const action = typeof input.action === 'string' ? normalizeAgentSessionV2ToolActionName(input.action) : '';
    const point = (action === 'interact_window_ui' || action === 'invoke_window_ui')
      ? getAgentSessionV2WindowUiInputPoint(input)
      : null;
    return point ? [point] : [];
  }

  if (toolName === 'execute_desktop_input') {
    const action = typeof input.action === 'string' ? normalizeAgentSessionV2ToolActionName(input.action) : '';
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
          ? normalizeAgentSessionV2ToolActionName(nestedArgs.action)
          : '';
        const point = (action === 'interact_window_ui' || action === 'invoke_window_ui')
          ? getAgentSessionV2WindowUiInputPoint(nestedArgs)
          : null;
        return point ? [point] : [];
      }

      if (nestedTool !== 'execute_desktop_input') {
        return [];
      }

      const action = typeof nestedArgs.action === 'string'
        ? normalizeAgentSessionV2ToolActionName(nestedArgs.action)
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

function getAgentSessionV2CommandDesktopInputActions(command: AgentChatCommand) {
  const toolName = command.toolCall?.name ?? '';
  const input = command.toolCall?.input ?? {};
  if (toolName === 'execute_desktop_input') {
    const action = typeof input.action === 'string' ? normalizeAgentSessionV2ToolActionName(input.action) : '';
    return action ? [action] : [];
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
      if (nestedTool !== 'execute_desktop_input') {
        return [];
      }

      const action = typeof nestedArgs.action === 'string'
        ? normalizeAgentSessionV2ToolActionName(nestedArgs.action)
        : '';
      return action ? [action] : [];
    });
  } catch {
    return [];
  }
}

function normalizeAgentSessionV2WindowUiSignatureValue(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ')
    : '';
}

function getAgentSessionV2WindowUiPointKey(point: { x: number; y: number }) {
  return `point:${Math.round(point.x / 12)}:${Math.round(point.y / 12)}`;
}

function getAgentSessionV2WindowUiInputPoint(input: Record<string, unknown>) {
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

function getAgentSessionV2WindowUiIdentityKeysFromInput(input: Record<string, unknown>) {
  const keys: string[] = [];
  const hwnd = Number(input.hwnd);
  if (Number.isFinite(hwnd) && hwnd > 0) {
    keys.push(`hwnd:${Math.round(hwnd)}`);
  }

  const query = normalizeAgentSessionV2WindowUiSignatureValue(input.query);
  if (query) {
    keys.push(`query:${query}`);
  }

  keys.push('any');
  return [...new Set(keys)];
}

function getAgentSessionV2WindowUiIdentityKeysFromCandidate(candidate: AgentStructuredToolCandidateEvidence) {
  const keys: string[] = [];
  const hwnd = Number(candidate.window?.hwnd);
  if (Number.isFinite(hwnd) && hwnd > 0) {
    keys.push(`hwnd:${Math.round(hwnd)}`);
  }

  const title = normalizeAgentSessionV2WindowUiSignatureValue(candidate.window?.title);
  if (title) {
    keys.push(`query:${title}`);
  }

  const processName = normalizeAgentSessionV2WindowUiSignatureValue(candidate.window?.processName);
  if (processName) {
    keys.push(`process:${processName}`);
  }

  keys.push('any');
  return [...new Set(keys)];
}

function createAgentSessionV2WindowUiSignatureKeys(options: {
  automationId?: unknown;
  controlType?: unknown;
  identities: string[];
  point?: { x: number; y: number } | null;
  targetText?: unknown;
}) {
  const keys: string[] = [];
  const automationId = normalizeAgentSessionV2WindowUiSignatureValue(options.automationId);
  const controlType = normalizeAgentSessionV2WindowUiSignatureValue(options.controlType);
  const targetText = normalizeAgentSessionV2WindowUiSignatureValue(options.targetText);
  const pointKey = options.point ? getAgentSessionV2WindowUiPointKey(options.point) : '';
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

function getAgentSessionV2CommandWindowUiInputs(command: AgentChatCommand) {
  const toolName = command.toolCall?.name ?? '';
  const input = command.toolCall?.input ?? {};
  const isWindowUiInput = (value: Record<string, unknown>) => {
    const action = typeof value.action === 'string'
      ? normalizeAgentSessionV2ToolActionName(value.action)
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

function getAgentSessionV2CommandWindowUiSignatureKeys(command: AgentChatCommand) {
  return [
    ...new Set(
      getAgentSessionV2CommandWindowUiInputs(command).flatMap((input) => createAgentSessionV2WindowUiSignatureKeys({
        automationId: input.automationId,
        controlType: input.controlType,
        identities: getAgentSessionV2WindowUiIdentityKeysFromInput(input),
        point: getAgentSessionV2WindowUiInputPoint(input),
        targetText: input.targetText,
      })),
    ),
  ];
}

function getAgentSessionV2PreviousUnverifiedWindowUiSignatureKeys(
  toolResults: AgentSessionV2ToolResultEntry[] | null | undefined,
) {
  const previousAttempt = findLatestAgentSessionV2RecoverableUnverifiedActionAttempt(toolResults ?? []);
  const postActionState = resolveAgentRecoveryPostActionState({
    entry: previousAttempt,
    sourceText: previousAttempt?.command.sourceText ?? '',
    userGoal: previousAttempt?.command.toolCall?.goal ?? previousAttempt?.command.instruction ?? '',
  });
  return previousAttempt && AGENT_RETRY_AVOIDANCE_POST_ACTION_STATES.has(postActionState)
    ? getAgentSessionV2CommandWindowUiSignatureKeys(previousAttempt.command)
    : [];
}

function isAgentSessionV2SameUnverifiedWindowUiCandidate(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  evidence: AgentStructuredToolEvidence | null;
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
}) {
  const previousAttempt = findLatestAgentSessionV2RecoverableUnverifiedActionAttempt(options.toolResults ?? []);
  const postActionState = resolveAgentRecoveryPostActionState({
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

  const previousWindowUiSignatureKeys = getAgentSessionV2CommandWindowUiSignatureKeys(previousAttempt.command);
  if (!previousWindowUiSignatureKeys.length) {
    return false;
  }

  const candidateWindowUiSignatureKeys = getAgentSessionV2CandidateWindowUiSignatureKeys(
    options.candidate,
    options.evidence,
  );
  return candidateWindowUiSignatureKeys.some((key) => previousWindowUiSignatureKeys.includes(key));
}

function hasAgentSessionV2SameRetryAvoidanceWindowUiCandidate(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  evidence: AgentStructuredToolEvidence | null;
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
}) {
  return isAgentSessionV2SameUnverifiedWindowUiCandidate(options);
}

function getAgentSessionV2CandidateWindowUiSignatureKeys(
  candidate: AgentStructuredToolCandidateEvidence,
  evidence: AgentStructuredToolEvidence | null,
) {
  const point = resolveAgentSessionV2CandidateScreenPoint(candidate, evidence);
  return createAgentSessionV2WindowUiSignatureKeys({
    automationId: candidate.automationId,
    controlType: candidate.controlType,
    identities: getAgentSessionV2WindowUiIdentityKeysFromCandidate(candidate),
    point,
    targetText: candidate.name ?? candidate.label ?? evidence?.targetMatched,
  });
}

function getAgentSessionV2PreviousUnverifiedActionPoints(
  toolResults: AgentSessionV2ToolResultEntry[] | null | undefined,
) {
  const previousAttempt = findLatestAgentSessionV2RecoverableUnverifiedActionAttempt(toolResults ?? []);
  return previousAttempt ? getAgentSessionV2CommandClickPoints(previousAttempt.command) : [];
}

function getAgentSessionV2PointDistance(
  point: { x: number; y: number },
  other: { x: number; y: number },
) {
  return Math.hypot(point.x - other.x, point.y - other.y);
}

function isAgentSessionV2NearPreviousActionPoint(
  point: { x: number; y: number },
  previousPoints: Array<{ x: number; y: number }>,
) {
  return previousPoints.some((previousPoint) => (
    getAgentSessionV2PointDistance(point, previousPoint) <= 12
  ));
}

function scoreAgentSessionV2VisualActionCandidate(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  candidateKind: 'action' | 'target';
  evidence: AgentStructuredToolEvidence | null;
  index: number;
  previousPoints: Array<{ x: number; y: number }>;
}) {
  const point = resolveAgentSessionV2CandidateScreenPoint(options.candidate, options.evidence);
  if (!point) {
    return null;
  }

  let score = 60 + getAgentSessionV2CandidateConfidenceScore(options.candidate.confidence) - options.index;
  if (options.candidateKind === 'action') {
    score += 15;
  }
  if (options.candidate.relation?.trim()) {
    score += 12;
  }
  if (options.candidate.label?.trim() || options.candidate.description?.trim()) {
    score += 5;
  }
  score += getAgentSessionV2CandidateCrossSourceAgreementScore({
    candidate: options.candidate,
    evidence: options.evidence,
  });
  if (isAgentSessionV2NearPreviousActionPoint(point, options.previousPoints)) {
    score -= 90;
  } else if (options.previousPoints.length) {
    const nearestDistance = Math.min(
      ...options.previousPoints.map((previousPoint) => getAgentSessionV2PointDistance(point, previousPoint)),
    );
    score += Math.min(25, Math.max(0, nearestDistance / 12));
  }

  return {
    candidate: options.candidate,
    candidateKind: options.candidateKind,
    point,
    score,
  };
}

function rankAgentSessionV2VisualActionCandidates(options: {
  evidence: AgentStructuredToolEvidence | null;
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
}) {
  const previousPoints = getAgentSessionV2PreviousUnverifiedActionPoints(options.toolResults);
  const actionCandidates = Array.isArray(options.evidence?.actionCandidates)
    ? options.evidence.actionCandidates
    : [];
  const targetCandidates = Array.isArray(options.evidence?.targetCandidates)
    ? options.evidence.targetCandidates
    : [];
  const rankedCandidates = [
    ...actionCandidates.map((candidate, index) => scoreAgentSessionV2VisualActionCandidate({
      candidate,
      candidateKind: 'action' as const,
      evidence: options.evidence,
      index,
      previousPoints,
    })),
    ...targetCandidates.map((candidate, index) => scoreAgentSessionV2VisualActionCandidate({
      candidate,
      candidateKind: 'target' as const,
      evidence: options.evidence,
      index,
      previousPoints,
    })),
  ]
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((a, b) => b.score - a.score);

  return rankedCandidates;
}

function resolveAgentSessionV2VisualActionApprovalPoint(options: {
  evidence: AgentStructuredToolEvidence | null;
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
}) {
  const directPoint = resolveAgentSessionV2VisualActionPoint(options.evidence);
  const previousPoints = getAgentSessionV2PreviousUnverifiedActionPoints(options.toolResults);
  const rankedCandidates = rankAgentSessionV2VisualActionCandidates(options);
  const bestCandidate = rankedCandidates.at(0);
  const bestActionCandidate = rankedCandidates.find((candidate) => candidate.candidateKind === 'action');
  if (
    bestActionCandidate
    && options.evidence?.visualActionReadiness === 'ready'
    && isAgentSessionV2UsefulPrimaryAction(options.evidence.primaryAction)
    && options.evidence.confidence !== 'low'
    && bestActionCandidate.candidate.confidence !== 'low'
  ) {
    return bestActionCandidate.point;
  }

  if (
    bestCandidate
    && (
      !directPoint
      || (
        isAgentSessionV2NearPreviousActionPoint(directPoint, previousPoints)
        && !isAgentSessionV2NearPreviousActionPoint(bestCandidate.point, previousPoints)
      )
    )
  ) {
    return bestCandidate.point;
  }

  return directPoint ?? bestCandidate?.point ?? null;
}

const AGENT_SESSION_V2_UI_ACTION_PRIORITY = ['invoke', 'select', 'toggle', 'expand-collapse', 'focus', 'scroll-into-view', 'value'] as const;

function normalizeAgentSessionV2UiActionToken(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[_\s]+/gu, '-')
    : '';
}

function getAgentSessionV2CandidateUiActions(candidate: AgentStructuredToolCandidateEvidence) {
  const actions = Array.isArray(candidate.actions) ? candidate.actions : [];
  const normalizedActions = actions.map(normalizeAgentSessionV2UiActionToken);
  const actionText = [
    ...normalizedActions,
    candidate.description ?? '',
  ].join(' ').toLowerCase().replace(/[_\s]+/gu, '-');

  return AGENT_SESSION_V2_UI_ACTION_PRIORITY.filter((action) => (
    normalizedActions.includes(action)
    || new RegExp(`\\b${action.replace('-', '[-_]')}\\b`, 'iu').test(actionText)
  ));
}

function isAgentSessionV2InvokableUiCandidate(candidate: AgentStructuredToolCandidateEvidence) {
  const actions = getAgentSessionV2CandidateUiActions(candidate);
  const canScrollIntoView = actions.includes('scroll-into-view');
  if (candidate.enabled === false || (candidate.offscreen === true && !canScrollIntoView)) {
    return false;
  }

  return actions.length > 0;
}

function isAgentSessionV2EditableUiCandidate(candidate: AgentStructuredToolCandidateEvidence) {
  return Boolean(
    candidate.actions?.some((action) => action.trim().toLowerCase() === 'value')
      || /(?:edit|textbox|text\s*box|input|search|combo\s*box|鏉堟挸鍙唡閺傚洦婀皘閹兼粎鍌?)/iu.test([
        candidate.controlType,
        candidate.label,
        candidate.description,
        candidate.name,
        candidate.region,
      ].filter(Boolean).join(' ')),
  );
}

function inferAgentSessionV2WindowUiAction(
  candidate: AgentStructuredToolCandidateEvidence,
  evidence: AgentStructuredToolEvidence | null,
  sourceText = '',
  userGoal = '',
) {
  const actions = getAgentSessionV2CandidateUiActions(candidate);
  const intentText = [
    sourceText,
    userGoal,
    evidence?.primaryAction,
    evidence?.elementDescription,
    candidate.label,
    candidate.description,
    candidate.relation,
  ].filter(Boolean).join(' ').toLowerCase();
  if (/(?:select|choose|闁瀚▅闁鑵?)/iu.test(intentText)) {
    return 'select';
  }
  if (/(?:toggle|check|uncheck|閸曢箖鈧閸欐牗绉烽崟楣冣偓澧婇崚鍥ㄥ床)/iu.test(intentText)) {
    return 'toggle';
  }
  if (/(?:expand|鐏炴洖绱?)/iu.test(intentText)) {
    return 'expand';
  }
  if (/(?:collapse|閺€鎯版崳|閹舵ê褰?)/iu.test(intentText)) {
    return 'collapse';
  }
  if (
    /(?:focus|set[_\s-]*focus|keyboard[_\s-]*focus|閼辨氨鍔峾閻掞妇鍋闁鑵戦崥宸崗鍫モ偓澶夎厬)/iu.test(intentText)
    && actions.includes('focus')
  ) {
    return 'focus';
  }
  if (
    /(?:scroll[_\s-]*into[_\s-]*view|scroll|濠婃艾濮﹟濠婃艾鍩寍濠婃垵鍩寍閺勫墽銇氶崙鐑樻降|缁夎鍩岄崣顖濐潌)/iu.test(intentText)
    && actions.includes('scroll-into-view')
  ) {
    return 'scroll_into_view';
  }
  if (
    /(?:set[_\s-]*value|typing|text\s*input|input\s*text|鏉堟挸鍙唡婵夘偄鍟?)/iu.test(intentText)
    && isAgentSessionV2EditableUiCandidate(candidate)
  ) {
    return 'set_value';
  }

  if (actions.includes('invoke')) {
    return 'invoke';
  }
  if (actions.includes('select')) {
    return 'select';
  }
  if (actions.includes('toggle')) {
    return 'toggle';
  }
  if (actions.includes('expand-collapse')) {
    return 'expand';
  }
  if (actions.includes('focus')) {
    return 'focus';
  }
  if (actions.includes('scroll-into-view')) {
    return 'scroll_into_view';
  }
  if (actions.includes('value')) {
    return 'set_value';
  }

  return 'auto';
}

function isAgentSessionV2LikelyUiFieldLabelValue(value: string) {
  const compactValue = value
    .normalize('NFKC')
    .replace(/[\s"'`.,;:!?()[\]{}<>_\-]+/gu, '')
    .toLowerCase();

  return Boolean(
    compactValue
      && (
        /^(?:box|field|input|textbox|textinput|searchbox|searchfield|edit|control)$/u.test(compactValue)
        || /^(?:\u6846|\u8f93\u5165\u6846|\u641c\u7d22\u6846|\u6587\u672c\u6846|\u7f16\u8f91\u6846|\u63a7\u4ef6)$/u.test(compactValue)
      ),
  );
}

/*
function extractAgentSessionV2WindowUiSetValueText(...values: string[]) {
  const text = values
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .normalize('NFKC');
  if (!text.trim()) {
    return '';
  }

  const quotedMatch = text.match(/(?:鏉堟挸鍙唡婵夘偄鍟搢婵夘偄鍙唡闁款喖鍙唡鐠佸墽鐤嗘稉绨楃拋鍙ヨ礋|閺€瑙勫灇|閺€閫涜礋|enter|type|fill(?:[^\S\r\n]+in)?|set(?:[^\S\r\n]+(?:value|text))?[^\S\r\n]+to|change[^\S\r\n]+to)[^\n"'閳ユ壕鈧績鈧ǚ鈧獋]{0,40}["閳?閳ユ]([^"閳?閳ユ獋]{1,160})["閳?閳ユ獋]/iu);
  if (quotedMatch?.[1]?.trim()) {
    return quotedMatch[1].trim();
  }

  const plainMatch = text.match(/(?:鏉堟挸鍙唡婵夘偄鍟搢婵夘偄鍙唡闁款喖鍙?[^\S\r\n]*[:閿涙瓥?[^\S\r\n]*([^\n閿涘被鈧偊绱?]{1,120})|(?:鐠佸墽鐤嗘稉绨楃拋鍙ヨ礋|閺€瑙勫灇|閺€閫涜礋)[^\S\r\n]*[:閿涙瓥?[^\S\r\n]*([^\n閿涘被鈧偊绱?]{1,120})|(?:enter|type|fill(?:[^\S\r\n]+in)?|set(?:[^\S\r\n]+(?:value|text))?[^\S\r\n]+to|change[^\S\r\n]+to)[^\S\r\n]+([^\n.;]{1,120})/iu);
  const value = plainMatch?.[1] ?? plainMatch?.[2] ?? plainMatch?.[3] ?? '';
  const cleanedValue = value
    .replace(/(?:閸掔殬鏉╂硲閸︹枀into|in)\s*(?:鏉堟挸鍙嗗鍞￠弬鍥ㄦ拱濡楀敗閹兼粎鍌ㄥ鍞ield|textbox|input).*$/iu, '')
    .trim();
  if (
    !cleanedValue
    || isAgentSessionV2LikelyUiFieldLabelValue(cleanedValue)
    || /^(?:閸掔殬鏉╂硲閸??\s*.*(?:鏉堟挸鍙嗗鍞￠弬鍥ㄦ拱濡楀敗閹兼粎鍌ㄥ鍞ield|textbox|input)\s*$/iu.test(cleanedValue)
  ) {
    return '';
  }

  return cleanedValue;
}
*/

function extractAgentSessionV2WindowUiSetValueText(...values: string[]) {
  const text = values
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .normalize('NFKC');
  if (!text.trim()) {
    return '';
  }

  const quotedMatch = text.match(/(?:\u8f93\u5165|\u586b\u5199|\u586b\u5165|\u952e\u5165|\u8bbe\u7f6e\u4e3a|\u8bbe\u4e3a|\u6539\u6210|\u6539\u4e3a|杈撳叆|濉啓|濉叆|閿叆|enter|type|fill(?:[^\S\r\n]+in)?|set(?:[^\S\r\n]+(?:value|text))?[^\S\r\n]+to|change[^\S\r\n]+to)[^\n"'`]{0,40}["'`]([^"'`]{1,160})["'`]/iu);
  if (quotedMatch?.[1]?.trim()) {
    return quotedMatch[1].trim();
  }

  const plainMatch = text.match(/(?:\u8f93\u5165|\u586b\u5199|\u586b\u5165|\u952e\u5165|杈撳叆|濉啓|濉叆|閿叆)[^\S\r\n]*[:锛歖][^\S\r\n]*([^\n,.;锛屻€傦紱]{1,120})|(?:\u8bbe\u7f6e\u4e3a|\u8bbe\u4e3a|\u6539\u6210|\u6539\u4e3a)[^\S\r\n]*[:锛歖][^\S\r\n]*([^\n,.;锛屻€傦紱]{1,120})|(?:enter|type|fill(?:[^\S\r\n]+in)?|set(?:[^\S\r\n]+(?:value|text))?[^\S\r\n]+to|change[^\S\r\n]+to)[^\S\r\n]+([^\n.;]{1,120})/iu);
  const value = plainMatch?.[1] ?? plainMatch?.[2] ?? plainMatch?.[3] ?? '';
  const cleanedValue = value
    .replace(/(?:\u5230|\u8fdb\u5165|into|in)\s*(?:\u8f93\u5165\u6846|\u6587\u672c\u6846|\u641c\u7d22\u6846|field|textbox|input).*$/iu, '')
    .trim();
  if (
    !cleanedValue
    || isAgentSessionV2LikelyUiFieldLabelValue(cleanedValue)
    || /^(?:\u5230|\u8fdb\u5165)?\s*.*(?:\u8f93\u5165\u6846|\u6587\u672c\u6846|\u641c\u7d22\u6846|field|textbox|input)\s*$/iu.test(cleanedValue)
  ) {
    return '';
  }

  return cleanedValue;
}

function isAgentSessionV2WindowUiSetValueIntentWithoutValue(options: {
  evidence: AgentStructuredToolEvidence | null;
  sourceText: string;
  userGoal: string;
}) {
  const intentText = [
    options.sourceText,
    options.userGoal,
    options.evidence?.primaryAction,
    options.evidence?.elementDescription,
    options.evidence?.elementRegion,
    options.evidence?.targetMatched,
  ].filter(Boolean).join(' ').normalize('NFKC').toLowerCase();
  if (!/(?:\u8f93\u5165|\u586b\u5199|\u586b\u5165|\u952e\u5165|杈撳叆|濉啓|濉叆|閿叆|鏉堟挸鍙唡婵夘偄鍟搢婵夘偄鍙唡闁款喖鍙唡鐠佸墽鐤嗘稉绨楃拋鍙ヨ礋|閺€瑙勫灇|閺€閫涜礋|enter|type|fill(?:\s+in)?|set(?:\s+(?:value|text))?\s+(?:to|in)|change\s+to)/iu.test(intentText)) {
    return false;
  }

  const candidates = [
    ...(options.evidence?.actionCandidates ?? []),
    ...(options.evidence?.targetCandidates ?? []),
  ];
  const hasEditableEvidence = candidates.some((candidate) => isAgentSessionV2EditableUiCandidate(candidate));
  if (!hasEditableEvidence) {
    return false;
  }

  return !extractAgentSessionV2WindowUiSetValueText(options.sourceText, options.userGoal);
}

function hasAgentSessionV2WindowUiTextEntryIntent(...values: string[]) {
  const text = values
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .normalize('NFKC')
    .toLowerCase();
  return /(?:\u8f93\u5165|\u586b\u5199|\u586b\u5165|\u952e\u5165|\u641c\u7d22|杈撳叆|濉啓|濉叆|閿叆|悳绱|enter|type|fill(?:\s+in)?|search|find)/iu.test(text);
}

function inferAgentSessionV2KeyboardSubmitKey(...values: string[]) {
  const text = values
    .filter((value) => typeof value === 'string' && value.trim())
    .join('\n')
    .normalize('NFKC')
    .toLowerCase();
  if (/(?:space|缁岀儤鐗?)/iu.test(text)) {
    return 'Space';
  }
  if (/(?:enter|return|\u56de\u8f66|\u63d0\u4ea4|\u786e\u8ba4|鍥炶溅|鎻愪氦|纭|閸ョ偠婧厊绾喛顓粅閹绘劒姘閹兼粎鍌▅閺屻儲澹榺閹垫挸绱憒閸氼垰濮?)/iu.test(text)) {
    return 'Enter';
  }

  return '';
}

function scoreAgentSessionV2InvokableUiCandidate(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  candidateKind: 'action' | 'target';
  evidence: AgentStructuredToolEvidence | null;
  index: number;
  sourceText?: string;
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
  userGoal?: string;
}) {
  if (!isAgentSessionV2InvokableUiCandidate(options.candidate)) {
    return null;
  }

  if (isAgentSessionV2SameUnverifiedWindowUiCandidate({
    candidate: options.candidate,
    evidence: options.evidence,
    toolResults: options.toolResults,
  })) {
    return null;
  }

  const point = resolveAgentSessionV2CandidateScreenPoint(options.candidate, options.evidence);
  const previousPoints = getAgentSessionV2PreviousUnverifiedActionPoints(options.toolResults);
  const previousWindowUiSignatureKeys = getAgentSessionV2PreviousUnverifiedWindowUiSignatureKeys(options.toolResults);
  const candidateWindowUiSignatureKeys = getAgentSessionV2CandidateWindowUiSignatureKeys(
    options.candidate,
    options.evidence,
  );
  let score = 100 + getAgentSessionV2CandidateConfidenceScore(options.candidate.confidence) - options.index;
  if (options.candidateKind === 'action') {
    score += 25;
  }
  if (options.candidate.automationId?.trim()) {
    score += 18;
  }
  if (options.candidate.controlType?.trim()) {
    score += 10;
  }
  score += getAgentSessionV2CandidateUiActions(options.candidate).length * 12;
  if (options.candidate.source === 'ui-automation') {
    score += 14;
  }
  if (options.candidate.window?.hwnd || options.candidate.window?.title || options.candidate.window?.processName) {
    score += 8;
  }
  if (options.sourceText || options.userGoal) {
    score += getAgentSessionV2CandidateTextRelevanceScore({
      candidate: options.candidate,
      evidence: options.evidence,
      sourceText: options.sourceText ?? '',
      userGoal: options.userGoal ?? '',
    });
  }
  score += getAgentSessionV2CandidateCrossSourceAgreementScore({
    candidate: options.candidate,
    evidence: options.evidence,
  });
  if (point && isAgentSessionV2NearPreviousActionPoint(point, previousPoints)) {
    score -= 40;
  }
  if (
    previousWindowUiSignatureKeys.length
    && candidateWindowUiSignatureKeys.some((key) => previousWindowUiSignatureKeys.includes(key))
  ) {
    score -= 95;
  }

  return {
    candidate: options.candidate,
    point,
    score,
  };
}

function resolveAgentSessionV2InvokableUiCandidate(options: {
  evidence: AgentStructuredToolEvidence | null;
  sourceText?: string;
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
  userGoal?: string;
}) {
  const actionCandidates = Array.isArray(options.evidence?.actionCandidates)
    ? options.evidence.actionCandidates
    : [];
  const targetCandidates = Array.isArray(options.evidence?.targetCandidates)
    ? options.evidence.targetCandidates
    : [];
  return [
    ...actionCandidates.map((candidate, index) => scoreAgentSessionV2InvokableUiCandidate({
      candidate,
      candidateKind: 'action' as const,
      evidence: options.evidence,
      index,
      sourceText: options.sourceText,
      toolResults: options.toolResults,
      userGoal: options.userGoal,
    })),
    ...targetCandidates.map((candidate, index) => scoreAgentSessionV2InvokableUiCandidate({
      candidate,
      candidateKind: 'target' as const,
      evidence: options.evidence,
      index,
      sourceText: options.sourceText,
      toolResults: options.toolResults,
      userGoal: options.userGoal,
    })),
  ]
    .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null)
    .sort((a, b) => b.score - a.score)
    .at(0)
    ?? findAgentSessionV2HistoricalInvokableUiCandidateForVisualEvidence({
      evidence: options.evidence,
      sourceText: options.sourceText ?? '',
      toolResults: options.toolResults,
      userGoal: options.userGoal ?? '',
    });
}

function hasAgentSessionV2ClearInvokableUiCandidateEvidence(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  evidence: AgentStructuredToolEvidence | null;
  sourceText: string;
  userGoal: string;
}) {
  if (!isAgentSessionV2InvokableUiCandidate(options.candidate)) {
    return false;
  }

  const readiness = options.evidence?.visualActionReadiness ?? null;
  if (readiness && readiness !== 'ready') {
    return false;
  }
  if (isAgentSessionV2LauncherVerificationBlocking(options.evidence)) {
    return false;
  }

  if (options.candidate.confidence === 'low' || options.evidence?.confidence === 'low') {
    return false;
  }

  const hasSelectorEvidence = Boolean(
    options.candidate.automationId?.trim()
      || options.candidate.name?.trim()
      || options.candidate.label?.trim()
      || options.candidate.controlType?.trim()
  );
  if (!hasSelectorEvidence) {
    return false;
  }

  const relevanceScore = getAgentSessionV2CandidateTextRelevanceScore({
    candidate: options.candidate,
    evidence: options.evidence,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  const candidateActions = getAgentSessionV2CandidateUiActions(options.candidate);
  const hasTargetSelfActionEvidence = candidateActions.some((action) => (
    action === 'scroll-into-view'
    || action === 'focus'
    || action === 'select'
    || action === 'value'
  )) && (
    relevanceScore > 0
    || options.evidence?.targetMatched?.trim()
    || options.candidate.confidence === 'high'
  );
  return Boolean(
    relevanceScore > 0
      || options.evidence?.targetMatched?.trim()
      || isAgentSessionV2UsefulPrimaryAction(options.evidence?.primaryAction)
      || options.candidate.confidence === 'high'
  ) && (
    hasTargetSelfActionEvidence
    || candidateActions.includes('scroll-into-view')
    || candidateActions.includes('focus')
    || hasAgentSessionV2VerifiedPrimaryActionOwnership({
      candidate: options.candidate,
      evidence: options.evidence,
    })
    || hasAgentSessionV2CandidateTextOwnedActionEvidence(options)
  );
}

function resolveAgentSessionV2VisualPostVerifyQuery(
  evidence: AgentStructuredToolEvidence | null,
  sourceText: string,
  userGoal: string,
) {
  const candidates = [
    evidence?.targetMatched,
    evidence?.primaryAction,
    evidence?.elementDescription,
    sourceText,
    userGoal,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return '';
}

function createAgentSessionV2VisualInputSequenceCommand(options: {
  entry: AgentSessionV2ToolResultEntry;
  evidence?: AgentStructuredToolEvidence | null;
  forceLoginContinuationInput?: boolean;
  inputAction?: AgentVisualInputFallbackMode;
  point: { x: number; y: number };
  sourceText: string;
  userGoal: string;
}) {
  const evidence = options.evidence ?? getAgentStructuredEvidence(options.entry);
  const targetText = evidence?.targetMatched?.trim() || 'visual target';
  const primaryActionText = evidence?.primaryAction?.trim() || 'primary action';
  const inputAction = options.inputAction ?? 'click';
  const isLoginControl = isAgentSessionV2LoginControlEvidence(evidence);
  const targetWindowHwnd = Number(evidence?.finalWindow?.hwnd);
  const targetWindowPid = Number(evidence?.finalWindow?.pid);
  const targetWindowIdentity = {
    ...(Number.isFinite(targetWindowHwnd) && targetWindowHwnd > 0
      ? { expectedForegroundHwnd: Math.round(targetWindowHwnd) }
      : {}),
    ...(Number.isFinite(targetWindowPid) && targetWindowPid > 0
      ? { expectedForegroundPid: Math.round(targetWindowPid) }
      : {}),
  };
  const inputSteps: Array<{ args: Record<string, unknown>; reason: string; tool: 'execute_desktop_input' }> = inputAction === 'click_then_enter' || inputAction === 'click_then_space'
    ? [
        {
          args: {
            action: 'click',
            button: 'left',
            ...targetWindowIdentity,
            x: options.point.x,
            y: options.point.y,
          },
          reason: createAgentVisualInputStepReason({
            action: 'click',
            inputAction,
            point: options.point,
            primaryActionText,
            targetText,
          }),
          tool: 'execute_desktop_input',
        },
        {
          args: {
            action: 'hotkey',
            hotkey: inputAction === 'click_then_space' ? 'Space' : 'Enter',
          },
          reason: createAgentVisualInputStepReason({
            action: 'confirm',
            inputAction,
            keyName: inputAction === 'click_then_space' ? 'Space' : 'Enter',
            point: options.point,
            primaryActionText,
            targetText,
          }),
          tool: 'execute_desktop_input',
        },
      ]
    : [
        {
          args: {
            action: inputAction,
            button: 'left',
            ...targetWindowIdentity,
            ...(options.forceLoginContinuationInput ? {
              coordinateSpace: 'native-screen',
              forceMouseEventFallback: true,
              holdMs: 140,
              intervalMs: 160,
              preClickDelayMs: 180,
              repeat: 1,
            } : {}),
            x: options.point.x,
            y: options.point.y,
          },
          reason: createAgentVisualInputStepReason({
            action: 'single_input',
            inputAction,
            point: options.point,
            primaryActionText,
            targetText,
          }),
          tool: 'execute_desktop_input',
        },
      ];
  if (options.forceLoginContinuationInput && inputAction === 'click') {
    inputSteps.push({
      args: {
        action: 'send_keys',
        keys: '{ENTER}',
      },
      reason: 'Fallback: send Enter after login continuation click in case the launcher button accepted focus but ignored synthetic mouse-up.',
      tool: 'execute_desktop_input',
    });
  }
  const steps: Array<{
    args: Record<string, unknown>;
    reason: string;
    tool: 'execute_desktop_action' | 'execute_desktop_input';
  }> = targetWindowHwnd > 0
    ? [
        {
          args: {
            action: 'focus_window',
            hwnd: Math.round(targetWindowHwnd),
            ...(targetWindowPid > 0 ? { pid: Math.round(targetWindowPid) } : {}),
          },
          reason: `Focus the live target window before dispatching the visual input at (${options.point.x}, ${options.point.y}).`,
          tool: 'execute_desktop_action',
        },
        ...inputSteps,
      ]
    : inputSteps;
  return createAgentToolCommand({
    actionScope: {
      completion: options.forceLoginContinuationInput ? 'intermediate' : 'terminal',
      subgoalId: createAgentSubgoalId({
        completion: options.forceLoginContinuationInput ? 'intermediate' : 'terminal',
        targetRef: targetText,
      }),
      targetRef: targetText,
    },
    args: {
      postVerifyRequired: true,
      postVerifyQuery: isLoginControl
        ? `Verify authentication after activating "${primaryActionText}" for "${targetText}": determine whether the login overlay remains, the application main interface is visible, or manual verification is required.`
        : resolveAgentSessionV2VisualPostVerifyQuery(evidence, options.sourceText, options.userGoal),
      postVerifyVisualQuery: isLoginControl
        ? `Verify authentication after activating "${primaryActionText}" for "${targetText}": determine whether the login overlay remains, the application main interface is visible, or manual verification is required.`
        : resolveAgentSessionV2VisualPostVerifyQuery(evidence, options.sourceText, options.userGoal),
      stepsJson: JSON.stringify(steps),
    },
    sourceText: options.sourceText,
    toolName: 'execute_desktop_sequence',
    userGoal: options.userGoal,
  });
}

function createAgentSessionV2TargetSelectionPostVerifyQuery(
  evidence: AgentStructuredToolEvidence | null,
  sourceText: string,
  userGoal: string,
) {
  const targetText = evidence?.targetMatched?.trim()
    || resolveAgentSessionV2VisualPostVerifyQuery(evidence, sourceText, userGoal)
    || 'the requested target';
  return [
    `Verify whether "${targetText}" is now the current selected/detail item.`,
    'Return selectionVerificationStatus as selected, visible-only, mismatch, or unknown.',
    'Do not treat the target merely being visible as selected/current.',
    'If selected/current is confirmed, then locate the associated primary open/start/play action; otherwise report the current selected/detail item and missing evidence.',
  ].join(' ');
}

function resolveAgentSessionV2TargetSelectionCandidate(options: {
  evidence: AgentStructuredToolEvidence | null;
  sourceText: string;
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
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

function createAgentSessionV2TargetSelectionSequenceCommand(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  entry: AgentSessionV2ToolResultEntry;
  point?: { x: number; y: number } | null;
  sourceText: string;
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
  userGoal: string;
}) {
  const evidence = getAgentStructuredEvidence(options.entry);
  const targetText = options.candidate.name?.trim()
    || options.candidate.label?.trim()
    || evidence?.targetMatched?.trim()
    || 'target item';
  const query = options.candidate.window?.title?.trim()
    || options.candidate.window?.processName?.trim()
    || (typeof options.entry.command.toolCall?.input?.query === 'string' ? options.entry.command.toolCall.input.query.trim() : '')
    || (typeof options.entry.command.toolCall?.input?.sourceQuery === 'string' ? options.entry.command.toolCall.input.sourceQuery.trim() : '');
  const hwnd = Number(options.candidate.window?.hwnd);
  const candidateActions = getAgentSessionV2CandidateUiActions(options.candidate);
  const repeatedFailedCandidate = hasAgentSessionV2SameRetryAvoidanceWindowUiCandidate({
    candidate: options.candidate,
    evidence,
    toolResults: options.toolResults,
  });
  const alternateUiAction = repeatedFailedCandidate && candidateActions.includes('scroll-into-view')
    ? 'scroll_into_view'
    : repeatedFailedCandidate && candidateActions.includes('focus')
      ? 'focus'
      : '';
  const supportsSelect = candidateActions.includes('select');
  const effectiveUiAction = alternateUiAction || (supportsSelect ? 'select' : '');
  const steps: Array<{ args: Record<string, unknown>; reason: string; tool: AgentToolCallName }> = effectiveUiAction
    ? [
        {
          args: {
            action: 'interact_window_ui',
            uiAction: effectiveUiAction,
            ...(options.candidate.automationId?.trim() ? { automationId: options.candidate.automationId.trim() } : {}),
            ...(options.candidate.controlType?.trim() ? { controlType: options.candidate.controlType.trim() } : {}),
            ...(Number.isFinite(hwnd) && hwnd > 0 ? { hwnd: Math.round(hwnd) } : {}),
            ...(query ? { query } : {}),
            ...(options.point ? { fallbackX: options.point.x, fallbackY: options.point.y, x: options.point.x, y: options.point.y } : {}),
            targetDescription: [
              options.candidate.description?.trim(),
              evidence?.relation?.trim(),
              'Selection recovery: select the target item before looking for its primary action.',
            ].filter(Boolean).join(' | '),
            targetText,
          },
          reason: createAgentTargetSelectionUiAutomationStepReason({
            alternateUiAction,
            targetText,
          }),
          tool: 'execute_desktop_action',
        },
      ]
    : options.point
      ? [
          {
            args: {
              action: 'click',
              button: 'left',
              x: options.point.x,
              y: options.point.y,
            },
            reason: createAgentTargetSelectionCoordinateStepReason({ targetText }),
            tool: 'execute_desktop_input',
          },
        ]
      : [];
  if (!steps.length) {
    return null;
  }

  const postVerifyQuery = createAgentSessionV2TargetSelectionPostVerifyQuery(
    evidence,
    options.sourceText,
    options.userGoal,
  );
  return createAgentToolCommand({
    actionScope: {
      completion: 'intermediate',
      subgoalId: createAgentSubgoalId({
        completion: 'intermediate',
        targetRef: targetText,
      }),
      targetRef: targetText,
    },
    args: {
      postVerifyQuery,
      postVerifyVisualQuery: postVerifyQuery,
      stepsJson: JSON.stringify(steps),
      stopOnError: true,
    },
    sourceText: options.sourceText,
    toolName: 'execute_desktop_sequence',
    userGoal: options.userGoal,
  });
}

function resolveAgentSessionV2TargetSelectionApproval(options: {
  command: AgentChatCommand;
  result: AgentChatCommandResult;
  sourceText: string;
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
  userGoal: string;
}): AgentSessionV2PendingApproval | null {
  if (!hasAgentDirectActionIntent(options.sourceText, options.userGoal) || options.result.ok === false) {
    return null;
  }

  const entry: AgentSessionV2ToolResultEntry = {
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

  const selectionCandidate = resolveAgentSessionV2TargetSelectionCandidate({
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

function createAgentSessionV2VisualInvokeSequenceCommand(options: {
  candidate: AgentStructuredToolCandidateEvidence;
  entry: AgentSessionV2ToolResultEntry;
  point?: { x: number; y: number } | null;
  sourceText: string;
  userGoal: string;
}) {
  const evidence = getAgentStructuredEvidence(options.entry);
  const targetText = options.candidate.name?.trim()
    || options.candidate.label?.trim()
    || evidence?.primaryAction?.trim()
    || evidence?.targetMatched?.trim()
    || 'UI control';
  const query = options.candidate.window?.title?.trim()
    || options.candidate.window?.processName?.trim()
    || (typeof options.entry.command.toolCall?.input?.query === 'string' ? options.entry.command.toolCall.input.query.trim() : '')
    || (typeof options.entry.command.toolCall?.input?.sourceQuery === 'string' ? options.entry.command.toolCall.input.sourceQuery.trim() : '');
  const hwnd = Number(options.candidate.window?.hwnd);
  const uiAction = inferAgentSessionV2WindowUiAction(
    options.candidate,
    evidence,
    options.sourceText,
    options.userGoal,
  );
  const setValueText = uiAction === 'set_value'
    ? extractAgentSessionV2WindowUiSetValueText(options.sourceText, options.userGoal)
    : '';
  if (uiAction === 'set_value' && !setValueText) {
    return null;
  }
  const focusText = uiAction === 'focus' && hasAgentSessionV2WindowUiTextEntryIntent(options.sourceText, options.userGoal)
    ? extractAgentSessionV2WindowUiSetValueText(options.sourceText, options.userGoal)
    : '';
  const submitKey = focusText ? inferAgentSessionV2KeyboardSubmitKey(options.sourceText, options.userGoal) : '';
  const isIntermediateContinuation = hasAgentSessionV2SafeLoginContinuationApprovalEvidence({
    evidence,
    result: options.entry.result,
  });
  const windowUiStep = {
    args: {
      action: 'interact_window_ui',
      uiAction,
      ...(options.candidate.automationId?.trim() ? { automationId: options.candidate.automationId.trim() } : {}),
      ...(options.candidate.controlType?.trim() ? { controlType: options.candidate.controlType.trim() } : {}),
      ...(Number.isFinite(hwnd) && hwnd > 0 ? { hwnd: Math.round(hwnd) } : {}),
      ...(query ? { query } : {}),
      ...(setValueText ? { value: setValueText } : {}),
      ...(options.point ? { fallbackX: options.point.x, fallbackY: options.point.y, x: options.point.x, y: options.point.y } : {}),
      targetDescription: [
        options.candidate.description?.trim(),
        evidence?.relation?.trim(),
      ].filter(Boolean).join(' | '),
      targetText,
    },
    reason: createAgentVisualInvokeWindowUiStepReason({
      targetText,
      uiAction,
    }),
    tool: 'execute_desktop_action',
  };
  const steps = [
    windowUiStep,
    ...(focusText
      ? [
          {
            args: {
              action: 'type_text',
              text: focusText,
            },
            reason: createAgentVisualInvokeTextInputStepReason({ targetText }),
            tool: 'execute_desktop_input',
          },
        ]
      : []),
    ...(submitKey
      ? [
          {
            args: {
              action: 'hotkey',
              hotkey: submitKey,
            },
            reason: createAgentVisualInvokeSubmitStepReason({
              submitKey,
              targetText,
            }),
            tool: 'execute_desktop_input',
          },
        ]
      : []),
  ];

  return createAgentToolCommand({
    actionScope: {
      completion: isIntermediateContinuation ? 'intermediate' : 'terminal',
      subgoalId: createAgentSubgoalId({
        completion: isIntermediateContinuation ? 'intermediate' : 'terminal',
        targetRef: targetText,
      }),
      targetRef: targetText,
    },
    args: {
      postVerifyQuery: resolveAgentSessionV2VisualPostVerifyQuery(
        evidence,
        options.sourceText,
        options.userGoal,
      ),
      postVerifyVisualQuery: resolveAgentSessionV2VisualPostVerifyQuery(
        evidence,
        options.sourceText,
        options.userGoal,
      ),
      stepsJson: JSON.stringify(steps),
    },
    sourceText: options.sourceText,
    toolName: 'execute_desktop_sequence',
    userGoal: options.userGoal,
  });
}

function isAgentSessionV2WindowUiCoordinateFallbackEvidence(entry: AgentSessionV2ToolResultEntry) {
  if (entry.result.ok !== false) {
    return false;
  }

  const toolName = entry.command.toolCall?.name ?? '';
  const action = getAgentSessionV2ToolInputAction(entry.command);
  const input = entry.command.toolCall?.input ?? {};
  const sequenceText = typeof input.stepsJson === 'string' ? input.stepsJson : '';
  const isWindowUiAction = (
    toolName === 'execute_desktop_action'
    && (action === 'interact_window_ui' || action === 'invoke_window_ui')
  ) || (
    toolName === 'execute_desktop_sequence'
    && /"action"\s*:\s*"(?:interact_window_ui|invoke_window_ui)"/u.test(sequenceText)
  );
  if (!isWindowUiAction) {
    return false;
  }

  const evidence = getAgentStructuredEvidence(entry);
  if (
    evidence?.visualActionReadiness !== 'ready'
    || evidence.postActionRecovery?.nextTool !== 'execute_desktop_input'
    || evidence.confidence === 'low'
    || isAgentSessionV2LauncherVerificationBlocking(evidence)
    || !evidence.targetMatched
    || !isAgentSessionV2UsefulPrimaryAction(evidence.primaryAction)
  ) {
    return false;
  }

  return Boolean(resolveAgentSessionV2VisualActionApprovalPoint({
    evidence,
    toolResults: [entry],
  }));
}

function shouldUseAgentSessionV2DoubleClickFallback(options: {
  evidence: AgentStructuredToolEvidence | null;
  point: { x: number; y: number };
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
}) {
  if (
    options.evidence?.visualActionReadiness !== 'ready'
    || options.evidence.confidence === 'low'
    || isAgentSessionV2LauncherVerificationBlocking(options.evidence)
  ) {
    return false;
  }

  const previousAttempt = findLatestAgentSessionV2RecoverableUnverifiedActionAttempt(options.toolResults ?? []);
  if (
    !previousAttempt
    || getAgentPostActionState(previousAttempt) !== 'unchanged'
  ) {
    return false;
  }

  const previousActions = getAgentSessionV2CommandDesktopInputActions(previousAttempt.command);
  if (!previousActions.includes('click') || previousActions.includes('double_click')) {
    return false;
  }

  const previousPoints = getAgentSessionV2CommandClickPoints(previousAttempt.command);
  return isAgentSessionV2NearPreviousActionPoint(options.point, previousPoints);
}

function shouldUseAgentSessionV2KeyboardConfirmFallback(options: {
  evidence: AgentStructuredToolEvidence | null;
  point: { x: number; y: number };
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
}) {
  if (
    options.evidence?.visualActionReadiness !== 'ready'
    || options.evidence.confidence === 'low'
    || isAgentSessionV2LauncherVerificationBlocking(options.evidence)
  ) {
    return false;
  }

  if (!hasAgentSessionV2KeyboardConfirmEvidence(options.evidence)) {
    return false;
  }

  const previousAttempt = findLatestAgentSessionV2RecoverableUnverifiedActionAttempt(options.toolResults ?? []);
  if (
    !previousAttempt
    || getAgentPostActionState(previousAttempt) !== 'unchanged'
  ) {
    return false;
  }

  const previousActions = getAgentSessionV2CommandDesktopInputActions(previousAttempt.command);
  if (!previousActions.includes('double_click') || previousActions.includes('hotkey')) {
    return false;
  }

  const previousPoints = getAgentSessionV2CommandClickPoints(previousAttempt.command);
  return isAgentSessionV2NearPreviousActionPoint(options.point, previousPoints);
}

function hasAgentSessionV2KeyboardConfirmEvidence(evidence: AgentStructuredToolEvidence | null) {
  const candidates = [
    ...(evidence?.actionCandidates ?? []),
    ...(evidence?.targetCandidates ?? []),
  ];
  if (!candidates.length) {
    return true;
  }

  const candidatesWithExplicitKeyboardState = candidates.filter((candidate) => (
    typeof candidate.enabled === 'boolean'
    || typeof candidate.keyboardFocusable === 'boolean'
    || typeof candidate.hasKeyboardFocus === 'boolean'
    || typeof candidate.offscreen === 'boolean'
  ));
  if (!candidatesWithExplicitKeyboardState.length) {
    return true;
  }

  return candidatesWithExplicitKeyboardState.some((candidate) => (
    candidate.enabled !== false
    && candidate.offscreen !== true
    && (candidate.hasKeyboardFocus === true || candidate.keyboardFocusable === true)
  ));
}

function inferAgentSessionV2KeyboardConfirmInputAction(
  evidence: AgentStructuredToolEvidence | null,
): Extract<AgentVisualInputFallbackMode, 'click_then_enter' | 'click_then_space'> {
  const text = [
    evidence?.primaryAction,
    evidence?.elementDescription,
    evidence?.elementRegion,
    evidence?.targetMatched,
    ...(evidence?.actionCandidates ?? []).flatMap((candidate) => [
      candidate.controlType,
      candidate.label,
      candidate.description,
      ...(candidate.actions ?? []),
    ]),
    ...(evidence?.targetCandidates ?? []).flatMap((candidate) => [
      candidate.controlType,
      candidate.label,
      candidate.description,
      ...(candidate.actions ?? []),
    ]),
  ].filter(Boolean).join(' ').toLowerCase();

  return /(?:checkbox|radio\s*button|radiobutton|toggle|check|uncheck|閸曢箖鈧閸欐牗绉烽崟楣冣偓澧婇崚鍥ㄥ床)/iu.test(text)
    ? 'click_then_space'
    : 'click_then_enter';
}

const AGENT_SESSION_V2_BATCHABLE_SEQUENCE_TOOL_NAMES = new Set<AgentToolCallName>([
  'execute_desktop_action',
  'execute_desktop_input',
]);

function resolveAgentSessionV2ParallelApprovalBatchPostVerifyQuery(
  tools: AgentSessionV2ParallelToolCall[],
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

function createAgentSessionV2ParallelApprovalBatch(options: {
  reason?: string | null;
  sourceText: string;
  tools: AgentSessionV2ParallelToolCall[];
  userGoal: string;
}): AgentSessionV2PendingApproval | null {
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
      || !AGENT_SESSION_V2_BATCHABLE_SEQUENCE_TOOL_NAMES.has(toolName)
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

  const postVerifyQuery = resolveAgentSessionV2ParallelApprovalBatchPostVerifyQuery(
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

function resolveAgentSessionV2VisualActionApproval(options: {
  command: AgentChatCommand;
  result: AgentChatCommandResult;
  sourceText: string;
  toolResults?: AgentSessionV2ToolResultEntry[] | null;
  userGoal: string;
}): AgentSessionV2PendingApproval | null {
  if (!hasAgentDirectActionIntent(options.sourceText, options.userGoal)) {
    return null;
  }

  const entry: AgentSessionV2ToolResultEntry = {
    command: options.command,
    result: options.result,
  };
  const sourceEvidence = getAgentStructuredEvidence(entry);
  const sourceToolName = options.command.toolCall?.name ?? null;
  const sourceAction = getAgentSessionV2ToolInputAction(options.command);
  const hasExplicitWaitObservationUiCandidate = sourceAction === 'wait_and_observe'
    && [
      ...(sourceEvidence?.actionCandidates ?? []),
      ...(sourceEvidence?.targetCandidates ?? []),
    ].some((candidate) => (
      candidate.source === 'ui-automation'
      && Boolean(candidate.window?.hwnd)
      && isAgentSessionV2InvokableUiCandidate(candidate)
    ));
  const isTrustedVisualActionSource = sourceToolName === 'locate_screen_elements'
    || isAgentSessionV2VisualToolCommand(options.command)
    || (
      sourceToolName === 'execute_desktop_observation'
      && (
        sourceAction === 'summarize_visual_snapshot'
        || sourceAction === 'inspect_window_ui'
        || hasExplicitWaitObservationUiCandidate
      )
    )
    || isAgentSessionV2WindowUiCoordinateFallbackEvidence(entry);
  if (!isTrustedVisualActionSource) {
    return null;
  }

  const targetSelectionApproval = resolveAgentSessionV2TargetSelectionApproval({
    command: options.command,
    result: options.result,
    sourceText: options.sourceText,
    toolResults: options.toolResults,
    userGoal: options.userGoal,
  });
  if (targetSelectionApproval) {
    return targetSelectionApproval;
  }

  const coordinateFallbackAfterWindowUiFailure = isAgentSessionV2WindowUiCoordinateFallbackEvidence(entry);
  if (options.result.ok === false && !coordinateFallbackAfterWindowUiFailure) {
    return null;
  }

  const evidence = createAgentSessionV2EffectiveVisualActionEvidence(
    sourceEvidence,
  );
  const isLoginControl = isAgentSessionV2LoginControlEvidence(evidence);
  const invokableUiCandidate = resolveAgentSessionV2InvokableUiCandidate({
    evidence,
    sourceText: options.sourceText,
    toolResults: options.toolResults,
    userGoal: options.userGoal,
  });
  const currentEvidenceIsSafeLoginControl = Boolean(
    hasAgentSessionV2SafeLoginContinuationApprovalEvidence({
      evidence,
      result: options.result,
    }),
  );
  const currentVisualEvidenceIsApproximate = hasAgentSessionV2ApproximateVisualEvidence(options.result);
  const refinementSampleCount = (options.toolResults ?? []).filter((historyEntry) => (
    historyEntry.result.ok !== false
      && historyEntry.command.toolCall?.name === 'locate_screen_elements'
      && typeof historyEntry.command.toolCall.input.question === 'string'
      && historyEntry.command.toolCall.input.question.includes('AgentSessionV2 visual refinement')
  )).length;
  const visualLocateNeedsStableReview = sourceToolName === 'locate_screen_elements'
    && !invokableUiCandidate
    && (
      evidence?.confidence !== 'high'
      || evidence.coordinateConfidence !== 'high'
      || typeof options.command.toolCall?.input.question === 'string'
        && options.command.toolCall.input.question.includes('AgentSessionV2 visual refinement')
      || currentEvidenceIsSafeLoginControl
      || currentVisualEvidenceIsApproximate
      || isAgentSessionV2LauncherVerificationBlocking(evidence)
    );
  // The focused crop itself is the second sample. Do not demand another crop
  // merely because its question contains the refinement marker; only a real
  // disagreement may consume the bounded third sample.
  const requiresAnotherVisualSample = visualLocateNeedsStableReview
    && refinementSampleCount < 2;
  if (visualLocateNeedsStableReview) {
    const previousVisualEntries = [...(options.toolResults ?? [])]
      .reverse()
      .filter((historyEntry) => (
        historyEntry.command !== options.command
        && historyEntry.result.ok !== false
        && (historyEntry.command.toolCall?.name === 'locate_screen_elements'
          || isAgentSessionV2VisualToolCommand(historyEntry.command)
          || historyEntry.command.toolCall?.name === 'execute_desktop_observation'
            && getAgentSessionV2ToolInputAction(historyEntry.command) === 'inspect_window_ui')
        && Boolean(getAgentStructuredEvidence(historyEntry)?.elementCenter
          || getAgentStructuredEvidence(historyEntry)?.elementCenterRatio
          || getAgentStructuredEvidence(historyEntry)?.elementBounds
          || getAgentStructuredEvidence(historyEntry)?.actionCandidates?.some((candidate) => (
            Boolean(candidate.center || candidate.centerRatio || candidate.bounds)
          )))
      ))
      .slice(0, 3);
    const visualConsensus = evaluateAgentVisualSampleConsensus({
      command: options.command,
      // The current result is fresh. Keep at most two earlier independent
      // observations, yielding a bounded two-of-three confirmation policy.
      samples: [
        ...previousVisualEntries.reverse().map(getAgentStructuredEvidence),
        evidence,
      ],
    });
    if (visualConsensus.status !== 'passed' && requiresAnotherVisualSample) {
      return null;
    }
  }

  // The newest locate result owns the click candidate. Do not resurrect a
  // coordinate from an older unverified attempt when the current crop is not
  // actionable or its coordinate audit is unknown.
  const currentLocateRejectsHistoricalPoint = sourceToolName === 'locate_screen_elements'
    && !invokableUiCandidate
    && (
      evidence?.visualActionReadiness !== 'ready'
      || evidence?.coordinateAuditStatus === 'coordinate_unknown'
      || evidence?.coordinateAudit?.status === 'coordinate_unknown'
      || !isAgentSessionV2UsefulPrimaryAction(evidence?.primaryAction)
      || evidence?.targetMatched === null
      || evidence?.targetMatched === undefined
    );
  if (currentLocateRejectsHistoricalPoint) {
    return null;
  }

  const point = resolveAgentSessionV2VisualActionApprovalPoint({
    evidence,
    toolResults: options.toolResults,
  });
  if (!point && !invokableUiCandidate) {
    return null;
  }
  if (
    point
    && !invokableUiCandidate
    && !hasAgentSessionV2PointInsideActionableArea(evidence, point)
  ) {
    return null;
  }

  const hasClearTopLevelEvidence = hasAgentSessionV2ClearActionableVisualEvidence(entry);
  const hasClearInvokableUiCandidateEvidence = Boolean(
    invokableUiCandidate
      && hasAgentSessionV2ClearInvokableUiCandidateEvidence({
        candidate: invokableUiCandidate.candidate,
        evidence,
        sourceText: options.sourceText,
        userGoal: options.userGoal,
      }),
  );
  const hasSafeLoginContinuationEvidence = Boolean(
    point
      && hasAgentSessionV2SafeLoginContinuationApprovalEvidence({
        evidence,
        result: options.result,
      }),
  );
  const requiresWindowBoundVisualInput = Boolean(
    evidence?.postActionState === 'login_required'
      || hasSafeLoginContinuationEvidence,
  );
  if (requiresWindowBoundVisualInput && evidence?.captureSourceType !== 'window') {
    return null;
  }
  if (
    requiresWindowBoundVisualInput
    && (!Number.isFinite(Number(evidence?.finalWindow?.hwnd)) || Number(evidence?.finalWindow?.hwnd) <= 0)
  ) {
    return null;
  }
  const hasExplicitSafeLoginControl = Boolean(
    evidence?.postActionState === 'login_required'
      && /(?:login|log\s*in|sign\s*in|continue|confirm|submit|\u767b\u5f55|\u767b\u9646|\u7ee7\u7eed|\u786e\u8ba4|\u63d0\u4ea4)/iu.test([
        evidence.primaryAction,
        evidence.targetMatched,
        ...((evidence.actionCandidates ?? []).flatMap((candidate) => [
          candidate.label,
          candidate.name,
          candidate.description,
        ])),
      ].filter(Boolean).join('\n'))
      && !hasAgentAuthenticationHardGateCue(
        collectAgentSessionV2VisualApprovalResultText(options.result),
      ),
  );
  if (isAgentSessionV2LauncherVerificationBlocking(evidence)) {
    if (!hasSafeLoginContinuationEvidence) {
      return null;
    }
  }

  const hasClearCandidateEvidence = Boolean(
    evidence?.visualActionReadiness === 'ready'
      && (
        (
          evidence.targetMatched
          && isAgentSessionV2UsefulPrimaryAction(evidence.primaryAction)
        )
        || hasClearInvokableUiCandidateEvidence
      )
      && evidence.confidence !== 'low'
      && (evidence.coordinateConfidence !== 'low' || Boolean(invokableUiCandidate)),
  );
  if (
    !hasClearTopLevelEvidence
    && !hasClearCandidateEvidence
    && !hasClearInvokableUiCandidateEvidence
    && !hasSafeLoginContinuationEvidence
  ) {
    return null;
  }

  const invokableUiAction = invokableUiCandidate
    ? inferAgentSessionV2WindowUiAction(
        invokableUiCandidate.candidate,
        evidence,
        options.sourceText,
        options.userGoal,
      )
    : '';
  if (invokableUiAction !== 'focus' && isAgentSessionV2WindowUiSetValueIntentWithoutValue({
    evidence,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  })) {
    return null;
  }

  if (invokableUiCandidate && hasClearInvokableUiCandidateEvidence && !coordinateFallbackAfterWindowUiFailure) {
    const command = createAgentSessionV2VisualInvokeSequenceCommand({
      candidate: invokableUiCandidate.candidate,
      entry,
      point: invokableUiCandidate.point ?? point,
      sourceText: options.sourceText,
      userGoal: options.userGoal,
    });
    if (!command) {
      return null;
    }

    const route = buildAgentPermissionRoute(command);
    if (route.plan && !route.blockedStep && route.requiresApproval) {
      const targetText = evidence?.targetMatched?.trim()
        || invokableUiCandidate.candidate.label?.trim()
        || invokableUiCandidate.candidate.name?.trim()
        || 'UI control';
      const primaryActionText = evidence?.primaryAction?.trim()
        || invokableUiCandidate.candidate.label?.trim()
        || 'UI action';
      return {
        command,
        plan: route.plan,
        reason: createAgentVisualInvokeApprovalReason({
          primaryActionText,
          targetText,
        }),
        routeSummary: route.summary,
      };
    }
  }

  if (!point) {
    return null;
  }

  const inputAction = shouldUseAgentSessionV2KeyboardConfirmFallback({
    evidence,
    point,
    toolResults: options.toolResults,
  })
    ? inferAgentSessionV2KeyboardConfirmInputAction(evidence)
    : shouldUseAgentSessionV2DoubleClickFallback({
        evidence,
        point,
        toolResults: options.toolResults,
      })
      ? 'double_click'
      : 'click';
  const command = createAgentSessionV2VisualInputSequenceCommand({
    evidence,
    entry,
    forceLoginContinuationInput: hasSafeLoginContinuationEvidence || hasExplicitSafeLoginControl || isLoginControl,
    inputAction,
    point,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  const route = buildAgentPermissionRoute(command);
  if (!route.plan || route.blockedStep || !route.requiresApproval) {
    return null;
  }

  if (coordinateFallbackAfterWindowUiFailure) {
    const targetText = evidence?.targetMatched?.trim() || 'UI control';
    return {
      command,
      plan: route.plan,
      reason: createAgentVisualActionApprovalReason({
        coordinateFallbackAfterWindowUiFailure: true,
        inputAction,
        point,
        primaryActionText: evidence?.primaryAction?.trim() || 'primary action',
        targetText,
      }),
      routeSummary: route.summary,
    };
  }

  const targetText = evidence?.targetMatched?.trim() || 'target';
  const primaryActionText = evidence?.primaryAction?.trim() || 'primary action';
  if (inputAction === 'click_then_enter' || inputAction === 'click_then_space') {
    const keyName = inputAction === 'click_then_space' ? 'Space' : 'Enter';
    return {
      command,
      plan: route.plan,
      reason: createAgentVisualActionApprovalReason({
        inputAction,
        keyName,
        point,
        primaryActionText,
        targetText,
      }),
      routeSummary: route.summary,
    };
  }

  return {
    command,
    plan: route.plan,
    reason: createAgentVisualActionApprovalReason({
      inputAction,
      point,
      primaryActionText,
      targetText,
    }),
    routeSummary: route.summary,
  };
}

interface AgentSessionV2TimingTrackerOptions {
  continuationTiming?: AgentSessionV2TimingTrace | null;
  maxDurationMs: number;
  maxModelCalls: number;
  maxToolCalls: number;
}

interface AgentSessionV2TimingTracker {
  beginEntry: (
    kind: AgentSessionV2TimingEntryKind,
    label: string,
    stepIndex: number,
    detail?: string | null,
  ) => AgentSessionV2TimingEntry;
  finishEntry: (
    entry: AgentSessionV2TimingEntry,
    status: AgentSessionV2TimingEntryStatus,
    detail?: string | null,
  ) => AgentSessionV2TimingEntry;
  getBudgetStopReason: (extraToolCalls?: number) => AgentSessionV2TimingStopReason | null;
  markStopReason: (reason: AgentSessionV2TimingStopReason) => void;
  snapshot: () => AgentSessionV2TimingTrace;
}

function createAgentSessionV2TimingTracker(
  options: AgentSessionV2TimingTrackerOptions,
): AgentSessionV2TimingTracker {
  const startedAt = Date.now();
  const previousTiming = options.continuationTiming ?? null;
  const priorAccumulatedElapsedMs = previousTiming?.accumulatedElapsedMs ?? previousTiming?.elapsedMs ?? 0;
  const entries: AgentSessionV2TimingEntry[] = [];
  let modelCallCount = 0;
  let toolCallCount = 0;
  let modelDurationMs = 0;
  let toolDurationMs = 0;
  let stopReason: AgentSessionV2TimingStopReason | null = null;

  const getElapsedMs = () => Math.max(0, Date.now() - startedAt);
  const getAccumulatedElapsedMs = () => priorAccumulatedElapsedMs + getElapsedMs();

  const snapshot = (): AgentSessionV2TimingTrace => {
    const now = Date.now();
    return {
      accumulatedElapsedMs: getAccumulatedElapsedMs(),
      elapsedMs: getElapsedMs(),
      entries: entries.map((entry) => ({ ...entry })),
      maxDurationMs: options.maxDurationMs,
      maxModelCalls: options.maxModelCalls,
      maxToolCalls: options.maxToolCalls,
      modelCallCount,
      modelDurationMs,
      startedAt,
      stopReason,
      toolCallCount,
      toolDurationMs,
      updatedAt: now,
    };
  };

  return {
    beginEntry: (kind, label, stepIndex, detail = null) => {
      const entry: AgentSessionV2TimingEntry = {
        detail,
        id: `${kind}-${entries.length + 1}-${Date.now()}`,
        kind,
        label,
        startedAt: Date.now(),
        status: 'running',
        stepIndex,
      };
      entries.push(entry);
      if (kind === 'model') {
        modelCallCount += 1;
      } else {
        toolCallCount += 1;
      }
      return entry;
    },
    finishEntry: (entry, status, detail = entry.detail ?? null) => {
      const endedAt = Date.now();
      const durationMs = Math.max(0, endedAt - entry.startedAt);
      const updatedEntry: AgentSessionV2TimingEntry = {
        ...entry,
        detail,
        durationMs,
        endedAt,
        status,
      };
      const index = entries.findIndex((item) => item.id === entry.id);
      if (index >= 0) {
        entries[index] = updatedEntry;
      }
      if (entry.kind === 'model') {
        modelDurationMs += durationMs;
      } else {
        toolDurationMs += durationMs;
      }
      return updatedEntry;
    },
    getBudgetStopReason: (extraToolCalls = 0) => {
      if (getElapsedMs() >= options.maxDurationMs) {
        return 'max-duration';
      }
      if (modelCallCount >= options.maxModelCalls) {
        return 'max-model-calls';
      }
      if (toolCallCount + extraToolCalls > options.maxToolCalls) {
        return 'max-tool-calls';
      }
      return null;
    },
    markStopReason: (reason) => {
      stopReason = reason;
    },
    snapshot,
  };
}

function createAgentSessionV2BudgetExceededAnswer(timing: AgentSessionV2TimingTrace) {
  const elapsedSeconds = Math.max(1, Math.round(timing.elapsedMs / 1000));
  switch (timing.stopReason) {
    case 'max-duration':
      return `This Agent run reached the time budget after ${elapsedSeconds} seconds, so I stopped to avoid looping.`;
    case 'max-model-calls':
      return `This Agent run reached the model-call budget (${timing.modelCallCount}/${timing.maxModelCalls}), so I stopped to avoid looping.`;
    case 'max-tool-calls':
      return `This Agent run reached the tool-call budget (${timing.toolCallCount}/${timing.maxToolCalls}), so I stopped to avoid looping.`;
    default:
      return 'This Agent run reached its execution budget, so I stopped to avoid getting stuck.';
  }
}

interface AgentSessionV2ReadOnlyToolCacheEntry {
  createdAt: number;
  resultPromise: Promise<AgentChatCommandResult>;
}

type AgentSessionV2ReadOnlyToolCache = Map<string, AgentSessionV2ReadOnlyToolCacheEntry>;

export type AgentSessionV2CoveredParallelToolCommand = AgentRuntimeCoveredParallelToolCommand;
export type AgentSessionV2ParallelToolExecutionPlan = AgentRuntimeParallelToolExecutionPlan;

function isAgentSessionV2CancellationRequested(signal?: AbortSignal | null) {
  return Boolean(signal?.aborted);
}

function createAgentSessionV2CancelledToolResult(command: AgentChatCommand) {
  return assessAgentCommandResult(command, {
    errorText: AGENT_SESSION_V2_CANCELLED_ANSWER,
    ok: false,
    responseText: AGENT_SESSION_V2_CANCELLED_ANSWER,
    receipt: {
      evidenceLines: ['User cancelled the active Agent run before this tool could finish.'],
      status: 'blocked',
      summaryLines: [
        `tool: ${command.toolCall?.name ?? command.kind}`,
        'result: cancelled by user',
      ],
      title: 'Agent run cancelled',
      toolName: command.toolCall?.name ?? command.kind,
      verification: AGENT_SESSION_V2_CANCELLED_ANSWER,
    },
    verification: AGENT_SESSION_V2_CANCELLED_ANSWER,
  });
}

function hasAgentSessionV2ForceRefresh(args: Record<string, unknown> | undefined) {
  const forceRefresh = args?.forceRefresh;
  return forceRefresh === true || forceRefresh === 'true';
}

function getAgentSessionV2CacheableAction(command: AgentChatCommand) {
  const toolName = command.toolCall?.name;
  if (!toolName) {
    return '';
  }

  return getAgentSessionV2ToolInputAction(command) || toolName;
}

export function isAgentSessionV2CacheableReadOnlyToolCommand(command: AgentChatCommand) {
  const toolName = command.toolCall?.name;
  const input = command.toolCall?.input ?? {};
  const action = getAgentSessionV2CacheableAction(command);
  if (!toolName || hasAgentSessionV2ForceRefresh(input)) {
    return false;
  }

  if (isAgentVisualContextToolCommand(command)) {
    return false;
  }

  switch (toolName) {
    case 'observe_windows_and_apps':
      return true;
    case 'execute_desktop_observation':
      return [
        'diagnose_desktop_icons',
        'get_active_window_info',
        'get_cursor_position',
        'get_display_info',
        'get_system_info',
        'list_desktop_items',
        'list_running_apps',
      ].includes(action);
    case 'execute_desktop_action':
      return [
        'get_active_window_info',
        'get_default_app_for_uri',
        'list_running_apps',
      ].includes(action);
    case 'execute_local_file_action':
      return [
        'find_file',
        'get_path_info',
        'list_dir',
        'list_directory',
        'read_file',
        'read_text_file',
        'search_files',
      ].includes(action);
    case 'execute_memory_action':
      return [
        'list',
        'read',
        'recall',
        'search',
      ].includes(action);
    case 'get_voice_status':
    case 'inspect_local_project':
      return true;
    default:
      return false;
  }
}

export function createAgentSessionV2ReadOnlyToolCacheKey(command: AgentChatCommand) {
  if (!isAgentSessionV2CacheableReadOnlyToolCommand(command)) {
    return null;
  }

  const route = buildAgentPermissionRoute(command);
  if (!isAgentPermissionRouteSilentReadOnly(route)) {
    return null;
  }

  return createAgentToolCallSignature(
    command.toolCall?.name ?? command.kind,
    normalizeAgentSessionV2ReadOnlyToolCacheInput(command.toolCall?.input ?? {}),
  );
}

const AGENT_SESSION_V2_READ_ONLY_CACHE_META_KEYS = new Set([
  'goal',
  'note',
  'notes',
  'reason',
]);

function normalizeAgentSessionV2ReadOnlyToolCacheInput(input: Record<string, unknown>) {
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (AGENT_SESSION_V2_READ_ONLY_CACHE_META_KEYS.has(key)) {
      continue;
    }

    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (Array.isArray(value)) {
      const nextArray = value.filter((item) => item !== undefined && item !== null && item !== '');
      if (nextArray.length) {
        normalized[key] = nextArray;
      }
      continue;
    }

    normalized[key] = value;
  }

  return normalized;
}

function createAgentSessionV2CachedStateSummary(
  result: AgentChatCommandResult,
  cacheLine: string,
) {
  return {
    ...result.stateSummary,
    observedState: [
      cacheLine,
      ...(result.stateSummary?.observedState ?? []),
    ],
  };
}

function createAgentSessionV2CachedReceipt(
  result: AgentChatCommandResult,
  cacheLine: string,
) {
  if (!result.receipt) {
    return result.receipt;
  }

  return {
    ...result.receipt,
    evidenceLines: [
      cacheLine,
      ...(result.receipt.evidenceLines ?? []),
    ],
    stateSummary: result.receipt.stateSummary
      ? {
          ...result.receipt.stateSummary,
          observedState: [
            cacheLine,
            ...(result.receipt.stateSummary.observedState ?? []),
          ],
        }
      : result.receipt.stateSummary,
  };
}

function createAgentSessionV2CachedToolResult(
  result: AgentChatCommandResult,
  createdAt: number,
) {
  const ageMs = Math.max(0, Date.now() - createdAt);
  const cacheLine = `${AGENT_TOOL_RESULT_CACHE_HIT_PREFIX}: reused silent read-only observation (${ageMs}ms old).`;
  return {
    ...result,
    observations: [
      cacheLine,
      ...(result.observations ?? []),
    ],
    receipt: createAgentSessionV2CachedReceipt(result, cacheLine),
    stateSummary: createAgentSessionV2CachedStateSummary(result, cacheLine),
  };
}

function createAgentSessionV2TimingEntrySummary(entry: AgentSessionV2TimingEntry) {
  const durationText = typeof entry.durationMs === 'number' ? `${Math.max(0, Math.round(entry.durationMs))}ms` : 'running';
  return `${entry.kind}:${entry.label}#${entry.stepIndex} ${entry.status} ${durationText}`;
}

function createAgentSessionV2ToolTimingEntry(
  command: AgentChatCommand,
  timing: AgentSessionV2TimingEntry,
) {
  const toolName = command.toolCall?.name ?? command.kind;
  return {
    ...timing,
    label: `${toolName}`,
  };
}

function getAgentSessionV2TimingToolDetail(command: AgentChatCommand) {
  const action = getAgentSessionV2ToolInputAction(command);
  return action || command.toolCall?.name || command.kind;
}

function resolveAgentSessionV2ToolTimingStatus(
  result: AgentChatCommandResult,
  signal?: AbortSignal | null,
): AgentSessionV2TimingEntryStatus {
  if (isAgentSessionV2CancellationRequested(signal)) {
    return 'cancelled';
  }

  if (isAgentCachedToolResult(result)) {
    return 'cached';
  }

  return result.ok === false ? 'failed' : 'success';
}

async function executeAgentSessionV2ToolCommand(
  command: AgentChatCommand,
  toolExecutor: AgentSessionV2ToolExecutor,
  signal?: AbortSignal | null,
) {
  if (isAgentSessionV2CancellationRequested(signal)) {
    return createAgentSessionV2CancelledToolResult(command);
  }

  try {
    const result = assessAgentCommandResult(command, await toolExecutor(command, { signal }));
    return isAgentSessionV2CancellationRequested(signal)
      ? createAgentSessionV2CancelledToolResult(command)
      : result;
  } catch (error) {
    if (isAgentSessionV2CancellationRequested(signal)) {
      return createAgentSessionV2CancelledToolResult(command);
    }

    const errorText = error instanceof Error ? error.message : String(error);
    return assessAgentCommandResult(command, {
      errorText,
      ok: false,
      responseText: `Local tool execution failed: ${errorText}`,
    });
  }
}

async function executeAgentSessionV2ToolCommandWithCache(
  command: AgentChatCommand,
  toolExecutor: AgentSessionV2ToolExecutor,
  cache: AgentSessionV2ReadOnlyToolCache,
  signal?: AbortSignal | null,
) {
  if (isAgentSessionV2CancellationRequested(signal)) {
    return createAgentSessionV2CancelledToolResult(command);
  }

  const cacheKey = createAgentSessionV2ReadOnlyToolCacheKey(command);
  if (!cacheKey) {
    return executeAgentSessionV2ToolCommand(command, toolExecutor, signal);
  }

  const now = Date.now();
  const cachedEntry = cache.get(cacheKey);
  if (cachedEntry && now - cachedEntry.createdAt <= AGENT_SESSION_V2_READ_ONLY_CACHE_TTL_MS) {
    const cachedResult = await cachedEntry.resultPromise;
    return createAgentSessionV2CachedToolResult(cachedResult, cachedEntry.createdAt);
  }

  if (cachedEntry) {
    cache.delete(cacheKey);
  }

  const resultPromise = executeAgentSessionV2ToolCommand(command, toolExecutor, signal);
  cache.set(cacheKey, {
    createdAt: now,
    resultPromise,
  });

  const result = await resultPromise;
  if (result.ok === false || isAgentSessionV2CancellationRequested(signal)) {
    cache.delete(cacheKey);
  }

  return result;
}

function getAgentSessionV2InputBooleanDefaultTrue(
  input: Record<string, unknown> | undefined,
  key: string,
) {
  const value = input?.[key];
  return value !== false && value !== 'false';
}

function getAgentSessionV2InputString(
  input: Record<string, unknown> | undefined,
  keys: string[],
) {
  for (const key of keys) {
    const value = input?.[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function normalizeAgentSessionV2ParallelObservationQuery(value: string) {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function getAgentSessionV2ParallelObservationQuery(command: AgentChatCommand) {
  return normalizeAgentSessionV2ParallelObservationQuery(
    getAgentSessionV2InputString(command.toolCall?.input, [
      'query',
      'target',
      'name',
      'title',
      'processName',
    ]),
  );
}

function isAgentSessionV2ObserveWindowsAndAppsCommand(command: AgentChatCommand) {
  return command.toolCall?.name === 'observe_windows_and_apps';
}

function isAgentSessionV2ParallelObserveCoverageFreshEnough(
  command: AgentChatCommand,
  coveringCommand: AgentChatCommand,
) {
  return !hasAgentSessionV2ForceRefresh(command.toolCall?.input)
    || hasAgentSessionV2ForceRefresh(coveringCommand.toolCall?.input);
}

function isAgentSessionV2ParallelObserveRunningQueryCovered(
  command: AgentChatCommand,
  coveringCommand: AgentChatCommand,
) {
  const commandQuery = getAgentSessionV2ParallelObservationQuery(command);
  const coveringQuery = getAgentSessionV2ParallelObservationQuery(coveringCommand);
  return commandQuery === coveringQuery;
}

function getAgentSessionV2ParallelCoveredByObserveReason(
  command: AgentChatCommand,
  coveringCommand: AgentChatCommand,
) {
  if (!isAgentSessionV2ObserveWindowsAndAppsCommand(coveringCommand)) {
    return null;
  }

  if (!isAgentSessionV2ParallelObserveCoverageFreshEnough(command, coveringCommand)) {
    return null;
  }

  const action = getAgentSessionV2ToolInputAction(command);
  if (
    command.toolCall?.name === 'execute_desktop_observation'
    && action === 'get_display_info'
    && getAgentSessionV2InputBooleanDefaultTrue(coveringCommand.toolCall?.input, 'includeDisplays')
  ) {
    return 'display layout is already included in observe_windows_and_apps for this batch';
  }

  if (
    (
      command.toolCall?.name === 'execute_desktop_observation'
      || command.toolCall?.name === 'execute_desktop_action'
    )
    && action === 'get_active_window_info'
    && getAgentSessionV2InputBooleanDefaultTrue(coveringCommand.toolCall?.input, 'includeActiveWindow')
  ) {
    return 'active window is already included in observe_windows_and_apps for this batch';
  }

  if (
    (
      command.toolCall?.name === 'execute_desktop_observation'
      || command.toolCall?.name === 'execute_desktop_action'
    )
    && action === 'list_running_apps'
    && getAgentSessionV2InputBooleanDefaultTrue(coveringCommand.toolCall?.input, 'includeRunningApps')
    && isAgentSessionV2ParallelObserveRunningQueryCovered(command, coveringCommand)
  ) {
    const query = getAgentSessionV2ParallelObservationQuery(command);
    return query
      ? `running window/app list for query "${query}" is already included in observe_windows_and_apps for this batch`
      : 'running window/app list is already included in observe_windows_and_apps for this batch';
  }

  return null;
}

function findAgentSessionV2ParallelCoveringCommand(
  command: AgentChatCommand,
  commands: AgentChatCommand[],
) {
  if (isAgentSessionV2ObserveWindowsAndAppsCommand(command)) {
    return null;
  }

  for (const candidate of commands) {
    if (candidate === command) {
      continue;
    }

    const reason = getAgentSessionV2ParallelCoveredByObserveReason(command, candidate);
    if (reason) {
      return {
        command: candidate,
        reason,
      };
    }
  }

  return null;
}

export function createAgentSessionV2ParallelToolExecutionPlan(
  commands: AgentChatCommand[],
): AgentSessionV2ParallelToolExecutionPlan {
  const duplicateCoveredCommands: AgentSessionV2CoveredParallelToolCommand[] = [];
  const signatureToCommand = new Map<string, AgentChatCommand>();
  const uniqueCommands: AgentChatCommand[] = [];

  for (const command of commands) {
    const signature = createAgentSessionV2ReadOnlyToolCacheKey(command);
    const existingCommand = signature ? signatureToCommand.get(signature) : null;
    if (existingCommand) {
      duplicateCoveredCommands.push({
        command,
        coveredByCommand: existingCommand,
        reason: 'same silent read-only observation was already requested in this batch',
      });
      continue;
    }

    uniqueCommands.push(command);
    if (signature) {
      signatureToCommand.set(signature, command);
    }
  }

  const coverageByCommand = new Map<AgentChatCommand, AgentSessionV2CoveredParallelToolCommand>();
  const runCommands = uniqueCommands.filter((command) => {
    const covering = findAgentSessionV2ParallelCoveringCommand(command, uniqueCommands);
    if (!covering) {
      return true;
    }

    coverageByCommand.set(command, {
      command,
      coveredByCommand: covering.command,
      reason: covering.reason,
    });
    return false;
  });

  const coveredCommands = [
    ...coverageByCommand.values(),
    ...duplicateCoveredCommands.map((covered) => {
      const canonicalCoverage = coverageByCommand.get(covered.coveredByCommand);
      return canonicalCoverage
        ? {
            ...covered,
            coveredByCommand: canonicalCoverage.coveredByCommand,
            reason: `${covered.reason}; ${canonicalCoverage.reason}`,
          }
        : covered;
    }),
  ];

  return {
    coveredCommands,
    runCommands,
  };
}

export function createAgentSessionV2CoveredParallelToolResult(options: {
  command: AgentChatCommand;
  coveredByCommand: AgentChatCommand;
  coveringResult: AgentChatCommandResult;
  reason: string;
}) {
  const requestedToolName = options.command.toolCall?.name ?? options.command.kind;
  const coveringToolName = options.coveredByCommand.toolCall?.name ?? options.coveredByCommand.kind;
  const coveredLine = `AgentSessionV2 parallel dedupe: ${requestedToolName} covered by ${coveringToolName}; ${options.reason}.`;
  return assessAgentCommandResult(options.command, {
    observations: [
      coveredLine,
      ...(options.coveringResult.observations ?? []).slice(0, 5),
    ],
    ok: true,
    receipt: {
      evidenceLines: [
        coveredLine,
        ...(options.coveringResult.receipt?.evidenceLines ?? []).slice(0, 8),
      ],
      status: 'success',
      summaryLines: [
        `Requested tool: ${requestedToolName}`,
        `Covered by: ${coveringToolName}`,
      ],
      title: 'Parallel read-only observation deduped',
      toolName: requestedToolName,
      verification: `The same batch already ran ${coveringToolName}, which covers this read-only fact.`,
    },
    responseText: `Skipped duplicate read-only observation; ${options.reason}. Use the same-batch ${coveringToolName} evidence above.`,
    verification: `Covered by same-batch ${coveringToolName} result.`,
  });
}

function resolveLastAgentSessionV2Failure(toolResults: AgentSessionV2ToolResultEntry[]) {
  return [...toolResults].reverse().find((entry) => entry.result.ok === false) ?? null;
}

function createAgentSessionV2RepeatedFailureAnswer(
  toolName: string,
  result: AgentChatCommandResult,
) {
  const detail = compactAgentSessionText(
    result.errorText
      || result.verification
      || result.responseText
      || result.followUp
      || 'No additional error detail.',
    260,
  );

  return `The same tool "${toolName}" failed repeatedly with the same arguments, so I stopped to avoid looping. Last error: ${detail}`;
}

function createAgentSessionV2MaxStepsAnswer(
  maxSteps: number,
  toolResults: AgentSessionV2ToolResultEntry[],
) {
  const lastFailure = resolveLastAgentSessionV2Failure(toolResults);
  if (!lastFailure) {
    return `Agent processed ${maxSteps} steps and stopped to avoid looping.`;
  }

  const toolName = lastFailure.command.toolCall?.name ?? lastFailure.command.kind;
  const detail = compactAgentSessionText(
    lastFailure.result.errorText
      || lastFailure.result.verification
      || lastFailure.result.responseText
      || lastFailure.result.followUp
      || 'No additional error detail.',
    260,
  );

  return `Agent processed ${maxSteps} steps and stopped to avoid looping. Last blocked tool: ${toolName}. Detail: ${detail}`;
}

function createAgentSessionV2BudgetExceededResult(options: {
  debug?: AgentSessionV2DebugInfo | null;
  diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
  finalAnswer: string;
  historyLines: string[];
  sourceText: string;
  steps: AgentSessionV2Step[];
  taskState?: AgentTaskRuntimeStateRecord | null;
  timing: AgentSessionV2TimingTrace;
  traceEvents: AgentSessionV2TraceEvent[];
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}): AgentSessionV2Result {
  return createAgentSessionV2FinalResult({
    debug: options.debug,
    diagnostics: options.diagnostics,
    finalAnswer: options.finalAnswer,
    historyLines: options.historyLines,
    sourceText: options.sourceText,
    status: 'budget-exceeded',
    steps: options.steps,
    taskState: options.taskState,
    timing: options.timing,
    traceEvents: options.traceEvents,
    toolResults: options.toolResults,
    userGoal: options.userGoal,
  });
}

function createAgentSessionV2FinalResult(options: {
  debug?: AgentSessionV2DebugInfo | null;
  diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
  finalAnswer: string;
  historyLines: string[];
  pendingApproval?: AgentSessionV2PendingApproval | null;
  sourceText: string;
  status: AgentSessionV2Status;
  steps: AgentSessionV2Step[];
  taskState?: AgentTaskRuntimeStateRecord | null;
  timing?: AgentSessionV2TimingTrace | null;
  traceEvents: AgentSessionV2TraceEvent[];
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}): AgentSessionV2Result {
  const runtimeShadowSummary = options.debug?.v4TaskShadow
    ? (() => {
        switch (options.debug.v4TaskShadow.classification) {
          case 'outer_dispatch_only':
            return 'V4 task shadow: only the outer app/window action ran; no in-app dispatch/click was executed.';
          case 'target_resolved_without_dispatch':
            return 'V4 task shadow: target was found, but no in-app dispatch/click was executed.';
          case 'input_dispatched_unverified':
            return 'V4 task shadow: input was dispatched, but the outcome was not verified.';
          case 'approval_pending':
            return 'V4 task shadow: execution is waiting for approval.';
          case 'verified_success':
            return options.debug.v4TaskShadow.notes.some((note) => /read-only task completed/iu.test(note))
              ? 'V4 task shadow: verified read-only observation completed; no dispatch was required.'
              : 'V4 task shadow: verified evidence indicates task success.';
          case 'read_only_observation_only':
            return 'V4 task shadow: only read-only observation ran; no side-effect action was executed.';
          default:
            return `V4 task shadow classified ${options.debug.v4TaskShadow.classification}.`;
        }
      })()
    : null;
  const slowestToolTiming = options.toolResults
    .map((entry) => ({
      durationMs: entry.timing?.durationMs ?? 0,
      toolName: entry.command.toolCall?.name ?? entry.command.kind,
    }))
    .sort((left, right) => right.durationMs - left.durationMs)[0] ?? null;
  let diagnostics = [...(options.diagnostics ?? [])];
  if (options.debug?.v4TaskShadow) {
    diagnostics = upsertAgentRuntimeDiagnostic(diagnostics, createAgentRuntimeDiagnostic({
      category: 'runtime-shadow',
      details: compactAgentTraceDetails({
        classification: options.debug.v4TaskShadow.classification,
        eventKinds: options.debug.v4TaskShadow.events.map((event) => event.kind).join(' -> '),
        lastBlocker: options.debug.v4TaskShadow.context.lastBlocker,
        lastTargetSummary: options.debug.v4TaskShadow.context.lastTargetSummary,
        localRecoveryCount: options.debug.v4TaskShadow.context.localRecoveryCount,
        notes: options.debug.v4TaskShadow.notes.join(' | '),
        slowestToolDurationMs: slowestToolTiming?.durationMs,
        slowestToolName: slowestToolTiming?.toolName,
        state: options.debug.v4TaskShadow.context.currentState,
        totalElapsedMs: options.timing?.elapsedMs,
        toolResultCount: options.toolResults.length,
        transitionCount: options.debug.v4TaskShadow.context.transitionCount,
      }),
      source: 'v4-task-shadow',
      status: options.debug.v4TaskShadow.classification,
      summary: runtimeShadowSummary ?? `V4 task shadow classified ${options.debug.v4TaskShadow.classification}.`,
    }));
  }
  if (options.debug?.v3PilotShadow) {
    diagnostics = upsertAgentRuntimeDiagnostic(diagnostics, createAgentRuntimeDiagnostic({
      category: 'runtime-pilot',
      details: { pilot: options.debug.v3PilotShadow },
      source: 'v3-pilot-shadow',
      summary: 'V3 pilot shadow diagnostics were collected for this run.',
    }));
  }
  const traceEvents = options.traceEvents.filter((event) => event.type !== 'runtime_shadow');
  return {
    continuation: {
      diagnostics,
      historyLines: [...options.historyLines],
      sourceText: options.sourceText,
      steps: [...options.steps],
      taskState: options.taskState ?? null,
      timing: options.timing ?? null,
      traceEvents,
      toolResults: [...options.toolResults],
      userGoal: options.userGoal,
    },
    ...(options.debug ? { debug: options.debug } : {}),
    diagnostics,
    finalAnswer: options.finalAnswer.trim() || 'No usable reply was generated, so I stopped.',
    pendingApproval: options.pendingApproval ?? null,
    sourceText: options.sourceText,
    status: options.status,
    steps: options.steps,
    taskState: options.taskState ?? null,
    timing: options.timing ?? null,
    traceEvents,
    toolResults: options.toolResults,
  };
}

function createAgentSessionV2ContinuationSnapshot(options: {
  diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
  historyLines: string[];
  sourceText: string;
  steps: AgentSessionV2Step[];
  taskState?: AgentTaskRuntimeStateRecord | null;
  timing?: AgentSessionV2TimingTrace | null;
  traceEvents: AgentSessionV2TraceEvent[];
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}): AgentSessionV2ContinuationState {
  return {
    diagnostics: [...(options.diagnostics ?? [])],
    historyLines: [...options.historyLines],
    sourceText: options.sourceText,
    steps: [...options.steps],
    taskState: options.taskState ?? null,
    timing: options.timing ?? null,
    traceEvents: [...options.traceEvents],
    toolResults: [...options.toolResults],
    userGoal: options.userGoal,
  };
}

function emitAgentSessionV2Progress(
  onProgress: AgentSessionV2ProgressHandler | undefined,
  event: Omit<AgentSessionV2ProgressEvent, 'continuation'>,
  snapshot: {
    diagnostics?: AgentRuntimeDiagnosticEnvelope[] | null;
    historyLines: string[];
    sourceText: string;
    steps: AgentSessionV2Step[];
    taskState?: AgentTaskRuntimeStateRecord | null;
    timing?: AgentSessionV2TimingTrace | null;
    traceEvents: AgentSessionV2TraceEvent[];
    toolResults: AgentSessionV2ToolResultEntry[];
    userGoal: string;
  },
) {
  if (!onProgress) {
    return;
  }

  try {
    onProgress({
      ...event,
      continuation: createAgentSessionV2ContinuationSnapshot(snapshot),
    });
  } catch {
    // Progress updates should not affect the Agent loop.
  }
}

export function resolveAgentSessionV2Instruction(text: string) {
  return resolveAgentProductionSessionInstruction(text);
}

function getAgentSessionV2ToolInputString(
  command: AgentChatCommand,
  key: string,
) {
  const value = command.toolCall?.input?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

const AGENT_SESSION_V2_DESKTOP_ORGANIZATION_REQUEST_PATTERN = /(?=.*(?:\bdesktop\b|\u684c\u9762|\u56fe\u6807))(?=.*(?:\borganize\b|\barrange\b|\bsort\b|\bgroup\b|\bclassify\b|\u6574\u7406|\u6392\u5217|\u6446\u653e|\u5f52\u6574|\u5f52\u7c7b|\u5206\u7c7b|\u6536\u62fe))/iu;
const AGENT_SESSION_V2_DESKTOP_ITEM_REFERENCE_PATTERN = /(?:\b(?:desktop|icons?|shortcuts?)\b|\u684c\u9762|\u56fe\u6807|\u5feb\u6377\u65b9\u5f0f)/iu;
const AGENT_SESSION_V2_SCREEN_ITEM_REFERENCE_PATTERN = /(?:\b(?:files?|items?|shortcuts?|icons?)\b|\u6587\u4ef6|\u9879\u76ee|\u4e1c\u897f|\u5feb\u6377\u65b9\u5f0f|\u56fe\u6807)/iu;
const AGENT_SESSION_V2_ORGANIZATION_ACTION_PATTERN = /(?:\b(?:organize|arrange|sort|group|classify|tidy|clean\s*up)\b|\u6574\u7406|\u6392\u5217|\u6446\u653e|\u5f52\u6574|\u5f52\u7c7b|\u5206\u7c7b|\u6536\u62fe)/iu;
const AGENT_SESSION_V2_DISPLAY_REFERENCE_PATTERN = /(?:\b(?:displays?|screens?|monitors?)\b|\u5c4f\u5e55|\u663e\u793a\u5668|\u4e3b\u5c4f|\u526f\u5c4f|\u7b2c\u4e8c\u5c4f)/iu;
const AGENT_SESSION_V2_WINDOW_MOVE_ACTION_PATTERN = /(?:\b(?:move|send|put|place|shift|transfer|drag)\b|\u79fb\u52a8|\u79fb\u5230|\u632a\u5230|\u653e\u5230|\u653e\u5728|\u62d6\u5230|\u642c\u5230)/iu;
const AGENT_SESSION_V2_WINDOW_REFERENCE_PATTERN = /(?:\b(?:window|app|application|program|browser|chrome|edge|firefox|notepad|photoshop|ps)\b|\u7a97\u53e3|\u5e94\u7528|\u8f6f\u4ef6|\u7a0b\u5e8f|\u6d4f\u89c8\u5668)/iu;
const AGENT_SESSION_V2_DESKTOP_ITEM_INVENTORY_PATTERN = /(?:\b(?:how\s*many|count|list|show|inspect|check|see|what|which)\b|\u591a\u5c11|\u51e0\u4e2a|\u51e0\u9879|\u54ea\u4e9b|\u4ec0\u4e48|\u5217\u8868|\u5217\u51fa|\u770b\u770b|\u67e5\u770b|\u68c0\u6d4b|\u8bfb\u53d6|\u8bc6\u522b)/iu;
const AGENT_SESSION_V2_DISPLAY_INFO_ACTION_PATTERN = /^(?:get_display_info|display_info|screen_info|list_displays)$/iu;

function hasAgentSessionV2DesktopOrganizationRequest(text: string) {
  if (AGENT_SESSION_V2_DESKTOP_ORGANIZATION_REQUEST_PATTERN.test(text)) {
    return true;
  }

  return AGENT_SESSION_V2_ORGANIZATION_ACTION_PATTERN.test(text)
    && (
      AGENT_SESSION_V2_DESKTOP_ITEM_REFERENCE_PATTERN.test(text)
      || (
        AGENT_SESSION_V2_DISPLAY_REFERENCE_PATTERN.test(text)
        && AGENT_SESSION_V2_SCREEN_ITEM_REFERENCE_PATTERN.test(text)
      )
    );
}

function hasAgentSessionV2DesktopItemInventoryRequest(text: string) {
  const normalizedText = text.normalize('NFKC');
  const hasDesktopOrDisplayContext = AGENT_SESSION_V2_DESKTOP_ITEM_REFERENCE_PATTERN.test(normalizedText)
    || AGENT_SESSION_V2_DISPLAY_REFERENCE_PATTERN.test(normalizedText);
  return hasDesktopOrDisplayContext
    && AGENT_SESSION_V2_SCREEN_ITEM_REFERENCE_PATTERN.test(normalizedText)
    && AGENT_SESSION_V2_DESKTOP_ITEM_INVENTORY_PATTERN.test(normalizedText);
}

function hasAgentSessionV2WindowMoveToDisplayRequest(text: string) {
  const normalizedText = text.normalize('NFKC');
  return AGENT_SESSION_V2_WINDOW_MOVE_ACTION_PATTERN.test(normalizedText)
    && AGENT_SESSION_V2_DISPLAY_REFERENCE_PATTERN.test(normalizedText)
    && AGENT_SESSION_V2_WINDOW_REFERENCE_PATTERN.test(normalizedText);
}

function inferAgentSessionV2DisplayTargetFromText(text: string) {
  const normalizedText = text.normalize('NFKC').toLowerCase();
  if (/(?:\bsecondary\b|\bsecond\s+screen\b|\u526f\u5c4f|\u7b2c\u4e8c\u5c4f)/iu.test(normalizedText)) {
    return 'secondary';
  }
  if (/(?:\bprimary\b|\bmain\s+screen\b|\u4e3b\u5c4f)/iu.test(normalizedText)) {
    return 'primary';
  }
  return undefined;
}

function getAgentSessionV2OpenWindowTarget(args: Record<string, unknown>) {
  for (const key of ['target', 'query', 'url', 'website', 'site', 'appName', 'name']) {
    const value = args[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function hasAgentSessionV2MaximizeWindowRequest(text: string) {
  return /(?:\bmaximi[sz]e(?:d)?\b|\bfull\s*screen\b|\u6700\u5927\u5316|\u5168\u5c4f)/iu.test(text);
}

function createAgentSessionV2OpenMoveSequenceRedirect(options: {
  args: Record<string, unknown>;
  sourceText: string;
  toolName: AgentToolCallName;
  userGoal: string;
}) {
  if (options.toolName !== 'execute_desktop_action') {
    return null;
  }

  const action = getAgentSessionV2DesktopActionName(options.args);
  if (!['launch_local_app', 'open_resource', 'search_web'].includes(action)) {
    return null;
  }

  const text = `${options.sourceText} ${options.userGoal}`.trim();
  if (!hasAgentSessionV2WindowMoveToDisplayRequest(text)) {
    return null;
  }

  const target = getAgentSessionV2OpenWindowTarget(options.args);
  const targetDisplay = typeof options.args.targetDisplay === 'string' && options.args.targetDisplay.trim()
    ? options.args.targetDisplay.trim()
    : inferAgentSessionV2DisplayTargetFromText(text);
  if (!target || !targetDisplay) {
    return null;
  }

  const sequenceInput = createAgentRuntimeCoreOpenMoveSequenceInput({
    forceNew: options.args.forceNew === true,
    sourceText: options.sourceText,
    target,
    targetDisplay,
    toolName: action === 'search_web' ? 'search_web' : 'execute_desktop_action',
  });
  if (!hasAgentSessionV2MaximizeWindowRequest(text)) {
    return sequenceInput;
  }

  const steps = JSON.parse(sequenceInput.stepsJson) as Array<Record<string, unknown>>;
  steps.push({
    args: {
      action: 'control_window',
      windowState: 'maximized',
    },
    reason: `Maximize the resulting window after moving it to ${targetDisplay}.`,
    tool: 'execute_desktop_action',
  });
  return {
    ...sequenceInput,
    stepsJson: JSON.stringify(steps),
  };
}

function createAgentSessionV2ObservedDisplayOpenMoveApproval(options: {
  sourceText: string;
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}): AgentSessionV2PendingApproval | null {
  const displayEvidenceEntry = [...options.toolResults]
    .reverse()
    .find(hasAgentSessionV2DisplayObservationEvidence);
  if (!displayEvidenceEntry) {
    return null;
  }

  const previousDispatchExists = options.toolResults.slice(0, -1).some((entry) => {
    const toolName = entry.command.toolCall?.name;
    if (toolName === 'execute_desktop_sequence') {
      return true;
    }
    if (toolName !== 'execute_desktop_action') {
      return false;
    }
    return [
      'launch_local_app',
      'open_resource',
      'search_web',
      'move_window_to_display',
    ].includes(getAgentSessionV2DesktopActionName(entry.command.toolCall?.input));
  });
  if (previousDispatchExists) {
    return null;
  }

  const intentText = `${options.sourceText} ${options.userGoal}`.trim();
  if (!hasAgentSessionV2WindowMoveToDisplayRequest(intentText)) {
    return null;
  }

  const sourceExistingWindowTarget = extractPlannerExistingWindowMoveTargetFromText(options.sourceText);
  const goalExistingWindowTarget = extractPlannerExistingWindowMoveTargetFromText(options.userGoal);
  const existingWindowTarget = sourceExistingWindowTarget || goalExistingWindowTarget;
  const textWindowQueryCandidates = [
    sourceExistingWindowTarget,
    goalExistingWindowTarget,
  ].filter((candidate, index, candidates): candidate is string => (
    Boolean(candidate)
    && candidates.findIndex((value) => value.toLowerCase() === candidate.toLowerCase()) === index
  ));
  const observedWindowTarget = resolveAgentObservedWindowTargetEvidence({
    queryCandidates: textWindowQueryCandidates,
    sourceText: options.sourceText,
    toolResults: options.toolResults,
    userGoal: options.userGoal,
  });
  const existingWindowQueryCandidates = [
    ...textWindowQueryCandidates,
    observedWindowTarget?.processName,
    observedWindowTarget?.title,
  ].filter((candidate, index, candidates): candidate is string => (
    Boolean(candidate)
    && candidates.findIndex((value) => value?.toLowerCase() === candidate.toLowerCase()) === index
  ));
  const target = existingWindowTarget
    || extractPlannerOpenAndMoveTargetFromText(options.sourceText)
    || extractPlannerOpenAndMoveTargetFromText(options.userGoal);
  const targetDisplay = normalizePlannerDisplayMoveTarget(options.sourceText)
    || normalizePlannerDisplayMoveTarget(options.userGoal)
    || inferAgentSessionV2DisplayTargetFromText(intentText);
  if (!target || !targetDisplay) {
    return null;
  }
  const resolvedExistingWindowTarget = observedWindowTarget?.processName?.trim()
    || observedWindowTarget?.title?.trim()
    || existingWindowTarget;

  const sequenceInput = existingWindowTarget
    ? {
        action: 'move_window_to_display',
        fallbackToActiveWindow: false,
        ...(observedWindowTarget?.hwnd ? { hwnd: observedWindowTarget.hwnd } : {}),
        ...(observedWindowTarget?.pid ? { pid: observedWindowTarget.pid } : {}),
        ...(observedWindowTarget?.processName?.trim()
          ? { processName: observedWindowTarget.processName.trim() }
          : {}),
        ...(observedWindowTarget?.title?.trim()
          ? { title: observedWindowTarget.title.trim() }
          : {}),
        queryCandidates: existingWindowQueryCandidates,
        target: resolvedExistingWindowTarget,
        targetDisplay,
      }
    : createAgentRuntimeCoreOpenMoveSequenceInput({
        sourceText: options.sourceText,
        target,
        targetDisplay,
        toolName: /(?:\bbrowser\b|\u6d4f\u89c8\u5668)/iu.test(intentText)
          ? 'search_web'
          : 'execute_desktop_action',
      });
  const command = createAgentToolCommand({
    args: sequenceInput,
    sourceText: options.sourceText,
    toolName: existingWindowTarget ? 'execute_desktop_action' : 'execute_desktop_sequence',
    userGoal: options.userGoal,
  });
  const route = buildAgentPermissionRoute(command);
  if (!route.plan || route.blockedStep || !route.requiresApproval) {
    return null;
  }

  return {
    command,
    plan: route.plan,
    reason: createAgentApprovalRequiredToolReason({
      decisionReason: existingWindowTarget
        ? `Display evidence is ready; move the existing window for ${target}.`
        : `Display evidence is ready; continue the open-and-move task for ${target}.`,
      permissionSummary: route.summary,
    }),
    routeSummary: route.summary,
  };
}

function isAgentSessionV2DisplayInfoObservationArgs(args: Record<string, unknown> | undefined) {
  const action = typeof args?.action === 'string' ? args.action.trim() : '';
  return AGENT_SESSION_V2_DISPLAY_INFO_ACTION_PATTERN.test(action);
}

function shouldRedirectAgentSessionV2DisplayInfoToDesktopItems(options: {
  args: Record<string, unknown> | undefined;
  sourceText: string;
  toolName: string;
  userGoal: string;
}) {
  const text = `${options.sourceText} ${options.userGoal}`;
  if (!hasAgentSessionV2DesktopItemInventoryRequest(text)) {
    return false;
  }

  return options.toolName === 'get_display_info'
    || (
      options.toolName === 'execute_desktop_observation'
      && isAgentSessionV2DisplayInfoObservationArgs(options.args)
    );
}

const AGENT_SESSION_V2_READ_ONLY_DESKTOP_ACTION_REDIRECTS = new Set([
  'list_running_apps',
]);

function shouldRedirectAgentSessionV2ReadOnlyDesktopActionToObservation(options: {
  args: Record<string, unknown> | undefined;
  toolName: string;
}) {
  return options.toolName === 'execute_desktop_action'
    && AGENT_SESSION_V2_READ_ONLY_DESKTOP_ACTION_REDIRECTS.has(getAgentSessionV2DesktopActionName(options.args));
}

function createAgentSessionV2ReadOnlyDesktopActionObservationRedirectArgs(options: {
  args: Record<string, unknown> | undefined;
}) {
  return {
    ...(options.args ?? {}),
    action: getAgentSessionV2DesktopActionName(options.args),
  };
}

function createAgentSessionV2DesktopItemObservationRedirectArgs(options: {
  args: Record<string, unknown> | undefined;
  sourceText: string;
  userGoal: string;
}) {
  const displayTarget = typeof options.args?.displayTarget === 'string' && options.args.displayTarget.trim()
    ? options.args.displayTarget.trim()
    : inferAgentSessionV2DisplayTargetFromText(`${options.sourceText} ${options.userGoal}`) ?? 'all';

  return {
    ...(options.args ?? {}),
    action: 'list_desktop_items',
    displayTarget,
  };
}

function isAgentSessionV2DesktopItemObservationCommand(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'execute_desktop_observation') {
    return false;
  }

  const action = getAgentSessionV2ToolInputString(command, 'action')
    .toLowerCase()
    .replace(/[-\s]+/gu, '_');
  return action === 'list_desktop_items'
    || action === 'desktop_items'
    || action === 'desktop_icons'
    || action === 'list_desktop_icons'
    || action === 'diagnose_desktop_icons'
    || action === 'desktop_icon_diagnostics'
    || action === 'desktop_icon_status';
}

function isAgentSessionV2DesktopOrganizationPreviewCommand(command: AgentChatCommand) {
  if (command.kind === 'desktop-organization') {
    return command.desktopOrganization?.mode !== 'execute';
  }

  if (command.toolCall?.name !== 'organize_desktop_icons') {
    return false;
  }

  return command.toolCall.input?.mode !== 'execute';
}

function normalizeAgentSessionV2ToolActionName(value: string) {
  return value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
}

const AGENT_SESSION_V2_TRANSITIONAL_DESKTOP_ACTIONS = new Set([
  'open_or_focus_then_control_window',
  'open_then_control_window',
  'launch_then_control_window',
  'focus_then_control_window',
  'open_or_focus_then_move_window_to_display',
  'open_then_move_window_to_display',
  'launch_then_move_window_to_display',
]);

function getAgentSessionV2DesktopActionName(args: Record<string, unknown> | undefined) {
  const action = args?.action ?? args?.desktopAction ?? args?.operation;
  return typeof action === 'string'
    ? normalizeAgentSessionV2ToolActionName(action)
    : '';
}

function shouldRejectAgentSessionV2TransitionalDesktopAction(options: {
  args: Record<string, unknown> | undefined;
  toolName: AgentToolCallName;
}) {
  return options.toolName === 'execute_desktop_action'
    && AGENT_SESSION_V2_TRANSITIONAL_DESKTOP_ACTIONS.has(getAgentSessionV2DesktopActionName(options.args));
}

function getAgentSessionV2DesktopSequenceSteps(command: AgentChatCommand) {
  if (command.toolCall?.name !== 'execute_desktop_sequence') {
    return [];
  }

  const stepsJson = getAgentSessionV2ToolInputString(command, 'stepsJson');
  if (!stepsJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(stepsJson) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getAgentSessionV2RecordString(
  input: Record<string, unknown>,
  key: string,
) {
  const value = input[key];
  return typeof value === 'string' ? value.trim() : '';
}

function isAgentSessionV2DisplayTargetArgs(args: Record<string, unknown>) {
  return Boolean(
    getAgentSessionV2RecordString(args, 'targetDisplay')
    || getAgentSessionV2RecordString(args, 'displayId')
    || getAgentSessionV2RecordString(args, 'display')
    || getAgentSessionV2RecordString(args, 'displayTarget')
    || getAgentSessionV2RecordString(args, 'screen')
    || getAgentSessionV2RecordString(args, 'screenTarget')
  );
}

function isAgentSessionV2MoveWindowSequenceStep(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const step = value as Record<string, unknown>;
  if (step.tool !== 'execute_desktop_action') {
    return false;
  }

  const rawArgs = step.args ?? step.input;
  if (!rawArgs || typeof rawArgs !== 'object' || Array.isArray(rawArgs)) {
    return false;
  }

  const args = rawArgs as Record<string, unknown>;
  const action = normalizeAgentSessionV2ToolActionName(
    typeof args.action === 'string' ? args.action : '',
  );

  if (action === 'control_window') {
    return isAgentSessionV2DisplayTargetArgs(args);
  }

  return action === 'move_window'
    || action === 'open_or_focus_then_control_window'
    || action === 'open_then_control_window'
    || action === 'launch_then_control_window'
    || action === 'focus_then_control_window'
    || action === 'open_or_focus_then_move_window_to_display'
    || action === 'open_then_move_window_to_display'
    || action === 'launch_then_move_window_to_display'
    || action === 'move_window_to_display'
    || action === 'move_window_to_screen'
    || action === 'move_window_to_monitor';
}

function isAgentSessionV2MoveWindowToDisplayCommand(command: AgentChatCommand) {
  const sequenceSteps = getAgentSessionV2DesktopSequenceSteps(command);
  if (sequenceSteps.some(isAgentSessionV2MoveWindowSequenceStep)) {
    return true;
  }

  if (command.toolCall?.name !== 'execute_desktop_action') {
    return false;
  }

  const action = normalizeAgentSessionV2ToolActionName(getAgentSessionV2ToolInputString(command, 'action'));
  if (action === 'control_window' || action === 'open_or_focus_then_control_window') {
    return Boolean(
      getAgentSessionV2ToolInputString(command, 'targetDisplay')
      || getAgentSessionV2ToolInputString(command, 'displayId')
      || getAgentSessionV2ToolInputString(command, 'display')
      || getAgentSessionV2ToolInputString(command, 'displayTarget')
      || getAgentSessionV2ToolInputString(command, 'screen')
      || getAgentSessionV2ToolInputString(command, 'screenTarget')
    );
  }

  return action === 'move_window'
    || action === 'open_or_focus_then_control_window'
    || action === 'open_then_control_window'
    || action === 'launch_then_control_window'
    || action === 'focus_then_control_window'
    || action === 'open_or_focus_then_move_window_to_display'
    || action === 'open_then_move_window_to_display'
    || action === 'launch_then_move_window_to_display'
    || action === 'move_window_to_display'
    || action === 'move_window_to_screen'
    || action === 'move_window_to_monitor';
}

function hasSuccessfulAgentSessionV2DesktopItemObservation(
  toolResults: AgentSessionV2ToolResultEntry[],
) {
  return toolResults.some((entry) => (
    entry.result.ok !== false && isAgentSessionV2DesktopItemObservationCommand(entry.command)
  ));
}

function hasAgentSessionV2DesktopOrganizationPreview(
  toolResults: AgentSessionV2ToolResultEntry[],
) {
  return toolResults.some((entry) => (
    entry.result.ok !== false && isAgentSessionV2DesktopOrganizationPreviewCommand(entry.command)
  ));
}

function hasAgentSessionV2DesktopOrganizationExecuteAttempt(
  toolResults: AgentSessionV2ToolResultEntry[],
) {
  return toolResults.some((entry) => {
    const command = entry.command;
    if (command.kind === 'desktop-organization') {
      return command.desktopOrganization?.mode === 'execute';
    }

    return command.toolCall?.name === 'organize_desktop_icons'
      && command.toolCall.input?.mode === 'execute';
  });
}

function getLatestAgentSessionV2DesktopOrganizationExecuteAttempt(
  toolResults: AgentSessionV2ToolResultEntry[],
) {
  return [...toolResults].reverse().find((entry) => {
    const command = entry.command;
    if (command.kind === 'desktop-organization') {
      return command.desktopOrganization?.mode === 'execute';
    }

    return command.toolCall?.name === 'organize_desktop_icons'
      && command.toolCall.input?.mode === 'execute';
  }) ?? null;
}

function hasAgentSessionV2MoveWindowToDisplayAttempt(
  toolResults: AgentSessionV2ToolResultEntry[],
) {
  return toolResults.some((entry) => isAgentSessionV2MoveWindowToDisplayCommand(entry.command));
}

function shouldRejectAgentSessionV2PrematureDesktopOrganizationFinal(options: {
  sourceText: string;
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}) {
  const text = `${options.userGoal} ${options.sourceText}`.trim().replace(/\s+/gu, ' ');
  if (
    !hasAgentSessionV2DesktopOrganizationRequest(text)
    || !hasAgentDirectActionIntent(options.sourceText, options.userGoal)
  ) {
    return false;
  }

  const latestExecuteAttempt = getLatestAgentSessionV2DesktopOrganizationExecuteAttempt(options.toolResults);
  if (latestExecuteAttempt && isAgentSessionV2RecoverableUnverifiedToolResult(latestExecuteAttempt)) {
    return true;
  }

  return (
      hasSuccessfulAgentSessionV2DesktopItemObservation(options.toolResults)
      || hasAgentSessionV2DesktopOrganizationPreview(options.toolResults)
    )
    && !hasAgentSessionV2DesktopOrganizationExecuteAttempt(options.toolResults);
}

function shouldRejectAgentSessionV2PrematureWindowMoveFinal(options: {
  sourceText: string;
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}) {
  const text = `${options.userGoal} ${options.sourceText}`.trim().replace(/\s+/gu, ' ');
  return hasAgentSessionV2WindowMoveToDisplayRequest(text)
    && hasAgentDirectActionIntent(options.sourceText, options.userGoal)
    && !hasAgentSessionV2MoveWindowToDisplayAttempt(options.toolResults);
}

const agentSessionV2ActionCoverageDependencies: AgentActionCoverageDependencies = {
  getPostActionState: getAgentPostActionState,
  hasDesktopOrganizationRequest: hasAgentSessionV2DesktopOrganizationRequest,
  hasWindowMoveToDisplayRequest: hasAgentSessionV2WindowMoveToDisplayRequest,
  isAutoRecoveryReadCommand: isAgentDesktopAutoRecoveryReadCommand,
  isAutoRecoveryWaitCommand: isAgentDesktopAutoRecoveryWaitCommand,
  isPostApprovalVerificationCommand: isAgentPostApprovalVerificationCommand,
  isVerifiedTargetWindowObservation: isAgentVerifiedTargetWindowObservation,
};

function isAgentSessionV2BlockedFinalWithEvidence(decision: AgentSessionV2Decision) {
  return Boolean(decision.understanding?.blockedGoals?.length)
    || (
      decision.understanding?.verificationStatus === 'blocked'
      && Boolean(
        decision.understanding.verificationEvidence?.length
        || decision.understanding.verificationGaps?.length
      )
    );
}

export function findAgentSessionV2MissingRequestedActionCoverage(options: {
  sourceText: string;
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}) {
  const requestedCoverage = createAgentRequestedActionCoverage({
    dependencies: agentSessionV2ActionCoverageDependencies,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  });
  if (!requestedCoverage.size) {
    return null;
  }

  const attemptedCoverage = createAgentAttemptedActionCoverage({
    dependencies: agentSessionV2ActionCoverageDependencies,
    toolResults: options.toolResults,
  });
  const missingCoverage = [...requestedCoverage].filter((kind) => (
    !isAgentActionKindCovered(kind, attemptedCoverage)
  ));
  if (!missingCoverage.length) {
    return null;
  }

  return {
    attemptedCoverage,
    missingCoverage,
    requestedCoverage,
  };
}

function shouldRejectAgentSessionV2UnattemptedRequestedActionFinal(options: {
  decision: AgentSessionV2Decision;
  sourceText: string;
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}) {
  if (
    !hasAgentDirectActionIntent(options.sourceText, options.userGoal)
    || isAgentSessionV2BlockedFinalWithEvidence(options.decision)
  ) {
    return null;
  }

  return findAgentSessionV2MissingRequestedActionCoverage(options);
}

function isAgentSessionV2SilentReadOnlyToolResult(entry: AgentSessionV2ToolResultEntry) {
  const route = buildAgentPermissionRoute(entry.command);
  return isAgentPermissionRouteSilentReadOnly(route);
}

function isAgentSessionV2SatisfiedActionFinal(decision: AgentSessionV2Decision) {
  if (decision.understanding?.verificationStatus === 'satisfied') {
    return true;
  }

  const text = normalizeAgentIntentText(
    decision.message ?? '',
    ...(decision.understanding?.completedGoals ?? []),
    ...(decision.understanding?.verificationEvidence ?? []),
  );
  return /(?:\u5df2\u7ecf|\u5df2|\u6210\u529f|\u5b8c\u6210|\u6253\u5f00\u6210\u529f|\u542f\u52a8\u6210\u529f|done|completed|succeeded|success|opened|launched|started|clicked|pressed|moved|closed)/iu.test(text);
}

function hasAgentSessionV2ConcreteVerifiedOutcomeEvidence(
  toolResults: AgentSessionV2ToolResultEntry[],
) {
  if (!toolResults.length) {
    return false;
  }

  const attemptedCoverage = createAgentAttemptedActionCoverage({
    dependencies: agentSessionV2ActionCoverageDependencies,
    toolResults,
  });
  if (!attemptedCoverage.size) {
    return false;
  }

  const latestEntry = toolResults[toolResults.length - 1] ?? null;
  if (!latestEntry || latestEntry.result.ok === false) {
    return false;
  }

  if (isAgentVerifiedTargetWindowObservation(latestEntry)) {
    return true;
  }

  const evidenceText = normalizeAgentIntentText(
    latestEntry.result.verification ?? '',
    latestEntry.result.responseText ?? '',
    ...(latestEntry.result.observations ?? []),
    ...(latestEntry.result.stateSummary?.verificationEvidence ?? []),
    ...(latestEntry.result.receipt?.evidenceLines ?? []),
  );
  return /(?:verified|confirmed|belongs\s+to|on\s+(?:the\s+)?(?:secondary|primary)\s+display|target\s+(?:is\s+)?(?:open|opened|launched|started)|\u5df2(?:\u9a8c\u8bc1|\u786e\u8ba4)|\u9a8c\u8bc1(?:\u6210\u529f|\u901a\u8fc7)|\u5728(?:\u4e3b|\u526f)\u5c4f|\u5c5e\u4e8e(?:\u4e3b|\u526f)\u5c4f)/iu.test(evidenceText);
}

function shouldRejectAgentSessionV2ReadonlyObservationFinal(options: {
  decision: AgentSessionV2Decision;
  sourceText: string;
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}) {
  if (
    !hasAgentEffectiveDirectActionIntent(options.sourceText, options.userGoal)
    || isAgentSessionV2BlockedFinalWithEvidence(options.decision)
    || !isAgentSessionV2SatisfiedActionFinal(options.decision)
  ) {
    return false;
  }

  const attemptedCoverage = createAgentAttemptedActionCoverage({
    dependencies: agentSessionV2ActionCoverageDependencies,
    toolResults: options.toolResults,
  });
  if (attemptedCoverage.size > 0) {
    return false;
  }

  return options.toolResults.length > 0
    && options.toolResults.every(isAgentSessionV2SilentReadOnlyToolResult);
}

const agentSessionV2PostActionStateResolverDependencies: AgentPostActionStateResolverDependencies = {
  collectAutoRecoveryEvidenceText: collectAgentDesktopAutoRecoveryEvidenceText,
  hasDirectActionIntent: hasAgentDirectActionIntent,
  isActionResultTool: isAgentActionResultTool,
  isAutoRecoveryCommand: isAgentDesktopAutoRecoveryCommand,
  isPostApprovalVerificationCommand: isAgentPostApprovalVerificationCommand,
  isRecoverableUnverifiedToolResult: isAgentSessionV2RecoverableUnverifiedToolResult,
};

const resolveAgentRecoveryPostActionState = (options: {
  entry: AgentSessionV2ToolResultEntry | null;
  sourceText: string;
  userGoal: string;
}) => resolveAgentSessionV2RecoveryPostActionStateWithDependencies({
  dependencies: agentSessionV2PostActionStateResolverDependencies,
  ...options,
});
function shouldAllowAgentSessionV2CappedAutoRecoveryFinal(
  decision: AgentSessionV2Decision,
  latestEntry: AgentSessionV2ToolResultEntry | null,
  toolResults: AgentSessionV2ToolResultEntry[],
  sourceText: string,
  userGoal: string,
) {
  const isBlockedFinalWithEvidence = decision.understanding?.verificationStatus === 'blocked'
    && !decision.understanding?.remainingGoals?.length
    && Boolean(decision.understanding.verificationEvidence?.length);
  if (!isBlockedFinalWithEvidence) {
    return false;
  }

  if (latestEntry && isAgentDesktopAutoRecoveryReadCommand(latestEntry.command)) {
    const latestPostActionState = resolveAgentRecoveryPostActionState({
      entry: latestEntry,
      sourceText,
      userGoal,
    });
    if (
      latestPostActionState === 'blocked'
      || latestPostActionState === 'error'
      || latestPostActionState === 'login_required'
      || latestPostActionState === 'unchanged'
      || latestPostActionState === 'unknown'
    ) {
      return true;
    }
  }

  const sourceEntry = latestEntry && isAgentDesktopAutoRecoveryWaitCapReadCommand(latestEntry.command)
    ? findLatestAgentDesktopAutoRecoverySourceEntry(toolResults.slice(0, -1))
    : latestEntry;
  const postActionState = resolveAgentRecoveryPostActionState({
    entry: sourceEntry,
    sourceText,
    userGoal,
  });
  if (
    !sourceEntry
    || resolveAgentDesktopAutoRecoveryMaxWaits(postActionState, sourceEntry, toolResults) <= 0
    || hasAgentDesktopAutoRecoveryWaitBudgetRemaining(sourceEntry, toolResults)
  ) {
    return false;
  }

  return true;
}

function shouldRejectAgentSessionV2RecoverableUnverifiedAskUser(options: {
  decisionMessage?: string | null;
  sourceText: string;
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}) {
  const latestToolResult = getLatestAgentToolResult(options.toolResults);
  if (
    !(
      hasAgentDirectActionIntent(options.sourceText, options.userGoal)
      && isAgentSessionV2RecoverableUnverifiedToolResult(latestToolResult)
      && AGENT_TRANSITIONAL_POST_ACTION_STATES.has(
        resolveAgentRecoveryPostActionState({
          entry: latestToolResult,
          sourceText: options.sourceText,
          userGoal: options.userGoal,
        }),
      )
    )
  ) {
    return false;
  }

  if (isAgentSessionV2PrematureActionConfirmationText(options.decisionMessage)) {
    return true;
  }

  return Boolean(latestToolResult)
    && isAgentSessionV2RecoverableUnverifiedToolResult(latestToolResult)
    && hasAgentDesktopAutoRecoveryWaitBudgetRemaining(latestToolResult, options.toolResults);
}

function isAgentSessionV2UsefulPrimaryAction(value: unknown) {
  if (typeof value !== 'string') {
    return false;
  }

  const text = value.normalize('NFKC').trim().toLowerCase();
  return Boolean(text)
    && !/(?:unknown|unclear|not\s+(?:found|visible|clear)|none|null|n\/a|\u4e0d\u786e\u5b9a|\u4e0d\u6e05\u695a|\u672a\u77e5|\u672a\u627e\u5230|\u6ca1\u6709|\u65e0)/iu.test(text);
}

function isAgentSessionV2PrematureActionConfirmationText(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return false;
  }

  const text = value.normalize('NFKC').trim().toLowerCase();
  return /\b(?:do you want me to|want me to|should i|shall i|may i|can i)\b.{0,80}\b(?:click|press|continue|proceed|run|execute|start|open)\b/iu.test(text)
    || /\b(?:continue|proceed|go ahead)\??$/iu.test(text)
    || /(?:\u8981\u4e0d\u8981|\u662f\u5426|\u53ef\u4ee5\u5417|\u7ee7\u7eed\u5417|\u8981\u6211|\u9700\u8981\u6211).{0,24}(?:\u70b9|\u70b9\u51fb|\u6309|\u7ee7\u7eed|\u6267\u884c|\u542f\u52a8|\u6253\u5f00)/u.test(text)
    || /(?:\u5e2e\u4f60|\u5e2e\u60a8|\u6211\u6765).{0,16}(?:\u70b9|\u70b9\u51fb|\u6309|\u7ee7\u7eed|\u6267\u884c)/u.test(text)
    || /(?:\u4e0b\u4e00\u6b65|\u7ee7\u7eed).{0,8}(?:\u5417|\uff1f|\?)/u.test(text);
}

function hasAgentSessionV2ClearActionableVisualEvidence(
  entry: AgentSessionV2ToolResultEntry | null,
) {
  if (!entry || entry.result.ok === false) {
    return false;
  }

  const toolName = entry.command.toolCall?.name ?? null;
  const action = getAgentSessionV2ToolInputAction(entry.command);
  const isLocateOrVisualTool = toolName === 'locate_screen_elements'
    || isAgentSessionV2VisualToolCommand(entry.command)
    || (
      toolName === 'execute_desktop_observation'
      && (action === 'summarize_visual_snapshot' || action === 'inspect_window_ui')
    );
  if (!isLocateOrVisualTool) {
    return false;
  }

  if (
    entry.result.receipt?.status === 'unverified'
    || entry.result.assessment?.status === 'unverified'
    || Boolean(entry.result.stateSummary?.missingEvidence?.length)
    || Boolean(entry.result.stateSummary?.recommendedRecovery?.length)
  ) {
    return false;
  }

  const evidence = createAgentSessionV2EffectiveVisualActionEvidence(
    getAgentStructuredEvidence(entry),
  );
  if (evidence?.visualActionReadiness && evidence.visualActionReadiness !== 'ready') {
    return false;
  }
  if (isAgentSessionV2LauncherVerificationBlocking(evidence)) {
    return false;
  }

  return Boolean(
    evidence?.targetMatched
      && isAgentSessionV2UsefulPrimaryAction(evidence.primaryAction)
      && hasAgentSessionV2VerifiedPrimaryActionOwnership({ evidence })
      && (evidence.elementRegion || evidence.elementCenter || evidence.elementCenterRatio || evidence.elementBounds)
      && resolveAgentSessionV2VisualActionPoint(evidence)
      && evidence.confidence !== 'low'
      && evidence.coordinateConfidence !== 'low',
  );
}

function shouldRejectAgentSessionV2PrematureActionConfirmation(options: {
  decisionMessage?: string;
  sourceText: string;
  toolResults: AgentSessionV2ToolResultEntry[];
  userGoal: string;
}) {
  return hasAgentDirectActionIntent(options.sourceText, options.userGoal)
    && isAgentSessionV2PrematureActionConfirmationText(options.decisionMessage)
    && hasAgentSessionV2ClearActionableVisualEvidence(
      getLatestAgentToolResult(options.toolResults),
    );
}

const AGENT_SESSION_V2_RECOVERABLE_UNVERIFIED_TOOL_NAMES = new Set<AgentToolCallName>([
  'control_browser',
  'execute_desktop_observation',
  'execute_desktop_action',
  'execute_desktop_input',
  'execute_desktop_sequence',
  'execute_file_management_action',
  'locate_screen_elements',
  'manage_game_companion_loop',
  'organize_desktop_icons',
  'remember_local_app',
  'run_controlled_command',
  'run_local_project_action',
]);

function isAgentSessionV2RecoverableUnverifiedToolResult(
  entry: AgentSessionV2ToolResultEntry | null,
): entry is AgentSessionV2ToolResultEntry {
  const toolName = entry?.command.toolCall?.name ?? null;
  if (
    !entry
    || !toolName
    || !AGENT_SESSION_V2_RECOVERABLE_UNVERIFIED_TOOL_NAMES.has(toolName)
  ) {
    return false;
  }

  const structuredEvidence = getAgentStructuredEvidence(entry);
  if (entry.result.ok === false) {
    return Boolean(
      structuredEvidence?.postActionRecovery?.nextTool
        || entry.result.stateSummary?.recommendedRecovery?.length,
    );
  }

  return entry.result.receipt?.status === 'unverified'
    || entry.result.assessment?.status === 'unverified'
    || Boolean(inferAgentSelectionPostActionStateFromStructuredEvidence(entry))
    || Boolean(entry.result.stateSummary?.missingEvidence?.length)
    || Boolean(entry.result.stateSummary?.recommendedRecovery?.length);
}

function isAgentSessionV2LoginControlEvidence(
  evidence: AgentStructuredToolEvidence | null,
  options: { allowContinuation?: boolean } = {},
) {
  if (!evidence) {
    return false;
  }

  if (evidence.postActionState === 'login_required') {
    return true;
  }

  const text = [
    evidence.targetMatched,
    evidence.primaryAction,
    evidence.elementDescription,
    evidence.relation,
    ...((evidence.actionCandidates ?? []).flatMap((candidate) => [
      candidate.label,
      candidate.name,
      candidate.description,
    ])),
  ].filter(Boolean).join('\n');
  return /(?:login|log\s*in|sign\s*in|登录|登陆|快速\s*安全\s*登录)/iu.test(text)
    || options.allowContinuation === true && /(?:continue|confirm|继续|确认)/iu.test(text);
}

function shouldRejectAgentSessionV2IncompleteTaskProgressFinal(
  decision: AgentSessionV2Decision,
) {
  return Boolean(decision.understanding?.remainingGoals?.length);
}

function shouldRejectAgentSessionV2UnverifiedResultFinal(options: {
  decision: AgentSessionV2Decision;
  toolResults: AgentSessionV2ToolResultEntry[];
}) {
  const { decision } = options;
  const status = decision.understanding?.verificationStatus;
  if (
    !status
    && hasAgentSessionV2ConcreteVerifiedOutcomeEvidence(options.toolResults)
  ) {
    return false;
  }

  if (status === 'partial' || status === 'unknown') {
    return true;
  }

  if (
    (status === 'satisfied' || status === 'blocked')
    && !decision.understanding?.verificationEvidence?.length
  ) {
    return true;
  }

  return false;
}

function findLatestAgentSessionV2RecoverableUnverifiedActionAttempt(
  toolResults: AgentSessionV2ToolResultEntry[],
) {
  return [...toolResults].reverse().find((entry) => (
    isAgentActionResultTool(entry.command)
    && isAgentSessionV2RecoverableUnverifiedToolResult(entry)
  )) ?? null;
}

function findAgentSessionV2RepeatedUnverifiedActionRetry(options: {
  command: AgentChatCommand;
  toolResults: AgentSessionV2ToolResultEntry[];
}) {
  const candidateSignature = createAgentActionPrimitiveSignature(options.command);
  const previousAttempt = findLatestAgentSessionV2RecoverableUnverifiedActionAttempt(options.toolResults);
  if (!previousAttempt) {
    return null;
  }

  const previousSignature = createAgentActionPrimitiveSignature(previousAttempt.command);
  if (candidateSignature && previousSignature === candidateSignature) {
    return {
      candidateSignature,
      previousAttempt,
    };
  }

  const candidatePoints = getAgentSessionV2CommandClickPoints(options.command);
  const previousPoints = getAgentSessionV2CommandClickPoints(previousAttempt.command);
  const candidateActions = getAgentSessionV2CommandDesktopInputActions(options.command);
  const previousActions = getAgentSessionV2CommandDesktopInputActions(previousAttempt.command);
  const repeatedClickLikeAction = candidateActions.some((action) => (
    (action === 'click' || action === 'double_click')
    && previousActions.includes(action)
  ));
  if (
    repeatedClickLikeAction
    && candidatePoints.length
    && previousPoints.length
    && candidatePoints.some((point) => isAgentSessionV2NearPreviousActionPoint(point, previousPoints))
  ) {
    return {
      candidateSignature: candidateSignature
        ?? `near-click:${candidatePoints.map((point) => `${point.x},${point.y}`).join('|')}`,
      previousAttempt,
    };
  }

  return null;
}

function countAgentSessionV2RepeatedUnverifiedActionRetryRejections(
  steps: AgentSessionV2Step[],
  command: AgentChatCommand,
) {
  const signature = createAgentActionPrimitiveSignature(command);
  if (!signature) {
    return 0;
  }

  return steps.filter((step) => (
    step.errorText?.includes('Rejected repeated unverified action retry before approval')
    && step.errorText.includes(signature)
  )).length;
}

function hasRecentAgentSessionV2RepeatedUnverifiedActionRetryRejection(
  steps: AgentSessionV2Step[],
) {
  return steps
    .slice(-4)
    .some((step) => (
      step.errorText?.includes('Rejected repeated unverified action retry before approval')
      || step.summary?.includes('Rejected repeated unverified action retry before approval')
    ));
}

function createAgentSessionV2RepeatedUnverifiedActionRetryAnswer(
  command: AgentChatCommand,
  previousAttempt: AgentSessionV2ToolResultEntry,
) {
  const toolName = command.toolCall?.name ?? command.kind;
  const previousState = getAgentPostActionState(previousAttempt) || 'unverified';
  return [
    `I stopped before repeating the same unverified approval-required action for ${toolName}.`,
    `Previous post-action state: ${previousState}.`,
    'To continue safely, the Agent needs a different target, fresh observation, or a clear blocker/login/permission step handled first.',
  ].join('\n');
}

export async function runAgentProductionSessionImplementation(options: RunAgentSessionV2Options): Promise<AgentSessionV2Result> {
  const {
    approvedToolResult,
    initialCommand: requestedInitialCommand,
    authorizeModelIteration,
    authorizeRecovery,
    cancellationSignal,
    continuation,
    maxDurationMs = AGENT_SESSION_V2_DEFAULT_MAX_DURATION_MS,
    maxSteps = AGENT_SESSION_V2_MAX_STEPS,
  importedSkills = [],
    maxModelCalls = maxSteps,
    maxToolCalls = AGENT_SESSION_V2_DEFAULT_MAX_TOOL_CALLS,
    modelCaller = defaultAgentSessionV2ModelCaller,
    onProgress,
    personaBehaviorContract,
    settings,
    toolExecutor,
    v3PilotShadow,
    workingMemory,
    workingMemoryText,
  } = options;
  const sourceText = continuation?.sourceText ?? options.sourceText;
  const userGoal = continuation?.userGoal ?? options.userGoal;
  let initialCommand = continuation ? null : requestedInitialCommand ?? null;
  const diagnostics: AgentRuntimeDiagnosticEnvelope[] = [...(continuation?.diagnostics ?? [])];
  let taskState = continuation?.taskState ?? null;
  const steps: AgentSessionV2Step[] = [...(continuation?.steps ?? [])];
  const toolResults: AgentSessionV2ToolResultEntry[] = [...(continuation?.toolResults ?? [])];
  const historyLines: string[] = [...(continuation?.historyLines ?? [])];
  const traceEvents: AgentSessionV2TraceEvent[] = [...(continuation?.traceEvents ?? [])];
  const traceRecorder = createAgentTraceRecorder(traceEvents);
  const readOnlyToolCache: AgentSessionV2ReadOnlyToolCache = new Map();
  const getProductionLifecycleFacts = (): AgentRuntimeLifecycleFact[] => collectAgentRuntimeLifecycleFacts({
    entries: toolResults,
    isPostApprovalVerificationCommand: isAgentPostApprovalVerificationCommand,
  });
  const refreshTaskStateFromLatestEvidence = () => {
    if (!taskState || !toolResults.length) {
      return;
    }
    taskState = appendAgentRuntimeToolEvidence({
      entries: toolResults,
      state: taskState,
    });
  };
  const commitToolResult = (entry: AgentSessionV2ToolResultEntry) => {
    toolResults.push(entry);
    refreshTaskStateFromLatestEvidence();
    return entry;
  };
  const commitToolResults = (entries: AgentSessionV2ToolResultEntry[]) => {
    for (const entry of entries) {
      commitToolResult(entry);
    }
  };
  let v3PilotShadowInputCollector: AgentSessionV3PilotShadowInputCollector | null = null;
  let runAgentSessionV3PilotShadowEventList: (
    typeof import('./agentSessionV3PilotShadowMode')
  )['runAgentSessionV3PilotShadowEventList'] | null = null;
  if (v3PilotShadow?.enabled === true) {
    const [collectorModule, shadowModeModule] = await Promise.all([
      import('./agentSessionV3PilotShadowInputCollector'),
      import('./agentSessionV3PilotShadowMode'),
    ]);
    v3PilotShadowInputCollector = collectorModule.createAgentSessionV3PilotShadowInputCollector();
    runAgentSessionV3PilotShadowEventList = shadowModeModule.runAgentSessionV3PilotShadowEventList;
  }
  v3PilotShadowInputCollector?.appendStart('Begin AgentSessionV2 v3 pilot shadow sample.');
  const timingTracker = createAgentSessionV2TimingTracker({
    continuationTiming: continuation?.timing ?? null,
    maxDurationMs,
    maxModelCalls,
    maxToolCalls,
  });
  const createProgressSnapshot = () => ({
    diagnostics,
    historyLines,
    sourceText,
    steps,
    taskState,
    timing: timingTracker.snapshot(),
    traceEvents,
    toolResults,
    userGoal,
  });
  const appendTraceEvent = traceRecorder.append;
  const recoveryProposalAdapters = createAgentDesktopRecoveryCapabilityAdapter({
    resolvePostActionState: resolveAgentRecoveryPostActionState,
  });
  const proposeRecovery = (
    kind: 'automatic-observation' | 'failed-action',
    latestEntry: AgentSessionV2ToolResultEntry | null,
  ) => proposeAgentRecovery({
    adapters: recoveryProposalAdapters,
    request: {
      kind,
      latestEntry,
      sourceText,
      toolResults,
      userGoal,
    },
  });
  const createAgentSessionV2DebugInfo = (options: {
    pendingApproval?: AgentSessionV2PendingApproval | null;
    status: AgentSessionV2Status;
  }): AgentSessionV2DebugInfo | null => {
    const v4TaskShadow = createAgentTaskRuntimeV4SessionV2Shadow({
      productionLifecycleFacts: getProductionLifecycleFacts(),
      pendingApproval: options.pendingApproval ?? null,
      previousRuntimeShadowEvents: [
        ...diagnostics
          .filter((diagnostic) => (
            diagnostic.category === 'runtime-shadow'
            || diagnostic.category === 'approval-continuation'
          ))
          .map((diagnostic) => ({
            details: diagnostic.payload.details ?? undefined,
            status: diagnostic.payload.status ?? undefined,
            summary: diagnostic.payload.summary,
            tool: diagnostic.payload.tool ?? undefined,
          })),
        ...traceEvents
          .filter((event) => event.type === 'runtime_shadow')
          .map((event) => ({
            details: event.details,
            status: event.status,
            summary: event.summary,
            tool: event.tool,
          })),
      ],
      sourceText,
      status: options.status,
      taskId: `session-v2:${sourceText.slice(0, 80)}`,
      toolResults,
      userGoal,
    });

    return {
      v4TaskShadow,
      ...(v3PilotShadowInputCollector && runAgentSessionV3PilotShadowEventList
        ? {
            v3PilotShadow: runAgentSessionV3PilotShadowEventList({
              debugSummary: v3PilotShadow?.debugSummary ?? null,
              enabled: true,
              events: v3PilotShadowInputCollector.getEvents(),
              maxTransitions: v3PilotShadow?.maxTransitions ?? null,
            }),
          }
        : {}),
    };
  };
  const createFinalResult = (
    resultOptions: Pick<
      Parameters<typeof createAgentSessionV2FinalResult>[0],
      'finalAnswer' | 'status'
    > & Partial<Parameters<typeof createAgentSessionV2FinalResult>[0]>,
  ) => {
    const debug = resultOptions.debug ?? createAgentSessionV2DebugInfo({
      pendingApproval: resultOptions.pendingApproval ?? null,
      status: resultOptions.status,
    });
    return createAgentSessionV2FinalResult({
      ...resultOptions,
      debug,
      diagnostics,
      historyLines,
      sourceText,
      steps,
      taskState,
      timing: timingTracker.snapshot(),
      traceEvents,
      toolResults,
      userGoal,
    });
  };
  const createBudgetExceededResult = (finalAnswer?: string) => {
    const timing = timingTracker.snapshot();
    return createAgentSessionV2BudgetExceededResult({
      debug: createAgentSessionV2DebugInfo({
        pendingApproval: null,
        status: 'budget-exceeded',
      }),
      diagnostics,
      finalAnswer: finalAnswer ?? createAgentSessionV2BudgetExceededAnswer(timing),
      historyLines,
      sourceText,
      steps,
      taskState,
      timing,
      traceEvents,
      toolResults,
      userGoal,
    });
  };
  const appendV3PilotShadowPendingApproval = (
    assembly: ReturnType<typeof createAgentPendingApprovalAssembly>,
  ) => {
    if (!v3PilotShadowInputCollector) {
      return;
    }

    const latestEvent = v3PilotShadowInputCollector.getEvents().at(-1);
    if (latestEvent?.type === 'model-decision-accepted') {
      v3PilotShadowInputCollector.appendPendingApprovalAssembly(assembly);
      return;
    }

    if (latestEvent?.type === 'transaction-finished') {
      v3PilotShadowInputCollector.appendEvent({
        reason: assembly.finalAnswer,
        type: 'evaluation-needs-user',
      }, {
        kind: 'pending-approval',
        label: 'pending approval after transaction',
      });
    }
  };
  const appendV3PilotShadowNeedsMorePlanning = (reason: string) => {
    const latestEvent = v3PilotShadowInputCollector?.getEvents().at(-1);
    if (latestEvent?.type !== 'transaction-finished') {
      return;
    }

    v3PilotShadowInputCollector?.appendEvaluationRecovery(reason);
    v3PilotShadowInputCollector?.appendRecoveryModelRequested('AgentSessionV2 continued planning after the latest evidence.');
  };
  const rejectRepeatedUnverifiedActionRetry = (
    command: AgentChatCommand,
    stepIndex: number,
    understanding?: AgentSessionV2Understanding | null,
  ): { finalResult: AgentSessionV2Result | null; rejected: boolean } => {
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
  const createAgentSessionV2ProhibitedApprovalRejection = (
    command: AgentChatCommand,
    stepIndex: number,
    label: string,
  ): AgentSessionV2Result | null => {
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
  const prepareAgentSessionV2PendingApprovalResult = (
    approval: AgentSessionV2PendingApproval | null,
    stepIndex: number,
    label: string,
    understanding?: AgentSessionV2Understanding | null,
  ) => {
    if (!approval) {
      return { handled: false, result: null as AgentSessionV2Result | null };
    }

    const prohibitedApprovalResult = createAgentSessionV2ProhibitedApprovalRejection(
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
      return { handled: false, result: null as AgentSessionV2Result | null };
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
        return { handled: false, result: null as AgentSessionV2Result | null };
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
  const prepareDeterministicCharacterSkillResult = (
    stepIndex: number,
  ): { handled: boolean; result: AgentSessionV2Result | null } => {
    const route = resolveAgentDeterministicSkillRoute({
      approvedToolResult,
      stepIndex,
      steps,
      toolResults,
      userGoal,
    });
    if (!route.handled) {
      return { handled: false, result: null };
    }

    if (route.historyLine) {
      historyLines.push(route.historyLine);
    }
    if (route.step) {
      steps.push(route.step);
    }

    return prepareAgentSessionV2PendingApprovalResult(
      route.approval,
      stepIndex,
      'deterministic character animation skill',
    );
  };
  const executeVisualRefinementObservation = async (
    latestEntry: AgentSessionV2ToolResultEntry | null,
    triggerStepIndex: number,
  ): Promise<{ executed: boolean; finalResult: AgentSessionV2Result | null }> => {
    const refinementCommand = createAgentVisualRefinementCommand({
      latestEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    const refinementStepIndex = steps.length + 1;
    const refinementExecution = await runAgentVisualRefinementExecution({
      appendTraceEvent,
      command: refinementCommand,
      executeCommand: toolExecutor
        ? (command) => executeAgentSessionV2ToolCommandWithCache(
            command,
            toolExecutor,
            readOnlyToolCache,
            cancellationSignal,
          )
        : null,
      getTimingDetail: getAgentSessionV2TimingToolDetail,
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${refinementStepIndex} visual refinement result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      onStarted: ({ progressEvent, step }) => {
        historyLines.push([
          `Step ${triggerStepIndex} visual refinement:`,
          `tool=${step.tool ?? step.action}`,
          `args=${compactAgentSessionText(JSON.stringify(step.args ?? {}), 520)}`,
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
      stepIndex: refinementStepIndex,
      timingTracker,
    });
    if (refinementExecution.kind === 'not-executed') {
      if (refinementExecution.stage === 'permission') {
        historyLines.push([
          `Step ${triggerStepIndex} skipped visual refinement:`,
          `permission=${refinementExecution.reason}`,
        ].join('\n'));
      }
      return { executed: false, finalResult: null };
    }
    if (refinementExecution.kind === 'budget-exceeded') {
      return { executed: false, finalResult: createBudgetExceededResult() };
    }
    if (refinementExecution.kind === 'cancelled') {
      return {
        executed: true,
        finalResult: createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          status: 'cancelled',
        }),
      };
    }
    const refinementEntry = refinementExecution.collected.entry;
    const visualActionApproval = resolveAgentSessionV2VisualActionApproval({
      command: refinementEntry.command,
      result: refinementEntry.result,
      sourceText,
      toolResults,
      userGoal,
    });
    const visualApprovalResult = prepareAgentSessionV2PendingApprovalResult(
      visualActionApproval,
      refinementStepIndex,
      'visual-action approval after visual refinement',
      null,
    );
    if (visualApprovalResult.result) {
      return { executed: true, finalResult: visualApprovalResult.result };
    }
    if (visualApprovalResult.handled) {
      return { executed: true, finalResult: null };
    }

    // A UIA inspection may lead to the first coordinate-bearing visual
    // sample. Collect one more bounded sample before giving control back to
    // planning so coordinate consensus can form without a premature click.
    if (createAgentVisualRefinementCommand({
      latestEntry: refinementEntry,
      sourceText,
      toolResults,
      userGoal,
    })) {
      return executeVisualRefinementObservation(refinementEntry, steps.length);
    }

    return { executed: true, finalResult: null };
  };
  const executeInAppTargetLocateObservation = async (
    latestEntry: AgentSessionV2ToolResultEntry | null,
    triggerStepIndex: number,
  ): Promise<{ executed: boolean; finalResult: AgentSessionV2Result | null }> => {
    if (!toolExecutor) {
      return { executed: false, finalResult: null };
    }

    const latestToolName = latestEntry?.command.toolCall?.name ?? '';
    const latestAction = latestEntry
      ? getAgentSessionV2ToolInputAction(latestEntry.command)
      : '';
    const latestIsVisualObservation = latestToolName === 'locate_screen_elements'
      || Boolean(latestEntry && isAgentSessionV2VisualToolCommand(latestEntry.command))
      || latestToolName === 'execute_desktop_observation'
        && ['inspect_window_ui', 'summarize_visual_snapshot'].includes(latestAction);
    if (latestIsVisualObservation && !hasAgentActionableWindowTargetEvidence(latestEntry)) {
      historyLines.push([
        `Step ${triggerStepIndex} skipped duplicate in-app target locate:`,
        'The latest result is already a visual observation; continue with bounded visual review or planning instead of repeating the same locate request.',
      ].join('\n'));
      return { executed: false, finalResult: null };
    }

    // Visual fallback and the deterministic in-app gate can converge on the
    // same latest locate result. Let the shared gate own the result once it is
    // actionable, instead of dispatching a second identical observation.
    if (hasAgentActionableWindowTargetEvidence(latestEntry)) {
      return { executed: false, finalResult: null };
    }

    const inAppLocateRuntimeDecision = evaluateAgentActionRuntime({
      dependencies: actionRuntimeDependencies,
      latestEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    recordActionRuntimeDecision({
      decision: inAppLocateRuntimeDecision,
      latestEntry,
      source: 'in-app-target-locate',
    });
    if (inAppLocateRuntimeDecision.status === 'waiting') {
      historyLines.push([
        `Step ${triggerStepIndex} deferred in-app target locate:`,
        `postActionState=${inAppLocateRuntimeDecision.postActionState}`,
        `runtimeReason=${inAppLocateRuntimeDecision.reason}`,
        'The outer app/window is not ready yet; wait/recovery should run before locating the internal target.',
      ].join('\n'));
      return { executed: false, finalResult: null };
    }

    const locateStepIndex = steps.length + 1;
    const targetResolutionExecution = await runAgentTargetResolutionExecution({
      actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
      appendTraceEvent,
      executeCommand: (command) => executeAgentSessionV2ToolCommandWithCache(
        command,
        toolExecutor,
        readOnlyToolCache,
        cancellationSignal,
      ),
      getTimingDetail: getAgentSessionV2TimingToolDetail,
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      latestEntry,
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${locateStepIndex} in-app target locate result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(
          onProgress,
          progressEvent,
          createProgressSnapshot(),
        );
      },
      onStarted: ({ progressEvent, step }) => {
        historyLines.push([
          `Step ${triggerStepIndex} in-app target locate:`,
          `tool=${step.tool ?? step.action}`,
          `args=${compactAgentSessionText(JSON.stringify(step.args ?? {}), 520)}`,
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(
          onProgress,
          progressEvent,
          createProgressSnapshot(),
        );
      },
      resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
      sourceText,
      stepIndex: locateStepIndex,
      taskState,
      timingTracker,
      toolResults,
      userGoal,
    });
    if (targetResolutionExecution.kind === 'not-executed') {
      historyLines.push([
        `Step ${triggerStepIndex} skipped in-app target locate:`,
        `stage=${targetResolutionExecution.stage}`,
        `reason=${targetResolutionExecution.reason}`,
      ].join('\n'));
      return { executed: false, finalResult: null };
    }
    if (targetResolutionExecution.kind === 'budget-exceeded') {
      return {
        executed: false,
        finalResult: createBudgetExceededResult(),
      };
    }
    if (targetResolutionExecution.kind === 'cancelled') {
      return {
        executed: true,
        finalResult: createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          status: 'cancelled',
        }),
      };
    }

    const locateEntry = targetResolutionExecution.collected.entry;
    const locateCommand = locateEntry.command;
    const locateResult = locateEntry.result;

    const visualActionApproval = resolveAgentSessionV2VisualActionApproval({
      command: locateCommand,
      result: locateResult,
      sourceText,
      toolResults,
      userGoal,
    });
    const visualApprovalResult = prepareAgentSessionV2PendingApprovalResult(
      visualActionApproval,
      locateStepIndex,
      'visual-action approval after in-app target locate',
      null,
    );
    if (visualApprovalResult.result) {
      return { executed: true, finalResult: visualApprovalResult.result };
    }
    if (visualApprovalResult.handled) {
      return { executed: true, finalResult: null };
    }

    const visualRefinement = await executeVisualRefinementObservation(
      getLatestAgentToolResult(toolResults),
      steps.length,
    );
    if (visualRefinement.finalResult) {
      return visualRefinement;
    }

    return { executed: true, finalResult: null };
  };
  const executeFailedDesktopActionRecoveryObservation = async (
    latestEntry: AgentSessionV2ToolResultEntry | null,
    triggerStepIndex: number,
    sourceLabel: string,
  ): Promise<{ executed: boolean; finalResult: AgentSessionV2Result | null }> => {
    const recoveryProposal = proposeRecovery('failed-action', latestEntry);
    const recoveryStepIndex = steps.length + 1;
    const recoveryExecution = await runAgentRecoveryExecution({
      appendTraceEvent,
      authorizeRecovery,
      executeCommand: toolExecutor
        ? (command) => executeAgentSessionV2ToolCommandWithCache(
            command,
            toolExecutor,
            readOnlyToolCache,
            cancellationSignal,
          )
        : null,
      getTimingDetail: getAgentSessionV2TimingToolDetail,
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      kind: 'failed-action',
      onAuthorization: (decision) => {
        historyLines.push([
          `Step ${triggerStepIndex} Task Runtime recovery authorization:`,
          'kind=failed-action',
          `allowed=${decision.allowed}`,
          `attempt=${decision.attempt}/${decision.limit}`,
          `reason=${decision.reason}`,
        ].join('\n'));
      },
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${recoveryStepIndex} failed desktop action recovery result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      onStarted: ({ progressEvent, step }) => {
        historyLines.push([
          `Step ${triggerStepIndex} failed desktop action recovery:`,
          `source=${sourceLabel}`,
          `tool=${step.tool ?? step.action}`,
          `args=${compactAgentSessionText(JSON.stringify(step.args ?? {}), 520)}`,
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      proposal: recoveryProposal,
      reason: sourceLabel,
      requestedLimit: AGENT_RECOVERY_CONTROLLER_DEFAULT_MAX_TRANSITIONS,
      resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
      sourceText,
      stepIndex: recoveryStepIndex,
      taskState,
      timingTracker,
      traceSource: sourceLabel,
      userGoal,
    });
    if (recoveryExecution.kind === 'not-executed') {
      if (recoveryExecution.stage === 'proposal' && recoveryProposal.status === 'rejected') {
        historyLines.push(`Step ${triggerStepIndex} failed-action recovery rejected: ${recoveryProposal.reason}`);
      }
      if (recoveryExecution.stage === 'permission') {
        historyLines.push([
          `Step ${triggerStepIndex} skipped failed desktop action recovery:`,
          `source=${sourceLabel}`,
          `permission=${recoveryExecution.reason}`,
        ].join('\n'));
      }
      return { executed: false, finalResult: null };
    }
    if (recoveryExecution.kind === 'authorization-denied') {
      return {
        executed: false,
        finalResult: createFinalResult({
          finalAnswer: `Automatic recovery stopped after ${recoveryExecution.authorization.limit} authorized attempt(s). Fresh user input is required before more recovery work.`,
          status: 'needs-user',
        }),
      };
    }
    if (recoveryExecution.kind === 'budget-exceeded') {
      return { executed: false, finalResult: createBudgetExceededResult() };
    }
    if (recoveryExecution.kind === 'cancelled') {
      return {
        executed: true,
        finalResult: createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          status: 'cancelled',
        }),
      };
    }
    const recoveryEntry = recoveryExecution.collected.entry;
    const visualActionApproval = resolveAgentSessionV2VisualActionApproval({
      command: recoveryEntry.command,
      result: recoveryEntry.result,
      sourceText,
      toolResults,
      userGoal,
    });
    const visualApprovalResult = prepareAgentSessionV2PendingApprovalResult(
      visualActionApproval,
      recoveryStepIndex,
      'visual-action approval after failed desktop action recovery',
      null,
    );
    if (visualApprovalResult.result) {
      return { executed: true, finalResult: visualApprovalResult.result };
    }
    if (visualApprovalResult.handled) {
      return { executed: true, finalResult: null };
    }

    return { executed: true, finalResult: null };
  };
  const postActionTerminalEvaluatorDependencies: AgentPostActionTerminalEvaluatorDependencies = {
    collectAutoRecoveryEvidenceText: collectAgentDesktopAutoRecoveryEvidenceText,
    createAttemptedActionCoverage: (entries) => new Set(createAgentAttemptedActionCoverage({
      dependencies: agentSessionV2ActionCoverageDependencies,
      toolResults: entries,
    })),
    createRequestedActionCoverage: (options) => new Set(createAgentRequestedActionCoverage({
      dependencies: agentSessionV2ActionCoverageDependencies,
      ...options,
    })),
    getPostActionState: getAgentPostActionState,
    hasDirectActionIntent: hasAgentDirectActionIntent,
    inferSelectionPostActionState: inferAgentSelectionPostActionStateFromStructuredEvidence,
    isActionResultTool: isAgentActionResultTool,
    isAutoRecoveryReadCommand: isAgentDesktopAutoRecoveryReadCommand,
    isAutoRecoveryWaitCommand: isAgentDesktopAutoRecoveryWaitCommand,
    isInAppActionCovered: (attemptedCoverage) => isAgentActionKindCovered(
      'in-app-action',
      attemptedCoverage as Set<AgentRequestedActionKind>,
    ),
    isPostApprovalVerificationCommand: isAgentPostApprovalVerificationCommand,
    isVerifiedTargetWindowObservation: isAgentVerifiedTargetWindowObservation,
    resolveRecoveryPostActionState: resolveAgentRecoveryPostActionState,
  };
  const actionRuntimeDependencies: AgentActionRuntimeDependencies = {
    createAttemptedActionCoverage: (entries) => new Set(createAgentAttemptedActionCoverage({
      dependencies: agentSessionV2ActionCoverageDependencies,
      toolResults: entries,
    })),
    createRequestedActionCoverage: (options) => new Set(createAgentRequestedActionCoverage({
      dependencies: agentSessionV2ActionCoverageDependencies,
      ...options,
    })),
    evaluateTerminal: (options) => evaluateAgentPostActionTerminal({
      dependencies: postActionTerminalEvaluatorDependencies,
      ...options,
    }),
    hasDirectActionIntent: hasAgentDirectActionIntent,
    isActionKindCovered: (kind, attemptedCoverage) => isAgentActionKindCovered(
      kind as AgentRequestedActionKind,
      attemptedCoverage as Set<AgentRequestedActionKind>,
    ),
    isReadOnlyToolResult: isAgentSessionV2SilentReadOnlyToolResult,
    resolvePostActionState: resolveAgentRecoveryPostActionState,
  };
  let actionRuntimeQueue: AgentActionRuntimeQueue = {
    currentAction: null,
  };
  const recordActionRuntimeDecision = (options: {
    decision: ReturnType<typeof evaluateAgentActionRuntime>;
    latestEntry: AgentSessionV2ToolResultEntry | null;
    source: Parameters<typeof updateAgentActionRuntimeQueue>[0]['source'];
  }) => {
    actionRuntimeQueue = updateAgentActionRuntimeQueue({
      decision: options.decision,
      latestEntry: options.latestEntry,
      queue: actionRuntimeQueue,
      source: options.source,
    });
    const currentAction = actionRuntimeQueue.currentAction;
    if (!currentAction) {
      return;
    }

    historyLines.push([
      'ActionRuntime current action:',
      `id=${currentAction.id}`,
      `source=${currentAction.latestSource}`,
      `status=${currentAction.status}`,
      `reason=${currentAction.latestReason}`,
      currentAction.latestReason === 'missing-requested-coverage'
        ? 'taskFlow=continuation-required'
        : '',
      `postActionState=${currentAction.postActionState}`,
      `events=${currentAction.entries.length}`,
    ].filter(Boolean).join('\n'));
  };
  const recordRecoveryTriggerDecision = (options: {
    actionDecision: ReturnType<typeof evaluateAgentActionRuntime>;
    latestEntry: AgentSessionV2ToolResultEntry | null;
    triggerDecision: AgentRecoveryTriggerDecision;
  }) => {
    historyLines.push([
      'Recovery Controller trigger decision:',
      `action=${options.triggerDecision.action}`,
      `reason=${options.triggerDecision.reason}`,
      `actionStatus=${options.actionDecision.status}`,
      `postActionState=${options.actionDecision.postActionState}`,
      `latestTool=${options.latestEntry?.command.toolCall?.name ?? options.latestEntry?.command.kind ?? 'none'}`,
      `receiptStatus=${options.latestEntry?.result.receipt?.status ?? 'none'}`,
    ].join('\n'));
  };
  const decideRecoveryTrigger = (options: {
    actionDecision?: ReturnType<typeof evaluateAgentActionRuntime> | null;
    latestEntry: AgentSessionV2ToolResultEntry | null;
    permissionState?: 'clear' | 'waiting-approval' | 'blocked';
  }): AgentRecoveryTriggerDecision => {
    const actionDecision = options.actionDecision ?? evaluateAgentActionRuntime({
      dependencies: actionRuntimeDependencies,
      latestEntry: options.latestEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    const triggerDecision = decideAgentRecoveryTrigger({
      actionStatus: actionDecision.status,
      coverage: actionDecision.actionAttempted !== false && actionDecision.missingCoverage
        ? 'missing'
        : 'unknown',
      latestTool: options.latestEntry?.command.toolCall?.name
        ?? options.latestEntry?.command.kind
        ?? null,
      missingEvidence: actionDecision.reason === 'insufficient-evidence'
        || actionDecision.reason === 'no-latest-evidence',
      permissionState: options.permissionState ?? 'clear',
      postActionState: actionDecision.postActionState,
      receiptStatus: options.latestEntry?.result.receipt?.status ?? null,
      resultOk: options.latestEntry ? options.latestEntry.result.ok !== false : null,
      terminalStatus: actionDecision.terminalEvaluation?.status ?? null,
    });
    recordRecoveryTriggerDecision({
      actionDecision,
      latestEntry: options.latestEntry,
      triggerDecision,
    });
    return triggerDecision;
  };
  const createPostActionTerminalResultFromEvaluation = (
    latestEntry: AgentSessionV2ToolResultEntry,
    evaluation: AgentPostActionTerminalEvaluation,
    triggerStepIndex: number,
    sourceLabel: string,
  ) => {
    historyLines.push(createAgentPostActionTerminalStoppedHistoryLine({
      historyReason: evaluation.historyReason,
      postActionState: evaluation.postActionState,
      sourceLabel,
      status: evaluation.status,
      triggerStepIndex,
    }));
    steps.push({
      action: evaluation.stepAction,
      index: steps.length + 1,
      reason: evaluation.stepReason,
      summary: evaluation.finalAnswer,
      tool: latestEntry.command.toolCall?.name ?? latestEntry.command.kind,
    });
    return createFinalResult({
      finalAnswer: evaluation.finalAnswer,
      status: evaluation.status,
    });
  };
  const createReadOnlyObservationTerminalResult = (
    latestEntry: AgentSessionV2ToolResultEntry,
    triggerStepIndex: number,
    sourceLabel: string,
  ) => {
    const finalAnswer = latestEntry.result.responseText?.trim()
      || latestEntry.result.verification?.trim()
      || 'Read-only observation completed.';
    historyLines.push([
      `Step ${triggerStepIndex} Runtime read-only terminal:`,
      `source=${sourceLabel}`,
      'status=completed',
      'reason=successful read-only evidence satisfies the task without another model turn',
    ].join('\n'));
    steps.push({
      action: 'final_answer',
      index: steps.length + 1,
      reason: 'Runtime completed the read-only task from successful observation evidence.',
      summary: finalAnswer,
      tool: latestEntry.command.toolCall?.name ?? latestEntry.command.kind,
    });
    appendTraceEvent({
      action: 'final_answer',
      status: 'completed',
      stepIndex: steps.length,
      summary: 'Runtime completed successful read-only observation without another model decision.',
      type: 'final_answer',
    });
    return createFinalResult({
      finalAnswer,
      status: 'completed',
    });
  };
  const createPostActionTerminalResult = (
    latestEntry: AgentSessionV2ToolResultEntry | null,
    triggerStepIndex: number,
    sourceLabel: string,
  ) => {
    const actionRuntimeDecision = evaluateAgentActionRuntime({
      dependencies: actionRuntimeDependencies,
      latestEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    recordActionRuntimeDecision({
      decision: actionRuntimeDecision,
      latestEntry,
      source: 'post-action-terminal',
    });
    const evaluation = actionRuntimeDecision.terminalEvaluation ?? null;
    if (!latestEntry || !evaluation) {
      return null;
    }
    return createPostActionTerminalResultFromEvaluation(
      latestEntry,
      evaluation,
      triggerStepIndex,
      sourceLabel,
    );
  };
  const createRecoveryTriggerStopResult = (options: {
    decision: AgentRecoveryTriggerDecision;
    latestEntry: AgentSessionV2ToolResultEntry | null;
    sourceLabel: string;
    triggerStepIndex: number;
  }): AgentSessionV2Result | null => {
    if (options.decision.action !== 'stop-needs-user') {
      return null;
    }
    return createPostActionTerminalResult(
      options.latestEntry,
      options.triggerStepIndex,
      `${options.sourceLabel}:recovery-trigger-stop`,
    ) ?? createFinalResult({
          finalAnswer: '自动恢复已停止：最新证据表明需要用户处理，例如登录、验证码或其他确认。',
      status: 'needs-user',
    });
  };
  const executeAutoRecoveryObservation = async (
    latestEntry: AgentSessionV2ToolResultEntry | null,
    triggerStepIndex: number,
    sourceLabel: string,
    proposedCommand?: AgentChatCommand | null,
  ): Promise<{ executed: boolean; finalResult: AgentSessionV2Result | null }> => {
    const terminalBeforeRecovery = createPostActionTerminalResult(
      latestEntry,
      triggerStepIndex,
      'pre-auto-recovery',
    );
    if (terminalBeforeRecovery) {
      return { executed: false, finalResult: terminalBeforeRecovery };
    }

    const recoveryProposal = proposedCommand
      ? {
          command: proposedCommand,
          reason: 'Using the Recovery Controller proposal already selected by the active loop.',
          status: 'proposed' as const,
        }
      : proposeRecovery('automatic-observation', latestEntry);
    const recoveryStepIndex = steps.length + 1;
    const postActionState = resolveAgentRecoveryPostActionState({
      entry: latestEntry,
      sourceText,
      userGoal,
    });
    const recoveryExecution = await runAgentRecoveryExecution({
      appendTraceEvent,
      authorizeRecovery,
      executeCommand: toolExecutor
        ? (command) => executeAgentSessionV2ToolCommandWithCache(
            command,
            toolExecutor,
            readOnlyToolCache,
            cancellationSignal,
          )
        : null,
      getTimingDetail: getAgentSessionV2TimingToolDetail,
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      kind: 'automatic-observation',
      onAuthorization: (decision) => {
        historyLines.push([
          `Step ${triggerStepIndex} Task Runtime recovery authorization:`,
          'kind=automatic-observation',
          `allowed=${decision.allowed}`,
          `attempt=${decision.attempt}/${decision.limit}`,
          `reason=${decision.reason}`,
        ].join('\n'));
      },
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${recoveryStepIndex} automatic recovery observation result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      onStarted: ({ progressEvent, step }) => {
        historyLines.push([
          `Step ${triggerStepIndex} automatic recovery observation:`,
          `postActionState=${postActionState}`,
          `tool=${step.tool ?? step.action}`,
          `args=${compactAgentSessionText(JSON.stringify(step.args ?? {}), 520)}`,
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(onProgress, progressEvent, createProgressSnapshot());
      },
      postActionState,
      proposal: recoveryProposal,
      reason: sourceLabel,
      requestedLimit: AGENT_RECOVERY_CONTROLLER_DEFAULT_MAX_TRANSITIONS,
      resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
      sourceText,
      stepIndex: recoveryStepIndex,
      taskState,
      timingTracker,
      traceSource: 'auto-recovery',
      userGoal,
    });
    if (recoveryExecution.kind === 'not-executed') {
      if (recoveryExecution.stage === 'proposal' && recoveryProposal.status === 'rejected') {
        historyLines.push(`Step ${triggerStepIndex} automatic recovery rejected: ${recoveryProposal.reason}`);
      }
      if (recoveryExecution.stage === 'permission') {
        historyLines.push([
          `Step ${triggerStepIndex} skipped automatic recovery observation:`,
          `permission=${recoveryExecution.reason}`,
        ].join('\n'));
      }
      return { executed: false, finalResult: null };
    }
    if (recoveryExecution.kind === 'authorization-denied') {
      return {
        executed: false,
        finalResult: createFinalResult({
          finalAnswer: `Automatic recovery stopped after ${recoveryExecution.authorization.limit} authorized attempt(s). Fresh user input is required before more recovery work.`,
          status: 'needs-user',
        }),
      };
    }
    if (recoveryExecution.kind === 'budget-exceeded') {
      return { executed: false, finalResult: createBudgetExceededResult() };
    }
    if (recoveryExecution.kind === 'cancelled') {
      return {
        executed: true,
        finalResult: createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          status: 'cancelled',
        }),
      };
    }

    const terminalAfterRecovery = createPostActionTerminalResult(
      getLatestAgentToolResult(toolResults),
      recoveryStepIndex,
      'auto-recovery-result',
    );
    if (terminalAfterRecovery) {
      return { executed: true, finalResult: terminalAfterRecovery };
    }

    const latestRecoveryEntry = getLatestAgentToolResult(toolResults);
    if (!latestRecoveryEntry) {
      return { executed: true, finalResult: null };
    }
    const recoveryContinuationDispatch = await runAgentVerificationContinuation<AgentSessionV2Result>({
      actionRuntimeDependencies,
      adapters: {
        approval: ({ stepIndex, transition }) => {
          const approvalResult = prepareAgentSessionV2PendingApprovalResult(
            transition.approval,
            stepIndex,
            'visual-action approval after auto recovery',
            null,
          );
          return {
            executed: approvalResult.handled,
            finalResult: approvalResult.result,
          };
        },
        planning: () => ({ executed: false, finalResult: null }),
        recovery: ({ latestEntry, stepIndex }) => executeAutoRecoveryLoop(
          latestEntry,
          stepIndex,
          'post-approval-verification',
        ),
        refine: ({ latestEntry, stepIndex }) => executeVisualRefinementObservation(
          latestEntry,
          stepIndex,
        ),
        targetResolution: ({ latestEntry, stepIndex }) => (
          executeInAppTargetLocateObservation(latestEntry, stepIndex)
        ),
        terminal: ({ latestEntry, stepIndex, transition }) => {
          const terminalEvaluation = transition.actionDecision.terminalEvaluation;
          if (transition.kind === 'terminal' && terminalEvaluation) {
            return {
              executed: true,
              finalResult: createPostActionTerminalResultFromEvaluation(
                latestEntry,
                terminalEvaluation,
                stepIndex,
                'auto-recovery-result',
              ),
            };
          }
          return {
            executed: true,
            finalResult: createFinalResult({
          finalAnswer: '自动恢复已停止：最新证据表明需要用户处理，例如登录、验证码或其他确认。',
              status: 'needs-user',
            }),
          };
        },
        verification: () => ({ executed: false, finalResult: null }),
      },
      latestEntry: latestRecoveryEntry,
      onTransition: (transition) => {
        recordActionRuntimeDecision({
          decision: transition.actionDecision,
          latestEntry: latestRecoveryEntry,
          source: 'auto-recovery',
        });
        if (transition.recoveryDecision) {
          recordRecoveryTriggerDecision({
            actionDecision: transition.actionDecision,
            latestEntry: latestRecoveryEntry,
            triggerDecision: transition.recoveryDecision,
          });
        }
      },
      refinementAvailable: Boolean(createAgentVisualRefinementCommand({
        latestEntry: latestRecoveryEntry,
        sourceText,
        toolResults,
        userGoal,
      })),
      resolveVisualApproval: (request) => resolveAgentSessionV2VisualActionApproval(request),
      sourceText,
      stepIndex: steps.length,
      targetResolutionAvailable: isAgentTargetResolutionAvailable({
        actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
        latestEntry: latestRecoveryEntry,
        sourceText,
        taskState,
        toolResults,
        userGoal,
      }),
      toolResults,
      userGoal,
    });
    if (recoveryContinuationDispatch.loopDecision.action === 'return-final') {
      return {
        executed: true,
        finalResult: recoveryContinuationDispatch.loopDecision.finalResult,
      };
    }

    return { executed: true, finalResult: null };
  };
  const executeAutoRecoveryLoop = async (
    latestEntry: AgentSessionV2ToolResultEntry | null,
    triggerStepIndex: number,
    sourceLabel: string,
  ): Promise<{ executed: boolean; finalResult: AgentSessionV2Result | null }> => {
    let loopState = createAgentRecoveryLoopState({
      evidenceCount: toolResults.length,
    });
    while (true) {
      const currentEntry = getLatestAgentToolResult(toolResults) ?? latestEntry;
      const terminalResult = createPostActionTerminalResult(
        currentEntry,
        triggerStepIndex,
        `${sourceLabel}:loop-${loopState.transitionIndex}`,
      );
      const iterationDecision = transitionAgentRecoveryLoop(loopState, {
        cancellationRequested: isAgentSessionV2CancellationRequested(cancellationSignal),
        terminalAvailable: Boolean(terminalResult),
        type: 'iteration-check',
      });
      if (iterationDecision.action === 'stop-cancelled') {
        return {
          executed: loopState.executed,
          finalResult: createFinalResult({
            finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
            status: 'cancelled',
          }),
        };
      }
      if (iterationDecision.action === 'stop-terminal' && terminalResult) {
        return { executed: loopState.executed, finalResult: terminalResult };
      }
      if (iterationDecision.action === 'stop-limit-reached') {
        historyLines.push(createAgentAutoRecoveryLoopStoppedHistoryLine({
          reason: `loop-limit-reached-${loopState.maxTransitions}`,
          sourceLabel,
          triggerStepIndex,
        }));
        return { executed: loopState.executed, finalResult: null };
      }

      const recoveryProposal = proposeRecovery('automatic-observation', currentEntry);
      const proposalDecision = transitionAgentRecoveryLoop(loopState, {
        proposalStatus: recoveryProposal.status,
        type: 'proposal-resolved',
      });
      const recoveryCommand = recoveryProposal.command;
      if (proposalDecision.action !== 'execute-proposal' || !recoveryCommand) {
        if (loopState.executed) {
          historyLines.push(createAgentAutoRecoveryLoopStoppedHistoryLine({
            postActionState: resolveAgentRecoveryPostActionState({
              entry: currentEntry,
              sourceText,
              userGoal,
            }),
            reason: proposalDecision.action === 'stop-proposal-rejected'
              ? 'recovery-controller-rejected-proposal'
              : 'no-safe-read-only-recovery-command',
            sourceLabel,
            triggerStepIndex,
          }));
        }
        return { executed: loopState.executed, finalResult: null };
      }

      historyLines.push(createAgentAutoRecoveryLoopContinuedHistoryLine({
        loopIndex: loopState.transitionIndex,
        maxLoops: loopState.maxTransitions,
        nextAction: getAgentSessionV2ToolInputAction(recoveryCommand) || 'unknown',
        nextTool: recoveryCommand.toolCall?.name ?? recoveryCommand.kind,
        postActionState: resolveAgentRecoveryPostActionState({
          entry: currentEntry,
          sourceText,
          userGoal,
        }),
        sourceLabel,
        triggerStepIndex,
      }));

      const recovery = await executeAutoRecoveryObservation(
        currentEntry,
        steps.length,
        sourceLabel,
        recoveryCommand,
      );
      if (recovery.finalResult) {
        return { executed: true, finalResult: recovery.finalResult };
      }
      const executionDecision = transitionAgentRecoveryLoop(loopState, {
        evidenceCount: toolResults.length,
        executed: recovery.executed,
        type: 'execution-finished',
      });
      loopState = executionDecision.state;
      if (executionDecision.action === 'stop-execution-skipped') {
        return { executed: loopState.executed, finalResult: null };
      }
      if (executionDecision.action === 'stop-no-new-evidence') {
        historyLines.push(createAgentAutoRecoveryLoopStoppedHistoryLine({
          reason: 'recovery-did-not-produce-new-evidence',
          sourceLabel,
          triggerStepIndex,
        }));
        return { executed: loopState.executed, finalResult: null };
      }
      if (executionDecision.action === 'stop-limit-reached') {
        historyLines.push(createAgentAutoRecoveryLoopStoppedHistoryLine({
          postActionState: resolveAgentRecoveryPostActionState({
            entry: getLatestAgentToolResult(toolResults),
            sourceText,
            userGoal,
          }),
          reason: `loop-limit-reached-${loopState.maxTransitions}`,
          sourceLabel,
          triggerStepIndex,
        }));
        return { executed: loopState.executed, finalResult: null };
      }
    }
  };
  const executePostApprovalVerification = async (
    latestEntry: AgentSessionV2ToolResultEntry | null,
    triggerStepIndex: number,
  ): Promise<{ executed: boolean; finalResult: AgentSessionV2Result | null }> => {
    if (!toolExecutor) {
      return { executed: false, finalResult: null };
    }

    const verificationStepIndex = steps.length + 1;
    const verificationExecution = await runAgentVerificationExecution({
      actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
      appendTraceEvent,
      executeCommand: (command) => executeAgentSessionV2ToolCommandWithCache(
        command,
        toolExecutor,
        readOnlyToolCache,
        cancellationSignal,
      ),
      getTimingDetail: getAgentSessionV2TimingToolDetail,
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      latestEntry,
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${verificationStepIndex} post-approval verification result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(
          onProgress,
          progressEvent,
          createProgressSnapshot(),
        );
      },
      onStarted: ({ progressEvent, step }) => {
        historyLines.push([
          `Step ${triggerStepIndex} post-approval verification:`,
          `tool=${step.tool ?? step.action}`,
          `args=${compactAgentSessionText(JSON.stringify(step.args ?? {}), 520)}`,
        ].join('\n'));
        steps.push(step);
        emitAgentSessionV2Progress(
          onProgress,
          progressEvent,
          createProgressSnapshot(),
        );
      },
      resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
      sourceText,
      stepIndex: verificationStepIndex,
      taskState,
      timingTracker,
      toolResults,
      userGoal,
    });
    if (verificationExecution.kind === 'not-executed') {
      if (verificationExecution.stage === 'permission') {
        historyLines.push([
          `Step ${triggerStepIndex} skipped post-approval verification:`,
          `permission=${verificationExecution.reason}`,
        ].join('\n'));
      }
      return { executed: false, finalResult: null };
    }
    if (verificationExecution.kind === 'budget-exceeded') {
      return {
        executed: false,
        finalResult: createBudgetExceededResult(),
      };
    }
    if (verificationExecution.kind === 'cancelled') {
      return {
        executed: true,
        finalResult: createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          status: 'cancelled',
        }),
      };
    }

    const verificationEntry = verificationExecution.collected.entry;
    const verificationResult = verificationEntry.result;
    const continuationDispatch = await runAgentVerificationContinuation<AgentSessionV2Result>({
      actionRuntimeDependencies,
      adapters: {
        approval: ({ transition }) => {
          const visualApprovalResult = prepareAgentSessionV2PendingApprovalResult(
            transition.approval,
            verificationStepIndex,
            'visual-action approval after post-approval verification',
            null,
          );
          return {
            executed: visualApprovalResult.handled,
            finalResult: visualApprovalResult.result,
          };
        },
        planning: () => ({ executed: false, finalResult: null }),
        recovery: ({ latestEntry: continuationEntry, stepIndex }) => executeAutoRecoveryLoop(
          continuationEntry,
          stepIndex,
          'post-approval-verification',
        ),
        refine: ({ stepIndex }) => executeVisualRefinementObservation(
          getLatestAgentToolResult(toolResults),
          stepIndex,
        ),
        targetResolution: ({ latestEntry: continuationEntry, stepIndex }) => (
          executeInAppTargetLocateObservation(continuationEntry, stepIndex)
        ),
        terminal: ({ latestEntry: continuationEntry, transition }) => {
          const terminalEvaluation = transition.actionDecision.terminalEvaluation;
          if (transition.kind === 'terminal' && terminalEvaluation) {
            return {
              executed: true,
              finalResult: createPostActionTerminalResultFromEvaluation(
                continuationEntry,
                terminalEvaluation,
                verificationStepIndex,
                'post-approval-verification-result',
              ),
            };
          }
          return {
            executed: true,
            finalResult: createFinalResult({
              finalAnswer: 'Automatic recovery stopped because the latest verification evidence requires user input.',
              status: 'needs-user',
            }),
          };
        },
        verification: () => ({ executed: false, finalResult: null }),
      },
      latestEntry: verificationEntry,
      onTransition: (transition) => {
        const postApprovalActionRuntimeDecision = transition.actionDecision;
        recordActionRuntimeDecision({
          decision: postApprovalActionRuntimeDecision,
          latestEntry: verificationEntry,
          source: 'post-approval-verification',
        });
        historyLines.push([
          `Step ${verificationStepIndex} post-approval lifecycle decision:`,
          `status=${postApprovalActionRuntimeDecision.status}`,
          `reason=${postApprovalActionRuntimeDecision.reason}`,
          `postActionState=${postApprovalActionRuntimeDecision.postActionState}`,
        ].join('\n'));
        if (postApprovalActionRuntimeDecision.missingCoverage) {
          const missingPostApprovalActionCoverage = {
            attemptedCoverage: postApprovalActionRuntimeDecision.missingCoverage.attemptedCoverage as Set<AgentRequestedActionKind>,
            missingCoverage: postApprovalActionRuntimeDecision.missingCoverage.missingCoverage as AgentRequestedActionKind[],
            requestedCoverage: postApprovalActionRuntimeDecision.missingCoverage.requestedCoverage as Set<AgentRequestedActionKind>,
          };
          historyLines.push([
            `Step ${verificationStepIndex} incomplete action coverage after post-approval verification:`,
            createAgentUnattemptedRequestedActionFinalRejection({
              ...missingPostApprovalActionCoverage,
              decision: {
                action: 'final_answer',
                message: verificationResult.responseText,
              },
            }),
          ].join('\n'));
        }
        if (transition.recoveryDecision) {
          recordRecoveryTriggerDecision({
            actionDecision: postApprovalActionRuntimeDecision,
            latestEntry: verificationEntry,
            triggerDecision: transition.recoveryDecision,
          });
        }
      },
      refinementAvailable: Boolean(createAgentVisualRefinementCommand({
        latestEntry: verificationEntry,
        sourceText,
        toolResults,
        userGoal,
      })),
      resolveVisualApproval: (request) => resolveAgentSessionV2VisualActionApproval(request),
      sourceText,
      stepIndex: steps.length,
      targetResolutionAvailable: isAgentTargetResolutionAvailable({
        actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
        latestEntry: verificationEntry,
        sourceText,
        taskState,
        toolResults,
        userGoal,
      }),
      toolResults,
      userGoal,
    });
    if (continuationDispatch.loopDecision.action === 'return-final') {
      return {
        executed: true,
        finalResult: continuationDispatch.loopDecision.finalResult,
      };
    }

    return { executed: true, finalResult: null };
  };

  if (isAgentSessionV2CancellationRequested(cancellationSignal)) {
    return createFinalResult({
      finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
      status: 'cancelled',
    });
  }

  if (approvedToolResult) {
    const result = assessAgentCommandResult(
      approvedToolResult.command,
      approvedToolResult.result,
    );
    appendTraceEvent({
      details: createAgentToolFinishedTraceDetails(
        approvedToolResult.command,
        result,
        approvedToolResult.timing ?? null,
        { source: 'approved-tool-result' },
      ),
      status: result.ok === false
        ? 'failed'
        : result.receipt?.status ?? 'approved-result',
      stepIndex: steps.length + 1,
      summary: `Received approved tool result for ${approvedToolResult.command.toolCall?.name ?? approvedToolResult.command.kind}.`,
      tool: approvedToolResult.command.toolCall?.name ?? approvedToolResult.command.kind,
      type: 'tool_finished',
    });
    commitToolResult({
      command: approvedToolResult.command,
      result,
    });
    historyLines.push([
      'Approved tool result:',
      formatAgentToolResultForModel(approvedToolResult.command, result),
    ].join('\n'));
    steps.push({
      action: 'tool_result',
      errorText: result.errorText ?? null,
      index: steps.length + 1,
      ok: result.ok !== false,
      summary: result.responseText,
      tool: approvedToolResult.command.toolCall?.name ?? approvedToolResult.command.kind,
    });

    const approvedEntry = getLatestAgentToolResult(toolResults);
    const approvedActionRuntimeDecision = evaluateAgentActionRuntime({
      dependencies: actionRuntimeDependencies,
      latestEntry: approvedEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    recordActionRuntimeDecision({
      decision: approvedActionRuntimeDecision,
      latestEntry: approvedEntry,
      source: 'approved-tool-result',
    });
    historyLines.push([
      'Approved tool lifecycle decision:',
      `status=${approvedActionRuntimeDecision.status}`,
      `reason=${approvedActionRuntimeDecision.reason}`,
      approvedActionRuntimeDecision.reason === 'missing-requested-coverage'
        ? 'taskFlow=continuation-required'
        : '',
      `postActionState=${approvedActionRuntimeDecision.postActionState}`,
    ].filter(Boolean).join('\n'));
    const approvedRecoveryTrigger = decideRecoveryTrigger({
      actionDecision: approvedActionRuntimeDecision,
      latestEntry: approvedEntry,
    });

    const approvedResultVisualActionApproval = resolveAgentSessionV2VisualActionApproval({
      command: approvedToolResult.command,
      result,
      sourceText,
      toolResults,
      userGoal,
    });
    const approvedContinuationDispatch = await runAgentApprovedActionContinuation<AgentSessionV2Result>({
      actionDecision: approvedActionRuntimeDecision,
      adapters: {
        approval: ({ stepIndex, transition }) => {
          const approvalResult = prepareAgentSessionV2PendingApprovalResult(
            transition.approval,
            stepIndex,
            'visual-action approval after approved tool result',
            null,
          );
          return {
            executed: approvalResult.handled,
            finalResult: approvalResult.result,
          };
        },
        planning: () => ({ executed: false, finalResult: null }),
        recovery: async ({ latestEntry, stepIndex, transition }) => {
          if (transition.recoveryDecision?.action === 'failed-action') {
            const failedRecovery = await executeFailedDesktopActionRecoveryObservation(
              latestEntry,
              stepIndex,
              'approved-tool-result:lifecycle-failed',
            );
            if (failedRecovery.finalResult || !failedRecovery.executed) {
              return failedRecovery;
            }
          } else {
            const waitingRecovery = await executeAutoRecoveryLoop(
              latestEntry,
              stepIndex,
              'approved-tool-result:lifecycle-waiting',
            );
            if (waitingRecovery.finalResult || !waitingRecovery.executed) {
              return waitingRecovery;
            }
          }
          return executeInAppTargetLocateObservation(
            getLatestAgentToolResult(toolResults),
            steps.length,
          );
        },
        refine: () => ({ executed: false, finalResult: null }),
        targetResolution: ({ latestEntry, stepIndex }) => (
          executeInAppTargetLocateObservation(latestEntry, stepIndex)
        ),
        terminal: ({ latestEntry, stepIndex, transition }) => {
          const terminalEvaluation = transition.actionDecision.terminalEvaluation;
          if (transition.kind === 'terminal' && terminalEvaluation) {
            return {
              executed: true,
              finalResult: createPostActionTerminalResultFromEvaluation(
                latestEntry,
                terminalEvaluation,
                stepIndex,
                'approved-tool-result',
              ),
            };
          }
          return {
            executed: true,
            finalResult: createFinalResult({
              finalAnswer: 'Automatic recovery stopped because the approved action evidence requires user input.',
              status: 'needs-user',
            }),
          };
        },
        verification: ({ latestEntry, stepIndex }) => executePostApprovalVerification(
          latestEntry,
          stepIndex,
        ),
      },
      approval: approvedResultVisualActionApproval,
      latestEntry: approvedEntry,
      onTransition: (transition) => {
        historyLines.push([
          'Approved action continuation decision:',
          `kind=${transition.kind}`,
          `reason=${transition.reason}`,
        ].join('\n'));
      },
      recoveryDecision: approvedRecoveryTrigger,
      stepIndex: steps.length,
      taskState,
    });
    if (approvedContinuationDispatch.loopDecision.action === 'return-final') {
      return approvedContinuationDispatch.loopDecision.finalResult;
    }
  }

  const activeImportedSkillInstruction = formatActiveAgentImportedSkillInstruction(
    resolveExplicitAgentImportedSkillIntent(userGoal, importedSkills),
  );
  const importedSkillCatalog = formatAgentImportedSkillCatalog(importedSkills);
  let modelOutputRepairRuns = 0;
  const requestModelIteration = authorizeModelIteration
    ?? ((request) => authorizeAgentTaskRuntimeModelIteration({
      previous: request.taskState ?? null,
      request,
    }));

  while (true) {
    const modelLoopDecision = requestModelIteration({
      cancellationRequested: isAgentSessionV2CancellationRequested(cancellationSignal),
      requestedLimit: maxSteps,
      sourceText,
      taskState,
      userGoal,
    });
    taskState = modelLoopDecision.taskState;
    if (modelLoopDecision.action === 'stop-limit') {
      break;
    }
    if (modelLoopDecision.action === 'stop-cancelled') {
      return createFinalResult({
        finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
        historyLines,
        sourceText,
        status: 'cancelled',
        steps,
        toolResults,
        userGoal,
      });
    }
    const runStepIndex = modelLoopDecision.iteration;

    const stepIndex = steps.length + 1;
    const deterministicCharacterSkill = prepareDeterministicCharacterSkillResult(stepIndex);
    if (deterministicCharacterSkill.result) {
      return deterministicCharacterSkill.result;
    }
    if (deterministicCharacterSkill.handled) {
      continue;
    }

    const observedDisplayOpenMoveApproval = createAgentSessionV2ObservedDisplayOpenMoveApproval({
      sourceText,
      toolResults,
      userGoal,
    });
    const observedDisplayOpenMoveResult = prepareAgentSessionV2PendingApprovalResult(
      observedDisplayOpenMoveApproval,
      stepIndex,
      'deterministic open-and-move continuation after display observation',
    );
    if (observedDisplayOpenMoveResult.result) {
      return observedDisplayOpenMoveResult.result;
    }
    if (observedDisplayOpenMoveResult.handled) {
      continue;
    }

    // Once the outer app/window is observed, resolve the next in-app target
    // before asking the model to reconsider the whole task. This keeps the
    // compound-task boundary deterministic without naming a specific app.
    const latestBeforePlanning = getLatestAgentToolResult(toolResults);
    const latestToolNameBeforePlanning = latestBeforePlanning?.command.toolCall?.name ?? '';
    if (latestToolNameBeforePlanning !== 'locate_screen_elements') {
      const deterministicInAppTargetLocate = await executeInAppTargetLocateObservation(
        latestBeforePlanning,
        stepIndex,
      );
      if (deterministicInAppTargetLocate.finalResult) {
        return deterministicInAppTargetLocate.finalResult;
      }
      if (deterministicInAppTargetLocate.executed) {
        continue;
      }
    }

    const planningContext = createAgentPlanningContext({
      adapters: createAgentSessionV2PlanningContextAdapters(),
      sourceText,
      steps,
      toolResults,
      traceEvents,
      userGoal,
      workingMemory,
      workingMemoryText,
    });
    const modelInput = createAgentModelInput({
      formatWorkingMemory: createAgentGuardedWorkingMemoryText,
      historyLines,
      planningContext,
      sourceText,
      userGoal,
    });
    const preModelBudgetStopReason = timingTracker.getBudgetStopReason();
    if (preModelBudgetStopReason) {
      timingTracker.markStopReason(preModelBudgetStopReason);
      return createBudgetExceededResult();
    }

    emitAgentSessionV2Progress(
      onProgress,
      {
        message: runStepIndex === 1
          ? 'Agent is understanding the request and choosing the first step.'
          : 'Agent is reading the latest result and choosing the next step.',
        stepIndex,
        type: 'model-thinking',
      },
      createProgressSnapshot(),
    );

    const modelDecisionTurn = await runAgentModelDecisionTurn<AgentSessionV2Decision>({
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      modelCaller,
      modelRequest: {
        settings,
        signal: cancellationSignal,
        systemInstruction: [
          AGENT_SESSION_V2_SYSTEM_INSTRUCTION,
          importedSkillCatalog,
          activeImportedSkillInstruction,
          personaBehaviorContract?.trim() ?? '',
        ].filter(Boolean).join('\n\n'),
        userInput: modelInput,
      },
      parseDecision: parseAgentDecisionContract,
      repairRuns: modelOutputRepairRuns,
      stepIndex,
      timingTracker,
    });
    for (const traceEvent of modelDecisionTurn.traceEvents) {
      appendTraceEvent(traceEvent);
    }

    if (modelDecisionTurn.type === 'model-failed') {
      steps.push(modelDecisionTurn.step);
      v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);

      return createFinalResult({
        finalAnswer: `Model call failed: ${modelDecisionTurn.errorText}`,
        status: 'failed',
      });
    }

    if (modelDecisionTurn.type === 'cancelled-after-output') {
      v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
      return createFinalResult({
        finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
        status: 'cancelled',
      });
    }

    if (modelDecisionTurn.type === 'invalid-output') {
      if (modelOutputRepairRuns < AGENT_SESSION_V2_MODEL_OUTPUT_REPAIR_MAX_RUNS) {
        modelOutputRepairRuns += 1;
        historyLines.push([
          `Step ${stepIndex} rejected invalid model output:`,
          createAgentInvalidModelOutputRepairText(modelDecisionTurn.modelResponse),
        ].join('\n'));
        continue;
      }

      steps.push({
        action: 'final_answer',
        errorText: 'Model did not return valid AgentSessionV2 JSON.',
        index: stepIndex,
        modelResponse: modelDecisionTurn.modelResponse,
        summary: 'AgentSessionV2 model response was not valid JSON.',
        timing: modelDecisionTurn.timing,
      });

      return createFinalResult({
        finalAnswer: 'The model did not return a usable next step, so I stopped instead of treating normal chat as a command.',
        status: 'failed',
      });
    }

    const modelDecision = modelDecisionTurn.decision;
    const routedInitialToolCall = initialCommand?.toolCall;
    const decision = routedInitialToolCall
      ? {
          ...modelDecision,
          action: 'tool_call' as const,
          args: routedInitialToolCall.input,
          reason: 'The user explicitly selected a saved follow-up action; dispatch that exact action through the standard permission and approval lifecycle.',
          tool: routedInitialToolCall.name,
        }
      : modelDecision;
    if (routedInitialToolCall) {
      historyLines.push([
        'Explicit saved follow-up selected by the user:',
        `tool=${routedInitialToolCall.name}`,
        `args=${compactAgentSessionText(routedInitialToolCall.input, 360)}`,
      ].join('\n'));
      initialCommand = null;
    }
    steps.push(modelDecisionTurn.step);
    emitAgentSessionV2Progress(
      onProgress,
      {
        message: decision.action === 'tool_calls'
          ? 'Agent selected a parallel read-only observation batch.'
          : decision.action === 'tool_call'
            ? `Agent selected tool: ${decision.tool ?? 'unknown'}.`
            : decision.action === 'ask_user'
              ? 'Agent needs one more detail from the user.'
              : 'Agent is preparing the final answer.',
        stepIndex,
        type: 'model-decision',
      },
      createProgressSnapshot(),
    );

    if (decision.action === 'final_answer') {
      const latestToolResult = getLatestAgentToolResult(toolResults);
      const cappedAutoRecoveryBlockedFinal = hasAgentDirectActionIntent(sourceText, userGoal)
        && shouldAllowAgentSessionV2CappedAutoRecoveryFinal(
          decision,
          latestToolResult,
          toolResults,
          sourceText,
          userGoal,
        );
      if (
        hasAgentDirectActionIntent(sourceText, userGoal)
        && isAgentSessionV2RecoverableUnverifiedToolResult(latestToolResult)
        && !cappedAutoRecoveryBlockedFinal
      ) {
        historyLines.push([
          `Step ${stepIndex} rejected unverified recoverable tool final answer:`,
          createAgentRecoverableUnverifiedRejection(
            latestToolResult,
            decision.message,
          ),
        ].join('\n'));
        continue;
      }

      if (shouldRejectAgentSessionV2IncompleteTaskProgressFinal(decision)) {
        historyLines.push([
          `Step ${stepIndex} rejected incomplete task progress final answer:`,
          createAgentIncompleteTaskProgressFinalRejection(decision),
        ].join('\n'));
        continue;
      }

      if (shouldRejectAgentSessionV2UnverifiedResultFinal({
        decision,
        toolResults,
      })) {
        historyLines.push([
          `Step ${stepIndex} rejected unverified result final answer:`,
          createAgentUnverifiedResultFinalRejection(decision),
        ].join('\n'));
        continue;
      }

      if (
        !cappedAutoRecoveryBlockedFinal
        && shouldRejectAgentSessionV2PrematureDesktopOrganizationFinal({
          sourceText,
          toolResults,
          userGoal,
        })
      ) {
        historyLines.push([
          `Step ${stepIndex} rejected premature final answer:`,
          createAgentPrematureDesktopOrganizationFinalRejection({
            decisionMessage: decision.message,
          }),
        ].join('\n'));
        continue;
      }

      if (shouldRejectAgentSessionV2PrematureWindowMoveFinal({
        sourceText,
        toolResults,
        userGoal,
      })) {
        historyLines.push([
          `Step ${stepIndex} rejected premature final answer:`,
          createAgentPrematureWindowMoveFinalRejection({
            decisionMessage: decision.message,
          }),
        ].join('\n'));
        continue;
      }

      if (shouldRejectAgentSessionV2PrematureActionConfirmation({
        decisionMessage: decision.message,
        sourceText,
        toolResults,
        userGoal,
      }) && latestToolResult) {
        historyLines.push([
          `Step ${stepIndex} rejected premature action confirmation final answer:`,
          createAgentPrematureActionConfirmationRejection(
            latestToolResult,
            decision.message,
          ),
        ].join('\n'));
        continue;
      }

      if (shouldRejectAgentSessionV2ReadonlyObservationFinal({
        decision,
        sourceText,
        toolResults,
        userGoal,
      })) {
        historyLines.push([
          `Step ${stepIndex} rejected read-only observation final answer:`,
          createAgentReadonlyObservationFinalRejection({
            actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
            decision,
            sourceText,
            toolResults,
            userGoal,
          }),
        ].join('\n'));
        continue;
      }

      const missingActionCoverage = shouldRejectAgentSessionV2UnattemptedRequestedActionFinal({
        decision,
        sourceText,
        toolResults,
        userGoal,
      });
      if (missingActionCoverage) {
        historyLines.push([
          `Step ${stepIndex} rejected incomplete action coverage final answer:`,
          createAgentUnattemptedRequestedActionFinalRejection({
            ...missingActionCoverage,
            decision,
          }),
        ].join('\n'));
        continue;
      }

      if (cappedAutoRecoveryBlockedFinal) {
        appendTraceEvent({
          action: decision.action,
          details: {
            message: decision.message,
            verificationStatus: decision.understanding?.verificationStatus,
          },
          status: 'needs-user',
          stepIndex,
          summary: 'Accepted bounded recovery blocker with concrete evidence.',
          type: 'final_answer',
        });
        return createFinalResult({
          finalAnswer: decision.message ?? 'Automatic recovery stopped with a verified blocker.',
          historyLines,
          sourceText,
          status: 'needs-user',
          steps,
          toolResults,
          userGoal,
        });
      }

      if (hasAgentDirectActionIntent(sourceText, userGoal)) {
        const latestEvidenceEntry = getLatestAgentToolResult(toolResults);
        const requestedCoverage = new Set(createAgentRequestedActionCoverage({
          dependencies: agentSessionV2ActionCoverageDependencies,
          sourceText,
          userGoal,
        }));
        const attemptedCoverage = new Set(createAgentAttemptedActionCoverage({
          dependencies: agentSessionV2ActionCoverageDependencies,
          toolResults,
        }));
        const evidenceEvaluation = evaluateAgentEvidenceTerminal({
          coverageComplete: [...requestedCoverage].every((kind) => (
            isAgentActionKindCovered(kind, attemptedCoverage)
          )),
          directActionIntent: true,
          latestEntry: latestEvidenceEntry,
          postActionState: resolveAgentRecoveryPostActionState({
            entry: latestEvidenceEntry,
            sourceText,
            userGoal,
          }),
          readOnlyOnly: toolResults.length > 0
            && toolResults.every(isAgentSessionV2SilentReadOnlyToolResult),
          verifiedTargetState: latestEvidenceEntry
            ? isAgentVerifiedTargetWindowObservation(latestEvidenceEntry)
            : false,
        });
        if (evidenceEvaluation.status !== 'completed') {
          historyLines.push([
            `Step ${stepIndex} rejected final answer without Evidence Engine authorization:`,
            evidenceEvaluation.reason,
            `postActionState=${evidenceEvaluation.postActionState || 'unknown'}`,
          ].join('\n'));
          continue;
        }
      }

      appendTraceEvent({
        action: decision.action,
        details: {
          message: decision.message,
          verificationStatus: decision.understanding?.verificationStatus,
        },
        status: 'completed',
        stepIndex,
        summary: createAgentFinalAnswerAcceptedTraceSummary(),
        type: 'final_answer',
      });
      v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
      return createFinalResult({
        finalAnswer: decision.message ?? 'Done.',
        historyLines,
        sourceText,
        status: 'completed',
        steps,
        toolResults,
        userGoal,
      });
    }

    if (decision.action === 'ask_user') {
      const latestToolResult = getLatestAgentToolResult(toolResults);
      if (shouldRejectAgentSessionV2RecoverableUnverifiedAskUser({
        decisionMessage: decision.message,
        sourceText,
        toolResults,
        userGoal,
      }) && latestToolResult && !hasRecentAgentSessionV2RepeatedUnverifiedActionRetryRejection(steps)) {
        historyLines.push([
          `Step ${stepIndex} rejected transitional unverified ask_user:`,
          createAgentRecoverableUnverifiedRejection(
            latestToolResult,
            decision.message,
          ),
        ].join('\n'));
        continue;
      }

      if (shouldRejectAgentSessionV2PrematureActionConfirmation({
        decisionMessage: decision.message,
        sourceText,
        toolResults,
        userGoal,
      }) && latestToolResult) {
        historyLines.push([
          `Step ${stepIndex} rejected premature action confirmation ask_user:`,
          createAgentPrematureActionConfirmationRejection(
            latestToolResult,
            decision.message,
          ),
        ].join('\n'));
        continue;
      }

      v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
      return createFinalResult({
        finalAnswer: decision.message ?? 'I need one more detail from you before continuing.',
        historyLines,
        sourceText,
        status: 'needs-user',
        steps,
        toolResults,
        userGoal,
      });
    }

    if (decision.action === 'tool_calls') {
      const requestedTools = (decision.tools ?? []).map((requestedTool) => {
        const args = requestedTool.args ?? {};
        const normalizedArgs = bindAgentToolDisplayTargetToExplicitIntent({
          args,
          sourceText,
          toolName: requestedTool.tool,
          userGoal,
        });
        return normalizedArgs === args
          ? requestedTool
          : { ...requestedTool, args: normalizedArgs };
      });
      if (!requestedTools.length) {
        const errorText = 'Parallel tool_calls did not include any valid tools.';
        historyLines.push([
          `Step ${stepIndex} rejected parallel tool calls:`,
          errorText,
        ].join('\n'));
        steps.push({
          action: 'tool_result',
          errorText,
          index: steps.length + 1,
          ok: false,
          summary: errorText,
          tool: null,
          understanding: decision.understanding ?? null,
        });
        continue;
      }

      if (!toolExecutor) {
        const errorText = 'No local tool executor is available.';
        historyLines.push([
          `Step ${stepIndex} parallel tool execution failed:`,
          errorText,
        ].join('\n'));
        steps.push({
          action: 'tool_result',
          errorText,
          index: steps.length + 1,
          ok: false,
          summary: errorText,
          tool: requestedTools.map((toolCall) => toolCall.tool).join(', '),
          understanding: decision.understanding ?? null,
        });
        continue;
      }

      const parallelApprovalBatch = createAgentSessionV2ParallelApprovalBatch({
        reason: decision.reason,
        sourceText,
        tools: requestedTools,
        userGoal,
      });
      const parallelApprovalBatchResult = prepareAgentSessionV2PendingApprovalResult(
        parallelApprovalBatch,
        stepIndex,
        'merged approval-required tool_calls',
        decision.understanding ?? null,
      );
      if (parallelApprovalBatchResult.result) {
        return parallelApprovalBatchResult.result;
      }
      if (parallelApprovalBatchResult.handled) {
        continue;
      }

      const parallelPreparation = prepareAgentParallelToolCommands({
        dependencies: {
          buildCommand: ({ args, toolName }) => createAgentToolCommand({
            args,
            sourceText,
            toolName,
            userGoal,
          }),
          isAllowedToolName: (toolName) => AGENT_SESSION_V2_TOOL_NAMES.has(toolName as AgentToolCallName),
          isPrimaryToolName: isAgentSessionV2PrimaryToolName,
          isSilentReadOnlyCommand: (command) => {
            const route = buildAgentPermissionRoute(command);
            return {
              ok: isAgentPermissionRouteSilentReadOnly(route),
              requiresApproval: route.requiresApproval,
              routeStatus: route.status,
              routeSummary: route.summary,
            };
          },
          prepareToolInput: prepareAgentDecisionToolInput,
          rejectCompatibilityTool: createAgentCompatibilityToolRejection,
          rejectPreviousFailure: ({ args, toolName }) => {
            const previousFailure = findLatestFailedAgentSessionV2ToolCall(
              toolResults,
              toolName,
              args,
            );
            return previousFailure
              ? createAgentRepeatedFailedToolCallRejection({
                  args,
                  previousFailure,
                  toolName,
                })
              : null;
          },
          rejectVideoSummarySearch: ({ args, toolName }) => (
            shouldRejectAgentSessionV2VideoSummarySearch({
              args,
              sourceText,
              toolName,
              userGoal,
            })
              ? createAgentVideoSummarySearchRejection()
              : null
          ),
          resolveRedirect: ({ args, toolName }) => (
            shouldRedirectAgentSessionV2DisplayInfoToDesktopItems({
              args,
              sourceText,
              toolName,
              userGoal,
            })
              ? {
                  args: createAgentSessionV2DesktopItemObservationRedirectArgs({
                    args,
                    sourceText,
                    userGoal,
                  }),
                  toolName: 'execute_desktop_observation',
                }
              : shouldRedirectAgentSessionV2ReadOnlyDesktopActionToObservation({
                  args,
                  toolName,
                })
                ? {
                    args: createAgentSessionV2ReadOnlyDesktopActionObservationRedirectArgs({
                      args,
                    }),
                    toolName: 'execute_desktop_observation',
                  }
                : null
          ),
        },
        requestedTools,
        stepIndex,
      });
      for (const traceEvent of parallelPreparation.traceEvents) {
        appendTraceEvent(traceEvent);
      }
      const runnableCommands = parallelPreparation.runnableCommands;
      const deferredCommands = parallelPreparation.deferredCommands;
      const rejectedParallelToolLines = parallelPreparation.rejectedLines;

      if (!runnableCommands.length && !deferredCommands.length) {
        const errorText = [
          'Parallel tool_calls can only run silent read-only tools.',
          ...rejectedParallelToolLines,
        ].join('\n');
        if (
          rejectedParallelToolLines.some((line) => /(?:unavailable|invalid input)/u.test(line))
          && modelOutputRepairRuns < AGENT_SESSION_V2_MODEL_OUTPUT_REPAIR_MAX_RUNS
        ) {
          modelOutputRepairRuns += 1;
          historyLines.push([
            `Step ${stepIndex} rejected invalid parallel tool selection:`,
            errorText,
            `Allowed primary tools: ${AGENT_SESSION_V2_PRIMARY_TOOL_NAMES.join(', ')}`,
            'Choose valid primary tools only, fix args against the selected tool schema, or switch to one tool_call if the next step is not a silent read-only batch.',
          ].join('\n'));
          continue;
        }

        historyLines.push([
          `Step ${stepIndex} rejected parallel tool calls:`,
          errorText,
        ].join('\n'));
        steps.push({
          action: 'tool_result',
          errorText,
          index: steps.length + 1,
          ok: false,
          summary: errorText,
          tool: requestedTools.map((toolCall) => toolCall.tool).join(', '),
          understanding: decision.understanding ?? null,
        });
        continue;
      }

      const parallelExecutionPlan = createAgentSessionV2ParallelToolExecutionPlan(runnableCommands);
      v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
      v3PilotShadowInputCollector?.appendPreparedCommand({
        label: 'parallel read-only batch',
        reason: decision.reason ?? null,
        route: 'execute',
      });
      const parallelBudgetStopReason = timingTracker.getBudgetStopReason(
        parallelExecutionPlan.runCommands.length + parallelExecutionPlan.coveredCommands.length,
      );
      if (parallelBudgetStopReason) {
        timingTracker.markStopReason(parallelBudgetStopReason);
        return createBudgetExceededResult();
      }

      emitAgentSessionV2Progress(
        onProgress,
        {
          commands: parallelExecutionPlan.runCommands,
          message: parallelExecutionPlan.runCommands.length > 1
            ? `Agent is running ${parallelExecutionPlan.runCommands.length} read-only observations in parallel.`
            : 'Agent is running a read-only observation.',
          stepIndex,
          type: 'tools-running',
        },
        createProgressSnapshot(),
      );

      const parallelTransaction = await runAgentParallelToolTransaction({
        appendTraceEvent,
        createCoveredResult: ({ command, coveredByCommand, coveringResult, reason }) => (
          createAgentSessionV2CoveredParallelToolResult({
            command,
            coveredByCommand,
            coveringResult,
            reason,
          })
        ),
        executeCommand: (command) => executeAgentSessionV2ToolCommandWithCache(
          command,
          toolExecutor,
          readOnlyToolCache,
          cancellationSignal,
        ),
        getTimingDetail: getAgentSessionV2TimingToolDetail,
        plan: parallelExecutionPlan,
        resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
        stepIndex,
        timingTracker,
        traceAction: decision.action,
      });

      if (isAgentSessionV2CancellationRequested(cancellationSignal)) {
        return createFinalResult({
          finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
          historyLines,
          sourceText,
          status: 'cancelled',
          steps,
          toolResults,
          userGoal,
        });
      }
      const deferredBudgetStopReason = timingTracker.getBudgetStopReason(deferredCommands.length);
      if (deferredBudgetStopReason) {
        timingTracker.markStopReason(deferredBudgetStopReason);
        return createBudgetExceededResult();
      }
      const deferredResults = await runAgentDeferredToolTransactions({
        appendTraceEvent,
        commands: deferredCommands,
        executeCommand: (command) => executeAgentSessionV2ToolCommandWithCache(
          command,
          toolExecutor,
          readOnlyToolCache,
          cancellationSignal,
        ),
        getTimingDetail: getAgentSessionV2TimingToolDetail,
        resolveTimingStatus: (result) => resolveAgentSessionV2ToolTimingStatus(result, cancellationSignal),
        stepIndex,
        timingTracker,
        traceAction: decision.action,
      });


      const allParallelResults = [
        ...parallelTransaction.allResults,
        ...deferredResults,
      ];
      v3PilotShadowInputCollector?.appendParallelToolExecutionTransaction(parallelTransaction);

      commitToolResults(allParallelResults);
      historyLines.push([
        `Step ${stepIndex} parallel tool results:`,
        rejectedParallelToolLines.length ? `rejected=${rejectedParallelToolLines.join(' | ')}` : '',
        parallelExecutionPlan.coveredCommands.length
          ? `deduped=${parallelExecutionPlan.coveredCommands.map((covered) => (
            `${covered.command.toolCall?.name ?? covered.command.kind}<=${covered.coveredByCommand.toolCall?.name ?? covered.coveredByCommand.kind}: ${covered.reason}`
          )).join(' | ')}`
          : '',
        ...allParallelResults.map(({ command, result }) => formatAgentToolResultForModel(command, result)),
      ].filter(Boolean).join('\n\n'));

      for (const { command, result, timing } of allParallelResults) {
        steps.push({
          action: 'tool_result',
          errorText: result.errorText ?? null,
          index: steps.length + 1,
          ok: result.ok !== false,
          summary: result.responseText,
          timing,
          tool: command.toolCall?.name ?? command.kind,
          understanding: decision.understanding ?? null,
        });
        emitAgentSessionV2Progress(
          onProgress,
          {
            command,
            message: result.ok === false
              ? `Agent received a failed result from ${command.toolCall?.name ?? command.kind}.`
              : `Agent received a result from ${command.toolCall?.name ?? command.kind}.`,
            stepIndex: steps.length,
            type: 'tool-result',
          },
          createProgressSnapshot(),
        );

        const parallelEntry = { command, result, timing };
        const parallelActionDecision = evaluateAgentActionRuntime({
          dependencies: actionRuntimeDependencies,
          latestEntry: parallelEntry,
          sourceText,
          toolResults,
          userGoal,
        });
        recordActionRuntimeDecision({
          decision: parallelActionDecision,
          latestEntry: parallelEntry,
          source: 'unknown',
        });
        const parallelRecoveryTrigger = decideRecoveryTrigger({
          actionDecision: parallelActionDecision,
          latestEntry: parallelEntry,
        });
        const visualActionApproval = resolveAgentSessionV2VisualActionApproval({
          command,
          result,
          sourceText,
          toolResults,
          userGoal,
        });
        const approvalReadyFollowUp = resolveAgentSessionV2ApprovalReadyFollowUp({
          command,
          result,
          sourceText,
          userGoal,
        });
        const parallelContinuationDispatch = await runAgentToolOutcomeContinuation<AgentSessionV2Result>({
          actionDecision: parallelActionDecision,
          adapters: {
            approval: ({ transition }) => {
              const approvalResult = prepareAgentSessionV2PendingApprovalResult(
                transition.approval,
                stepIndex,
                'approvalSource' in transition && transition.approvalSource === 'approval-ready'
                  ? 'approval-ready follow-up'
                  : 'visual-action approval',
                decision.understanding ?? null,
              );
              return {
                executed: approvalResult.handled,
                finalResult: approvalResult.result,
              };
            },
            planning: () => ({ executed: false, finalResult: null }),
            recovery: () => ({ executed: false, finalResult: null }),
            refine: ({ latestEntry, stepIndex: continuationStepIndex }) => (
              executeVisualRefinementObservation(latestEntry, continuationStepIndex)
            ),
            targetResolution: () => ({ executed: false, finalResult: null }),
            terminal: ({ latestEntry, stepIndex: continuationStepIndex, transition }) => {
              const terminalEvaluation = transition.actionDecision.terminalEvaluation;
              if (transition.kind === 'terminal' && terminalEvaluation) {
                return {
                  executed: true,
                  finalResult: createPostActionTerminalResultFromEvaluation(
                    latestEntry,
                    terminalEvaluation,
                    continuationStepIndex,
                    'parallel-tool-result',
                  ),
                };
              }
              if (
                transition.kind === 'terminal'
                && transition.actionDecision.status === 'completed'
                && transition.actionDecision.reason === 'terminal-completed'
                && toolResults.every(isAgentSessionV2SilentReadOnlyToolResult)
              ) {
                return {
                  executed: true,
                  finalResult: createReadOnlyObservationTerminalResult(
                    latestEntry,
                    continuationStepIndex,
                    'parallel-tool-result',
                  ),
                };
              }
              return {
                executed: true,
                finalResult: createFinalResult({
                  finalAnswer: 'Parallel read-only evidence requires user input before the task can continue.',
                  status: 'needs-user',
                }),
              };
            },
            verification: () => ({ executed: false, finalResult: null }),
          },
          approvalReadyApproval: approvalReadyFollowUp,
          latestEntry: parallelEntry,
          onTransition: (transition) => {
            historyLines.push([
              `Step ${stepIndex} parallel tool outcome continuation decision:`,
              `kind=${transition.kind}`,
              `reason=${transition.reason}`,
            ].join('\n'));
          },
          recoveryDecision: parallelRecoveryTrigger,
          recoveryEnabled: false,
          refinementAvailable: Boolean(createAgentVisualRefinementCommand({
            latestEntry: parallelEntry,
            sourceText,
            toolResults,
            userGoal,
          })),
          stepIndex: steps.length,
          visualApproval: visualActionApproval,
        });
        const parallelLoopDecision = parallelContinuationDispatch.loopDecision;
        if (parallelLoopDecision.action === 'return-final') {
          return parallelLoopDecision.finalResult;
        }
        if (
          parallelLoopDecision.action === 'continue-runtime'
          && parallelLoopDecision.continuationKind === 'refine'
        ) {
          break;
        }
      }

      continue;
    }

    const toolName = decision.tool;
    if (!toolName || !AGENT_SESSION_V2_TOOL_NAMES.has(toolName as AgentToolCallName)) {
      appendTraceEvent({
        action: decision.action,
        details: {
          selectedTool: toolName,
        },
        status: 'unavailable-tool',
        stepIndex,
          summary: createAgentUnavailableToolRejectedTraceSummary(),
        tool: toolName ?? null,
        type: 'decision_rejected',
      });
      if (modelOutputRepairRuns < AGENT_SESSION_V2_MODEL_OUTPUT_REPAIR_MAX_RUNS) {
        modelOutputRepairRuns += 1;
        historyLines.push([
          `Step ${stepIndex} rejected unavailable tool selection:`,
          createAgentUnavailableToolRepairText({
            allowedPrimaryToolNames: AGENT_SESSION_V2_PRIMARY_TOOL_NAMES,
            toolName,
          }),
        ].join('\n'));
        continue;
      }

      const errorText = `Tool "${toolName ?? 'unknown'}" is not available in AgentSessionV2. Available tools: ${[...AGENT_SESSION_V2_TOOL_NAMES].join(', ')}.`;
      historyLines.push([
        `Step ${stepIndex} rejected tool call:`,
        errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        errorText,
        index: steps.length + 1,
        ok: false,
        summary: errorText,
        tool: toolName ?? null,
        understanding: decision.understanding ?? null,
      });
      continue;
    }

    let effectiveToolName = toolName as AgentToolCallName;
    let effectiveArgs = bindAgentToolDisplayTargetToExplicitIntent({
      args: decision.args ?? {},
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    });
    if (shouldRedirectAgentSessionV2DisplayInfoToDesktopItems({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    })) {
      effectiveToolName = 'execute_desktop_observation';
      effectiveArgs = createAgentSessionV2DesktopItemObservationRedirectArgs({
        args: effectiveArgs,
        sourceText,
        userGoal,
      });
      historyLines.push([
        `Step ${stepIndex} redirected desktop item inventory observation:`,
        'The user asked about desktop items/icons, so display-only metrics are insufficient.',
        'Using execute_desktop_observation action=list_desktop_items instead.',
        `args=${compactAgentSessionText(effectiveArgs, 360)}`,
      ].join('\n'));
    }
    if (shouldRedirectAgentSessionV2ReadOnlyDesktopActionToObservation({
      args: effectiveArgs,
      toolName: effectiveToolName,
    })) {
      effectiveToolName = 'execute_desktop_observation';
      effectiveArgs = createAgentSessionV2ReadOnlyDesktopActionObservationRedirectArgs({
        args: effectiveArgs,
      });
      historyLines.push([
        `Step ${stepIndex} redirected read-only desktop action:`,
        'The requested desktop action only reads local state, so it should not enter the action lifecycle.',
        'Using execute_desktop_observation instead.',
        `args=${compactAgentSessionText(effectiveArgs, 360)}`,
      ].join('\n'));
    }

    if (!isAgentSessionV2PrimaryToolName(effectiveToolName)) {
      const errorText = createAgentCompatibilityToolRejection(effectiveToolName);
      historyLines.push([
        `Step ${stepIndex} rejected compatibility-only tool call:`,
        errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        errorText,
        index: steps.length + 1,
        ok: false,
        summary: errorText,
        tool: effectiveToolName,
        understanding: decision.understanding ?? null,
      });
      continue;
    }

    if (shouldRejectAgentSessionV2VideoSummarySearch({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    })) {
      const errorText = createAgentVideoSummarySearchRejection();
      historyLines.push([
        `Step ${stepIndex} rejected video summary search:`,
        errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        errorText,
        index: steps.length + 1,
        ok: false,
        summary: errorText,
        tool: effectiveToolName,
        understanding: decision.understanding ?? null,
      });
      continue;
    }

    const openMoveSequenceRedirect = createAgentSessionV2OpenMoveSequenceRedirect({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    });
    if (openMoveSequenceRedirect) {
      effectiveToolName = 'execute_desktop_sequence';
      effectiveArgs = openMoveSequenceRedirect;
      historyLines.push([
        `Step ${stepIndex} composed open/move desktop sequence:`,
        `target=${getAgentSessionV2OpenWindowTarget(openMoveSequenceRedirect) || 'from sequence'}`,
        `display=${String(openMoveSequenceRedirect.targetDisplay ?? '') || inferAgentSessionV2DisplayTargetFromText(`${sourceText} ${userGoal}`) || 'unknown'}`,
      ].join('\n'));
    }

    const preparedToolInput = prepareAgentDecisionToolInput({
      args: effectiveArgs,
      toolName: effectiveToolName,
    });
    if (preparedToolInput.ok === false) {
      const errorText = preparedToolInput.error;
      appendTraceEvent({
        action: decision.action,
        details: {
          args: effectiveArgs,
          error: errorText,
          issue: preparedToolInput.issue,
        },
        status: 'invalid-tool-input',
        stepIndex,
        summary: `Decision contract rejected tool input for ${effectiveToolName}.`,
        tool: effectiveToolName,
        type: 'decision_rejected',
      });
      if (modelOutputRepairRuns < AGENT_SESSION_V2_MODEL_OUTPUT_REPAIR_MAX_RUNS) {
        modelOutputRepairRuns += 1;
        historyLines.push([
          `Step ${stepIndex} rejected invalid tool input:`,
          createAgentInvalidToolInputRepairText({
            args: effectiveArgs,
            error: errorText,
            toolName: effectiveToolName,
          }),
        ].join('\n'));
        continue;
      }

      historyLines.push([
        `Step ${stepIndex} rejected tool call:`,
        errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        args: effectiveArgs,
        errorText,
        index: steps.length + 1,
        ok: false,
        summary: errorText,
        tool: effectiveToolName,
        understanding: decision.understanding ?? null,
      });
      continue;
    }
    effectiveToolName = preparedToolInput.toolName;
    effectiveArgs = preparedToolInput.args;

    const windowTargetResolution = resolveAgentWindowTargetBeforeDispatch({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      toolResults,
      userGoal,
    });
    if (windowTargetResolution.kind === 'observe' && windowTargetResolution.command.toolCall) {
      historyLines.push([
        `Step ${stepIndex} converted unresolved window action to silent identity preflight:`,
        windowTargetResolution.reason,
        `requestedTool=${effectiveToolName}`,
        `requestedArgs=${compactAgentSessionText(effectiveArgs, 360)}`,
      ].join('\n'));
      effectiveToolName = windowTargetResolution.command.toolCall.name;
      effectiveArgs = windowTargetResolution.command.toolCall.input;
    } else if (windowTargetResolution.kind === 'ready') {
      effectiveArgs = windowTargetResolution.args;
      historyLines.push([
        `Step ${stepIndex} bound window action to observed identity:`,
        windowTargetResolution.reason,
        `hwnd=${String(effectiveArgs.hwnd ?? '')}`,
        `pid=${String(effectiveArgs.pid ?? '')}`,
        `processName=${String(effectiveArgs.processName ?? '')}`,
        `title=${String(effectiveArgs.title ?? '')}`,
      ].join('\n'));
    } else if (windowTargetResolution.kind === 'repair') {
      appendTraceEvent({
        action: decision.action,
        details: {
          args: effectiveArgs,
          reason: windowTargetResolution.reason,
        },
        status: 'window-target-unresolved',
        stepIndex,
        summary: 'Window action was rejected until one live HWND/PID identity is selected.',
        tool: effectiveToolName,
        type: 'decision_rejected',
      });
      historyLines.push([
        `Step ${stepIndex} rejected unresolved window action before approval:`,
        windowTargetResolution.reason,
      ].join('\n'));
      if (modelOutputRepairRuns < AGENT_SESSION_V2_MODEL_OUTPUT_REPAIR_MAX_RUNS) {
        modelOutputRepairRuns += 1;
        continue;
      }
      return createFinalResult({
        finalAnswer: windowTargetResolution.reason,
        status: 'needs-user',
      });
    }

    const visibleClickPreflightCommand = createAgentVisibleClickActionablePreflightCommand({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    });
    if (visibleClickPreflightCommand?.toolCall) {
      historyLines.push([
        `Step ${stepIndex} converted unresolved visible click to silent actionable preflight:`,
        `app=${String(effectiveArgs.app ?? '')}`,
        `target=${String(effectiveArgs.target ?? '')}`,
      ].join('\n'));
      effectiveToolName = visibleClickPreflightCommand.toolCall.name;
      effectiveArgs = visibleClickPreflightCommand.toolCall.input;
    }

    if (shouldRejectAgentSessionV2TransitionalDesktopAction({
      args: effectiveArgs,
      toolName: effectiveToolName,
    })) {
      const errorText = createAgentTransitionalDesktopActionRejection(effectiveArgs);
      historyLines.push([
        `Step ${stepIndex} rejected transitional desktop action:`,
        errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        errorText,
        index: steps.length + 1,
        ok: false,
        summary: errorText,
        tool: effectiveToolName,
        understanding: decision.understanding ?? null,
      });
      continue;
    }

    const previousFailedToolCall = findLatestFailedAgentSessionV2ToolCall(
      toolResults,
      effectiveToolName,
      effectiveArgs,
    );
    if (previousFailedToolCall) {
      const errorText = createAgentRepeatedFailedToolCallRejection({
        args: effectiveArgs,
        previousFailure: previousFailedToolCall,
        toolName: effectiveToolName,
      });
      if (
        countAgentSessionV2RepeatedFailedToolCallRejections(
          steps,
          effectiveToolName,
          effectiveArgs,
        ) >= 1
      ) {
        historyLines.push([
          `Step ${stepIndex} loop guard:`,
          `Repeated rejected failed tool call: ${effectiveToolName}`,
          `args=${compactAgentSessionText(effectiveArgs)}`,
          `previousFailure=${compactAgentSessionText(previousFailedToolCall.result.errorText ?? previousFailedToolCall.result.responseText ?? '')}`,
        ].join('\n'));

        v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
        v3PilotShadowInputCollector?.appendCommandUnavailable('Repeated rejected failed tool call loop guard prevented command preparation.');
        v3PilotShadowInputCollector?.appendRecoveryExhausted('Repeated rejected failed tool call loop guard stopped the run.');
        return createFinalResult({
          finalAnswer: createAgentSessionV2RepeatedFailureAnswer(
            effectiveToolName,
            previousFailedToolCall.result,
          ),
          historyLines,
          sourceText,
          status: 'failed',
          steps,
          toolResults,
          userGoal,
        });
      }

      historyLines.push([
        `Step ${stepIndex} rejected repeated failed tool call before execution:`,
        errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        args: effectiveArgs,
        errorText,
        index: steps.length + 1,
        ok: false,
        summary: errorText,
        tool: effectiveToolName,
        understanding: decision.understanding ?? null,
      });
      continue;
    }

    const command = createAgentToolCommand({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    });
    refreshTaskStateFromLatestEvidence();
    const commandExecution = await runAgentCommandExecution({
      appendTraceEvent,
      approvalReason: (route) => createAgentApprovalRequiredToolReason({
        decisionReason: decision.reason,
        permissionSummary: route.summary,
      }),
      command,
      executeCommand: toolExecutor
        ? (selectedCommand) => executeAgentSessionV2ToolCommandWithCache(
            selectedCommand,
            toolExecutor,
            readOnlyToolCache,
            cancellationSignal,
          )
        : null,
      getTimingDetail: getAgentSessionV2TimingToolDetail,
      isCancellationRequested: () => isAgentSessionV2CancellationRequested(cancellationSignal),
      onCollected: ({ entry, progressEvent, step }) => {
        commitToolResult(entry);
        historyLines.push([
          `Step ${stepIndex} tool result:`,
          formatAgentToolResultForModel(entry.command, entry.result),
        ].join('\n'));
        steps.push({
          ...step,
          index: steps.length + 1,
        });
        emitAgentSessionV2Progress(
          onProgress,
          {
            ...progressEvent,
            stepIndex: steps.length,
          },
          createProgressSnapshot(),
        );
      },
      onStarted: ({ progressEvent }) => {
        emitAgentSessionV2Progress(
          onProgress,
          progressEvent,
          createProgressSnapshot(),
        );
      },
      permissionTraceSummary: createAgentPermissionRoutedTraceSummary({
        toolName: effectiveToolName,
      }),
      resolveTimingStatus: (toolResult) => resolveAgentSessionV2ToolTimingStatus(toolResult, cancellationSignal),
      stepIndex,
      taskState,
      timingTracker,
      traceAction: decision.action,
      understanding: decision.understanding ?? null,
    });

    if (commandExecution.kind === 'permission-blocked' || commandExecution.kind === 'target-stale') {
      historyLines.push([
        `Step ${stepIndex} ${commandExecution.kind} result:`,
        commandExecution.errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        errorText: commandExecution.errorText,
        index: steps.length + 1,
        ok: false,
        summary: commandExecution.errorText,
        tool: effectiveToolName,
        understanding: decision.understanding ?? null,
      });
      continue;
    }

    if (commandExecution.kind === 'approval-required') {
      const prohibitedApprovalResult = createAgentSessionV2ProhibitedApprovalRejection(
        command,
        stepIndex,
        'initial model-selected approval',
      );
      if (prohibitedApprovalResult) {
        return prohibitedApprovalResult;
      }

      const repeatedRetry = rejectRepeatedUnverifiedActionRetry(
        command,
        stepIndex,
        decision.understanding ?? null,
      );
      if (repeatedRetry.finalResult) {
        return repeatedRetry.finalResult;
      }
      if (repeatedRetry.rejected) {
        continue;
      }

      const reason = commandExecution.approval.reason;
      historyLines.push([
        `Step ${stepIndex} selected approval-required tool:`,
        `tool=${effectiveToolName}`,
        `reason=${reason}`,
        `permission=${commandExecution.route.summary}`,
      ].join('\n'));
      appendTraceEvent({
        action: decision.action,
        details: {
          args: command.toolCall?.input ?? {},
          reason,
          routeSummary: commandExecution.route.summary,
        },
        status: 'needs-approval',
        stepIndex,
        summary: createAgentApprovalRequiredTraceSummary({
          toolName: effectiveToolName,
        }),
        tool: effectiveToolName,
        type: 'approval_required',
      });
      v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
      v3PilotShadowInputCollector?.appendPreparedCommand({
        label: effectiveToolName,
        reason,
        route: 'approval',
      });

      return createFinalResult({
        finalAnswer: reason,
        historyLines,
        pendingApproval: commandExecution.approval,
        sourceText,
        status: 'needs-approval',
        steps,
        toolResults,
        userGoal,
      });
    }

    if (commandExecution.kind === 'executor-unavailable') {
      historyLines.push([
        `Step ${stepIndex} tool execution failed:`,
        commandExecution.errorText,
      ].join('\n'));
      steps.push({
        action: 'tool_result',
        errorText: commandExecution.errorText,
        index: steps.length + 1,
        ok: false,
        summary: commandExecution.errorText,
        tool: effectiveToolName,
        understanding: decision.understanding ?? null,
      });
      continue;
    }

    if (commandExecution.kind === 'budget-exceeded') {
      v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
      v3PilotShadowInputCollector?.appendPreparedCommand({
        label: effectiveToolName,
        reason: decision.reason ?? null,
        route: 'execute',
      });
      return createBudgetExceededResult();
    }

    if (commandExecution.kind === 'cancelled') {
      return createFinalResult({
        finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
        historyLines,
        sourceText,
        status: 'cancelled',
        steps,
        toolResults,
        userGoal,
      });
    }

    const { entry: executedEntry } = commandExecution.collected;
    const result = executedEntry.result;
    const finishedToolTiming = executedEntry.timing ?? null;
    v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
    v3PilotShadowInputCollector?.appendPreparedCommand({
      label: effectiveToolName,
      reason: decision.reason ?? null,
      route: 'execute',
    });
    v3PilotShadowInputCollector?.appendToolExecutionTransaction({
      command,
      result,
      timing: finishedToolTiming,
    });

    const latestToolEntry = getLatestAgentToolResult(toolResults);
    if (!latestToolEntry) {
      appendV3PilotShadowNeedsMorePlanning('The latest single-tool result was unavailable after transaction commit.');
      continue;
    }
    const toolActionDecision = evaluateAgentActionRuntime({
      dependencies: actionRuntimeDependencies,
      latestEntry: latestToolEntry,
      sourceText,
      toolResults,
      userGoal,
    });
    recordActionRuntimeDecision({
      decision: toolActionDecision,
      latestEntry: latestToolEntry,
      source: 'unknown',
    });
    const toolRecoveryTrigger = decideRecoveryTrigger({
      actionDecision: toolActionDecision,
      latestEntry: latestToolEntry,
    });
    const immediateVisualActionApproval = resolveAgentSessionV2VisualActionApproval({
      command,
      result,
      sourceText,
      toolResults,
      userGoal,
    });
    const approvalReadyFollowUp = resolveAgentSessionV2ApprovalReadyFollowUp({
      command,
      result,
      sourceText,
      userGoal,
    });
    const toolContinuationDispatch = await runAgentToolOutcomeContinuation<AgentSessionV2Result>({
      actionDecision: toolActionDecision,
      adapters: {
        approval: ({ transition }) => {
          const approvalResult = prepareAgentSessionV2PendingApprovalResult(
            transition.approval,
            stepIndex,
            'approvalSource' in transition && transition.approvalSource === 'approval-ready'
              ? 'approval-ready follow-up'
              : 'visual-action approval before refinement or recovery',
            decision.understanding ?? null,
          );
          return {
            executed: approvalResult.handled,
            finalResult: approvalResult.result,
          };
        },
        planning: () => ({ executed: false, finalResult: null }),
        recovery: ({ latestEntry, stepIndex: continuationStepIndex, transition }) => (
          'recoveryMode' in transition && transition.recoveryMode === 'failed-action'
            ? executeFailedDesktopActionRecoveryObservation(
                latestEntry,
                continuationStepIndex,
                'single-tool-result',
              )
            : executeAutoRecoveryLoop(
                latestEntry,
                continuationStepIndex,
                'single-tool-result',
              )
        ),
        refine: ({ latestEntry, stepIndex: continuationStepIndex }) => (
          executeVisualRefinementObservation(latestEntry, continuationStepIndex)
        ),
        targetResolution: ({ latestEntry, stepIndex: continuationStepIndex }) => (
          executeInAppTargetLocateObservation(latestEntry, continuationStepIndex)
        ),
        terminal: ({ latestEntry, stepIndex: continuationStepIndex, transition }) => {
          const terminalEvaluation = transition.actionDecision.terminalEvaluation;
          if (transition.kind === 'terminal' && terminalEvaluation) {
            return {
              executed: true,
              finalResult: createPostActionTerminalResultFromEvaluation(
                latestEntry,
                terminalEvaluation,
                continuationStepIndex,
                'single-tool-result',
                ),
              };
            }
            if (
              transition.kind === 'terminal'
              && transition.actionDecision.status === 'completed'
              && transition.actionDecision.reason === 'terminal-completed'
              && toolResults.every(isAgentSessionV2SilentReadOnlyToolResult)
            ) {
              return {
                executed: true,
                finalResult: createReadOnlyObservationTerminalResult(
                  latestEntry,
                  continuationStepIndex,
                  'single-tool-result',
                ),
              };
            }
            return {
            executed: true,
            finalResult: createFinalResult({
              finalAnswer: 'Automatic recovery stopped because the latest tool evidence requires user input.',
              status: 'needs-user',
            }),
          };
        },
        verification: () => ({ executed: false, finalResult: null }),
      },
      approvalReadyApproval: approvalReadyFollowUp,
      latestEntry: latestToolEntry,
      onTransition: (transition) => {
        historyLines.push([
          `Step ${stepIndex} tool outcome continuation decision:`,
          `kind=${transition.kind}`,
          `reason=${transition.reason}`,
        ].join('\n'));
      },
      recoveryDecision: toolRecoveryTrigger,
      recoveryEnabled: true,
      refinementAvailable: Boolean(createAgentVisualRefinementCommand({
        latestEntry: latestToolEntry,
        sourceText,
        toolResults,
        userGoal,
      })),
      stepIndex: steps.length,
      targetResolutionAvailable: isAgentTargetResolutionAvailable({
        actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
        latestEntry: latestToolEntry,
        sourceText,
        taskState,
        toolResults,
        userGoal,
      }),
      visualApproval: immediateVisualActionApproval,
    });
    const toolLoopDecision = toolContinuationDispatch.loopDecision;
    if (toolLoopDecision.action === 'return-final') {
      return toolLoopDecision.finalResult;
    }
    if (toolLoopDecision.action === 'continue-runtime') {
      if (toolLoopDecision.continuationKind === 'refine') {
        appendV3PilotShadowNeedsMorePlanning('Visual refinement produced additional evidence for the next model decision.');
      } else if (toolLoopDecision.continuationKind === 'recovery') {
        appendV3PilotShadowNeedsMorePlanning('Runtime recovery produced additional evidence for the next model decision.');
      }
      continue;
    }

    if (
      result.ok === false
      && countFailedAgentSessionV2ToolCalls(
        toolResults,
        effectiveToolName,
        effectiveArgs,
      ) >= 2
    ) {
      historyLines.push([
        `Step ${stepIndex} loop guard:`,
        `Repeated failed tool call: ${effectiveToolName}`,
        `args=${compactAgentSessionText(effectiveArgs)}`,
        `lastError=${compactAgentSessionText(result.errorText ?? result.responseText ?? result.verification ?? '')}`,
      ].join('\n'));

      v3PilotShadowInputCollector?.appendEvaluationRecovery('Repeated failed tool call result requires terminal recovery exhaustion.');
      v3PilotShadowInputCollector?.appendRecoveryExhausted('Repeated failed tool call loop guard stopped the run.');
      return createFinalResult({
        finalAnswer: createAgentSessionV2RepeatedFailureAnswer(effectiveToolName, result),
        historyLines,
        sourceText,
        status: 'failed',
        steps,
        toolResults,
        userGoal,
      });
    }

    appendV3PilotShadowNeedsMorePlanning('AgentSessionV2 continued planning after the latest single-tool result.');
  }

  return createFinalResult({
    finalAnswer: createAgentSessionV2MaxStepsAnswer(maxSteps, toolResults),
    historyLines,
    sourceText,
    status: 'max-steps',
    steps,
    toolResults,
    userGoal,
  });
}
