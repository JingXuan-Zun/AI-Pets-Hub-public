import assert from 'node:assert/strict';
import {
  AGENT_TOOL_INPUT_PARAM_SPECS,
  runAgentProductionSession,
  type AgentChatCommand,
} from '../src/agent/legacy/index.ts';
import { executeSummarizeVisualSnapshot } from '../src/agent/agentRuntimeVisualTools.ts';
import { desktopPetShellRuntime } from '../src/desktopShellRuntime.ts';
import { type PetConfig } from '../src/types.ts';
import {
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  prematureActionConfirmationSignal: prematureActionConfirmationSignalSource,
  registry: registrySource,
  runtime: runtimeSource,
  session: sessionSource,
  toolResultSummary: toolResultSummarySource,
  visualRuntime: visualRuntimeSource,
  visualSnapshotService: visualSnapshotServiceSource,
} = readProjectSources({
  prematureActionConfirmationSignal: 'src/agent/runtime/agentDecisionRejectionSignals.ts',
  registry: 'src/agent/agentToolRegistry.ts',
  runtime: 'src/agent/agentRuntimeExecutor.ts',
  session: 'src/agent/agentProductionSessionImplementation.ts',
  toolResultSummary: 'src/agent/runtime/agentToolResultSummary.ts',
  visualRuntime: 'src/agent/agentRuntimeVisualTools.ts',
  visualSnapshotService: 'src/services/agentVisualSnapshotService.ts',
});

assertSourceMatches(sessionSource, /in-app UI operation/u);
assertSourceMatches(sessionSource, /sourceQuery\/sourceId for A and targetText\/targetDescription for B/u);
assertSourceMatches(sessionSource, /primary open\/start\/play button associated with that target/u);
assertSourceMatches(registrySource, /sourceQuery/u);
assertSourceMatches(registrySource, /targetDescription/u);
assertSourceMatches(registrySource, /primary open\/start\/play button associated with that target/u);
assertSourceMatches(runtimeSource, /executeLocateScreenElements/u);
assertSourceMatches(visualRuntimeSource, /queryLooksLikeTarget/u);
assertSourceMatches(visualRuntimeSource, /primary open\/start\/play\/launch button/u);
assertSourceMatches(visualRuntimeSource, /targetMatched, primaryAction, elementRegion, relation, confidence/u);
assertSourceMatches(visualRuntimeSource, /Visual element center:/u);
assertSourceMatches(visualRuntimeSource, /elementCenterRatio/u);
assertSourceMatches(visualRuntimeSource, /Visual action readiness:/u);
assertSourceMatches(visualRuntimeSource, /formatVisualSnapshotCandidateLine/u);
assertSourceMatches(visualRuntimeSource, /Visual \$\{kind\} candidate/u);
assertSourceMatches(visualRuntimeSource, /createFocusedVisualSnapshotSource/u);
assertSourceMatches(visualRuntimeSource, /focusCenterRatioX/u);
assertSourceMatches(visualRuntimeSource, /needs-coordinate/u);
assertSourceMatches(visualRuntimeSource, /needs-relation/u);
assertSourceMatches(visualSnapshotServiceSource, /targetCandidates/u);
assertSourceMatches(visualSnapshotServiceSource, /actionCandidates/u);
assertSourceMatches(sessionSource, /prefer elementCenter coordinates over natural-language regions/u);
assertSourceMatches(sessionSource, /focusCenterRatioX\/focusCenterRatioY/u);
assertSourceMatches(sessionSource, /resolveAgentSessionV2RatioPointFromSourceBounds/u);

const locateSchema = AGENT_TOOL_INPUT_PARAM_SPECS.locate_screen_elements;
assert.equal(locateSchema.some((spec) => spec.key === 'sourceQuery'), true);
assert.equal(locateSchema.some((spec) => spec.key === 'targetDescription'), true);
assert.equal(locateSchema.some((spec) => spec.key === 'focusCenterRatioX'), true);
const visualSummarySchema = AGENT_TOOL_INPUT_PARAM_SPECS.summarize_visual_snapshot;
assert.equal(visualSummarySchema.some((spec) => spec.key === 'focusCenterRatioX'), true);

