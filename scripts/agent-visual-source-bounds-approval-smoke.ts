import assert from 'node:assert/strict';
import { runAgentProductionSession } from '../src/agent/agentProductionSession.ts';
import { type AgentStructuredToolEvidence } from '../src/agent/agentChatCommand.ts';
import { type PetConfig } from '../src/types.ts';

const sourceBounds = { coordinateSpace: 'native-screen', x: 1000, y: 500, width: 800, height: 600 };
const outsideBounds = { coordinateSpace: 'native-screen', x: 300, y: 30, width: 36, height: 36 };
const insideBounds = { coordinateSpace: 'native-screen', x: 1382, y: 782, width: 36, height: 36 };
const cases: Array<{ name: string; evidence: AgentStructuredToolEvidence; point: { x: number; y: number } | null }> = [
  { name: 'valid offset source', evidence: { sourceBounds, elementBounds: insideBounds }, point: { x: 1400, y: 800 } },
  { name: 'image pixels outside source', evidence: { sourceBounds, elementBounds: outsideBounds }, point: null },
  { name: 'missing source coordinate space', evidence: { sourceBounds: { ...sourceBounds, coordinateSpace: undefined }, elementBounds: outsideBounds }, point: null },
  { name: 'blank source coordinate space', evidence: { sourceBounds: { ...sourceBounds, coordinateSpace: '' }, elementBounds: outsideBounds }, point: null },
  {
    name: 'valid negative display',
    evidence: { sourceBounds: { ...sourceBounds, x: -1800 }, elementBounds: { ...insideBounds, x: -1418 } },
    point: { x: -1400, y: 800 },
  },
  { name: 'wrong display', evidence: { sourceBounds: { ...sourceBounds, x: -1800 }, elementBounds: outsideBounds }, point: null },
  {
    name: 'ratio fallback with cropped source',
    evidence: {
      sourceBounds: { ...sourceBounds, x: 2000, y: 900, width: 200, height: 150 },
      elementCenter: { x: 318, y: 48 },
      elementCenterRatio: { x: 0.5, y: 0.5 },
      elementBounds: { coordinateSpace: 'source-ratio', x: 0.4, y: 0.4, width: 0.2, height: 0.2 },
    },
    point: { x: 2100, y: 975 },
  },
];

for (const scenario of cases) {
  const result = await runAgentProductionSession({
    settings: {} as PetConfig['settings'],
    sourceText: '/agent start Example Game inside Launcher',
    userGoal: 'start Example Game inside Launcher',
    maxSteps: 4,
    modelCaller: async () => JSON.stringify({
      action: 'tool_call', tool: 'locate_screen_elements', reason: 'Locate the game launch action.',
      args: { action: 'locate_element', sourceQuery: 'Launcher', sourceType: 'window', targetText: 'Example Game' },
    }),
    toolExecutor: async (command) => {
      assert.equal(command.toolCall?.name, 'locate_screen_elements', 'The test must never dispatch desktop input.');
      return {
        ok: true,
        responseText: 'Example Game Start action is visible.',
        stateSummary: { structuredEvidence: {
          confidence: 'high', coordinateConfidence: 'high', coordinateAuditStatus: 'coordinate_ok',
          targetMatched: 'Example Game', primaryAction: 'Start',
          relation: 'Start belongs to Example Game detail page', visualActionReadiness: 'ready',
          ...scenario.evidence,
        } },
      };
    },
  });
  if (!scenario.point) {
    assert.notEqual(result.status, 'needs-approval', `${scenario.name}: out-of-source coordinates must not become click approval.`);
    assert.equal(result.pendingApproval, null, scenario.name);
  } else {
    assert.equal(result.status, 'needs-approval', scenario.name);
    assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence', scenario.name);
    const steps = JSON.parse(String(result.pendingApproval?.command.toolCall?.input.stepsJson));
    const click = steps.find((step: { tool: string }) => step.tool === 'execute_desktop_input');
    assert.equal(click?.args.x, scenario.point.x, scenario.name);
    assert.equal(click?.args.y, scenario.point.y, scenario.name);
  }
  console.log(`PASS ${scenario.name}`);
}
console.log(`Agent visual source-bounds approval smoke passed (${cases.length} cases).`);
