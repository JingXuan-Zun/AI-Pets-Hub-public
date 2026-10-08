import type {
  AgentChatCommand,
  AgentChatFollowUpAction,
  AgentChatResultAssessment,
  AgentActionRisk,
  AgentDesktopObservationStats,
  AgentExecutionPlan,
  AgentPermissionRouteStatus,
  AgentPlannerCommandStep,
  AgentRuntimeContinuation,
  AgentToolStateSummary,
} from './agent';
import type { PetLifeCompanionSettings } from './life-companion/lifeCompanionSettings';
import type { Live2DRuntimeProfileConfigV1 } from './pet-runtime/live2d/live2dRuntimeProfile';
import type { GroupMemoryRepositoryData } from './group-memory';
import type { GroupTopicRepositoryData } from './group-topic';
import type { DirectedRelationshipRepositoryData } from './character-relationship';
import type { NeuralMemoryProposal } from './neural-memory/neuralMemoryProposalTypes';
import type { CharacterMemoryState } from './character-memory/characterMemoryTypes';
import type { ExpressionReplySettings } from './expression/expressionSettings';

export type ModelType = '2d' | '3d' | 'live2d';
export type LlmProvider = 'gemini' | 'openai';
export type AgentRuntimeProviderId = 'native' | 'deepseek-harness';
export type VisionMode = 'auto' | 'inherit-brain' | 'dedicated-vision-model' | 'disabled';
export type VisionModelProvider = 'inherit' | LlmProvider;
export type WebSearchProvider = 'gemini' | 'browser' | 'tavily' | 'serper' | 'brave' | 'custom';
export type WebSearchRequestMethod = 'get' | 'post';
export type BrowserSearchEngine = 'auto' | 'baidu' | 'google' | 'bing' | 'sogou' | 'custom';
export type VoiceProvider = 'browser' | 'api' | 'local';
export type TtsProvider = VoiceProvider | 'gpt-sovits';
export type GptSovitsDevice = 'auto' | 'cuda' | 'cpu';
export type VoiceInputMode = 'single' | 'conversation';
export type VoiceApiProtocol = 'openai' | 'gemini';
export type ModelRequestParamValueType = 'string' | 'number' | 'boolean' | 'json';
export type ActivityDisplayId = 'primary' | `${number}`;
export type InteractiveDialogueDisplayId = 'activity' | ActivityDisplayId;
export type Avatar3DRuntimeBackend = 'three' | 'unity';

export interface ModelCapabilities {
  text: boolean;
  image: boolean;
  tools: boolean;
  reasoning: boolean;
}

export interface ModelRequestParam {
  id: string;
  key: string;
  value: string;
  valueType: ModelRequestParamValueType;
}

export interface PetPersonality {
  name: string;
  traits: string[];
  greeting: string;
  systemInstruction: string;
  /** Fixed user-authored completion rules for formal character replies. */
  dialogueCompletionPreset?: string;
  /** Explicit per-role gate for the experimental single-chat Neural input. */
  neuralPersonaChatEnabled?: boolean;
  /** Editable source retained for neural graph generation; never injected directly. */
  neuralPersonaSourceText?: string;
  chatAvatarUrl: string;
  beginDialogs: Array<{
    user: string;
    assistant: string;
  }>;
  customErrorMessage: string;
  userMemory: string;
  chatHistoryMemory: string;
  /** Automatic memory items and the rolling summary of older private chats. */
  memoryState?: CharacterMemoryState;
  knowledgeBase: string;
  webSearchEnabled: boolean;
  webLearningEnabled: boolean;
  /** GPT-SoVITS voice pack this character speaks with; empty = the global voice setting. */
  voicePackId?: string;
  /** Comma-separated phrases that wake this character by voice; empty = the character's name. */
  wakeWords?: string;
}

export type PetAction = 'IDLE' | 'EATING' | 'HAPPY' | 'SAD' | 'SLEEPING' | 'WALKING' | 'RUNNING' | 'SWIMMING';

