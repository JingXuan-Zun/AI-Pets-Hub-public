import assert from 'node:assert/strict';
import { assertImplementationModuleGraph } from './implementationModuleGuard';
import { resolveVisualSnapshotAbsolutePointFromRatio } from '../src/agent/visual/visualSnapshotSourceGeometry';
import { resolveVisualSnapshotCropRequest } from '../src/agent/visual/visualSnapshotCropGeometry';
import { tryParseVisualSnapshotJson } from '../src/agent/visual/visualSnapshotParsing';

assertImplementationModuleGraph({
  entry: 'src/agent/agentRuntimeVisualTools.ts', directory: 'src/agent/visual',
  maxEntryLines: 300,
});
const source = {
  id: 'screen:secondary', type: 'screen', name: '副屏', width: 1920, height: 1080,
  bounds: { x: -1920, y: -1080, width: 1920, height: 1080 },
} as DesktopPetCaptureSourceLike;
assert.deepEqual(resolveVisualSnapshotAbsolutePointFromRatio({
  source, ratioCenter: { x: 0.5, y: 0.5 },
}), { coordinateSpace: 'native-screen', source: 'elementCenterRatio', x: -960, y: -540 });
assert.equal(resolveVisualSnapshotAbsolutePointFromRatio({ source, ratioCenter: { x: NaN, y: 0 } }), null);
const crop = resolveVisualSnapshotCropRequest({
  source, imageWidth: 3840, imageHeight: 2160,
  request: { coordinateSpace: 'native-screen', x: -1820, y: -980, width: 400, height: 200, paddingRatio: 0, scale: 2 },
});
assert.deepEqual(crop?.imageRect, { x: 200, y: 200, width: 800, height: 400 });
assert.deepEqual(crop?.sourceBounds, { x: -1820, y: -980, width: 400, height: 200 });
assert.equal(crop?.scale, 2);
assert.equal(tryParseVisualSnapshotJson('invalid json'), null);
assert.deepEqual(tryParseVisualSnapshotJson('{"summary":"可见窗口"}'), { summary: '可见窗口' });
console.log('agent visual module smoke: PASS (coordinates, crop geometry, module budgets, acyclic dependencies)');
