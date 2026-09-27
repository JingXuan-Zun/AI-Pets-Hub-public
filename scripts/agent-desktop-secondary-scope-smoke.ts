import assert from 'node:assert/strict';
import {
  createDesktopIconArrangementPlan,
  hasExplicitAllDesktopIconsToDisplayIntent,
  hasExplicitDesktopOrganizationToDisplayIntent,
  runAgentProductionSession,
  resolveSafeDesktopOrganizationScope,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { createAgentCommandFromPlannerDecision } from '../src/agent/agentLegacy.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

const primaryViewport = {
  height: 1040,
  width: 1920,
  x: 0,
  y: 0,
};

const secondaryViewport = {
  height: 1400,
  width: 2560,
  x: 1920,
  y: 0,
};

const iconFixture: DesktopPetDesktopIconLike[] = [
  {
    centerX: 140,
    centerY: 140,
    height: 64,
    id: 'primary-a',
    index: 0,
    name: '主屏文件 A',
    width: 64,
    x: 108,
    y: 108,
  },
  {
    centerX: 260,
    centerY: 140,
    height: 64,
    id: 'primary-b',
    index: 1,
    name: '主屏文件 B',
    width: 64,
    x: 228,
    y: 108,
  },
  {
    centerX: 2040,
    centerY: 140,
    height: 64,
    id: 'secondary-a',
    index: 2,
    name: '副屏文件 A',
    width: 64,
    x: 2008,
    y: 108,
  },
  {
    centerX: 2160,
    centerY: 140,
    height: 64,
    id: 'secondary-b',
    index: 3,
    name: '副屏文件 B',
    width: 64,
    x: 2128,
    y: 108,
  },
];

function isIconInsideViewport(icon: DesktopPetDesktopIconLike, viewport: typeof secondaryViewport) {
  return icon.centerX >= viewport.x
    && icon.centerX <= viewport.x + viewport.width
    && icon.centerY >= viewport.y
    && icon.centerY <= viewport.y + viewport.height;
}

assert.equal(
  resolveSafeDesktopOrganizationScope({
    displayTarget: 'secondary',
    requestedScope: 'all-icons',
    sourceText: '帮我整理副屏桌面图标并排列整�?,
  }),
  'display-icons',
  'secondary display requests should not move every desktop icon unless the user explicitly says all icons',
);

assert.equal(
  resolveSafeDesktopOrganizationScope({
    displayTarget: 'secondary',
    requestedScope: 'all-icons',
    sourceText: '把全部桌面图标整理到副屏',
  }),
  'all-icons',
  'explicit all-icons-to-display requests should keep all-icons scope',
);

assert.equal(
  resolveSafeDesktopOrganizationScope({
    displayTarget: 'secondary',
    requestedScope: 'all-icons',
    sourceText: '整理一下桌面吧，整理好了放在副屏就好了',
  }),
  'all-icons',
  'explicit placement requests should allow moving the arranged desktop icons to the target display',
);

assert.equal(
  resolveSafeDesktopOrganizationScope({
    displayTarget: 'secondary',
    requestedScope: 'all-icons',
    sourceText: '帮我整理副屏桌面图标并排列整�?,
    structuredIntent: true,
  }),
  'all-icons',
  'structured tool intent should be honored instead of being reinterpreted by text heuristics',
);

assert.equal(
  hasExplicitAllDesktopIconsToDisplayIntent('把全部桌面图标整理到副屏'),
  true,
);

assert.equal(
  hasExplicitDesktopOrganizationToDisplayIntent('整理一下桌面吧，整理好了放在副屏就好了'),
  true,
);

assert.equal(
  hasExplicitAllDesktopIconsToDisplayIntent('帮我整理副屏桌面图标并排列整�?),
  false,
);

assert.equal(
  hasExplicitDesktopOrganizationToDisplayIntent('帮我整理副屏桌面图标并排列整�?),
  false,
);

const plannerCommand = createAgentCommandFromPlannerDecision('帮我整理副屏桌面图标并排列整�?, {
  args: {
    displayTarget: 'secondary',
    mode: 'preview',
    scope: 'all-icons',
  },
  goal: '整理副屏桌面图标',
  intent: 'tool',
  tool: 'organize_desktop_icons',
}) as AgentChatCommand | null;

assert.equal(plannerCommand?.kind, 'tool-call');
assert.equal(plannerCommand?.toolCall?.name, 'organize_desktop_icons');
assert.equal(plannerCommand?.toolCall?.input.displayTarget, 'secondary');
assert.equal(
  plannerCommand?.toolCall?.input.scope,
  'display-icons',
  'planner normalization should downgrade unsafe all-icons scope for ordinary secondary-display organization',
);

const explicitAllCommand = createAgentCommandFromPlannerDecision('把全部桌面图标整理到副屏', {
  args: {
    displayTarget: 'secondary',
    mode: 'preview',
    scope: 'all-icons',
  },
  goal: '把全部桌面图标整理到副屏',
  intent: 'tool',
  tool: 'organize_desktop_icons',
}) as AgentChatCommand | null;

assert.equal(explicitAllCommand?.toolCall?.input.scope, 'all-icons');

const placementCommand = createAgentCommandFromPlannerDecision('整理一下桌面吧，整理好了放在副屏就好了', {
  args: {
    displayTarget: 'secondary',
    mode: 'preview',
    scope: 'all-icons',
  },
  goal: '整理桌面并把整理结果放在副屏',
  intent: 'tool',
  tool: 'organize_desktop_icons',
}) as AgentChatCommand | null;

assert.equal(placementCommand?.toolCall?.input.scope, 'all-icons');

let modelCallCount = 0;
let structuredToolCommand: AgentChatCommand | null = null;
const structuredToolResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ systemInstruction, userInput }) => {
    modelCallCount += 1;
    assert.match(systemInstruction, /targetDisplay/u);
    assert.match(systemInstruction, /sourceScope/u);
    if (modelCallCount > 1) {
      assert.match(userInput, /preview ready/u);
      return JSON.stringify({
        action: 'final_answer',
        message: '整理预览已经准备好了�?,
      });
    }

    return JSON.stringify({
      action: 'tool_call',
      args: {
        mode: 'preview',
        sourceScope: 'all-icons',
        targetDisplay: 'secondary',
      },
      reason: 'The user wants the arranged desktop icons to end up on the secondary display.',
      tool: 'organize_desktop_icons',
    });
  },
  settings,
  sourceText: '整理一下桌面吧，整理好了放在副屏就好了',
  toolExecutor: async (command): Promise<AgentChatCommandResult> => {
    structuredToolCommand = command;
    return {
      ok: true,
      responseText: 'preview ready',
      verification: 'captured structured tool command',
    };
  },
});

