import assert from 'node:assert/strict';
import {
  createAgentCommandFromPlannerDecision,
  createAgentCorePlan,
} from '../src/agent/agentLegacy.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const commandSource = readProjectFile('src/agent/agentChatCommand.ts');
const plannerSource = readProjectFile('src/agent/agentPlanner.ts');
const coreSource = readProjectFile('src/agent/agentCore.ts');
const controllerSource = readProjectFile('src/components/chat/agentRunController.ts');
const typesSource = readProjectFile('src/types.ts');
const messageBubbleSource = readProjectFile('src/components/chat/PetChatConversationMessageBubble.tsx');

assert.match(
  commandSource,
  /export interface AgentPlannerCommandStep[\s\S]*phase: 'observe' \| 'plan' \| 'execute' \| 'verify' \| 'recover'[\s\S]*plannerSteps\?: AgentPlannerCommandStep\[\];/u,
  'Agent commands should carry structured planner steps',
);

assert.match(
  plannerSource,
  /function normalizePlannerCommandSteps\([\s\S]*normalizePlannerToolArgs\(sourceText, toolName, rawArgs\)[\s\S]*inferPlannerCommandStepPhase/u,
  'Planner should normalize model-proposed multi-step tool plans',
);

assert.match(
  plannerSource,
  /withPlannerCommandSteps\([\s\S]*createToolCallCommand\(sourceText, selectedToolName, input, goal\)[\s\S]*plannerSteps/u,
  'Planner-created commands should preserve planner steps',
);

assert.match(
  coreSource,
  /export interface AgentCoreTaskStep[\s\S]*permissionStatus[\s\S]*requiresApproval[\s\S]*selected/u,
  'Agent Core should expose routed task steps',
);

assert.match(
  coreSource,
  /function createAgentCoreTaskSteps\([\s\S]*buildAgentPermissionRoute\(createCommandFromPlannerStep\(command, step\)\)[\s\S]*selected: step\.tool === selectedToolName/u,
  'Agent Core should route each planner step through permission policy',
);

assert.match(
  typesSource,
  /export interface ChatAgentCorePlanSummary[\s\S]*taskSteps: Array<\{[\s\S]*permissionStatus: AgentPermissionRouteStatus;[\s\S]*corePlanSummary\?: ChatAgentCorePlanSummary \| null;/u,
  'Chat state should persist Agent Core plan summaries',
);

assert.match(
  controllerSource,
  /runAgentSessionV2\(/u,
  'Chat controller should route new Agent requests through AgentSessionV2',
);

assert.doesNotMatch(
  controllerSource,
  /createChatAgentCorePlanSummary|createAgentCorePlan|executeAgentCoreRunLoop/u,
  'Chat controller should not keep the old Agent Core summary/loop entry',
);

assert.match(
  messageBubbleSource,
  /function PetChatAgentCorePlanSummary\([\s\S]*process\.corePlanSummary/u,
  'Agent details UI should render Core plan summaries only inside expanded process details',
);

const command = createAgentCommandFromPlannerDecision('帮我看一下副屏，然后整理桌面图标', {
  goal: '整理副屏桌面图标',
  intent: 'tool',
  steps: [
    {
      args: {},
      reason: '先读取屏幕布局，确认主屏和副屏',
      tool: 'get_display_info',
    },
    {
      args: {
        displayTarget: 'secondary',
        mode: 'preview',
        scope: 'display-icons',
      },
      reason: '根据观察结果生成副屏图标整理计划',
      tool: 'organize_desktop_icons',
    },
  ],
  tool: 'get_display_info',
});

assert.equal(command?.kind, 'tool-call');
assert.equal(command?.toolCall?.name, 'get_display_info');
assert.equal(command?.plannerSteps?.length, 2);
assert.equal(command?.plannerSteps?.[0]?.phase, 'observe');
assert.equal(command?.plannerSteps?.[1]?.phase, 'plan');

const corePlan = createAgentCorePlan(command!);
assert.equal(corePlan.taskSteps.length, 2);
assert.equal(corePlan.taskSteps[0]?.tool, 'get_display_info');
assert.equal(corePlan.taskSteps[0]?.permissionStatus, 'silent');
assert.equal(corePlan.taskSteps[0]?.selected, true);
assert.equal(corePlan.taskSteps[1]?.tool, 'organize_desktop_icons');
assert.equal(corePlan.taskSteps[1]?.permissionStatus, 'silent');
assert.equal(corePlan.taskSummary.includes('get_display_info'), true);

console.log('agent core v1.1 multistep smoke ok');
