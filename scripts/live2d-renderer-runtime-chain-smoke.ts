import assert from 'node:assert/strict';
import { assertImplementationModuleGraph } from './implementationModuleGuard.ts';
import { runLive2DRendererScenario } from './live2dRendererHarness/runLive2DRendererScenario.ts';

// Real PetLive2DRenderer render/effect chain with recording Pixi, Cubism,
// controller and logger fakes (no source-text assertions).
assertImplementationModuleGraph({
  entry: 'src/components/pet/PetLive2DRenderer.tsx',
  directory: 'src/components/pet/live2dRenderer',
});

const PetLive2DRenderer = (await import('../src/components/pet/PetLive2DRenderer.tsx')).default;

function segment(trace: string[], label: string) {
  const start = trace.indexOf(`== ${label}`);
  assert.ok(start >= 0, `scenario step should run: ${label}`);
  const end = trace.findIndex((line, index) => index > start && line.startsWith('== '));
  return trace.slice(start + 1, end < 0 ? trace.length : end);
}

const indexOf = (lines: string[], prefix: string) => lines.findIndex((line) => line.startsWith(prefix));

for (const probe of [false, true]) {
  const trace = await runLive2DRendererScenario(PetLive2DRenderer as never, { probe });
  assert.deepEqual(await runLive2DRendererScenario(PetLive2DRenderer as never, { probe }), trace, 'trace should be deterministic');
  assert.deepEqual(trace.filter((line) => line.startsWith('react-error')), []);

  const mount = segment(trace, 'mount');
  const order = ['shared1.acquire', 'runtime.load', 'Live2DModel.from', 'loadDeclaredParameterIds', 'resolveRuntimeProfile',
    'physicsWarmup', 'syncPresentation', 'shared1.layer.addChild', 'pointerLook1.create', 'performance1.create', 'mouth1.create',
    'ticker.attach', 'shared1.app.start'].map((prefix) => indexOf(mount, prefix));
  assert.ok(order.every((index, position) => index >= 0 && (position === 0 || index > order[position - 1])), `model bootstrap order ${order}`);
  assert.ok(mount.some((line) => line.startsWith('Live2DModel.from') && line.includes('"autoUpdate":false')));
  assert.ok(mount.some((line) => line.startsWith('pointerLook1.create') && line.includes('"startCenteredBeforeIdle":true')));
  assert.ok(mount.includes('pointerLook1.updateInputTarget [{"source":"center","x":0,"y":0}]'), 'model load starts centered');
  assert.ok(mount.includes('runtimeEvent [{"petId":"pet-a","runtimeKind":"live2d","type":"ready"}]'));

  const probes = segment(trace, 'presentation probes');
  assert.equal(probes.filter((line) => line.startsWith('log model TEMP live2d presentation probe')).length, 2);

  const dragStart = segment(trace, 'drag start');
  assert.equal(dragStart.some((line) => line.startsWith('visualBounds')), false, 'dragging must not emit fallback bounds');
  assert.equal(dragStart.some((line) => line.startsWith('log drag-diagnose')), probe, 'drag probe log follows the probe flag');

  const hotUpdate = segment(trace, 'runtime profile hot update');
  assert.ok(hotUpdate.some((line) => line.startsWith('pointerLook1.destroy')));
  assert.ok(hotUpdate.some((line) => line.startsWith('pointerLook2.create') && line.includes('"startCenteredBeforeIdle":false')));
  assert.ok(hotUpdate.some((line) => line.startsWith('log model live2d runtime profile hot updated')));

  const swap = segment(trace, 'model without bounds');
  const swapOrder = ['ticker.release ["[model1]"]', 'mouth2.destroy', 'performance2.destroy', 'pointerLook2.destroy',
    'shared1.layer.removeChild', 'model1.destroy'].map((prefix) => indexOf(swap, prefix));
  assert.ok(swapOrder.every((index, position) => index >= 0 && (position === 0 || index > swapOrder[position - 1])), `model swap cleanup ${swapOrder}`);

  const failing = segment(trace, 'failing model');
  assert.ok(failing.some((line) => line.startsWith('runtimeEvent') && line.includes('"type":"error"')));
  const controllerFailures = segment(trace, 'controller failures');
  for (const kind of ['pointer look', 'performance', 'mouth']) {
    assert.ok(controllerFailures.some((line) => line.startsWith(`error model live2d ${kind} setup skipped`)), kind);
  }
  assert.ok(segment(trace, 'focus fallback pointer').some((line) => line.startsWith('error model live2d focus pointer look failed')));
  assert.ok(segment(trace, 'unmount').some((line) => line === 'shared1.release'), 'unmount releases the shared renderer');
}

console.log('Live2D renderer runtime chain smoke passed (2 configurations, real component with recorded runtime calls).');
