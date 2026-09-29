const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createExpressionLibraryService } = require('../electron/expressionLibraryService.cjs');
const { registerExpressionLibraryIpcHandlers } = require('../electron/expressionLibraryIpcHandlers.cjs');

async function run() {
  const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), 'expression-unclassified-import-'));
  try {
    const managedRootPath = path.join(sandbox, 'managed');
    const sourceRootPath = path.join(sandbox, '未分类');
    await fs.mkdir(sourceRootPath);
    await fs.writeFile(path.join(sourceRootPath, 'sample.png'), Buffer.from([137, 80, 78, 71]));
    const service = createExpressionLibraryService({ managedRootPath, userDataPath: path.join(sandbox, 'data') });
    await service.getState({ rescan: true });
    const handlers = new Map();
    registerExpressionLibraryIpcHandlers({
      dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [sourceRootPath] }) },
      expressionLibraryService: service,
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler) },
      shell: { openPath: async () => '' },
    });
    let result = await handlers.get('desktop-pet:expression-library-import-classified-root')({}, {});
    const imported = result.state.categories.find((category) => category.name === '未分类' && category.id !== 'cat_unclassified');
    assert.ok(imported, '直接导入“未分类”文件夹必须创建可删除的普通分类，不能落入系统未分类');
    assert.equal(imported.folderRelativePath, '自定义分类/未分类');
    const asset = result.state.assets.find((image) => image.fileName === 'sample.png');
    assert.equal(asset.categoryId, imported.id);
    assert.equal(asset.classificationStatus, 'needs-review');
    assertDeleteButton(result.state, imported);
    result = await service.deleteCategory({ categoryId: imported.id });
    assert.equal(result.state.categories.some((category) => category.id === imported.id), false);
    await assert.rejects(fs.stat(path.join(managedRootPath, '自定义分类', '未分类')), { code: 'ENOENT' });
    await fs.stat(managedRootPath);
    await fs.stat(path.join(sourceRootPath, 'sample.png'));
    assert.equal(result.state.assets.find((image) => image.id === asset.id).classificationStatus, 'needs-review');
    await assert.rejects(() => service.deleteCategory({ categoryId: 'cat_unclassified' }), /不能删除/);
    result = await service.getState({ rescan: true });
    assert.equal(result.state.categories.some((category) => category.id === imported.id), false, '删除后扫描不能恢复原分类');

    // Selecting the parent directory must keep the same ordinary-category behavior.
    const parentRoot = path.join(sandbox, 'parent');
    await fs.mkdir(path.join(parentRoot, '未分类'), { recursive: true });
    await fs.copyFile(path.join(sourceRootPath, 'sample.png'), path.join(parentRoot, '未分类', 'nested.png'));
    result = await service.importClassifiedRoot({ sourceRootPath: parentRoot });
    const nested = result.state.categories.find((category) => category.folderRelativePath === '自定义分类/未分类');
    assert.ok(nested && nested.id !== 'cat_unclassified');
    assertDeleteButton(result.state, nested);
    await service.deleteCategory({ categoryId: nested.id });

    const emptyRoot = path.join(sandbox, '空分类');
    await fs.mkdir(emptyRoot);
    result = await service.importClassifiedRoot({ sourceRootPath: emptyRoot });
    const empty = result.state.categories.find((category) => category.name === '空分类');
    assert.equal(empty.folderRelativePath, '自定义分类/空分类');
    await service.deleteCategory({ categoryId: empty.id });
    console.log('expression unclassified import smoke: ok');
  } finally {
    assert.equal(path.dirname(sandbox), path.resolve(os.tmpdir()));
    assert.ok(path.basename(sandbox).startsWith('expression-unclassified-import-'));
    await fs.rm(sandbox, { recursive: true, force: true });
  }
}

function assertDeleteButton(state, category) {
  // Exercise the actual category panel against the imported service state.
  const Module = require('node:module');
  const entry = path.resolve(__dirname, '../src/components/settings/ExpressionCategoryPanel.tsx');
  const compiled = require('esbuild').buildSync({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', external: ['react', 'react/jsx-runtime'], write: false });
  const loaded = new Module(entry, module);
  loaded.filename = entry;
  loaded.paths = module.paths;
  loaded._compile(compiled.outputFiles[0].text, entry);
  const element = require('react').createElement(loaded.exports.ExpressionCategoryPanel, {
    state, category, name: category.name, description: category.description, managed: true, loading: false,
    onChange() {}, onCreate() {}, onDelete() {}, onDropImages() {}, onOpenFolder() {}, onSelect() {},
  });
  const html = require('react-dom/server').renderToStaticMarkup(element);
  assert.equal((html.match(/aria-label="删除分类 未分类"/gu) || []).length, 1, '导入的同名普通分类必须显示且只显示一个删除按钮');
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
