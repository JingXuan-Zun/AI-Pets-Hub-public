import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const actual = createRequire(import.meta.url)('../electron/windowManager/mainWindowNativeShape.cjs').createMainWindowNativeShape;
export function exerciseNativeShapePolicies(factory = actual) {
  const results: unknown[] = [];
  for (const platform of ['win32', 'linux']) for (const separated of [false, true])
  for (const windowKind of ['missing', 'destroyed', 'no-shape', 'live']) for (const active of [false, true])
  for (const regionKind of ['empty', 'small', 'full']) for (const requested of [false, true])
  for (const retained of [false, true]) for (const diagnostics of [false, true]) for (const preset of [false, true]) {
    results.push(run({ platform, separated, windowKind, active, regionKind, requested, retained, diagnostics, preset }));
  }
  for (const failure of ['shape', 'set-applied', 'bounds', 'summarize', 'log', 'set-ignore', 'set-forward', 'native-ignore']) {
    for (const separated of [false, true]) results.push(run({ platform: 'win32', separated, windowKind: 'live',
      active: false, regionKind: 'small', requested: true, retained: false, diagnostics: true, preset: false, failure }));
  }
  return results;
  function run(config: any) {
    const calls: unknown[][] = [], error = new Error('native policy failure'); error.stack = 'Error: native policy failure';
    let applied = config.preset, ignore = config.preset, forwarding = config.preset;
    const regions = config.regionKind === 'empty' ? [] : [{ full: config.regionKind === 'full' }];
    const step = (name: string, ...values: unknown[]) => { calls.push([name, ...values]); if (name === config.failure) throw error; };
    const win: any = {
      isDestroyed: () => config.windowKind === 'destroyed',
      getBounds: () => { step('bounds'); return { x: 1, y: 2, width: 3, height: 4 }; },
      setIgnoreMouseEvents: (value: boolean, options: unknown) => step('native-ignore', value, options),
    };
    if (config.windowKind !== 'no-shape') win.setShape = (value: unknown[]) => step('shape', value.length);
    const dependencies = {
      nativeShapeState: {
        getRegions: () => regions, getApplied: () => applied,
        setApplied: (value: boolean) => { step('set-applied', value); applied = value; },
        getRequestedPointerPassthrough: () => config.requested,
        getPointerPassthrough: () => ignore, getPointerPassthroughForwarding: () => forwarding,
        setPointerPassthrough: (value: boolean) => { step('set-ignore', value); ignore = value; },
        setPointerPassthroughForwarding: (value: boolean) => { step('set-forward', value); forwarding = value; },
      },
      getMainWindow: () => config.windowKind === 'missing' ? null : win,
      getPlatform: () => config.platform, getIsAgentDesktopExecutionActive: () => config.active,
      getInputProxyRegionCount: () => 2, isFullWindowInteractiveShape: (value: any[]) => Boolean(value[0]?.full),
      isPetDragFullWindowShapeRetained: () => config.retained,
      summarizeInteractiveRegion: () => { step('summarize'); return 'region'; },
      logWindowEvent: (message: string) => step('log', message),
      pointerDiagnosticsEnabled: config.diagnostics, USE_SEPARATE_RENDER_AND_INPUT_WINDOWS: config.separated,
    };
    const api = factory(dependencies); assert.deepEqual(calls, []);
    const capable = api.canApplyInteractiveWindowShape();
    const expectedCapability = config.platform !== 'win32' || config.separated ? false
      : config.windowKind === 'missing' ? null : config.windowKind === 'live';
    assert.equal(capable, expectedCapability, 'capability return values must remain exact');
    const errors: string[] = [];
    for (const [name, action] of [['shape', api.applyInteractiveWindowShape], ['pointer', api.applyPointerPassthroughState], ['pointer-repeat', api.applyPointerPassthroughState]] as const) {
      try { assert.equal(action(), undefined); } catch (caught) { assert.equal(caught, error); errors.push(name); }
    }
    if (!config.failure) {
      const alive = !['missing', 'destroyed'].includes(config.windowKind);
      const expectedIgnore = !alive ? config.requested : config.separated ? true
        : config.active ? !(Boolean(capable) && regions.length > 0)
          : config.retained || (config.requested && config.regionKind !== 'full');
      assert.equal(ignore, expectedIgnore); assert.equal(forwarding, alive && !config.separated && config.retained);
      assert.equal(calls.filter(call => call[0] === 'native-ignore').length,
        alive && (config.preset !== ignore || config.preset !== forwarding) ? 1 : 0, 'repeated transitions must use cache');
      if (config.active && alive && config.windowKind !== 'no-shape') assert.equal(applied, config.preset, 'Agent-active path must not change shape');
    }
    return { config, capable, applied, ignore, forwarding, errors, calls };
  }
}
const source = fs.readFileSync('electron/windowManager/mainWindowNativeShape.cjs', 'utf8');
const stages = ['createNativeWindowShapeCapabilities', 'createNativeWindowShapeApplier', 'createNativePointerPassthroughApplier'];
for (const failure of [undefined, ...stages]) {
  const calls: string[] = [], outputs: Record<string, unknown> = {}, error = new Error('assembly error');
  const dependencies = Object.fromEntries(['nativeShapeState', 'getMainWindow', 'getPlatform', 'getIsAgentDesktopExecutionActive',
    'getInputProxyRegionCount', 'isFullWindowInteractiveShape', 'isPetDragFullWindowShapeRetained', 'summarizeInteractiveRegion',
    'logWindowEvent', 'pointerDiagnosticsEnabled', 'USE_SEPARATE_RENDER_AND_INPUT_WINDOWS'].map(key => [key, () => assert.fail(`no eager ${key}`)]));
  const modules = Object.fromEntries(stages.map((stage, index) => [stage, (input: Record<string, unknown>) => {
    calls.push(stage);
    for (const [key, value] of Object.entries(input)) assert.equal(value, key in outputs ? outputs[key] : dependencies[key]);
    if (stage === failure) throw error;
    const keys = index === 0 ? ['canApplyInteractiveWindowShape', 'hasInteractiveWindowShape']
      : [index === 1 ? 'applyInteractiveWindowShape' : 'applyPointerPassthroughState'];
    for (const key of keys) outputs[key] = () => assert.fail(`no eager ${key}`);
    return index === 0 ? Object.fromEntries(keys.map(key => [key, outputs[key]])) : outputs[keys[0]];
  }]));
  const module = { exports: {} as any }; vm.runInNewContext(source, { module, require: () => modules });
  let caught: unknown, result: any;
  try { result = module.exports.createMainWindowNativeShape(dependencies); } catch (value) { caught = value; }
  assert.equal(caught, failure ? error : undefined); assert.deepEqual(calls, failure ? stages.slice(0, stages.indexOf(failure) + 1) : stages);
  if (!failure) {
    assert.equal(Object.keys(result).length, 3);
    for (const [key, value] of Object.entries(result)) assert.equal(value, outputs[key]);
  }
}
console.log(`Native shape policies passed (${exerciseNativeShapePolicies().length} state/error scenarios; assembly order, shared state and exact return identities).`);
