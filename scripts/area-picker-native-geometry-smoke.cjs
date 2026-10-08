const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
const ts = require('typescript');
const source = fs.readFileSync(path.resolve(__dirname, '../electron/areaPickerGeometry.cjs'), 'utf8');
function load(text) {
  const module = { exports: {} };
  new Function('module', text + '\nmodule.exports.nativeSelection = createLogicalSelectionFromNativeRect;')(module);
  return module.exports;
}
const current = load(source);
const baseline = process.argv[2] ? load(fs.readFileSync(process.argv[2], 'utf8')) : null;
if (baseline) {
  function retained(text) {
    const tree = ts.createSourceFile('geometry.cjs', text, ts.ScriptTarget.Latest, true);
    const changed = process.argv[3] === '--selection-results'
      ? ['createAreaSelectionFromRect', 'createAreaSelectionResult']
      : ['createLogicalSelectionFromNativeRect', 'getLogicalNativeIntersection'];
    return tree.statements.filter(n => !ts.isFunctionDeclaration(n) || !changed.includes(n.name.text)).map(n => n.getText(tree));
  }
  assert.deepEqual(retained(source), retained(fs.readFileSync(process.argv[2], 'utf8')));
}
function run(api, config) {
  const trace = [];
  let reads = 0;
  const watch = (value, label) => new Proxy(value, { get(target, key) {
    trace.push(label + '.' + String(key));
    if (++reads === config.throwAt) throw new Error('fixture read failure');
    return target[key];
  } });
  const displays = [0, 1].slice(0, config.count).map(i => watch({
    id: i, label: 'Display ' + i, sourceId: 'screen:' + i, sourceName: 'Screen ' + i,
    x: config.offset + i * 100, y: -20, width: 100, height: 80,
    nativeX: config.missing ? undefined : config.offset * config.scale + i * 100 * config.scale,
    nativeY: config.missing ? undefined : -40,
    nativeWidth: config.missing ? undefined : 100 * config.scale,
    nativeHeight: config.missing ? undefined : 160,
  }, 'display' + i));
  const context = watch({
    virtualBounds: watch({ x: config.offset, y: -20, width: 200, height: 80 }, 'logical'),
    nativeVirtualBounds: config.noNative ? null : watch({ x: config.offset * config.scale, y: -40, width: 200 * config.scale, height: 160 }, 'native'),
    displays,
  }, 'context');
  const rect = watch({ coordinateSpace: config.space, x: config.x, y: 0, width: config.width, height: 40 }, 'rect');
  let result, error;
  try {
    result = config.private ? api.nativeSelection(context, rect) : api.createAreaSelectionFromRect(context, rect);
    if (config.private && result) result = { selectionRect: result.selectionRect, displayIndices: result.selectedDisplays.map(d => displays.indexOf(d)) };
  } catch (e) { error = e.message; }
  return { result, error, trace };
}
const cases = [];
for (const scale of [1, 1.25, 2]) for (const offset of [-100, 0])
for (const missing of [false, true]) for (const noNative of [false, true])
for (const count of [0, 1, 2]) for (const space of ['native', 'logical'])
for (const x of [-0.6, 0, 90.4, 199, 500, NaN]) for (const width of [0, 7, 8, 150, Infinity])
for (const privateCall of [false, true]) cases.push({ scale, offset, missing, noNative, count, space, x, width, private: privateCall });
for (const throwAt of [1, 3, 8, 15, 25, 40, 60]) for (const privateCall of [false, true]) cases.push({ scale: 2, offset: -100, count: 2, space: 'native', x: 90, width: 150, private: privateCall, throwAt });
const hash = crypto.createHash('sha256');
for (const config of cases) {
  const actual = run(current, config);
  if (baseline) assert.deepEqual(actual, run(baseline, config), JSON.stringify(config));
  hash.update(JSON.stringify(actual));
}
const digest = hash.digest('hex');
if (!baseline) assert.equal(digest, '145d696d1ad76a6f46742d3e7f6e006d93b6dfeb9afea86ab359dbcad1f77407');
const context = { virtualBounds: { x: 0, y: 0, width: 200, height: 100 }, nativeVirtualBounds: { x: 0, y: 0 }, displays: [0, 1].map(i => ({ id: i, x: i * 100, y: 0, width: 100, height: 100, nativeX: i * 200, nativeY: 0, nativeWidth: 200, nativeHeight: 200 })) };
const cross = current.nativeSelection(context, { x: 180, y: 0, width: 80, height: 40 });
assert.deepEqual(cross.selectionRect, { x: 90, y: 0, width: 40, height: 20 });
assert.equal(cross.selectedDisplays[0], context.displays[0]);
assert.equal(cross.selectedDisplays[1], context.displays[1]);
const selection = current.createAreaSelectionFromRect(context, { coordinateSpace: 'native', x: 180, y: 0, width: 80, height: 40 });
assert.deepEqual(Object.keys(selection), ['displayId', 'displayLabel', 'sourceId', 'sourceName', 'sourceType', 'cropRect', 'cropBasisX', 'cropBasisY', 'cropBasisWidth', 'cropBasisHeight', 'areaSources']);
assert.equal(selection.displayLabel, 'Cross-display (2)');
assert.equal(selection.sourceName, 'Cross-display (2)');
assert.equal(selection.sourceType, 'screen');
assert.deepEqual(selection.cropRect, { x: 90, y: 0, width: 40, height: 20 });
assert.deepEqual([selection.cropBasisX, selection.cropBasisY, selection.cropBasisWidth, selection.cropBasisHeight], [0, 0, 200, 100]);
assert.deepEqual(selection.areaSources.map(s => [s.displayId, s.x, s.y, s.width, s.height, s.sourceType]), [[0, 0, 0, 100, 100, 'screen'], [1, 100, 0, 100, 100, 'screen']]);
context.displays[0].nativeX = 1000;
assert.equal(current.nativeSelection(context, { x: 0, y: 0, width: 20, height: 20 }), null);
assert.equal(current.createAreaSelectionFromRect(context, { coordinateSpace: 'native', x: 0, y: 0, width: 20, height: 20 }).displayId, 0);
assert.equal(current.createAreaSelectionFromRect(null, {}), null);
console.log('Area picker native geometry passed: ' + cases.length + ' cases; cross-display scaling, fallback, identity, getter order and errors; ' + digest);
