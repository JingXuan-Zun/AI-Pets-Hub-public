import assert from 'node:assert/strict';
import { type PetModelMotionBinding } from '../src/types';
import {
  buildCharacterAnimationToolInstruction,
  extractCharacterAnimationToolIds,
  normalizeCharacterAnimationLookupKey,
  resolveCharacterAnimationBinding,
  resolveCharacterAnimationBindingQueue,
  resolveCharacterAnimationToolOptions,
  resolveDirectCharacterAnimationTriggerIds,
  resolveDirectCharacterAnimationTriggerMatches,
} from '../src/components/chat/characterAnimationToolProtocol';
import {
  extractCharacterToolInvocations,
  stripCharacterToolMarkers,
} from '../src/components/chat/characterToolProtocol';
import {
  createCharacterAnimationSemanticResolverInput,
  parseCharacterAnimationSemanticDecision,
  resolveSemanticCharacterAnimationTriggerDecision,
  shouldUseSemanticCharacterAnimationResolver,
} from '../src/components/chat/characterAnimationSemanticResolver';
import {
  createCharacterAnimationSemanticIndex,
  rankCharacterAnimationSemanticIndexEntries,
} from '../src/components/chat/characterAnimationSemanticIndex';
import {
  mergeIncomingAnimationBindingsIntoQueue,
} from '../src/components/pet/animationBindingQueue';
import {
  resolveAnimationBindingPlaybackDurationMs,
  shouldResetAnimationPlaybackOnTypingStart,
} from '../src/components/pet/animationBindingPlaybackDuration';
import {
  resolveAvatar3DMotionState,
} from '../src/pet-runtime/avatar3d/avatar3dMotionStateController';
import {
  registerAvatar3DMotionClipDurationEntries,
  resolveAvatar3DMotionClipDurationMs,
} from '../src/pet-runtime/avatar3d/avatar3dMotionClipDurationStore';
import {
  resolvePetActionStateMachineSnapshot,
} from '../src/pet-runtime/core/petActionStateMachine';

const bindings: PetModelMotionBinding[] = [
  {
    clipNames: ['Peace Sign Clip'],
    format: 'vrma',
    id: 'binding-peace',
    motionKey: 'happy',
    name: 'Peace Sign',
    sourceUrl: 'C:\\motions\\emotes\\peace_sign.vrma',
  },
  {
    clipNames: ['sad clip'],
    format: 'fbx',
    id: 'binding-sad',
    motionKey: 'sad',
    name: 'sad-pose',
    sourceUrl: '/motions/sad_pose.fbx?cache=1',
  },
  {
    clipNames: ['wave clip'],
    format: 'glb',
    id: 'binding-wave',
    motionKey: 'idle',
    name: '挥手',
    sourceUrl: '/motions/wave.glb',
  },
  {
    clipNames: ['Take 001'],
    format: 'vrma',
    id: 'binding-greeting-folder',
    motionKey: 'idle',
    name: 'take001',
    sourceUrl: 'C:\\motions\\打招呼\\take001.vrma',
  },
  {
    clipNames: ['animation'],
    format: 'vrma',
    id: 'binding-shy',
    motionKey: 'happy',
    name: 'shy_blush',
    sourceUrl: '/motions/expressions/shy_blush.vrma',
  },
  {
    clipNames: ['animation'],
    format: 'fbx',
    id: 'binding-angry',
    motionKey: 'sad',
    name: 'angry_stomp',
    sourceUrl: '/motions/angry_stomp.fbx',
  },
  {
    clipNames: ['Scratch Head'],
    format: 'vrma',
    id: 'binding-scratch-head',
    motionKey: 'idle',
    name: 'scratch_head',
    sourceUrl: '/motions/reactions/scratch_head.vrma',
  },
  {
    clipNames: ['害羞'],
    format: 'exp3',
    id: 'binding-live2d-shy-expression',
    kind: 'expression',
    motionKey: 'happy',
    name: '害羞',
    semanticAliases: ['脸红', '不好意思'],
    semanticDescription: 'Live2D expression for a shy blush reaction.',
    semanticTags: ['表情', '害羞'],
    sourceUrl: 'C:\\models\\live2d\\expressions\\害羞.exp3.json',
  },
  {
    clipNames: ['Akimbo'],
    format: 'vrma',
    id: 'binding-akimbo',
    motionKey: 'idle',
    name: 'akimbo',
    sourceUrl: '/motions/reactions/akimbo.vrma',
  },
  {
    clipNames: ['Squat'],
    format: 'vrma',
    id: 'binding-squat',
    motionKey: 'idle',
    name: 'squat',
    sourceUrl: '/motions/reactions/squat.vrma',
  },
  {
    clipNames: ['hover clip'],
    format: 'glb',
    id: 'binding-hover',
    motionKey: 'hover-head',
    name: '摸头',
    semanticAliases: ['摸脑袋', '拍拍头'],
    semanticDescription: 'A gentle head-touch interaction animation.',
    semanticTags: ['互动', '头部'],
    sourceUrl: '/motions/head.glb',
  },
];

