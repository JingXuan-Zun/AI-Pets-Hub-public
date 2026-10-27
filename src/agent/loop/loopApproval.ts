import { describeLoopAction, type LoopAction } from './loopActions';

// Approval policy (2026-10-20, user: “很多都可以直接不用询问”): opening an app or bringing a window
// to the front changes nothing and never asks. One approval covers the task scope; inside it,
// clicks, ordinary keys and typing text run without asking (typing alone sends nothing — Enter
// right after typing still asks). Sending, deleting, paying and closing programs ask every time.
// Each spoken question cost 20-60 s, so tasks like 打开记事本写… had become twice as slow.

export type LoopActionRisk = 'free' | 'scope' | 'confirm';

export interface LoopApprovalRequest {
  detail: string;
  kind: 'task-scope' | 'action';
  title: string;
}

export type LoopApprovalHandler = (request: LoopApprovalRequest) => Promise<boolean>;

const RISKY_LABEL = /(?:发送|发布|提交订单|删除|移除|清空|卸载|支付|付款|购买|下单|充值|转账|关闭程序|退出程序|退出登录|注销|格式化|send|post|publish|delete|remove|uninstall|pay|purchase|buy|checkout|transfer|log\s*out|sign\s*out|format)/iu;
const RISKY_KEYS = /(?:%\{F4\}|\{DEL(?:ETE)?\}|\+\{DEL(?:ETE)?\})/iu;
const SUBMIT_KEYS = /^\s*(?:\{ENTER\}|~|\^\{ENTER\})\s*$/iu;

export function classifyLoopActionRisk(
  action: LoopAction,
  context: { elementLabel?: string; previousAction?: LoopAction | null } = {},
): { reason: string; risk: LoopActionRisk } {
  switch (action.action) {
    case 'observe':
    case 'look':
    case 'wait':
    case 'ask_user':
    case 'done':
      return { reason: '只读或结束动作', risk: 'free' };
    case 'type_text':
      return { reason: '任务范围内的输入文字', risk: 'scope' };
    case 'press_keys':
      if (RISKY_KEYS.test(action.keys)) return { reason: '可能删除或关闭程序的按键', risk: 'confirm' };
      if (SUBMIT_KEYS.test(action.keys) && context.previousAction?.action === 'type_text') {
        return { reason: '输入文字后按回车可能会发送', risk: 'confirm' };
      }
      return { reason: '任务范围内的按键', risk: 'scope' };
    case 'click':
    case 'double_click':
    case 'right_click':
      return context.elementLabel && RISKY_LABEL.test(context.elementLabel)
        ? { reason: `「${context.elementLabel}」可能是发送/删除/付款/退出类操作`, risk: 'confirm' }
        : { reason: '任务范围内的点击', risk: 'scope' };
    case 'launch_app':
    case 'focus_window':
      return { reason: '打开或切换窗口', risk: 'free' };
  }
}

export function createTaskScopeApprovalRequest(goal: string): LoopApprovalRequest {
  return {
    detail: [
      `任务：${goal}`,
      '批准后，执行这个任务需要的点击、按键、输入文字不再逐个询问。',
      '发送、删除、付款、关闭程序等操作仍会单独询问。',
    ].join('\n'),
    kind: 'task-scope',
    title: '允许执行这个任务？',
  };
}

export function createActionApprovalRequest(action: LoopAction, reason: string, elementLabel?: string): LoopApprovalRequest {
  return {
    detail: `${describeLoopAction(action, elementLabel)}\n原因：${reason}`,
    kind: 'action',
    title: '这一步需要你确认',
  };
}
