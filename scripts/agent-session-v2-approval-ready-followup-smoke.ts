import assert from 'node:assert/strict';
import {
  runAgentProductionSession,
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentDesktopOrganizationCommand,
  type AgentSessionV2ModelCaller,
} from '../src/agent/legacy/index.ts';
import { executeDesktopOrganization } from '../src/agent/agentRuntimeDesktopOrganizationTools.ts';
import {
  findLatestPendingAgentApprovalMessage,
  resolveAgentApprovalDecisionFromText,
} from '../src/components/chat/agentRunController.ts';
import { type ChatMessage, type PetConfig } from '../src/types.ts';

const settings = {} as PetConfig['settings'];

function createDesktopExecuteCommand(
  sourceText: string,
  organization: Partial<AgentDesktopOrganizationCommand> = {},
): AgentChatCommand {
  return {
    capabilityId: 'desktop-organization',
    desktopOrganization: {
      displayTarget: organization.displayTarget ?? 'secondary',
      groupBy: organization.groupBy,
      mode: 'execute',
      scope: organization.scope ?? 'display-icons',
    },
    instruction: 'execute the prepared desktop organization plan',
    kind: 'desktop-organization',
    sourceText,
  };
}

function createDesktopPreviewResult(
  sourceText: string,
  options: {
    includeOk?: boolean;
    organization?: Partial<AgentDesktopOrganizationCommand>;
  } = {},
): AgentChatCommandResult {
  const executeCommand = createDesktopExecuteCommand(sourceText, options.organization);
  const result: AgentChatCommandResult = {
    followUp: 'Plan is ready and can be executed after approval.',
    followUpAction: {
      command: executeCommand,
      kind: 'run-command',
      label: 'Execute plan',
      requiresApproval: true,
    },
    followUpActions: [
      {
        command: executeCommand,
        kind: 'run-command',
        label: 'Execute plan',
        requiresApproval: true,
      },
    ],
    observations: [
      'Secondary display LC34G55T has 25 icons.',
      'Prepared 7 x 4 desktop icon layout.',
    ],
    previewSummaryLines: [
      'Secondary display LC34G55T has 25 icons.',
      'Prepared a 7 x 4 desktop icon layout.',
    ],
    responseText: 'Secondary display LC34G55T has 25 icons; prepared a 7 x 4 layout.',
    verification: 'preview plan prepared without moving icons',
  };

  if (options.includeOk !== false) {
    result.ok = true;
  }

  return result;
}

const directOrganizeResult = await runAgentProductionSession({
  modelCaller: async () => JSON.stringify({
    action: 'tool_call',
    args: {
      mode: 'preview',
      sourceScope: 'display-icons',
      targetDisplay: 'secondary',
    },
    reason: 'Need a desktop icon arrangement preview before moving icons.',
    tool: 'organize_desktop_icons',
    understanding: {
      neededCapability: 'desktop icon organization',
      remainingGoals: ['execute desktop icon organization'],
      successCriteria: 'secondary display icons are arranged after user approves the move',
      userNeed: 'user wants the secondary screen desktop icons organized',
      verificationStatus: 'unknown',
    },
  }),
  settings,
  sourceText: '/agent organize secondary desktop icons',
  toolExecutor: async () => createDesktopPreviewResult('continue: execute plan'),
  userGoal: 'organize secondary desktop icons',
});

assert.equal(directOrganizeResult.status, 'needs-approval');
assert.equal(directOrganizeResult.pendingApproval?.command.kind, 'desktop-organization');
assert.equal(directOrganizeResult.pendingApproval?.command.desktopOrganization?.mode, 'execute');
assert.match(directOrganizeResult.continuation.historyLines.join('\n'), /approval-ready follow-up/u);

