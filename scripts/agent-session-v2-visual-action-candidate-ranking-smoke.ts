import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentStructuredToolEvidence,
} from '../src/agent/legacy/index.ts';
import { type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

// Candidate bounds let the runtime's actionable-area gate (72b9745) accept
// the ranked click point, so the deterministic ranking is what is tested.
function candidateBounds(x: number, y: number) {
  return { coordinateSpace: 'native-screen', height: 40, width: 120, x: x - 60, y: y - 20 };
}

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
  const startsFromLocate = !options.previousPoint;

  const result = await runAgentProductionSession({
    // With a previous click, ranking runs on the automatic recovery read after
    // the approved click. Without one, the model issues the initial locate and
    // the Runtime refines it before preparing the approval.
    ...(startsFromLocate
      ? {}
      : {
          approvedToolResult: {
            command: createSequenceCommand(),
            result: createBlockedSequenceResult(),
          },
        }),
    maxSteps: 3,
    modelCaller: async () => {
      modelCallCount += 1;
      if (startsFromLocate && modelCallCount === 1) {
        return JSON.stringify({
          action: 'tool_call',
          args: createLocateCommand().toolCall.input,
          reason: 'Locate the visible primary action.',
          tool: 'locate_screen_elements',
        });
      }
      throw new Error(`model should not be called for candidate ranking case ${options.label}`);
    },
    settings,
    sourceText: '/agent start the visible app from the launcher',
    toolExecutor: async (command) => {
      recoveryCommands.push(command);
      assert.equal(command.toolCall?.name, 'locate_screen_elements');
      if (recoveryCommands.length === 1) {
        assert.equal(command.toolCall.input.action, 'describe_elements');
      }
      return createCandidateResult(options.evidence);
    },
    userGoal: 'start Example Game from launcher',
  });

  assert.equal(modelCallCount, startsFromLocate ? 1 : 0);
  assert.ok(recoveryCommands.length >= 1);
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
        bounds: candidateBounds(1440, 920),
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
        bounds: candidateBounds(1510, 940),
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
        bounds: candidateBounds(1510, 940),
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
        bounds: candidateBounds(1280, 821),
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
    // Login clicks must come from a window-bound capture.
    captureSourceType: 'window',
    finalWindow: { hwnd: 4242, processName: 'LeagueClientUx.exe', title: 'League of Legends' },
    postActionState: 'login_required',
    primaryAction: 'Login',
    relation: 'Login button belongs to the League of Legends login window',
    status: 'success',
    targetMatched: 'League of Legends login window',
    visualActionReadiness: 'ready',
  },
});

console.log('agent session v2 visual action candidate ranking smoke ok');