assert.equal(normalizeCharacterAnimationLookupKey('peace-sign.vrma'), 'peacesign');
assert.equal(normalizeCharacterAnimationLookupKey('C:\\motions\\peace sign.vrma'), 'peacesign');

assert.deepEqual(extractCharacterAnimationToolIds('来了。【动画:peace_sign】【3D动画:挥手】'), [
  'peace_sign',
  '挥手',
]);

assert.deepEqual(extractCharacterAnimationToolIds('兼容写法。【动作动画:peace_sign】'), [
  'peace_sign',
]);

assert.deepEqual(
  extractCharacterToolInvocations('【动画:peace_sign】【动作:开心】【查询:天气】').map((invocation) => invocation.kind),
  ['animation', 'action', 'web-search'],
);

assert.deepEqual(
  extractCharacterToolInvocations('【表情:害羞】').map((invocation) => invocation.kind),
  ['animation'],
);

assert.deepEqual(
  extractCharacterToolInvocations('【Live2D表情:害羞】').map((invocation) => invocation.kind),
  ['animation'],
);

assert.equal(stripCharacterToolMarkers('害羞一点。【表情:害羞】'), '害羞一点。');
assert.equal(stripCharacterToolMarkers('害羞一点。【Live2D表情:害羞】'), '害羞一点。');

assert.equal(stripCharacterToolMarkers('先这样。【动画:peace_sign】好了。'), '先这样。好了。');

const options = resolveCharacterAnimationToolOptions(bindings);
assert.deepEqual(options.map((option) => option.id), [
  'peace_sign',
  'sad_pose',
  '挥手',
  'take001',
  'shy_blush',
  'angry_stomp',
  'scratch_head',
  '害羞',
  'akimbo',
  'squat',
  '摸头',
]);

const semanticIndex = createCharacterAnimationSemanticIndex(bindings);
assert.equal(semanticIndex.entries.find((entry) => entry.id === '挥手')?.sourceQuality, 'strong');
assert.equal(semanticIndex.entries.find((entry) => entry.id === 'take001')?.sourceQuality, 'context');
assert.equal(
  rankCharacterAnimationSemanticIndexEntries(semanticIndex.entries, '跟我打个招呼')[0]?.entry.id,
  '挥手',
);
assert.deepEqual(semanticIndex.entries.find((entry) => entry.id === '摸头')?.metadataTerms.slice(0, 4), [
  '摸脑袋',
  '拍拍头',
  '互动',
  '头部',
]);