const runtimePreviewResult = await executeDesktopOrganization(
  {
    desktopOrganizationRef: {
      current: {
        preview: () => ({
          observations: ['Preview prepared text-only layout.'],
          ok: true,
          responseText: 'I only prepared an observation and organization plan; no icons have been moved.',
          started: true,
          verification: 'preview plan prepared without moving icons',
        }),
        start: () => ({
          ok: true,
          responseText: 'unexpected execute',
          started: true,
        }),
      },
    },
    lastDesktopOrganizationPlanRef: { current: null },
    startDesktopIconPlacementRef: { current: null },
  },
  {
    groupBy: 'category',
    mode: 'preview',
    scope: 'display-icons',
  },
  '/agent organize desktop',
);

assert.equal(runtimePreviewResult.ok, true);
assert.equal(runtimePreviewResult.receipt?.status, 'unverified');
assert.ok(runtimePreviewResult.stateSummary?.missingEvidence?.includes('missing:desktop-organization-plan'));
assert.ok(runtimePreviewResult.stateSummary?.recommendedRecovery?.includes('tool:organize_desktop_icons mode=preview'));
assert.match(runtimePreviewResult.receipt?.evidenceLines?.join('\n') ?? '', /did not prepare an executable plan/u);

let textOnlyPreviewFinalModelCallCount = 0;
const textOnlyPreviewFinalResult = await runAgentProductionSession({
  maxSteps: 3,
  modelCaller: async ({ userInput }) => {
    textOnlyPreviewFinalModelCallCount += 1;

    if (textOnlyPreviewFinalModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          groupBy: 'category',
          mode: 'preview',
          sourceScope: 'display-icons',
        },
        reason: 'Prepare desktop organization plan before moving icons.',
        tool: 'organize_desktop_icons',
      });
    }

    if (textOnlyPreviewFinalModelCallCount === 2) {
      return JSON.stringify({
        action: 'final_answer',
        message: '桌面已经整理好了。',
        understanding: {
          completedGoals: ['organized desktop'],
          remainingGoals: [],
          successCriteria: 'Desktop icons are moved into an organized layout.',
          userNeed: 'organize desktop',
          verificationEvidence: ['tool returned ok'],
          verificationGaps: [],
          verificationStatus: 'satisfied',
        },
      });
    }

    assert.match(userInput, /unverified recoverable|missing:desktop-organization-plan|preview/iu);
    return JSON.stringify({
      action: 'final_answer',
      message: '我只完成了桌面整理预览，还没有移动图标；需要重新生成可执行计划或执行计划后才能说整理完成。',
      understanding: {
        blockedGoals: ['execute desktop icon organization'],
        completedGoals: ['previewed desktop organization'],
        remainingGoals: [],
        successCriteria: 'Desktop icons are moved into an organized layout.',
        userNeed: 'organize desktop',
        verificationEvidence: ['Preview mode did not move icons.'],
        verificationGaps: ['No executable desktop organization plan was produced.'],
        verificationStatus: 'blocked',
      },
    });
  },
  settings,
  sourceText: '/agent 整理桌面',
  toolExecutor: async () => runtimePreviewResult,
  userGoal: '整理桌面',
});

assert.equal(textOnlyPreviewFinalModelCallCount, 3);
assert.notEqual(textOnlyPreviewFinalResult.finalAnswer, '桌面已经整理好了。');
assert.match(textOnlyPreviewFinalResult.continuation.historyLines.join('\n'), /rejected unverified recoverable tool final answer/u);