export interface CompanionPetConfig {
  id: string;
  enabled: boolean;
  modelVisible: boolean;
  modelType: ModelType;
  modelUrl: string;
  personality: PetPersonality;
  scale: number;
  position: { x: number; y: number };
  stats: PetStats;
  currentAction: PetAction;
  autoMovementEnabled: boolean;
  pointerLookEnabled: boolean;
}

export interface PetStats {
  affection: number;
  hunger: number;
  fatigue: number;
}

export interface FolderItem {
  id: string;
  name: string;
  position: { x: number; y: number };
  appearanceId?: string | null;
  interactionType?: PetItemInteractionType;
}

export type PetItemInteractionType = 'eat' | 'toy' | 'custom';

export interface FoodAppearance {
  id: string;
  name: string;
  imageUrl: string;
  builtIn?: boolean;
  interactionType?: PetItemInteractionType;
  interactionLabel?: string;
}

export interface PetAudioAsset {
  aliases?: string[];
  durationMs?: number;
  id: string;
  name: string;
  url: string;
}

export interface PetCollisionProfile {
  leftRatio: number;
  rightRatio: number;
  topRatio: number;
  bottomRatio: number;
  leftInset?: number;
  rightInset?: number;
  topInset?: number;
  bottomInset?: number;
  minLeft?: number;
  minRight?: number;
  minTop?: number;
  minBottom?: number;
  topScaleSlope?: number;
  topScaleReferenceScale?: number;
  topScaleMinFactor?: number;
  topScaleMaxFactor?: number;
}

export type PetModelMotionKey =
  | 'idle'
  | 'moving'
  | 'walking'
  | 'running'
  | 'swimming'
  | 'eating'
  | 'happy'
  | 'sad'
  | 'sleeping'
  | 'hover-head'
  | 'hover-body'
  | 'hover-hand-left'
  | 'hover-hand-right';

export type PetModelMotionAssetFormat = 'exp3' | 'fbx' | 'glb' | 'gltf' | 'motion3' | 'vrma';

export type PetModelMotionBindingKind = 'expression' | 'motion';

export interface PetModelMotionBinding {
  clipNames?: string[];
  durationMs?: number;
  format: PetModelMotionAssetFormat;
  id: string;
  kind?: PetModelMotionBindingKind;
  motionKey: PetModelMotionKey;
  name: string;
  semanticAliases?: string[];
  semanticDescription?: string;
  semanticTags?: string[];
  sourceUrl: string;
}

export type PetVideoEmotionAction = Extract<PetAction, 'EATING' | 'HAPPY' | 'SAD' | 'SLEEPING'>;
export type PetVideoEmotionFolderAliases = Partial<Record<PetVideoEmotionAction, string[]>>;

export interface PetModelPreset {
  id: string;
  name: string;
  type: ModelType;
  url: string;
  /** Optional ordered frame list for a custom 2D model. */
  sequenceFrames?: string[];
  /** Portable, human-readable folder name under the app-adjacent 2d模型 library. */
  sequenceAssetFolder?: string;
  /** Optional direct video renderer for a 2D WebM asset. */
  renderKind?: 'video' | 'gif';
  /** When enabled, idle playback rotates through random subfolders of the video library. */
  randomVideoPlaybackEnabled?: boolean;
  /** Character video library root; each direct subfolder is one clip group (待机/, 开心/ ...). */
  videoLibraryRootPath?: string;
  /** User overrides for which library subfolder names count as each chat emotion. */
  videoEmotionFolderAliases?: PetVideoEmotionFolderAliases;
  /** One-shot videos played when a matching item is handed to this video pet. */
  videoItemBindings?: Array<{ appearanceId: string; folderPath: string }>;
  builtIn?: boolean;
  collisionProfile?: PetCollisionProfile;
  live2dRuntimeProfile?: Live2DRuntimeProfileConfigV1;
  motionBindings?: PetModelMotionBinding[];
}

