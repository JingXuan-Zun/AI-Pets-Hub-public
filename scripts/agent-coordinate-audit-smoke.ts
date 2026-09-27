import assert from 'node:assert/strict';
import {
  createAgentCoordinateAuditEvidence,
  formatAgentCoordinateAuditLine,
} from '../src/agent/agentCoordinateAudit';
import { readProjectFile } from './smokeTestHarness.ts';

const primary = {
  bounds: {
    height: 1440,
    width: 2560,
    x: 0,
    y: 0,
  },
  displayId: 'primary',
  id: 'primary',
  name: '主屏 2560x1440',
  type: 'screen' as const,
};

const secondary = {
  bounds: {
    height: 1440,
    width: 3440,
    x: -3440,
    y: 0,
  },
  displayId: 'secondary',
  id: 'secondary',
  name: '副屏 3440x1440',
  type: 'screen' as const,
};

const displays = [primary, secondary];

const primaryAudit = createAgentCoordinateAuditEvidence({
  displaySources: displays,
  point: {
    coordinateSpace: 'native-screen',
    x: 1280,
    y: 720,
  },
  source: primary,
});
assert.equal(primaryAudit.status, 'coordinate_ok');
assert.equal(primaryAudit.insideSourceBounds, true);
assert.deepEqual(primaryAudit.sourceRatio, { x: 0.5, y: 0.5 });
assert.equal(primaryAudit.pointDisplayId, 'primary');
assert.match(formatAgentCoordinateAuditLine(primaryAudit), /status=coordinate_ok/u);

const secondaryNegativeCoordinateAudit = createAgentCoordinateAuditEvidence({
  displaySources: displays,
  point: {
    coordinateSpace: 'native-screen',
    x: -1720,
    y: 720,
  },
  source: secondary,
});
assert.equal(secondaryNegativeCoordinateAudit.status, 'coordinate_ok');
assert.equal(secondaryNegativeCoordinateAudit.insideSourceBounds, true);
assert.deepEqual(secondaryNegativeCoordinateAudit.sourceRatio, { x: 0.5, y: 0.5 });
assert.equal(secondaryNegativeCoordinateAudit.pointDisplayId, 'secondary');

const displayMismatchAudit = createAgentCoordinateAuditEvidence({
  displaySources: displays,
  point: {
    coordinateSpace: 'native-screen',
    x: -1720,
    y: 720,
  },
  source: primary,
});
assert.equal(displayMismatchAudit.status, 'coordinate_display_mismatch');
assert.equal(displayMismatchAudit.insideSourceBounds, false);
assert.equal(displayMismatchAudit.pointDisplayId, 'secondary');
assert.equal(displayMismatchAudit.sourceDisplayId, 'primary');

const outOfBoundsAudit = createAgentCoordinateAuditEvidence({
  displaySources: [],
  point: {
    coordinateSpace: 'native-screen',
    x: 3000,
    y: 800,
  },
  source: primary,
});
assert.equal(outOfBoundsAudit.status, 'coordinate_out_of_bounds');
assert.equal(outOfBoundsAudit.insideSourceBounds, false);
assert.deepEqual(outOfBoundsAudit.sourceRatio, { x: 1.1719, y: 0.5556 });

const unknownAudit = createAgentCoordinateAuditEvidence({
  displaySources: displays,
  point: {
    coordinateSpace: 'source-ratio',
    x: 0.5,
    y: 0.5,
  },
  source: primary,
});
assert.equal(unknownAudit.status, 'coordinate_unknown');
assert.equal(unknownAudit.reason, 'Point coordinateSpace is source-ratio, not native-screen.');

const captureQualitySource = readProjectFile('src/agent/agentCaptureQuality.ts');
assert.match(
  captureQualitySource,
  /if \(xRatio < 0 \|\| xRatio > 1 \|\| yRatio < 0 \|\| yRatio > 1\) \{[\s\S]*return null;/u,
  'red-dot preview should not clamp out-of-bounds points into the capture edge',
);

const visualRuntimeSource = readProjectFile('src/agent/agentRuntimeVisualTools.ts');
assert.match(
  visualRuntimeSource,
  /coordinateAuditFailed[\s\S]*Visual coordinate audit failed/u,
  'visual action readiness should be downgraded when coordinate audit fails',
);
assert.match(
  visualRuntimeSource,
  /coordinateAuditStatus: coordinateAudit\?\.status \?\? null/u,
  'visual structured evidence should expose coordinateAuditStatus',
);

const desktopRuntimeSource = readProjectFile('src/agent/agentRuntimeDesktopTools.ts');
assert.match(
  desktopRuntimeSource,
  /Input replay coordinate audit failed: \$\{coordinateAudit\.status\}/u,
  'desktop input replay should expose coordinate audit failures as missing evidence',
);

const coordinateHarnessSource = readProjectFile('src/agent/agentCoordinateHarness.ts');
assert.match(
  coordinateHarnessSource,
  /evaluateAgentCoordinateClosureHarness/u,
  'coordinate closure harness should cover ratio-to-screen, red-dot ratio, coordinate audit, and target-region change evaluation',
);
assert.match(
  coordinateHarnessSource,
  /targetRegionChanged/u,
  'coordinate closure harness should explicitly expose whether the intended target region changed',
);
assert.match(
  coordinateHarnessSource,
  /coordinate_closure_coordinate_failed/u,
  'coordinate closure harness should fail closed when coordinate audit fails',
);

const sessionSource = readProjectFile('src/agent/agentProductionSessionImplementation.ts');
assert.match(
  sessionSource,
  /structuredEvidence\.coordinateAuditStatus is coordinate_out_of_bounds/u,
  'AgentSessionV2 should tell the model not to click with failed coordinate audits',
);

const sessionToolResultSummarySource = readProjectFile('src/agent/runtime/agentToolResultSummary.ts');

console.log('agent coordinate audit smoke ok');
