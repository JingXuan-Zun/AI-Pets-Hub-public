import assert from 'node:assert/strict';
import { resolvePointerLook3DVisualStyle } from '../src/components/pet/petPointerLookVisual';

const activeStyle = resolvePointerLook3DVisualStyle({ x: 28, y: -42 });
const activeTransform = String(activeStyle.transform);

assert.equal(activeTransform, 'translate(-50%, -50%)', '3D pointer look should preserve only the base centering transform');
assert.doesNotMatch(activeTransform, /perspective|rotate|translate3d/u, '3D pointer look should not rotate or squash the full canvas');
assert.equal(activeStyle.transition, 'transform 80ms linear');

const returnStyle = resolvePointerLook3DVisualStyle(null);
const returnTransform = String(returnStyle.transform);

assert.equal(returnTransform, 'translate(-50%, -50%)', '3D pointer look should stay centered without a target');
assert.equal(returnStyle.transition, 'transform 260ms ease-out');

console.log('pointer look 3D visual smoke ok');
