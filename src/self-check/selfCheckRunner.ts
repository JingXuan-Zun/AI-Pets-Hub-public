import { SELF_CHECK_ITEMS } from './selfCheckItems';
import type { DiagnosticItem, DiagnosticResult, SelfCheckDeps, SelfCheckEntry } from './selfCheckTypes';

// Runs the checks one by one. A problem with a safe fix is fixed and checked again; the
// result after that second check is what counts. Every run is kept in a short local log
// (level 2 of the design will read it).

const LOG_STORAGE_KEY = 'desktop-pet.self-check-log.v1';
const MAX_LOG_ENTRIES = 100;
const CHECK_TIMEOUT_MS = 20000;

function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = CHECK_TIMEOUT_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => { timer = setTimeout(() => resolve(fallback), timeoutMs); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function safeCheck(item: DiagnosticItem, deps: SelfCheckDeps): Promise<DiagnosticResult> {
  try {
    return await withTimeout(item.check(deps), { status: 'unknown', summary: '检查超时。' } as DiagnosticResult, item.timeoutMs);
  } catch (error) {
    return { status: 'unknown', summary: `检查时出错：${error instanceof Error ? error.message : String(error)}` };
  }
}

export async function runSelfCheck(
  deps: SelfCheckDeps,
  options: { applySafeFixes?: boolean; items?: DiagnosticItem[] } = {},
): Promise<SelfCheckEntry[]> {
  const entries: SelfCheckEntry[] = [];
  for (const item of options.items ?? SELF_CHECK_ITEMS) {
    if (!item.applies(deps)) continue;
    let result = await safeCheck(item, deps);
    let repair = null;
    if (result.status === 'problem' && item.fix && item.risk === 'safe' && options.applySafeFixes !== false) {
      repair = await withTimeout(item.fix(deps), { ok: false, summary: '修复超时。' }, item.timeoutMs).catch((error: unknown) => ({ ok: false, summary: String(error) }));
      result = await safeCheck(item, deps);
    }
    entries.push({ checkedAt: Date.now(), id: item.id, repair, result, title: item.title });
  }
  appendSelfCheckLog(entries);
  return entries;
}

/** One line per check, for the chat and the log. */
export function formatSelfCheckReport(entries: SelfCheckEntry[]) {
  if (!entries.length) return '没有需要检查的项目。';
  return entries.map((entry) => {
    const mark = entry.result.status === 'ok' ? '✅' : entry.result.status === 'problem' ? '❌' : '❔';
    const repaired = entry.repair ? `（${entry.repair.ok ? '已尝试修复' : '修复失败'}：${entry.repair.summary}）` : '';
    const advice = entry.result.status === 'problem' && entry.result.advice ? ` 建议：${entry.result.advice}` : '';
    return `${mark} ${entry.title}：${entry.result.summary ?? '正常'}${repaired}${advice}`;
  }).join('\n');
}

export function readSelfCheckLog(): SelfCheckEntry[] {
  try {
    const parsed = JSON.parse(globalThis.localStorage?.getItem(LOG_STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function appendSelfCheckLog(entries: SelfCheckEntry[]) {
  if (!entries.length) return;
  try {
    globalThis.localStorage?.setItem(LOG_STORAGE_KEY, JSON.stringify([...readSelfCheckLog(), ...entries].slice(-MAX_LOG_ENTRIES)));
  } catch {
    // The log is a convenience; a full or blocked storage must not break the check.
  }
}
