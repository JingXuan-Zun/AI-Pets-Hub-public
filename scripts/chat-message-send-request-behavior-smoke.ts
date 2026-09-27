import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_DESKTOP_PET_CHAT_STATE } from '../src/chatState';
import { desktopPetChatStore } from '../src/chatStore';
import { runPreparedChatSendRequest } from '../src/components/chat/chatMessageSendRequestExecution';
import type {
  PreparedChatSendRequest,
  RunPreparedChatSendRequestOptions,
} from '../src/components/chat/chatMessageSendFlowTypes';
import { ActiveGroupRuntimeRef } from '../src/components/chat/group/runtime/activeGroupRuntimeRef';
import type { GroupChatRuntime } from '../src/components/chat/group/runtime/groupChatRuntime';
import { EMPTY_GROUP_MEMORY_REPOSITORY } from '../src/group-memory/groupMemoryTypes';
import { EMPTY_GROUP_TOPIC_REPOSITORY } from '../src/group-topic/groupTopicRepository';
import { EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY } from '../src/character-relationship';
import type { ChatMessage, PetConfig } from '../src/types';

type TurnOptions = Parameters<RunPreparedChatSendRequestOptions['runPetResponseTurn']>[1];
type ContinuationMode = PreparedChatSendRequest['currentChatState']['groupChatContinuationMode'];

const senderExecutionSource = readFileSync(
  new URL('../src/components/chat/petChatMessageSendExecution.ts', import.meta.url),
  'utf8',
);

assert.match(senderExecutionSource, /`继续：\$\{followUpAction\.label\}`/u);
assert.doesNotMatch(senderExecutionSource, /缁х画|锛\?/u);

const targetSlot: PreparedChatSendRequest['targetSlots'][number] = {
  id: 'primary', slotNumber: 1, label: 'Test Pet', isPrimary: true, enabled: true,
  modelVisible: true, modelUrl: '', modelType: '2d', scale: 1,
  personality: {
    name: 'Alice', greeting: '', systemInstruction: '', traits: [], userMemory: '',
    beginDialogs: [], chatAvatarUrl: '', chatHistoryMemory: '', customErrorMessage: '',
    knowledgeBase: '', webLearningEnabled: false, webSearchEnabled: false,
  },
  stats: { affection: 50, fatigue: 0, hunger: 50 },
  position: { x: 0, y: 0 }, currentAction: 'IDLE', autoMovementEnabled: true,
  pointerLookEnabled: true,
};

function createConfig(): PetConfig {
  return {
    directedRelationshipRepository: EMPTY_DIRECTED_RELATIONSHIP_REPOSITORY,
    settings: { chatUserDisplayName: 'TestUser' } as PetConfig['settings'],
    groupMemoryRepository: { ...EMPTY_GROUP_MEMORY_REPOSITORY },
    groupTopicRepository: { ...EMPTY_GROUP_TOPIC_REPOSITORY, snapshots: [] },
  } as PetConfig;
}

function createUserMessage(isGroupMode: boolean): ChatMessage {
  return {
    id: `user-${isGroupMode ? 'group' : 'single'}`, role: 'user', text: 'Start',
    chatMode: isGroupMode ? 'group' : 'single', petId: isGroupMode ? null : 'primary',
    petName: isGroupMode ? 'Group' : 'Alice', createdAt: Date.now(),
  };
}

function createPreparedRequest(
  config: PetConfig,
  isGroupMode: boolean,
  mode: ContinuationMode = 'single-round',
): PreparedChatSendRequest {
  const userMessage = createUserMessage(isGroupMode);
  return {
    currentConfig: config,
    currentChatState: {
      ...DEFAULT_DESKTOP_PET_CHAT_STATE,
      chatMode: isGroupMode ? 'group' : 'single',
      groupChatContinuationMode: mode,
      messages: [userMessage],
    },
    isGroupMode,
    outgoingText: userMessage.text,
    playbackToken: 1,
    promptHistoryMessages: [],
    requestToken: 1,
    targetSlots: [targetSlot],
    userMessage,
  };
}

function addModelMessage(text: string, sequence: number) {
  desktopPetChatStore.addMessage({
    id: `model-${sequence}`, role: 'model', text, chatMode: 'group',
    petId: 'primary', petName: 'Alice', createdAt: Date.now() + sequence,
  });
}

