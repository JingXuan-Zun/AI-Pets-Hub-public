import { readMessageProjectFile as readProjectFile } from './chatMessageSource.mjs';
import assert from 'node:assert/strict';


const chatTypesSource = readProjectFile('src/types.ts');
const controllerSource = readProjectFile('src/components/chat/agentRunController.ts');
const messageBubbleSource = readProjectFile('src/components/chat/PetChatConversationMessageBubble.tsx');
const showcaseSource = readProjectFile('src/components/pet/useDesktopOrganizationShowcase.ts');
const chatContextSource = readProjectFile('src/agent/agentChatContext.ts');

assert.match(
  chatTypesSource,
  /export interface ChatAgentApprovalSummary[\s\S]*lines: string\[\];[\s\S]*title: string;[\s\S]*warning\?: string \| null;/u,
  'Chat Agent approval summary should be typed as a first-class message field',
);

assert.match(
  chatTypesSource,
  /approvalSummary\?: ChatAgentApprovalSummary \| null;/u,
  'Agent approval messages should carry an approval summary',
);

assert.match(
  showcaseSource,
  /previewSummaryLines = \[[\s\S]*observationEvidence\.summaryLine[\s\S]*observationEvidence\.processingLine[\s\S]*summarizePlanIconNames\(plan\)/u,
  'desktop organization preview should create reusable observation summary lines',
);

assert.match(
  showcaseSource,
  /previewSummaryLines = \[[\s\S]*Icon position sources:[\s\S]*Selected icon move readiness:[\s\S]*Display ownership:/u,
  'desktop organization preview should include icon source, move readiness, and display ownership evidence',
);

assert.match(
  showcaseSource,
  /createDesktopOrganizationIconReadFallbackResult[\s\S]*fallback found \$\{normalizedIcons\.length\} desktop item\(s\)[\s\S]*cannot safely move icons until native-screen coordinates are available/u,
  'desktop organization preview should explain filesystem/read-only fallback instead of reporting empty desktop icons',
);

assert.match(
  showcaseSource,
  /previewWarning: observationEvidence\.willMoveAcrossDisplays[\s\S]*targetDisplayLabel/u,
  'desktop organization preview should warn when it will move icons across displays',
);

assert.match(
  chatContextSource,
  /previewSummaryLines: result\.previewSummaryLines/u,
  'Agent context should persist desktop organization preview summary lines',
);

assert.match(
  controllerSource,
  /function findLatestDesktopOrganizationPreviewSummary\([\s\S]*messages\.length - 1[\s\S]*previewSummaryLines/u,
  'approval summary should look backward for the latest desktop preview evidence',
);

assert.match(
  controllerSource,
  /const approvalSummary = await createAgentApprovalSummary\(command, plan, preparedRequest\);/u,
  'Agent approval message should create the generated summary',
);

assert.match(
  controllerSource,
  /agentApproval: \{[\s\S]*approvalSummary,[\s\S]*agentRuntime,/u,
  'Agent approval message should attach the generated summary',
);

assert.match(
  messageBubbleSource,
  /function PetChatAgentApprovalSummary\(/u,
  'chat message bubble should render the approval summary',
);

assert.match(
  messageBubbleSource,
  /<PetChatAgentApprovalSummary summary=\{approval\.approvalSummary\} \/>/u,
  'Agent approval panel should show the summary before approval buttons',
);

console.log('agent approval summary v1 smoke ok');
