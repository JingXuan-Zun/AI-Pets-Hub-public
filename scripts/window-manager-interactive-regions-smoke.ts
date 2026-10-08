import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readModuleProjectFile } from './projectModuleSource.mjs';

const require = createRequire(import.meta.url);
const actualApi = require('../electron/windowManager/interactiveRegionNormalization.cjs');
export function exerciseInteractiveRegionNormalization(api = actualApi) {
  const outputs: unknown[] = [];
  assert.deepEqual(Object.keys(api).sort(), ['normalizeInteractiveRegions', 'createInteractiveRegionsSignature', 'summarizeInteractiveRegion', 'normalizeInteractiveRegionSource'].sort());
  for (const x of [-2.6, 0, '12.7', Infinity]) for (const y of [-2.6, 0, '12.7', Infinity]) {
    for (const width of [-1, 0, 0.4, 0.6, '24', NaN]) for (const height of [-1, 0, 0.4, 0.6, '24', NaN]) {
      const region = Object.freeze({x, y, width, height}); const input = Object.freeze([null, region, {width: 0, height: 1}]);
      const normalized = api.normalizeInteractiveRegions(input); assert.notEqual(normalized, input);
      assert.equal(normalized.length, x === Infinity || y === Infinity || ![0.6, '24'].includes(width) || ![0.6, '24'].includes(height) ? 0 : 1);
      for (const value of normalized) {assert.notEqual(value, region); for (const coordinate of ['x', 'y', 'width', 'height']) assert.equal(Number.isInteger(value[coordinate]), true);}
      outputs.push({kind: 'region', x, y, width, height, normalized, signature: api.createInteractiveRegionsSignature(normalized), summary: api.summarizeInteractiveRegion(normalized[0])});
    }
  }
  for (const value of [null, undefined, {}, true, 'not-array', []]) {
    assert.deepEqual(api.normalizeInteractiveRegions(value), []); outputs.push({kind: 'non-array', value: value ?? null});
  }
  for (const count of [0, 319, 320, 321, 700]) {
    const source = Object.freeze(Array.from({length: count}, (_, x) => Object.freeze({x, y: 2, width: 4, height: 6})));
    const input = Object.freeze([...Array(100).fill(null), ...source]); const normalized = api.normalizeInteractiveRegions(input);
    assert.equal(normalized.length, Math.min(count, 320)); assert.deepEqual(normalized.map((value: any) => value.x), Array.from({length: Math.min(count, 320)}, (_, x) => x));
    if (count) {normalized[0].x = 999; assert.equal(source[0].x, 0);}
    outputs.push({kind: 'limit', count, normalized});
  }
  for (const value of [undefined, null, false, {}, {source: 'drag'}, {source: ''}, {source: 44}, {source: null}]) {
    const returned = api.normalizeInteractiveRegionSource(value); assert.equal(returned, typeof value?.source === 'string' ? value.source : ''); outputs.push({kind: 'source', value: value ?? null, returned});
  }
  for (const sequence of [['first', 'second'], [undefined, 'unused'], [1, 'unused'], ['first', null], ['', false]]) {
    let reads = 0; const options = {get source() {return sequence[reads++];}}; const returned = api.normalizeInteractiveRegionSource(options);
    assert.equal(reads, typeof sequence[0] === 'string' ? 2 : 1); assert.equal(returned, typeof sequence[0] === 'string' ? sequence[1] : ''); outputs.push({kind: 'source-read', sequence, reads, returned});
  }
  for (const value of [null, undefined, false, 0, '', {x: 1, y: 2, width: 3, height: 4}]) {
    const returned = api.summarizeInteractiveRegion(value); assert.equal(returned, value ? '1,2,3,4' : 'none'); outputs.push({kind: 'summary', returned});
  }
  const a = Object.freeze({x: 1, y: 2, width: 3, height: 4}), b = Object.freeze({x: 5, y: 6, width: 7, height: 8});
  for (const [input, expected] of [[[], ''], [[a], '1,2,3,4'], [[a, b], '1,2,3,4|5,6,7,8'], [[b, a, a], '5,6,7,8|1,2,3,4|1,2,3,4']] as const) {
    const returned = api.createInteractiveRegionsSignature(input); assert.equal(returned, expected); outputs.push({kind: 'signature', returned});
  }
  for (const operation of ['get', 'number', 'signature', 'summary']) for (const field of ['x', 'y', 'width', 'height']) {
    const calls: string[] = []; const error = new Error('original region error');
    const region = Object.fromEntries(['x', 'y', 'width', 'height'].map(name => [name, 2]));
    Object.defineProperty(region, field, {get: () => {calls.push(field); if (operation !== 'number') throw error; return {valueOf: () => {calls.push('value'); throw error;}};}});
    assert.throws(() => operation === 'signature' ? api.createInteractiveRegionsSignature([region]) : operation === 'summary' ? api.summarizeInteractiveRegion(region) : api.normalizeInteractiveRegions([region]), caught => caught === error);
    outputs.push({kind: 'error', operation, field, calls});
  }
  {
    const error = new Error('original source error'); const options = {get source() {throw error;}};
    assert.throws(() => api.normalizeInteractiveRegionSource(options), caught => caught === error); outputs.push({kind: 'source-error'});
  }
  {
    const calls: string[] = []; let y = 2, height = 3;
    const region = {get x() {calls.push('x-get'); return {valueOf: () => {calls.push('x-value'); y = 5; return -4.5;}};}, get y() {calls.push('y'); return y;},
      get width() {calls.push('width-get'); return {valueOf: () => {calls.push('width-value'); height = 9; return 6.2;}};}, get height() {calls.push('height'); return height;}};
    const returned = api.normalizeInteractiveRegions([region]); assert.deepEqual(returned, [{height: 9, width: 6, x: 0, y: 5}]);
    assert.deepEqual(calls, ['x-get', 'x-value', 'y', 'width-get', 'width-value', 'height']); outputs.push({kind: 'live', calls, returned});
  }
  {
    const error = new Error('past-limit error'); let reads = 0;
    const tail = {get x() {reads++; throw error;}}; const input = [...Array.from({length: 321}, () => a), tail];
    assert.throws(() => api.normalizeInteractiveRegions(input), caught => caught === error); assert.equal(reads, 1); outputs.push({kind: 'past-limit', reads});
  }
  return JSON.parse(JSON.stringify(outputs));
}
const manager = readModuleProjectFile('electron/windowManager.cjs');
assert.match(manager, /const nextRegions = normalizeInteractiveRegions\(regions\);/u);
assert.match(manager, /const nextInteractiveWindowShapeRegions = normalizeInteractiveRegions\(regions\);\s*const nextInteractiveWindowShapeSignature = createInteractiveRegionsSignature\(nextInteractiveWindowShapeRegions\);\s*const interactiveRegionSource = normalizeInteractiveRegionSource\(options\);/u);
assert.equal(exerciseInteractiveRegionNormalization().length, 629);
console.log('Window manager interactive regions smoke passed (629 cases; rounding/clamping/invalids/320 limit/live reads/order/errors/immutable inputs).');
