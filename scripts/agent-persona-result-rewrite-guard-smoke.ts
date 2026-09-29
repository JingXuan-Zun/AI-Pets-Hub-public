import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const agentSource = readProjectFile('src/components/chat/agentRunController.ts');
const chatStoreSource = readProjectFile('src/chatStore.ts');

function extractBetween(startNeedle: string, endNeedle: string, source = agentSource) {
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
  agentSource.includes('const AGENT_PERSONA_SYSTEM_TONE_PATTERNS = ['),
  'Agent persona result replies should have a centralized system-tone pattern list',
);
assert.match(agentSource, /帮用户分析/u);
assert.match(agentSource, /提醒用户/u);
assert.match(agentSource, /根据工具结果/u);
assert.match(agentSource, /任务已完成/u);
assert.match(agentSource, /内部流程名/u);
assert.match(agentSource, /空泛完成句/u);
assert.match(agentSource, /整理结果套话/u);
assert.match(agentSource, /AgentSessionV2\|AgentProductionSession\|Agent V2\|JSON/u);
assert.match(agentSource, /\^\(\?:处理好了\|完成了\|搞定了/u);

assert.ok(
  agentSource.includes('function findAgentPersonaReplyStyleIssues(text: string)'),
  'Agent persona result replies should expose a style issue detector',
);
assert.ok(
  agentSource.includes('function shouldRetryAgentPersonaReply(text: string)'),
  'Agent persona result replies should have a retry predicate',
);
assert.ok(
  agentSource.includes('function buildAgentPersonaReplyRewritePrompt'),
  'Agent persona result replies should have a dedicated rewrite prompt builder',
);
assert.ok(
  agentSource.includes('function createAgentSafeVisibleFallbackText'),
  'Agent fallback visible replies should filter internal implementation text',
);
assert.match(agentSource, /AGENT_INTERNAL_FALLBACK_TEXT_PATTERN/u);
assert.match(agentSource, /不要只说/u);

const retryRunner = extractBetween(
  'async function runAgentPersonaResponseTurnWithStyleRetry',
  '\n\nasync function speakAgentResult',
);
assert.match(retryRunner, /findAgentPersonaReplyStyleIssues\(firstResponse\.finalResponse\)/u);
assert.match(retryRunner, /desktopPetChatStore\.removeMessage\(firstModelMessageId\)/u);
assert.match(retryRunner, /persona result reply retried for character voice/u);
assert.match(retryRunner, /buildAgentPersonaReplyRewritePrompt/u);
assert.equal(
  countMatches(retryRunner, /runPetResponseTurn\(targetSlot,/gu),
  2,
  'style retry runner should do one initial reply and at most one rewrite retry',
);

const legacySpeaker = extractBetween(
  'async function speakAgentResult',
  '\n\nfunction formatAgentProductionSessionResultForPersonaPrompt',
);
assert.match(legacySpeaker, /runAgentPersonaResponseTurnWithStyleRetry/u);
assert.doesNotMatch(legacySpeaker, /await runPetResponseTurn\(targetSlot,/u);

const sessionSpeaker = extractBetween(
  'async function speakAgentProductionSessionResult',
  '\n\nexport async function runPreparedAgentProductionSession',
);
assert.match(sessionSpeaker, /runAgentPersonaResponseTurnWithStyleRetry/u);
assert.doesNotMatch(sessionSpeaker, /await runPetResponseTurn\(targetSlot,/u);
assert.match(sessionSpeaker, /catch \(error\)/u);
assert.match(sessionSpeaker, /persona reply failed; displaying verified session result/u);
assert.match(sessionSpeaker, /createAgentProductionSessionFallbackVisibleReply\(result\)/u);
assert.match(sessionSpeaker, /createAgentSafeVisibleFallbackText\(result\.finalAnswer, 900\)/u);
assert.match(sessionSpeaker, /displaying accepted runtime final answer without a second model call/u);

assert.ok(
  chatStoreSource.includes('removeMessage(messageId: string)'),
  'chat store should expose removeMessage so a failed persona draft can be removed before retry',
);
const removeMessageBody = extractBetween(
  'removeMessage(messageId: string)',
  '\n    replaceMessages',
  chatStoreSource,
);
assert.match(removeMessageBody, /deriveLatestPetMessages\(nextMessages\)/u);
assert.match(removeMessageBody, /deriveLatestPetMessage\(/u);

console.log('agent persona result rewrite guard smoke ok');
