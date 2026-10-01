import assert from 'node:assert/strict';
import {
  createAgentCommandFromPlannerDecision,
  resolveAgentChatCommand,
} from '../src/agent/agentLegacy.ts';

const badJsonFallback = createAgentCommandFromPlannerDecision(
  '翠竹小桃 看一下我现在电脑屏幕和配置',
  null,
);
assert.equal(badJsonFallback?.kind, 'tool-call');
assert.equal(badJsonFallback?.toolCall?.name, 'get_system_info');
assert.equal(badJsonFallback?.toolCall?.input.includeDisplays, true);

const clarifyFallback = createAgentCommandFromPlannerDecision(
  '帮我把副屏上的图标整理整齐',
  {
    intent: 'clarify',
    message: '需要确认显示器',
  },
);
assert.equal(clarifyFallback?.kind, 'unsupported');
assert.equal(
  clarifyFallback?.toolCall?.input.displayTarget,
  undefined,
  'clarify should not fallback into a fixed desktop organization command',
);
assert.equal(
  clarifyFallback?.toolCall?.input.scope,
  undefined,
  'clarify should not fallback into fixed desktop organization scope',
);

const secondaryBottomRightFallback = createAgentCommandFromPlannerDecision(
  '小桃子帮我整理副屏上的图标和文件 整理好后放在副屏的右下角',
  {
    args: {},
    intent: 'tool',
    tool: 'organize_desktop_icons',
  },
);
assert.equal(secondaryBottomRightFallback?.kind, 'tool-call');
assert.equal(secondaryBottomRightFallback?.toolCall?.name, 'organize_desktop_icons');
assert.equal(secondaryBottomRightFallback?.toolCall?.input.mode, 'preview');
assert.equal(
  Object.hasOwn(secondaryBottomRightFallback?.toolCall?.input ?? {}, 'placementArea'),
  false,
  'planner should not preserve fixed corner placement arguments',
);

const stepFallback = createAgentCommandFromPlannerDecision(
  '帮我看看 D:\\Projects\\ai-pets-hub 这个项目怎么运行',
  {
    intent: 'tool',
    steps: [
      {
        args: {
          path: 'D:\\Projects\\ai-pets-hub',
        },
        tool: 'inspect_local_project',
      },
    ],
  },
);
assert.equal(stepFallback?.kind, 'tool-call');
assert.equal(stepFallback?.toolCall?.name, 'inspect_local_project');
assert.equal(stepFallback?.toolCall?.input.path, 'D:\\Projects\\ai-pets-hub');

const appFallback = createAgentCommandFromPlannerDecision(
  '帮我打开浏览器',
  {
    intent: 'unsupported',
    message: '模型误判',
  },
);
assert.equal(appFallback?.kind, 'unsupported');
assert.equal(
  appFallback?.toolCall?.input.query,
  undefined,
  'planner fallback should not extract app query from natural text after model unsupported',
);

const placementFallback = createAgentCommandFromPlannerDecision(
  '帮我把回收站整理到控制面板下面放整齐',
  {
    args: {},
    intent: 'tool',
    tool: null,
  },
);
assert.equal(placementFallback?.kind, 'unsupported');
assert.equal(
  placementFallback?.toolCall?.input.targetName,
  undefined,
  'planner should not infer single-icon target from fixed natural-language parser',
);
assert.equal(placementFallback?.toolCall?.input.anchorName, undefined);
assert.equal(placementFallback?.toolCall?.input.direction, undefined);

assert.equal(resolveAgentChatCommand('帮我打开浏览器'), null);
assert.equal(resolveAgentChatCommand('帮我把回收站整理到控制面板下面放整齐'), null);
assert.equal(resolveAgentChatCommand('小桃子帮我整理副屏图标到右下角'), null);

console.log('agent planner v2 behavior smoke ok');