const settings = {} as PetConfig['settings'];

let directLocateModelCallCount = 0;
const directLocateResult = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ systemInstruction, userInput }) => {
    directLocateModelCallCount += 1;
    assert.match(systemInstruction, /in-app UI operation/u);
    assert.match(systemInstruction, /locate_screen_elements/u);
    assert.match(systemInstruction, /execute_desktop_sequence/u);

    if (directLocateModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'locate_element',
          sourceQuery: 'Launcher',
          sourceType: 'window',
          targetDescription: 'Game and its associated launch button',
        },
        reason: 'Need visual evidence inside the launcher before clicking the launch button.',
        tool: 'locate_screen_elements',
        understanding: {
          neededCapability: 'in-app UI target location',
          successCriteria: 'the launcher target and its associated launch button are located before input',
          userNeed: 'open Game inside Launcher',
        },
      });
    }

    assert.match(userInput, /tool=locate_screen_elements/u);
    assert.match(userInput, /elementCenter=1715,1050/u);
    assert.match(userInput, /target=Game/u);
    assert.match(userInput, /primaryAction=Launch button/u);
    assert.match(userInput, /relation=Launch button belongs to the selected Game page/u);
    assert.match(userInput, /elementRegion=bottom right/u);

    return JSON.stringify({
      action: 'tool_call',
      args: {
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              x: 1715,
              y: 1050,
            },
            reason: 'Click the visually located primary launch button for the selected target.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      reason: 'The visual target and primary action are clear, so request one approval for the click.',
      tool: 'execute_desktop_sequence',
      understanding: {
        neededCapability: 'approved desktop input sequence',
        successCriteria: 'permission UI is shown before clicking the launcher primary action',
        userNeed: 'open Game inside Launcher',
      },
    });
  },
  settings,
  sourceText: '/agent open Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    if (command.toolCall?.name === 'locate_screen_elements') {
      assert.equal(command.capabilityId, 'desktop-observation');
      assert.equal(command.toolCall.input.sourceQuery, 'Launcher');
      assert.equal(command.toolCall.input.targetDescription, 'Game and its associated launch button');
      return {
        observations: [
          'Screen element locate action: locate_element',
          'Source query: Launcher',
          'Target element: Game and its associated launch button',
          'Visual target matched: Game',
          'Visual primary action: Launch button',
          'Visual element region: bottom right, button center around x=1715 y=1050',
          'Visual target/action relation: Launch button belongs to the selected Game page',
          'Visual confidence: 0.86',
        ],
        ok: true,
        responseText: [
          'Screen element observation (locate_element):',
          'Visual target matched: Game',
          'Visual primary action: Launch button',
          'Visual element region: bottom right, button center around x=1715 y=1050',
          'Visual target/action relation: Launch button belongs to the selected Game page',
        ].join('\n'),
        stateSummary: {
          observedState: [
            'Visual target matched: Game',
            'Visual primary action: Launch button',
            'Visual element region: bottom right, button center around x=1715 y=1050',
            'Visual target/action relation: Launch button belongs to the selected Game page',
          ],
          structuredEvidence: {
            confidence: 'high',
            coordinateConfidence: 'high',
            elementCenter: {
              coordinateSpace: 'native-screen',
              source: 'test',
              x: 1715,
              y: 1050,
            },
            elementRegion: 'bottom right, button center around x=1715 y=1050',
            primaryAction: 'Launch button',
            relation: 'Launch button belongs to the selected Game page',
            status: 'success',
            visualActionReadiness: 'ready',
            targetMatched: 'Game',
          },
          verificationEvidence: ['Visual confidence: 0.86'],
        },
        verification: 'locate_screen_elements used the configured vision snapshot path.',
      };
    }

    throw new Error('execute_desktop_sequence should pause for approval before running');
  },
  userGoal: 'open Game inside Launcher',
});

assert.equal(directLocateModelCallCount, 1);
assert.equal(directLocateResult.status, 'needs-approval');
assert.equal(directLocateResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(directLocateResult.pendingApproval?.command.toolCall?.input.stepsJson), /execute_desktop_input/u);
assert.match(directLocateResult.continuation.historyLines.join('\n'), /prepared visual-action approval/u);

