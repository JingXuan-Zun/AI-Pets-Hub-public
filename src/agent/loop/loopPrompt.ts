
import { type LoopWindow } from './observationTiers';
const MAX_WINDOWS_LISTED = 15;

function formatWindow(window: LoopWindow) {
  return `${window.title || '(无标题)'}｜${window.processName}｜hwnd=${window.hwnd}${window.box ? '' : '｜最小化/不可见'}`;
}

export function formatLoopWindows(windows: LoopWindow[], active: LoopWindow | null) {
  const visible = windows.filter((window) => !/^AI Desktop Pet\b/iu.test(window.title)).slice(0, MAX_WINDOWS_LISTED);
  return [
    `前台窗口：${active ? formatWindow(active) : '未知'}`,
    ...visible.map((window) => `- ${formatWindow(window)}`),
  ].join('\n');
}
