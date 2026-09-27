import { type AgentCapabilityId } from './agentCapabilityTypes';
import {
  type AgentCoordinateAuditEvidence,
  type AgentCoordinateAuditStatus,
} from './agentCoordinateAudit';
import {
  type AgentCaptureQualityMetrics,
  type AgentCaptureStatus,
  type AgentInputReplayPreview,
} from './agentCaptureQuality';
import {
  type DesktopItemCategory,
  type DesktopItemGroupBy,
  type DesktopItemKind,
} from './desktopItemClassification';

export type AgentChatCommandKind =
  | 'app-launch'
  | 'app-alias-save'
  | 'context-query'
  | 'desktop-organization'
  | 'desktop-icon-placement'
  | 'tool-call'
  | 'help'
  | 'unsupported';

export type AgentToolCallName =
  | 'launch_local_app'
  | 'browser_search'
  | 'observe_windows_and_apps'
  | 'execute_desktop_action'
  | 'execute_desktop_observation'
  | 'execute_desktop_input'
  | 'execute_desktop_sequence'
  | 'execute_local_file_action'
  | 'execute_file_management_action'
  | 'execute_memory_action'
  | 'run_controlled_command'
  | 'control_browser'
  | 'locate_screen_elements'
  | 'get_default_app_for_uri'
  | 'list_running_apps'
  | 'get_active_window_info'
  | 'list_capture_sources'
  | 'summarize_visual_snapshot'
  | 'analyze_game_screen'
  | 'manage_game_companion_loop'
  | 'get_cursor_position'
  | 'focus_window'
  | 'close_window'
  | 'open_resource'
  | 'search_web'
  | 'remember_local_app'
  | 'get_path_info'
  | 'list_directory'
  | 'search_files'
  | 'read_text_file'
  | 'organize_desktop_icons'
  | 'place_desktop_icon'
  | 'get_system_info'
  | 'get_display_info'
  | 'get_pet_settings'
  | 'update_pet_settings'
  | 'get_voice_status'
  | 'switch_tts_provider'
  | 'warmup_local_voice'
  | 'set_voice_input'
  | 'start_voice_input_session'
  | 'stop_voice_input_session'
  | 'inspect_local_project'
  | 'run_local_project_action'
  | 'list_agent_skills'
  | 'execute_agent_skill'
  | 'list_mcp_tools'
  | 'call_mcp_tool';

export type AgentDesktopIconPlacementDirection =
  | 'above'
  | 'below'
  | 'left-of'
  | 'right-of';

export interface AgentDesktopIconPlacementCommand {
  anchorName: string;
  direction: AgentDesktopIconPlacementDirection;
  targetName: string;
}

export type AgentDesktopOrganizationDisplayTarget = 'primary' | 'secondary' | 'current' | 'all';
export type AgentDesktopOrganizationMode = 'preview' | 'execute';
export type AgentDesktopOrganizationScope = 'all-icons' | 'display-icons';

export interface AgentDesktopOrganizationCommand {
  displayTarget?: AgentDesktopOrganizationDisplayTarget;
  groupBy?: DesktopItemGroupBy;
  mode?: AgentDesktopOrganizationMode;
  placementIntent?: string;
  scope?: AgentDesktopOrganizationScope;
  sourceDisplay?: AgentDesktopOrganizationDisplayTarget;
  sourceScope?: AgentDesktopOrganizationScope;
  targetDisplay?: AgentDesktopOrganizationDisplayTarget;
}

export interface AgentAppLaunchCommand {
  appName: string;
  forceNew?: boolean;
}

export interface AgentAppAliasSaveCommand {
  alias: string;
  appPath: string;
}

export interface AgentContextQueryCommand {
  answerText?: string | null;
  topic: 'desktop-organization';
}

export interface AgentToolCallCommand {
  actionScope?: AgentActionScope | null;
  goal?: string;
  input: Record<string, unknown>;
  name: AgentToolCallName;
}

export type AgentActionCompletionScope = 'intermediate' | 'terminal' | 'unknown';

export interface AgentActionScope {
  completion: AgentActionCompletionScope;
  subgoalId?: string | null;
  targetRef?: string | null;
  taskGoalId?: string | null;
}

export interface AgentPlannerCommandStep {
  args: Record<string, unknown>;
  index: number;
  phase: 'observe' | 'plan' | 'execute' | 'verify' | 'recover';
  reason?: string | null;
  tool: AgentToolCallName;
}