assertSourceMatches(visualRuntimeSource, /getVisualSnapshotWindowIdPrefix/u);
assertSourceMatches(visualRuntimeSource, /prefixMatchedSource/u);
assertSourceMatches(visualRuntimeSource, /enrichLocateScreenElementsMissingPrimaryAction/u);
assertSourceMatches(visualRuntimeSource, /did not identify a clear primary action button/u);
assertSourceMatches(sessionSource, /'locate_screen_elements'/u);
assertSourceMatches(sessionSource, /Do not invent a capture sourceId from hwnd\/pid\/window observations/u);

const originalListCaptureSources = desktopPetShellRuntime.listCaptureSources;
try {
  desktopPetShellRuntime.listCaptureSources = async () => [
    {
      displayId: null,
      height: 720,
      id: 'window:1510602:1',
      name: 'Launcher',
      thumbnail: '',
      type: 'window',
      width: 1280,
    },
  ] as any;

  const prefixFallbackResult = await executeSummarizeVisualSnapshot(
    {
      configRef: { current: { settings } },
      desktopOrganizationRef: { current: null },
      lastDesktopOrganizationPlanRef: { current: null },
      lastLocalProjectInspectionRef: { current: null },
      onUpdateConfig: () => undefined,
      startDesktopIconPlacementRef: { current: null },
      voiceInputControllerRef: { current: null },
    } as any,
    {
      goal: 'test source id prefix fallback',
      input: {
        sourceId: 'window:1510602:0',
        sourceType: 'window',
      },
      name: 'summarize_visual_snapshot',
    },
    '/agent inspect Launcher',
  );
  assert.match(prefixFallbackResult.errorText ?? '', /thumbnail/u);
  assert.match(prefixFallbackResult.observations?.join('\n') ?? '', /Selected visual source: \[window\] Launcher/u);

  desktopPetShellRuntime.listCaptureSources = async () => [
    {
      displayId: null,
      height: 720,
      id: 'window:999:0',
      name: 'Launcher',
      thumbnail: '',
      type: 'window',
      width: 1280,
    },
  ] as any;

  const queryFallbackResult = await executeSummarizeVisualSnapshot(
    {
      configRef: { current: { settings } },
      desktopOrganizationRef: { current: null },
      lastDesktopOrganizationPlanRef: { current: null },
      lastLocalProjectInspectionRef: { current: null },
      onUpdateConfig: () => undefined,
      startDesktopIconPlacementRef: { current: null },
      voiceInputControllerRef: { current: null },
    } as any,
    {
      goal: 'test source id query fallback',
      input: {
        query: 'Launcher',
        sourceId: 'window:1510602:0',
        sourceType: 'window',
      },
      name: 'summarize_visual_snapshot',
    },
    '/agent inspect Launcher',
  );
  assert.match(queryFallbackResult.errorText ?? '', /thumbnail/u);
  assert.match(queryFallbackResult.observations?.join('\n') ?? '', /Selected visual source: \[window\] Launcher/u);
} finally {
  desktopPetShellRuntime.listCaptureSources = originalListCaptureSources;
}