export interface PetVisualSize {
  width: number;
  height: number;
}

export interface LocalVoiceModelOption {
  id: string;
  label: string;
  path: string;
}

export interface LocalVoiceReferenceOption {
  id: string;
  label: string;
  path: string;
  sampleCount: number;
  sampleFiles: string[];
}

export interface LocalVoiceAssets {
  rootPath: string | null;
  ttsModels: LocalVoiceModelOption[];
  sttModels: LocalVoiceModelOption[];
  references: LocalVoiceReferenceOption[];
}

export interface LocalVoiceHealth {
  available: boolean;
  status: 'idle' | 'ready' | 'missing-runtime' | 'missing-dependencies' | 'missing-assets' | 'error';
  runtimeLabel: string | null;
  executable: string | null;
  pythonVersion: string | null;
  device: 'cpu' | 'cuda' | 'unknown';
  ttsReady: boolean;
  sttReady: boolean;
  referenceReady: boolean;
  missingPackages: string[];
  detectedPackages: string[];
  messages: string[];
}

export interface LocalVoiceInstallResult {
  ok: boolean;
  executable: string | null;
  messages: string[];
  error: string | null;
  missingPackages: string[];
}

export interface LocalVoiceInstallProgress {
  stage: 'starting' | 'running' | 'completed' | 'failed';
  currentStep: string | null;
  executable: string | null;
  messages: string[];
  error: string | null;
  missingPackages: string[];
}

export interface BrowserTtsHealth {
  available: boolean;
  status: 'idle' | 'ready' | 'stopped' | 'missing-runtime' | 'missing-dependencies' | 'error';
  running: boolean;
  url: string | null;
  executable: string | null;
  error: string | null;
  missingPackages: string[];
  voicesCount?: number;
  started?: boolean;
}

/** full = fine-tuned weights; lite = reference clips on the shared base model. */
export type GptSovitsVoicePackKind = 'full' | 'lite';

export interface GptSovitsModelSummary {
  id: string;
  name: string;
  kind: GptSovitsVoicePackKind;
  description: string;
  author: string;
  ready: boolean;
  emotions: string[];
  problems: string[];
}

export interface GptSovitsHealth {
  available: boolean;
  status: 'idle' | 'ready' | 'stopped' | 'missing-runtime' | 'missing-dependencies' | 'missing-source'
    | 'missing-model' | 'no-gpu' | 'error';
  running: boolean;
  error: string | null;
  cudaAvailable: boolean;
  device: GptSovitsDevice;
  modelId: string | null;
  models: GptSovitsModelSummary[];
  started?: boolean;
}

export interface BrowserTtsInstallResult {
  ok: boolean;
  executable: string | null;
  messages: string[];
  error: string | null;
  missingPackages: string[];
}

export interface BrowserTtsInstallProgress {
  stage: 'starting' | 'running' | 'completed' | 'failed';
  currentStep: string | null;
  executable: string | null;
  messages: string[];
  error: string | null;
  missingPackages: string[];
}

