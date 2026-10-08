import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const lifecycleStateSource = fs.readFileSync('electron/windowManager/mainWindowLifecycleStateAdapters.cjs', 'utf8');
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/mainWindowReadyFallback.cjs').createMainWindowReadyFallbackScheduler;
export function exerciseMainReadyFallback(factory = actual) {
  const outputs: unknown[] = [];
  for (const windowState of ['null', 'destroyed', 'normal']) for (const ready of [false, true]) for (const recovery of [false, true])
    for (const count of [-1, 0, 1, 2, '0']) for (const old of [null, 0, 'old']) for (const unref of ['none', 'method', 'truthy']) run({ windowState, ready, recovery, count, old, unref });
  const normal = { windowState: 'normal', ready: false, recovery: false, count: 0, old: 'old', unref: 'method' };
  for (const failure of ['timer', 'clear', 'setTimer', 'timeout', 'unrefGetter', 'unref']) run(normal, failure, 'schedule');
  for (const failure of ['setTimer', 'ready', 'recovery', 'window', 'destroyed', 'increment', 'log', 'recover']) run(normal, failure, 'callback');
  run({ ...normal, ready: true }, 'mark', 'callback');
  for (const race of ['readyBeforeFire', 'recoveryBeforeFire', 'replaceWindow', 'limitBeforeFire', 'unrefSwap', 'logSwap', 'doubleSchedule']) run(normal, undefined, undefined, race);
  return JSON.parse(JSON.stringify(outputs));
  function run(config: any, failure?: string, failurePhase?: string, race?: string) {
    const calls: any[][] = [], callbacks: Array<() => void> = [], error = new Error('ready fallback dependency error');
    let phase = 'construct', ready = config.ready, recovery = config.recovery, count: any = config.count;
    let current: any, timer: any = config.old, thrown = false;
    const step = (name: string, value?: unknown) => { calls.push([name, value]); if (name === failure && phase === failurePhase) throw error;
      if (race === 'logSwap' && name === 'log') current = other; };
    function window(id: string) { return { id, isDestroyed() { step('destroyed', id); return config.windowState === 'destroyed'; }, webContents: { id } }; }
    const self = window('self'), other = window('other'); current = config.windowState === 'null' ? null : self;
    function handle(id: string) { const h = { id, get unref(): any { step('unrefGetter', id); if (race === 'unrefSwap') timer = newer;
      return config.unref === 'none' ? undefined : config.unref === 'truthy' ? true : function(this: unknown) { assert.equal(this, h); step('unref', id); }; } }; return h; }
    const newer = { id: 'newer', unref() { step('newerUnref'); } };
    const deps = { getReadyFallbackTimer() { step('timer', timer?.id ?? timer); return timer; },
      setReadyFallbackTimer(value: any) { step('setTimer', value?.id ?? value); timer = value; },
      getRendererReadyToShow() { step('ready', ready); return ready; }, getRendererRecoveryInProgress() { step('recovery', recovery); return recovery; },
      getMainWindow() { step('window', current?.id ?? null); return current; }, getStartupRecoveryCount() { return count; },
      incrementStartupRecoveryCount() { step('increment'); count += 1; },
      logWindowEvent(message: string) { step('log', message); }, recoverMainWindowRenderer(contents: any, details: unknown) { step('recover', { id: contents.id, details }); },
      markMainWindowReadyToShow(reason: string) { step('mark', reason); },
      setTimeout(callback: () => void, delay: number) { step('timeout', delay); assert.equal(delay, 10000); callbacks.push(callback); return handle('timer-' + callbacks.length); },
      clearTimeout(value: any) { step('clear', value?.id ?? value); }, MAIN_WINDOW_RENDERER_READY_TIMEOUT_MS: 10000, MAIN_WINDOW_RENDERER_STARTUP_RECOVERY_LIMIT: 1,
    };
    const schedule = factory(deps); assert.deepEqual(calls, [], 'construction must not read state or touch timers');
    try {
      phase = 'schedule'; assert.equal(schedule(), undefined); assert.equal(callbacks.length, 1);
      assert.deepEqual(calls.filter(c => c[0] === 'clear').map(c => c[1]), config.old ? [config.old] : []);
      if (race === 'readyBeforeFire') ready = true;
      if (race === 'recoveryBeforeFire') recovery = true;
      if (race === 'replaceWindow') current = other;
      if (race === 'limitBeforeFire') count = 1;
      if (race === 'doubleSchedule') { assert.equal(schedule(), undefined); assert.equal(callbacks.length, 2); }
      const at = calls.length, beforeCount = count, eligible = !ready && !recovery && current && config.windowState !== 'destroyed' && count < 1;
      phase = 'callback'; assert.equal(callbacks[0](), undefined); assert.equal(timer, null, 'queued original callback clears even a newer timer');
      assert.equal(calls[at][0], 'setTimer');
      if (eligible) {
        assert.equal(count, beforeCount + 1); assert.equal(calls.at(-1)?.[0], 'recover');
        assert.deepEqual(calls.at(-1)?.[1]?.details, { reason: 'renderer-ready-timeout' });
        assert.equal(calls.find(c => c[0] === 'log')?.[1], `main-window: renderer ready timeout recovery=${count}`);
      } else { assert.equal(count, beforeCount); assert.deepEqual(calls.at(-1), ['mark', 'renderer-ready-timeout-exhausted']); }
      if (race === 'doubleSchedule') assert.equal(callbacks[1](), undefined);
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); thrown = true; }
    assert.equal(thrown, Boolean(failure)); outputs.push({ config, failure, failurePhase, race, calls, count, timer: timer?.id ?? timer, thrown });
  }
}
const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
assert.match((root + lifecycleStateSource), /setReadyFallbackTimer: \(timer\) => \{ managerState\.mainWindowRendererReadyFallbackTimer = timer; \}/);
assert.match((root + lifecycleStateSource), /incrementStartupRecoveryCount: \(\) => \{ managerState\.mainWindowRendererStartupRecoveryCount \+= 1; \}/);
assert.match((root + lifecycleStateSource), /getRendererReadyToShow: \(\) => managerState\.mainWindowRendererReadyToShow/);
assert.match((root + lifecycleStateSource), /getRendererRecoveryInProgress: \(\) => managerState\.mainWindowRendererRecoveryInProgress/);
assert.match(root, /setTimeout: \(callback, delay\) => setTimeout\(callback, delay\)/);
const source = ts.createSourceFile('disposal.cjs', fs.readFileSync('electron/windowManager/windowManagerDisposal.cjs', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
let dispose: ts.FunctionDeclaration | ts.FunctionExpression | undefined;
function visit(n: ts.Node) { if ((ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n)) && n.name?.text === 'dispose') dispose = n; ts.forEachChild(n, visit); } visit(source);
const block = dispose!.body!.statements.find(n => ts.isIfStatement(n) && n.expression.getText(source) === 'mainWindowRendererReadyFallbackTimer'); assert.ok(block);
const owner = new Function('clearTimeout', `let mainWindowRendererReadyFallbackTimer; return {set:value=>{mainWindowRendererReadyFallbackTimer=value;},read:()=>mainWindowRendererReadyFallbackTimer,dispose:()=>{${block.getText(source).replace("setReadyFallbackTimer(null)", "mainWindowRendererReadyFallbackTimer = null")}}};`);
for (const handle of [null, 0, { id: 'pending' }]) { const calls: unknown[] = [], api = owner((value: unknown) => calls.push(value)); api.set(handle); api.dispose(); api.dispose(); assert.deepEqual(calls, handle ? [handle] : []); assert.equal(api.read(), handle ? null : handle); }
console.log(`Main ready fallback smoke passed (${exerciseMainReadyFallback().length} scenarios + 3 root disposal cases).`);