let unverifiedModelCallCount = 0;
const unverifiedRecoveryResult = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    unverifiedModelCallCount += 1;
    if (unverifiedModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'locate_element',
          sourceQuery: 'Launcher',
          sourceType: 'window',
          targetDescription: 'Game and its launch button',
        },
        reason: 'Need to locate the game and launch button inside the launcher.',
        tool: 'locate_screen_elements',
      });
    }

    if (unverifiedModelCallCount === 2) {
      return JSON.stringify({
        action: 'final_answer',
        message: 'I found the game item but no launch button.',
      });
    }

    assert.match(userInput, /rejected unverified recoverable tool final answer/u);
    assert.match(userInput, /primary action button/u);
    assert.match(userInput, /tool:execute_desktop_input/u);
    return JSON.stringify({
      action: 'ask_user',
      message: 'I can see the target item, but I have not verified a launch button yet. Should I select the item first and inspect again?',
    });
  },
  settings,
  sourceText: '/agent open Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return {
      followUp: 'Target was visible, but no primary launch button was verified.',
      observations: [
        'Visual target matched: Game',
        'Visual summary: Launcher page shows a side navigation item named Game, but no visible launch button.',
      ],
      ok: true,
      receipt: {
        evidenceLines: [
          'Visual target matched: Game',
          'No visible launch button.',
        ],
        status: 'unverified',
        summaryLines: ['Call: locate_screen_elements'],
        title: 'test',
        toolName: 'locate_screen_elements',
        verification: 'Missing primary action button.',
      },
      responseText: 'Visual target matched: Game. No visible launch button.',
      stateSummary: {
        missingEvidence: [
          'locate_screen_elements did not identify a clear primary action button for the requested in-app target.',
        ],
        recommendedRecovery: [
          'tool:execute_desktop_input',
          'tool:locate_screen_elements',
        ],
        structuredEvidence: {
          confidence: 'medium',
          primaryAction: null,
          status: 'unverified',
          targetMatched: 'Game',
          visualActionReadiness: 'needs-primary-action',
        },
      },
      verification: 'Missing primary action button.',
    };
  },
  userGoal: 'open Game inside Launcher',
});

assert.equal(unverifiedModelCallCount, 3);
assert.equal(unverifiedRecoveryResult.status, 'needs-user');
assert.match(unverifiedRecoveryResult.continuation.historyLines.join('\n'), /rejected unverified recoverable tool final answer/u);

let missingCoordinateModelCallCount = 0;
const missingCoordinateResult = await runAgentProductionSession({
  maxSteps: 5,
  modelCaller: async ({ userInput }) => {
    missingCoordinateModelCallCount += 1;
    if (missingCoordinateModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'locate_element',
          sourceQuery: 'Launcher',
          sourceType: 'window',
          targetDescription: 'Game and its launch button',
        },
        reason: 'Need visual evidence before clicking.',
        tool: 'locate_screen_elements',
      });
    }

    if (missingCoordinateModelCallCount === 2) {
      return JSON.stringify({
        action: 'final_answer',
        message: 'I found the launch button.',
      });
    }

    assert.match(userInput, /rejected unverified recoverable tool final answer/u);
    assert.match(userInput, /visualActionReadiness=needs-coordinate/u);
    assert.match(userInput, /usable screen coordinate/u);
    return JSON.stringify({
      action: 'ask_user',
      message: 'I can see the button, but I still need a usable coordinate before clicking.',
    });
  },
  settings,
  sourceText: '/agent open Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return {
      observations: [
        'Visual target matched: Game',
        'Visual primary action: Launch button',
        'Visual element region: bottom right of the launcher panel',
        'Visual action readiness: needs-coordinate',
      ],
      ok: true,
      responseText: 'Visual target matched: Game. Visual primary action: Launch button. Visual action readiness: needs-coordinate.',
      stateSummary: {
        missingEvidence: [
          'locate_screen_elements identified a primary action, but did not resolve a usable screen coordinate or elementBounds for safe input.',
        ],
        recommendedRecovery: [
          'Rerun locate_screen_elements with forceRefresh: true and request elementCenterRatio or elementCenter for the primary action.',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'low',
          elementRegion: 'bottom right of the launcher panel',
          primaryAction: 'Launch button',
          relation: 'Launch button belongs to the selected Game page',
          status: 'unverified',
          targetMatched: 'Game',
          visualActionReadiness: 'needs-coordinate',
        },
      },
      verification: 'Missing usable input coordinate.',
    };
  },
  userGoal: 'open Game inside Launcher',
});

assert.equal(missingCoordinateModelCallCount, 3);
assert.equal(missingCoordinateResult.status, 'needs-user');
assert.match(missingCoordinateResult.continuation.historyLines.join('\n'), /visualActionReadiness=needs-coordinate/u);

