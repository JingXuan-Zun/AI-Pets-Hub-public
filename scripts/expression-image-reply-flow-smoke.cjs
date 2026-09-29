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
  loaded.filename = file;
  loaded.paths = module.paths;
  loaded._compile(output.outputFiles[0].text, file);
  return loaded.exports;
}

async function run() {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'expression-image-reply-'));
  try {
    const { resolveExpressionReply } = loadSource('../src/expression/reply/expressionReplyRuntime.ts');
    const { DEFAULT_EXPRESSION_REPLY_SETTINGS } = loadSource('../src/expression/expressionSettings.ts');
    const { getExpressionLibraryReadiness } = loadSource('../src/expression/expressionLibraryReadiness.ts');
    const service = createExpressionLibraryService({ managedRootPath: path.join(sandbox, 'images'), userDataPath: path.join(sandbox, 'data') });
    const source = path.join(sandbox, 'image.png');
    await fs.writeFile(source, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64'));
    const replySettings = { ...DEFAULT_EXPRESSION_REPLY_SETTINGS, imageLibraryEnabled: true, imageLibraryMode: 'managed', imageStickerWeight: 100, kaomojiWeight: 0, systemEmojiWeight: 0 };
    const resolve = async (replyText) => {
      const { catalog } = await service.getReplyCatalog();
      return resolveExpressionReply({ catalog: { ...catalog, system: { version: 1, emoji: [], kaomoji: [] } }, conversationId: 'image-flow', petId: 'pet', recentHistory: [], replySettings, replyText });
    };
    for (const [name, replyText] of [['开心', '今天真开心！'], ['愤怒', '我很生气！'], ['高兴', '今天真开心！']]) {
      let result = await service.getState({ rescan: true });
      if (!result.state.categories.some((category) => category.name === name)) result = await service.createCategory({ name, description: '' });
      const category = result.state.categories.find((item) => item.name === name);
      result = await service.importImages({ categoryId: category.id, sourcePaths: [source] });
      const asset = result.state.assets.find((item) => item.categoryId === category.id);
      assert.equal(getExpressionLibraryReadiness(result.state).ready, 0);
      assert.ok(getExpressionLibraryReadiness(result.state).pending > 0);
      assert.equal((await resolve(replyText)).some((item) => item.assetId === asset.id), false, '上传不应绕过审核');
      result = await service.setAssetStatus({ assetIds: [asset.id], status: 'accepted' });
      assert.equal(getExpressionLibraryReadiness(result.state).ready, 1);
      assert.ok((await resolve(replyText)).some((item) => item.assetId === asset.id), `${name}图片通过审核后，100% 图片回复应能选中匹配图片`);
      if (name === '愤怒') assert.equal((await resolve('我没有生气。')).some((item) => item.kind === 'expression'), false, '否定的情绪不能被当作发图意图');
      await service.setAssetStatus({ assetIds: [asset.id], status: 'needs-review' });
      assert.equal((await resolve(replyText)).some((item) => item.assetId === asset.id), false, '退回审核后应停止使用');
    }
    const happy = (await service.getState()).state.categories.find((item) => item.name === '开心');
    let result = await service.getState();
    const happyAsset = result.state.assets.find((item) => item.categoryId === happy.id);
    await service.setAssetStatus({ assetIds: [happyAsset.id], status: 'accepted' });
    await service.updateCategory({ categoryId: happy.id, name: happy.name, description: '新的分类语义' });
    assert.equal((await resolve('今天真开心！')).some((item) => item.kind === 'expression'), false, '分类修改后必须重新审核');
    await service.setAssetStatus({ assetIds: [happyAsset.id], status: 'accepted' });
    await fs.unlink(path.join(sandbox, 'images', happyAsset.relativePath));
    assert.equal((await resolve('今天真开心！')).some((item) => item.kind === 'expression'), false, '失效图片不能参与回复');
    result = await service.getState({ rescan: true });
    assert.equal(getExpressionLibraryReadiness(result.state).missing, 1);
    console.log('expression image reply flow smoke: ok');
  } finally {
    assert.equal(path.dirname(sandbox), path.resolve(os.tmpdir()));
    assert.ok(path.basename(sandbox).startsWith('expression-image-reply-'));
    await fs.rm(sandbox, { recursive: true, force: true });
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
