import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { showcase: showcaseSource } = readProjectSources({
  showcase: 'src/components/pet/useDesktopOrganizationShowcase.ts',
});

assert.match(
  showcaseSource,
  /type DesktopIconMoveVerificationMode = 'grid-arrangement' \| 'precise-placement'/u,
  'desktop icon verification should distinguish batch arrangement from precise placement',
);

assert.match(
  showcaseSource,
  /function acceptsDesktopGridSnapping\([\s\S]*acceptedCount === summary\.itemCount[\s\S]*missingCount === 0[\s\S]*insideTargetViewportCount === summary\.itemCount/u,
  'batch arrangement should accept Windows grid snapping when all moved icons remain in target viewport',
);

assert.match(
  showcaseSource,
  /return mode === 'grid-arrangement' && acceptsDesktopGridSnapping\(summary\)/u,
  'grid snapping should only verify batch desktop arrangement',
);

assert.match(
  showcaseSource,
  /const verificationMode: DesktopIconMoveVerificationMode = 'grid-arrangement'[\s\S]*summarizeDesktopIconMoveSummary\(summary, verificationMode\)/u,
  'desktop organization should report grid snapping as a successful batch arrangement',
);

assert.match(
  showcaseSource,
  /const verificationMode: DesktopIconMoveVerificationMode = 'precise-placement'[\s\S]*const finalText = verified/u,
  'single icon placement should keep precise placement verification',
);

assert.match(
  showcaseSource,
  /const gridSnapped = mode === 'grid-arrangement'[\s\S]*Windows[\s\S]*summary\.acceptedCount[\s\S]*summary\.itemCount/u,
  'verification text should explain accepted grid snapping',
);

console.log('desktop organization grid snap verification smoke ok');
