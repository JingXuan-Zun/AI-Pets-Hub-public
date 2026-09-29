import assert from 'node:assert/strict';
import {
  createAgentContextFromResult,
  findLatestDesktopObservationContext,
  formatDesktopObservationContextAnswer,
  type AgentChatCommand,
  type AgentChatFollowUpAction,
} from '../src/agent/index.ts';
import { type ChatMessage } from '../src/types.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const chatCommandSource = readProjectFile('src/agent/agentChatCommand.ts');
const contextSource = readProjectFile('src/agent/agentChatContext.ts');
const contextQuerySource = readProjectFile('src/agent/agentContextQuery.ts');
const senderSource = readProjectFile('src/components/chat/usePetChatMessageSender.ts');
const runtimeSource = readProjectFile('src/agent/agentRuntimeExecutor.ts');
const orchestratorSource = readProjectFile('src/agent/agentOrchestrator.ts');

assert.match(
  chatCommandSource,
  /'context-query'/u,
  'Agent command kinds should include context-query',
);

assert.match(
  contextSource,
  /export function findLatestDesktopObservationContext/u,
  'Agent context should expose latest desktop observation lookup',
);

assert.match(
  contextQuerySource,
  /findLatestDesktopObservationContext\(messages\)[\s\S]*formatDesktopObservationContextAnswer\(latestObservation\.context\)/u,
  'context query resolver should answer from the latest desktop observation context',
);

assert.match(
  senderSource,
  /resolveAgentChatEntryRoute\([\s\S]*historyMessages: preparedRequest\.promptHistoryMessages/u,
  'chat sender should route ambiguous Agent entry through the chat entry router with current chat history',
);

assert.match(
  orchestratorSource,
  /answer-agent-context-query/u,
  'context query should produce a read-only Agent execution plan',
);

assert.match(
  runtimeSource,
  /command\.kind === 'context-query'[\s\S]*answerText/u,
  'runtime should answer context-query commands from prepared context answer text',
);

const desktopPreviewCommand: AgentChatCommand = {
  capabilityId: 'desktop-organization',
  desktopOrganization: {
    displayTarget: 'secondary',
    mode: 'preview',
    scope: 'display-icons',
  },
  instruction: 'preview secondary desktop icons',
  kind: 'desktop-organization',
  sourceText: 'preview secondary desktop icons',
};

const executeAction: AgentChatFollowUpAction = {
  command: {
    ...desktopPreviewCommand,
    desktopOrganization: {
      ...desktopPreviewCommand.desktopOrganization,
      mode: 'execute',
    },
    sourceText: 'execute previous desktop plan',
  },
  kind: 'run-command',
  label: 'execute plan',
  requiresApproval: true,
};

const context = createAgentContextFromResult(desktopPreviewCommand, {
  followUpActions: [executeAction],
  observationStats: {
    displayCount: 2,
    selectedIconCount: 1,
    targetDisplayLabel: 'secondary display',
    targetIconCount: 1,
    totalIconCount: 3,
    willMoveAcrossDisplays: false,
  },
  ok: true,
  previewSummaryLines: [
    'Observation evidence: detected 2 displays and 3 desktop icons.',
    'This preview handles 1/1 icon in the secondary display range and keeps other displays unchanged.',
  ],
  responseText: 'preview ok',
});

const messages: ChatMessage[] = [{
  agentRun: {
    command: desktopPreviewCommand,
    context,
    followUpActions: [executeAction],
    id: 'agent-run-1',
    plan: {
      commandKind: 'desktop-organization',
      goal: 'preview',
      instruction: 'preview',
      steps: [],
    },
    status: 'completed',
  },
  id: 'message-1',
  role: 'model',
  text: 'preview complete',
}];

const latestObservation = findLatestDesktopObservationContext(messages);
assert.equal(latestObservation?.context.desktopOrganization?.observationStats?.targetIconCount, 1);

const answer = formatDesktopObservationContextAnswer(context);
assert.match(answer, /2/u);
assert.match(answer, /secondary display[\s\S]*1/u);
assert.match(answer, /keeps other displays unchanged/u);

console.log('agent context query v1 smoke ok');
