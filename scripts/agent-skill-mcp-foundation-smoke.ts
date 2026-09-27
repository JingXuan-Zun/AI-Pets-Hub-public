import { strict as assert } from 'node:assert';
import {
  buildAgentPermissionRoute,
  callAgentMcpTool,
  getAgentToolLifecycleMetadata,
  isAgentToolAvailableInMode,
  listAgentMcpTools,
  listAgentSkills,
  prepareAgentToolInput,
  resolveAgentCharacterAnimationIntent,
  resolveAgentCharacterAnimationSkillCommand,
  resolveAgentSkillExecution,
  type AgentChatCommand,
  type AgentToolCallName,
} from '../src/agent';
import { runAgentProductionSession } from '../src/agent/legacy/index';
import { desktopPetChatStore } from '../src/chatStore';
import { runCharacterAnimationSkill } from '../src/agent/agentCharacterSkillRuntime';
import { createAnimationTriggerPlaybackBatches } from '../src/components/pet/animationTriggerPlaybackSchedule';
import {
  normalizeAnimationToolTriggerAudio,
  resolveAnimationToolTriggerPlayableAudio,
} from '../src/components/pet/animationToolTriggerAudio';
import {
  createPlayableAnimationToolAudioPlaybackState,
  createSkippedAnimationToolAudioPlaybackState,
} from '../src/components/pet/animationToolAudioPlaybackState';
import {
  createAnimationToolAudioPlaybackDisplay,
  resolveVisibleAnimationToolAudioPlaybackState,
} from '../src/components/pet/animationToolAudioPlaybackDisplay';
import { resolveAnimationTriggerScheduleBaseDelayMs } from '../src/components/pet/animationTriggerScheduleTiming';
import {
  createSettingsAudioAssetFromDraft,
  removeSettingsAudioAsset,
  upsertSettingsAudioAsset,
  upsertSettingsAudioAssets,
} from '../src/components/settings/settingsAudioAssetLibraryUtils';
import {
  createAudioAssetDraftFromFileLike,
  createAudioAssetDraftsFromFiles,
  createSettingsAudioAssetsFromImportDrafts,
} from '../src/components/settings/settingsAudioAssetImportUtils';
import {
  createDefaultSkillTimelinePreviewInput,
  createSkillTimelinePreview,
} from '../src/components/settings/settingsSkillTimelinePreviewUtils';
import {
  createSkillTimelineEditorDraft,
  serializeSkillTimelineEditorDraft,
} from '../src/components/settings/settingsSkillTimelineEditorModel';
import {
  appendSkillTimelineEditorStep,
  deleteSkillTimelineEditorStep,
  deleteSkillTimelineEditorSteps,
  duplicateSkillTimelineEditorStep,
  duplicateSkillTimelineEditorSteps,
  moveSkillTimelineEditorStep,
} from '../src/components/settings/settingsSkillTimelineEditorStepOperations';
import { createSkillTimelineEditorTrackRows } from '../src/components/settings/settingsSkillTimelineTrackModel';
import {
  appendSkillTimelineEditorStepOnTrack,
  assignSkillTimelineStepsTrack,
  assignSelectedSkillTimelineStepTrack,
  createSkillTimelineTrackOptions,
  nudgeSkillTimelineStepsTiming,
} from '../src/components/settings/settingsSkillTimelineTrackOperations';
import { nudgeSkillTimelineStepTiming } from '../src/components/settings/settingsSkillTimelineStepTimingNudge';
import { createSkillTimelineStripCollisionSummary } from '../src/components/settings/settingsSkillTimelineStripCollision';
import { createSkillTimelineEditorStripModel } from '../src/components/settings/settingsSkillTimelineStripModel';
import { updateSkillTimelineStepsTimingFromStripBatchDrag } from '../src/components/settings/settingsSkillTimelineStripBatchDragTiming';
import { createSkillTimelineStripBatchDragPreviews } from '../src/components/settings/settingsSkillTimelineStripBatchDragPreview';
import {
  createSkillTimelineStripDragTimingPreview,
  updateSkillTimelineStepTimingFromStripDrag,
} from '../src/components/settings/settingsSkillTimelineStripDragTiming';
import {
  resolveSkillTimelineStripDropTrackId,
  updateSkillTimelineStepTrackFromStripDrop,
} from '../src/components/settings/settingsSkillTimelineStripDropTrack';
import {
  createSkillTimelineStripResizePreview,
  updateSkillTimelineStepDurationFromStripResize,
} from '../src/components/settings/settingsSkillTimelineStripResizeDuration';
import {
  applySettingsSkillTimelineAudioAssetSelection,
  createSettingsSkillTimelineAudioAssetOptions,
  resolveSelectedSkillTimelineAudioAssetId,
} from '../src/components/settings/settingsSkillTimelineAudioAssetOptions';
import { resolveSettingsSkillTimelineAudioPreviewSource } from '../src/components/settings/settingsSkillTimelineAudioPreview';
import { splitPetMessageAnimationBindings } from '../src/components/pet/petMessageAnimationPlaybackState';
import { resolveAgentDeterministicSkillRoute } from '../src/agent/runtime/agentDeterministicSkillRoute';
import { resolveAgentChatCommandWithPlanner } from '../src/agent/agentPlanner';
import { type PetConfig } from '../src/types';
import { resolveLive2DExpressionCandidates } from '../src/pet-runtime/live2d/live2dRuntimeMapping';

const SKILL_MCP_TOOLS: AgentToolCallName[] = [
  'list_agent_skills',
  'execute_agent_skill',
  'list_mcp_tools',
  'call_mcp_tool',
];

function createToolCommand(name: AgentToolCallName, input: Record<string, unknown>): AgentChatCommand {
  return {
    instruction: `smoke ${name}`,
    kind: 'tool-call',
    sourceText: `smoke ${name}`,
    toolCall: {
      input,
      name,
    },
  };
}

function assertToolFoundation() {
  for (const toolName of SKILL_MCP_TOOLS) {
    assert.equal(isAgentToolAvailableInMode(toolName, 'agent'), true, `${toolName} available`);
    assert.ok(getAgentToolLifecycleMetadata(toolName), `${toolName} lifecycle metadata`);
  }
}

