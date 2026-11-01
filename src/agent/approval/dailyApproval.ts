import { useSyncExternalStore } from 'react';

// "今天都允许" (user, 2026-11-01): one yes covers every everyday tool step for the rest of the
// day, so tasks stop asking each time. Steps that cannot be taken back (sending, deleting,
// paying, closing programs, overwriting, forgetting) still ask every time. Any "no" ends the
// day's approval at once: the next step asks again. It also ends at midnight. Kept in
// localStorage so the chat window, the settings window and the pet see the same state.

const STORAGE_KEY = 'desktop-pet.daily-tool-approval.v1';

const IRREVERSIBLE = /(?:发送|发给|发出|回复给|发布|提交|删除|删掉|移除|清空|卸载|覆盖|支付|付款|购买|下单|充值|转账|关闭|关掉|退出程序|退出登录|注销|格式化|忘掉|忘记|send|post|publish|submit|delete|remove|uninstall|overwrite|pay|purchase|buy|checkout|transfer|log\s*out|sign\s*out|format)/iu;

const listeners = new Set<() => void>();

function today(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function readDay() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null') as { day?: unknown } | null;
    return typeof saved?.day === 'string' ? saved.day : '';
  } catch {
    return '';
  }
}

function write(day: string | null) {
  try {
    if (day) window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ day, grantedAt: Date.now() }));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {}
  listeners.forEach((listener) => listener());
}

export function isDailyApprovalActive(now = new Date()) {
  return readDay() === today(now);
}

export function grantDailyApproval() {
  write(today());
}

export function revokeDailyApproval() {
  if (readDay()) write(null);
}

/** Steps that cannot be taken back ask every time, whatever was approved before. */
export function isIrreversibleApproval(text: string) {
  return IRREVERSIBLE.test(text);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => { if (event.key === STORAGE_KEY) listener(); };
  window.addEventListener('storage', onStorage);
  // Midnight passes without any event: look again every minute.
  const timer = window.setInterval(listener, 60_000);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
    window.clearInterval(timer);
  };
}

export function useDailyApprovalActive() {
  return useSyncExternalStore(subscribe, () => isDailyApprovalActive(), () => false);
}
