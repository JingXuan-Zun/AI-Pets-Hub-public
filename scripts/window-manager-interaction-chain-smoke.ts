import assert from 'node:assert/strict';
import {
  interactionScenarioConfigs,
  readManagerSource,
  runInteractionScenario,
} from './windowManagerInteractionHarness.ts';

function segment(trace: string[], label: string) {
  const start = trace.indexOf(`== ${label}`);
  assert.ok(start >= 0, `scenario step should run: ${label}`);
  const end = trace.findIndex((line, index) => index > start && line.startsWith('== '));
  return trace.slice(start + 1, end < 0 ? trace.length : end);
}

const source = readManagerSource();
for (const config of interactionScenarioConfigs) {
  const label = JSON.stringify(config);
  const trace = await runInteractionScenario(source, config);
  assert.deepEqual(await runInteractionScenario(source, config), trace, `trace should be deterministic ${label}`);
  assert.deepEqual(trace.filter((line) => line.startsWith('error ') || line.startsWith('timer-error')), [], label);

  const separate = config.platform === 'win32';
  const created = segment(trace, 'create main window');
  assert.equal(created.filter((line) => line.startsWith('new BrowserWindow')).length, separate ? 2 : 1, label);
  assert.ok(created.includes('win1.setIgnoreMouseEvents([true,{"forward":false}])'), label);

  const cachedTop = segment(trace, 'keep main on top cached');
  assert.equal(cachedTop.some((line) => line.includes('.setAlwaysOnTop(')), false, `cached topmost state should skip native refresh ${label}`);
  const newLevel = segment(trace, 'keep main on top new level');
  assert.ok(newLevel.includes('win1.setAlwaysOnTop([true,"pop-up-menu",2])'), label);
  assert.ok(newLevel.includes('win1.moveTop([])'), label);
  assert.equal(segment(trace, 'keep chat window').some((line) => line.includes('setAlwaysOnTop([true')), false, label);

  const mouseDown = segment(trace, 'proxy mouseDown').find((line) => line.includes('sendInputEvent'));
  assert.equal(mouseDown, 'win1.wc.sendInputEvent([{"type":"mouseDown","x":12,"y":900,"button":"right","clickCount":3,"movementX":2,"movementY":0}])', label);
  assert.ok(segment(trace, 'proxy mouseMove').some((line) => line.includes('{"type":"mouseMove","x":0,"y":4,"button":"left","clickCount":1')), `negative input is clamped ${label}`);
  assert.ok(segment(trace, 'proxy wheel').some((line) => line.includes('"deltaY":-120')), `wheel delta should use DOM sign ${label}`);
  for (const ignored of ['proxy unsupported', 'proxy wrong sender']) {
    assert.equal(segment(trace, ignored).some((line) => line.includes('sendInputEvent')), false, `${ignored} ${label}`);
  }

  const dragEnd = segment(trace, 'drag end');
  const refreshReason = separate ? 'input-proxy-drag-ended' : 'pet-drag-session-ended';
  assert.ok(dragEnd.some((line) => line.includes(`"inputProxy":true,"reason":"${refreshReason}"`)), label);
  assert.equal(trace.some((line) => line.startsWith('win1.setShape')), false, `render window shape stays unused ${label}`);
  const proxyShapeApplied = trace.some((line) => line.startsWith('win') && line.endsWith('.setShape([[{"height":40,"width":40,"x":5,"y":5}]])'));
  assert.equal(proxyShapeApplied, separate, `render input proxy regions apply only with separate input windows ${label}`);

  const disposed = trace.slice(trace.indexOf('== dispose'));
  assert.ok(disposed.some((line) => line.startsWith('clearTimer#')), label);
  assert.equal(disposed.some((line) => line.startsWith('fire#')), false, `dispose should leave no pending manager timers ${label}`);
}

console.log(`Window manager interaction chain smoke passed (${interactionScenarioConfigs.length} configurations, real manager with recorded native calls).`);