function assertSkillRegistry() {
  const animationSkills = listAgentSkills({ query: 'animation' });
  assert.ok(animationSkills.some((skill) => skill.id === 'character.animation'));

  const result = resolveAgentSkillExecution({
    inputJson: '{"animationId":"wave"}',
    skillId: 'character.animation',
  });
  assert.equal(result.ok, true);
  assert.equal(result.marker, '[animation:wave]');

  const timelineResult = resolveAgentSkillExecution({
    inputJson: '{"timeline":["wave","spin"]}',
    skillId: 'character.animation',
  });
  assert.equal(timelineResult.ok, true);
  assert.equal(timelineResult.marker, '[animation-timeline:2]');
}

async function assertCharacterAnimationSkillRouting() {
  const intent = resolveAgentCharacterAnimationIntent('\u8ba9\u89d2\u8272\u6325\u624b');
  assert.equal(intent?.animationId, 'wave');
  assert.equal(resolveAgentCharacterAnimationIntent('what is a wave'), null);

  const command = resolveAgentCharacterAnimationSkillCommand('\u8ba9\u89d2\u8272\u6325\u624b');
  assert.equal(command?.capabilityId, 'skill-system');
  assert.equal(command?.toolCall?.name, 'execute_agent_skill');
  assert.equal(command?.toolCall?.input.skillId, 'character.animation');
  assert.equal(command?.toolCall?.input.dryRun, false);
  assert.match(String(command?.toolCall?.input.inputJson), /wave/u);

  const plannedCommand = await resolveAgentChatCommandWithPlanner(
    '\u8ba9\u89d2\u8272\u6325\u624b',
    createAnimationSkillConfig().settings,
  );
  assert.equal(plannedCommand?.toolCall?.name, 'execute_agent_skill');

  const route = resolveAgentDeterministicSkillRoute({
    stepIndex: 1,
    steps: [],
    toolResults: [],
    userGoal: '\u8ba9\u89d2\u8272\u6325\u624b',
  });
  assert.equal(route.handled, true);
  assert.equal(route.approval?.command.toolCall?.name, 'execute_agent_skill');

  const sessionResult = await runAgentProductionSession({
    modelCaller: async () => {
      throw new Error('deterministic Skill route should run before model planning');
    },
    settings: createAnimationSkillConfig().settings,
    sourceText: '\u8ba9\u89d2\u8272\u6325\u624b',
    toolExecutor: async () => {
      throw new Error('approval-required Skill should not execute before approval');
    },
    userGoal: '\u8ba9\u89d2\u8272\u6325\u624b',
  });
  assert.equal(sessionResult.status, 'needs-approval');
  assert.equal(sessionResult.pendingApproval?.command.toolCall?.name, 'execute_agent_skill');
  assert.match(sessionResult.continuation.historyLines.join('\n'), /deterministic character skill route/u);
}

function assertMcpRegistry() {
  const platformTools = listAgentMcpTools('platform');
  assert.ok(platformTools.some((tool) => tool.name === 'skills.list'));
  assert.ok(platformTools.some((tool) => tool.name === 'skills.execute'));

  const result = callAgentMcpTool({ serverId: 'platform', name: 'skills.list' });
  assert.equal(result.isError, undefined);
  assert.ok(Array.isArray(result.structuredContent?.skills));
}

function assertInputSchema() {
  assert.equal(prepareAgentToolInput('execute_agent_skill', {}).ok, false);
  assert.equal(prepareAgentToolInput('call_mcp_tool', { serverId: 'platform' }).ok, false);
  assert.equal(prepareAgentToolInput('list_agent_skills', { limit: '2' }).ok, true);
}

function assertPermissionRoutes() {
  const listSkillsRoute = buildAgentPermissionRoute(createToolCommand('list_agent_skills', {}));
  assert.equal(listSkillsRoute.status, 'silent');

  const listMcpRoute = buildAgentPermissionRoute(createToolCommand('list_mcp_tools', {}));
  assert.equal(listMcpRoute.status, 'silent');

  const executeSkillRoute = buildAgentPermissionRoute(createToolCommand('execute_agent_skill', {
    skillId: 'character.animation',
  }));
  assert.equal(executeSkillRoute.status, 'needs-approval');

  const callMcpRoute = buildAgentPermissionRoute(createToolCommand('call_mcp_tool', {
    name: 'skills.list',
    serverId: 'platform',
  }));
  assert.equal(callMcpRoute.status, 'needs-approval');
}

