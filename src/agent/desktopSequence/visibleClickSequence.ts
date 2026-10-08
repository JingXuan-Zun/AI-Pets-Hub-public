import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentToolCallCommand,
} from '../agentChatCommand';
import {
  type AgentRuntimeExecutorContext,
} from '../agentRuntimeExecutor';
import {
  executeDesktopAction,
} from '../agentRuntimeDesktopTools';
import {
  executeLocateScreenElements,
} from '../agentRuntimeVisualTools';
import {
  resolveAgentVisualExecutionStrategy,
} from '../agentExecutionStrategy';
import {
  getToolStringInput,
  isAgentRuntimeToolInputObject,
  type AgentRuntimeDesktopSequenceStep,
  getAgentRuntimeSequenceStepAction,
  createAgentRuntimeResult,
  inferAgentRuntimeToolResultOk,
} from './sequenceResultEvidence';
import {
  getAgentRuntimeDesktopSequenceFinalWindow,
} from './sequenceWindowTarget';
import {
  parseAgentRuntimeDesktopSequenceSteps,
  runAgentRuntimeDesktopSequenceSteps,
} from './sequenceExecution';

interface AgentRuntimeVisibleClickSpec {
  app: string;
  postVerify: string;
  requireActionable: boolean;
  requireSameHwnd: boolean;
  sourceHwnd: number | null;
  sourceWindowTitle: string;
  target: string;
  targetPoint: { x: number; y: number } | null;
  targetRole: string;
}

export function parseAgentRuntimeVisibleClickSpec(toolCall: AgentToolCallCommand): AgentRuntimeVisibleClickSpec | null {
  const rawJson = getToolStringInput(toolCall, ['visibleClickJson']);
  const rawInput = toolCall.input ?? {};
  let parsed: unknown = null;
  if (rawJson) {
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      parsed = null;
    }
  }

  const source = isAgentRuntimeToolInputObject(parsed) ? parsed : rawInput;
  const mode = typeof rawInput.mode === 'string' ? rawInput.mode.trim().toLowerCase() : '';
  const enabled = Boolean(rawJson) || mode === 'visible_click' || mode === 'visibleclick';
  if (!enabled) {
    return null;
  }

  const app = typeof source.app === 'string' && source.app.trim()
    ? source.app.trim()
    : typeof source.sourceWindowTitle === 'string' && source.sourceWindowTitle.trim()
      ? source.sourceWindowTitle.trim()
    : typeof source.sourceQuery === 'string' && source.sourceQuery.trim()
      ? source.sourceQuery.trim()
      : typeof source.windowQuery === 'string' && source.windowQuery.trim()
        ? source.windowQuery.trim()
        : '';
  const target = typeof source.target === 'string' && source.target.trim()
    ? source.target.trim()
    : typeof source.targetText === 'string' && source.targetText.trim()
      ? source.targetText.trim()
      : typeof source.targetDescription === 'string' && source.targetDescription.trim()
        ? source.targetDescription.trim()
        : '';
  const postVerify = typeof source.postVerify === 'string' && source.postVerify.trim()
    ? source.postVerify.trim()
    : typeof source.postVerifyQuery === 'string' && source.postVerifyQuery.trim()
      ? source.postVerifyQuery.trim()
      : `The ${target || 'target'} in ${app || 'the app'} changed state after the visible click.`;
  const sourceHwndRaw = source.sourceHwnd ?? source.hwnd ?? source.windowHandle;
  const sourceHwndNumber = typeof sourceHwndRaw === 'number'
    ? sourceHwndRaw
    : typeof sourceHwndRaw === 'string'
      ? Number(sourceHwndRaw.trim())
      : NaN;
  const targetXRaw = source.targetX ?? source.x;
  const targetYRaw = source.targetY ?? source.y;
  const targetX = typeof targetXRaw === 'number' ? targetXRaw : typeof targetXRaw === 'string' ? Number(targetXRaw.trim()) : NaN;
  const targetY = typeof targetYRaw === 'number' ? targetYRaw : typeof targetYRaw === 'string' ? Number(targetYRaw.trim()) : NaN;
  const sourceHwnd = Number.isFinite(sourceHwndNumber) && sourceHwndNumber > 0
    ? Math.round(sourceHwndNumber)
    : null;
  const targetPoint = Number.isFinite(targetX) && Number.isFinite(targetY)
    ? { x: Math.round(targetX), y: Math.round(targetY) }
    : null;
  const sourceWindowTitle = typeof source.sourceWindowTitle === 'string' ? source.sourceWindowTitle.trim() : app;
  const targetRole = typeof source.targetRole === 'string' ? source.targetRole.trim() : '';

  if ((!app && !sourceHwnd) || !target) {
    return {
      app,
      postVerify,
      requireActionable: true,
      requireSameHwnd: true,
      sourceHwnd,
      sourceWindowTitle,
      target,
      targetPoint,
      targetRole,
    };
  }

  return {
    app,
    postVerify,
    requireActionable: typeof source.requireActionable === 'boolean' ? source.requireActionable : true,
    requireSameHwnd: typeof source.requireSameHwnd === 'boolean' ? source.requireSameHwnd : true,
    sourceHwnd,
    sourceWindowTitle,
    target,
    targetPoint,
    targetRole,
  };
}

