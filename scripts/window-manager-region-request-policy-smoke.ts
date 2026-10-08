import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const actual = createRequire(import.meta.url)('../electron/windowManager/interactiveRegionRequests.cjs').createInteractiveRegionRequests;
export function exerciseRegionRequestPolicies(factory = actual) {
  const outputs: unknown[] = [];
  for (const separated of [false, true]) for (const currentKind of ['empty', 'local', 'full'])
  for (const nextKind of ['empty', 'local', 'full']) for (const source of ['', 'pet-drag', 'render-input-proxy', 'post-drag-input-proxy'])
  for (const lease of ['none', 'held', 'active']) for (const requested of [false, true])
  for (const applied of [false, true]) for (const sameSignature of [false, true]) for (const diagnostics of [false, true]) {
    outputs.push(run({ separated, currentKind, nextKind, source, lease, requested, applied, sameSignature, diagnostics }));
  }
  for (const failure of ['normalize', 'signature', 'source', 'pending', 'pending-signature', 'received-at', 'regions',
    'set-signature', 'time', 'hold-until', 'schedule', 'ensure', 'log', 'summary', 'shape', 'pointer', 'proxy', 'hide']) {
    for (const branch of ['changed', 'held', 'drag-full', 'proxy']) outputs.push(run({ separated: branch === 'proxy',
      currentKind: branch === 'held' ? 'full' : 'local', nextKind: branch === 'drag-full' ? 'full' : 'local',
      source: ['drag-full', 'proxy'].includes(branch) ? 'pet-drag' : '', lease: branch === 'held' ? 'held' : 'none',
      requested: true, applied: false, sameSignature: false, diagnostics: true, failure }));
  }
  return outputs;
  function run(config: any) {
    const calls: unknown[][] = [], error = new Error('region failure'); error.stack = 'Error: region failure';
    const regionsFor = (kind: string) => kind === 'empty' ? [] : [{ kind }];
    const initialRegions = regionsFor(config.currentKind), nextRegions = regionsFor(config.nextKind);
    let regions = initialRegions, signature = config.sameSignature ? config.nextKind : 'old';
    let pending: unknown = 'pending', pendingSignature = 'pending', receivedAt = -1, holdUntil = config.lease === 'held' ? 10 : 0;
    let failureTriggered = false;
    const step = (name: string, ...values: unknown[]) => {
      calls.push([name, ...values]); if (name === config.failure) { failureTriggered = true; throw error; }
    };
    const dependencies = {
      shapeState: {
        getRegions: () => regions, getSignature: () => signature, getApplied: () => config.applied,
        getRequestedPointerPassthrough: () => config.requested, getPetDragNativeShapeActive: () => config.lease === 'active',
        getHoldUntil: () => holdUntil, setHoldUntil: (value: number) => { step('hold-until', value); holdUntil = value; },
        setRegions: (value: any[]) => { step('regions', value); regions = value; },
        setSignature: (value: string) => { step('set-signature', value); signature = value; },
        setPendingRegions: (value: unknown) => { step('pending', value); pending = value; },
        setPendingSignature: (value: string) => { step('pending-signature', value); pendingSignature = value; },
        setPendingReceivedAt: (value: number) => { step('received-at', value); receivedAt = value; },
      },
      getCurrentTime: () => { step('time'); return 5; },
      normalizeInteractiveRegions: (value: unknown) => { assert.equal(value, input); step('normalize'); return nextRegions; },
      createInteractiveRegionsSignature: (value: unknown) => { assert.equal(value, nextRegions); step('signature'); return config.nextKind; },
      normalizeInteractiveRegionSource: (value: unknown) => { assert.equal(value, options); step('source'); return config.source; },
      summarizeInteractiveRegion: (value: unknown) => { step('summary', value); return 'region'; },
      isFullWindowInteractiveShape: (value: any[]) => value[0]?.kind === 'full',
      isPetDragFullWindowShapeRetained: () => config.lease === 'active',
      ensurePetDragFullWindowInteractiveShape: (reason: string) => step('ensure', reason),
      schedulePetDragFullWindowShapeHoldExpiry: () => step('schedule'), canApplyInteractiveWindowShape: () => true,
      applyInteractiveWindowShape: () => step('shape'), applyPointerPassthroughState: () => step('pointer'),
      setPostDragInputProxyRegions: (value: unknown) => step('proxy', value), hidePostDragInputProxy: (reason: string) => step('hide', reason),
      logWindowEvent: (message: string) => step('log', message), pointerDiagnosticsEnabled: config.diagnostics,
      USE_SEPARATE_RENDER_AND_INPUT_WINDOWS: config.separated, PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS: 720,
    };
    const input = {}, options = { source: config.source }, request = factory(dependencies);
    assert.deepEqual(calls, [], 'factory must not access live state or invoke actions');
    let caught: unknown;
    try { assert.equal(request(input, options), undefined); } catch (value) { caught = value; }
    assert.equal(caught, failureTriggered ? error : undefined);
    assert.deepEqual(calls.slice(0, Math.min(calls.length, 3)).map(call => call[0]),
      ['normalize', 'signature', 'source'].slice(0, Math.min(calls.length, 3)), 'normalization must precede routing');
    if (!config.failure) {
      const proxyRoute = config.source === 'render-input-proxy' || (!config.separated && config.source === 'post-drag-input-proxy');
      if (proxyRoute) {
        assert.equal(regions, initialRegions); assert.equal(pending, 'pending');
        assert.equal(calls.filter(call => call[0] === 'proxy').length,
          config.source === 'render-input-proxy' && !config.separated ? 0 : 1);
        assert.equal(calls.some(call => ['shape', 'pointer', 'schedule'].includes(String(call[0]))), false);
      } else if (config.separated && config.source === 'pet-drag' && config.nextKind === 'full') {
        assert.equal(regions, initialRegions); assert.equal(pending, 'pending');
        assert.equal(calls.some(call => ['proxy', 'pointer', 'shape'].includes(String(call[0]))), false, 'full drag shape must not replace local proxy regions');
      } else if (!config.separated && config.currentKind === 'full' && config.nextKind !== 'full' && config.lease !== 'none') {
        assert.equal(regions, initialRegions); assert.equal(pending, nextRegions);
        assert.equal(receivedAt, 5); assert.equal(pendingSignature, config.nextKind);
        assert.equal(calls.some(call => call[0] === 'shape'), false, 'held full-window shape must defer local regions');
      }
    }
    return { config, calls, regions, signature, pending, pendingSignature, receivedAt, holdUntil, failed: Boolean(caught) };
  }
}
const source = fs.readFileSync('electron/windowManager/interactiveRegionRequests.cjs', 'utf8');
const stages = ['createInteractiveRegionStateActions', 'createSeparateWindowInteractiveRegionApplier', 'createLegacyInteractiveRegionApplier', 'createInteractiveRegionRequestDispatcher'];
for (const failure of [undefined, ...stages]) {
  const calls: string[] = [], outputs: Record<string, unknown> = {}, error = new Error('assembly failure');
  const dependencies = Object.fromEntries(['shapeState', 'getCurrentTime', 'normalizeInteractiveRegions', 'createInteractiveRegionsSignature',
    'normalizeInteractiveRegionSource', 'summarizeInteractiveRegion', 'isFullWindowInteractiveShape', 'isPetDragFullWindowShapeRetained',
    'ensurePetDragFullWindowInteractiveShape', 'schedulePetDragFullWindowShapeHoldExpiry', 'canApplyInteractiveWindowShape',
    'applyInteractiveWindowShape', 'applyPointerPassthroughState', 'setPostDragInputProxyRegions', 'hidePostDragInputProxy',
    'logWindowEvent', 'pointerDiagnosticsEnabled', 'USE_SEPARATE_RENDER_AND_INPUT_WINDOWS', 'PET_DRAG_FULL_WINDOW_SHAPE_HOLD_MS']
    .map(key => [key, () => assert.fail(`no eager ${key}`)]));
  const modules = Object.fromEntries(stages.map((stage, index) => [stage, (input: Record<string, unknown>) => {
    calls.push(stage); for (const [key, value] of Object.entries(input)) assert.equal(value, key in outputs ? outputs[key] : dependencies[key]);
    if (stage === failure) throw error;
    const keys = index === 0 ? ['clearDeferredInteractiveShape', 'logInteractiveRegionRequest', 'deferInteractiveRegionsDuringPetDragHold',
      'shouldKeepInteractiveShapeDuringPointerInteraction', 'reapplyUnchangedInteractiveShape', 'applyChangedInteractiveShape']
      : [index === 1 ? 'applySeparateWindowInteractiveRegions' : index === 2 ? 'applyLegacyInteractiveRegions' : 'setInteractiveRegions'];
    for (const key of keys) outputs[key] = () => assert.fail(`no eager ${key}`);
    return index === 0 ? Object.fromEntries(keys.map(key => [key, outputs[key]])) : outputs[keys[0]];
  }]));
  const module = { exports: {} as any }; vm.runInNewContext(source, { module, require: () => modules });
  let caught: unknown, result: unknown;
  try { result = module.exports.createInteractiveRegionRequests(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failure ? error : undefined); assert.deepEqual(calls, failure ? stages.slice(0, stages.indexOf(failure) + 1) : stages);
  if (!failure) assert.equal(result, outputs.setInteractiveRegions);
}
console.log(`Region request policies passed (${exerciseRegionRequestPolicies().length} source/shape/lease/error cases; shared state, assembly order and function identity).`);
