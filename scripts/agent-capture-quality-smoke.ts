import { readMessageProjectFile as readProjectFile } from './chatMessageSource.mjs';
import assert from 'node:assert/strict';
import { analyzeAgentCapturePixels } from '../src/agent/agentCaptureQuality';


function createSolidFrame(width: number, height: number, color: [number, number, number, number]) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    data[offset] = color[0];
    data[offset + 1] = color[1];
    data[offset + 2] = color[2];
    data[offset + 3] = color[3];
  }
  return data;
}

function createDarkUiLikeFrame(width: number, height: number) {
  const data = createSolidFrame(width, height, [18, 20, 24, 255]);
  for (let y = 8; y < height - 8; y += 11) {
    for (let x = 10; x < width - 10; x += 9) {
      const offset = (y * width + x) * 4;
      data[offset] = 72 + ((x + y) % 70);
      data[offset + 1] = 82 + ((x * 3 + y) % 80);
      data[offset + 2] = 96 + ((x + y * 2) % 90);
      data[offset + 3] = 255;
    }
  }
  for (let y = 30; y < 48; y += 1) {
    for (let x = 24; x < 180; x += 1) {
      const offset = (y * width + x) * 4;
      data[offset] = 210;
      data[offset + 1] = 214;
      data[offset + 2] = 220;
      data[offset + 3] = 255;
    }
  }
  return data;
}

const black = analyzeAgentCapturePixels({
  data: createSolidFrame(120, 80, [0, 0, 0, 255]),
  height: 80,
  width: 120,
});
assert.equal(black.status, 'capture_black_frame');
assert.equal(black.trusted, false);

const flatDark = analyzeAgentCapturePixels({
  data: createSolidFrame(120, 80, [22, 22, 24, 255]),
  height: 80,
  width: 120,
});
assert.equal(flatDark.status, 'capture_low_entropy');
assert.equal(flatDark.trusted, false);

const darkUi = analyzeAgentCapturePixels({
  data: createDarkUiLikeFrame(220, 120),
  height: 120,
  width: 220,
});
assert.equal(darkUi.status, 'capture_ok');
assert.equal(darkUi.trusted, true);

const visualToolSource = readProjectFile('src/agent/agentRuntimeVisualTools.ts');
assert.match(
  visualToolSource,
  /createTrustedVisualSnapshotSource/u,
  'visual tools should prepare a trusted capture source before model analysis',
);
assert.match(
  visualToolSource,
  /capture_fallback_screen_crop/u,
  'visual tools should include window-capture fallback to screen crop',
);
assert.match(
  visualToolSource,
  /const allowWindowCaptureFallback = explicitScreenFallback !== false && sourceType !== 'screen';/u,
  'window visual captures should default to screen-crop fallback unless explicitly disabled',
);
assert.match(
  visualToolSource,
  /const hasExplicitSource = Boolean\(sourceId \|\| delegatedSourceQuery\);[\s\S]*delegatedInput\.allowScreenFallback = allowScreenFallback;/u,
  'locate_screen_elements should keep explicit window sources strict by default',
);
assert.match(
  visualToolSource,
  /Visual capture was rejected before model analysis/u,
  'untrusted visual captures should be rejected before model analysis',
);
assert.match(
  visualToolSource,
  /Game capture was rejected before model analysis/u,
  'untrusted game captures should be rejected before model analysis',
);

const desktopToolSource = readProjectFile('src/agent/agentRuntimeDesktopTools.ts');
assert.match(
  desktopToolSource,
  /createAgentCaptureRedDotPreview/u,
  'desktop input should create red-dot replay previews',
);
assert.match(
  desktopToolSource,
  /inputReplayPreview/u,
  'desktop input should expose replay preview in structured evidence',
);
assert.match(
  desktopToolSource,
  /evaluateAgentCoordinateReplayClosureHarness/u,
  'desktop input replay should evaluate coordinate closure status',
);
assert.match(
  desktopToolSource,
  /coordinateClosureStatus: coordinateClosure\?\.status \?\? null/u,
  'desktop input replay should expose coordinate closure status in preview evidence',
);
assert.match(
  desktopToolSource,
  /Input replay coordinate closure failed: \$\{coordinateClosure\.status\}/u,
  'desktop input replay should fail closed when coordinate closure is not ok',
);

const sequenceToolSource = readProjectFile('src/agent/agentRuntimeDesktopSequenceTools.ts');
assert.match(
  sequenceToolSource,
  /hasUnverifiedStep/u,
  'desktop sequence should propagate unverified input steps',
);
assert.match(
  sequenceToolSource,
  /coordinateClosureStatus[\s\S]*coordinate_closure_ok/u,
  'desktop sequence should treat non-ok input replay coordinate closure as unverified',
);

const sessionSource = readProjectFile('src/agent/agentProductionSessionImplementation.ts');
assert.match(
  sessionSource,
  /inputReplayCoordinateClosure/u,
  'AgentSessionV2 critical facts should expose input replay coordinate closure status',
);

const bubbleSource = readProjectFile('src/components/chat/PetChatConversationMessageBubble.tsx');
assert.match(
  bubbleSource,
  /beforeRedDotDataUrl/u,
  'agent receipt UI should render before red-dot preview',
);
assert.match(
  bubbleSource,
  /afterRedDotDataUrl/u,
  'agent receipt UI should render after red-dot preview',
);
assert.match(
  bubbleSource,
  /inputReplayClosure/u,
  'agent receipt UI should render input replay coordinate closure status',
);

console.log('agent-capture-quality-smoke passed');