function createAnimationSkillConfig(): PetConfig {
  return {
    autoMovementEnabled: true,
    companionPets: [],
    currentAction: 'IDLE',
    customModelPresets: [
      {
        id: 'skill-test-model',
        motionBindings: [
          {
            durationMs: 800,
            format: 'vrma',
            id: 'wave-binding',
            motionKey: 'happy',
            name: 'Wave Hello',
            semanticAliases: ['wave'],
            sourceUrl: 'C:/motions/wave.vrma',
          },
          {
            durationMs: 1200,
            format: 'vrma',
            id: 'spin-binding',
            motionKey: 'happy',
            name: 'Spin Dance',
            semanticAliases: ['spin', 'dance'],
            sourceUrl: 'C:/motions/spin.vrma',
          },
          {
            durationMs: 700,
            format: 'vrma',
            id: 'clap-binding',
            motionKey: 'happy',
            name: 'Clap Cheer',
            semanticAliases: ['clap'],
            sourceUrl: 'C:/motions/clap.vrma',
          },
          {
            durationMs: 650,
            format: 'vrma',
            id: 'jump-binding',
            motionKey: 'happy',
            name: 'Jump Hop',
            semanticAliases: ['jump'],
            sourceUrl: 'C:/motions/jump.vrma',
          },
          {
            durationMs: 500,
            format: 'exp3',
            id: 'smile-expression-binding',
            kind: 'expression',
            motionKey: 'happy',
            name: 'Smile Bright',
            semanticAliases: ['smile'],
            semanticTags: ['expression'],
            sourceUrl: 'C:/models/skill-test/expressions/smile.exp3.json',
          },
        ],
        name: 'Skill Test Model',
        type: '3d',
        url: 'C:/models/skill-test.vrm',
      },
    ],
    folders: [],
    foodAppearances: [],
    musicAssets: [],
    modelType: '3d',
    modelUrl: 'C:/models/skill-test.vrm',
    personality: {
      beginDialogs: [],
      chatAvatarUrl: '',
      chatHistoryMemory: '',
      customErrorMessage: '',
      greeting: '',
      knowledgeBase: '',
      name: 'Skill Test Pet',
      systemInstruction: '',
      traits: [],
      userMemory: '',
      webLearningEnabled: false,
      webSearchEnabled: false,
    },
    pointerLookEnabled: true,
    position: { x: 0, y: 0 },
    scale: 1,
    settings: {
      activityAreaLimitEnabled: false,
      apiSttProtocol: 'openai-compatible',
      apiTtsProtocol: 'openai-compatible',
      autoSpeakResponses: false,
      avatar3dRuntimeBackend: 'three',
      braveSearchApiKey: '',
      browserSearchBrowserPath: '',
      browserSearchDebugPort: 9222,
      browserSearchEngine: 'google',
      browserSearchUrlTemplate: '',
      browserTtsApiKey: '',
      browserTtsApiUrl: '',
      browserTtsLanguage: 'zh-CN',
      chatAvatarSize: 36,
      chatAvatarsEnabled: true,
      chatBackgroundImageEnabled: false,
      chatBackgroundImageSize: 'cover',
      chatBackgroundImageUrl: '',
      chatBackgroundImageVisibility: 0.2,
      chatBracketOuterTextColor: '#888888',
      chatUserAvatarUrl: '',
      chatUserDisplayId: 'user',
      chatUserDisplayName: 'User',
      customApiKey: '',
      customApiUrl: '',
      customModelCapabilities: {
        images: false,
        text: true,
        video: false,
      },
      customModelName: '',
      customModelRequestParams: [],
      customSttApiKey: '',
      customSttApiUrl: '',
      customTtsApiKey: '',
      customTtsApiUrl: '',
      customVoiceApiKey: '',
      customVoiceApiUrl: '',
      customWebSearchApiKey: '',
      customWebSearchMethod: 'GET',
      customWebSearchQueryParam: 'q',
      customWebSearchUrl: '',
      desktopIconInteractionEnabled: false,
      desktopMouseInteractionEnabled: false,
      engineType: 'Three.js / GLTF',
      globalKnowledgeBase: '',
      hiddenBuiltinModelPresetIds: [],
      llmModel: 'test',
      llmProvider: 'gemini',
      localSttModelPath: '',
      localTtsModelPath: '',
      localTtsRandomSeed: 0,
      localTtsReferenceAudioPath: '',
      localTtsReferenceText: '',
      localTtsServerUrl: '',
      memoryDepth: 4096,
      physicsEnabled: true,
      serperApiKey: '',
      speechExpressivePunctuationEnabled: true,
      speechPlaybackRate: 1,
      speechRecognitionLang: 'zh-CN',
      speechSkipBracketContent: true,
      sttProvider: 'browser',
      tavilyApiKey: '',
      timeAwarenessEnabled: false,
      ttsProvider: 'browser',
      visionCustomApiKey: '',
      visionCustomApiUrl: '',
      visionCustomModelName: '',
      visionCustomModelRequestParams: [],
      visionLlmModel: 'test',
      visionMode: 'auto',
      visionModelProvider: 'inherit',
      voiceEnabled: false,
      voiceInputEnabled: false,
      voiceName: '',
      webLearningEnabled: false,
      webSearchEnabled: false,
      webSearchProvider: 'browser',
    },
    stats: {
      affection: 80,
      fatigue: 0,
      hunger: 0,
    },
  };
}

