import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolEvidence,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createSequenceCommand(): AgentChatCommand {
  return {
    capabilityId: 'app-launcher',
    instruction: 'start the visible app from the launcher',
    kind: 'tool-call',
    sourceText: '/agent start the visible app from the launcher',
    toolCall: {
      goal: 'start the visible app from the launcher',
      input: {
        postVerifyVisualQuery: 'Example Game launched',
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              x: 1440,
              y: 920,
            },
            reason: 'Click the first visible Start control.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      name: 'execute_desktop_sequence',
    },
  };
}

function createLocateCommand(): AgentChatCommand {
  return {
    capabilityId: 'desktop-vision',
    instruction: 'locate the visible primary action',
    kind: 'tool-call',
    sourceText: '/agent start the visible app from the launcher',
    toolCall: {
      goal: 'start the visible app from the launcher',
      input: {
        action: 'describe_elements',
        targetDescription: 'the visible primary action',
      },
      name: 'locate_screen_elements',
    },
  };
}

function createBlockedSequenceResult(): AgentChatCommandResult {
  return {
    ok: true,
    receipt: {
      evidenceLines: ['Post-action visual state: blocked'],
      status: 'unverified',
      summaryLines: ['Call: execute_desktop_sequence', 'Post-action visual state: blocked'],
      title: 'Sequence result',
      toolName: 'execute_desktop_sequence',
      verification: 'Post-sequence visual state is blocked.',
    },
    responseText: 'Clicked the launcher area, but the visible UI is blocked.',
    stateSummary: {
      missingEvidence: ['The requested app was not confirmed launched.'],
      observedState: ['Post-action visual state: blocked'],
      structuredEvidence: {
        postActionState: 'blocked',
        status: 'unverified',
        targetMatched: 'Example Game',
      },
    },
    verification: 'Post-sequence visual state is blocked.',
  };
}

function createCandidateResult(evidence: AgentStructuredToolEvidence): AgentChatCommandResult {
  return {
    observations: [
      'Visual target matched: Example Game',
      'Visual primary action: Start',
      'Visual action candidate: previous point x=1440 y=920',
      'Visual action candidate: alternate point x=1510 y=940',
    ],
    ok: true,
    receipt: {
      evidenceLines: ['Recovery read found multiple Start candidates.'],
      status: 'success',
      summaryLines: ['Call: locate_screen_elements', 'Result: action candidates found'],
      title: 'Post-action recovery candidate read',
      toolName: 'locate_screen_elements',
      verification: 'Start candidates are visible.',
    },
    responseText: 'Recovery read found multiple Start candidates for Example Game.',
    stateSummary: {
      observedState: ['Visual target matched: Example Game', 'Visual primary action: Start'],
      structuredEvidence: evidence,
      verificationEvidence: ['Recovery read found multiple Start candidates.'],
    },
    verification: 'Start candidates are visible.',
  };
}

async function runCase(options: {
  evidence: AgentStructuredToolEvidence;
  expectedX?: number;
  expectedY?: number;
  label: string;
  previousPoint?: { x: number; y: number } | null;
}) {
  const recoveryCommands: AgentChatCommand[] = [];
  let modelCallCount = 0;

  const result = await runAgentProductionSession({
    approvedToolResult: {
      command: options.previousPoint ? createSequenceCommand() : createLocateCommand(),
      result: options.previousPoint
        ? createBlockedSequenceResult()
        : {
            ok: true,
            receipt: {
              evidenceLines: ['Initial visual read needs action approval.'],
              status: 'unverified',
              summaryLines: ['Call: locate_screen_elements', 'Result: action candidate found'],
              title: 'Visual read',
              toolName: 'locate_screen_elements',
              verification: 'Action candidate is visible.',
            },
            responseText: 'Action candidate is visible.',
            stateSummary: {
              observedState: ['Action candidate is visible.'],
              structuredEvidence: options.evidence,
              verificationEvidence: ['Action candidate is visible.'],
            },
            verification: 'Action candidate is visible.',
          },
    },
    maxSteps: 2,
    modelCaller: async () => {
      modelCallCount += 1;
      throw new Error(`model should not be called for candidate ranking case ${options.label}`);
    },
    settings,
    sourceText: '/agent start the visible app from the launcher',
    toolExecutor: async (command) => {
      recoveryCommands.push(command);
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      assert.equal(command.toolCall.input.action, 'describe_elements');
      return createCandidateResult(options.evidence);
    },
    userGoal: 'start Example Game from launcher',
  });

  assert.equal(modelCallCount, 0);
  assert.equal(recoveryCommands.length, options.previousPoint ? 1 : 0);
  assert.equal(result.status, 'needs-approval');
  assert.equal(result.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
  assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), new RegExp(String(options.expectedX ?? 1510), 'u'));
  assert.match(String(result.pendingApproval?.command.toolCall?.input.stepsJson), new RegExp(String(options.expectedY ?? 940), 'u'));
  if ((options.expectedX ?? 1510) !== 1440 || (options.expectedY ?? 940) !== 920) {
    assert.doesNotMatch(String(result.pendingApproval?.command.toolCall?.input.stepsJson), /1440[^]*920/u);
  }
}

await runCase({
  expectedX: 1510,
  expectedY: 940,
  label: 'avoid previous top-level point',
  previousPoint: { x: 1440, y: 920 },
  evidence: {
    actionCandidates: [
      {
        center: {
          coordinateSpace: 'native-screen',
          x: 1440,
          y: 920,
        },
        confidence: 'high',
        label: 'Start',
        relation: 'Start control belongs to Example Game',
      },
      {
        center: {
          coordinateSpace: 'native-screen',
          x: 1510,
          y: 940,
        },
        confidence: 'medium',
        label: 'Start',
        relation: 'Start control belongs to Example Game',
      },
    ],
    confidence: 'high',
    coordinateConfidence: 'high',
    elementCenter: {
      coordinateSpace: 'native-screen',
      x: 1440,
      y: 920,
    },
    primaryAction: 'Start',
    status: 'success',
    targetMatched: 'Example Game',
    visualActionReadiness: 'ready',
  },
});

await runCase({
  expectedX: 1510,
  expectedY: 940,
  label: 'candidate-only ready point',
  previousPoint: { x: 1440, y: 920 },
  evidence: {
    actionCandidates: [
      {
        center: {
          coordinateSpace: 'native-screen',
          x: 1510,
          y: 940,
        },
        confidence: 'high',
        label: 'Start',
        relation: 'Start control belongs to Example Game',
      },
    ],
    confidence: 'high',
    coordinateConfidence: 'high',
    primaryAction: 'Start',
    status: 'success',
    targetMatched: 'Example Game',
    visualActionReadiness: 'ready',
  },
});

await runCase({
  expectedX: 1280,
  expectedY: 821,
  label: 'prefer explicit action candidate over coarse login window point',
  previousPoint: null,
  evidence: {
    actionCandidates: [
      {
        center: {
          coordinateSpace: 'native-screen',
          x: 1280,
          y: 821,
        },
        confidence: 'high',
        label: 'Login',
        relation: 'Login button belongs to the League of Legends login window',
      },
    ],
    confidence: 'high',
    coordinateConfidence: 'high',
    elementCenter: {
      coordinateSpace: 'native-screen',
      x: 1280,
      y: 677,
    },
    postActionState: 'login_required',
    primaryAction: 'Login',
    relation: 'Login button belongs to the League of Legends login window',
    status: 'success',
    targetMatched: 'League of Legends login window',
    visualActionReadiness: 'ready',
  },
});

console.log('agent session v2 visual action candidate ranking smoke ok');
