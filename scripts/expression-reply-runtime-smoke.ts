import assert from 'node:assert/strict';
import { resolveExpressionReply } from '../src/expression/reply/expressionReplyRuntime.ts';
import type { ExpressionReplyCatalog } from '../src/expression/expressionLibraryTypes.ts';
import { DEFAULT_EXPRESSION_REPLY_SETTINGS } from '../src/expression/expressionSettings.ts';

const catalog: ExpressionReplyCatalog = {
  roots: [{
    assets: [{ assetId: 'sticker-happy', categoryId: 'cat-happy', mimeType: 'image/png' }],
    categories: [{ description: '开心、庆祝', id: 'cat-happy', name: '开心', semanticVersion: 1 }],
    enabledForReply: true,
    id: 'root-main',
    name: '我的表情包',
    replyPriority: 0,
    sourceType: 'managed',
  }],
  system: {
    emoji: [{ id: 'system-emoji-happy', intents: ['开心'], value: '😊' }],
    kaomoji: [{ id: 'system-kaomoji-happy', intents: ['开心'], value: '(｡･ω･｡)ﾉ♡' }],
    version: 1,
  },
};

const settings = {
  ...DEFAULT_EXPRESSION_REPLY_SETTINGS,
  imageLibraryEnabled: true,
  imageStickerWeight: 0,
};
const counts = { emoji: 0, image: 0, kaomoji: 0 };
for (let index = 0; index < 50; index += 1) {
  const content = resolveExpressionReply({
    catalog,
    conversationId: 'single',
    petId: 'pet-1',
    recentHistory: [],
    replySettings: settings,
    replyText: '今天真开心！',
  });
  const expression = content.find((segment) => segment.kind === 'expression');
  if (expression?.kind === 'expression') counts[expression.expressionKind] += 1;
}
assert.equal(counts.image, 0);
assert.equal(counts.kaomoji, 30);
assert.equal(counts.emoji, 20);

const imageOnly = resolveExpressionReply({
  catalog,
  conversationId: 'image-only',
  petId: 'pet-1',
  recentHistory: [],
  replySettings: { ...settings, imageLibraryMode: 'managed', imageStickerWeight: 100, kaomojiWeight: 0, systemEmojiWeight: 0 },
  replyText: '今天真开心！',
});
const imageExpression = imageOnly.find((segment) => segment.kind === 'expression');
assert.equal(imageExpression?.kind === 'expression' ? imageExpression.expressionKind : null, 'image');
assert.equal(JSON.stringify(imageExpression).includes('path'), false);

const noSelectedImageLibrary = resolveExpressionReply({
  catalog,
  conversationId: 'image-library-not-selected',
  petId: 'pet-1',
  recentHistory: [],
  replySettings: { ...settings, imageLibraryMode: null, imageStickerWeight: 100, kaomojiWeight: 0, systemEmojiWeight: 0 },
  replyText: '今天真开心！',
});
assert.equal(noSelectedImageLibrary.some((segment) => segment.kind === 'expression'), false);

const multiIntent = resolveExpressionReply({
  catalog: {
    ...catalog,
    system: {
      ...catalog.system,
      emoji: [
        ...catalog.system.emoji,
        { id: 'system-emoji-confused', intents: ['疑惑'], value: '🤔' },
      ],
      kaomoji: [
        ...catalog.system.kaomoji,
        { id: 'system-kaomoji-confused', intents: ['疑惑'], value: '(・_・ヾ' },
      ],
    },
  },
  conversationId: 'multi-intent',
  petId: 'pet-1',
  recentHistory: [],
  replySettings: { ...settings, imageLibraryEnabled: false },
  replyText: '今天真开心！为什么会这样？',
});
assert.deepEqual(multiIntent.map((segment) => segment.kind), ['text', 'expression', 'text', 'expression']);

const priorityCatalog: ExpressionReplyCatalog = {
  ...catalog,
  roots: [
    { ...catalog.roots[0], id: 'root-low', name: '低优先级', replyPriority: 2 },
    {
      ...catalog.roots[0],
      assets: [{ assetId: 'sticker-high', categoryId: 'cat-happy', mimeType: 'image/png' }],
      id: 'root-high',
      name: '高优先级',
      replyPriority: 0,
    },
  ],
};
const priorityResult = resolveExpressionReply({
  catalog: priorityCatalog,
  conversationId: 'priority',
  petId: 'pet-1',
  recentHistory: [],
  replySettings: { ...settings, imageLibraryMode: 'managed', imageStickerWeight: 100, kaomojiWeight: 0, systemEmojiWeight: 0 },
  replyText: '今天真开心！',
});
const priorityExpression = priorityResult.find((segment) => segment.kind === 'expression');
assert.equal(priorityExpression?.kind === 'expression' ? priorityExpression.assetId : null, 'sticker-high');

console.log('expression reply runtime smoke: ok');
