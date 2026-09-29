import { type AgentChatCommand } from './agentChatCommand';
import { createAgentToolCommand } from './runtime/agentToolCommandFactory';

export function createAgentVisibleClickActionablePreflightCommand(options: {
  args: Record<string, unknown>;
  sourceText: string;
  toolName: string;
  userGoal: string;
}): AgentChatCommand | null {
  const mode = typeof options.args.mode === 'string'
    ? options.args.mode.trim().toLowerCase().replace(/-/gu, '_')
    : '';
  if (
    options.toolName !== 'execute_desktop_sequence'
    || (mode !== 'visible_click' && mode !== 'visibleclick')
  ) {
    return null;
  }

  const app = typeof options.args.app === 'string' ? options.args.app.trim() : '';
  const target = typeof options.args.target === 'string' ? options.args.target.trim() : '';
  if (!app || !target) {
    return null;
  }

  const sourceHwndValue = Number(options.args.sourceHwnd);
  const sourceHwnd = Number.isFinite(sourceHwndValue) && sourceHwndValue > 0
    ? Math.round(sourceHwndValue)
    : null;
  return createAgentToolCommand({
    args: {
      action: 'locate_element',
      allowScreenFallback: false,
      forceRefresh: true,
      question: [
        'Visible-click actionable preflight.',
        `Inspect only the ${app} window and resolve ${target} before requesting click approval.`,
        'Return an actionable primary control, its relation to the requested target, and an audited native-screen coordinate.',
        'Do not mark ready when the control, ownership relation, or coordinate is uncertain.',
      ].join(' '),
      ...(sourceHwnd ? { hwnd: sourceHwnd, sourceId: `window:${sourceHwnd}:` } : {}),
      sourceQuery: app,
      sourceType: 'window',
      targetDescription: `${target} and its actionable control inside ${app}`,
      targetText: target,
    },
    sourceText: options.sourceText,
    toolName: 'locate_screen_elements',
    userGoal: options.userGoal,
  });
}
