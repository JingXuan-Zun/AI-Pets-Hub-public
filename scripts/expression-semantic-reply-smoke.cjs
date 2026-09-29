const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { createExpressionLibraryService } = require('../electron/expressionLibraryService.cjs');

function loadSource(relativePath) {
  const file = path.resolve(__dirname, relativePath);
  const output = require('esbuild').buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', write: false });
  const loaded = new Module(file, module);
  loaded.paths = module.paths;
  loaded._compile(output.outputFiles[0].text, file);
  return loaded.exports;
}

async function run() {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'expression-semantic-'));
  try {
    const { resolveExpressionReplyWithSemantics } = loadSource('../src/expression/reply/expressionReplySemantics.ts');
    const { resolveExpressionReply } = loadSource('../src/expression/reply/expressionReplyRuntime.ts');
    const { DEFAULT_EXPRESSION_REPLY_SETTINGS } = loadSource('../src/expression/expressionSettings.ts');
    const service = createExpressionLibraryService({ managedRootPath: path.join(sandbox, 'images'), userDataPath: path.join(sandbox, 'data') });
    const source = path.join(sandbox, 'image.png');
    await fs.writeFile(source, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
    const { state } = await service.getState({ rescan: true });
    const happy = state.categories.find((item) => item.name === '开心');
    const imported = await service.importImages({ categoryId: happy.id, sourcePaths: [source] });
    const asset = imported.state.assets.find((item) => item.categoryId === happy.id);
    const input = async () => ({
      catalog: { ...(await service.getReplyCatalog()).catalog, system: { version: 1, emoji: [], kaomoji: [] } },
      conversationId: 'semantic', petId: 'pet', recentHistory: [],
      replySettings: { ...DEFAULT_EXPRESSION_REPLY_SETTINGS, imageLibraryEnabled: true, imageLibraryMode: 'managed', imageStickerWeight: 100, kaomojiWeight: 0, systemEmojiWeight: 0 },
      replyText: '（眸中冰蓝骤暖，金色渐浓，一时竟忘了接花，怔怔望了片刻才轻启朱唇）您竟还记得我曾随口提过的一句喜好。',
    });
    let calls = 0;
    const classify = async ({ userInput }) => {
      calls++;
      assert.ok(!userInput.includes(asset.id) && !userInput.includes(sandbox), '模型不能接触图片 ID 或路径');
      const data = JSON.parse(userInput);
      const categoryIndex = data.categories.findIndex((item) => item.name === '开心');
      return JSON.stringify({ selections: [{ segmentIndex: 0, categoryIndex }] });
    };
    const image = (content) => content.find((item) => item.expressionKind === 'image');
    assert.equal(image(await resolveExpressionReplyWithSemantics(await input(), classify)), undefined);
    assert.equal(calls, 0, '没有已审核候选时不请求模型');
    await service.setAssetStatus({ assetIds: [asset.id], status: 'accepted' });
    assert.equal(image(resolveExpressionReply(await input())), undefined, '旧关键词路径复现漏图');
    const content = await resolveExpressionReplyWithSemantics(await input(), classify);
    assert.equal(image(content)?.assetId, asset.id, '隐含情绪经语义分类后必须选中已审核图片');
    assert.equal(content.filter((item) => item.kind === 'text').map((item) => item.text).join(''), (await input()).replyText);
    assert.equal((await service.getPreview({ assetId: image(content).assetId })).ok, true);
    for (const name of ['吃醋', '委屈', '被惦记']) {
      const created = await service.createCategory({ name, description: '按用户定义的情绪语义选择' });
      const category = created.state.categories.find((item) => item.name === name);
      const added = await service.importImages({ categoryId: category.id, sourcePaths: [source] });
      const selectedAsset = added.state.assets.find((item) => item.categoryId === category.id);
      await service.setAssetStatus({ assetIds: [selectedAsset.id], status: 'accepted' });
      const result = await resolveExpressionReplyWithSemantics(await input(), async ({ userInput }) => {
        const data = JSON.parse(userInput);
        return JSON.stringify({ selections: [{ segmentIndex: 0, categoryIndex: data.categories.findIndex((item) => item.name === name) }] });
      });
      assert.equal(image(result)?.assetId, selectedAsset.id, '用户分类经语义选择后无需命中硬编码关键词');
      await service.setAssetStatus({ assetIds: [selectedAsset.id], status: 'needs-review' });
    }
    assert.equal(image(await resolveExpressionReplyWithSemantics(await input(), async () => '{"selections":[]}')), undefined);
    for (const response of ['{"selections":[{"segmentIndex":-1,"categoryIndex":0}]}', '{"selections":[{"segmentIndex":0,"categoryIndex":999}]}', 'invalid']) {
      assert.equal(image(await resolveExpressionReplyWithSemantics(await input(), async () => response)), undefined);
    }
    const disabled = await input();
    disabled.replySettings.imageStickerWeight = 0;
    assert.equal(image(await resolveExpressionReplyWithSemantics(disabled, async () => { throw new Error('must not call'); })), undefined);
    const explicit = { ...await input(), replyText: '今天真开心！' };
    assert.equal(image(await resolveExpressionReplyWithSemantics(explicit, async () => { throw new Error('offline'); }))?.assetId, asset.id, '模型失败保留本地明确情绪的回退');
    await service.setAssetStatus({ assetIds: [asset.id], status: 'needs-review' });
    assert.equal(image(await resolveExpressionReplyWithSemantics(await input(), classify)), undefined);
    console.log('expression semantic reply smoke: ok (import -> review -> implicit emotion -> image -> preview)');
  } finally {
    assert.equal(path.dirname(sandbox), path.resolve(os.tmpdir()));
    assert.ok(path.basename(sandbox).startsWith('expression-semantic-'));
    await fs.rm(sandbox, { recursive: true, force: true });
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
