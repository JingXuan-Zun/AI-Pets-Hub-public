import assert from 'node:assert/strict';
import { createAgentCommandFromPlannerDecision } from '../src/agent/agentPlanner.ts';
import { prepareAgentToolInput } from '../src/agent/agentToolInputSchema.ts';
import { readProjectFile } from './smokeTestHarness.ts';

const sourceText = '/agent 把文件夹和 .txt 文件尽量放到右上角，其它图标尽量不要动';
const placementIntent = '把文件夹和 .txt 文件尽量放到右上角，其它图标尽量不要动';

const prepared = prepareAgentToolInput('organize_desktop_icons', {
  mode: 'preview',
  placementIntent,
  sourceScope: 'display-icons',
});

assert.equal(prepared.ok, true, 'desktop organization schema should accept open placementIntent');
assert.equal(prepared.input.placementIntent, placementIntent);

const command = createAgentCommandFromPlannerDecision(sourceText, {
  args: {
    mode: 'preview',
    placementIntent,
    sourceScope: 'display-icons',
  },
  goal: '预览开放式桌面整理意图',
  intent: 'tool',
  tool: 'organize_desktop_icons',
});

assert.equal(command?.toolCall?.name, 'organize_desktop_icons');
assert.equal(command?.toolCall?.input.placementIntent, placementIntent);
assert.equal(command?.toolCall?.input.mode, 'preview');

const plannerSource = readProjectFile('src/agent/agentPlanner.ts');
const sessionSource = readProjectFile('src/agent/agentProductionSessionImplementation.ts');
const runtimeSource = readProjectFile('src/agent/agentRuntimeDesktopOrganizationTools.ts');
const showcaseSource = readProjectFile('src/components/pet/useDesktopOrganizationShowcase.ts');

assert.match(plannerSource, /preserve the open-ended user request in placementIntent/u);
assert.match(plannerSource, /Do not ask "choose option 1 or 2"/u);
assert.match(sessionSource, /Do not compress an open-ended request into a rigid numbered menu/u);
assert.match(runtimeSource, /Placement intent: \$\{options\.placementIntent\}/u);
assert.match(showcaseSource, /Requested layout intent: \$\{organization\.placementIntent\}/u);

console.log('agent desktop organization open intent smoke ok');
