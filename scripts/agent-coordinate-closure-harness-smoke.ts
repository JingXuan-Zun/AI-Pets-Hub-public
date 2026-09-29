import assert from 'node:assert/strict';
import {
  evaluateAgentCoordinateClosureHarness,
  evaluateAgentCoordinateReplayClosureHarness,
} from '../src/agent/agentCoordinateHarness';
import { readProjectFile } from './smokeTestHarness.ts';

const primary = {
  bounds: {
    height: 1440,
    width: 2560,
    x: 0,
    y: 0,
  },
  displayId: 'primary',
  id: 'screen:primary',
  name: 'Primary physical 2560x1440',
  type: 'screen' as const,
};

const secondaryLeft = {
  bounds: {
    height: 1440,
    width: 3440,
    x: -3440,
    y: 0,
  },
  displayId: 'secondary',
  id: 'screen:secondary',
  name: 'Secondary physical 3440x1440',
  type: 'screen' as const,
};

const displays = [primary, secondaryLeft];

const primaryClosure = evaluateAgentCoordinateClosureHarness({
  afterRegion: {
    signature: 'launch-button-pressed',
    trusted: true,
  },
  beforeRegion: {
    signature: 'launch-button-idle',
    trusted: true,
  },
  displaySources: displays,
  ratioPoint: {
    x: 0.5,
    y: 0.5,
  },
  source: primary,
});
assert.equal(primaryClosure.status, 'coordinate_closure_ok');
assert.deepEqual(primaryClosure.clickPoint, { x: 1280, y: 720 });
assert.deepEqual(primaryClosure.redDotRatio, { x: 0.5, y: 0.5 });
assert.equal(primaryClosure.audit.status, 'coordinate_ok');
assert.equal(primaryClosure.audit.pointDisplayId, 'primary');
assert.equal(primaryClosure.targetRegionChanged, true);

const secondaryNegativeCoordinateClosure = evaluateAgentCoordinateClosureHarness({
  afterRegion: {
    signature: 'detail-page-selected',
    trusted: true,
  },
  beforeRegion: {
    signature: 'list-visible-only',
    trusted: true,
  },
  displaySources: displays,
  ratioPoint: {
    x: 0.25,
    y: 0.5,
  },
  source: secondaryLeft,
});
assert.equal(secondaryNegativeCoordinateClosure.status, 'coordinate_closure_ok');
assert.deepEqual(secondaryNegativeCoordinateClosure.clickPoint, { x: -2580, y: 720 });
assert.deepEqual(secondaryNegativeCoordinateClosure.redDotRatio, { x: 0.25, y: 0.5 });
assert.equal(secondaryNegativeCoordinateClosure.audit.status, 'coordinate_ok');
assert.equal(secondaryNegativeCoordinateClosure.audit.pointDisplayId, 'secondary');

const mismatchClosure = evaluateAgentCoordinateClosureHarness({
  afterRegion: {
    signature: 'wrong-screen-state',
    trusted: true,
  },
  beforeRegion: {
    signature: 'wrong-screen-state',
    trusted: true,
  },
  displaySources: displays,
  ratioPoint: {
    x: 0.25,
    y: 0.5,
  },
  source: primary,
});
assert.equal(mismatchClosure.status, 'coordinate_closure_no_change');
assert.deepEqual(mismatchClosure.clickPoint, { x: 640, y: 720 });
assert.equal(mismatchClosure.audit.status, 'coordinate_ok');
assert.equal(mismatchClosure.targetRegionChanged, false);

const invalidRatioClosure = evaluateAgentCoordinateClosureHarness({
  displaySources: displays,
  ratioPoint: {
    x: 120,
    y: 0.5,
  },
  source: primary,
});
assert.equal(invalidRatioClosure.status, 'coordinate_closure_invalid_ratio');
assert.equal(invalidRatioClosure.clickPoint, null);
assert.equal(invalidRatioClosure.audit.status, 'coordinate_unknown');

const mismatchedSource = {
  ...primary,
  displayId: 'secondary',
  id: 'window:mismatched-display',
  name: 'Window with stale display ownership',
  type: 'window' as const,
};

const displayMismatchClosure = evaluateAgentCoordinateClosureHarness({
  afterRegion: {
    signature: 'changed',
    trusted: true,
  },
  beforeRegion: {
    signature: 'idle',
    trusted: true,
  },
  displaySources: [primary],
  ratioPoint: {
    x: 0.5,
    y: 0.5,
  },
  source: mismatchedSource,
});
assert.equal(displayMismatchClosure.status, 'coordinate_closure_coordinate_failed');
assert.deepEqual(displayMismatchClosure.clickPoint, { x: 1280, y: 720 });
assert.equal(displayMismatchClosure.audit.status, 'coordinate_display_mismatch');
assert.equal(displayMismatchClosure.audit.pointDisplayId, 'primary');
assert.equal(displayMismatchClosure.audit.sourceDisplayId, 'secondary');

const untrustedClosure = evaluateAgentCoordinateClosureHarness({
  afterRegion: {
    signature: 'changed',
    trusted: false,
  },
  beforeRegion: {
    signature: 'idle',
    trusted: true,
  },
  displaySources: displays,
  ratioPoint: {
    x: 50,
    y: 50,
  },
  source: primary,
});
assert.equal(untrustedClosure.status, 'coordinate_closure_untrusted');
assert.deepEqual(untrustedClosure.clickPoint, { x: 1280, y: 720 });
assert.deepEqual(untrustedClosure.redDotRatio, { x: 0.5, y: 0.5 });
assert.equal(untrustedClosure.targetRegionChanged, null);

const replayClosure = evaluateAgentCoordinateReplayClosureHarness({
  afterRegion: {
    signature: 'after-change',
    trusted: true,
  },
  beforeRegion: {
    signature: 'before-change',
    trusted: true,
  },
  clickPoint: {
    x: -1720,
    y: 720,
  },
  displaySources: displays,
  source: secondaryLeft,
});
assert.equal(replayClosure.status, 'coordinate_closure_ok');
assert.deepEqual(replayClosure.redDotRatio, { x: 0.5, y: 0.5 });
assert.equal(replayClosure.targetRegionChanged, true);

const replayNoChangeClosure = evaluateAgentCoordinateReplayClosureHarness({
  afterRegion: {
    signature: 'unchanged',
    trusted: true,
  },
  beforeRegion: {
    signature: 'unchanged',
    trusted: true,
  },
  clickPoint: {
    x: -1720,
    y: 720,
  },
  displaySources: displays,
  source: secondaryLeft,
});
assert.equal(replayNoChangeClosure.status, 'coordinate_closure_no_change');
assert.equal(replayNoChangeClosure.targetRegionChanged, false);

const indexSource = readProjectFile('src/agent/index.ts');
assert.match(
  indexSource,
  /export \* from '\.\/agentCoordinateHarness';/u,
  'coordinate closure harness should be exported for runtime and smoke reuse',
);

console.log('agent coordinate closure harness smoke ok');
