import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

const AGENT_RECOVERY_STRATEGY_BUDGETS: Record<string, { fallback: string; max: number }> = {
  ask_user_disambiguate: { fallback: 'final_blocked_with_evidence', max: 1 },
  ask_user_manual_gate: { fallback: 'final_blocked_with_evidence', max: 1 },
  clarify_target_action_relation: { fallback: 'ask_user_disambiguate', max: 2 },
  execute_adjusted_action: { fallback: 'focus_candidate_crop', max: 2 },
  execute_ready_action: { fallback: 'observe_window_or_capture_source', max: 1 },
  focus_candidate_crop: { fallback: 'ask_user_disambiguate', max: 2 },
  observe_window_or_capture_source: { fallback: 'ask_user_disambiguate', max: 2 },
  read_blocker_or_gate: { fallback: 'ask_user_manual_gate', max: 1 },
  read_error_or_recovery_controls: { fallback: 'final_blocked_with_evidence', max: 1 },
  refresh_or_relocate_target: { fallback: 'focus_candidate_crop', max: 2 },
  relocate_with_coordinates: { fallback: 'focus_candidate_crop', max: 2 },
  wait_and_observe: { fallback: 'read_error_or_recovery_controls', max: 3 },
};

function normalizeAction(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
}

function hasFocusCropInput(input: Record<string, unknown>) {
  return [
    'focusCenterRatioX',
    'focusCenterRatioY',
    'focusWidthRatio',
    'focusHeightRatio',
    'focusX',
    'focusY',
    'focusWidth',
    'focusHeight',
  ].some((key) => input[key] !== undefined && input[key] !== null && String(input[key]).trim() !== '');
}

export function resolveAgentRecoveryStrategyFromCommand(command: AgentChatCommand) {
  const toolName = command.toolCall?.name ?? command.kind;
  const input = command.toolCall?.input ?? {};
  const inputText = JSON.stringify(input).normalize('NFKC').toLowerCase();
  const action = normalizeAction(input.action);
  if (toolName === 'execute_desktop_observation') {
    if (action === 'wait_and_observe') return 'wait_and_observe';
    if (['list_capture_sources', 'get_active_window_info', 'get_display_info', 'inspect_window_ui'].includes(action)) {
      return 'observe_window_or_capture_source';
    }
    return '';
  }
  if (toolName === 'observe_windows_and_apps') return 'observe_window_or_capture_source';
  if (toolName === 'locate_screen_elements') {
    if (hasFocusCropInput(input)) return 'focus_candidate_crop';
    if (/(?:error|failed|failure|exception|crash|unable|cannot|\u9519\u8bef|\u5931\u8d25|\u5d29\u6e83)/iu.test(inputText)) return 'read_error_or_recovery_controls';
    if (/(?:blocked|permission|denied|modal|confirmation|gate|policy|administrator|admin|uac|\u963b\u6b62|\u62e6\u622a|\u6743\u9650|\u62d2\u7edd)/iu.test(inputText)) return 'read_blocker_or_gate';
    if (/(?:coordinate|coordinates|center|bounds|elementcenter|\u5750\u6807|\u4e2d\u5fc3|\u8fb9\u754c)/iu.test(inputText)) return 'relocate_with_coordinates';
    if (/(?:primary action|button|relation|associated|belongs|target action|\u4e3b\u8981\u64cd\u4f5c|\u6309\u94ae|\u5173\u8054)/iu.test(inputText)) return 'clarify_target_action_relation';
    if (action === 'locate_element' || action === 'describe_elements') return 'refresh_or_relocate_target';
  }
  if (toolName === 'execute_desktop_sequence' || toolName === 'execute_desktop_input') {
    return 'execute_ready_action';
  }
  return '';
}

export function countAgentRecoveryStrategyRuns(
  toolResults: AgentRuntimeToolResultEntry[] | null | undefined,
  strategy: string,
) {
  return toolResults?.filter((entry) => (
    resolveAgentRecoveryStrategyFromCommand(entry.command) === strategy
  )).length ?? 0;
}

export function getAgentRecoveryStrategyBudget(strategy: string) {
  return AGENT_RECOVERY_STRATEGY_BUDGETS[strategy]
    ?? { fallback: 'ask_user_disambiguate', max: 2 };
}
