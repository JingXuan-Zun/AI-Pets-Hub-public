import assert from 'node:assert/strict';
import {
  createAgentContextFromResult,
  type AgentChatCommand,
  type AgentChatFollowUpAction,
} from '../src/agent/index.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const typesSource = readProjectFile('src/types.ts');
const controllerSource = readProjectFile('src/components/chat/agentRunController.ts');
const continuationSource = readProjectFile('src/agent/agentFollowUpContinuation.ts');

assert.match(
  typesSource,
  /export interface ChatAgentContext[\s\S]*actions\?: AgentChatFollowUpAction\[\][\s\S]*sourceCommand: AgentChatCommand;/u,
  'Agent chat messages should persist structured context and follow-up actions',
);

assert.match(
  controllerSource,
  /createAgentContextFromResult\(displayResult\.command, displayResult\.result\)/u,
  'Agent run controller should create context from the AgentSessionV2 display command/result',
);

assert.match(
  continuationSource,
  /findLatestAgentContextMessage\(messages\)[\s\S]*resolveContextActionByIntent/u,
  'Agent follow-up continuation should read latest structured context',
);

assert.match(
  continuationSource,
  /resolveFollowUpActionByText\(sourceText, followUpActions\)[\s\S]*followUpActions\[0\]/u,
  'Agent follow-up continuation should prefer explicit structured actions before defaulting',
);

assert.doesNotMatch(
  continuationSource,
  /createAgentFollowUpContinuationCommand|kind: 'unsupported'|plannerMessage/u,
  'Agent follow-up continuation should not create legacy unsupported/fixed fallback commands',
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

const desktopExecuteAction: AgentChatFollowUpAction = {
  command: {
    ...desktopPreviewCommand,
    desktopOrganization: {
      ...desktopPreviewCommand.desktopOrganization,
      mode: 'execute',
    },
    instruction: 'execute previous desktop plan',
    sourceText: 'execute previous desktop plan',
  },
  kind: 'run-command',
  label: 'execute plan',
  requiresApproval: true,
};

const desktopReobserveAction: AgentChatFollowUpAction = {
  command: {
    ...desktopPreviewCommand,
    instruction: 'reobserve desktop',
    sourceText: 'reobserve desktop',
  },
  kind: 'run-command',
  label: 'reobserve desktop',
};

const desktopContext = createAgentContextFromResult(desktopPreviewCommand, {
  followUpActions: [desktopExecuteAction, desktopReobserveAction],
  ok: true,
  responseText: 'preview ok',
});

assert.equal(desktopContext.sourceCommand.kind, 'desktop-organization');
assert.equal(desktopContext.actions?.length, 2);
assert.equal(desktopContext.actions?.[0]?.label, 'execute plan');
assert.equal(desktopContext.actions?.[1]?.label, 'reobserve desktop');

const inspectCommand: AgentChatCommand = {
  capabilityId: 'local-project-inspector',
  instruction: 'inspect project',
  kind: 'tool-call',
  sourceText: 'inspect project',
  toolCall: {
    input: {
      path: 'D:\\Projects\\ai-pets-hub',
    },
    name: 'inspect_local_project',
  },
};

const projectActions: AgentChatFollowUpAction[] = [1, 2, 3].map((actionIndex) => ({
  command: {
    capabilityId: 'local-project-inspector',
    instruction: `run action ${actionIndex}`,
    kind: 'tool-call',
    sourceText: `run action ${actionIndex}`,
    toolCall: {
      input: {
        actionIndex,
        path: 'D:\\Projects\\ai-pets-hub',
      },
      name: 'run_local_project_action',
    },
  },
  kind: 'run-command',
  label: `run ${actionIndex}`,
  requiresApproval: true,
}));

const projectContext = createAgentContextFromResult(inspectCommand, {
  followUpActions: projectActions,
  ok: true,
  responseText: 'inspect ok',
});

assert.equal(projectContext.sourceCommand.toolCall?.name, 'inspect_local_project');
assert.equal(projectContext.actions?.[1]?.command.toolCall?.name, 'run_local_project_action');
assert.equal(projectContext.actions?.[1]?.command.toolCall?.input.actionIndex, 2);

console.log('agent context v1 smoke ok');