let visualApprovalModelCallCount = 0;
const visualApprovalResult = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async () => {
    visualApprovalModelCallCount += 1;
    if (visualApprovalModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'locate_element',
          sourceQuery: 'Launcher',
          sourceType: 'window',
          targetDescription: 'Game and its launch button',
        },
        reason: 'Need the launch target and button coordinates first.',
        tool: 'locate_screen_elements',
      });
    }

    throw new Error('clear visual action evidence should prepare approval without a second model decision');
  },
  settings,
  sourceText: '/agent open Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    if (command.toolCall?.name === 'locate_screen_elements') {
      return {
        observations: [
          'Visual target matched: Game',
          'Visual primary action: Launch button',
          'Visual element region: bottom right, button center around x=1715 y=1050',
        ],
        ok: true,
        responseText: 'Screen element observation: Game launch button is visible.',
        stateSummary: {
          observedState: [
            'Visual target matched: Game',
            'Visual primary action: Launch button',
            'Visual element region: bottom right, button center around x=1715 y=1050',
          ],
          structuredEvidence: {
            confidence: 'high',
            coordinateConfidence: 'high',
            elementCenter: {
              coordinateSpace: 'native-screen',
              source: 'test',
              x: 1715,
              y: 1050,
            },
            elementRegion: 'bottom right, button center around x=1715 y=1050',
            primaryAction: 'Launch button',
            relation: 'Launch button belongs to the selected Game page',
            status: 'success',
            targetMatched: 'Game',
            visualActionReadiness: 'ready',
          },
          verificationEvidence: ['Visual confidence: 0.88'],
        },
        verification: 'locate_screen_elements verified the target and launch button.',
      };
    }

    throw new Error('should stop at visual-action approval before any click runs');
  },
  userGoal: 'open Game inside Launcher',
});

assert.equal(visualApprovalModelCallCount, 1);
assert.equal(visualApprovalResult.status, 'needs-approval');
assert.equal(visualApprovalResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(visualApprovalResult.pendingApproval?.command.toolCall?.input.stepsJson), /execute_desktop_input/u);
assert.match(visualApprovalResult.continuation.historyLines.join('\n'), /prepared visual-action approval/u);

let prematureAskModelCallCount = 0;
const prematureAskResult = await runAgentProductionSession({
  maxSteps: 5,
  modelCaller: async ({ userInput }) => {
    prematureAskModelCallCount += 1;

    if (prematureAskModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'locate_element',
          sourceQuery: 'Launcher',
          sourceType: 'window',
          targetDescription: 'Game and its launch button',
        },
        reason: 'Need to locate the target item and its launch button inside the launcher.',
        tool: 'locate_screen_elements',
      });
    }

    if (prematureAskModelCallCount === 2) {
      assert.match(userInput, /tool=locate_screen_elements/u);
      assert.match(userInput, /target=Game/u);
      assert.match(userInput, /primaryAction=Launch button/u);
      assert.match(userInput, /elementRegion=bottom right/u);
      assert.match(userInput, /elementCenterRatio=0.893,0.729/u);
      return JSON.stringify({
        action: 'ask_user',
        message: 'The launch button is ready. Do you want me to click it?',
      });
    }

    assert.match(userInput, /rejected premature action confirmation/u);
    assert.match(userInput, /approval-required desktop input\/sequence tool/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        stepsJson: JSON.stringify([
          {
            args: {
              action: 'click',
              x: 1715,
              y: 1050,
            },
            reason: 'Click the visually located launch button.',
            tool: 'execute_desktop_input',
          },
        ]),
      },
      reason: 'The original user request already asked to launch it; request one app permission before clicking.',
      tool: 'execute_desktop_sequence',
    });
  },
  settings,
  sourceText: '/agent open Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    if (command.toolCall?.name === 'locate_screen_elements') {
      return {
        observations: [
          'Visual target matched: Game',
          'Visual primary action: Launch button',
          'Visual element region: bottom right, button center around x=1715 y=1050',
          'Visual target/action relation: Launch button belongs to the selected Game page',
          'Visual confidence: 0.88',
        ],
        ok: true,
        responseText: 'Screen element observation: Game launch button is visible.',
        stateSummary: {
          observedState: [
            'Visual target matched: Game',
            'Visual primary action: Launch button',
            'Visual element region: bottom right of the launcher panel',
          ],
          structuredEvidence: {
            confidence: 'high',
            coordinateConfidence: 'high',
            elementCenterRatio: {
              coordinateSpace: 'source-ratio',
              source: 'test',
              x: 0.893,
              y: 0.729,
            },
            elementRegion: 'bottom right of the launcher panel',
            primaryAction: 'Launch button',
            relation: 'Launch button belongs to the selected Game page',
            sourceBounds: {
              coordinateSpace: 'native-screen',
              height: 1440,
              source: 'test',
              width: 1920,
              x: 0,
              y: 0,
            },
            status: 'success',
            targetMatched: 'Game',
            visualActionReadiness: 'ready',
          },
          verificationEvidence: ['Visual confidence: 0.88'],
        },
        verification: 'locate_screen_elements verified the target and launch button.',
      };
    }

    throw new Error('execute_desktop_sequence should pause for approval before running');
  },
  userGoal: 'open Game inside Launcher',
});

