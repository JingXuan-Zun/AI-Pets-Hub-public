import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const actual = createRequire(import.meta.url)('../electron/windowManager/petDragNativeShapeSession.cjs').createPetDragNativeShapeSession;
export function exerciseNativeDragSession(factory = actual) {
  const results: unknown[] = [];
  for (const separated of [false, true]) for (const initial of [false, true])
  for (const input of [false, true, null, 0, 'drag', {}]) for (const full of [false, true])
  for (const diagnostics of [false, true]) for (const race of ['same', 'resumed', 'expired']) for (const retained of [false, true]) {
    results.push(run({ separated, initial, input, full, diagnostics, race, retained }));
  }
  for (const failure of ['active', 'set-active', 'ensure-proxy', 'pending', 'pending-signature', 'received', 'ended', 'hold',
    'clear', 'ensure-full', 'log', 'time', 'pointer', 'fresh', 'schedule', 'request', 'timer', 'flush']) {
    for (const branch of ['start', 'bounded-end', 'full-end', 'proxy-start', 'proxy-end', 'refresh']) {
      results.push(run({ separated: branch.startsWith('proxy'), initial: !['start', 'proxy-start'].includes(branch),
        input: ['start', 'proxy-start', 'refresh'].includes(branch), full: branch === 'full-end',
        diagnostics: true, race: 'same', retained: true, failure }));
    }
  }
  return results;
  function run(config: any) {
    const calls: unknown[][] = [], errors: string[] = [], error = new Error('session failure'); error.stack = 'Error: session failure';
    let active = config.initial, pending: unknown = 'pending', pendingSignature = 'pending', received = -1, ended = -1, hold = -1, now = 100;
    let retained = config.retained; const timers: (() => void)[] = [];
    const step = (name: string, ...values: unknown[]) => { calls.push([name, ...values]); if (name === config.failure) throw error; };
    const api = factory({
      shapeState: {
        getPetDragNativeShapeActive: () => { step('active'); return active; },
        setPetDragNativeShapeActive: (value: boolean) => { step('set-active', value); active = value; },
        getRegions: () => [{ full: config.full }], getApplied: () => false,
        setPendingRegions: (value: unknown) => { step('pending', value); pending = value; },
        setPendingSignature: (value: string) => { step('pending-signature', value); pendingSignature = value; },
        setPendingReceivedAt: (value: number) => { step('received', value); received = value; },
        setEndedAt: (value: number) => { step('ended', value); ended = value; },
        setHoldUntil: (value: number) => { step('hold', value); hold = value; },
      },
      getCurrentTime: () => { step('time', now); return now++; },
      isFullWindowInteractiveShape: (value: any[]) => value[0]?.full,
      isPetDragFullWindowShapeRetained: () => { step('retained'); return retained; },
      ensurePetDragFullWindowInteractiveShape: (reason: string) => step('ensure-full', reason),
      clearPetDragFullWindowShapeHoldTimer: () => step('clear'), schedulePetDragFullWindowShapeHoldExpiry: () => step('schedule'),
      scheduleNativeShapeRefreshAfterPetDragHold: (reason: string) => step('fresh', reason),
      applyPointerPassthroughState: () => step('pointer'), ensurePostDragInputProxyWindow: () => step('ensure-proxy'),
      flushPostDragInputProxyPendingRegions: (reason: string) => { assert.equal(active, false); step('flush', reason); },
      requestPostDragInputProxyRegions: (reason: string) => step('request', reason),
      logWindowEvent: (message: string) => step('log', message), pointerDiagnosticsEnabled: config.diagnostics,
      USE_SEPARATE_RENDER_AND_INPUT_WINDOWS: config.separated, PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS: 720,
      setTimeout: (callback: () => void, delay: number) => { assert.equal(delay, 32); step('timer', delay); timers.push(callback); },
    });
    assert.deepEqual(calls, []);
    const invoke = (label: string, fn: () => unknown) => {
      try { assert.equal(fn(), undefined); } catch (caught) { assert.equal(caught, error); errors.push(label); }
    };
    invoke('request', () => api(config.input));
    if (!config.failure) {
      assert.equal(active, Boolean(config.input));
      if (!config.separated && !config.initial && active) {
        assert.equal(pending, null); assert.equal(pendingSignature, ''); assert.equal(received, 0); assert.equal(ended, 0); assert.equal(hold, 0);
      }
      if (!config.separated && config.initial && !active) {
        assert.equal(ended, 100); assert.equal(hold, config.full ? 821 : 0);
        assert.equal(timers.length, config.full ? 1 : 0);
      }
    }
    const repeatStart = calls.length; invoke('repeat', () => api(config.input));
    if (!config.failure && config.separated) assert.deepEqual(calls.slice(repeatStart), [['active']], 'separate repeated requests must have no effects');
    if (config.race === 'resumed') active = true;
    if (config.race === 'expired') retained = false;
    const callbackStart = calls.length; for (const callback of timers) invoke('callback', callback);
    if (!config.failure && timers.length) {
      const postRequests = calls.slice(callbackStart).filter(call => call[0] === 'request');
      assert.deepEqual(postRequests, !active && retained ? [['request', 'pet-drag-session-ended-post-commit']] : []);
    }
    return { config, calls, errors, active, pending, pendingSignature, received, ended, hold, now };
  }
}
const source = fs.readFileSync('electron/windowManager/petDragNativeShapeSession.cjs', 'utf8');
for (const failure of [false, true]) {
  const calls: string[] = [], error = new Error('assembly failure');
  const dependencies = Object.fromEntries(['shapeState', 'getCurrentTime', 'isFullWindowInteractiveShape', 'isPetDragFullWindowShapeRetained',
    'ensurePetDragFullWindowInteractiveShape', 'clearPetDragFullWindowShapeHoldTimer', 'schedulePetDragFullWindowShapeHoldExpiry',
    'scheduleNativeShapeRefreshAfterPetDragHold', 'applyPointerPassthroughState', 'ensurePostDragInputProxyWindow',
    'flushPostDragInputProxyPendingRegions', 'requestPostDragInputProxyRegions', 'logWindowEvent', 'pointerDiagnosticsEnabled',
    'USE_SEPARATE_RENDER_AND_INPUT_WINDOWS', 'PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS', 'setTimeout']
    .map(key => [key, () => assert.fail(`no eager ${key}`)]));
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, require: () => ({ createPetDragNativeSessionActions(input: Record<string, unknown>) {
    calls.push('actions'); for (const [key, value] of Object.entries(input)) assert.equal(value, dependencies[key]);
    if (failure) throw error;
    return Object.fromEntries(['setSeparateWindowPetDragActive', 'startPetDragNativeShapeSession', 'endPetDragNativeShapeSession']
      .map(key => [key, () => assert.fail(`no eager ${key}`)]));
  } }) });
  let result: unknown, caught: unknown;
  try { result = module.exports.createPetDragNativeShapeSession(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failure ? error : undefined); assert.deepEqual(calls, ['actions']);
  if (!failure) assert.equal(typeof result, 'function');
}
console.log(`Native drag session passed (${exerciseNativeDragSession().length} transition, repetition, post-commit race and error cases; shared state and lazy assembly).`);