assert.equal(modelCallCount, 2);
assert.equal(structuredToolResult.status, 'completed');
assert.equal(structuredToolCommand?.toolCall?.name, 'organize_desktop_icons');
assert.equal(structuredToolCommand?.toolCall?.input.targetDisplay, 'secondary');
assert.equal(structuredToolCommand?.toolCall?.input.sourceScope, 'all-icons');

const secondaryIcons = iconFixture.filter((icon) => isIconInsideViewport(icon, secondaryViewport));
assert.deepEqual(
  secondaryIcons.map((icon) => icon.id),
  ['secondary-a', 'secondary-b'],
  'desktop organization should select only icons whose centers are inside the secondary work area',
);

const plan = createDesktopIconArrangementPlan({
  icons: secondaryIcons,
  maxColumns: 7,
  viewport: secondaryViewport,
});

assert.deepEqual(
  plan.items.map((item) => item.iconId),
  ['secondary-a', 'secondary-b'],
  'secondary-display arrangement plan should not contain primary-display icons',
);

for (const item of plan.items) {
  assert.equal(
    item.to.x >= secondaryViewport.x && item.to.x <= secondaryViewport.x + secondaryViewport.width,
    true,
    `${item.iconName} target x should remain inside the secondary work area`,
  );
  assert.equal(
    item.to.y >= secondaryViewport.y && item.to.y <= secondaryViewport.y + secondaryViewport.height,
    true,
    `${item.iconName} target y should remain inside the secondary work area`,
  );
}

assert.equal(primaryViewport.width, 1920);

console.log('agent desktop secondary scope smoke ok');