export interface PetConfig {
  directedRelationshipRepository: DirectedRelationshipRepositoryData;
  groupMemoryRepository: GroupMemoryRepositoryData;
  groupTopicRepository: GroupTopicRepositoryData;
  /** Memories characters proposed from chat, waiting for the user's approval. */
  neuralMemoryProposals?: NeuralMemoryProposal[];
  modelType: ModelType;
  modelUrl: string;
  customModelPresets: PetModelPreset[];
  personality: PetPersonality;
  companionPets: CompanionPetConfig[];
  scale: number;
  position: { x: number; y: number };
  stats: PetStats;
  folders: FolderItem[];
  foodAppearances: FoodAppearance[];
  musicAssets: PetAudioAsset[];
  currentAction: PetAction;
  autoMovementEnabled: boolean;
  pointerLookEnabled: boolean;
  settings: {
    physicsEnabled: boolean;
    avatar3dRuntimeBackend: Avatar3DRuntimeBackend;
    memoryDepth: number;
    engineType: string;
    llmProvider: LlmProvider;
    agentRuntimeProvider: AgentRuntimeProviderId;
    /** Desktop operation tasks use the new observe→decide→act→verify loop (src/agent/loop). */
    agentDesktopLoopEnabled: boolean;
    deepseekHarnessPythonPath: string;
    deepseekHarnessWorkspace: string;
    deepseekHarnessHome: string;
    deepseekHarnessModel: string;
    deepseekHarnessBaseUrl: string;
    deepseekHarnessApiKey: string;
    llmModel: string;
    geminiApiKey: string;
    customApiUrl: string;
    customApiKey: string;
    customModelName: string;
    customModelCapabilities: ModelCapabilities;
    customModelRequestParams: ModelRequestParam[];
    neuralPersonaModelTagSuggestionsEnabled: boolean;
    neuralPersonaPrivateProviderDataConsent: boolean;
    neuralPersonaProviderDataEgressConsent: boolean;
    neuralPersonaProviderTimeoutMs: number;
    neuralPersonaSemanticRetrievalEnabled: boolean;
    visionMode?: VisionMode;
    visionModelProvider: VisionModelProvider;
    visionLlmModel: string;
    visionCustomApiUrl: string;
    visionCustomApiKey: string;
    visionCustomModelName: string;
    visionCustomModelRequestParams: ModelRequestParam[];
    gameCompanionObservationIntervalMs: number;
    gameCompanionGameName: string;
    gameCompanionGameDescription: string;
    globalKnowledgeBase: string;
    webSearchEnabled: boolean;
    webLearningEnabled: boolean;
    webSearchProvider: WebSearchProvider;
    browserSearchBrowserPath: string;
    browserSearchDebugPort: number;
    browserSearchEngine: BrowserSearchEngine;
    browserSearchUrlTemplate: string;
    tavilyApiKey: string;
    serperApiKey: string;
    braveSearchApiKey: string;
    customWebSearchUrl: string;
    customWebSearchApiKey: string;
    customWebSearchMethod: WebSearchRequestMethod;
    customWebSearchQueryParam: string;
    hiddenBuiltinModelPresetIds: string[];
    timeAwarenessEnabled: boolean;
    voiceEnabled: boolean;
    voiceInputEnabled: boolean;
    voiceInputMode: VoiceInputMode;
    /** Hands-free conversation closes the mic after this many seconds without user speech. */
    voiceConversationIdleTimeoutSec: number;
    /** Opt-in background listening for a wake phrase that starts hands-free conversation. */
    voiceWakeEnabled: boolean;
    /** Comma-separated wake phrases; empty means the active pet's name. */
    voiceWakeWords: string;
    voiceConversationOpenChat: boolean;
    autoSpeakResponses: boolean;
    speechSkipBracketContent: boolean;
    speechExpressivePunctuationEnabled: boolean;
    speechPlaybackRate: number;
    ttsProvider: TtsProvider;
    sttProvider: VoiceProvider;
    apiTtsProtocol: VoiceApiProtocol;
    apiSttProtocol: VoiceApiProtocol;
    browserTtsApiUrl: string;
    browserTtsApiKey: string;
    browserTtsLanguage: string;
    speechRecognitionLang: string;
    voiceName: string;
    customVoiceApiUrl: string;
    customVoiceApiKey: string;
    customVoiceModel: string;
    customSpeechApiUrl: string;
    customSpeechApiKey: string;
    customSpeechModel: string;
    localTtsModelId: string;
    localTtsVoiceToneStability: number;
    localTtsLockVoiceTone: boolean;
    localTtsRandomSeed: string;
    localSttModelId: string;
    localVoiceReferenceId: string;
    localVoiceRuntimePath: string;
    localVoiceReferenceText: string;
    gptSovitsModelId: string;
    gptSovitsDevice: GptSovitsDevice;
    gptSovitsApiUrl: string;
    activityAreaLimitEnabled: boolean;
    desktopIconInteractionEnabled: boolean;
    desktopMouseInteractionEnabled: boolean;
    chatAvatarsEnabled: boolean;
    chatAvatarSize: number;
    chatBackgroundImageEnabled: boolean;
    chatBackgroundImageUrl: string;
    chatBackgroundImageSize: number;
    chatBackgroundImageVisibility: number;
    chatUserDisplayName: string;
    chatUserDisplayId: string;
    chatUserAvatarUrl: string;
    activityAreaScale: number;
    activityAreaManual: boolean;
    activityAreaWidth: number;
    activityAreaHeight: number;
    activityOffsetX: number;
    activityOffsetY: number;
    activityDisplayId: ActivityDisplayId;
    interactiveDialogueDisplayId: InteractiveDialogueDisplayId;
    lifeCompanion: PetLifeCompanionSettings;
    activityBorderVisible: boolean;
    chatBracketOuterTextColor: string;
    chatFontWeight: number;
    chatFontSize: number;
    chatBubbleTransparency: number;
    chatBubbleEnabled: boolean;
    chatStreamingEnabled: boolean;
    groupChatTurnDelayMs: number;
    groupParallelRoleGenerationEnabled: boolean;
    groupAutomaticMemoryWriteEnabled: boolean;
    groupAutomaticRelationshipEvolutionEnabled: boolean;
    groupAutomaticSubgroupEvolutionEnabled: boolean;
    expressionReply: ExpressionReplySettings;
  };
}