export interface AgentChatCommand {
  appAliasSave?: AgentAppAliasSaveCommand;
  appLaunch?: AgentAppLaunchCommand;
  capabilityId?: AgentCapabilityId;
  contextQuery?: AgentContextQueryCommand;
  desktopIconPlacement?: AgentDesktopIconPlacementCommand;
  desktopOrganization?: AgentDesktopOrganizationCommand;
  instruction: string;
  kind: AgentChatCommandKind;
  plannerMessage?: string;
  plannerSteps?: AgentPlannerCommandStep[];
  sourceText: string;
  toolCall?: AgentToolCallCommand;
}

export type AgentChatFollowUpAction =
  | {
      command: AgentChatCommand;
      kind: 'run-command';
      label: string;
      requiresApproval?: boolean;
    }
  | {
      kind: 'ask-user';
      label: string;
      prompt: string;
    };

export type AgentChatResultAssessmentStatus =
  | 'completed'
  | 'can-continue'
  | 'needs-user'
  | 'unverified'
  | 'failed';

export interface AgentChatResultAssessment {
  evidence: string[];
  nextStep?: string | null;
  status: AgentChatResultAssessmentStatus;
  summary: string;
}

export interface AgentStructuredToolWindowEvidence {
  bounds?: {
    coordinateSpace?: string | null;
    height?: number | null;
    width?: number | null;
    x?: number | null;
    y?: number | null;
  } | null;
  displayId?: string | null;
  displayLabel?: string | null;
  hwnd?: number | null;
  pid?: number | null;
  processName?: string | null;
  title?: string | null;
}

export interface AgentStructuredToolDisplayEvidence {
  id?: string | null;
  label?: string | null;
  primary?: boolean | null;
}

export interface AgentStructuredToolPointEvidence {
  coordinateSpace?: string | null;
  source?: string | null;
  x?: number | null;
  y?: number | null;
}

export interface AgentStructuredToolRectEvidence {
  coordinateSpace?: string | null;
  height?: number | null;
  source?: string | null;
  width?: number | null;
  x?: number | null;
  y?: number | null;
}

export interface AgentStructuredToolCandidateEvidence {
  actions?: string[] | null;
  automationId?: string | null;
  bounds?: AgentStructuredToolRectEvidence | null;
  center?: AgentStructuredToolPointEvidence | null;
  centerRatio?: AgentStructuredToolPointEvidence | null;
  confidence?: 'high' | 'medium' | 'low' | null;
  controlType?: string | null;
  description?: string | null;
  enabled?: boolean | null;
  hasKeyboardFocus?: boolean | null;
  keyboardFocusable?: boolean | null;
  label?: string | null;
  name?: string | null;
  offscreen?: boolean | null;
  region?: string | null;
  relation?: string | null;
  selected?: boolean | null;
  selectionItem?: boolean | null;
  source?: string | null;
  window?: AgentStructuredToolWindowEvidence | null;
}

export interface AgentStructuredToolRecoveryEvidence {
  nextArgs?: Record<string, unknown> | null;
  nextTool?: AgentToolCallName | null;
  reason?: string | null;
  strategy?:
    | 'wait-and-observe'
    | 're-locate-target'
    | 'read-error'
    | 'read-blocker'
    | 'refresh-observation'
    | 'ask-user'
    | 'none'
    | null;
}

export interface AgentStructuredToolLauncherVerificationEvidence {
  currentSelection?: string | null;
  detailMatchesTarget?: boolean | null;
  evidence?: string[] | null;
  primaryAction?: string | null;
  primaryActionMatchesTarget?: boolean | null;
  reason?: string | null;
  status?:
    | 'ready'
    | 'needs-target-selection'
    | 'needs-primary-action'
    | 'needs-coordinate'
    | 'needs-relation'
    | 'low-confidence'
    | 'not-actionable'
    | 'unknown'
    | null;
  targetMatched?: string | null;
  targetSelected?: boolean | null;
  targetVisible?: boolean | null;
}

/**
 * Generic target/action grounding evidence. The legacy launcher name is
 * retained below so older traces and callers remain readable during the
 * Runtime migration.
 */
export type AgentStructuredToolTargetInteractionVerificationEvidence =
  AgentStructuredToolLauncherVerificationEvidence;

export type AgentDesktopTargetPresence =
  | 'absent'
  | 'present_unreadable'
  | 'present_interactable'
  | 'unknown';

export type AgentAppExecutionProfile =
  | 'direct_window_app'
  | 'launcher_managed_app'
  | 'tray_app'
  | 'background_app'
  | 'browser_app'
  | 'unknown';