assert.equal(prematureAskModelCallCount, 1);
assert.equal(prematureAskResult.status, 'needs-approval');
assert.equal(prematureAskResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(prematureAskResult.pendingApproval?.command.toolCall?.input.stepsJson), /1715/u);
assert.match(prematureAskResult.continuation.historyLines.join('\n'), /prepared visual-action approval/u);

let ambiguousCandidateModelCallCount = 0;
const ambiguousCandidateResult = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    ambiguousCandidateModelCallCount += 1;
    if (ambiguousCandidateModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'locate_element',
          sourceQuery: 'Launcher',
          sourceType: 'window',
          targetDescription: 'Game and its primary launch button',
        },
        reason: 'Need visual candidates before selecting an in-app action.',
        tool: 'locate_screen_elements',
      });
    }

    assert.match(userInput, /targetCandidates=1:Game/u);
    assert.match(userInput, /actionCandidates=1:Install/u);
    assert.match(userInput, /2:Launch/u);
    assert.match(userInput, /visualActionReadiness=needs-primary-action/u);
    assert.match(userInput, /Use the actionCandidates evidence/u);
    return JSON.stringify({
      action: 'ask_user',
      message: 'I see two possible buttons. Should I use Launch or Install?',
    });
  },
  settings,
  sourceText: '/agent open Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    return {
      observations: [
        'Visual target candidate 1: Game | confidence=medium | region=center list',
        'Visual action candidate 1: Install | confidence=medium | region=left button',
        'Visual action candidate 2: Launch | confidence=medium | region=right button',
        'Visual action readiness: needs-primary-action',
      ],
      ok: true,
      responseText: 'Visual returned multiple possible action candidates for Game.',
      stateSummary: {
        missingEvidence: [
          'Visual returned action candidates, but no single primary open/start/play/launch action was identified.',
        ],
        recommendedRecovery: [
          'Use the actionCandidates evidence to choose the likely primary action, rerun locate_screen_elements for the target detail area, or ask one short confirmation question.',
        ],
        structuredEvidence: {
          actionCandidates: [
            {
              confidence: 'medium',
              label: 'Install',
              region: 'left button',
            },
            {
              confidence: 'medium',
              label: 'Launch',
              region: 'right button',
            },
          ],
          confidence: 'medium',
          primaryAction: null,
          status: 'unverified',
          targetCandidates: [
            {
              confidence: 'medium',
              label: 'Game',
              region: 'center list',
            },
          ],
          targetMatched: 'Game',
          visualActionReadiness: 'needs-primary-action',
        },
      },
      verification: 'Multiple action candidates were visible, but no primary action was verified.',
    };
  },
  userGoal: 'open Game inside Launcher',
});

assert.equal(ambiguousCandidateModelCallCount, 2);
assert.equal(ambiguousCandidateResult.status, 'needs-user');
assert.equal(ambiguousCandidateResult.pendingApproval ?? null, null);