export interface PetConfigUpdateOptions {
  persist?: boolean;
  normalize?: boolean;
  priority?: 'normal' | 'low';
  baseConfig?: PetConfig | null;
}

export type PetConfigUpdateHandler = (
  config: PetConfig,
  options?: PetConfigUpdateOptions,
) => void;

export type DesktopPetChatMode = 'single' | 'group' | 'story';

export type ChatAgentApprovalDecision = 'approve' | 'deny';
export type ChatAgentFollowUpAction = AgentChatFollowUpAction;
export type ChatAgentApprovalStatus = 'pending' | 'approved' | 'denied' | 'running' | 'awaiting-approval' | 'completed' | 'failed' | 'blocked';
export type ChatAgentRunStatus = 'planned' | 'running' | 'awaiting-approval' | 'completed' | 'failed' | 'blocked';
export type ChatAgentRunTraceStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
export type ChatAgentRunLoopRoundStatus =
  | 'completed'
  | 'auto-continued'
  | 'awaiting-approval'
  | 'needs-user'
  | 'unverified'
  | 'failed'
  | 'blocked'
  | 'max-rounds';
export type ChatAgentWorkStageId =
  | 'understand-request'
  | 'plan-actions'
  | 'permission-check'
  | 'await-approval'
  | 'execute-tools'
  | 'verify-result'
  | 'decide-next-step'
  | 'persona-reply';
export type ChatAgentWorkStageStatus = ChatAgentRunTraceStatus;

export interface ChatAgentRunTraceItem {
  detail?: string | null;
  id: string;
  label: string;
  status: ChatAgentRunTraceStatus;
  timestamp?: number;
}

export interface ChatAgentWorkStage {
  completedAt?: number;
  details?: string[];
  id: ChatAgentWorkStageId;
  startedAt?: number;
  status: ChatAgentWorkStageStatus;
  summary?: string | null;
  title: string;
}

export interface ChatAgentRunLoopRound {
  actionLabel: string;
  assessmentSummary?: string | null;
  commandKind: AgentChatCommand['kind'];
  index: number;
  planGoal?: string | null;
  resultText?: string | null;
  status: ChatAgentRunLoopRoundStatus;
  stopReason: string;
  verification?: string | null;
}

export interface ChatAgentApprovalSummary {
  lines: string[];
  title: string;
  warning?: string | null;
}

