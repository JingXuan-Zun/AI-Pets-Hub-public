import assert from 'node:assert/strict';
import {
  DEFAULT_EXPRESSION_REPLY_SETTINGS,
  calculateEffectiveExpressionReplySettings,
  normalizeExpressionReplySettings,
} from '../src/expression/expressionSettings.ts';

assert.equal(DEFAULT_EXPRESSION_REPLY_SETTINGS.imageStickerWeight, 0);
assert.equal(DEFAULT_EXPRESSION_REPLY_SETTINGS.imageLibraryMode, null);
assert.equal(normalizeExpressionReplySettings({ imageLibraryMode: 'external' }).imageLibraryMode, 'external');
assert.equal(normalizeExpressionReplySettings({ imageLibraryMode: 'invalid' }).imageLibraryMode, null);
assert.equal(normalizeExpressionReplySettings({ imageLibraryEnabled: true }).imageStickerWeight, 0);
assert.equal(normalizeExpressionReplySettings({ imageLibraryEnabled: true, imageStickerWeight: 42 }).imageStickerWeight, 0);
assert.equal(normalizeExpressionReplySettings({
  imageLibraryEnabled: true,
  imageLibraryWeightInitialized: true,
  imageStickerWeight: 42,
}).imageStickerWeight, 42);
assert.equal(calculateEffectiveExpressionReplySettings({
  ...DEFAULT_EXPRESSION_REPLY_SETTINGS,
  imageLibraryEnabled: true,
  imageStickerWeight: 42,
}, 0).imageStickerWeight, 0);

console.log('expression reply settings smoke: ok');
