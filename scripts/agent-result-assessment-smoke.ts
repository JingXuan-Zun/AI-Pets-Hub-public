import { readMessageProjectSources as readProjectSources } from './chatMessageSource.mjs';
import assert from 'node:assert/strict';


const {
  agentCommandSource,
  chatTypesSource,
  assessmentSource,
  controllerSource,
  messageBubbleSource,
  productionSessionSource,
} = readProjectSources({
  agentCommandSource: 'src/agent/agentChatCommand.ts',
  chatTypesSource: 'src/types.ts',
  assessmentSource: 'src/agent/agentResultAssessment.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
  messageBubbleSource: 'src/components/chat/PetChatConversationMessageBubble.tsx',
  productionSessionSource: 'src/agent/agentProductionSessionImplementation.ts',
});

assert.match(
  agentCommandSource,
  /export type AgentChatResultAssessmentStatus =[\s\S]*'completed'[\s\S]*'can-continue'[\s\S]*'needs-user'[\s\S]*'unverified'[\s\S]*'failed'/u,
  'agent command result should expose a bounded assessment status union',
);

assert.match(
  agentCommandSource,
  /export interface AgentChatResultAssessment[\s\S]*status: AgentChatResultAssessmentStatus;[\s\S]*summary: string;/u,
  'agent command result should expose structured assessment data',
);

assert.match(
  agentCommandSource,
  /assessment\?: AgentChatResultAssessment \| null;/u,
  'agent command result should carry an optional assessment',
);

assert.match(
  chatTypesSource,
  /export interface ChatAgentApproval \{[\s\S]*assessment\?: AgentChatResultAssessment \| null;/u,
  'agent approval messages should persist assessment state',
);

assert.match(
  chatTypesSource,
  /export interface ChatAgentRun \{[\s\S]*assessment\?: AgentChatResultAssessment \| null;/u,
  'agent run messages should persist assessment state',
);

assert.match(
  assessmentSource,
  /function hasAgentReadOnlyObservationActionCompletionEvidence\(/u,
  'agent assessment should distinguish read-only observation evidence from action completion evidence',
);

assert.match(
  assessmentSource,
  /isAgentReadOnlyObservationForDirectActionRequest/u,
  'agent assessment should guard direct action requests from being completed by plain read-only observations',
);

assert.match(
  controllerSource,
  /id: 'decide-next-step'[\s\S]*title: 'Decide next step'/u,
  'agent workflow should expose a visible next-step decision stage',
);

assert.match(
  chatTypesSource,
  /\| 'decide-next-step'/u,
  'chat agent work stage ids should include decide-next-step',
);

assert.equal(
  /runAgentProductionRuntime\(/u.test(controllerSource)
    && /assessAgentCommandResult\(/u.test(productionSessionSource),
  true,
  'production runs should enter Runtime and use the shared result assessment helper',
);

assert.match(
  controllerSource,
  /assessment: result\.assessment \?\? null/u,
  'agent messages should store the result assessment',
);

assert.match(
  messageBubbleSource,
  /function PetChatAgentAssessmentPanel\(/u,
  'chat message bubble should render the assessment panel',
);

assert.match(
  messageBubbleSource,
  /<PetChatAgentAssessmentPanel assessment=\{run\.assessment\} \/>/u,
  'agent run panel should show the assessment',
);

assert.match(
  messageBubbleSource,
  /<PetChatAgentAssessmentPanel assessment=\{approval\.assessment\} \/>/u,
  'agent approval panel should show the assessment after execution',
);

assert.match(
  messageBubbleSource,
  /function PetChatAgentRunRoundsPanel\(/u,
  'chat message bubble should render run loop rounds',
);

assert.match(
  messageBubbleSource,
  /<PetChatAgentRunRoundsPanel rounds=\{run\.rounds\} \/>/u,
  'agent run panel should show run loop rounds',
);

assert.match(
  messageBubbleSource,
  /<PetChatAgentRunRoundsPanel rounds=\{approval\.rounds\} \/>/u,
  'agent approval panel should show run loop rounds',
);

console.log('agent result assessment smoke ok');
