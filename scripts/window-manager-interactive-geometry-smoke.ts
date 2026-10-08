import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const actual = createRequire(import.meta.url)('../electron/windowManager/mainWindowInteractiveGeometry.cjs').createMainWindowInteractiveGeometry;
export function exerciseInteractiveGeometry(factory = actual) {
  const results: unknown[] = [];
  const boundsCases = [null, { width: 0, height: 20 }, { width: 20, height: -1 }, { width: 1, height: 1 },
    { width: 100.6, height: 80.4 }, { width: 100, height: 80 }, {}, { width: NaN, height: 80 }, { width: Infinity, height: 80 }];
  const shapes = [undefined, null, {}, [], [null], [{}], [{ x: 0, y: 0, width: 100, height: 80 }],
    [{ x: 0, y: 0, width: 98, height: 78 }], [{ x: 0, y: 0, width: 97, height: 77 }],
    [{ x: 1, y: 0, width: 100, height: 80 }], [{ x: 0, y: 0, width: 1, height: 1 }], [null, null]];
  for (const window of ['live', 'missing', 'destroyed', 'bounds-fallback', 'non-function-content'])
  for (const bounds of boundsCases) for (const shape of shapes) results.push(run({ window, bounds, shape }));
  for (const failure of ['main', 'destroyed', 'content-probe', 'content', 'bounds', 'width', 'height', 'region-x', 'region-y', 'region-width', 'region-height']) {
    results.push(run({ failure, window: failure === 'bounds' ? 'bounds-fallback' : 'live' }));
  }
  for (const at of [2, 3, 4, 5]) for (const kind of ['replacement', 'missing']) results.push(run({ race: { at, kind } }));
  return results;
  function run(input: any) {
    const config = { window: 'live', bounds: { width: 100, height: 80 }, shape: [{ x: 0, y: 0, width: 100, height: 80 }], ...input };
    const calls: unknown[][] = [], errors: string[] = [], error = new Error('geometry dependency');
    let reads = 0;
    const step = (name: string, ...values: unknown[]) => { calls.push([name, ...values]); if (name === config.failure) throw error; };
    const bounds = config.bounds && { get width() { step('width'); return config.bounds.width; }, get height() { step('height'); return config.bounds.height; } };
    const replacement = { isDestroyed: () => { step('destroyed', 'replacement'); return false; },
      getContentBounds: () => { step('content', 'replacement'); return { width: 40, height: 30 }; },
      getBounds: () => { step('bounds', 'replacement'); return { width: 40, height: 30 }; } };
    const main = { isDestroyed: () => { step('destroyed', 'initial'); return config.window === 'destroyed'; },
      get getContentBounds() {
        step('content-probe');
        return config.window === 'bounds-fallback' ? undefined : config.window === 'non-function-content' ? 42
          : () => { step('content', 'initial'); return bounds; };
      }, getBounds: () => { step('bounds', 'initial'); return bounds; } };
    let current: any = config.window === 'missing' ? null : main;
    const api = factory({ getMainWindow: () => {
      step('main', ++reads); if (reads === config.race?.at) current = config.race.kind === 'missing' ? null : replacement; return current;
    } });
    assert.deepEqual(calls, [], 'factory does not read current window');
    assert.deepEqual(Object.keys(api), ['isFullWindowInteractiveShape', 'createFullWindowInteractiveRegion']);
    const invoke = (label: string, fn: () => unknown) => {
      try { return fn(); } catch (caught) {
        assert.ok(caught === error || caught instanceof TypeError); errors.push(label + (caught === error ? ':dependency' : ':TypeError')); return 'error';
      }
    };
    const shape = config.failure?.startsWith('region-') ? [{
      get x() { step('region-x'); return 0; }, get y() { step('region-y'); return 0; },
      get width() { step('region-width'); return 100; }, get height() { step('region-height'); return 80; },
    }] : config.shape;
    const full = invoke('full', () => api.isFullWindowInteractiveShape(shape));
    if (!Array.isArray(shape) || shape.length !== 1) assert.deepEqual(calls, [], 'invalid shape short-circuits before window queries');
    const region = invoke('create', api.createFullWindowInteractiveRegion);
    const repeated = invoke('repeat', () => api.isFullWindowInteractiveShape(shape));
    if (!config.failure && !config.race) {
      const available = config.window !== 'missing' && config.window !== 'destroyed' && config.bounds
        && !(config.bounds.width <= 0 || config.bounds.height <= 0);
      if (!available) { assert.equal(full, false); assert.equal(region, null); }
      else {
        const width = Math.round(config.bounds.width), height = Math.round(config.bounds.height);
        assert.deepEqual(region, { height: Math.max(1, height), width: Math.max(1, width), x: 0, y: 0 });
        const item = Array.isArray(shape) && shape.length === 1 ? shape[0] : null;
        assert.equal(full, Boolean(item && item.x === 0 && item.y === 0 && item.width >= Math.max(1, width - 2) && item.height >= Math.max(1, height - 2)));
        assert.equal(repeated, full);
      }
    }
    if (config.failure) assert.ok(errors.includes('full:dependency'), 'dependency errors propagate');
    return { calls, errors, full, region, repeated };
  }
}
const results = exerciseInteractiveGeometry();
console.log(`Interactive geometry passed (${results.length} bounds/rounding/tolerance/capability/error/window-race cases; lazy live size reader).`);
