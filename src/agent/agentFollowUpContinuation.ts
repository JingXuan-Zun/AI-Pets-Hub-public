import { type ChatMessage } from '../types';
import { findLatestAgentContextMessage } from './agentChatContext';
import { type AgentChatCommand, type AgentChatFollowUpAction } from './agentChatCommand';

const AGENT_CONTINUATION_CONFIRM_PATTERNS = [
  /^(?:可以|好|好的|行|嗯|恩|继续|继续吧|接着|接着来|就这样|就这么做|按这个来|确认|允许|执行|开始)$/u,
  /^(?:可以|好|行|继续|接着).{0,8}(?:做|弄|处理|执行|开始|来吧)$/u,
  /^(?:第)?(?:\d{1,2}|一|二|两|三|四|五)(?:个|项|条|种)?$/u,
  /^(?:运行|执行|启动|选择|选)?(?:第)?(?:\d{1,2}|一|二|两|三|四|五)(?:个|项|条|种)?$/u,
  /^(?:重新观察|重新分析|再观察|再分析|执行计划|运行第.+)$/u,
  /^(?:执行|开始|确认|允许|继续|按|照着).{0,12}(?:刚才|刚刚|上次|那个|这个|计划|整理计划).{0,8}$/u,
  /^(?:刚才|刚刚|上次|那个|这个).{0,12}(?:计划|整理计划).{0,12}(?:执行|开始|确认|允许|继续|做)$/u,
  /^(?:运行|执行|启动|打开|跑).{0,24}(?:刚才|刚刚|上次|之前).{0,20}(?:候选|动作|方案)/u,
];

function isAgentContinuationConfirmation(text: string) {
  const compactText = text.trim().replace(/\s+/gu, '');
  if (!compactText) {
    return false;
  }

  return AGENT_CONTINUATION_CONFIRM_PATTERNS.some((pattern) => pattern.test(compactText));
}

function parseActionIndex(text: string) {
  const compactText = text.trim().replace(/\s+/gu, '');
  const digitMatch = compactText.match(/(?:第)?(\d{1,2})(?:个|项|条|种)?/u);
  if (digitMatch?.[1]) {
    return Math.max(1, Math.round(Number(digitMatch[1])));
  }

  const indexTextByValue: Record<string, number> = {
    一: 1,
    第一: 1,
    一个: 1,
    第一个: 1,
    二: 2,
    两: 2,
    第二: 2,
    第二个: 2,
    三: 3,
    第三: 3,
    第三个: 3,
    四: 4,
    第四: 4,
    第四个: 4,
    五: 5,
    第五: 5,
    第五个: 5,
  };

  for (const [label, index] of Object.entries(indexTextByValue)) {
    if (compactText.includes(label)) {
      return index;
    }
  }

  return null;
}

function normalizeActionLabel(value: string) {
  return value.trim().replace(/\s+/gu, '').toLowerCase();
}

function compactSourceText(value: string) {
  return value.trim().replace(/\s+/gu, '').toLowerCase();
}

function isExecutePreviousPlanIntent(text: string) {
  const compactText = compactSourceText(text);
  return /(?:执行|开始|确认|允许|按|照着|继续|就这样|可以).{0,12}(?:刚才|刚刚|上次|那个|这个|计划|整理计划)/u.test(compactText)
    || /(?:刚才|刚刚|上次|那个|这个).{0,12}(?:计划|整理计划).{0,12}(?:执行|开始|确认|允许|继续|做)/u.test(compactText);
}

function isReobserveIntent(text: string) {
  const compactText = compactSourceText(text);
  return /(?:重新|再).{0,4}(?:观察|分析|看看|检查|复查)/u.test(compactText)
    || /(?:重新观察|重新分析|再观察|再分析|复查)/u.test(compactText);
}

function isProjectRunIntent(text: string) {
  const compactText = compactSourceText(text);
  return /(?:运行|执行|启动|打开|跑|选择|选).{0,20}(?:第|\d|一|二|两|三|四|五|刚才|上次|候选|动作|那个|这个)/u.test(compactText);
}