export interface AgentStructuredToolEvidence {
  actionCandidates?: AgentStructuredToolCandidateEvidence[] | null;
  actionLifecycle?: {
    reason?: string | null;
    recommendedRecovery?: string | null;
    status?:
      | 'blocked_permission'
      | 'complete'
      | 'failed_no_effect'
      | 'fallback_available'
      | 'needs_observation'
      | 'unverified_wait'
      | null;
  } | null;
  captureFallback?: {
    fromSourceId?: string | null;
    fromSourceType?: 'screen' | 'window' | null;
    reason?: string | null;
    toSourceId?: string | null;
    toSourceType?: 'screen' | 'window' | null;
  } | null;
  captureQuality?: AgentCaptureQualityMetrics | null;
  captureReason?: string | null;
  captureSourceType?: 'screen' | 'window' | null;
  captureStatus?: AgentCaptureStatus | null;
  captureTrusted?: boolean | null;
  confidence?: 'high' | 'medium' | 'low' | null;
  coordinateAudit?: AgentCoordinateAuditEvidence | null;
  coordinateAuditStatus?: AgentCoordinateAuditStatus | null;
  coordinateConfidence?: 'high' | 'medium' | 'low' | null;
  elementBounds?: AgentStructuredToolRectEvidence | null;
  elementCenter?: AgentStructuredToolPointEvidence | null;
  elementCenterRatio?: AgentStructuredToolPointEvidence | null;
  elementDescription?: string | null;
  elementRegion?: string | null;
  finalDisplay?: AgentStructuredToolDisplayEvidence | null;
  finalUrl?: string | null;
  finalWindow?: AgentStructuredToolWindowEvidence | null;
  targetInteractionVerification?: AgentStructuredToolTargetInteractionVerificationEvidence | null;
  /** @deprecated Use targetInteractionVerification. Kept for trace compatibility. */
  launcherVerification?: AgentStructuredToolLauncherVerificationEvidence | null;
  appExecutionProfile?: AgentAppExecutionProfile | null;
  desktopTargetPresence?: AgentDesktopTargetPresence | null;
  processPresent?: boolean | null;
  windowPresent?: boolean | null;
  foreground?: boolean | null;
  captureAvailable?: boolean | null;
  uiAutomationAvailable?: boolean | null;
  visualReadable?: boolean | null;
  interactionReady?: boolean | null;
  observationCapturedAt?: number | null;
  observationGeneration?: number | null;
  observationFreshness?: 'live' | 'stale-fallback' | null;
  currentSelection?: string | null;
  primaryAction?: string | null;
  inputReplayPreview?: AgentInputReplayPreview | null;
  postActionRecovery?: AgentStructuredToolRecoveryEvidence | null;
  postActionState?: string | null;
  relation?: string | null;
  selectionEvidence?: string[] | null;
  selectionVerificationStatus?:
    | 'selected'
    | 'visible-only'
    | 'mismatch'
    | 'unknown'
    | null;
  sourceBounds?: AgentStructuredToolRectEvidence | null;
  status?: string | null;
  targetCandidates?: AgentStructuredToolCandidateEvidence[] | null;
  targetMatched?: string | null;
  visibleTextCandidates?: string[] | null;
  visualActionReadiness?:
    | 'ready'
    | 'needs-target-selection'
    | 'needs-primary-action'
    | 'needs-coordinate'
    | 'needs-relation'
    | 'low-confidence'
    | 'not-actionable'
    | null;
}

export type AgentDesktopActionOutcome =
  | 'blocked'
  | 'changed'
  | 'no-op'
  | 'uncertain';

export type AgentDesktopActionTargetKind =
  | 'app'
  | 'pixel'
  | 'uia'
  | 'vision'
  | 'window';

export type AgentDesktopActionSnapshotProfile =
  | 'heavy'
  | 'light'
  | 'replay';

export interface AgentDesktopActionTargetRef {
  bounds?: AgentStructuredToolRectEvidence | null;
  confidence: 'high' | 'medium' | 'low';
  /** Reserved for a future grounding graph; v1.5 evidence producers should not synthesize this. */
  fallbackChain?: AgentDesktopActionTargetRef[] | null;
  kind: AgentDesktopActionTargetKind;
  label: string;
  stableId?: string | null;
}

export interface AgentDesktopActionSnapshot {
  activeWindow?: AgentStructuredToolWindowEvidence | null;
  captureStatus?: AgentCaptureStatus | null;
  cursor?: AgentStructuredToolPointEvidence | null;
  observedState?: string[];
  targetWindow?: AgentStructuredToolWindowEvidence | null;
  visibleText?: string[];
}