let stagedModelCallCount = 0;
const stagedObservationResult = await runAgentProductionSession({
  modelCaller: async ({ userInput }) => {
    stagedModelCallCount += 1;

    if (stagedModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          action: 'list_desktop_items',
          groupBy: 'category',
        },
        reason: 'First inspect desktop item categories.',
        tool: 'execute_desktop_observation',
      });
    }

    if (stagedModelCallCount === 2) {
      return JSON.stringify({
        action: 'final_answer',
        message: 'I have inspected the desktop categories.',
      });
    }

    assert.match(userInput, /rejected unverified recoverable tool final answer/iu);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        groupBy: 'category',
        mode: 'preview',
      },
      reason: 'Inventory alone does not complete desktop organization.',
      tool: 'organize_desktop_icons',
    });
  },
  settings,
  sourceText: '/agent organize desktop icons by category',
  toolExecutor: async (command) => {
    if (command.toolCall?.name === 'execute_desktop_observation') {
      return {
        observations: [
          'Desktop item observation groupBy: category',
          'Desktop item groups: images 3, documents 4',
        ],
        ok: true,
        responseText: 'Desktop has image and document items.',
        verification: 'Observed 7 desktop item(s) with groupBy=category.',
      };
    }

    if (command.toolCall?.name === 'organize_desktop_icons') {
      return createDesktopPreviewResult('continue: execute category organization plan', {
        organization: {
          groupBy: command.toolCall.input.groupBy as AgentDesktopOrganizationCommand['groupBy'],
        },
      });
    }

    throw new Error(`unexpected staged desktop organization tool: ${command.toolCall?.name ?? command.kind}`);
  },
  userGoal: 'organize desktop icons by category',
});

assert.equal(stagedModelCallCount, 3);
assert.equal(stagedObservationResult.status, 'needs-approval');
assert.equal(stagedObservationResult.pendingApproval?.command.desktopOrganization?.groupBy, 'category');
assert.match(stagedObservationResult.continuation.historyLines.join('\n'), /rejected unverified recoverable tool final answer/iu);

let prematurePreviewFinalModelCallCount = 0;
const prematurePreviewFinalResult = await runAgentProductionSession({
  maxSteps: 4,
  modelCaller: async ({ userInput }) => {
    prematurePreviewFinalModelCallCount += 1;
    if (prematurePreviewFinalModelCallCount === 1) {
      return JSON.stringify({
        action: 'tool_call',
        args: {
          groupBy: 'category',
          mode: 'preview',
        },
        reason: 'Prepare desktop organization plan before moving icons.',
        tool: 'organize_desktop_icons',
        understanding: {
          remainingGoals: ['execute desktop icon organization'],
          successCriteria: 'Desktop icons are actually moved into the organized layout after approval.',
          userNeed: 'organize desktop',
          verificationGaps: ['Need preview and execute approval.'],
          verificationStatus: 'unknown',
        },
      });
    }

    if (prematurePreviewFinalModelCallCount === 2) {
      return JSON.stringify({
        action: 'final_answer',
        message: 'Desktop has been organized.',
        understanding: {
          completedGoals: ['prepared desktop organization preview'],
          remainingGoals: [],
          successCriteria: 'Desktop icons are actually moved into the organized layout after approval.',
          userNeed: 'organize desktop',
          verificationEvidence: ['preview plan prepared without moving icons'],
          verificationGaps: [],
          verificationStatus: 'satisfied',
        },
      });
    }

    assert.match(userInput, /rejected premature final answer/u);
    assert.match(userInput, /desktop organization/u);
    return JSON.stringify({
      action: 'tool_call',
      args: {
        groupBy: 'category',
        mode: 'preview',
      },
      reason: 'Preview is not execution; surface the approval-ready execute step.',
      tool: 'organize_desktop_icons',
      understanding: {
        completedGoals: ['prepared desktop organization preview'],
        remainingGoals: ['execute desktop icon organization after approval'],
        successCriteria: 'Desktop icons are actually moved into the organized layout after approval.',
        userNeed: 'organize desktop',
        verificationEvidence: ['preview plan prepared without moving icons'],
        verificationGaps: ['Need approval-required execute step.'],
        verificationStatus: 'partial',
      },
    });
  },
  settings,
  sourceText: '/agent organize desktop',
  toolExecutor: async (command) => {
    assert.equal(command.toolCall?.name, 'organize_desktop_icons');
    assert.equal(command.toolCall.input.mode, 'preview');
    return createDesktopPreviewResult('continue: execute desktop organization plan', {
      organization: {
        groupBy: command.toolCall.input.groupBy as AgentDesktopOrganizationCommand['groupBy'],
      },
    });
  },
  userGoal: 'organize desktop',
});