function resolveFollowUpActionByText(
  text: string,
  actions: AgentChatFollowUpAction[],
) {
  if (!actions.length) {
    return null;
  }

  const actionIndex = parseActionIndex(text);
  if (actionIndex !== null) {
    return actions[actionIndex - 1] ?? null;
  }

  const normalizedText = normalizeActionLabel(text);
  const exactAction = actions.find((action) => normalizeActionLabel(action.label) === normalizedText);
  if (exactAction) {
    return exactAction;
  }

  return actions.find((action) => {
    const label = normalizeActionLabel(action.label);
    return label.includes(normalizedText) || normalizedText.includes(label);
  }) ?? null;
}

function findRunnableActionByCommand(
  actions: AgentChatFollowUpAction[],
  predicate: (command: AgentChatCommand, action: AgentChatFollowUpAction) => boolean,
) {
  return actions.find((action) => (
    action.kind === 'run-command' && predicate(action.command, action)
  )) ?? null;
}

function resolveContextActionByIntent(
  text: string,
  actions: AgentChatFollowUpAction[],
  previousCommand: AgentChatCommand,
) {
  if (!actions.length) {
    return null;
  }

  // Candidate numbers refer to runnable project candidates, not unrelated
  // observation actions in the same follow-up list.
  if (isProjectRunIntent(text)) {
    const actionIndex = parseActionIndex(text);
    const runActions = actions.filter((action): action is Extract<AgentChatFollowUpAction, { kind: 'run-command' }> => (
      action.kind === 'run-command'
      && action.command.toolCall?.name === 'run_local_project_action'
    ));

    if (actionIndex !== null) {
      return runActions[actionIndex - 1] ?? null;
    }

    return runActions[0] ?? null;
  }

  const explicitAction = resolveFollowUpActionByText(text, actions);
  if (explicitAction) {
    return explicitAction;
  }

  if (isExecutePreviousPlanIntent(text)) {
    return findRunnableActionByCommand(actions, (command, action) => (
      command.desktopOrganization?.mode === 'execute'
      || (
        command.toolCall?.name === 'organize_desktop_icons'
        && command.toolCall.input.mode === 'execute'
      )
      || /执行|计划/u.test(action.label)
    ));
  }

  if (isReobserveIntent(text)) {
    return findRunnableActionByCommand(actions, (command, action) => (
      command.desktopOrganization?.mode === 'preview'
      || (
        command.toolCall?.name === 'organize_desktop_icons'
        && command.toolCall.input.mode === 'preview'
      )
      || command.toolCall?.name === 'inspect_local_project'
      || /观察|分析|复查|查找/u.test(action.label)
    ));
  }


  return null;
}

function createCommandFromFollowUpAction(
  sourceText: string,
  action: AgentChatFollowUpAction,
) {
  if (action.kind !== 'run-command') {
    return null;
  }

  return {
    ...action.command,
    sourceText,
  };
}

export function resolveAgentFollowUpContinuationCommand(
  text: string,
  messages: ChatMessage[],
) {
  if (!isAgentContinuationConfirmation(text)) {
    return null;
  }

  const latestFollowUp = findLatestAgentContextMessage(messages);
  if (!latestFollowUp) {
    return null;
  }

  const sourceText = text.trim();
  const followUpActions = latestFollowUp.followUpActions?.length
    ? latestFollowUp.followUpActions
    : latestFollowUp.followUpAction
      ? [latestFollowUp.followUpAction]
      : [];
  const selectedAction = resolveContextActionByIntent(sourceText, followUpActions, latestFollowUp.command)
    ?? resolveFollowUpActionByText(sourceText, followUpActions)
    ?? followUpActions[0]
    ?? null;
  const selectedCommand = selectedAction
    ? createCommandFromFollowUpAction(sourceText, selectedAction)
    : null;

  if (selectedCommand) {
    return selectedCommand;
  }

  return null;
}
