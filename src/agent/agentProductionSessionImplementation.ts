import { createAgentProductionSessionResultContext } from './productionSession/sessionResultContext';
import { createAgentProductionActionOutcomeLifecycle } from './productionSession/actionOutcomeLifecycle';
import { createAgentProductionModelPlanningTurn } from './productionSession/modelPlanningTurn';
import { createAgentProductionFinalResponse } from './productionSession/finalResponse';
import { createAgentProductionSingleToolResultContinuation } from './productionSession/singleToolResultContinuation';
import { createAgentProductionSingleToolExecution } from './productionSession/singleToolExecution';
import { createAgentProductionExecutionPreflight } from './productionSession/executionPreflight';
import { createAgentProductionSingleToolSelection } from './productionSession/singleToolSelection';
import { createAgentProductionParallelPreparation } from './productionSession/parallelPreparation';
import { createAgentProductionParallelExecution } from './productionSession/parallelExecution';
import { createAgentProductionApprovedResultContinuation } from './productionSession/approvedResultContinuation';
import { createAgentProductionPostApprovalVerification } from './productionSession/postApprovalVerification';
import { createAgentProductionAutoRecoveryExecution } from './productionSession/autoRecoveryExecution';
import { createAgentProductionFailedActionRecoveryObservation } from './productionSession/failedActionRecoveryObservation';
import { createAgentProductionVisualObservationExecution } from './productionSession/visualObservationExecution';
import { createAgentProductionApprovalResult } from './productionSession/approvalResult';
import { createAgentProductionRetryEvidence } from './productionSession/retryEvidence';
import {
  AGENT_PRODUCTION_EXECUTION_CANCELLED_ANSWER as AGENT_SESSION_V2_CANCELLED_ANSWER,
  createAgentProductionExecutionTimingTracker as createAgentSessionV2TimingTracker,
  isAgentProductionExecutionCancellationRequested as isAgentSessionV2CancellationRequested,
  createAgentProductionExecutionCancelledToolResult as createAgentSessionV2CancelledToolResult,
  createAgentProductionExecutionTimingEntrySummary as createAgentSessionV2TimingEntrySummary,
  createAgentProductionExecutionToolTimingEntry as createAgentSessionV2ToolTimingEntry,
  resolveAgentProductionExecutionToolTimingStatus as resolveAgentSessionV2ToolTimingStatus,
  executeAgentProductionToolCommand as executeAgentSessionV2ToolCommand,
} from './productionSession/executionTiming';
import { createAgentProductionSessionPresentation, type AgentProductionPresentationDebugInfo } from './productionSession/sessionPresentation';
import { createAgentProductionDesktopActionEvidence } from './productionSession/desktopActionEvidence';
import { createAgentProductionFinalEvidenceGuards } from './productionSession/finalEvidenceGuards';
import { createAgentProductionDesktopRequestRouting } from './productionSession/desktopRequestRouting';
import { createAgentProductionObservationReuse, type AgentProductionReadOnlyToolCache as AgentSessionV2ReadOnlyToolCache } from './productionSession/observationReuse';
import { createAgentProductionApprovalPreparation } from './productionSession/approvalPreparation';
import { createAgentProductionVisualApproval } from './productionSession/visualApproval';
import { createAgentProductionVisualSequenceCommands } from './productionSession/visualSequenceCommands';
import { createAgentProductionVisualCandidateSelection } from './productionSession/visualCandidateSelection';
import { createAgentProductionVisualRetryEvidence } from './productionSession/visualRetryEvidence';
import {
  shouldRefineAgentProductionReadyVisualEvidence as shouldRefineAgentSessionV2ReadyVisualEvidence,
  resolveAgentProductionBestVisualRefinementCandidate as resolveAgentSessionV2BestVisualRefinementCandidate,
  createAgentProductionVisualRefinementFocusArgs as createAgentSessionV2VisualRefinementFocusArgs,
} from './productionSession/visualRefinementFocus';
import {
  isAgentVisualLauncherVerificationBlocking as isAgentSessionV2LauncherVerificationBlocking,
  hasAgentVisualVerifiedPrimaryActionOwnership as hasAgentSessionV2VerifiedPrimaryActionOwnership,
  isAgentVisualUsefulPrimaryAction as isAgentSessionV2UsefulPrimaryAction,
  hasAgentVisualCandidateTextOwnedActionEvidence as hasAgentSessionV2CandidateTextOwnedActionEvidence,
  createAgentEffectiveVisualActionEvidence as createAgentSessionV2EffectiveVisualActionEvidence,
} from './productionSession/visualCandidateEvidence';
import {
  resolveAgentVisualActionPoint as resolveAgentSessionV2VisualActionPoint,
} from './productionSession/visualCoordinates';
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
  type AgentToolCallName,
} from './agentChatCommand';
import {
  evaluateAgentVisualTargetVerification,
} from './agentVisualTargetVerification';
import { type AgentWorkingMemorySnapshot } from './agentChatContext';
import {
  resolveAgentResultFollowUpActions,
} from './agentResultAssessment';
import {
  buildAgentPermissionRoute,
  isAgentPermissionRouteSilentReadOnly,
} from './agentPermissionRouter';
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
  createAgentPlannerAvailableToolLines,
  listAgentToolNames,
} from './agentToolRegistry';
import {
  prepareAgentDecisionToolInput,
} from './runtime/agentDecisionContract';
import { bindAgentToolDisplayTargetToExplicitIntent } from './runtime/agentDisplayTargetIntent';
import {
  createAgentPlanningContext,
  type AgentPlanningContext,
  type AgentPlanningContextAdapters,
} from './runtime/agentPlanningContextRuntime';
import { createAgentWorkingMemoryConflictSignalText } from './runtime/agentWorkingMemoryConflict';
import { createAgentTaskProgressText } from './runtime/agentTaskProgressSignal';
import { createAgentResultVerificationSignalText } from './runtime/agentResultVerificationSignal';
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
  getAgentActionEvidence as getAgentActionEvidence,
  getAgentPostActionState as getAgentPostActionState,
  getAgentStructuredEvidence as getAgentStructuredEvidence,
  getLatestAgentToolResult as getLatestAgentToolResult,
  isAgentActionResultTool as isAgentActionResultTool,
} from './runtime/agentPlanningSignalEvidence';
import { formatAgentToolResultForModel } from './runtime/agentToolResultSummary';
import {
  createAgentRecentVisualContextText,
  createAgentVisualRecoveryText,
} from './runtime/agentVisualPlanningSignals';
import {
  createAgentApprovalReadyFollowUpReason,
  createAgentApprovalRequiredToolReason,
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
  isAgentDesktopAutoRecoveryCommand as isAgentDesktopAutoRecoveryCommand,
  isAgentDesktopAutoRecoveryReadCommand as isAgentDesktopAutoRecoveryReadCommand,
  isAgentDesktopAutoRecoveryWaitCommand as isAgentDesktopAutoRecoveryWaitCommand,
  resolveAgentDesktopAutoRecoveryMaxWaits as resolveAgentDesktopAutoRecoveryMaxWaits,
} from './capabilities/agentDesktopRecoveryObservationBuilder';
import { createAgentDesktopRecoveryCapabilityAdapter } from './capabilities/agentDesktopRecoveryCapabilityAdapter';
import { createAgentVisualRefinementCommand } from './capabilities/agentVisualRefinementCapabilityAdapter';
import {
  AGENT_RECOVERY_CONTROLLER_DEFAULT_MAX_TRANSITIONS,
  proposeAgentRecovery,
} from './runtime/agentRecoveryController';
import {
  hasAgentActionableWindowTargetEvidence,
} from './runtime/agentTargetResolutionContext';
import { resolveAgentWindowTargetBeforeDispatch } from './runtime/agentWindowTargetResolutionRuntime';
import {
  collectAgentRuntimeLifecycleFacts,
  type AgentRuntimeLifecycleFact,
} from './runtime/agentProductionLifecycleFacts';
import {
  dispatchAgentRuntimeContinuation,
} from './runtime/agentRuntimeContinuationDispatcher';
import {
  authorizeAgentTaskRuntimeModelIteration,
} from './runtime/agentTaskRuntime';
import { appendAgentRuntimeToolEvidence } from './runtime/agentRuntimeTaskEvidence';
import {
  evaluateAgentPostActionTerminal as evaluateAgentPostActionTerminal,
  type AgentPostActionTerminalEvaluation,
  type AgentPostActionTerminalEvaluatorDependencies as AgentPostActionTerminalEvaluatorDependencies,
} from './runtime/agentPostActionTerminalEvaluator';
import {
  createAgentAttemptedActionCoverage as createAgentAttemptedActionCoverage,
  createAgentRequestedActionCoverage as createAgentRequestedActionCoverage,
  hasAgentDirectActionIntent as hasAgentDirectActionIntent,
  hasAgentExplicitVideoSearchIntent as hasAgentExplicitVideoSearchIntent,
  isAgentActionKindCovered as isAgentActionKindCovered,
  isAgentPreviewOnlyIntent as isAgentPreviewOnlyIntent,
  isAgentVideoSummaryIntent as isAgentVideoSummaryIntent,
  type AgentActionCoverageDependencies as AgentActionCoverageDependencies,
  type AgentRequestedActionKind as AgentRequestedActionKind,
} from './runtime/agentActionCoverage';
import {
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
  createAgentInvalidToolInputRepairText,
  createAgentUnavailableToolRepairText,
} from './runtime/agentDecisionRepairSignal';
import {
  createAgentRepeatedFailedToolCallRejection,
  createAgentTransitionalDesktopActionRejection,
  createAgentVideoSummarySearchRejection,
} from './runtime/agentDecisionRejectionSignals';
import {
  createAgentToolFinishedTraceDetails,
  createAgentTraceRecorder,
} from './runtime/agentTraceEvents';
import {
  type AgentActionRuntimeDependencies,
} from './agentActionRuntime';
import { createAgentPendingApprovalAssembly as createAgentPendingApprovalAssembly } from './runtime/agentPendingApprovalAssembly';
import {
  createAgentUnavailableToolRejectedTraceSummary,
} from './runtime/agentDecisionTraceSummary';
import {
  type AgentSessionV3PilotShadowInputCollector,
} from './agentSessionV3PilotShadowInputCollector';
import {
  type AgentSessionV3PilotShadowDebugSummaryOptions,
} from './agentSessionV3PilotShadowMode';
import {
  createAgentTaskRuntimeV4SessionV2Shadow,
} from './agentTaskRuntimeV4SessionV2ShadowAdapter';
import { resolveAgentDeterministicSkillRoute as resolveAgentDeterministicSkillRoute } from './runtime/agentDeterministicSkillRoute';
import { AGENT_UNTRUSTED_TOOL_CONTENT_RULE } from './agentUntrustedToolContentRule';

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

