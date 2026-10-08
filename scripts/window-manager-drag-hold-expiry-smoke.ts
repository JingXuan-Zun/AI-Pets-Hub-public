import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/petDragShapeHold.cjs').createPetDragShapeHold;
const scenarios = ['missing', 'empty', 'stale-before', 'stale-equal', 'fresh', 'no-ended-time',
  'active-drag', 'delayed-expiry', 'early-timer', 'resumed-drag', 'no-main', 'destroyed-main',
  'destroyed-before-refresh', 'replaced-main', 'fail:clear', 'fail:hide', 'fail:log',
  'fail:summary', 'fail:timer', 'fail:send', 'fail:pending-read', 'fail:pending-clear'];

export function exerciseDragHoldExpiry(factory = actual) {
  const outputs: unknown[] = [];
  for (const diagnostics of [false, true]) {
    for (const scenario of scenarios) outputs.push(runExpiry(factory, diagnostics, scenario));
  }
  return outputs;
}

function runExpiry(factory: any, diagnostics: boolean, scenario: string) {
  const calls: unknown[][] = [];
  const error = new Error('hold dependency failed');
  error.stack = 'Error: hold dependency failed';
  const record = (name: string, ...args: unknown[]) => {
    calls.push([name, ...args]);
    if (scenario === `fail:${name}`) throw error;
  };
  let now = 100, until = 100, active = scenario === 'active-drag';
  let holdTimer: any = { id: 0 }, pendingSignature = 'pending-signature';
  let pendingReceivedAt = scenario === 'stale-before' ? 49 : scenario === 'stale-equal' ? 50 : 51;
  const endedAt = scenario === 'no-ended-time' ? 0 : 50;
  let regions: any = scenario === 'missing' ? null : scenario === 'empty' ? [] : [{ x: 2, y: 3, width: 4, height: 5 }];
  if (['delayed-expiry', 'early-timer', 'resumed-drag'].includes(scenario)) until = 150;
  const timers: { id: number; callback: () => unknown; delay: number }[] = [];
  const cancelled = new Set<number>();
  let timerId = 0, failures = 0;
  const main = { id: 'main', destroyed: scenario === 'destroyed-main',
    isDestroyed() { record('main-destroyed', this.id); return this.destroyed; },
    webContents: { send: (...args: unknown[]) => record('send', 'main', ...args) },
  };
  let current: any = scenario === 'no-main' ? null : main;
  const shapeState = {
    getPetDragNativeShapeActive: () => { record('active'); return active; },
    getHoldUntil: () => { record('until'); return until; },
    getHoldTimer: () => { record('hold-timer'); return holdTimer; },
    setHoldTimer: (value: any) => { record('set-hold-timer', value?.id ?? null); holdTimer = value; },
    getPendingRegions: () => { record('pending-read'); return regions; },
    getPendingReceivedAt: () => { record('received-at'); return pendingReceivedAt; },
    setPendingRegions: (value: any) => { record('pending-clear', value); regions = value; },
    setPendingSignature: (value: string) => { record('pending-signature', value); pendingSignature = value; },
    setPendingReceivedAt: (value: number) => { record('received-clear', value); pendingReceivedAt = value; },
    getEndedAt: () => { record('ended-at'); return endedAt; },
  };
  const forbidden = () => { throw new Error('hold expiry must request fresh regions instead of applying deferred shape'); };
  const api = factory({
    shapeState, getCurrentTime: () => { record('time', now); return now; },
    getMainWindow: () => { record('main', current?.id ?? null); return current; },
    hidePostDragInputProxy: (reason: string) => record('hide', reason),
    logWindowEvent: (message: string) => record('log', message), pointerDiagnosticsEnabled: diagnostics,
    summarizeInteractiveRegion: (value: unknown) => { record('summary', value); return JSON.stringify(value); },
    applyInteractiveWindowShape: forbidden, applyPointerPassthroughState: forbidden,
    setTimeout: (callback: () => unknown, delay: number) => {
      record('timer', delay); const id = ++timerId; timers.push({ id, callback, delay });
      return { id, unref: () => record('unref', id) };
    },
    clearTimeout: (timer: any) => { record('clear', timer.id); cancelled.add(timer.id); },
  });
  assert.deepEqual(calls, [], 'constructing hold control does not read state');
  const invoke = (callback: () => unknown) => {
    try { assert.equal(callback(), undefined); } catch (caught) { assert.equal(caught, error); failures++; }
  };
  invoke(api.schedulePetDragFullWindowShapeHoldExpiry);
  if (timers[0]?.delay > 0) {
    const timer = timers.shift()!;
    now = scenario === 'early-timer' ? 120 : 150;
    if (scenario === 'resumed-drag') active = true;
    record('fire', timer.id, now); invoke(timer.callback);
    if (scenario === 'early-timer') {
      const second = timers.shift()!; assert.equal(second.delay, 30);
      now = 150; record('fire', second.id, now); invoke(second.callback);
    }
  }
  if (scenario === 'destroyed-before-refresh') main.destroyed = true;
  if (scenario === 'replaced-main') current = { ...main, id: 'replacement',
    webContents: { send: (...args: unknown[]) => record('send', 'replacement', ...args) } };
  for (const timer of timers.splice(0)) {
    assert.equal(timer.delay, 0); assert.equal(cancelled.has(timer.id), false);
    record('fire', timer.id, now); invoke(timer.callback);
  }
  const sends = calls.filter(([name]) => name === 'send');
  const expired = !['active-drag', 'resumed-drag'].includes(scenario);
  if (!scenario.startsWith('fail:')) {
    assert.equal(failures, 0);
    if (expired) { assert.equal(regions, null); assert.equal(pendingSignature, ''); assert.equal(pendingReceivedAt, 0); }
    else { assert.equal(pendingSignature, 'pending-signature'); assert.equal(calls.some(([name]) => name === 'hide'), false); }
    const refresh = expired && !['no-main', 'destroyed-main', 'destroyed-before-refresh'].includes(scenario);
    assert.equal(sends.length, refresh ? 1 : 0);
    if (refresh) {
      const reason = scenario === 'missing' ? 'missing-deferred-shape'
        : ['empty', 'stale-before', 'stale-equal'].includes(scenario) ? 'stale-deferred-shape' : 'post-drag-hold-expired';
      assert.equal(JSON.stringify(sends[0]), JSON.stringify(['send', scenario === 'replaced-main' ? 'replacement' : 'main',
        'desktop-pet:refresh-native-interactive-regions', { reason }]));
    }
  } else {
    assert.equal(failures, !diagnostics && ['fail:log', 'fail:summary'].includes(scenario) ? 0 : 1);
  }
  return [diagnostics, scenario, calls, { now, until, active, regions, pendingSignature, pendingReceivedAt,
    holdTimer: holdTimer?.id ?? null, failures }];
}

const outputs = exerciseDragHoldExpiry();
console.log(`Drag hold expiry smoke passed (${outputs.length} cases; timed recovery, stale regions, live windows and failures).`);
