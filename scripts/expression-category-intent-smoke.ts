import assert from 'node:assert/strict';
import { resolveExpressionReply } from '../src/expression/reply/expressionReplyRuntime.ts';
import { DEFAULT_EXPRESSION_REPLY_SETTINGS } from '../src/expression/expressionSettings.ts';
import type { ExpressionReplyCatalog } from '../src/expression/expressionLibraryTypes.ts';

const catalog: ExpressionReplyCatalog = {
  roots: [{
    id: 'main', name: '表情包', sourceType: 'managed', replyPriority: 0, enabledForReply: true,
    categories: [
      { id: 'jealous', name: '吃醋', description: '吃醋，是人在意的人把关注或亲近给了别人时，因为担心自己不再特别，心里生出的酸涩、不安与失落。它不一定是生气，也可以是嘴上说着“你们聊”，心里却想着：“我也想成为你更在意的那个人。”', semanticVersion: 2 },
      { id: 'happy', name: '开心', description: '开心，是人在感受到美好、满足或被理解时，心里自然生出的轻松与愉悦。', semanticVersion: 2 },
      { id: 'hurt', name: '委屈', description: '委屈，是人在遭遇误解、不公平的对待，或自己的付出与感受没有被看见时，心里生出的难过与无奈。它不一定是哭泣，也可以是明明有很多话想说，却只说了句“没事”。', semanticVersion: 2 },
    ],
    assets: [
      { assetId: 'jealous-image', categoryId: 'jealous', mimeType: 'image/png' },
      { assetId: 'happy-image', categoryId: 'happy', mimeType: 'image/png' },
      { assetId: 'hurt-image', categoryId: 'hurt', mimeType: 'image/png' },
    ],
  }],
  system: { emoji: [], kaomoji: [], version: 1 },
};

function images(replyText: string, source = catalog, recentHistory = [] as { expressionId: string }[]) {
  return resolveExpressionReply({ catalog: source, conversationId: 'category-regression', petId: 'pet', recentHistory,
    replySettings: { ...DEFAULT_EXPRESSION_REPLY_SETTINGS, imageLibraryEnabled: true, imageLibraryMode: 'managed', imageStickerWeight: 100, kaomojiWeight: 0, systemEmojiWeight: 0 }, replyText,
  }).filter((segment) => segment.kind === 'expression');
}

assert.equal(images('奴家好生欢喜，也好生心疼。少主可愿让奴家替您簪上这花，可以吗？')[0]?.assetId, 'happy-image');
assert.equal(images('今天真开心！')[0]?.assetId, 'happy-image');
assert.equal(images('（眸中情潮经风一吹，转成惊喜与柔光。她颊边泛红，拢了拢滑落的衣襟，双手郑重地接过那朵玄月花，低头轻嗅）少主竟把这断魂崖一甲子一开的花，生生捧来给奴家……（眼睫微颤，声音也柔了）璃奴不过无意间提过一句喜欢它月魄似的清辉，连自己都忘了，可少主却记得这样牢。').every((item) => item.assetId === 'happy-image'), true);
assert.equal(images('我吃醋了。')[0]?.assetId, 'jealous-image');
assert.equal(images('我觉得委屈。')[0]?.assetId, 'hurt-image');
assert.equal(images('我很难过。').length, 0, '委屈与吃醋的描述不能使其成为伤心分类');
assert.equal(images('可以打开设置。').length, 0, '普通许可语句不是开心情绪');
assert.equal(images('今天真开心！', catalog, [{ expressionId: 'happy-image' }])[0]?.assetId, 'happy-image');
assert.equal(images('今天真开心！', { ...catalog, roots: [{ ...catalog.roots[0], assets: catalog.roots[0].assets.slice(0, 1) }] }).length, 0);
const renamed = (name: string, description: string): ExpressionReplyCatalog => ({ ...catalog, roots: [{
  ...catalog.roots[0], categories: [{ ...catalog.roots[0].categories[1], name, description }], assets: [catalog.roots[0].assets[1]],
}] });
assert.equal(images('今天真开心！', renamed('高兴', ''))[0]?.assetId, 'happy-image');
assert.equal(images('今天真开心！', renamed('阳光时刻', '表达开心和愉悦'))[0]?.assetId, 'happy-image');
assert.equal(images('今天真开心！', renamed('复杂心情', '开心或吃醋')).length, 0);
console.log('expression category intent smoke: ok');
