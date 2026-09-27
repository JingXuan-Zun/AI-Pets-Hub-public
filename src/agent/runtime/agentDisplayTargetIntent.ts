const SECONDARY_DISPLAY_PATTERN = /(?:secondary|second\s*(?:screen|display|monitor)|2\s*(?:screen|display|monitor)|\u526f\u5c4f|\u526f\u663e\u793a\u5668|\u7b2c\u4e8c(?:\u4e2a)?(?:\u5c4f|\u663e\u793a\u5668)|\u4e8c\u53f7(?:\u5c4f|\u663e\u793a\u5668)|\u5916\u63a5(?:\u5c4f|\u663e\u793a\u5668)|\u6269\u5c55(?:\u5c4f|\u663e\u793a\u5668))/iu;
const PRIMARY_DISPLAY_PATTERN = /(?:primary|main\s*(?:screen|display|monitor)|1\s*(?:screen|display|monitor)|\u4e3b\u5c4f|\u4e3b\u663e\u793a\u5668|\u7b2c\u4e00(?:\u4e2a)?(?:\u5c4f|\u663e\u793a\u5668)|\u4e00\u53f7(?:\u5c4f|\u663e\u793a\u5668))/iu;

const DISPLAY_TARGET_KEYS = [
  'display',
  'displayId',
  'displayTarget',
  'screen',
  'screenId',
  'screenTarget',
  'targetDisplay',
  'targetDisplayId',
] as const;

const WINDOW_DISPLAY_ACTIONS = new Set([
  'control_window',
  'focus_then_control_window',
  'launch_then_control_window',
  'launch_then_move_window_to_display',
  'move_window',
  'move_window_to_display',
  'move_window_to_monitor',
  'move_window_to_screen',
  'open_or_focus_then_control_window',
  'open_or_focus_then_move_window_to_display',
  'open_then_control_window',
  'open_then_move_window_to_display',
]);

export type AgentDisplayRole = 'primary' | 'secondary';

function normalizeActionName(value: unknown) {
  return typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[-\s]+/gu, '_')
    : '';
}

function hasDisplayTarget(args: Record<string, unknown>) {
  return DISPLAY_TARGET_KEYS.some((key) => (
    typeof args[key] === 'string' && Boolean(args[key].trim())
  ));
}

function bindDisplayRole(args: Record<string, unknown>, role: AgentDisplayRole) {
  const normalized = { ...args };
  for (const key of DISPLAY_TARGET_KEYS) {
    delete normalized[key];
  }
  normalized.targetDisplay = role;
  return normalized;
}

function bindWindowActionDisplayRole(
  args: Record<string, unknown>,
  role: AgentDisplayRole,
) {
  const action = normalizeActionName(args.action);
  if (!WINDOW_DISPLAY_ACTIONS.has(action)) {
    return args;
  }
  if (action.includes('control_window') && !hasDisplayTarget(args)) {
    return args;
  }
  return bindDisplayRole(args, role);
}

function bindSequenceDisplayRole(
  args: Record<string, unknown>,
  role: AgentDisplayRole,
) {
  const stepsJson = typeof args.stepsJson === 'string' ? args.stepsJson.trim() : '';
  if (!stepsJson) {
    return args;
  }

  try {
    const parsed = JSON.parse(stepsJson) as unknown;
    if (!Array.isArray(parsed)) {
      return args;
    }
    let changed = false;
    const steps = parsed.map((value) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return value;
      }
      const step = value as Record<string, unknown>;
      if (step.tool !== 'execute_desktop_action') {
        return value;
      }
      const inputKey = step.args && typeof step.args === 'object' && !Array.isArray(step.args)
        ? 'args'
        : step.input && typeof step.input === 'object' && !Array.isArray(step.input)
          ? 'input'
          : null;
      if (!inputKey) {
        return value;
      }
      const input = step[inputKey] as Record<string, unknown>;
      const normalizedInput = bindWindowActionDisplayRole(input, role);
      if (normalizedInput === input) {
        return value;
      }
      changed = true;
      return {
        ...step,
        [inputKey]: normalizedInput,
      };
    });

    if (!changed) {
      return args;
    }
    return bindDisplayRole({
      ...args,
      stepsJson: JSON.stringify(steps),
    }, role);
  } catch {
    return args;
  }
}

export function resolveAgentExplicitDisplayRoleFromText(text: string): AgentDisplayRole | '' {
  const normalizedText = text.normalize('NFKC').toLowerCase();
  if (SECONDARY_DISPLAY_PATTERN.test(normalizedText)) {
    return 'secondary';
  }
  if (PRIMARY_DISPLAY_PATTERN.test(normalizedText)) {
    return 'primary';
  }
  return '';
}

export function bindAgentToolDisplayTargetToExplicitIntent(options: {
  args: Record<string, unknown>;
  sourceText: string;
  toolName: string;
  userGoal: string;
}) {
  const role = resolveAgentExplicitDisplayRoleFromText(options.sourceText)
    || resolveAgentExplicitDisplayRoleFromText(options.userGoal);
  if (!role) {
    return options.args;
  }

  if (options.toolName === 'execute_desktop_action') {
    return bindWindowActionDisplayRole(options.args, role);
  }
  if (options.toolName === 'execute_desktop_sequence') {
    return bindSequenceDisplayRole(options.args, role);
  }
  return options.args;
}

export function doesAgentDisplayRoleMatchPrimaryFlag(
  role: AgentDisplayRole | '',
  primary: boolean | null | undefined,
) {
  if (!role || typeof primary !== 'boolean') {
    return true;
  }
  return role === 'primary' ? primary : !primary;
}
