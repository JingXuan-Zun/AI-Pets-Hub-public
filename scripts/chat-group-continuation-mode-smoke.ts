import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_DESKTOP_PET_CHAT_STATE,
  type DesktopPetChatState,
  type DesktopPetGroupChatContinuationMode,
} from '../src/chatState';
import { desktopPetChatStore } from '../src/chatStore';
import { beginChatSendRequest } from '../src/components/chat/chatMessageSendUtils';
import type { ChatMessage } from '../src/types';
import { projectPath, readProjectFile } from './smokeTestHarness.ts';

type ChatSendTargetSlot = Parameters<typeof beginChatSendRequest>[0]['targetSlots'][number];

const targetSlot: ChatSendTargetSlot = {
  id: 'primary',
  slotNumber: 1,
  label: 'Test Pet',
  isPrimary: true,
  enabled: true,
  modelUrl: '',
  modelType: '2d',
  personality: {
    name: 'Test Pet',
    greeting: 'Hello',
    description: '',
    systemInstruction: '',
  },
  stats: {
    affection: 50,
    fatigue: 0,
    hunger: 50,
  },
  position: {
    x: 0,
    y: 0,
  },
  scale: 1,
  currentAction: 'idle',
  autoMovementEnabled: true,
};

function createGroupChatState(
  groupChatContinuationMode: DesktopPetGroupChatContinuationMode,
  overrides: Partial<DesktopPetChatState> = {},
): DesktopPetChatState {
  return {
    ...DEFAULT_DESKTOP_PET_CHAT_STATE,
    chatMode: 'group',
    groupChatContinuationMode,
    messages: [] as ChatMessage[],
    ...overrides,
  };
}

function startGroupRequest(groupChatContinuationMode: DesktopPetGroupChatContinuationMode) {
  const activeChatRequestTokenRef = { current: 0 };
  const groupChatContinuationEnabledRef = { current: false };

  beginChatSendRequest({
    activeChatRequestTokenRef,
    currentChatState: createGroupChatState(groupChatContinuationMode),
    groupChatContinuationEnabledRef,
    isGroupMode: true,
    groupChatContinuationMode,
    outgoingText: 'Discuss what to do today',
    resolvedActivePetId: 'primary',
    targetSlots: [targetSlot],
  });

  return {
    groupChatContinuationEnabled: groupChatContinuationEnabledRef.current,
    isGroupChatRunning: desktopPetChatStore.getState().isGroupChatRunning,
  };
}

desktopPetChatStore.reset();
const singleRoundGroupChat = startGroupRequest('single-round');
assert.equal(
  singleRoundGroupChat.groupChatContinuationEnabled,
  false,
  'single-round group chat should not enable ongoing continuation',
);
assert.equal(
  singleRoundGroupChat.isGroupChatRunning,
  false,
  'single-round group chat should not show as running after the initial round starts',
);

desktopPetChatStore.reset();
const infiniteGroupChat = startGroupRequest('infinite');
assert.equal(
  infiniteGroupChat.groupChatContinuationEnabled,
  true,
  'infinite group chat should enable ongoing continuation',
);
assert.equal(
  infiniteGroupChat.isGroupChatRunning,
  true,
  'infinite group chat should show as running after it starts',
);

desktopPetChatStore.reset();
assert.equal(
  desktopPetChatStore.getState().groupChatContinuationMode,
  'single-round',
  'group chat should default to single-round mode',
);

const headerSource = readProjectFile('src/components/chat/PetChatConversationHeader.tsx');
const collapsedHeaderBranch = headerSource.match(/if \(isTargetSelectorCollapsed\) \{[\s\S]*?\n  \}/)?.[0] ?? '';

assert.match(
  headerSource,
  /私聊[\s\S]*群聊/,
  'left chat target rail should label single chat mode as private chat',
);
assert.doesNotMatch(
  headerSource,
  />单聊</,
  'left chat target rail should not show the old single chat label',
);
assert.match(
  headerSource,
  /resolveChatPetAvatarUrl\(config, petId\)[\s\S]*<img alt="" src=\{avatarUrl\}/,
  'left chat target rail should render pet avatars from chat avatar config',
);
assert.match(
  headerSource,
  /resolveTargetAvatarFallback\(name\)/,
  'left chat target rail should provide a fallback avatar when no image is configured',
);
assert.match(
  headerSource,
  /chatMode === 'group'[\s\S]*一轮群聊[\s\S]*无限群聊[\s\S]*停止/,
  'group chat continuation controls should be merged into the left chat target rail while group mode is active',
);
assert.match(
  headerSource,
  /onGroupChatContinuationModeChange\('single-round'\)/,
  'left chat target rail should provide a single-round group chat button',
);
assert.match(
  headerSource,
  /onGroupChatContinuationModeChange\('infinite'\)/,
  'left chat target rail should provide an infinite group chat button',
);
assert.match(
  collapsedHeaderBranch,
  /isTargetSelectorCollapsed[\s\S]*absolute left-0 top-3/,
  'collapsed left chat target rail should be pinned to the left edge without taking layout width',
);
assert.doesNotMatch(
  collapsedHeaderBranch,
  /w-\[72px\]|w-14|shrink-0|bg-white|backdrop-blur|rounded-br/u,
  'collapsed left chat target rail should not reserve a wide blank column',
);

const composerSource = readProjectFile('src/components/chat/PetChatConversationComposer.tsx');
assert.doesNotMatch(
  composerSource,
  /一轮群聊|无限群聊|onGroupChatContinuationModeChange|onStopGroupChat/,
  'group chat continuation controls should no longer be duplicated above the chat composer',
);

const messageUtilsSource = readProjectFile('src/components/chat/petChatConversationMessageUtils.ts');
assert.doesNotMatch(
  messageUtilsSource,
  /\u7ee7\u7eed\u804a\u4e0b\u53bb/u,
  'empty group chat state should not imply that group chat always continues forever',
);
assert.match(
  messageUtilsSource,
  /\u5de6\u4fa7\u680f\u5207\u5230\u65e0\u9650\u7fa4\u804a/u,
  'empty group chat state should point users to the left chat rail for infinite group chat',
);

function collectSourceFiles(directory: string): string[] {
  return readdirSync(projectPath(directory), { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return collectSourceFiles(entryPath);
    }

    return /\.(tsx?|jsx?)$/.test(entry.name) ? [entryPath] : [];
  });
}

const controlCenterSources = [
  'src/components/SettingsPanel.tsx',
  ...collectSourceFiles('src/components/settings'),
];
for (const sourcePath of controlCenterSources) {
  const source = readProjectFile(sourcePath);
  assert.doesNotMatch(
    source,
    /一轮群聊|无限群聊|groupChatContinuationMode/,
    `${sourcePath} should not contain group chat continuation controls`,
  );
}

console.log('chat group continuation mode smoke ok');
