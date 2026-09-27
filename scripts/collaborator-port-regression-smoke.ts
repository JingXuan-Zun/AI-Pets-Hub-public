import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readProjectSources } from './smokeTestHarness.ts';

const sources = readProjectSources({
  parallel: 'src/agent/runtime/agentParallelToolTransactionExecutor.ts',
  task: 'src/agent/runtime/agentTaskRuntime.ts',
  transaction: 'src/agent/runtime/agentToolTransactionExecutor.ts',
  verification: 'src/agent/runtime/agentVerificationOutcomeRuntime.ts',
  chatStore: 'src/chatStore.ts',
  agentRun: 'src/components/chat/agentRunController.ts',
  stopPolicy: 'src/components/chat/agentRunStopPolicy.ts',
  draft: 'src/components/chat/usePetChatConversationDraft.ts',
  response: 'src/components/chat/usePetChatResponseTurn.ts',
  controls: 'src/components/chat/usePetChatSessionControls.ts',
  voice: 'src/components/chat/queuedReplyVoiceSegmentQueueState.ts',
});

assert.match(sources.parallel, /coveringResultFailed[\s\S]*receipt\?\.status === 'failed'[\s\S]*errorText/u);
assert.match(sources.transaction, /let result: AgentChatCommandResult;[\s\S]*try \{[\s\S]*executeCommand[\s\S]*catch \(error\)/u);
assert.match(sources.task, /requestedLimit > 0[\s\S]*persistedLimit > 0/u);
assert.match(sources.verification, /recoveryDecision\.action === 'failed-action'[\s\S]*kind: 'stop-needs-user'/u);
assert.match(sources.chatStore, /latestModelIndex[\s\S]*latestModelIndex === targetIndex/u);
assert.match(sources.agentRun, /status: 'blocked',[\s\S]*stoppedByUser: true/u);
assert.match(sources.stopPolicy, /stoppedByUser === true/u);
assert.match(sources.draft, /CHAT_DRAFT_DUPLICATE_SEND_GUARD_MS[\s\S]*lastSendAtRef/u);
assert.match(sources.response, /currentMessage\.text === lastSyncedText[\s\S]*updateMessageText/u);
assert.match(sources.controls, /const hasActiveStream = currentState\.isTyping/u);
assert.match(sources.voice, /if \([\s\S]*isVoiceCancellationError[\s\S]*\) \{[\s\S]*\} else \{/u);

const electronRoot = path.resolve(process.cwd(), 'electron');
const readElectron = (name: string) => fs.readFileSync(path.join(electronRoot, name), 'utf8');
const voiceRuntime = readElectron('localVoiceRuntime.cjs');
const mcpSession = readElectron('mcpStdioSession.cjs');
const mcpPool = readElectron('mcpStdioSessionPool.cjs');
assert.match(voiceRuntime, /stt-input-\$\{requestId\}\.wav/u);
assert.match(mcpSession, /execFileSync\('taskkill',[\s\S]*\['\/pid',[\s\S]*'\/T',[\s\S]*'\/F'/u);
assert.match(mcpPool, /const result = await sendRpc\([\s\S]*restartPolicy\.recordSuccess\(server\.id\)/u);
assert.match(mcpPool, /entries\.get\(server\.id\) === entry/u);

console.log('collaborator portable regression seams smoke ok');
