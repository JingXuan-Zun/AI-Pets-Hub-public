import assert from 'node:assert/strict';
import {
  resolvePetAvatarShellStyle,
  resolvePetRuntimeViewport,
} from '../src/components/pet/petAvatarLayerGeometry';
import { readProjectFile } from './smokeTestHarness.ts';

assert.deepEqual(
  resolvePetRuntimeViewport({
    activityCenter: { x: 320.4, y: 200.2 },
    renderedPosition: { x: 41.3, y: -18.6 },
    shellSize: 257,
  }),
  {
    height: 257,
    width: 257,
    x: 233,
    y: 53,
  },
  'runtime viewport should center the shell at activity center plus rendered position',
);

assert.deepEqual(
  resolvePetAvatarShellStyle({
    isDragging: false,
    renderedPosition: { x: 24, y: -12 },
    shellSize: 256,
  }),
  {
    height: '256px',
    transform: 'translate3d(24px, -12px, 0)',
    transition: 'transform 220ms ease, width 220ms ease, height 220ms ease',
    willChange: 'transform',
    width: '256px',
  },
  'idle shell style should keep the animated transform transition',
);

assert.equal(
  resolvePetAvatarShellStyle({
    isDragging: true,
    renderedPosition: { x: 24, y: -12 },
    shellSize: 256,
  }).transition,
  'none',
  'dragging shell style should disable transition',
);

assert.equal(
  resolvePetAvatarShellStyle({
    isDragging: false,
    isScaling: true,
    renderedPosition: { x: 24, y: -12 },
    shellSize: 320,
  }).transition,
  'none',
  'wheel scaling should commit shell position and size in one frame instead of easing them independently',
);

const dragPreviewOwnedShellStyle = resolvePetAvatarShellStyle({
  isDragging: true,
  renderedPosition: { x: 24, y: -12 },
  shellSize: 256,
  shouldLetDragPreviewOwnTransform: true,
});

assert.equal(
  Object.hasOwn(dragPreviewOwnedShellStyle, 'transform'),
  false,
  'primary drag DOM preview should own transform during active drag so React cannot rewrite a stale renderedPosition',
);

assert.equal(
  dragPreviewOwnedShellStyle.transition,
  'none',
  'drag preview owned shell style should still disable transitions while dragging',
);

const primaryLayerSource = readProjectFile('src/components/pet/PetAvatarLayer.tsx');
const companionLayerSource = readProjectFile('src/components/pet/PetCompanionLayer.tsx');

for (const [label, source] of [
  ['primary', primaryLayerSource],
  ['companion', companionLayerSource],
] as const) {
  assert.match(
    source,
    /isWheelInteractionActive[\s\S]*resolvePetAvatarShellStyle\(\{[\s\S]*isScaling:\s*isWheelInteractionActive/u,
    `${label} pet shell should disable geometry transitions during wheel scaling`,
  );
}

console.log('pet-avatar-layer-geometry smoke passed');
