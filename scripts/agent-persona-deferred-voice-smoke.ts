import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  agentSource,
  senderSource,
  sessionSource,
} = readProjectSources({
  agentSource: 'src/components/chat/agentRunController.ts',
  senderSource: 'src/components/chat/usePetChatMessageSender.ts',
  sessionSource: 'src/components/chat/usePetChatSession.ts',
});

function extractBetween(source: string, startNeedle: string, endNeedle: string) {
  const start = source.indexOf(startNeedle);
  assert.ok(start >= 0, `${startNeedle} should exist`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.ok(end > start, `${endNeedle} should exist after ${startNeedle}`);
  return source.slice(start, end);
}

function countMatches(source: string, pattern: RegExp) {
  return Array.from(source.matchAll(pattern)).length;
}

assert.ok(
  agentSource.includes('type AgentPlayVoiceText = (text: string, options?: PlayVoiceTextOptions) => Promise<void>;'),
  'Agent result voice playback should use the existing direct voice playback function',
);
assert.ok(
  agentSource.includes('function playDeferredAgentPersonaVoice'),
  'Agent result voice playback should have a deferred voice helper',
);

const retryRunner = extractBetween(
  agentSource,
  'async function runAgentPersonaResponseTurnWithStyleRetry',
  '\n\nasync function speakAgentResult',
);
assert.equal(
  countMatches(retryRunner, /shouldAutoSpeakReply: false/gu),
  2,
  'initial Agent persona draft and rewrite draft should both disable streaming auto speech',
);
assert.match(retryRunner, /playDeferredAgentPersonaVoice\(/u);
assert.match(retryRunner, /moveAgentPersonaReplyIntoExistingMessage\(\{[\s\S]*finalResponse: firstResponse\.finalResponse/u);
assert.match(retryRunner, /moveAgentPersonaReplyIntoExistingMessage\(\{[\s\S]*finalResponse: retryResponse\.finalResponse/u);
assert.match(retryRunner, /text: replyText/u);
assert.match(retryRunner, /outputMessageId: compactReplyIntoMessageId/u);

const deferredVoiceHelper = extractBetween(
  agentSource,
  'function playDeferredAgentPersonaVoice',
  '\n\nasync function runAgentPersonaResponseTurnWithStyleRetry',
);
assert.match(deferredVoiceHelper, /void playVoiceText\(voiceText,/u);
assert.match(deferredVoiceHelper, /petId: targetSlot\.id/u);
assert.match(deferredVoiceHelper, /source: 'reply'/u);

assert.ok(senderSource.includes('playVoiceText: (text: string, options?: PlayVoiceTextOptions) => Promise<void>;'));
assert.match(senderSource, /runPreparedAgentProductionSession\(\{[\s\S]*playVoiceText,[\s\S]*preparedRequest,/u);
assert.match(senderSource, /resolveAgentApprovalRequest\(\{[\s\S]*playVoiceText,[\s\S]*runPetResponseTurn,/u);
assert.match(sessionSource, /usePetChatMessageSender\(\{[\s\S]*playVoiceText,[\s\S]*resetChatSession,/u);

console.log('agent persona deferred voice smoke ok');
