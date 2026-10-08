import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createToolCommand(name: AgentChatCommand['toolCall']['name'], input: Record<string, unknown>): AgentChatCommand {
  return {
    capabilityId: name === 'execute_desktop_observation' ? 'desktop-observation' : 'app-launcher',
    instruction: 'start Example Game from launcher',
    kind: 'tool-call',
    sourceText: '/agent start Example Game from launcher',
    toolCall: {
      goal: 'start Example Game from launcher',
      input,
      name,
    },
  };
}

function createApprovedSequenceResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Step 1/1 tool=execute_desktop_input status=ok'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_sequence', 'Completed: 1/1'],
      title: 'Agent desktop sequence',
      toolName: 'execute_desktop_sequence',
      verification: 'execute_desktop_sequence completed all steps in order.',
    },
    responseText: 'execute_desktop_sequence completed all steps in order.',
    stateSummary: {
      changedState: ['cursor-position', 'active-window-input-state'],
      observedState: ['Step 1/1 tool=execute_desktop_input status=ok'],
      verificationEvidence: ['Sequence steps completed.'],
    },
    verification: 'execute_desktop_sequence completed all steps in order.',
  };
}

function createReadyVisualVerificationResult(): AgentChatCommandResult {
  return {
    observations: [
      'Visual target matched: Example Game',
      'Visual primary action: Start',
      'Visual element center: x=1440 y=920',
      'Visual action readiness: ready',
    ],
    ok: true,
    receipt: {
      evidenceLines: ['Post-approval verification found Start at screen coordinate 1440,920.'],
      status: 'success',
      summaryLines: ['Call: execute_desktop_observation summarize_visual_snapshot'],
      title: 'Post approval visual verification',
      toolName: 'execute_desktop_observation',
      verification: 'Start control is visible and actionable.',
    },
    responseText: 'Post-approval verification found a clear Start control for Example Game.',
    stateSummary: {
      observedState: [
        'Visual target matched: Example Game',
        'Visual primary action: Start',
        'Visual element center: x=1440 y=920',
      ],
      structuredEvidence: {
        confidence: 'high',
        coordinateConfidence: 'high',
        elementCenter: {
          coordinateSpace: 'native-screen',
          source: 'test',
          x: 1440,
          y: 920,
        },
        elementRegion: 'lower-right launcher panel',
        primaryAction: 'Start',
        relation: 'Start control belongs to Example Game',
        status: 'success',
        targetMatched: 'Example Game',
        visualActionReadiness: 'ready',
      },
      verificationEvidence: ['Post-approval verification found Start at screen coordinate 1440,920.'],
    },
    verification: 'Start control is visible and actionable.',
  };
}

const approvedCommand = createToolCommand('execute_desktop_sequence', {
  postVerifyVisualQuery: 'Example Game',
  stepsJson: JSON.stringify([
    {
      args: {
        action: 'click',
        button: 'left',
        x: 1200,
        y: 880,
      },
      reason: 'Click the approximate launcher tile.',
      tool: 'execute_desktop_input',
    },
  ]),
});

const executedCommands: AgentChatCommand[] = [];
let modelCallCount = 0;

const result = await runAgentProductionSession({
  approvedToolResult: {
    command: approvedCommand,
    result: createApprovedSequenceResult(),
  },
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    modelCallCount += 1;
    // Post-approval verification found the ready Start control; after the
    // focused refinement the model selects the retry click for approval.
    assert.equal(modelCallCount, 1);
    assert.match(userInput, /elementCenter=1440,920/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        stepsJson: JSON.stringify([
          {
            args: { action: 'click', x: 1440, y: 920 },
            reason: 'Click the verified Example Game Start control.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      reason: 'Post-approval verification found the Start control; request approval for the click.',
      tool: 'execute_desktop_sequence',
    });
  },
  settings,
  sourceText: '/agent start Example Game from launcher',
  toolExecutor: async (command) => {
    executedCommands.push(command);
    if (executedCommands.length === 2) {
      // Bounded read-only focused refinement of the ready Start control.
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.match(String(command.toolCall?.input.targetDescription), /; focused candidate: /u);
      return createReadyVisualVerificationResult();
    }
    assert.equal(command.toolCall?.name, 'execute_desktop_observation');
    assert.equal(command.toolCall?.input.action, 'summarize_visual_snapshot');
    assert.equal(command.toolCall?.input.query, 'Example Game');
    assert.match(String(command.toolCall?.input.question), /AgentRuntime post-action verification/u);

    return createReadyVisualVerificationResult();
  },
  userGoal: 'start Example Game from launcher',
});

assert.equal(modelCallCount, 1);
assert.equal(executedCommands.length, 2);
assert.equal(result.status, 'needs-approval');
assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /execute_desktop_input/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1440/u);
assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /920/u);
assert.match(result.continuation.historyLines.join('\n'), /post-approval verification result/u);
assert.match(result.continuation.historyLines.join('\n'), /selected approval-required tool:/u);

console.log('agent session v2 post approval ready approval smoke ok');