let focusedCandidateModelCallCount = 0;
let focusedCandidateToolCallCount = 0;
const focusedCandidateResult = await runAgentProductionSession({
  maxSteps: 5,
  modelCaller: async () => {
    focusedCandidateModelCallCount += 1;
    if (focusedCandidateModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'locate_element',
          sourceQuery: 'Launcher',
          sourceType: 'window',
          targetDescription: 'Game and its primary launch button',
        },
        reason: 'Need visual candidates before selecting an in-app action.',
        tool: 'locate_screen_elements',
      });
    }

    throw new Error('focused candidate should be refined automatically before a second model call');
  },
  settings,
  sourceText: '/agent open Game inside Launcher',
  toolExecutor: async (command: AgentChatCommand) => {
    assert.equal(command.toolCall?.name, 'locate_screen_elements');
    focusedCandidateToolCallCount += 1;

    if (focusedCandidateToolCallCount === 1) {
      return {
        observations: [
          'Visual target matched: Game',
          'Visual action candidate 1: Launch | confidence=medium | region=lower right | centerRatio=0.820,0.760',
          'Visual action readiness: needs-primary-action',
        ],
        ok: true,
        responseText: 'Visual returned a likely launch candidate, but the target/action relation is still unclear.',
        stateSummary: {
          missingEvidence: [
            'Visual returned action candidates, but no single primary open/start/play/launch action was identified.',
          ],
          recommendedRecovery: [
            'Use the actionCandidates centerRatio/bounds/region evidence to rerun locate_screen_elements with focus crop params around the likely primary action, rerun for the target detail area, or ask one short confirmation question.',
          ],
          structuredEvidence: {
            actionCandidates: [
              {
                centerRatio: {
                  coordinateSpace: 'source-ratio',
                  source: 'test',
                  x: 0.82,
                  y: 0.76,
                },
                confidence: 'medium',
                label: 'Launch',
                region: 'lower right',
              },
            ],
            confidence: 'medium',
            primaryAction: null,
            status: 'unverified',
            targetMatched: 'Game',
            visualActionReadiness: 'needs-primary-action',
          },
        },
        verification: 'Candidate button needs focused visual observation.',
      };
    }

    assert.equal(command.toolCall.input.focusCenterRatioX, 0.82);
    assert.equal(command.toolCall.input.focusCenterRatioY, 0.76);
    assert.equal(command.toolCall.input.forceRefresh, true);
    assert.match(String(command.toolCall.input.question), /AgentSessionV2 visual refinement/u);
    return {
      observations: [
        'Visual focus crop: focus crop 700,460,360x220 from 1280x720 screenBounds=700,460,360x220',
        'Visual target matched: Game',
        'Visual primary action: Launch button',
        'Visual target/action relation: Launch button belongs to the selected Game page',
        'Visual element center ratio: x=0.500 y=0.520',
        'Visual action readiness: ready',
      ],
      ok: true,
      responseText: 'Focused visual crop verified the Game launch button.',
      stateSummary: {
        observedState: [
          'Visual focus crop: focus crop 700,460,360x220 from 1280x720 screenBounds=700,460,360x220',
          'Visual target matched: Game',
          'Visual primary action: Launch button',
        ],
        structuredEvidence: {
          confidence: 'high',
          coordinateConfidence: 'high',
          elementCenterRatio: {
            coordinateSpace: 'source-ratio',
            source: 'focused-crop-test',
            x: 0.5,
            y: 0.52,
          },
          elementRegion: 'center of focused crop',
          primaryAction: 'Launch button',
          relation: 'Launch button belongs to the selected Game page',
          sourceBounds: {
            coordinateSpace: 'native-screen',
            height: 220,
            source: 'focused-crop-test',
            width: 360,
            x: 700,
            y: 460,
          },
          status: 'success',
          targetMatched: 'Game',
          visualActionReadiness: 'ready',
        },
        verificationEvidence: ['Focused crop visual confidence: 0.91'],
      },
      verification: 'Focused crop verified the target/action relation and usable coordinate.',
    };
  },
  userGoal: 'open Game inside Launcher',
});

assert.equal(focusedCandidateModelCallCount, 1);
assert.equal(focusedCandidateToolCallCount, 2);
assert.equal(focusedCandidateResult.status, 'needs-approval');
assert.equal(focusedCandidateResult.pendingApproval?.command.toolCall?.name, 'execute_desktop_sequence');
assert.match(String(focusedCandidateResult.pendingApproval?.command.toolCall?.input.stepsJson), /880/u);
assert.match(String(focusedCandidateResult.pendingApproval?.command.toolCall?.input.stepsJson), /574/u);

console.log('agent session v2 in-app launch guidance smoke ok');
