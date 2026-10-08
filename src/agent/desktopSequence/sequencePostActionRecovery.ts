import { type AgentChatCommandResult, type AgentStructuredToolRecoveryEvidence } from '../agentChatCommand';
import { type AgentRuntimeDesktopSequenceStep, getAgentRuntimeSequenceStepAction, getAgentRuntimeSequenceStepString, getAgentRuntimeSequenceStepNumber } from './sequenceResultEvidence';

function getAgentRuntimeDesktopSequenceLastWindowUiStep(steps: AgentRuntimeDesktopSequenceStep[]) {
  return [...steps].reverse().find((step) => (
    step.tool === 'execute_desktop_action'
      && ['interact_window_ui', 'invoke_window_ui'].includes(getAgentRuntimeSequenceStepAction(step))
  )) ?? null;
}

function createAgentRuntimeDesktopSequenceWindowUiRecoveryArgs(
  steps: AgentRuntimeDesktopSequenceStep[],
  query: string,
) {
  const step = getAgentRuntimeDesktopSequenceLastWindowUiStep(steps);
  if (!step) {
    return null;
  }

  const targetText = getAgentRuntimeSequenceStepString(step, [
    'targetText',
    'text',
    'label',
    'name',
    'target',
    'automationId',
  ]);
  const windowQuery = getAgentRuntimeSequenceStepString(step, [
    'query',
    'windowTitle',
    'title',
    'processName',
  ]) || query.trim();
  const targetDescription = getAgentRuntimeSequenceStepString(step, [
    'targetDescription',
    'description',
    'element',
  ]);
  const hwnd = getAgentRuntimeSequenceStepNumber(step, 'hwnd')
    ?? getAgentRuntimeSequenceStepNumber(step, 'windowHandle');

  return {
    action: 'inspect_window_ui',
    forceRefresh: true,
    ...(Number.isFinite(Number(hwnd)) && Number(hwnd) > 0 ? { hwnd: Math.round(Number(hwnd)) } : {}),
    limit: 80,
    maxDepth: 6,
    question: [
      'The previous UI Automation action completed but the requested final state was not verified.',
      'Refresh read-only UI Automation controls for the same window/control before retrying.',
      targetText ? `Target/control text: ${targetText}.` : '',
      'Return enabled/offscreen state, supported actions, blockers/modals, alternate start/open/continue controls, and screen bounds when available.',
      'Do not click or invoke anything.',
    ].filter(Boolean).join(' '),
    ...(targetDescription ? { targetDescription } : targetText ? { targetDescription: targetText } : {}),
    ...(targetText ? { targetText } : {}),
    ...(windowQuery ? { query: windowQuery } : {}),
  };
}

function normalizeAgentRuntimeDesktopSequencePostActionText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase()
    : '';
}

function inferAgentRuntimeDesktopSequenceSelectionPostActionState(text: string) {
  if (/(?:selection_mismatch|selected\s+(?:item|target)\s+(?:is|remains|still)\s+(?:not|different|wrong)|current\s+(?:selection|detail|page|title)\s+(?:is|remains|still)\s+(?:not|different|wrong)|"selectionverificationstatus"\s*:\s*"mismatch")/iu.test(text)) {
    return 'selection_mismatch';
  }

  if (/(?:visible_only|visible\s+only|target\s+(?:is\s+)?(?:visible|shown)\s+but\s+not\s+(?:selected|current)|not\s+selected|"selectionverificationstatus"\s*:\s*"visible-only")/iu.test(text)) {
    return 'visible_only';
  }

  return '';
}