function parseAgentRuntimeVisibleClickStrategySteps(command: AgentChatCommand | undefined): AgentRuntimeDesktopSequenceStep[] | null {
  if (command?.toolCall?.name !== 'execute_desktop_sequence') {
    return null;
  }

  const stepsJson = typeof command.toolCall.input.stepsJson === 'string'
    ? command.toolCall.input.stepsJson
    : '';
  if (!stepsJson) {
    return null;
  }

  const parseResult = parseAgentRuntimeDesktopSequenceSteps({
    goal: command.toolCall.goal,
    input: { stepsJson },
    name: 'execute_desktop_sequence',
  });
  if (parseResult.ok === false) {
    return null;
  }

  const clickStep = parseResult.steps.find((step) => (
    step.tool === 'execute_desktop_input'
    && getAgentRuntimeSequenceStepAction(step) === 'click'
  ));
  if (!clickStep) {
    return null;
  }

  const focusSteps = parseResult.steps.filter((step) => (
    step.tool === 'execute_desktop_action'
    && getAgentRuntimeSequenceStepAction(step) === 'focus_window'
  ));
  return [
    ...focusSteps,
    {
      ...clickStep,
      args: {
        ...clickStep.args,
        forceMouseEventFallback: true,
        holdMs: typeof clickStep.args.holdMs === 'number' ? clickStep.args.holdMs : 140,
        intervalMs: typeof clickStep.args.intervalMs === 'number' ? clickStep.args.intervalMs : 160,
        preClickDelayMs: typeof clickStep.args.preClickDelayMs === 'number' ? clickStep.args.preClickDelayMs : 180,
        repeat: 1,
      },
      reason: `${clickStep.reason ?? 'Visible click coordinate action.'} VisibleClick mode intentionally runs one visible pointer click only; keyboard fallbacks are disabled for diagnosis.`,
    },
  ];
}