export interface ChatAgentExecutionReceipt {
  evidenceLines?: string[];
  status: 'blocked' | 'failed' | 'success' | 'unverified';
  stateSummary?: AgentToolStateSummary | null;
  summaryLines: string[];
  title: string;
  toolName?: string | null;
  verification?: string | null;
}

export interface ChatAgentCorePlanSummary {
  phases: Array<
    | 'understand-goal'
    | 'observe-context'
    | 'plan-tools'
    | 'route-permission'
    | 'execute-tools'
    | 'verify-result'
    | 'recover-or-finish'
  >;
  selectedToolName?: string | null;
  status: 'no-plan' | 'ready' | 'needs-approval' | 'blocked';
  taskSteps: Array<{
    args: Record<string, unknown>;
    index: number;
    phase: AgentPlannerCommandStep['phase'];
    permissionStatus: AgentPermissionRouteStatus;
    reason?: string | null;
    requiresApproval: boolean;
    risk: AgentActionRisk | null;
    selected: boolean;
    tool: AgentPlannerCommandStep['tool'];
  }>;
  taskSummary: string;
}

export type ChatAgentContextKind =
  | 'app-launch'
  | 'context-query'
  | 'desktop-icon-placement'
  | 'desktop-organization'
  | 'generic-tool'
  | 'local-project'
  | 'system-info';

export interface ChatAgentContext {
  actions?: AgentChatFollowUpAction[] | null;
  appLaunch?: {
    forceNew?: boolean;
    query?: string | null;
  };
  createdAt: number;
  desktopOrganization?: {
    displayTarget?: NonNullable<AgentChatCommand['desktopOrganization']>['displayTarget'];
    groupBy?: NonNullable<AgentChatCommand['desktopOrganization']>['groupBy'];
    hasPreviewPlan?: boolean;
    mode?: NonNullable<AgentChatCommand['desktopOrganization']>['mode'];
    observationStats?: AgentDesktopObservationStats | null;
    previewSummaryLines?: string[];
    previewWarning?: string | null;
    scope?: NonNullable<AgentChatCommand['desktopOrganization']>['scope'];
    sourceDisplay?: NonNullable<AgentChatCommand['desktopOrganization']>['sourceDisplay'];
    sourceScope?: NonNullable<AgentChatCommand['desktopOrganization']>['sourceScope'];
    targetDisplay?: NonNullable<AgentChatCommand['desktopOrganization']>['targetDisplay'];
  };
  id: string;
  kind: ChatAgentContextKind;
  localProject?: {
    actionCount?: number;
    path?: string | null;
  };
  sourceCommand: AgentChatCommand;
  stateSummary?: AgentToolStateSummary | null;
  summary?: string | null;
}

export interface ChatAgentApproval {
  approvalSummary?: ChatAgentApprovalSummary | null;
  assessment?: AgentChatResultAssessment | null;
  agentRuntime?: AgentRuntimeContinuation | null;
  /** @deprecated Read compatibility for persisted records created before Runtime V4. */
  agentSessionV2?: AgentRuntimeContinuation | null;
  command: AgentChatCommand;
  context?: ChatAgentContext | null;
  corePlanSummary?: ChatAgentCorePlanSummary | null;
  errorText?: string | null;
  followUpAction?: AgentChatFollowUpAction | null;
  followUpActions?: AgentChatFollowUpAction[] | null;
  followUpText?: string | null;
  groupTaskEvent?: ChatGroupTaskEvent | null;
  id: string;
  plan: AgentExecutionPlan;
  receipt?: ChatAgentExecutionReceipt | null;
  resultText?: string | null;
  rounds?: ChatAgentRunLoopRound[];
  stages?: ChatAgentWorkStage[];
  status: ChatAgentApprovalStatus;
  stoppedByUser?: boolean;
  trace?: ChatAgentRunTraceItem[];
}