assert.equal(resolveCharacterAnimationBinding('peace sign', bindings)?.id, 'binding-peace');
assert.equal(resolveCharacterAnimationBinding('peace-sign', bindings)?.id, 'binding-peace');
assert.equal(resolveCharacterAnimationBinding('peace_sign.vrma', bindings)?.id, 'binding-peace');
assert.equal(resolveCharacterAnimationBinding('害羞.exp3.json', bindings)?.id, 'binding-live2d-shy-expression');
assert.equal(resolveCharacterAnimationBinding('脸红', bindings)?.id, 'binding-live2d-shy-expression');
assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('脸红一下', bindings), [
  '害羞',
]);
assert.equal(resolveCharacterAnimationBinding('sad_pose', bindings)?.id, 'binding-sad');
assert.equal(resolveCharacterAnimationBinding('wave', bindings)?.id, 'binding-wave');
assert.equal(resolveCharacterAnimationBinding('摸头', bindings)?.id, 'binding-hover');

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('请做一下挥手动作', bindings), [
  '挥手',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('please play peace sign now', bindings), [
  'peace_sign',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('做一个比耶动作', bindings), [
  'peace_sign',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('害羞一下', bindings), [
  '害羞',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('please play shy_blush', bindings), [
  'shy_blush',
  '害羞',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('来一个生气动作', bindings), [
  'angry_stomp',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('最后一次挠头给我看看', bindings), [
  'scratch_head',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('摆一个双手叉腰的姿势', bindings), [
  'akimbo',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('然后蹲下', bindings), [
  'squat',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('播放打招呼', bindings), [
  'take001',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('跟我打个招呼', bindings), [
  '挥手',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('比个剪刀手', bindings), [
  'peace_sign',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('尴尬地抓一下后脑勺', bindings), [
  'scratch_head',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('先挥手，然后 peace_sign', bindings), [
  '挥手',
  'peace_sign',
]);

assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('你现在看起来有点 sad', bindings), []);
assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('切到 happy 状态', bindings), []);
assert.deepEqual(resolveDirectCharacterAnimationTriggerIds('播放 hover clip', bindings), [
  '摸头',
]);
assert.deepEqual(
  resolveDirectCharacterAnimationTriggerMatches('请做一个 peace-sign', bindings).map((match) => match.matchedAlias),
  ['peace_sign'],
);
assert.deepEqual(
  resolveDirectCharacterAnimationTriggerMatches('播放打招呼', bindings).map((match) => match.matchKind),
  ['path'],
);
assert.deepEqual(
  resolveDirectCharacterAnimationTriggerMatches('跟我打个招呼', bindings).map((match) => match.matchKind),
  ['semantic'],
);

assert.deepEqual(
  resolveCharacterAnimationBindingQueue('', bindings, ['peace_sign', 'peace-sign', 'sad_pose', 'wave']).map((binding) => binding.id),
  ['binding-peace', 'binding-sad', 'binding-wave'],
);

const peaceBinding = bindings[0]!;
const sadBinding = bindings[1]!;
const waveBinding = bindings[2]!;
const longMotionBinding = {
  ...peaceBinding,
  durationMs: 8200,
} satisfies PetModelMotionBinding;

assert.deepEqual(
  mergeIncomingAnimationBindingsIntoQueue(peaceBinding, [], [peaceBinding]).map((binding) => binding.id),
  [],
  'same active animation should not be requeued while it is still playing',
);

assert.deepEqual(
  mergeIncomingAnimationBindingsIntoQueue(peaceBinding, [sadBinding], [peaceBinding, sadBinding]).map((binding) => binding.id),
  ['binding-sad'],
  'same remaining animation sequence should be ignored instead of restarted',
);

assert.deepEqual(
  mergeIncomingAnimationBindingsIntoQueue(peaceBinding, [sadBinding], [peaceBinding, sadBinding, waveBinding]).map((binding) => binding.id),
  ['binding-sad', 'binding-wave'],
  'new suffix animations should be appended after the current sequence',
);

assert.deepEqual(
  mergeIncomingAnimationBindingsIntoQueue(peaceBinding, [sadBinding], [sadBinding, waveBinding]).map((binding) => binding.id),
  ['binding-sad', 'binding-wave'],
  'already queued first animation should not be duplicated when appending follow-up motion',
);

assert.deepEqual(
  mergeIncomingAnimationBindingsIntoQueue(
    peaceBinding,
    [],
    [peaceBinding, peaceBinding],
    { preserveRepeats: true },
  ).map((binding) => binding.id),
  ['binding-peace', 'binding-peace'],
  'scheduled choreography should preserve repeated same-motion steps',
);

assert.equal(
  resolveAnimationBindingPlaybackDurationMs(longMotionBinding, 1),
  8450,
  'known clip duration should drive playback instead of the fixed default timeout',
);

assert.equal(
  resolveAnimationBindingPlaybackDurationMs(longMotionBinding, 3),
  8450,
  'multi animation queues must not shrink a known clip duration',
);

assert.equal(
  resolveAnimationBindingPlaybackDurationMs({ ...peaceBinding, durationMs: -1 }, 1),
  4200,
  'invalid duration metadata should keep the legacy fallback behavior',
);

registerAvatar3DMotionClipDurationEntries([
  {
    durationMs: 11200,
    name: 'scratch_head',
  },
]);

const runtimeScratchHeadDurationMs = resolveAvatar3DMotionClipDurationMs(['scratch_head']);
assert.equal(runtimeScratchHeadDurationMs, 11200);
assert.equal(
  resolveAnimationBindingPlaybackDurationMs(
    { ...peaceBinding, durationMs: undefined, name: 'scratch_head' },
    1,
    4200,
    runtimeScratchHeadDurationMs,
  ),
  11450,
  'runtime clip duration should extend old bindings that do not have saved duration metadata',
);

assert.equal(
  shouldResetAnimationPlaybackOnTypingStart(peaceBinding, 0),
  false,
  'typing start must not interrupt an animation that was just triggered by the action agent',
);

assert.equal(
  shouldResetAnimationPlaybackOnTypingStart(null, 1),
  false,
  'typing start must keep an already queued animation sequence',
);

assert.equal(
  shouldResetAnimationPlaybackOnTypingStart(null, 0),
  true,
  'typing start can still clear stale playback state when nothing is playing',
);

const promptInstruction = buildCharacterAnimationToolInstruction(bindings);
assert.match(promptInstruction, /【动画:id】/u);
assert.match(promptInstruction, /peace_sign/u);
assert.match(promptInstruction, /比耶/u);
assert.match(promptInstruction, /害羞/u);
assert.match(promptInstruction, /摸头/u);

assert.deepEqual(
  parseCharacterAnimationSemanticDecision('```json\n{"animationIds":["scratch_head"],"confidence":0.91,"reason":"user asks for a head scratch"}\n```'),
  {
    animationIds: ['scratch_head'],
    confidence: 0.91,
    reason: 'user asks for a head scratch',
  },
);

const semanticResolverInput = createCharacterAnimationSemanticResolverInput({
  bindings,
  userInput: '装作有点尴尬地抓一下后脑勺',
});
assert.match(semanticResolverInput, /scratch_head/u);
assert.match(semanticResolverInput, /Candidate focus from local semantic index/u);
assert.match(semanticResolverInput, /Full action semantic index/u);
assert.match(semanticResolverInput, /quality=strong/u);
assert.equal(shouldUseSemanticCharacterAnimationResolver('跟我打个招呼', bindings), true);
assert.equal(shouldUseSemanticCharacterAnimationResolver('比个剪刀手', bindings), true);
assert.equal(shouldUseSemanticCharacterAnimationResolver('摆个爱心', bindings), true);
assert.equal(shouldUseSemanticCharacterAnimationResolver('在空中晃晃手回应你', bindings), true);

const hoverMotionState = resolveAvatar3DMotionState({
  contentManifest: null,
  manualMotionSelection: {
    candidateClipNames: ['hover clip'],
    motionKey: 'hover-head',
    playbackMode: 'native',
  },
  snapshot: resolvePetActionStateMachineSnapshot({ action: 'IDLE' }),
  visualMode: 'idle',
});
assert.equal(hoverMotionState.motionKey, 'hover-head');
assert.equal(hoverMotionState.clipPlaybackMode, 'native');
assert.deepEqual(hoverMotionState.candidateClipNames.slice(0, 1), ['hover clip']);

const semanticDecision = await resolveSemanticCharacterAnimationTriggerDecision({
  bindings,
  modelCaller: async ({ systemInstruction, userInput }) => {
    assert.match(systemInstruction, /semantic animation selector/u);
    assert.match(userInput, /装作有点尴尬地抓一下后脑勺/u);
    assert.match(userInput, /scratch_head/u);
    return JSON.stringify({
      animationIds: ['scratch_head'],
      confidence: 0.88,
      reason: 'The user described an embarrassed head-scratch motion.',
    });
  },
  settings: {} as import('../src/types').PetConfig['settings'],
  userInput: '装作有点尴尬地抓一下后脑勺',
});
assert.deepEqual(semanticDecision.animationIds, ['scratch_head']);
assert.equal(semanticDecision.confidence, 0.88);
assert.equal(semanticDecision.diagnostics?.fullIndexCount, bindings.length);
assert.equal(Array.isArray(semanticDecision.diagnostics?.candidateFocus), true);

let freeformSemanticResolverCalled = false;
const freeformSemanticDecision = await resolveSemanticCharacterAnimationTriggerDecision({
  bindings,
  modelCaller: async ({ userInput }) => {
    freeformSemanticResolverCalled = true;
    assert.match(userInput, /在空中晃晃手回应你/u);
    assert.match(userInput, /Local animation intent hint: uncertain/u);
    return JSON.stringify({
      animationIds: ['挥手'],
      confidence: 0.84,
      reason: 'The user describes waving a hand without using a fixed trigger phrase.',
    });
  },
  settings: {} as import('../src/types').PetConfig['settings'],
  userInput: '在空中晃晃手回应你',
});
assert.equal(freeformSemanticResolverCalled, true);
assert.deepEqual(freeformSemanticDecision.animationIds, ['挥手']);
assert.equal(freeformSemanticDecision.diagnostics?.localIntentHint, 'uncertain');

const lowConfidenceSemanticDecision = await resolveSemanticCharacterAnimationTriggerDecision({
  bindings,
  modelCaller: async () => JSON.stringify({
    animationIds: ['squat'],
    confidence: 0.2,
    reason: 'weak guess',
  }),
  settings: {} as import('../src/types').PetConfig['settings'],
  userInput: '随便动一下',
});
assert.deepEqual(lowConfidenceSemanticDecision.animationIds, []);

console.log('character animation tool smoke ok');
