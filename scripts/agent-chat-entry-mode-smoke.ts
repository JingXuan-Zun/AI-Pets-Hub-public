import assert from 'node:assert/strict';
import { resolveAgentProductionSessionInstruction } from '../src/agent/index.ts';
import { resolveAgentSessionV2Instruction } from '../src/agent/legacy/index.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  chatStateSource,
  desktopShellStoreSource,
  desktopShellActionBridgeSource,
  conversationSource,
  composerSource,
  draftSource,
  senderSource,
} = readProjectSources({
  chatStateSource: 'src/chatState.ts',
  desktopShellStoreSource: 'src/desktopShellStore.ts',
  desktopShellActionBridgeSource: 'src/hooks/useDesktopShellActionBridge.ts',
  conversationSource: 'src/components/chat/PetChatConversation.tsx',
  composerSource: 'src/components/chat/PetChatConversationComposer.tsx',
  draftSource: 'src/components/chat/usePetChatConversationDraft.ts',
  senderSource: 'src/components/chat/petChatMessageSendExecution.ts',
});

assert.equal(
  resolveAgentSessionV2Instruction('normal chat'),
  null,
  'normal chat should not be forced into Agent unless the entry sets agentMode',
);
assert.equal(
  resolveAgentSessionV2Instruction('/agent open browser'),
  'open browser',
  'legacy slash Agent prefix should remain available',
);
assert.equal(
  resolveAgentSessionV2Instruction('/agent open browser'),
  resolveAgentProductionSessionInstruction('/agent open browser'),
  'Legacy SessionV2 instruction parsing should delegate to the production resolver.',
);

assert.match(
  chatStateSource,
  /agentMode\?: boolean;/u,
  'chat send options should carry agentMode',
);

assert.match(
  desktopShellStoreSource,
  /agentMode: options\?\.agentMode/u,
  'desktop shell store should forward agentMode actions',
);

assert.match(
  desktopShellActionBridgeSource,
  /agentMode: action\.agentMode/u,
  'desktop shell action bridge should pass agentMode into the chat controller',
);

assert.match(
  draftSource,
  /const \[agentMode, setAgentMode\] = useState\(false\);/u,
  'chat draft state should track Agent mode',
);
assert.match(
  draftSource,
  /const nextAgentMode = options\?\.agentMode \?\? agentMode;/u,
  'sending from the draft should use explicit or active Agent mode',
);
assert.match(
  draftSource,
  /agentMode: nextAgentMode \|\| undefined/u,
  'chat draft should pass agentMode into onSendMessage',
);

assert.match(
  conversationSource,
  /\bagentMode,\s+browserSearchMode,/u,
  'conversation should read agentMode from the draft hook',
);
assert.match(
  conversationSource,
  /\bsetAgentMode,\s+setBrowserSearchMode,/u,
  'conversation should read setAgentMode from the draft hook',
);
assert.match(
  conversationSource,
  /agentMode=\{agentMode\}/u,
  'conversation should pass agentMode to the composer',
);
assert.match(
  conversationSource,
  /setAgentMode=\{setAgentMode\}/u,
  'conversation should pass setAgentMode to the composer',
);

assert.match(
  composerSource,
  /import \{[^}]*\bBot\b[^}]*\} from 'lucide-react';/u,
  'composer should expose an Agent icon in the slash menu',
);
assert.match(
  composerSource,
  /\{ label: 'Agent', mode: 'agent' as const/u,
  'slash menu should include Agent as a selectable mode',
);
assert.match(
  composerSource,
  /const checked = item\.mode === 'agent'\s+\? agentMode\s+: browserSearchMode === item\.mode;/u,
  'slash menu should evaluate Agent mode separately from browser search modes',
);
assert.match(
  composerSource,
  /setAgentMode\(!checked\);/u,
  'clicking the Agent switch should toggle agentMode',
);
assert.match(
  composerSource,
  /agentMode: agentMode \|\| undefined/u,
  'send button should preserve Agent mode when sending normal text',
);

assert.match(
  senderSource,
  /input\.options\?\.agentMode[\s\S]*resolveAgentProductionSessionInstruction\(input\.outgoingText\)/u,
  'message sender should route normal text into the Production Session when agentMode is enabled',
);

console.log('agent chat entry mode smoke ok');
