// Shared state between the Live2D renderer harness and its fake modules.
export const harnessState = {
  trace: [] as string[],
  now: 1_000,
  timerSeq: 0,
  timers: new Map<number, { due: number; callback: () => void; interval?: number }>(),
  animationFrames: new Map<number, () => void>(),
  tickerErrorHandlers: [] as Array<(error: unknown, count: number) => void>,
  failingModelUrls: new Set<string>(),
  sequences: new Map<string, number>(),
};

export function nextFakeId(prefix: string) {
  const next = (harnessState.sequences.get(prefix) ?? 0) + 1;
  harnessState.sequences.set(prefix, next);
  return `${prefix}${next}`;
}

export function describeValue(value: unknown, depth = 0): unknown {
  if (typeof value === 'function') return '[fn]';
  if (value instanceof Error) return `[Error ${value.message}]`;
  if (value && typeof value === 'object' && '__fakeId' in (value as object)) {
    return `[${(value as { __fakeId: string }).__fakeId}]`;
  }
  if (value instanceof Set) return [...value].map((entry) => describeValue(entry, depth + 1));
  if (Array.isArray(value)) return depth > 4 ? '[array]' : value.map((entry) => describeValue(entry, depth + 1));
  if (value && typeof value === 'object') {
    if (depth > 4) return '[object]';
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, describeValue(entry, depth + 1)]));
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return String(value);
  return value;
}

export function record(label: string, ...args: unknown[]) {
  harnessState.trace.push(args.length ? `${label} ${JSON.stringify(describeValue(args))}` : label);
}

export function resetHarnessState() {
  harnessState.trace = [];
  harnessState.now = 1_000;
  harnessState.timerSeq = 0;
  harnessState.timers.clear();
  harnessState.animationFrames.clear();
  harnessState.tickerErrorHandlers = [];
  harnessState.failingModelUrls.clear();
  harnessState.sequences.clear();
}

export function fakeSetTimeout(callback: () => void, delay = 0) {
  const id = ++harnessState.timerSeq;
  harnessState.timers.set(id, { due: harnessState.now + Number(delay || 0), callback });
  record(`setTimeout#${id}`, delay);
  return id;
}

export function fakeClearTimeout(id: number | null | undefined) {
  record(`clearTimeout#${id}`);
  if (typeof id === 'number') harnessState.timers.delete(id);
}

export function fakeSetInterval(callback: () => void, delay = 0) {
  const id = ++harnessState.timerSeq;
  const interval = Math.max(1, Number(delay || 0));
  harnessState.timers.set(id, { due: harnessState.now + interval, callback, interval });
  record(`setInterval#${id}`, delay);
  return id;
}

export function fakeClearInterval(id: number | null | undefined) {
  record(`clearInterval#${id}`);
  if (typeof id === 'number') harnessState.timers.delete(id);
}

export function fakeRequestAnimationFrame(callback: () => void) {
  const id = ++harnessState.timerSeq;
  harnessState.animationFrames.set(id, callback);
  record(`requestAnimationFrame#${id}`);
  return id;
}

export function fakeCancelAnimationFrame(id: number | null | undefined) {
  record(`cancelAnimationFrame#${id}`);
  if (typeof id === 'number') harnessState.animationFrames.delete(id);
}

export function flushFakeAnimationFrames() {
  const frames = [...harnessState.animationFrames.entries()];
  harnessState.animationFrames.clear();
  for (const [id, callback] of frames) {
    record(`frame#${id}`);
    callback();
  }
}

export function advanceFakeClock(ms: number) {
  const target = harnessState.now + ms;
  for (;;) {
    const next = [...harnessState.timers.entries()]
      .filter(([, timer]) => timer.due <= target)
      .sort((a, b) => a[1].due - b[1].due || a[0] - b[0])[0];
    if (!next) break;
    if (next[1].interval) next[1].due += next[1].interval;
    else harnessState.timers.delete(next[0]);
    harnessState.now = next[1].due - (next[1].interval ?? 0);
    record(`fire#${next[0]}@${harnessState.now}`);
    next[1].callback();
  }
  harnessState.now = target;
}
