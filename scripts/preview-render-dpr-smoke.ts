import assert from 'node:assert/strict';
import { resolvePreviewRenderDpr } from '../src/pet-runtime/avatar3d/previewRenderDpr';

// A small preview renders at least at native resolution (a little above it on 1x screens).
assert.equal(resolvePreviewRenderDpr(1.55, 600, 450), 1.55);
assert.equal(resolvePreviewRenderDpr(1, 600, 450), 1.25);
// Before the canvas size is known: native resolution.
assert.equal(resolvePreviewRenderDpr(1.55), 1.55);
// The 互动对话 canvas runs far past a maximized window (2755x3294 css px): capped near 12 M pixels.
const capped = resolvePreviewRenderDpr(1.55, 2755, 3294);
assert.ok(capped < 1.55 && capped >= 0.75);
assert.ok((2755 * capped) * (3294 * capped) <= 12_100_000);
console.log('preview render dpr smoke ok');