export interface AgentDesktopActionStateDiff {
  changed?: boolean | null;
  signals?: string[];
  summary: string;
}

export interface AgentDesktopActionEvidence {
  action?: string | null;
  after?: AgentDesktopActionSnapshot | null;
  before?: AgentDesktopActionSnapshot | null;
  confidence?: number;
  diff?: AgentDesktopActionStateDiff | null;
  phase?: 'planned' | 'dispatched' | 'confirmed';
  outcome: AgentDesktopActionOutcome;
  snapshotProfile?: AgentDesktopActionSnapshotProfile | null;
  targetRef?: AgentDesktopActionTargetRef | null;
  timestamp: number;
  tool: Extract<AgentToolCallName, 'execute_desktop_action' | 'execute_desktop_input' | 'execute_desktop_sequence'>;
}

export interface AgentToolStateSummary {
  actionEvidence?: AgentDesktopActionEvidence | null;
  changedState?: string[];
  missingEvidence?: string[];
  observedState?: string[];
  recommendedRecovery?: string[];
  structuredEvidence?: AgentStructuredToolEvidence | null;
  verificationEvidence?: string[];
}

export interface AgentDesktopObservationDisplayStats {
  iconCount: number;
  id: string;
  isPrimary: boolean;
  label: string;
  selectedIconCount?: number;
  viewport?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
}

export interface AgentDesktopObservationGroupStats {
  category?: DesktopItemCategory;
  count: number;
  key: string;
  kind?: DesktopItemKind;
  label: string;
}

export interface AgentDesktopObservationPositionSourceStats {
  count: number;
  movableCount: number;
  readOnlyCount: number;
  source: string;
}

export interface AgentDesktopObservationGroupLayoutStats {
  columns: number;
  count: number;
  endRow: number;
  groupKey: string;
  groupLabel: string;
  rows: number;
  startRow: number;
}

export interface AgentDesktopObservationStats {
  arrangementGroupLayouts?: AgentDesktopObservationGroupLayoutStats[];
  arrangementGroups?: AgentDesktopObservationGroupStats[];
  classificationGroups?: AgentDesktopObservationGroupStats[];
  displayIconCounts?: AgentDesktopObservationDisplayStats[];
  displayCount?: number;
  fileFallbackIconCount?: number;
  movableIconCount?: number;
  positionSourceCounts?: AgentDesktopObservationPositionSourceStats[];
  selectedIconCount?: number;
  selectedFileFallbackIconCount?: number;
  selectedMovableIconCount?: number;
  selectedReadOnlyIconCount?: number;
  readOnlyIconCount?: number;
  targetDisplayLabel?: string | null;
  targetIconCount?: number;
  totalIconCount?: number;
  willMoveAcrossDisplays?: boolean;
}

export interface AgentChatCommandResult {
  skillInstructions?: { skillId: string; text: string } | null;
  assessment?: AgentChatResultAssessment | null;
  errorText?: string | null;
  followUp?: string | null;
  followUpAction?: AgentChatFollowUpAction | null;
  followUpActions?: AgentChatFollowUpAction[] | null;
  observations?: string[];
  ok?: boolean;
  observationStats?: AgentDesktopObservationStats | null;
  previewSummaryLines?: string[];
  previewWarning?: string | null;
  receipt?: AgentChatExecutionReceipt | null;
  responseText: string;
  stateSummary?: AgentToolStateSummary | null;
  verification?: string | null;
}

export type AgentChatCommandHandler = (
  command: AgentChatCommand,
  context?: AgentChatCommandHandlerContext,
) => AgentChatCommandResult | Promise<AgentChatCommandResult>;

export interface AgentChatCommandHandlerContext {
  petId?: string | null;
  signal?: AbortSignal | null;
}

export interface AgentChatExecutionReceipt {
  evidenceLines?: string[];
  status: 'blocked' | 'failed' | 'success' | 'unverified';
  stateSummary?: AgentToolStateSummary | null;
  summaryLines: string[];
  title: string;
  toolName?: string | null;
  verification?: string | null;
}

export function createAgentContextQueryCommand(text: string): AgentChatCommand {
  const sourceText = text.trim();
  return {
    capabilityId: 'desktop-observation',
    contextQuery: {
      topic: 'desktop-organization',
    },
    instruction: sourceText,
    kind: 'context-query',
    sourceText,
  };
}