export interface AgentSessionV2DebugInfo extends AgentProductionPresentationDebugInfo {}

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
  AGENT_UNTRUSTED_TOOL_CONTENT_RULE,
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
  '- If the user asks to open/start/play something inside another app or launcher (for example "在 A 里打开/启动 B", "open B in A", "start a game from a launcher"), treat it as an in-app UI operation, not as an OS lookup for B. First open/focus or observe the outer app/window A, then call locate_screen_elements on that app/window with sourceQuery/sourceId for A and targetText/targetDescription for B. Ask the visual tool to identify the target item, the primary open/start/play button associated with that target, approximate elementCenter/elementCenterRatio or screen region, confidence, and uncertainty. If the target and primary action are clear, use execute_desktop_sequence or execute_desktop_input so the app asks for one approval before clicking; prefer elementCenter coordinates over natural-language regions when available, include postVerifyQuery with the expected target/app/window/content name when known, then verify with observe_windows_and_apps or visual observation. If only an icon is recognized but the associated action/target relation is unclear, continue observing or ask one short question instead of declaring it impossible.',
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

export async function defaultAgentSessionV2ModelCaller(request: AgentSessionV2ModelRequest) {
  const { getAgentPlannerResponse } = await import('../services/geminiService');

  return getAgentPlannerResponse(
    request.userInput,
    request.systemInstruction,
    request.settings,
    request.signal,
  );
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

const {
  findLatestFailedAgentProductionRetryToolCall: findLatestFailedAgentSessionV2ToolCall,
  countFailedAgentProductionRetryToolCalls: countFailedAgentSessionV2ToolCalls,
  countAgentProductionRetryRepeatedFailedToolCallRejections: countAgentSessionV2RepeatedFailedToolCallRejections,
  isAgentProductionRetryRecoverableUnverifiedToolResult: isAgentSessionV2RecoverableUnverifiedToolResult,
  findLatestAgentProductionRetryRecoverableUnverifiedActionAttempt: findLatestAgentSessionV2RecoverableUnverifiedActionAttempt,
  findAgentProductionRetryRepeatedUnverifiedActionRetry: findAgentSessionV2RepeatedUnverifiedActionRetry,
  countAgentProductionRetryRepeatedUnverifiedActionRetryRejections: countAgentSessionV2RepeatedUnverifiedActionRetryRejections,
  hasRecentAgentProductionRetryRepeatedUnverifiedActionRetryRejection: hasRecentAgentSessionV2RepeatedUnverifiedActionRetryRejection,
  createAgentProductionRetryRepeatedUnverifiedActionRetryAnswer: createAgentSessionV2RepeatedUnverifiedActionRetryAnswer,
} = createAgentProductionRetryEvidence({
  getCommandClickPoints: (command) => getAgentSessionV2CommandClickPoints(command),
  getCommandDesktopInputActions: (command) => getAgentSessionV2CommandDesktopInputActions(command),
  isNearPreviousActionPoint: (point, previousPoints) => isAgentSessionV2NearPreviousActionPoint(point, previousPoints),
});

const agentProductionVisualRetryEvidence = createAgentProductionVisualRetryEvidence({
  findRecoverableUnverifiedActionAttempt: findLatestAgentSessionV2RecoverableUnverifiedActionAttempt,
  resolveRecoveryPostActionState: (options) => resolveAgentRecoveryPostActionState(options),
});
const {
  getAgentProductionCommandClickPoints: getAgentSessionV2CommandClickPoints,
  isAgentProductionNearPreviousActionPoint: isAgentSessionV2NearPreviousActionPoint,
  normalizeAgentProductionToolActionName: normalizeAgentSessionV2ToolActionName,
} = agentProductionVisualRetryEvidence;
const {
  getAgentProductionDesktopActionName: getAgentSessionV2DesktopActionName,
  shouldRejectAgentProductionTransitionalDesktopAction: shouldRejectAgentSessionV2TransitionalDesktopAction,
  shouldRejectAgentProductionPrematureDesktopOrganizationFinal: shouldRejectAgentSessionV2PrematureDesktopOrganizationFinal,
  shouldRejectAgentProductionPrematureWindowMoveFinal: shouldRejectAgentSessionV2PrematureWindowMoveFinal,
} = createAgentProductionDesktopActionEvidence({
  normalizeToolActionName: normalizeAgentSessionV2ToolActionName,
  hasDesktopOrganizationRequest: (text) => hasAgentSessionV2DesktopOrganizationRequest(text),
  hasWindowMoveToDisplayRequest: (text) => hasAgentSessionV2WindowMoveToDisplayRequest(text),
  isRecoverableUnverifiedToolResult: isAgentSessionV2RecoverableUnverifiedToolResult,
});

const {
  hasAgentProductionDesktopOrganizationRequest: hasAgentSessionV2DesktopOrganizationRequest,
  hasAgentProductionWindowMoveToDisplayRequest: hasAgentSessionV2WindowMoveToDisplayRequest,
  inferAgentProductionDisplayTargetFromText: inferAgentSessionV2DisplayTargetFromText,
  getAgentProductionOpenWindowTarget: getAgentSessionV2OpenWindowTarget,
  createAgentProductionOpenMoveSequenceRedirect: createAgentSessionV2OpenMoveSequenceRedirect,
  createAgentProductionObservedDisplayOpenMoveApproval: createAgentSessionV2ObservedDisplayOpenMoveApproval,
  shouldRedirectAgentProductionDisplayInfoToDesktopItems: shouldRedirectAgentSessionV2DisplayInfoToDesktopItems,
  shouldRedirectAgentProductionReadOnlyDesktopActionToObservation: shouldRedirectAgentSessionV2ReadOnlyDesktopActionToObservation,
  createAgentProductionReadOnlyDesktopActionObservationRedirectArgs: createAgentSessionV2ReadOnlyDesktopActionObservationRedirectArgs,
  createAgentProductionDesktopItemObservationRedirectArgs: createAgentSessionV2DesktopItemObservationRedirectArgs,
} = createAgentProductionDesktopRequestRouting({
  getDesktopActionName: getAgentSessionV2DesktopActionName,
});

const agentProductionVisualCandidateSelection = createAgentProductionVisualCandidateSelection(agentProductionVisualRetryEvidence);

const agentProductionVisualSequenceCommands = createAgentProductionVisualSequenceCommands({
  isLoginControlEvidence: isAgentSessionV2LoginControlEvidence,
  retryEvidence: agentProductionVisualRetryEvidence,
});

const {
  resolveAgentProductionTargetSelectionApproval: resolveAgentSessionV2TargetSelectionApproval,
  createAgentProductionParallelApprovalBatch: createAgentSessionV2ParallelApprovalBatch,
} = createAgentProductionApprovalPreparation({
  retryEvidence: agentProductionVisualRetryEvidence,
  sequenceCommands: agentProductionVisualSequenceCommands,
  isLoginControlEvidence: isAgentSessionV2LoginControlEvidence,
  toolNames: AGENT_SESSION_V2_TOOL_NAMES,
  isPrimaryToolName: isAgentSessionV2PrimaryToolName,
  rejectVideoSummarySearch: shouldRejectAgentSessionV2VideoSummarySearch,
  rejectTransitionalDesktopAction: shouldRejectAgentSessionV2TransitionalDesktopAction,
});

const {
  getAgentProductionToolInputAction: getAgentSessionV2ToolInputAction,
  isAgentProductionVisualToolCommand: isAgentSessionV2VisualToolCommand,
  getAgentProductionCommandDesktopInputActions: getAgentSessionV2CommandDesktopInputActions,
  resolveAgentProductionVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
} = createAgentProductionVisualApproval({
  retryEvidence: agentProductionVisualRetryEvidence,
  candidateSelection: agentProductionVisualCandidateSelection,
  sequenceCommands: agentProductionVisualSequenceCommands,
  findRecoverableUnverifiedActionAttempt: findLatestAgentSessionV2RecoverableUnverifiedActionAttempt,
  isLoginControlEvidence: isAgentSessionV2LoginControlEvidence,
  hasClearActionableVisualEvidence: hasAgentSessionV2ClearActionableVisualEvidence,
  resolveTargetSelectionApproval: resolveAgentSessionV2TargetSelectionApproval,
});

const agentProductionObservationReuse = createAgentProductionObservationReuse({
  getToolInputAction: getAgentSessionV2ToolInputAction,
  isCancellationRequested: isAgentSessionV2CancellationRequested,
  createCancelledToolResult: createAgentSessionV2CancelledToolResult,
  executeToolCommand: executeAgentSessionV2ToolCommand,
});
export const {
  isAgentProductionCacheableReadOnlyToolCommand: isAgentSessionV2CacheableReadOnlyToolCommand,
  createAgentProductionReadOnlyToolCacheKey: createAgentSessionV2ReadOnlyToolCacheKey,
  createAgentProductionParallelToolExecutionPlan: createAgentSessionV2ParallelToolExecutionPlan,
  createAgentProductionCoveredParallelToolResult: createAgentSessionV2CoveredParallelToolResult,
} = agentProductionObservationReuse;
const {
  executeAgentProductionToolCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
  isAgentProductionParallelDedupeResult: isAgentSessionV2ParallelDedupeResult,
} = agentProductionObservationReuse;

const {
  createAgentProductionPresentationBudgetExceededAnswer: createAgentSessionV2BudgetExceededAnswer,
  createAgentProductionPresentationRepeatedFailureAnswer: createAgentSessionV2RepeatedFailureAnswer,
  createAgentProductionPresentationMaxStepsAnswer: createAgentSessionV2MaxStepsAnswer,
  createAgentProductionPresentationBudgetExceededResult: createAgentSessionV2BudgetExceededResult,
  createAgentProductionPresentationFinalResult: createAgentSessionV2FinalResult,
  emitAgentProductionPresentationProgress: emitAgentSessionV2Progress,
} = createAgentProductionSessionPresentation({ compactSessionText: compactAgentSessionText });

export type AgentSessionV2CoveredParallelToolCommand = AgentRuntimeCoveredParallelToolCommand;
export type AgentSessionV2ParallelToolExecutionPlan = AgentRuntimeParallelToolExecutionPlan;

function getAgentSessionV2TimingToolDetail(command: AgentChatCommand) {
  const action = getAgentSessionV2ToolInputAction(command);
  return action || command.toolCall?.name || command.kind;
}

export function resolveAgentSessionV2Instruction(text: string) {
  return resolveAgentProductionSessionInstruction(text);
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

const agentProductionFinalEvidenceGuards = createAgentProductionFinalEvidenceGuards({
  actionCoverage: agentSessionV2ActionCoverageDependencies,
  resolveRecoveryPostActionState: (options) => resolveAgentRecoveryPostActionState(options),
  isRecoverableUnverifiedToolResult: isAgentSessionV2RecoverableUnverifiedToolResult,
  isPrematureActionConfirmationText: isAgentSessionV2PrematureActionConfirmationText,
  hasClearActionableVisualEvidence: hasAgentSessionV2ClearActionableVisualEvidence,
});
export const { findAgentProductionMissingRequestedActionCoverage: findAgentSessionV2MissingRequestedActionCoverage } = agentProductionFinalEvidenceGuards;
const {
  shouldRejectAgentProductionUnattemptedRequestedActionFinal: shouldRejectAgentSessionV2UnattemptedRequestedActionFinal,
  isAgentProductionSilentReadOnlyToolResult: isAgentSessionV2SilentReadOnlyToolResult,
  shouldRejectAgentProductionReadonlyObservationFinal: shouldRejectAgentSessionV2ReadonlyObservationFinal,
  shouldAllowAgentProductionCappedAutoRecoveryFinal: shouldAllowAgentSessionV2CappedAutoRecoveryFinal,
  shouldRejectAgentProductionRecoverableUnverifiedAskUser: shouldRejectAgentSessionV2RecoverableUnverifiedAskUser,
  shouldRejectAgentProductionPrematureActionConfirmation: shouldRejectAgentSessionV2PrematureActionConfirmation,
  shouldRejectAgentProductionIncompleteTaskProgressFinal: shouldRejectAgentSessionV2IncompleteTaskProgressFinal,
  canAgentProductionCompleteFromLatestReadOnlyObservations: canAgentSessionV2CompleteFromLatestReadOnlyObservations,
  shouldRejectAgentProductionUnverifiedResultFinal: shouldRejectAgentSessionV2UnverifiedResultFinal,
} = agentProductionFinalEvidenceGuards;

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
  const { createProgressSnapshot, createFinalResult, createBudgetExceededResult } = createAgentProductionSessionResultContext({
    sourceText, userGoal, historyLines, steps, toolResults, traceEvents, diagnostics, timingTracker, getProductionLifecycleFacts,
    getTaskState: () => taskState,
    v3PilotShadowInputCollector, runAgentSessionV3PilotShadowEventList, v3PilotShadow,
    createPresentationFinalResult: createAgentSessionV2FinalResult,
    createPresentationBudgetExceededResult: createAgentSessionV2BudgetExceededResult,
    createBudgetExceededAnswer: createAgentSessionV2BudgetExceededAnswer,
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
  const appendV3PilotShadowRuntimeTerminal = (evaluation: AgentPostActionTerminalEvaluation) => {
    const latestEvent = v3PilotShadowInputCollector?.getEvents().at(-1);
    if (latestEvent?.type !== 'transaction-finished') {
      return;
    }

    v3PilotShadowInputCollector?.appendPostActionTerminalEvaluation(evaluation);
  };
  const {
    rejectRepeatedUnverifiedActionRetry,
    createAgentProductionProhibitedApprovalRejection: createAgentSessionV2ProhibitedApprovalRejection,
    prepareAgentProductionPendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
  } = createAgentProductionApprovalResult({
    sourceText, userGoal, historyLines, steps, toolResults, createFinalResult, appendTraceEvent,
    findRepeatedRetry: findAgentSessionV2RepeatedUnverifiedActionRetry,
    countRetryRejections: countAgentSessionV2RepeatedUnverifiedActionRetryRejections,
    createRetryAnswer: createAgentSessionV2RepeatedUnverifiedActionRetryAnswer,
    appendPendingApprovalDiagnostic: appendV3PilotShadowPendingApproval,
  });


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
  const { executeVisualRefinementObservation, executeInAppTargetLocateObservation } = createAgentProductionVisualObservationExecution({
    sourceText, userGoal, historyLines, steps, toolResults, toolExecutor, cancellationSignal, readOnlyToolCache, timingTracker, commitToolResult, onProgress, createProgressSnapshot, appendTraceEvent, createBudgetExceededResult, createFinalResult,
    getTaskState: () => taskState,
    getActionRuntimeDependencies: () => actionRuntimeDependencies,
    recordActionRuntimeDecision: (options) => recordActionRuntimeDecision(options),
    actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail,
    getToolInputAction: getAgentSessionV2ToolInputAction,
    isVisualToolCommand: isAgentSessionV2VisualToolCommand,
    compactText: compactAgentSessionText, emitProgress: emitAgentSessionV2Progress,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
  });

  const { executeFailedDesktopActionRecoveryObservation } = createAgentProductionFailedActionRecoveryObservation({
    sourceText, userGoal, historyLines, steps, toolResults, proposeRecovery, authorizeRecovery, toolExecutor, cancellationSignal, readOnlyToolCache, timingTracker, commitToolResult, onProgress, createProgressSnapshot, appendTraceEvent, createBudgetExceededResult, createFinalResult,
    getTaskState: () => taskState,
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail,
    compactText: compactAgentSessionText, emitProgress: emitAgentSessionV2Progress,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
  });
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
  const {
    recordActionRuntimeDecision, recordRecoveryTriggerDecision, decideRecoveryTrigger,
    createPostActionTerminalResultFromEvaluation, latestDecisionSpansSeveralGoals,
    createReadOnlyObservationTerminalResult, createPostActionTerminalResult, createRecoveryTriggerStopResult,
  } = createAgentProductionActionOutcomeLifecycle({
    sourceText, userGoal, historyLines, steps, toolResults, appendTraceEvent, actionRuntimeDependencies, createFinalResult,
    isParallelDedupeResult: isAgentSessionV2ParallelDedupeResult,
    appendRuntimeTerminal: appendV3PilotShadowRuntimeTerminal,
  });
  const { executeAutoRecoveryObservation, executeAutoRecoveryLoop } = createAgentProductionAutoRecoveryExecution({
    sourceText, userGoal, historyLines, steps, toolResults, proposeRecovery, authorizeRecovery, toolExecutor, cancellationSignal, readOnlyToolCache, timingTracker, commitToolResult, onProgress, createProgressSnapshot, appendTraceEvent, createBudgetExceededResult, createFinalResult, createPostActionTerminalResult, createPostActionTerminalResultFromEvaluation, recordRecoveryTriggerDecision, executeVisualRefinementObservation, executeInAppTargetLocateObservation,
    getTaskState: () => taskState,
    getActionRuntimeDependencies: () => actionRuntimeDependencies,
    recordActionRuntimeDecision: (options) => recordActionRuntimeDecision(options),
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail, getToolInputAction: getAgentSessionV2ToolInputAction,
    compactText: compactAgentSessionText, emitProgress: emitAgentSessionV2Progress,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
    resolveRecoveryPostActionState: resolveAgentRecoveryPostActionState,
    actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
  });

  const { executePostApprovalVerification } = createAgentProductionPostApprovalVerification({
    sourceText, userGoal, historyLines, steps, toolResults, toolExecutor, cancellationSignal, readOnlyToolCache, timingTracker, commitToolResult, onProgress, createProgressSnapshot, appendTraceEvent, createBudgetExceededResult, createFinalResult, createPostActionTerminalResultFromEvaluation, recordRecoveryTriggerDecision, executeVisualRefinementObservation, executeInAppTargetLocateObservation, executeAutoRecoveryLoop,
    getTaskState: () => taskState,
    getActionRuntimeDependencies: () => actionRuntimeDependencies,
    recordActionRuntimeDecision: (options) => recordActionRuntimeDecision(options),
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail,
    compactText: compactAgentSessionText, emitProgress: emitAgentSessionV2Progress,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
    actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
  });

  if (isAgentSessionV2CancellationRequested(cancellationSignal)) {
    return createFinalResult({
      finalAnswer: AGENT_SESSION_V2_CANCELLED_ANSWER,
      status: 'cancelled',
    });
  }

  const { executeApprovedResultContinuation } = createAgentProductionApprovedResultContinuation({
    sourceText, userGoal, historyLines, steps, toolResults, appendTraceEvent, commitToolResult,
    getTaskState: () => taskState,
    getActionRuntimeDependencies: () => actionRuntimeDependencies,
    recordActionRuntimeDecision: (options) => recordActionRuntimeDecision(options),
    decideRecoveryTrigger, createFinalResult, createPostActionTerminalResultFromEvaluation,
    executeInAppTargetLocateObservation, executeAutoRecoveryLoop, executeFailedDesktopActionRecoveryObservation, executePostApprovalVerification,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
  });
  if (approvedToolResult) {
    const approvedFinalResult = await executeApprovedResultContinuation(approvedToolResult);
    if (approvedFinalResult !== null) {
      return approvedFinalResult;
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

  const { executeModelPlanningTurn } = createAgentProductionModelPlanningTurn({
    sourceText, userGoal, historyLines, steps, toolResults, traceEvents, workingMemory, workingMemoryText,
    timingTracker, cancellationSignal, appendTraceEvent, createBudgetExceededResult, onProgress, createProgressSnapshot,
    modelCaller, settings, importedSkillCatalog, activeImportedSkillInstruction, personaBehaviorContract, createFinalResult,
    systemInstruction: AGENT_SESSION_V2_SYSTEM_INSTRUCTION,
    createPlanningContextAdapters: createAgentSessionV2PlanningContextAdapters,
    getInitialCommand: () => initialCommand, clearInitialCommand: () => { initialCommand = null; },
    maxModelOutputRepairRuns: AGENT_SESSION_V2_MODEL_OUTPUT_REPAIR_MAX_RUNS,
    getModelOutputRepairRuns: () => modelOutputRepairRuns,
    incrementModelOutputRepairRuns: () => { modelOutputRepairRuns += 1; },
    compactText: compactAgentSessionText, emitProgress: emitAgentSessionV2Progress,
  });

  const { prepareFinalResponse } = createAgentProductionFinalResponse({
    sourceText, userGoal, historyLines, steps, toolResults, appendTraceEvent, agentSessionV2ActionCoverageDependencies,
    shouldAllowAgentSessionV2CappedAutoRecoveryFinal, shouldRejectAgentSessionV2IncompleteTaskProgressFinal, shouldRejectAgentSessionV2UnverifiedResultFinal, shouldRejectAgentSessionV2PrematureActionConfirmation, shouldRejectAgentSessionV2ReadonlyObservationFinal, shouldRejectAgentSessionV2UnattemptedRequestedActionFinal, shouldRejectAgentSessionV2RecoverableUnverifiedAskUser, isAgentSessionV2SilentReadOnlyToolResult, shouldRejectAgentSessionV2PrematureDesktopOrganizationFinal, shouldRejectAgentSessionV2PrematureWindowMoveFinal, isAgentSessionV2RecoverableUnverifiedToolResult, hasRecentAgentSessionV2RepeatedUnverifiedActionRetryRejection, resolveAgentRecoveryPostActionState, createFinalResult
  });

  const { executeSingleToolResultContinuation } = createAgentProductionSingleToolResultContinuation({
    sourceText, userGoal, historyLines, steps, toolResults,
    getTaskState: () => taskState, getActionRuntimeDependencies: () => actionRuntimeDependencies,
    actionCoverageDependencies: agentSessionV2ActionCoverageDependencies,
    recordActionRuntimeDecision: (options) => recordActionRuntimeDecision(options),
    decideRecoveryTrigger, createFinalResult, createPostActionTerminalResultFromEvaluation,
    executeVisualRefinementObservation, executeInAppTargetLocateObservation, executeAutoRecoveryLoop,
    executeFailedDesktopActionRecoveryObservation, createReadOnlyObservationTerminalResult, latestDecisionSpansSeveralGoals,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
    resolveApprovalReadyFollowUp: resolveAgentSessionV2ApprovalReadyFollowUp,
    isSilentReadOnlyToolResult: isAgentSessionV2SilentReadOnlyToolResult,
    canCompleteFromLatestReadOnlyObservations: canAgentSessionV2CompleteFromLatestReadOnlyObservations,
    countFailedToolCalls: countFailedAgentSessionV2ToolCalls,
    createRepeatedFailureAnswer: createAgentSessionV2RepeatedFailureAnswer,
    compactText: compactAgentSessionText, appendNeedsMorePlanning: appendV3PilotShadowNeedsMorePlanning,
  });

  const { executeSingleToolCommand } = createAgentProductionSingleToolExecution({
    sourceText, userGoal, historyLines, steps, toolResults, toolExecutor, cancellationSignal, readOnlyToolCache, timingTracker,
    appendTraceEvent, commitToolResult, onProgress, createProgressSnapshot, createBudgetExceededResult, createFinalResult,
    getTaskState: () => taskState,
    refreshTaskStateFromLatestEvidence, rejectRepeatedUnverifiedActionRetry,
    createProhibitedApprovalRejection: createAgentSessionV2ProhibitedApprovalRejection,
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail, emitProgress: emitAgentSessionV2Progress,
  });

  const { prepareExecutionPreflight } = createAgentProductionExecutionPreflight({
    sourceText, userGoal, historyLines, steps, toolResults, appendTraceEvent, createFinalResult,
    compactText: compactAgentSessionText,
    maxModelOutputRepairRuns: AGENT_SESSION_V2_MODEL_OUTPUT_REPAIR_MAX_RUNS,
    getModelOutputRepairRuns: () => modelOutputRepairRuns,
    incrementModelOutputRepairRuns: () => { modelOutputRepairRuns += 1; },
    findLatestFailedToolCall: findLatestFailedAgentSessionV2ToolCall,
    countRepeatedFailedToolCallRejections: countAgentSessionV2RepeatedFailedToolCallRejections,
    rejectTransitionalDesktopAction: shouldRejectAgentSessionV2TransitionalDesktopAction,
    createRepeatedFailureAnswer: createAgentSessionV2RepeatedFailureAnswer,
  });

  const { prepareSingleToolSelection } = createAgentProductionSingleToolSelection({
    sourceText, userGoal, historyLines, steps, appendTraceEvent,
    toolNames: AGENT_SESSION_V2_TOOL_NAMES, primaryToolNames: AGENT_SESSION_V2_PRIMARY_TOOL_NAMES,
    isPrimaryToolName: isAgentSessionV2PrimaryToolName, compactText: compactAgentSessionText,
    maxModelOutputRepairRuns: AGENT_SESSION_V2_MODEL_OUTPUT_REPAIR_MAX_RUNS,
    getModelOutputRepairRuns: () => modelOutputRepairRuns,
    incrementModelOutputRepairRuns: () => { modelOutputRepairRuns += 1; },
    rejectVideoSummarySearch: shouldRejectAgentSessionV2VideoSummarySearch,
    shouldRedirectDisplayInfoToDesktopItems: shouldRedirectAgentSessionV2DisplayInfoToDesktopItems,
    shouldRedirectReadOnlyDesktopActionToObservation: shouldRedirectAgentSessionV2ReadOnlyDesktopActionToObservation,
    createDesktopItemObservationRedirectArgs: createAgentSessionV2DesktopItemObservationRedirectArgs,
    createReadOnlyDesktopActionObservationRedirectArgs: createAgentSessionV2ReadOnlyDesktopActionObservationRedirectArgs,
    createOpenMoveSequenceRedirect: createAgentSessionV2OpenMoveSequenceRedirect,
    getOpenWindowTarget: getAgentSessionV2OpenWindowTarget,
    inferDisplayTargetFromText: inferAgentSessionV2DisplayTargetFromText,
  });

  const { prepareParallelSelection } = createAgentProductionParallelPreparation({
    sourceText, userGoal, historyLines, steps, toolResults, toolExecutor, appendTraceEvent,
    toolNames: AGENT_SESSION_V2_TOOL_NAMES, primaryToolNames: AGENT_SESSION_V2_PRIMARY_TOOL_NAMES,
    isPrimaryToolName: isAgentSessionV2PrimaryToolName,
    maxModelOutputRepairRuns: AGENT_SESSION_V2_MODEL_OUTPUT_REPAIR_MAX_RUNS,
    getModelOutputRepairRuns: () => modelOutputRepairRuns,
    incrementModelOutputRepairRuns: () => { modelOutputRepairRuns += 1; },
    createParallelApprovalBatch: createAgentSessionV2ParallelApprovalBatch,
    preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
    rejectVideoSummarySearch: shouldRejectAgentSessionV2VideoSummarySearch,
    findLatestFailedToolCall: findLatestFailedAgentSessionV2ToolCall,
    shouldRedirectDisplayInfoToDesktopItems: shouldRedirectAgentSessionV2DisplayInfoToDesktopItems,
    shouldRedirectReadOnlyDesktopActionToObservation: shouldRedirectAgentSessionV2ReadOnlyDesktopActionToObservation,
    createDesktopItemObservationRedirectArgs: createAgentSessionV2DesktopItemObservationRedirectArgs,
    createReadOnlyDesktopActionObservationRedirectArgs: createAgentSessionV2ReadOnlyDesktopActionObservationRedirectArgs,
  });

  const { executeParallelBatch } = createAgentProductionParallelExecution({
    sourceText, userGoal, historyLines, steps, toolResults, cancellationSignal, readOnlyToolCache, timingTracker,
    appendTraceEvent, onProgress, createProgressSnapshot, createBudgetExceededResult, createFinalResult, commitToolResults,
    getActionRuntimeDependencies: () => actionRuntimeDependencies,
    recordActionRuntimeDecision: (options) => recordActionRuntimeDecision(options),
    decideRecoveryTrigger, createPostActionTerminalResultFromEvaluation, executeVisualRefinementObservation, createReadOnlyObservationTerminalResult,
    executeCommandWithCache: executeAgentSessionV2ToolCommandWithCache,
    getTimingDetail: getAgentSessionV2TimingToolDetail, emitProgress: emitAgentSessionV2Progress,
    createExecutionPlan: createAgentSessionV2ParallelToolExecutionPlan, createCoveredResult: createAgentSessionV2CoveredParallelToolResult,
    resolveVisualActionApproval: resolveAgentSessionV2VisualActionApproval, preparePendingApprovalResult: prepareAgentSessionV2PendingApprovalResult,
    resolveApprovalReadyFollowUp: resolveAgentSessionV2ApprovalReadyFollowUp,
    isSilentReadOnlyToolResult: isAgentSessionV2SilentReadOnlyToolResult,
    canCompleteFromLatestReadOnlyObservations: canAgentSessionV2CompleteFromLatestReadOnlyObservations,
  });

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
    // Without any tool evidence there is no outer surface to resolve against;
    // skip the gate so the first model turn sees a clean loop history.
    if (latestBeforePlanning && latestToolNameBeforePlanning !== 'locate_screen_elements') {
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

    const modelPlanningTurn = await executeModelPlanningTurn({
      runStepIndex, stepIndex,
      onStopped: (turn) => v3PilotShadowInputCollector?.appendModelDecisionTurn(turn),
    });
    if (modelPlanningTurn.kind === 'final') {
      return modelPlanningTurn.finalResult;
    }
    if (modelPlanningTurn.kind === 'continue') {
      continue;
    }
    const {decision, modelDecisionTurn} = modelPlanningTurn;

    if (decision.action === 'final_answer' || decision.action === 'ask_user') {
      const finalResponse = prepareFinalResponse(decision, stepIndex, () => {
        v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
      });
      if (finalResponse !== null) {
        return finalResponse;
      }
      continue;
    }

    if (decision.action === 'tool_calls') {
      const parallelSelection = prepareParallelSelection(decision, stepIndex);
      if (parallelSelection.kind === 'final') {
        return parallelSelection.finalResult;
      }
      if (parallelSelection.kind === 'continue') {
        continue;
      }
      const {runnableCommands, deferredCommands, rejectedParallelToolLines, toolExecutor} = parallelSelection;

      const parallelFinalResult = await executeParallelBatch({
        runnableCommands, deferredCommands, rejectedParallelToolLines, decision, traceAction: decision.action, stepIndex, toolExecutor,
        onPrepared: () => {
          v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
          v3PilotShadowInputCollector?.appendPreparedCommand({
            label: 'parallel read-only batch', reason: decision.reason ?? null, route: 'execute',
          });
        },
        onTransaction: (transaction) => v3PilotShadowInputCollector?.appendParallelToolExecutionTransaction(transaction),
      });
      if (parallelFinalResult !== null) {
        return parallelFinalResult;
      }

      continue;
    }

    const singleToolSelection = prepareSingleToolSelection(decision, stepIndex);
    if (singleToolSelection.kind === 'continue') {
      continue;
    }
    let {effectiveToolName, effectiveArgs} = singleToolSelection;

    const executionPreflight = prepareExecutionPreflight({
      effectiveToolName, effectiveArgs, decision, stepIndex,
      onRepeatedFailure: () => {
        v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
        v3PilotShadowInputCollector?.appendCommandUnavailable('Repeated rejected failed tool call loop guard prevented command preparation.');
        v3PilotShadowInputCollector?.appendRecoveryExhausted('Repeated rejected failed tool call loop guard stopped the run.');
      },
    });
    if (executionPreflight.kind === 'final') {
      return executionPreflight.finalResult;
    }
    if (executionPreflight.kind === 'continue') {
      continue;
    }
    ({effectiveToolName, effectiveArgs} = executionPreflight);

    const command = createAgentToolCommand({
      args: effectiveArgs,
      sourceText,
      toolName: effectiveToolName,
      userGoal,
    });
    const commandExecution = await executeSingleToolCommand({
      command, effectiveToolName, decision, stepIndex,
      onPrepared: ({reason, route}) => {
        v3PilotShadowInputCollector?.appendModelDecisionTurn(modelDecisionTurn);
        v3PilotShadowInputCollector?.appendPreparedCommand({label: effectiveToolName, reason, route});
      },
    });
    if (commandExecution.kind === 'final') {
      return commandExecution.finalResult;
    }
    if (commandExecution.kind === 'continue') {
      continue;
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

    const singleToolFinalResult = await executeSingleToolResultContinuation({
      command, result, effectiveToolName, effectiveArgs, decision, stepIndex,
      onRepeatedFailure: () => {
        v3PilotShadowInputCollector?.appendEvaluationRecovery('Repeated failed tool call result requires terminal recovery exhaustion.');
        v3PilotShadowInputCollector?.appendRecoveryExhausted('Repeated failed tool call loop guard stopped the run.');
      },
    });
    if (singleToolFinalResult !== null) {
      return singleToolFinalResult;
    }
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