/** Desktop agent loop progress (src/agent/loop); steps are shown only in the panel's 详情. */
export interface ChatAgentLoopRun {
  durationMs?: number | null;
  goal: string;
  status: 'running' | 'done' | 'needs-user' | 'failed' | 'cancelled' | 'budget';
  steps: Array<{ changed: boolean | null; index: number; result?: string | null; text: string }>;
  summary?: string | null;
}

export interface ChatAgentRun {
  assessment?: AgentChatResultAssessment | null;
  agentRuntime?: AgentRuntimeContinuation | null;
  /** @deprecated Read compatibility for persisted records created before Runtime V4. */
  agentSessionV2?: AgentRuntimeContinuation | null;
  command: AgentChatCommand;
  context?: ChatAgentContext | null;
  corePlanSummary?: ChatAgentCorePlanSummary | null;
  errorText?: string | null;
  followUpAction?: AgentChatFollowUpAction | null;
  followUpActions?: AgentChatFollowUpAction[] | null;
  followUpText?: string | null;
  groupTaskEvent?: ChatGroupTaskEvent | null;
  id: string;
  plan: AgentExecutionPlan;
  receipt?: ChatAgentExecutionReceipt | null;
  resultText?: string | null;
  rounds?: ChatAgentRunLoopRound[];
  stages?: ChatAgentWorkStage[];
  status: ChatAgentRunStatus;
  stoppedByUser?: boolean;
  trace?: ChatAgentRunTraceItem[];
}

export interface ChatMessageImageAttachment {
  dataUrl: string;
  height?: number;
  id: string;
  kind: 'image';
  mimeType: string;
  name: string;
  sizeBytes?: number;
  width?: number;
}

export interface ChatMessageTextContentSegment {
  kind: 'text';
  text: string;
}

export interface ChatMessageExpressionContentSegment {
  assetId?: string;
  categorySnapshot?: {
    description: string;
    id: string;
    name: string;
    semanticVersion: number;
  };
  expressionId: string;
  expressionKind: 'emoji' | 'image' | 'kaomoji';
  kind: 'expression';
  mimeType?: string;
  rootSnapshot?: { id: string; name: string; sourceType: 'external' | 'managed' };
  value?: string;
}

export type ChatMessageContentSegment = ChatMessageTextContentSegment | ChatMessageExpressionContentSegment;

export interface ChatGroupTaskEvent {
  type: 'task-completed' | 'task-pending-approval' | 'task-failed';
  groupSessionId: string;
  topicId: string | null;
  taskId: string;
  factualSummary: string;
  collaborationPlan?: import('./components/chat/group/task/groupTaskCollaborationPlan').GroupTaskCollaborationPlan;
  requestedCapability?: string;
  sourceRoleIds?: string[];
  summary?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'model';
  text: string;
  attachments?: ChatMessageImageAttachment[];
  content?: ChatMessageContentSegment[];
  agentApproval?: ChatAgentApproval | null;
  agentRun?: ChatAgentRun | null;
  agentLoopRun?: ChatAgentLoopRun | null;
  chatMode?: DesktopPetChatMode;
  createdAt?: number;
  petId?: string | null;
  petName?: string | null;
  replyToPetId?: string | null;
  replyToPetName?: string | null;
  replyToPetIds?: string[];
  replyToPetNames?: string[];
  groupInteractionKind?: 'direct' | 'bridge' | 'group';
  groupContributionSignal?: import('./components/chat/group/role/groupContributionSignalProtocol').GroupContributionSignal;
  groupTaskEvent?: ChatGroupTaskEvent | null;
  storyDefinition?: import('./components/chat/story/storyTypes').StoryDefinition;
  storyId?: string | null;
  storyMessageKind?: 'character' | 'narration';
}

export type PetAutoSpeechTrigger =
  | {
      kind: 'affection-milestone';
      milestone: number;
      stats: PetStats;
    }
  | {
      kind: 'high-hunger-entry';
      hungryDurationMs: number;
      stats: PetStats;
    }
  | {
      kind: 'high-hunger-coax';
      hungryDurationMs: number;
      stats: PetStats;
    };
