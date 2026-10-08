import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { createRequire } from 'node:module';
const actual = createRequire(import.meta.url)('../electron/desktopIcons/desktopIconGeometry.cjs').createDesktopIconGeometry;

export function exerciseDesktopIconGeometry(factory = actual) {
  const outputs: unknown[] = [];
  const base = { x: -100.6, y: 50.3, width: 64.4, height: 48.4, centerX: -68.4, centerY: 74.5, desktopGridCellWidth: 90, desktopGridCellHeight: 100 };
  const icons = [null, base, { ...base, width: 0, height: -1 }, { ...base, x: NaN, y: Infinity },
    { ...base, nativeScreenX: 0, dipX: 0, nativeScreenHeight: 0, dipHeight: 0 }, {}];
  for (const mode of ['missing', 'no-methods', 'scale', 'invalid', 'null', 'throw', 'non-function'])
  for (const icon of icons) for (const space of ['dip', 'native-screen', undefined, 'unknown']) for (const failLog of [false, true]) {
    const calls: unknown[][] = [], errors: string[] = [], error = new Error('conversion'); error.stack = 'Error: conversion';
    const screen: any = mode === 'missing' ? null : {};
    if (!['missing', 'no-methods'].includes(mode)) for (const method of ['screenToDipPoint', 'dipToScreenPoint']) {
      Object.defineProperty(screen, method, { get() {
        calls.push(['method', method]); if (mode === 'non-function') return 7;
        return function(this: unknown, point: any) {
          assert.equal(this, screen); calls.push([method, point]);
          if (mode === 'throw') throw error;
          if (mode === 'null') return null;
          if (mode === 'invalid') return { x: 'bad', y: 0 };
          return method === 'screenToDipPoint' ? { x: point.x / 2 + 3, y: point.y * 2 - 7 }
            : { x: point.x * 2 - 6, y: point.y / 2 + 3.5 };
        };
      } });
    }
    const api = factory({ screen, logMessage: (...values: unknown[]) => { calls.push(['log', ...values]); if (failLog) throw error; } });
    assert.deepEqual(calls, [], 'geometry initialization does not query screen capabilities');
    const invoke = (label: string, fn: () => unknown) => { try { return fn(); } catch (caught) { assert.equal(caught, error); errors.push(label); return null; } };
    const snapshot = icon && { ...icon };
    const attached: any = invoke('attach', () => api.attachDesktopIconCoordinateSpaces(icon));
    const selected: any = invoke('select', () => api.selectDesktopIconCoordinateSpace(attached, space));
    assert.deepEqual(icon, snapshot, 'input icon remains unchanged');
    if (attached && icon === base) {
      assert.equal(attached.nativeScreenX, -101); assert.equal(attached.nativeScreenY, 50);
      assert.equal(attached.nativeScreenWidth, 64); assert.equal(attached.desktopGridCellWidth, 90);
      if (mode === 'scale') { assert.equal(attached.dipX, -47); assert.equal(attached.dipY, 93); }
      assert.equal(selected.coordinateSpace, space === 'native-screen' ? 'native-screen' : 'dip');
    }
    for (const point of [null, { x: -11.6, y: 33.2 }, { x: 0, y: 0 }, { x: NaN, y: 2 }, { x: Infinity, y: 3 }, { x: '4', y: 5 }]) {
      const converted = invoke('reverse', () => api.petToScreenCoordinate(point));
      if (mode !== 'scale' && !(mode === 'throw' && failLog && Number.isFinite(point?.x) && Number.isFinite(point?.y)))
        assert.equal(converted, point, 'unavailable/invalid conversion returns the original point');
      if (mode === 'scale' && point && Number.isFinite(point.x) && Number.isFinite(point.y))
        assert.deepEqual(converted, { x: Math.round(point.x) * 2 - 6, y: Math.round(point.y) / 2 + 3.5 });
    }
    assert.equal(api.normalizeDesktopIconCoordinateSpaceOption(space), space === 'native-screen' ? 'native-screen' : 'dip');
    outputs.push({ calls, errors, attached, selected });
  }
  return outputs;
}
const file = 'electron/desktopIcons/desktopIconGeometry.cjs', source = fs.readFileSync(file, 'utf8');
assert.ok(source.split('\n').length <= 300);
const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
function inspect(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
    assert.ok(parsed.getLineAndCharacterOfPosition(node.end).line - parsed.getLineAndCharacterOfPosition(node.getStart(parsed)).line + 1 <= 50);
  }
  ts.forEachChild(node, inspect);
}
inspect(parsed);
assert.match(fs.readFileSync('electron/desktopIconService.cjs', 'utf8'), /require\('\.\/desktopIcons\/desktopIconGeometry\.cjs'\)/);
const outputs = exerciseDesktopIconGeometry();
console.log(`Desktop icon geometry passed (${outputs.length} scale/rounding/coordinate/invalid/error cases; input identity, method receiver and budgets).`);