function normalizeAgentRuntimeDesktopSequencePostActionState(value: unknown) {
  const text = normalizeAgentRuntimeDesktopSequencePostActionText(value).trim();
  if (!text) {
    return '';
  }

  const selectionState = inferAgentRuntimeDesktopSequenceSelectionPostActionState(text);
  if (selectionState) {
    return selectionState;
  }

  const hasNewTransitionalNegatedError = /(?:no|without|not\s+(?:visible|shown|present)|absent|missing|cannot\s+see|can't\s+see)[^\n.]{0,36}(?:error|error_dialog|failed|failure|crash|exception)/iu.test(text);
  const hasNewTransitionalFailure = !hasNewTransitionalNegatedError
    && /(?:error|error_dialog|failed|failure|crash|exception)/iu.test(text);
  if (
    !hasNewTransitionalFailure
    && /(?:verifying|extracting|preparing|queued|queue|waiting\s+in\s+queue)/iu.test(text)
  ) {
    return 'updating';
  }

  if (
    !hasNewTransitionalFailure
    && /(?:waiting_target|waiting\s+for\s+(?:the\s+)?(?:target|game|app|application|window|client|server)|target\s+(?:process|window|client|app|game)\s+(?:not\s+)?(?:yet\s+)?(?:appeared|visible|running|detected)|start(?:ed)?\s+(?:request|action|button|command)\s+(?:sent|triggered|accepted)|launch\s+(?:request|action|button|command)\s+(?:sent|triggered|accepted)|\u7b49\u5f85.{0,16}(?:\u76ee\u6807|\u6e38\u620f|\u7a97\u53e3|\u8fdb\u7a0b)|(?:\u76ee\u6807|\u6e38\u620f).{0,16}(?:\u672a|\u8fd8\u6ca1).{0,16}(?:\u51fa\u73b0|\u542f\u52a8|\u8fd0\u884c))/iu.test(text)
  ) {
    return 'waiting_target';
  }

  if (
    !hasNewTransitionalFailure
    && /(?:opening|initializing|connecting|spinner)/iu.test(text)
  ) {
    return 'loading';
  }

  if (!hasNewTransitionalNegatedError && /(?:error|error_dialog|failed|failure|crash|exception)/iu.test(text)) {
    return 'error';
  }

  if (/(?:login_required|login|sign\s*in|password|account|qr\s*code)/iu.test(text)) {
    return 'login_required';
  }

  if (/(?:updating|update|download|install|patch)/iu.test(text)) {
    return 'updating';
  }

  if (/(?:loading|launching|starting|please\s*wait|progress)/iu.test(text)) {
    return 'loading';
  }

  if (/(?:unchanged|no\s+visible\s+change|same\s+screen)/iu.test(text)) {
    return 'unchanged';
  }

  if (/(?:blocked|permission|denied|blocked_by)/iu.test(text)) {
    return 'blocked';
  }

  if (/(?:launched|opened|running|started)/iu.test(text)) {
    return 'launched';
  }

  if (/(?:unknown|unclear)/iu.test(text)) {
    return 'unknown';
  }

  return '';
}

export function inferAgentRuntimeDesktopSequencePostActionState(result: AgentChatCommandResult | null) {
  const structuredPostActionState = normalizeAgentRuntimeDesktopSequencePostActionState(
    result?.stateSummary?.structuredEvidence?.postActionState
      ?? result?.receipt?.stateSummary?.structuredEvidence?.postActionState,
  );
  if (structuredPostActionState) {
    return structuredPostActionState;
  }

  const text = normalizeAgentRuntimeDesktopSequencePostActionText([
    result?.responseText,
    result?.verification,
    result?.observations?.join('\n'),
    result?.stateSummary?.observedState?.join('\n'),
    result?.stateSummary?.verificationEvidence?.join('\n'),
    result?.stateSummary?.missingEvidence?.join('\n'),
    result?.stateSummary?.structuredEvidence ? JSON.stringify(result.stateSummary.structuredEvidence) : '',
  ].filter(Boolean).join('\n'));

  if (!text) {
    return 'unknown';
  }

  const hasNewTransitionalNegatedError = /(?:no|without|not\s+(?:visible|shown|present)|absent|missing|cannot\s+see|can't\s+see)[^\n.]{0,36}(?:error|failed|failure|crash|exception)/iu.test(text);
  const hasNewTransitionalFailure = !hasNewTransitionalNegatedError
    && /(?:error|failed|failure|crash|exception)/iu.test(text);
  if (
    !hasNewTransitionalFailure
    && /(?:verifying|extracting|preparing|queued|queue|waiting\s+in\s+queue)/iu.test(text)
  ) {
    return 'updating';
  }

  if (
    !hasNewTransitionalFailure
    && /(?:waiting_target|waiting\s+for\s+(?:the\s+)?(?:target|game|app|application|window|client|server)|target\s+(?:process|window|client|app|game)\s+(?:not\s+)?(?:yet\s+)?(?:appeared|visible|running|detected)|start(?:ed)?\s+(?:request|action|button|command)\s+(?:sent|triggered|accepted)|launch\s+(?:request|action|button|command)\s+(?:sent|triggered|accepted)|\u7b49\u5f85.{0,16}(?:\u76ee\u6807|\u6e38\u620f|\u7a97\u53e3|\u8fdb\u7a0b)|(?:\u76ee\u6807|\u6e38\u620f).{0,16}(?:\u672a|\u8fd8\u6ca1).{0,16}(?:\u51fa\u73b0|\u542f\u52a8|\u8fd0\u884c))/iu.test(text)
  ) {
    return 'waiting_target';
  }

  if (
    !hasNewTransitionalFailure
    && /(?:opening|initializing|connecting|spinner)/iu.test(text)
  ) {
    return 'loading';
  }

  const normalizedPostActionState = normalizeAgentRuntimeDesktopSequencePostActionState(text);
  if (normalizedPostActionState) {
    return normalizedPostActionState;
  }

  if (!hasNewTransitionalNegatedError && /(?:error|failed|failure|crash|exception)/iu.test(text)) {
    return 'error';
  }

  if (/(?:login|sign in|password|account|qr code)/iu.test(text)) {
    return 'login_required';
  }

  if (/(?:update|updating|download|install|patch)/iu.test(text)) {
    return 'updating';
  }

  if (/(?:loading|launching|starting|please wait|progress)/iu.test(text)) {
    return 'loading';
  }

  if (/(?:unchanged|no visible change|same screen)/iu.test(text)) {
    return 'unchanged';
  }

  if (/(?:opened|launched|running|started)/iu.test(text)) {
    return 'launched';
  }

  return 'unknown';
}

export function createAgentRuntimeDesktopSequencePostActionRecoveryDirective(
  postActionState: string,
  query: string,
  steps: AgentRuntimeDesktopSequenceStep[] = [],
): AgentStructuredToolRecoveryEvidence | null {
  const targetQuery = query.trim();
  const withQuery = (args: Record<string, unknown>) => (
    targetQuery ? { ...args, query: targetQuery } : args
  );
  const windowUiRecoveryArgs = createAgentRuntimeDesktopSequenceWindowUiRecoveryArgs(steps, targetQuery);

  switch (postActionState) {
    case 'waiting_target':
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 3000,
        }),
        nextTool: 'execute_desktop_observation',
        reason: 'The launch/start action appears sent, but the requested target is not visible/running yet. Wait and poll target window/process evidence instead of retrying the same click.',
        strategy: 'wait-and-observe',
      };
    case 'loading':
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 2500,
        }),
        nextTool: 'execute_desktop_observation',
        reason: 'The visible UI is still launching/loading, so refresh evidence after a short wait instead of asking the user whether to continue.',
        strategy: 'wait-and-observe',
      };
    case 'updating':
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 5000,
        }),
        nextTool: 'execute_desktop_observation',
        reason: 'The visible UI is updating/downloading/installing, so observe progress again later and avoid random clicks.',
        strategy: 'wait-and-observe',
      };
    case 'unchanged':
      if (windowUiRecoveryArgs) {
        return {
          nextArgs: windowUiRecoveryArgs,
          nextTool: 'execute_desktop_observation',
          reason: 'The UI did not visibly change after a UI Automation action. Refresh the same window controls with read-only UI Automation before retrying or falling back to coordinates.',
          strategy: 'refresh-observation',
        };
      }

      return {
        nextArgs: {
          action: 'locate_element',
          forceRefresh: true,
          ...(targetQuery ? { targetDescription: targetQuery } : {}),
        },
        nextTool: 'locate_screen_elements',
        reason: 'The visible UI did not change after the input, so refresh target/action coordinates before retrying only the unclear primitive.',
        strategy: 're-locate-target',
      };
    case 'selection_mismatch':
    case 'visible_only':
      if (windowUiRecoveryArgs) {
        return {
          nextArgs: {
            ...windowUiRecoveryArgs,
            question: [
              'The target item may be visible, but current selection/detail state is not verified.',
              'Refresh read-only UI Automation controls and identify selected/current list item, detail title, and target item bounds.',
              'Do not click or invoke anything.',
            ].join(' '),
          },
          nextTool: 'execute_desktop_observation',
          reason: 'The previous action did not prove that the target item became the current selected/detail item. Refresh selection evidence before starting or claiming success.',
          strategy: 'refresh-observation',
        };
      }

      return {
        nextArgs: {
          action: 'locate_element',
          forceRefresh: true,
          ...(targetQuery ? { targetDescription: targetQuery } : {}),
          question: [
            'Find the target item and verify whether it is the current selected/highlighted item or current detail page.',
            'Return currentSelection, selectionVerificationStatus, targetCandidates, and coordinates for the target item if it needs to be selected.',
          ].join(' '),
        },
        nextTool: 'locate_screen_elements',
        reason: 'The target is visible but not confirmed as selected/current. Re-locate the target item and selection state before retrying.',
        strategy: 're-locate-target',
      };
    case 'error':
      return {
        nextArgs: {
          action: 'describe_elements',
          forceRefresh: true,
          question: targetQuery
            ? `Read the visible error text and recovery controls related to: ${targetQuery}.`
            : 'Read the visible error text and any recovery controls.',
          targetDescription: 'visible error text and recovery controls',
        },
        nextTool: 'locate_screen_elements',
        reason: 'The visible UI appears to show an error, so read the error text before retrying or reporting a blocker.',
        strategy: 'read-error',
      };
    case 'blocked':
      return {
        nextArgs: {
          action: 'describe_elements',
          forceRefresh: true,
          question: targetQuery
            ? `Read the visible blocker, permission prompt, or modal related to: ${targetQuery}.`
            : 'Read the visible blocker, permission prompt, modal, or confirmation gate.',
          targetDescription: 'visible blocker, permission prompt, modal, or confirmation gate',
        },
        nextTool: 'locate_screen_elements',
        reason: 'The visible UI appears blocked by a gate, so inspect the blocker before retrying or asking the user.',
        strategy: 'read-blocker',
      };
    case 'unknown':
      if (windowUiRecoveryArgs) {
        return {
          nextArgs: windowUiRecoveryArgs,
          nextTool: 'execute_desktop_observation',
          reason: 'The post-action state is unknown after a UI Automation action. Read the current UI Automation controls before deciding whether to wait, retry, or ask the user.',
          strategy: 'refresh-observation',
        };
      }

      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 1000,
        }),
        nextTool: 'execute_desktop_observation',
        reason: 'The post-action visual state is unknown, so refresh observation once before retrying or asking a short question.',
        strategy: 'refresh-observation',
      };
    case 'login_required':
      return {
        nextArgs: withQuery({
          action: 'describe_elements',
          forceRefresh: true,
          question: 'Read the visible login/account page. Locate safe login continuation controls such as 登录, 快速登录, 安全登录, Sign in, Log in, Continue, Confirm, or OK when credentials appear already filled or remembered. Also report captcha, QR-code scan, SMS code, two-factor verification, empty required input, or admin/UAC gates. Do not click anything.',
          targetDescription: 'login continuation controls and non-automatable verification gates',
          targetText: '登录 快速登录 安全登录 Sign in Log in Continue Confirm OK',
        }),
        nextTool: 'locate_screen_elements',
        reason: 'The visible UI requires login/account continuation. Read safe login controls first; only ask the user for captcha, QR scan, 2FA, empty credentials, or admin confirmation.',
        strategy: 're-locate-target',
      };
    case 'launched':
      return null;
    default:
      return {
        nextArgs: withQuery({
          action: 'wait_and_observe',
          forceRefresh: true,
          includeVisual: true,
          waitMs: 1000,
        }),
        nextTool: 'execute_desktop_observation',
        reason: 'The post-action state is not actionable yet, so refresh observation before deciding the next step.',
        strategy: 'refresh-observation',
      };
  }
}