export async function executeAgentRuntimeVisibleClick(
  context: AgentRuntimeExecutorContext,
  toolCall: AgentToolCallCommand,
  spec: AgentRuntimeVisibleClickSpec,
): Promise<AgentChatCommandResult> {
  const inheritedTarget = Boolean(spec.sourceHwnd && spec.targetPoint);
  const prefix = `VisibleClick: app=${spec.app || spec.sourceWindowTitle || '<missing>'} target=${spec.target || '<missing>'} sourceHwnd=${spec.sourceHwnd ?? '<none>'} targetPoint=${spec.targetPoint ? `${spec.targetPoint.x},${spec.targetPoint.y}` : '<none>'} requireSameHwnd=${spec.requireSameHwnd} requireActionable=${spec.requireActionable}`;
  if ((!spec.app && !spec.sourceHwnd) || !spec.target) {
    return createAgentRuntimeResult({
      errorText: 'visibleClick requires both app and target.',
      observations: [prefix],
      ok: false,
      receipt: {
        evidenceLines: [prefix, 'visibleClick missing app or target'],
        status: 'failed',
        summaryLines: ['Call: execute_desktop_sequence', 'Mode: visible_click', 'Result: rejected before focus/locate'],
        title: 'Agent visible click',
        toolName: 'execute_desktop_sequence',
        verification: 'visibleClick requires both app and target.',
      },
      responseText: 'visibleClick requires both app and target.',
      verification: 'visibleClick requires both app and target.',
    });
  }

  const focusToolCall: AgentToolCallCommand = {
    goal: `VisibleClick focus ${spec.app || spec.sourceWindowTitle || `hwnd=${spec.sourceHwnd ?? 'unknown'}`}`,
    input: {
      action: 'focus_window',
      ...(spec.app ? { query: spec.app } : {}),
      ...(!spec.app && spec.sourceHwnd ? { hwnd: spec.sourceHwnd } : {}),
    },
    name: 'execute_desktop_action',
  };
  const focusResult = await executeDesktopAction(context, focusToolCall);
  const focusedWindow = getAgentRuntimeDesktopSequenceFinalWindow(focusResult);
  const focusedHwnd = Number(focusedWindow?.hwnd);
  const focusOk = inferAgentRuntimeToolResultOk(focusResult);
  const hasFocusedHwnd = Number.isFinite(focusedHwnd) && focusedHwnd > 0;
  const observations = [
    prefix,
    `VisibleClick focus ok=${focusOk}`,
    hasFocusedHwnd ? `VisibleClick focusedHwnd=${Math.round(focusedHwnd)}` : 'VisibleClick focusedHwnd=<none>',
  ];

  if (!focusOk || (spec.requireSameHwnd && !hasFocusedHwnd)) {
    const reason = !focusOk
      ? focusResult.errorText || focusResult.responseText || `Could not focus ${spec.app || spec.sourceWindowTitle}.`
      : `VisibleClick requires the current ${spec.app || spec.sourceWindowTitle} window HWND before dispatch.`;
    observations.push(`VisibleClick focusFailure=${reason}`);
    return createAgentRuntimeResult({
      errorText: reason,
      observations,
      ok: false,
      receipt: {
        evidenceLines: observations,
        status: 'failed',
        summaryLines: ['Call: execute_desktop_sequence', 'Mode: visible_click', 'Result: focus/HWND binding failed'],
        title: 'Agent visible click',
        toolName: 'execute_desktop_sequence',
        verification: reason,
      },
      responseText: `VisibleClick could not bind the target app/window: ${reason}`,
      verification: reason,
    });
  }

  const canReuseInheritedTarget = inheritedTarget
    && spec.targetPoint
    && spec.sourceHwnd
    && hasFocusedHwnd
    && focusedHwnd === spec.sourceHwnd;
  if (canReuseInheritedTarget && spec.targetPoint && spec.sourceHwnd) {
    observations.push(
      'VisibleClick target source=inherited actionable locate evidence',
      `VisibleClick expectedHwnd=${spec.sourceHwnd}`,
      `VisibleClick targetRole=${spec.targetRole || 'unknown'}`,
    );
    return runAgentRuntimeDesktopSequenceSteps(context, toolCall, [
      {
        args: {
          action: 'click',
          button: 'left',
          coordinateSpace: 'native-screen',
          expectedForegroundHwnd: spec.sourceHwnd,
          forceMouseEventFallback: true,
          holdMs: 140,
          intervalMs: 160,
          preClickDelayMs: 180,
          repeat: 1,
          x: spec.targetPoint.x,
          y: spec.targetPoint.y,
        },
        reason: `VisibleClick inherited target "${spec.target}" at (${spec.targetPoint.x}, ${spec.targetPoint.y}) in HWND ${spec.sourceHwnd}.`,
        tool: 'execute_desktop_input',
      },
    ], {
      observationPrefix: observations.join(' | '),
      postVerify: true,
      postVerifyHwnd: spec.sourceHwnd,
      postVerifyQuery: spec.app || spec.sourceWindowTitle,
      postVerifyRequired: false,
      postVerifyRequireSameHwnd: spec.requireSameHwnd,
      postVerifySourceQuery: spec.app || spec.sourceWindowTitle,
      postVerifyVisualQuery: spec.postVerify,
      stopOnError: true,
      summaryLabel: 'visible_click_inherited_target',
    });
  }

  if (inheritedTarget && spec.sourceHwnd && hasFocusedHwnd && focusedHwnd !== spec.sourceHwnd) {
    observations.push(
      `VisibleClick staleSourceHwnd=${spec.sourceHwnd}`,
      `VisibleClick reboundSourceHwnd=${focusedHwnd}`,
      'VisibleClick will re-locate the target because the dispatch-time window identity changed.',
    );
  }

  const locateToolCall: AgentToolCallCommand = {
    goal: `VisibleClick locate ${spec.target} in ${spec.app}`,
    input: {
      action: 'locate_element',
      allowScreenFallback: !spec.requireSameHwnd,
      hwnd: hasFocusedHwnd ? Math.round(focusedHwnd) : undefined,
      question: [
        `Find the visible clickable target "${spec.target}" inside the app/window "${spec.app}".`,
        'Prefer the exact focused window HWND as the capture source. Return actionable structured evidence with source bounds, element center, targetMatched, primaryAction, confidence, and visualActionReadiness=ready only when the target is clearly clickable.',
      ].join(' '),
      sourceQuery: spec.app,
      sourceId: hasFocusedHwnd ? `window:${Math.round(focusedHwnd)}:0` : undefined,
      sourceType: 'window',
      targetDescription: spec.target,
      targetText: spec.target,
    },
    name: 'locate_screen_elements',
  };
  const locateResult = await executeLocateScreenElements(context, locateToolCall, spec.target);
  const locateEvidence = locateResult.stateSummary?.structuredEvidence
    ?? locateResult.receipt?.stateSummary?.structuredEvidence
    ?? null;
  const captureStayedOnWindow = locateEvidence?.captureSourceType === 'window'
    && locateEvidence.captureFallback?.toSourceType !== 'screen'
    && locateEvidence.captureTrusted !== false;
  observations.push(
    `VisibleClick locate ok=${inferAgentRuntimeToolResultOk(locateResult)}`,
    `VisibleClick locateCaptureType=${locateEvidence?.captureSourceType ?? 'unknown'}`,
    `VisibleClick locateCaptureTrusted=${locateEvidence?.captureTrusted ?? 'unknown'}`,
    `VisibleClick locateFallback=${locateEvidence?.captureFallback?.toSourceType ?? 'none'}`,
  );
  if (spec.requireSameHwnd && !captureStayedOnWindow) {
    const reason = 'VisibleClick refused to dispatch because locate did not return trusted window-capture evidence for the requested HWND source.';
    observations.push(`VisibleClick sameHwndFailure=${reason}`);
    return createAgentRuntimeResult({
      errorText: reason,
      observations,
      ok: false,
      receipt: {
        evidenceLines: observations,
        status: 'failed',
        summaryLines: ['Call: execute_desktop_sequence', 'Mode: visible_click', 'Result: same-HWND locate evidence failed'],
        title: 'Agent visible click',
        toolName: 'execute_desktop_sequence',
        verification: reason,
      },
      responseText: reason,
      verification: reason,
    });
  }
  const locateCommand: AgentChatCommand = {
    capabilityId: 'desktop-observation',
    instruction: `VisibleClick locate ${spec.target} in ${spec.app}`,
    kind: 'tool-call',
    sourceText: toolCall.goal ?? `visibleClick ${spec.app} ${spec.target}`,
    toolCall: locateToolCall,
  };
  const strategy = resolveAgentVisualExecutionStrategy({
    command: locateCommand,
    result: locateResult,
    sourceText: locateCommand.sourceText,
    userGoal: spec.postVerify || `Click ${spec.target} in ${spec.app}`,
  });
  const strategySteps = parseAgentRuntimeVisibleClickStrategySteps(strategy.command);
  observations.push(
    `VisibleClick strategy=${strategy.kind}`,
    `VisibleClick strategyReason=${strategy.reason}`,
    ...strategy.diagnostics.map((line) => `VisibleClick ${line}`),
  );

  if (!strategySteps?.length || strategy.kind === 'none') {
    return createAgentRuntimeResult({
      assessment: {
        evidence: observations,
        nextStep: 'Refresh the window capture or refine the target description before clicking.',
        status: 'unverified',
        summary: `VisibleClick target is not actionable: ${strategy.reason}`,
      },
      errorText: spec.requireActionable ? `VisibleClick target is not actionable: ${strategy.reason}` : null,
      observations,
      ok: !spec.requireActionable,
      receipt: {
        evidenceLines: observations,
        status: spec.requireActionable ? 'failed' : 'unverified',
        summaryLines: ['Call: execute_desktop_sequence', 'Mode: visible_click', 'Result: target not actionable'],
        title: 'Agent visible click',
        toolName: 'execute_desktop_sequence',
        verification: `VisibleClick did not dispatch because target is not actionable: ${strategy.reason}`,
      },
      responseText: `VisibleClick did not dispatch because target is not actionable: ${strategy.reason}`,
      verification: `VisibleClick did not dispatch because target is not actionable: ${strategy.reason}`,
    });
  }

  const dispatchHwnd = hasFocusedHwnd ? Math.round(focusedHwnd) : null;
  return runAgentRuntimeDesktopSequenceSteps(context, toolCall, strategySteps, {
    observationPrefix: observations.join(' | '),
    postVerify: true,
    postVerifyHwnd: dispatchHwnd,
    postVerifyQuery: spec.app,
    postVerifyRequired: false,
    postVerifyRequireSameHwnd: spec.requireSameHwnd,
    postVerifySourceQuery: spec.app,
    postVerifyVisualQuery: spec.postVerify,
    stopOnError: true,
    summaryLabel: 'visible_click',
  });
}
