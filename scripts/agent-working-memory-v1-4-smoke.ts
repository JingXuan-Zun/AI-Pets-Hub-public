import assert from 'node:assert/strict';
import {
  createAgentContextFromResult,
  createAgentWorkingMemorySnapshot,
  type AgentChatCommand,
  type AgentChatFollowUpAction,
} from '../src/agent/index.ts';
import { type ChatMessage } from '../src/types.ts';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  contextSource,
  plannerSource,
  senderSource,
  controllerSource,
} = readProjectSources({
  contextSource: 'src/agent/agentChatContext.ts',
  plannerSource: 'src/agent/agentPlanner.ts',
  senderSource: 'src/components/chat/usePetChatMessageSender.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
});

assert.match(
  contextSource,
  /export interface AgentWorkingMemorySnapshot[\s\S]*summaryText[\s\S]*createAgentWorkingMemorySnapshot/u,
  'Agent context should expose a compact working memory snapshot',
);

assert.match(
  plannerSource,
  /Agent working memory from previous turns[\s\S]*Current user request/u,
  'Agent planner input should include prior working memory separately from the current request',
);

assert.match(
  senderSource,
  /runPreparedAgentProductionSession\(\{/u,
  'Chat sender should delegate Agent memory capture to the Agent run controller',
);

assert.match(
  controllerSource,
  /const workingMemory = createAgentWorkingMemorySnapshot\(preparedRequest\.promptHistoryMessages\)[\s\S]*workingMemory,[\s\S]*workingMemoryText: workingMemory\.summaryText/u,
  'Chat controller should pass structured previous Agent memory into AgentSessionV2 planning',
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
  sourceText: '/agent preview secondary desktop icons',
};

const desktopExecuteAction: AgentChatFollowUpAction = {
  command: {
    ...desktopPreviewCommand,
    desktopOrganization: {
      ...desktopPreviewCommand.desktopOrganization,
      mode: 'execute',
    },
    instruction: 'execute previous desktop organization plan',
    sourceText: 'execute previous plan',
  },
  kind: 'run-command',
  label: 'Execute desktop organization plan',
  requiresApproval: true,
};

const desktopContext = createAgentContextFromResult(desktopPreviewCommand, {
  followUpActions: [desktopExecuteAction],
  observationStats: {
    displayCount: 2,
    selectedIconCount: 6,
    targetDisplayLabel: 'Secondary display',
    targetIconCount: 6,
    totalIconCount: 14,
    willMoveAcrossDisplays: false,
  },
  ok: true,
  previewSummaryLines: [
    'Secondary display contains 6 icons.',
    'The preview does not move icons across displays.',
  ],
  responseText: 'desktop preview ok',
  verification: 'preview verified',
});

const projectInspectCommand: AgentChatCommand = {
  capabilityId: 'local-project-inspector',
  instruction: 'inspect project',
  kind: 'tool-call',
  sourceText: '/agent inspect D:\\projects\\zc\\ai-desktop-pet',
  toolCall: {
    input: {
      path: 'D:\\projects\\zc\\ai-desktop-pet',
    },
    name: 'inspect_local_project',
  },
};

const projectRunAction: AgentChatFollowUpAction = {
  command: {
    capabilityId: 'local-project-inspector',
    instruction: 'run second candidate action',
    kind: 'tool-call',
    sourceText: 'run second candidate action',
    toolCall: {
      input: {
        actionIndex: 2,
        path: 'D:\\projects\\zc\\ai-desktop-pet',
      },
      name: 'run_local_project_action',
    },
  },
  kind: 'run-command',
  label: 'Run candidate action 2',
  requiresApproval: true,
};

const projectContext = createAgentContextFromResult(projectInspectCommand, {
  followUpActions: [projectRunAction],
  ok: true,
  responseText: 'project inspection found two candidate actions',
});

const messages: ChatMessage[] = [
  {
    agentRun: {
      command: desktopPreviewCommand,
      context: desktopContext,
      followUpActions: [desktopExecuteAction],
      id: 'agent-run-desktop',
      plan: {
        commandKind: 'desktop-organization',
        goal: 'preview desktop',
        instruction: 'preview desktop',
        steps: [],
      },
      resultText: 'desktop preview ok',
      status: 'completed',
    },
    id: 'message-desktop',
    role: 'model',
    text: 'desktop preview complete',
  },
  {
    agentRun: {
      command: projectInspectCommand,
      context: projectContext,
      followUpActions: [projectRunAction],
      id: 'agent-run-project',
      plan: {
        commandKind: 'tool-call',
        goal: 'inspect project',
        instruction: 'inspect project',
        steps: [],
      },
      resultText: 'project inspection found two candidate actions',
      status: 'completed',
    },
    id: 'message-project',
    role: 'model',
    text: 'project inspection complete',
  },
];

const memory = createAgentWorkingMemorySnapshot(messages);

assert.equal(memory.entries.length, 2);
assert.equal(memory.latestEntry?.toolName, 'inspect_local_project');
assert.match(memory.summaryText, /tool=desktop-organization/u);
assert.match(memory.summaryText, /createdAt=\d+/u);
assert.match(memory.summaryText, /display=secondary/u);
assert.match(memory.summaryText, /crossDisplay=false/u);
assert.match(memory.summaryText, /actions=Execute desktop organization plan/u);
assert.match(memory.summaryText, /tool=inspect_local_project/u);
assert.match(memory.summaryText, /candidateActions=1/u);
assert.match(memory.summaryText, /Run candidate action 2/u);

console.log('agent working memory v1.4 smoke ok');