function createHarness(
  isGroupMode: boolean,
  mode: ContinuationMode = 'single-round',
  response?: (turn: number, options: TurnOptions) => { cancelled: boolean; text?: string },
) {
  desktopPetChatStore.reset();
  const configRef = { current: createConfig() };
  const preparedRequest = createPreparedRequest(configRef.current, isGroupMode, mode);
  desktopPetChatStore.replaceMessages([preparedRequest.userMessage]);
  const activeChatRequestTokenRef = { current: 1 };
  const activeGroupRuntimeRef = new ActiveGroupRuntimeRef();
  const turnOptions: TurnOptions[] = [];
  let configUpdateCount = 0;
  let warmCount = 0;
  const runPetResponseTurn: RunPreparedChatSendRequestOptions['runPetResponseTurn'] = async (_slot, options) => {
    turnOptions.push(options);
    const result = response?.(turnOptions.length, options) ?? { cancelled: false };
    if (isGroupMode && !result.cancelled) addModelMessage(result.text ?? `Reply ${turnOptions.length}`, turnOptions.length);
    return { cancelled: result.cancelled, finalResponse: result.text ?? '' };
  };
  const run = () => runPreparedChatSendRequest({
    activeChatRequestTokenRef, activeGroupRuntimeRef, configRef,
    groupChatContinuationEnabledRef: { current: mode === 'infinite' },
    onUpdateConfig: (config) => { configRef.current = config; configUpdateCount += 1; },
    preparedRequest, runPetResponseTurn, warmLocalReplyVoice: () => { warmCount += 1; },
  });
  return {
    activeChatRequestTokenRef, activeGroupRuntimeRef, configRef,
    get configUpdateCount() { return configUpdateCount; },
    get warmCount() { return warmCount; },
    run, turnOptions,
  };
}

async function testSingleChat() {
  const harness = createHarness(false);
  await harness.run();
  assert.equal(harness.turnOptions.length, 1);
  assert.equal(harness.turnOptions[0]?.shouldAutoSpeakReply, true);
  assert.equal(harness.warmCount, 1);
  assert.equal(harness.activeGroupRuntimeRef.get(), null);
}

async function testSingleRoundGroupChat() {
  const harness = createHarness(true);
  await harness.run();
  assert.equal(harness.turnOptions.length, 1);
  assert.equal(harness.turnOptions[0]?.shouldAutoSpeakReply, false);
  assert.ok(harness.turnOptions[0]?.groupInteractionPlan);
  assert.ok(harness.configUpdateCount > 0);
  assert.equal(harness.configRef.current.groupTopicRepository.snapshots.length, 1);
  assert.equal(harness.activeGroupRuntimeRef.get(), null);
}

async function testInfiniteGroupChat() {
  const harness = createHarness(true, 'infinite', (turn) => {
    if (turn === 2) harness.activeChatRequestTokenRef.current = 2;
    return { cancelled: false };
  });
  await harness.run();
  assert.equal(harness.turnOptions.length, 2);
  assert.equal(harness.turnOptions[1]?.shouldAutoSpeakReply, false);
  assert.match(harness.turnOptions[1]?.promptText ?? '', /Reply 1/u);
  assert.equal(harness.activeGroupRuntimeRef.get(), null);
}

async function testCancelledGroupChat() {
  let cancelledRuntime: GroupChatRuntime | null = null;
  const harness = createHarness(true, 'single-round', () => {
    cancelledRuntime = harness.activeGroupRuntimeRef.get();
    return { cancelled: true };
  });
  await harness.run();
  assert.equal(harness.turnOptions.length, 1);
  assert.equal(cancelledRuntime?.controller.getSnapshot().status, 'cancelled');
  assert.equal(harness.activeGroupRuntimeRef.get(), null);
  assert.equal(desktopPetChatStore.getState().messages.length, 1);
}

async function testPausedForUser() {
  const harness = createHarness(true, 'infinite', () => ({
    cancelled: false, text: 'TestUser?',
  }));
  await harness.run();
  assert.equal(harness.turnOptions.length, 1);
  assert.ok(harness.activeGroupRuntimeRef.get());
  assert.equal(desktopPetChatStore.getState().groupUserAttention?.roleName, 'Alice');
  assert.equal(desktopPetChatStore.getState().isGroupChatRunning, false);
}

const originalWindow = globalThis.window;
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { setTimeout: (callback: () => void) => { callback(); return 0; } },
});
try {
  await testSingleChat();
  await testSingleRoundGroupChat();
  await testInfiniteGroupChat();
  await testCancelledGroupChat();
  await testPausedForUser();
} finally {
  desktopPetChatStore.reset();
  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
}

console.log('chat message send request behavior smoke ok');