assert.equal(prematurePreviewFinalResult.status, 'needs-approval');
assert.equal(prematurePreviewFinalResult.pendingApproval?.command.desktopOrganization?.mode, 'execute');
assert.equal(prematurePreviewFinalModelCallCount, 1);
assert.match(prematurePreviewFinalResult.continuation.historyLines.join('\n'), /approval-ready follow-up/u);

let previewOnlyModelCallCount = 0;
const previewOnlyModelCaller: AgentSessionV2ModelCaller = async ({ userInput }) => {
  previewOnlyModelCallCount += 1;
  if (previewOnlyModelCallCount === 1) {
    return JSON.stringify({
      action: 'tool_call',
      args: {
        mode: 'preview',
        sourceScope: 'display-icons',
        targetDisplay: 'secondary',
      },
      reason: 'User asked for preview-only desktop organization planning.',
      tool: 'organize_desktop_icons',
    });
  }

  assert.match(userInput, /tool result/iu);
  assert.match(userInput, /25/u);
  throw new Error('preview-only evidence must terminate without a second model call');
};

const previewOnlyResult = await runAgentProductionSession({
  modelCaller: previewOnlyModelCaller,
  settings,
  sourceText: '/agent preview secondary desktop organization plan only',
  toolExecutor: async () => createDesktopPreviewResult('continue: execute plan'),
  userGoal: 'preview secondary desktop organization plan only',
});

assert.equal(previewOnlyModelCallCount, 1);
assert.equal(previewOnlyResult.status, 'completed');
assert.equal(previewOnlyResult.pendingApproval, null);
assert.equal(
  previewOnlyResult.finalAnswer,
  'Secondary display LC34G55T has 25 icons; prepared a 7 x 4 layout.',
);

assert.equal(resolveAgentApprovalDecisionFromText('可以执行'), 'approve');
assert.equal(resolveAgentApprovalDecisionFromText('执行吧'), 'approve');
assert.equal(resolveAgentApprovalDecisionFromText('先别执行'), 'deny');
assert.equal(resolveAgentApprovalDecisionFromText('等一下，先改计划'), null);

const messages = [
  {
    agentApproval: {
      command: createDesktopExecuteCommand('continue: execute plan'),
      id: 'old-approval',
      preview: {
        commandKind: 'desktop-organization',
        goal: 'old',
        instruction: 'old',
      },
      requestedAt: 1,
      status: 'completed',
    },
    agentRun: {
      pendingApproval: {
        command: createDesktopExecuteCommand('continue: execute plan'),
        id: 'old-approval',
        preview: {
          commandKind: 'desktop-organization',
          goal: 'old',
          instruction: 'old',
        },
        requestedAt: 1,
        status: 'completed',
      },
    },
    chatMode: 'single',
    id: 'old-approval',
    petId: 'primary',
    role: 'model',
    text: 'old',
  },
  {
    agentApproval: {
      command: createDesktopExecuteCommand('continue: execute plan'),
      id: 'pending-approval',
      preview: {
        commandKind: 'desktop-organization',
        goal: 'pending',
        instruction: 'pending',
      },
      requestedAt: 2,
      status: 'pending',
    },
    agentRun: {
      pendingApproval: {
        command: createDesktopExecuteCommand('continue: execute plan'),
        id: 'pending-approval',
        preview: {
          commandKind: 'desktop-organization',
          goal: 'pending',
          instruction: 'pending',
        },
        requestedAt: 2,
        status: 'pending',
      },
    },
    chatMode: 'single',
    id: 'pending-approval',
    petId: 'primary',
    role: 'model',
    text: 'pending',
  },
] satisfies ChatMessage[];

assert.equal(
  findLatestPendingAgentApprovalMessage(messages, {
    activePetId: 'primary',
    chatMode: 'single',
  })?.id,
  'pending-approval',
);

console.log('agent session v2 approval-ready followup smoke ok');