export function formatAgentRuntimeDesktopSequenceRecoveryDirective(
  directive: AgentStructuredToolRecoveryEvidence | null,
) {
  if (!directive?.strategy) {
    return '';
  }

  return [
    `postActionRecoveryStrategy=${directive.strategy}`,
    directive.nextTool ? `nextTool=${directive.nextTool}` : '',
    directive.nextArgs ? `nextArgs=${JSON.stringify(directive.nextArgs)}` : '',
    directive.reason ? `reason=${directive.reason}` : '',
  ].filter(Boolean).join(' | ');
}

export function createAgentRuntimeDesktopSequencePostActionRecovery(
  postActionState: string,
  steps: AgentRuntimeDesktopSequenceStep[] = [],
) {
  const hasWindowUiStep = Boolean(getAgentRuntimeDesktopSequenceLastWindowUiStep(steps));
  switch (postActionState) {
    case 'waiting_target':
      return [
        'The post-action state is waiting_target: the start/open/play action appears sent, but the requested target process/window/content has not appeared yet. Wait and poll window/process evidence; do not retry the same click unless later evidence proves it did nothing.',
        'tool:execute_desktop_observation action=wait_and_observe',
        'tool:observe_windows_and_apps',
      ];
    case 'launched':
      return [
        'The post-action visual state looks launched/opened. If the original request had more steps, continue with those steps; otherwise answer from the evidence.',
      ];
    case 'loading':
      return [
        'The post-action visual state looks like loading/launching. Wait briefly, then refresh window and visual observation before deciding whether to retry or answer.',
        'tool:execute_desktop_observation action=wait_and_observe',
        'tool:execute_desktop_observation',
        'tool:observe_windows_and_apps',
      ];
    case 'login_required':
      return [
        'The post-action visual state appears to require login or account continuation. First locate safe login controls such as 登录, 快速登录, 安全登录, Sign in, Log in, Continue, Confirm, or OK when credentials appear already filled or remembered.',
        'Ask the user only for captcha, QR scan, two-factor/SMS verification, empty required credentials, admin/UAC confirmation, or another non-automatable private gate.',
        'tool:locate_screen_elements',
      ];
    case 'updating':
      return [
        'The post-action visual state appears to be updating/downloading/installing. Observe progress again later instead of clicking random controls.',
        'tool:execute_desktop_observation action=wait_and_observe',
        'tool:execute_desktop_observation',
      ];
    case 'error':
      return [
        'The post-action visual state appears to show an error. Read the visible error text, then decide whether to retry, use another visible control, or report the error.',
        'tool:locate_screen_elements',
        'tool:execute_desktop_observation',
      ];
    case 'blocked':
      return [
        'The post-action visual state appears blocked by permission, policy, modal confirmation, or another gate. Read the visible blocker before retrying.',
        'tool:locate_screen_elements',
        'tool:execute_desktop_observation',
      ];
    case 'unchanged':
      return [
        'The post-action visual state appears unchanged. Re-locate the intended element with forceRefresh, verify coordinates, then retry only if the target is still clear.',
        hasWindowUiStep ? 'tool:execute_desktop_observation action=inspect_window_ui' : '',
        'tool:locate_screen_elements',
        'tool:get_cursor_position',
      ].filter(Boolean);
    case 'selection_mismatch':
      return [
        'The post-action visual state says the current selected/detail item does not match the requested target. Do not claim success or press the launch/start button yet.',
        hasWindowUiStep ? 'tool:execute_desktop_observation action=inspect_window_ui' : '',
        'tool:locate_screen_elements',
      ].filter(Boolean);
    case 'visible_only':
      return [
        'The target is visible but not confirmed as selected/current. Select the target item first, then verify selection before looking for the primary action.',
        hasWindowUiStep ? 'tool:execute_desktop_observation action=inspect_window_ui' : '',
        'tool:locate_screen_elements',
      ].filter(Boolean);
    default:
      return [
        'The post-action visual state is unknown. Refresh visual/window observation, then decide whether to retry the unclear primitive or ask one short question.',
        hasWindowUiStep ? 'tool:execute_desktop_observation action=inspect_window_ui' : '',
        'tool:execute_desktop_observation action=wait_and_observe',
        'tool:execute_desktop_observation',
        'tool:locate_screen_elements',
      ].filter(Boolean);
  }
}
