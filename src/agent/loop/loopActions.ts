// The only actions the loop's model may choose, and the single place their JSON is parsed.

export type LoopAction =
  | { action: 'observe'; window: string }
  | { action: 'look'; question: string }
  | { action: 'launch_app'; name: string }
  | { action: 'focus_window'; window: string }
  | { action: 'click' | 'double_click' | 'right_click'; element: number }
  | { action: 'type_text'; element?: number; text: string }
  | { action: 'press_keys'; keys: string }
  | { action: 'wait'; seconds: number; until?: string }
  | { action: 'ask_user'; question: string }
  | { action: 'done'; summary: string };

/** One short log line per action, reused by the task log and approval text. */
export function describeLoopAction(action: LoopAction, elementLabel?: string) {
  switch (action.action) {
    case 'observe': return `读取窗口「${action.window}」`;
    case 'look': return `视觉查看：${action.question}`;
    case 'launch_app': return `启动「${action.name}」`;
    case 'focus_window': return `切换到「${action.window}」`;
    case 'click': return `点击 [${action.element}]${elementLabel ? `「${elementLabel}」` : ''}`;
    case 'double_click': return `双击 [${action.element}]${elementLabel ? `「${elementLabel}」` : ''}`;
    case 'right_click': return `右键 [${action.element}]${elementLabel ? `「${elementLabel}」` : ''}`;
    case 'type_text': return `输入「${action.text.length > 30 ? `${action.text.slice(0, 30)}…` : action.text}」`;
    case 'press_keys': return `按键 ${action.keys}`;
    case 'wait': return `等待 ${action.seconds} 秒${action.until ? `（直到出现「${action.until}」）` : ''}`;
    case 'ask_user': return `询问用户：${action.question}`;
    case 'done': return `完成：${action.summary}`;
  }
}
