const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createExpressionLibraryService } = require('../electron/expressionLibraryService.cjs');

function loadPanel(relativePath) {
  const file = path.resolve(__dirname, relativePath);
  const output = require('esbuild').buildSync({ entryPoints: [file], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'], write: false });
  const loaded = new Module(file, module);
  loaded.filename = file;
  loaded.paths = module.paths;
  loaded._compile(output.outputFiles[0].text, file);
  return loaded.exports;
}

async function run() {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'expression-deleted-category-'));
  try {
    const managedRootPath = path.join(sandbox, 'managed');
    const service = createExpressionLibraryService({ managedRootPath, userDataPath: path.join(sandbox, 'data') });
    let result = await service.getState({ rescan: true });
    const happy = result.state.categories.find((category) => category.name === '开心');
    const sad = result.state.categories.find((category) => category.name === '伤心');
    const source = path.join(sandbox, 'sample.png');
    await fs.writeFile(source, Buffer.from([137, 80, 78, 71]));
    result = await service.importImages({ categoryId: happy.id, sourcePaths: [source] });
    const assetId = result.state.assets[0].id;
    await service.setAssetStatus({ assetIds: [assetId], status: 'accepted' });
    result = await service.deleteCategory({ categoryId: happy.id });
    const { ExpressionCategoryPanel } = loadPanel('../src/components/settings/ExpressionCategoryPanel.tsx');
    const callbacks = { onChange() {}, onCreate() {}, onDelete() {}, onDropImages() {}, onOpenFolder() {}, onSelect() {} };
    const markup = renderToStaticMarkup(React.createElement(ExpressionCategoryPanel, {
      ...callbacks, state: result.state, category: sad, name: sad.name, description: sad.description, managed: true, loading: false,
    }));
    assert.equal(markup.includes('未分类'), false, '删除分类后，分类管理不能出现系统未分类入口');
    assert.equal(result.state.assets[0].classificationStatus, 'needs-review');
    await fs.stat(path.join(managedRootPath, result.state.assets[0].relativePath));
    await assert.rejects(fs.stat(path.join(managedRootPath, '开心')), { code: 'ENOENT' });
    result = await service.setAssetStatus({ assetIds: [assetId], status: 'accepted' });
    assert.equal(result.batch.successCount, 0, '待重新归类图片必须先指定语义分类，不能直接审核进回复候选');
    assert.equal((await service.getReplyCatalog()).catalog.roots[0].assets.length, 0);
    result = await service.moveAssets({ assetIds: [assetId], targetCategoryId: sad.id });
    assert.equal(result.state.assets[0].categoryId, sad.id);
    assert.equal(result.state.assets[0].classificationStatus, 'needs-review');
    await service.setAssetStatus({ assetIds: [assetId], status: 'accepted' });
    assert.equal((await service.getReplyCatalog()).catalog.roots[0].assets.length, 1);
    result = await service.deleteCategory({ categoryId: sad.id });
    const emptyMarkup = renderToStaticMarkup(React.createElement(ExpressionCategoryPanel, {
      ...callbacks, state: result.state, category: result.state.categories[0], name: '', description: '', managed: true, loading: false,
    }));
    assert.equal(emptyMarkup.includes('未分类'), false);
    assert.ok(emptyMarkup.includes('增加'), '删除最后一个分类后仍能新增分类');
    result = await service.getState({ rescan: true });
    assert.equal(result.state.assets[0].id, assetId);
    assert.equal(result.state.assets[0].classificationStatus, 'needs-review');
    await service.removeAssets({ assetIds: [assetId] });
    assert.equal((await service.getState({ rescan: true })).state.assets.length, 0);
    console.log('expression deleted category queue smoke: ok');
  } finally {
    assert.equal(path.dirname(sandbox), path.resolve(os.tmpdir()));
    assert.ok(path.basename(sandbox).startsWith('expression-deleted-category-'));
    await fs.rm(sandbox, { recursive: true, force: true });
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
