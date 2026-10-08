import type { AgentChatCommandResult, AgentToolCallCommand } from '../agentChatCommand';
import type { AgentRuntimeExecutorContext } from '../agentRuntimeExecutor';
import { executeListCaptureSources, executeSummarizeVisualSnapshot } from '../agentRuntimeVisualTools';
import { executeGetActiveWindowInfo, executeGetCursorPosition, executeInspectWindowUi, executeListRunningApps, executeObserveWindowsAndApps } from '../agentRuntimeDesktopObservationTools';
import { executeDiagnoseDesktopIcons, executeListDesktopItems } from '../agentRuntimeDesktopItemTools';
import { executeGetDisplayInfo, executeGetSystemInfo } from '../agentRuntimeSystemTools';
import { createAgentRuntimeResult } from '../agentRuntimeToolResult';
import { annotateDesktopObservationResult, getToolBooleanInput, getToolNumberInput, getToolStringInput, normalizeExecuteDesktopObservationAction } from '../agentRuntimeToolPreparation';

interface DesktopObservationCancellation {
  isAgentRuntimeCancellationRequested: (runtime: AgentRuntimeExecutorContext) => boolean;
  createAgentRuntimeCancelledResult: (target: AgentToolCallCommand) => AgentChatCommandResult;
}

export function createDesktopObservationExecutor({
  isAgentRuntimeCancellationRequested,
  createAgentRuntimeCancelledResult,
}: DesktopObservationCancellation) {
  function resolveDesktopObservationWaitMs(toolCall: AgentToolCallCommand) {
    const waitMs = getToolNumberInput(toolCall, 'waitMs')
      ?? getToolNumberInput(toolCall, 'delayMs')
      ?? getToolNumberInput(toolCall, 'durationMs')
      ?? 1500;

    return Math.max(250, Math.min(15_000, Math.round(waitMs)));
  }

  async function waitForDesktopObservationDelay(
    runtime: AgentRuntimeExecutorContext,
    waitMs: number,
  ) {
    if (isAgentRuntimeCancellationRequested(runtime)) {
      return false;
    }

    let removeAbortListener: (() => void) | null = null;
    const completed = await new Promise<boolean>((resolve) => {
      const timeoutId = globalThis.setTimeout(() => resolve(true), waitMs);
      const handleAbort = () => {
        globalThis.clearTimeout(timeoutId);
        resolve(false);
      };

      if (runtime.signal) {
        if (runtime.signal.aborted) {
          globalThis.clearTimeout(timeoutId);
          resolve(false);
          return;
        }

        runtime.signal.addEventListener('abort', handleAbort, { once: true });
        removeAbortListener = () => runtime.signal?.removeEventListener('abort', handleAbort);
      }
    });
    removeAbortListener?.();

    return completed && !isAgentRuntimeCancellationRequested(runtime);
  }

  function mergeDesktopObservationLines(
    ...lists: Array<Array<string | null | undefined> | null | undefined>
  ) {
    const seen = new Set<string>();
    const lines: string[] = [];
    for (const list of lists) {
      for (const item of list ?? []) {
        const text = typeof item === 'string' ? item.trim() : '';
        if (!text || seen.has(text)) {
          continue;
        }

        seen.add(text);
        lines.push(text);
      }
    }

    return lines;
  }

  const AGENT_WAIT_OBSERVE_VISUAL_TIMEOUT_MS = 15_000;

  async function executeSupplementalWaitVisualObservation(
    task: Promise<AgentChatCommandResult>,
  ): Promise<AgentChatCommandResult> {
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    try {
      return await Promise.race([
        task,
        new Promise<AgentChatCommandResult>((resolve) => {
          timeoutId = globalThis.setTimeout(() => resolve({
            errorText: `Supplemental visual observation timed out after ${AGENT_WAIT_OBSERVE_VISUAL_TIMEOUT_MS}ms.`,
            ok: false,
            responseText: 'Supplemental visual observation timed out; window/process evidence is still available.',
          }), AGENT_WAIT_OBSERVE_VISUAL_TIMEOUT_MS);
        }),
      ]);
    } finally {
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    }
  }

  async function executeWaitAndObserveDesktop(
    runtime: AgentRuntimeExecutorContext,
    toolCall: AgentToolCallCommand,
    sourceText: string,
  ): Promise<AgentChatCommandResult> {
    const waitMs = resolveDesktopObservationWaitMs(toolCall);
    const completedWait = await waitForDesktopObservationDelay(runtime, waitMs);
    if (!completedWait) {
      return createAgentRuntimeCancelledResult(toolCall);
    }

    const query = getToolStringInput(toolCall, ['query', 'target', 'sourceName', 'name', 'title', 'processName']);
    const windowResult = await executeObserveWindowsAndApps({
      goal: 'Wait briefly, then observe current desktop/window/app state',
      input: {
        forceRefresh: true,
        includeActiveWindow: true,
        includeDisplays: true,
        includeRunningApps: true,
        limit: getToolNumberInput(toolCall, 'limit') ?? 12,
        ...(query ? { query } : {}),
      },
      name: 'observe_windows_and_apps',
    });
    const includeVisual = getToolBooleanInput(toolCall, 'includeVisual') === true;
    const visualResult = includeVisual
      ? await executeSupplementalWaitVisualObservation(executeSummarizeVisualSnapshot(runtime, {
          ...toolCall,
          goal: toolCall.goal || 'Wait briefly, then visually observe current UI state',
          input: {
            ...toolCall.input,
            allowScreenFallback: true,
            forceRefresh: true,
            question: getToolStringInput(toolCall, ['question', 'goal', 'prompt'])
              || 'After waiting, summarize the visible UI state and any loading, login, update, error, or unchanged cues.',
          },
          name: 'summarize_visual_snapshot',
        }, sourceText))
      : null;
    const windowOk = windowResult.ok !== false;
    const visualOk = !visualResult || visualResult.ok !== false;
    const ok = windowOk;
    const status = visualResult
      ? windowOk && visualOk ? 'success' : windowOk ? 'unverified' : 'failed'
      : windowResult.receipt?.status ?? (ok ? 'success' : 'failed');
    const observedState = mergeDesktopObservationLines(
      [`Waited ${waitMs}ms before observing.`],
      windowResult.stateSummary?.observedState,
      windowResult.observations,
      visualResult?.stateSummary?.observedState,
      visualResult?.observations,
    );
    const missingEvidence = mergeDesktopObservationLines(
      windowResult.stateSummary?.missingEvidence,
      visualResult?.stateSummary?.missingEvidence,
      visualResult && !visualOk ? ['missing:supplemental-visual-observation'] : [],
    );
    const recommendedRecovery = mergeDesktopObservationLines(
      windowResult.stateSummary?.recommendedRecovery,
      visualResult?.stateSummary?.recommendedRecovery,
      ok
        ? []
        : [
            'Use this refreshed wait-and-observe evidence to decide whether to wait again, retry only the unclear primitive, or ask one short question.',
          ],
    );
    const verificationEvidence = mergeDesktopObservationLines(
      windowResult.stateSummary?.verificationEvidence,
      visualResult?.stateSummary?.verificationEvidence,
      [windowResult.verification, visualResult?.verification],
    );

    return createAgentRuntimeResult({
      errorText: windowOk ? null : windowResult.errorText || visualResult?.errorText || null,
      observations: observedState,
      ok,
      receipt: {
        evidenceLines: [
          `Waited ${waitMs}ms before observing.`,
          ...(windowResult.receipt?.evidenceLines ?? windowResult.observations ?? []).slice(0, 20),
          ...(visualResult?.receipt?.evidenceLines ?? visualResult?.observations ?? []).slice(0, 20),
        ],
        status,
        stateSummary: {
          missingEvidence,
          observedState,
          recommendedRecovery,
          structuredEvidence: visualResult?.stateSummary?.structuredEvidence
            ?? visualResult?.receipt?.stateSummary?.structuredEvidence
            ?? windowResult.stateSummary?.structuredEvidence
            ?? null,
          verificationEvidence,
        },
        summaryLines: [
          'Call: execute_desktop_observation wait_and_observe',
          `Waited: ${waitMs}ms`,
          `Window observation: ${windowResult.ok === false ? 'failed' : 'ok'}`,
          visualResult ? `Visual observation: ${visualResult.ok === false ? 'failed' : 'ok'}` : 'Visual observation: skipped',
        ],
        title: 'Agent wait and observe',
        toolName: 'execute_desktop_observation',
        verification: [
          `Waited ${waitMs}ms before observing current desktop state.`,
          windowResult.verification,
          visualResult?.verification,
        ].filter(Boolean).join(' | '),
      },
      responseText: [
        `Waited ${waitMs}ms, then observed current desktop state.`,
        windowResult.responseText,
        visualResult?.responseText,
      ].filter(Boolean).join('\n'),
      stateSummary: {
        missingEvidence,
        observedState,
        recommendedRecovery,
        structuredEvidence: visualResult?.stateSummary?.structuredEvidence
          ?? visualResult?.receipt?.stateSummary?.structuredEvidence
          ?? windowResult.stateSummary?.structuredEvidence
          ?? null,
        verificationEvidence,
      },
      verification: [
        `Waited ${waitMs}ms before observing current desktop state.`,
        windowResult.verification,
        visualResult?.verification,
      ].filter(Boolean).join(' | '),
    });
  }

  async function executeDesktopObservation(
    runtime: AgentRuntimeExecutorContext,
    toolCall: AgentToolCallCommand,
    sourceText: string,
  ): Promise<AgentChatCommandResult> {
    const rawAction = getToolStringInput(toolCall, ['action', 'observationAction', 'desktopObservation', 'operation']);
    const action = normalizeExecuteDesktopObservationAction(rawAction);

    if (!action) {
      return {
        errorText: 'Unsupported execute_desktop_observation action.',
        observations: [
          rawAction ? `Unsupported desktop observation: ${rawAction}` : 'Missing desktop observation action.',
        ],
        ok: false,
        responseText: 'execute_desktop_observation needs a supported action such as get_display_info, list_desktop_items, diagnose_desktop_icons, get_system_info, get_active_window_info, inspect_window_ui, list_running_apps, list_capture_sources, summarize_visual_snapshot, wait_and_observe, or get_cursor_position.',
      };
    }

    switch (action) {
      case 'get_display_info':
        return annotateDesktopObservationResult(action, await executeGetDisplayInfo());

      case 'get_system_info':
        return annotateDesktopObservationResult(
          action,
          await executeGetSystemInfo(getToolBooleanInput(toolCall, 'includeDisplays') !== false),
        );

      case 'get_active_window_info':
        return annotateDesktopObservationResult(action, await executeGetActiveWindowInfo());

      case 'inspect_window_ui':
        return annotateDesktopObservationResult(action, await executeInspectWindowUi(toolCall));

      case 'list_running_apps':
        return annotateDesktopObservationResult(
          action,
          await executeListRunningApps(
            getToolStringInput(toolCall, ['query', 'target', 'name', 'processName', 'title']),
            getToolBooleanInput(toolCall, 'includeWindows'),
          ),
        );

      case 'list_capture_sources':
        return annotateDesktopObservationResult(action, await executeListCaptureSources(runtime, toolCall));

      case 'summarize_visual_snapshot':
        return annotateDesktopObservationResult(
          action,
          await executeSummarizeVisualSnapshot(runtime, toolCall, sourceText),
        );

      case 'wait_and_observe':
        return annotateDesktopObservationResult(
          action,
          await executeWaitAndObserveDesktop(runtime, toolCall, sourceText),
        );

      case 'get_cursor_position':
        return annotateDesktopObservationResult(action, await executeGetCursorPosition());

      case 'list_desktop_items':
        return annotateDesktopObservationResult(action, await executeListDesktopItems(toolCall));

      case 'diagnose_desktop_icons':
        return annotateDesktopObservationResult(action, await executeDiagnoseDesktopIcons());

      default:
        return {
          errorText: 'Unsupported execute_desktop_observation action.',
          observations: [`Unsupported desktop observation: ${rawAction}`],
          ok: false,
          responseText: `execute_desktop_observation does not support action "${rawAction}".`,
        };
    }
  }

  return executeDesktopObservation;
}