function assertCharacterAnimationSkillRuntime() {
  desktopPetChatStore.reset();
  const config = createAnimationSkillConfig();
  const dryRunResult = runCharacterAnimationSkill({
    config,
    dryRun: true,
    input: { animationId: 'wave' },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(dryRunResult.ok, true);
  assert.deepEqual(dryRunResult.animationIds, ['wave_hello']);
  assert.equal(desktopPetChatStore.getState().animationToolTriggersByPetId.primary, undefined);

  const executeResult = runCharacterAnimationSkill({
    config,
    dryRun: false,
    input: { animationId: 'wave', targetPetId: 'primary' },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(executeResult.ok, true);
  const trigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
  assert.deepEqual(trigger?.animationIds, ['wave_hello']);
  assert.equal(trigger?.source, 'agent-skill');

  const multiIdResult = runCharacterAnimationSkill({
    config,
    dryRun: false,
    input: { animationIds: ['wave', 'spin', 'clap', 'jump'], targetPetId: 'primary' },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(multiIdResult.ok, true);
  assert.deepEqual(multiIdResult.animationIds, ['wave_hello', 'spin_dance', 'clap_cheer', 'jump_hop']);
  assert.deepEqual(
    desktopPetChatStore.getState().animationToolTriggersByPetId.primary?.animationIds,
    ['wave_hello', 'spin_dance', 'clap_cheer', 'jump_hop'],
  );

  const missingResult = runCharacterAnimationSkill({
    config,
    dryRun: false,
    input: { animationId: 'missing-motion' },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(missingResult.ok, false);

  const timelineResult = runCharacterAnimationSkill({
    config,
    dryRun: true,
    input: {
      timeline: [
        { animationId: 'wave', atMs: 0, durationMs: 800, label: 'hello' },
        { name: 'spin' },
        'clap',
        'jump',
      ],
    },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(timelineResult.ok, true);
  assert.deepEqual(timelineResult.animationIds, ['wave_hello', 'spin_dance', 'clap_cheer', 'jump_hop']);
  assert.equal(timelineResult.timelineSteps.length, 4);
  assert.match(timelineResult.observations.join('\n'), /Timeline steps: 4/u);
  assert.match(timelineResult.observations.join('\n'), /Timeline queued unique ids: 4\/12/u);

  const expressionTimelineResult = runCharacterAnimationSkill({
    config,
    dryRun: true,
    input: {
      timeline: [
        { animationId: 'wave', expressionId: 'smile', label: 'smiling hello' },
        { animationId: 'spin' },
      ],
    },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(expressionTimelineResult.ok, true);
  assert.deepEqual(expressionTimelineResult.animationIds, ['wave_hello', 'smile_bright', 'spin_dance']);
  assert.deepEqual(expressionTimelineResult.timelineSteps[0]?.expressionCandidates, ['smile']);
  assert.match(expressionTimelineResult.observations.join('\n'), /Timeline expressions: 1/u);
  assert.match(expressionTimelineResult.observations.join('\n'), /expression=smile_bright/u);

  const syncedDanceResult = runCharacterAnimationSkill({
    config,
    dryRun: true,
    input: {
      beatCount: 16,
      bpm: 128,
      offsetMs: 240,
      songId: 'test-single-dance',
      timeline: [
        { animationId: 'wave', beat: 1, holdBeats: 2 },
        { animationId: 'spin', bar: 1, beat: 3 },
        { animationId: 'clap', beat: 5 },
      ],
    },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(syncedDanceResult.ok, true);
  assert.deepEqual(syncedDanceResult.animationIds, ['wave_hello', 'spin_dance', 'clap_cheer']);
  assert.deepEqual(syncedDanceResult.schedule, [
    { animationId: 'wave_hello', delayMs: 240 },
    { animationId: 'spin_dance', delayMs: 1178 },
    { animationId: 'clap_cheer', delayMs: 2115 },
  ]);
  assert.equal(syncedDanceResult.timelineSteps[0]?.sync?.beat, 1);
  assert.equal(syncedDanceResult.timelineSteps[0]?.sync?.holdBeats, 2);
  assert.match(syncedDanceResult.observations.join('\n'), /Timeline sync: song:test-single-dance/u);
  assert.match(syncedDanceResult.observations.join('\n'), /Timeline sync timing: bpm=128, offset=240ms, beats=16/u);
  assert.match(syncedDanceResult.observations.join('\n'), /Timeline sync steps: 3/u);
  assert.deepEqual(syncedDanceResult.audio, {
    offsetMs: 240,
    source: 'song',
    sourceRef: 'test-single-dance',
  });
  assert.equal(resolveAnimationToolTriggerPlayableAudio(syncedDanceResult.audio), null);
  const musicLibraryConfig = {
    ...config,
    musicAssets: [
      {
        aliases: ['demo-single-dance'],
        durationMs: 7500,
        id: 'test-single-dance',
        name: 'Test Single Dance',
        url: 'C:/music/test-single-dance.mp3',
      },
    ],
  } as PetConfig;
  const resolvedSongDanceResult = runCharacterAnimationSkill({
    config: musicLibraryConfig,
    dryRun: true,
    input: {
      beatCount: 16,
      bpm: 128,
      offsetMs: 240,
      songId: 'demo-single-dance',
      timeline: [
        { animationId: 'wave', beat: 1 },
        { animationId: 'spin', beat: 3 },
        { animationId: 'clap', beat: 5 },
      ],
    },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(resolvedSongDanceResult.ok, true);
  assert.deepEqual(resolvedSongDanceResult.audio, {
    durationMs: 7500,
    offsetMs: 240,
    source: 'audio',
    sourceRef: 'C:/music/test-single-dance.mp3',
  });
  assert.match(resolvedSongDanceResult.observations.join('\n'), /Timeline audio resolved: song:demo-single-dance -> test-single-dance/u);
  assert.match(
    resolveAnimationToolTriggerPlayableAudio(resolvedSongDanceResult.audio)?.playbackUrl ?? '',
    /^desktop-pet-file:\/\/local\/C:\/music\/test-single-dance\.mp3$/u,
  );
  const audioAsset = createSettingsAudioAssetFromDraft({
    aliasesText: 'demo-single-dance, stage-demo',
    durationMs: '7500',
    id: 'test-single-dance',
    name: 'Test Single Dance',
    url: 'C:/music/test-single-dance.mp3',
  });
  assert.equal(audioAsset?.aliases?.length, 2);
  assert.equal(audioAsset?.durationMs, 7500);
  const configWithAudioAsset = upsertSettingsAudioAsset(config, audioAsset!);
  assert.equal(configWithAudioAsset.musicAssets.length, 1);
  assert.equal(configWithAudioAsset.musicAssets[0]?.id, 'test-single-dance');
  assert.equal(configWithAudioAsset.musicAssets[0]?.url, 'C:/music/test-single-dance.mp3');
  const configWithoutAudioAsset = removeSettingsAudioAsset(configWithAudioAsset, 'test-single-dance');
  assert.equal(configWithoutAudioAsset.musicAssets.length, 0);
  assert.deepEqual(
    createAnimationTriggerPlaybackBatches(
      config.customModelPresets[0]?.motionBindings ?? [],
      syncedDanceResult.schedule,
    ).map((batch) => ({
      delayMs: batch.delayMs,
      ids: batch.motionBindings.map((binding) => binding.id),
    })),
    [
      { delayMs: 240, ids: ['wave-binding'] },
      { delayMs: 1178, ids: ['spin-binding'] },
      { delayMs: 2115, ids: ['clap-binding'] },
    ],
  );
  const repeatedDanceResult = runCharacterAnimationSkill({
    config,
    dryRun: false,
    input: {
      bpm: 120,
      targetPetId: 'primary',
      timeline: [
        { animationId: 'wave', beat: 1 },
        { animationId: 'spin', beat: 2 },
        { animationId: 'wave', beat: 3 },
        { animationId: 'clap', beat: 4 },
        { animationId: 'wave', beat: 5 },
        { animationId: 'jump', beat: 6 },
      ],
    },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(repeatedDanceResult.ok, true);
  assert.deepEqual(repeatedDanceResult.animationIds, ['wave_hello', 'spin_dance', 'clap_cheer', 'jump_hop']);
  assert.deepEqual(repeatedDanceResult.schedule.map((item) => item.animationId), [
    'wave_hello',
    'spin_dance',
    'wave_hello',
    'clap_cheer',
    'wave_hello',
    'jump_hop',
  ]);
  const repeatedDanceTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
  assert.deepEqual(repeatedDanceTrigger?.schedule?.map((item) => item.animationId), [
    'wave_hello',
    'spin_dance',
    'wave_hello',
    'clap_cheer',
    'wave_hello',
    'jump_hop',
  ]);
  assert.deepEqual(
    createAnimationTriggerPlaybackBatches(
      config.customModelPresets[0]?.motionBindings ?? [],
      repeatedDanceTrigger?.schedule,
    ).map((batch) => ({
      delayMs: batch.delayMs,
      ids: batch.motionBindings.map((binding) => binding.id),
    })),
    [
      { delayMs: 0, ids: ['wave-binding'] },
      { delayMs: 500, ids: ['spin-binding'] },
      { delayMs: 1000, ids: ['wave-binding'] },
      { delayMs: 1500, ids: ['clap-binding'] },
      { delayMs: 2000, ids: ['wave-binding'] },
      { delayMs: 2500, ids: ['jump-binding'] },
    ],
  );
  const audioUrlDanceResult = runCharacterAnimationSkill({
    config,
    dryRun: false,
    input: {
      audioOffsetMs: 120,
      audioStartDelayMs: 40,
      audioUrl: 'C:/music/test-single-dance.mp3',
      targetPetId: 'primary',
      timeline: [
        { animationId: 'wave', atMs: 120 },
      ],
    },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(audioUrlDanceResult.ok, true);
  assert.deepEqual(audioUrlDanceResult.audio, {
    offsetMs: 120,
    source: 'audio',
    sourceRef: 'C:/music/test-single-dance.mp3',
    startDelayMs: 40,
  });
  const audioTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
  assert.equal(audioTrigger?.audio?.source, 'audio');
  assert.equal(audioTrigger?.audio?.sourceRef, 'C:/music/test-single-dance.mp3');
  assert.equal(audioTrigger?.audio?.offsetMs, 120);
  assert.equal(audioTrigger?.audio?.startDelayMs, 40);
  assert.equal(resolveAnimationTriggerScheduleBaseDelayMs(audioTrigger!), 40);
  assert.match(audioTrigger?.audio?.playbackUrl ?? '', /^desktop-pet-file:\/\/local\/C:\/music\/test-single-dance\.mp3$/u);
  assert.deepEqual(
    {
      scheduledDelayMs: createPlayableAnimationToolAudioPlaybackState({
        petId: 'primary',
        status: 'pending',
        trigger: audioTrigger!,
      })?.scheduledDelayMs,
      status: createPlayableAnimationToolAudioPlaybackState({
        petId: 'primary',
        status: 'pending',
        trigger: audioTrigger!,
      })?.status,
      syncOffsetMs: createPlayableAnimationToolAudioPlaybackState({
        petId: 'primary',
        status: 'pending',
        trigger: audioTrigger!,
      })?.syncOffsetMs,
    },
    {
      scheduledDelayMs: 40,
      status: 'pending',
      syncOffsetMs: 120,
    },
  );
  desktopPetChatStore.setAnimationToolAudioPlaybackState('primary', createPlayableAnimationToolAudioPlaybackState({
    petId: 'primary',
    status: 'playing',
    trigger: audioTrigger!,
  }));
  assert.equal(desktopPetChatStore.getState().animationToolAudioPlaybackByPetId.primary?.status, 'playing');
  const activePlaybackDisplay = createAnimationToolAudioPlaybackDisplay(
    desktopPetChatStore.getState().animationToolAudioPlaybackByPetId.primary,
  );
  assert.equal(activePlaybackDisplay?.title, '正在播放');
  assert.equal(activePlaybackDisplay?.tone, 'active');
  assert.equal(activePlaybackDisplay?.detail, '同步 120ms');
  const visibleFallbackPlaybackState = resolveVisibleAnimationToolAudioPlaybackState({
    companion: {
      petId: 'companion',
      scheduledDelayMs: 0,
      source: 'song',
      sourceRef: 'missing-song',
      status: 'skipped',
      token: 997,
      updatedAt: 10,
    },
    primary: undefined,
    secondary: {
      errorMessage: 'load failed',
      petId: 'secondary',
      scheduledDelayMs: 0,
      source: 'audio',
      sourceRef: 'C:/music/broken.wav',
      status: 'failed',
      token: 996,
      updatedAt: 20,
    },
  }, 'primary');
  assert.equal(visibleFallbackPlaybackState?.petId, 'secondary');
  assert.equal(createAnimationToolAudioPlaybackDisplay(visibleFallbackPlaybackState)?.title, '播放失败');
  assert.match(
    normalizeAnimationToolTriggerAudio({
      startDelayMs: 25,
      source: 'audio',
      sourceRef: 'https://example.test/dance.wav',
    })?.playbackUrl ?? '',
    /^https:\/\/example\.test\/dance\.wav$/u,
  );
  assert.equal(
    normalizeAnimationToolTriggerAudio({
      startDelayMs: 25,
      source: 'audio',
      sourceRef: 'https://example.test/dance.wav',
    })?.startDelayMs,
    25,
  );
  const skippedSongAudioState = createSkippedAnimationToolAudioPlaybackState({
    petId: 'primary',
    trigger: {
      animationIds: ['wave_hello'],
      audio: syncedDanceResult.audio ?? undefined,
      source: 'agent-skill',
      token: 998,
    },
  });
  assert.equal(skippedSongAudioState?.status, 'skipped');
  assert.equal(skippedSongAudioState?.syncOffsetMs, 240);
  const parallelExpressionBatches = createAnimationTriggerPlaybackBatches(
    config.customModelPresets[0]?.motionBindings ?? [],
    [
      { animationId: 'wave_hello', delayMs: 240 },
      { animationId: 'smile_bright', delayMs: 240 },
    ],
  );
  assert.equal(parallelExpressionBatches.length, 1);
  assert.deepEqual(
    parallelExpressionBatches[0]?.motionBindings.map((binding) => binding.id),
    ['wave-binding', 'smile-expression-binding'],
  );
  const splitParallelBindings = splitPetMessageAnimationBindings(
    parallelExpressionBatches[0]?.motionBindings ?? [],
  );
  assert.deepEqual(splitParallelBindings.motionBindings.map((binding) => binding.id), ['wave-binding']);
  assert.deepEqual(splitParallelBindings.expressionBindings.map((binding) => binding.id), ['smile-expression-binding']);
  assert.deepEqual(
    resolveLive2DExpressionCandidates({
      manualExpressionBinding: splitParallelBindings.expressionBindings[0],
    }),
    {
      candidates: ['Smile Bright', 'smile-expression-binding', 'smile', 'expression'],
      expressionKey: 'Smile Bright',
    },
  );

  const timelineJsonResult = runCharacterAnimationSkill({
    config,
    dryRun: false,
    input: {
      targetPetId: 'primary',
      timelineJson: JSON.stringify({
        steps: [
          { animationId: 'wave' },
          { animationId: 'spin' },
          { animationId: 'clap' },
        ],
      }),
    },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(timelineJsonResult.ok, true);
  const timelineTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
  assert.deepEqual(timelineTrigger?.animationIds, ['wave_hello', 'spin_dance', 'clap_cheer']);
  assert.equal(timelineTrigger?.source, 'agent-skill');

  const executeSyncedDanceResult = runCharacterAnimationSkill({
    config,
    dryRun: false,
    input: {
      bpm: 120,
      offsetMs: 100,
      targetPetId: 'primary',
      timeline: [
        { animationId: 'wave', beat: 1 },
        { animationId: 'spin', beat: 2 },
        { animationId: 'clap', beat: 3 },
      ],
    },
    resolveMotionBindings: ({ customModelPresets }) => customModelPresets[0]?.motionBindings ?? [],
  });
  assert.equal(executeSyncedDanceResult.ok, true);
  const scheduledTrigger = desktopPetChatStore.getState().animationToolTriggersByPetId.primary;
  assert.deepEqual(scheduledTrigger?.schedule, [
    { animationId: 'wave_hello', delayMs: 100 },
    { animationId: 'spin_dance', delayMs: 600 },
    { animationId: 'clap_cheer', delayMs: 1100 },
  ]);
}

async function assertAudioAssetImportPolish() {
  const inferredDraft = createAudioAssetDraftFromFileLike({
    name: 'Demo Single Dance.mp3',
    path: 'C:/music/Demo Single Dance.mp3',
  });
  assert.deepEqual(inferredDraft, {
    aliasesText: '',
    durationMs: '',
    id: 'Demo Single Dance',
    name: 'Demo Single Dance',
    url: 'C:/music/Demo Single Dance.mp3',
  });
  assert.equal(createAudioAssetDraftFromFileLike({ name: 'missing.wav' }), null);

  const importResult = await createAudioAssetDraftsFromFiles([
    { name: 'repeat.wav', path: 'C:/music/repeat-a.wav' } as File,
    { name: 'repeat.mp3', path: 'C:/music/repeat-b.mp3' } as File,
    { name: 'skipped.ogg' } as File,
  ]);
  assert.equal(importResult.drafts.length, 2);
  assert.deepEqual(importResult.skippedFileNames, ['skipped.ogg']);

  const importedAssets = createSettingsAudioAssetsFromImportDrafts(importResult.drafts);
  assert.deepEqual(importedAssets.map((asset) => asset.id), ['repeat', 'repeat-2']);
  assert.deepEqual(
    importedAssets.map((asset) => asset.url),
    ['C:/music/repeat-a.wav', 'C:/music/repeat-b.mp3'],
  );

  const config = createAnimationSkillConfig();
  const configWithImports = upsertSettingsAudioAssets(config, importedAssets);
  assert.equal(configWithImports.musicAssets.length, 2);
  assert.equal(configWithImports.musicAssets[1]?.id, 'repeat-2');
}

function assertSkillTimelinePreviewPanelModel() {
  const config = createAnimationSkillConfig();
  const defaultInputJson = createDefaultSkillTimelinePreviewInput(config, 'primary');
  assert.match(defaultInputJson, /wave/u);

  const preview = createSkillTimelinePreview({
    config,
    inputJson: JSON.stringify({
      beatCount: 8,
      bpm: 120,
      offsetMs: 100,
      timeline: [
        { animationId: 'wave', beat: 1, expressionId: 'smile' },
        { animationId: 'spin', beat: 3 },
      ],
    }),
    targetPetId: 'primary',
  });
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.animationIds, ['wave_hello', 'smile_bright', 'spin_dance']);
  assert.equal(preview.scheduleCount, 3);
  assert.deepEqual(preview.stepRows.map((step) => step.delayMs), [100, 1100]);
  assert.match(preview.audioLabel, /metadata \/ timeline-sync/u);
  assert.ok(preview.observationLines.some((line) => line.includes('Timeline steps: 2')));

  const invalidPreview = createSkillTimelinePreview({
    config,
    inputJson: '[1,2]',
    targetPetId: 'primary',
  });
  assert.equal(invalidPreview.ok, false);
  assert.equal(invalidPreview.error, 'Input must be a JSON object.');
}

function assertSkillTimelineEditorModel() {
  const config = createAnimationSkillConfig();
  const configWithMusicAsset = {
    ...config,
    musicAssets: [
      {
        aliases: ['theme-alias'],
        durationMs: 8200,
        id: 'main-theme',
        name: 'Main Theme',
        url: 'C:/music/main-theme.mp3',
      },
    ],
  } as PetConfig;
  const draft = createSkillTimelineEditorDraft(JSON.stringify({
    beatCount: 8,
    bpm: 120,
    durationMs: 7500,
    offsetMs: 100,
    startDelayMs: 250,
    songId: 'main-theme',
    trackOrder: ['expression', 'motion'],
    timeline: [
      { animationId: 'wave', beat: 1, durationMs: 1200, expressionId: 'smile', label: 'Intro' },
      { animationId: 'spin', atMs: 1800, label: 'Drop', track: 'expression' },
      { expressionId: 'smile', beat: 7, label: 'Smile hold' },
    ],
  }));

  assert.equal(draft.steps.length, 3);
  assert.equal(draft.steps[0]?.timingMode, 'beat');
  assert.equal(draft.steps[1]?.timingMode, 'atMs');
  assert.equal(draft.steps[0]?.durationMs, '1200');
  assert.equal(draft.steps[0]?.holdBeats, '');
  assert.equal(draft.steps[0]?.track, 'motion');
  assert.equal(draft.steps[1]?.track, 'expression');
  assert.equal(draft.steps[2]?.track, 'expression');
  assert.equal(nudgeSkillTimelineStepTiming(draft.steps[0]!, -1).beat, 1);
  assert.equal(nudgeSkillTimelineStepTiming(draft.steps[0]!, 1).beat, 2);
  assert.equal(nudgeSkillTimelineStepTiming(draft.steps[1]!, -1).atMs, 1700);
  assert.equal(nudgeSkillTimelineStepTiming({ ...draft.steps[1]!, atMs: 50 }, -1).atMs, 0);
  const duplicatedDraft = duplicateSkillTimelineEditorStep(draft, 'step-1');
  assert.equal(duplicatedDraft.steps.length, 4);
  assert.equal(duplicatedDraft.steps[1]?.id, 'step-4');
  assert.equal(duplicatedDraft.steps[1]?.label, 'Intro copy');
  assert.equal(duplicatedDraft.steps[1]?.animationId, 'wave');
  assert.deepEqual(moveSkillTimelineEditorStep(draft, 'step-2', -1).steps.map((step) => step.id), [
    'step-2',
    'step-1',
    'step-3',
  ]);
  assert.deepEqual(deleteSkillTimelineEditorStep(draft, 'step-2').steps.map((step) => step.id), [
    'step-1',
    'step-3',
  ]);
  assert.deepEqual(deleteSkillTimelineEditorSteps(draft, ['step-1', 'step-3']).steps.map((step) => step.id), [
    'step-2',
  ]);
  assert.equal(appendSkillTimelineEditorStep(draft).steps[3]?.id, 'step-4');
  assert.equal(draft.audioStartDelayMs, '250');
  assert.equal(draft.durationMs, '7500');
  assert.equal(draft.songId, 'main-theme');
  assert.deepEqual(draft.trackOrder, ['expression', 'motion']);
  const audioAssetOptions = createSettingsSkillTimelineAudioAssetOptions(configWithMusicAsset);
  assert.equal(audioAssetOptions.length, 1);
  assert.equal(audioAssetOptions[0]?.label, 'Main Theme (main-theme)');
  assert.equal(resolveSelectedSkillTimelineAudioAssetId(draft, audioAssetOptions), 'main-theme');

  const assetSelectedDraft = applySettingsSkillTimelineAudioAssetSelection({
    ...draft,
    audioUrl: '',
    durationMs: '',
    songId: '',
  }, audioAssetOptions, 'main-theme');
  assert.equal(assetSelectedDraft.songId, 'main-theme');
  assert.equal(assetSelectedDraft.audioUrl, 'C:/music/main-theme.mp3');
  assert.equal(assetSelectedDraft.durationMs, '8200');
  const assetPreview = resolveSettingsSkillTimelineAudioPreviewSource(assetSelectedDraft, audioAssetOptions);
  assert.equal(assetPreview?.label, 'Main Theme (main-theme)');
  assert.match(assetPreview?.playbackUrl ?? '', /desktop-pet-file:\/\/local\/C:\/music\/main-theme\.mp3/u);
  const explicitPreview = resolveSettingsSkillTimelineAudioPreviewSource({
    ...assetSelectedDraft,
    audioUrl: 'https://example.test/theme.ogg',
  }, audioAssetOptions);
  assert.equal(explicitPreview?.playbackUrl, 'https://example.test/theme.ogg');
  const unsupportedPreview = resolveSettingsSkillTimelineAudioPreviewSource({
    ...assetSelectedDraft,
    audioUrl: 'C:/music/readme.txt',
    songId: '',
  }, audioAssetOptions);
  assert.equal(unsupportedPreview, null);

  const serialized = serializeSkillTimelineEditorDraft({
    ...assetSelectedDraft,
    bpm: 150,
    steps: [
      ...draft.steps,
      {
        animationId: 'clap',
        atMs: 0,
        beat: 5,
        durationMs: '',
        expressionId: '',
        holdBeats: '2',
        id: 'step-4',
        label: 'Clap',
        timingMode: 'beat',
        track: 'motion',
      },
    ],
  });
  const serializedInput = JSON.parse(serialized) as Record<string, unknown>;
  assert.equal(serializedInput.songId, 'main-theme');
  assert.equal(serializedInput.audioUrl, 'C:/music/main-theme.mp3');
  assert.equal(serializedInput.durationMs, 8200);
  assert.equal(serializedInput.audioStartDelayMs, 250);
  assert.equal(serializedInput.startDelayMs, undefined);
  assert.equal(serializedInput.bpm, 150);
  assert.deepEqual(serializedInput.trackOrder, ['expression', 'motion']);
  const serializedTimeline = serializedInput.timeline as Array<Record<string, unknown>>;
  assert.equal(serializedTimeline[0]?.durationMs, 1200);
  assert.equal(serializedTimeline[1]?.track, 'expression');
  assert.equal(serializedTimeline[3]?.holdBeats, 2);
  const serializedDraft = createSkillTimelineEditorDraft(serialized);
  const trackRows = createSkillTimelineEditorTrackRows(serializedDraft);
  assert.deepEqual(trackRows.map((track) => `${track.id}:${track.stepCount}:${track.durationLabel}`), [
    'expression:2:1800-2500ms',
    'motion:2:100-1700ms',
  ]);
  const stripModel = createSkillTimelineEditorStripModel(serializedDraft);
  assert.equal(stripModel.durationMs, 8200);
  assert.deepEqual(stripModel.rows.map((row) => `${row.id}:${row.items.length}`), [
    'expression:2',
    'motion:2',
  ]);
  assert.deepEqual(stripModel.rows[1]?.items.map((item) => `${item.id}:${item.leftPercent}:${item.widthPercent}`), [
    'step-1:1.22:14.63',
    'step-4:20.73:9.76',
  ]);
  assert.deepEqual(stripModel.rows[1]?.items.map((item) => `${item.id}:${item.delayMs}:${item.durationMs}:${item.endMs}`), [
    'step-1:100:1200:1300',
    'step-4:1700:800:2500',
  ]);
  assert.deepEqual(stripModel.rows[0]?.items.map((item) => `${item.id}:${item.leftPercent}:${item.widthPercent}`), [
    'step-2:21.95:8',
    'step-3:30.49:8',
  ]);
  assert.deepEqual(createSkillTimelineStripCollisionSummary(stripModel.rows).collisionStepIds, []);
  const collisionDraft = {
    ...serializedDraft,
    steps: serializedDraft.steps.map((step) => (
      step.id === 'step-4' ? { ...step, beat: 3 } : step
    )),
  };
  const collisionSummary = createSkillTimelineStripCollisionSummary(
    createSkillTimelineEditorStripModel(collisionDraft).rows,
  );
  assert.deepEqual(collisionSummary.collisionStepIds, ['step-1', 'step-4']);
  assert.equal(collisionSummary.rowCollisionCounts.motion, 2);
  assert.deepEqual(stripModel.ticks.slice(0, 4).map((tick) => `${tick.label}:${tick.leftPercent}:${tick.timeMs}`), [
    'b1:1.22:100',
    'b3:10.98:900',
    'b5:20.73:1700',
    'b7:30.49:2500',
  ]);
  const draggedBeatStep = updateSkillTimelineStepTimingFromStripDrag({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    leftPercent: 20.73,
    step: serializedDraft.steps[0]!,
  });
  assert.equal(draggedBeatStep.beat, 5);
  const draggedBeatPreview = createSkillTimelineStripDragTimingPreview({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    leftPercent: 20.73,
    step: serializedDraft.steps[0]!,
  });
  assert.equal(draggedBeatPreview.label, 'b5');
  assert.equal(draggedBeatPreview.leftPercent, 20.73);
  const draggedMsStep = updateSkillTimelineStepTimingFromStripDrag({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    leftPercent: 50,
    step: serializedDraft.steps[1]!,
  });
  assert.equal(draggedMsStep.atMs, 4100);
  const draggedMsPreview = createSkillTimelineStripDragTimingPreview({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    leftPercent: 50,
    step: serializedDraft.steps[1]!,
  });
  assert.equal(draggedMsPreview.label, '4100ms');
  const snappedMsPreview = createSkillTimelineStripDragTimingPreview({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    leftPercent: 50.4,
    step: serializedDraft.steps[1]!,
  });
  assert.equal(snappedMsPreview.label, '4100ms');
  assert.equal(snappedMsPreview.leftPercent, 50);
  const clampedMsStep = updateSkillTimelineStepTimingFromStripDrag({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    leftPercent: -10,
    step: serializedDraft.steps[1]!,
  });
  assert.equal(clampedMsStep.atMs, 0);
  const resizedExplicitDurationStep = updateSkillTimelineStepDurationFromStripResize({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    rightPercent: 20.73,
    step: serializedDraft.steps[0]!,
  });
  assert.equal(resizedExplicitDurationStep.durationMs, '1600');
  const resizedBeatStep = updateSkillTimelineStepDurationFromStripResize({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    rightPercent: 50,
    step: { ...serializedDraft.steps[3]!, holdBeats: '' },
  });
  assert.equal(resizedBeatStep.holdBeats, '6');
  const resizedBeatPreview = createSkillTimelineStripResizePreview({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    rightPercent: 50,
    step: { ...serializedDraft.steps[3]!, holdBeats: '' },
  });
  assert.equal(resizedBeatPreview.label, '6 beats');
  assert.equal(resizedBeatPreview.durationMs, 2400);
  assert.equal(resizedBeatPreview.rightPercent, 50);
  const resizedMsStep = updateSkillTimelineStepDurationFromStripResize({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    rightPercent: 50,
    step: serializedDraft.steps[1]!,
  });
  assert.equal(resizedMsStep.durationMs, '2300');
  const resizedMsPreview = createSkillTimelineStripResizePreview({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    rightPercent: 50,
    step: serializedDraft.steps[1]!,
  });
  assert.equal(resizedMsPreview.label, '2300ms');
  assert.equal(resolveSkillTimelineStripDropTrackId([
    { bottom: 40, id: 'motion', top: 10 },
    { bottom: 80, id: 'expression', top: 50 },
  ], 60), 'expression');
  assert.equal(resolveSkillTimelineStripDropTrackId([
    { bottom: 40, id: 'motion', top: 10 },
  ], 45), '');
  assert.equal(updateSkillTimelineStepTrackFromStripDrop(draft.steps[0]!, 'expression').track, 'expression');
  assert.equal(updateSkillTimelineStepTrackFromStripDrop(draft.steps[0]!, '   ').track, 'motion');
  const assignedCustomTrackDraft = assignSelectedSkillTimelineStepTrack(draft, 'step-1', ' Face FX! ');
  assert.equal(assignedCustomTrackDraft.steps[0]?.track, 'facefx');
  const customTrackOptions = createSkillTimelineTrackOptions(assignedCustomTrackDraft);
  assert.equal(customTrackOptions.some((track) => track.id === 'facefx'), true);
  const appendedCustomTrackDraft = appendSkillTimelineEditorStepOnTrack(assignedCustomTrackDraft, 'stage-left!');
  assert.equal(appendedCustomTrackDraft.steps.at(-1)?.track, 'stage-left');
  const batchTrackDraft = assignSkillTimelineStepsTrack(serializedDraft, ['step-1', 'step-2'], 'Group Lane!');
  assert.deepEqual(batchTrackDraft.steps.slice(0, 2).map((step) => step.track), ['grouplane', 'grouplane']);
  assert.equal(batchTrackDraft.steps[2]?.track, 'expression');
  const batchNudgedDraft = nudgeSkillTimelineStepsTiming(serializedDraft, ['step-1', 'step-2'], 1);
  assert.equal(batchNudgedDraft.steps[0]?.beat, 2);
  assert.equal(batchNudgedDraft.steps[1]?.atMs, 1900);
  assert.equal(batchNudgedDraft.steps[2]?.beat, 7);
  const batchDraggedDraft = updateSkillTimelineStepsTimingFromStripBatchDrag({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    leftPercent: 20.73,
    primaryStepId: 'step-1',
    selectedStepIds: ['step-1', 'step-2'],
  });
  assert.equal(batchDraggedDraft.steps[0]?.beat, 5);
  assert.equal(batchDraggedDraft.steps[1]?.atMs, 3400);
  assert.equal(batchDraggedDraft.steps[2]?.beat, 7);
  const batchDragPreviews = createSkillTimelineStripBatchDragPreviews({
    draft: serializedDraft,
    durationMs: stripModel.durationMs,
    leftPercent: 20.73,
    primaryStepId: 'step-1',
    selectedStepIds: ['step-1', 'step-2'],
  });
  assert.deepEqual(batchDragPreviews.map((preview) => `${preview.stepId}:${preview.label}:${preview.leftPercent}`), [
    'step-2:3400ms:41.46',
  ]);
  const batchDuplicatedDraft = duplicateSkillTimelineEditorSteps(serializedDraft, ['step-1', 'step-3']);
  assert.deepEqual(batchDuplicatedDraft.steps.map((step) => step.id), [
    'step-1',
    'step-5',
    'step-2',
    'step-3',
    'step-6',
    'step-4',
  ]);
  assert.deepEqual(batchDuplicatedDraft.steps.map((step) => step.label).slice(0, 2), ['Intro', 'Intro copy']);

  const preview = createSkillTimelinePreview({
    config,
    inputJson: serialized,
    targetPetId: 'primary',
  });
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.animationIds, ['wave_hello', 'smile_bright', 'spin_dance', 'clap_cheer']);
  assert.deepEqual(preview.stepRows.map((step) => step.delayMs), [100, 1800, 2500, 1700]);
  assert.match(preview.audioLabel, /audio \/ C:\/music\/main-theme\.mp3 \/ offset 100ms \/ start 250ms/u);
}

assertToolFoundation();
assertSkillRegistry();
assertMcpRegistry();
assertInputSchema();
assertPermissionRoutes();
assertCharacterAnimationSkillRuntime();
await assertAudioAssetImportPolish();
assertSkillTimelinePreviewPanelModel();
assertSkillTimelineEditorModel();
await assertCharacterAnimationSkillRouting();

console.log('agent skill/mcp foundation smoke passed');
