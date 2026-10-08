import assert from 'node:assert/strict';
import { assertImplementationModuleGraph } from './implementationModuleGuard.ts';
import { petShellScenarioConfigs, runPetShellScenario } from './live2dRendererHarness/runPetShellScenario.ts';

// Real usePetContainerShellEffects hook against a recorded minimal DOM and
// desktop shell runtime (no source-text assertions).
assertImplementationModuleGraph({
  entry: 'src/components/pet/usePetContainerShellEffects.ts',
  directory: 'src/components/pet/petContainerShell',
});

const { usePetContainerShellEffects } = await import('../src/components/pet/usePetContainerShellEffects.ts');

function segment(trace: string[], label: string) {
  const start = trace.indexOf(`== ${label}`);
  assert.ok(start >= 0, `scenario step should run: ${label}`);
  const end = trace.findIndex((line, index) => index > start && line.startsWith('== '));
  return trace.slice(start + 1, end < 0 ? trace.length : end);
}

const passthroughCalls = (lines: string[]) => lines.filter((line) => line.startsWith('shell.setPointerPassthrough'));
const regionCalls = (lines: string[]) => lines.filter((line) => line.startsWith('shell.setInteractiveRegions'));

for (const config of petShellScenarioConfigs) {
  const label = JSON.stringify(config);
  const trace = await runPetShellScenario(usePetContainerShellEffects as never, config);
  assert.deepEqual(await runPetShellScenario(usePetContainerShellEffects as never, config), trace, `deterministic ${label}`);
  assert.deepEqual(trace.filter((line) => line.startsWith('react-error')), [], label);

  const mount = segment(trace, 'mount');
  assert.deepEqual(passthroughCalls(mount), ['shell.setPointerPassthrough [true]'], `mount starts click-through ${label}`);
  assert.ok(mount.includes('shell.onRefreshNativeInteractiveRegions'), label);
  assert.deepEqual(passthroughCalls(segment(trace, 'hover pet hit area')), ['shell.setPointerPassthrough [false]'], label);
  assert.deepEqual(passthroughCalls(segment(trace, 'release outside')), ['shell.setPointerPassthrough [true]'], label);
  assert.deepEqual(passthroughCalls(segment(trace, 'pointerdown pet')), [], `pet pointerdown defers activation ${label}`);

  const regionsAtMount = regionCalls(mount);
  if (!config.nativeRegions) {
    assert.deepEqual(regionsAtMount, ['shell.setInteractiveRegions [[],null]'], label);
    assert.equal(trace.some((line) => line.startsWith('mutationObserver.observe')), false, label);
    continue;
  }
  assert.equal(regionsAtMount.length, 2, `initial sync sends main and render-input-proxy regions ${label}`);
  assert.ok(regionsAtMount[1].endsWith('{"force":true,"source":"render-input-proxy"}]'), label);
  assert.equal(regionCalls(segment(trace, 'pet drag starts')).length, 0, `bounded drag defers native sync ${label}`);
  assert.ok(regionCalls(segment(trace, 'forced full-window drag'))
    .some((line) => line === 'shell.setInteractiveRegions [[{"height":600,"width":800,"x":0,"y":0}],{"source":"pet-drag"}]'), label);
  assert.ok(regionCalls(segment(trace, 'refresh input proxy'))[0].endsWith('{"force":true,"source":"post-drag-input-proxy"}]'), label);
  assert.ok(regionCalls(segment(trace, 'refresh fresh shape'))[0].endsWith('{"force":true,"source":"fresh-shape"}]'), label);
  assert.ok(segment(trace, 'embedded chat opens').includes('mutationObserver.disconnect'), `deps change restarts the session ${label}`);
  const unmount = segment(trace, 'unmount');
  assert.ok(unmount.includes('shell.unsubscribeRefreshNativeInteractiveRegions'), label);
  assert.ok(unmount.includes('shell.setInteractiveRegions [[],null]'), label);
  assert.equal(unmount.some((line) => line.startsWith('fire#') || line.startsWith('frame#')), false, `no timers after unmount ${label}`);
}

console.log(`Pet shell pointer session smoke passed (${petShellScenarioConfigs.length} configurations, real hook with recorded DOM/runtime calls).`);
