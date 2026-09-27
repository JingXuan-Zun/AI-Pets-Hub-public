const assert = require('assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { registerExpressionLibraryIpcHandlers } = require('../electron/expressionLibraryIpcHandlers.cjs');
const { createExpressionLibraryService } = require('../electron/expressionLibraryService.cjs');

async function run() {
  const testRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expression-library-'));
  try {
    const userDataPath = path.join(testRoot, 'user-data');
    const managedRootPath = path.join(testRoot, 'application', '表情包');
    const sourcePath = path.join(testRoot, 'smile.png');
    await fs.promises.writeFile(sourcePath, Buffer.from([137, 80, 78, 71]));
    const service = createExpressionLibraryService({ managedRootPath, userDataPath });
    const ipcHandlers = new Map();
    let directoryDialogCalls = 0;
    registerExpressionLibraryIpcHandlers({
      dialog: { showOpenDialog: async () => { directoryDialogCalls += 1; return { canceled: true, filePaths: [] }; } },
      expressionLibraryService: service,
      ipcMain: { handle: (channel, handler) => ipcHandlers.set(channel, handler) },
      shell: { openPath: async () => '' },
      systemExpressionCatalogService: { getCatalog: async () => ({ catalog: {} }) },
    });
    const selectModeHandler = ipcHandlers.get('desktop-pet:expression-library-select-mode');
    assert.equal(typeof selectModeHandler, 'function');
    const selectWithoutImport = await selectModeHandler({}, { mode: 'external' });
    assert.equal(selectWithoutImport.ok, true);
    assert.equal(directoryDialogCalls, 0);
    await assert.rejects(
      () => service.setAssetStatus({ assetIds: ['system-emoji-happy'], status: 'excluded' }),
      /只读/,
    );

    let result = await service.getState({ rescan: true });
    const happy = result.state.categories.find((category) => category.name === '开心');
    const initialSad = result.state.categories.find((category) => category.name === '伤心');
    assert.ok(happy?.id);
    assert.ok(initialSad?.id);
    result = await service.selectLibraryMode({ mode: 'external' });
    assert.equal(result.modeAvailable, false);
    assert.equal(result.state.library.mode, 'managed');

    const initialSadPath = await service.resolveCategoryDirectory({ categoryId: initialSad.id });
    await fs.promises.rm(initialSadPath, { force: true, recursive: true });
    result = await service.getState({ rescan: true });
    assert.equal(fs.existsSync(initialSadPath), true);
    assert.equal(result.state.categories.find((category) => category.id === initialSad.id)?.available, true);

    result = await service.createCategory({ description: '', name: '待删除空分类' });
    const emptyCategory = result.state.categories.find((category) => category.name === '待删除空分类');
    const emptyCategoryPath = await service.resolveCategoryDirectory({ categoryId: emptyCategory.id });
    await fs.promises.writeFile(path.join(emptyCategoryPath, 'desktop.ini'), '[ViewState]\n');
    result = await service.deleteCategory({ categoryId: emptyCategory.id });
    assert.equal(result.state.categories.some((category) => category.id === emptyCategory.id), false);
    assert.equal(fs.existsSync(emptyCategoryPath), false);

    const sad = result.state.categories.find((category) => category.name === '伤心');
    const sadCategoryPath = await service.resolveCategoryDirectory({ categoryId: sad.id });
    result = await service.deleteCategory({ categoryId: sad.id });
    assert.equal(result.state.categories.some((category) => category.id === sad.id), false);
    assert.equal(fs.existsSync(sadCategoryPath), false);
    result = await service.getState({ rescan: true });
    assert.equal(result.state.categories.some((category) => category.id === sad.id), false);

    result = await service.importImages({ categoryId: happy.id, sourcePaths: [sourcePath] });
    let asset = result.state.assets.find((item) => item.categoryId === happy.id);
    assert.equal(asset.classificationStatus, 'needs-review');

    result = await service.setAssetStatus({ assetIds: [asset.id], status: 'accepted' });
    asset = result.state.assets.find((item) => item.id === asset.id);
    assert.equal(asset.assignmentSemanticVersion, 1);

    result = await service.updateCategory({ categoryId: happy.id, description: '生气、恼火', name: '生气' });
    asset = result.state.assets.find((item) => item.id === asset.id);
    assert.equal(asset.classificationStatus, 'needs-review');
    assert.equal(result.state.categories.find((item) => item.id === happy.id).semanticVersion, 2);

    const classifiedRoot = path.join(testRoot, 'classified');
    await fs.promises.mkdir(path.join(classifiedRoot, '惊讶'), { recursive: true });
    await fs.promises.copyFile(sourcePath, path.join(classifiedRoot, '惊讶', 'wow.png'));
    result = await service.importClassifiedRoot({ sourceRootPath: classifiedRoot });
    assert.equal(result.state.categories.some((category) => category.name === '惊讶'), true);
    assert.equal(fs.existsSync(path.join(managedRootPath, '自定义分类', '惊讶', 'wow.png')), true);
    assert.equal(result.state.categories.find((category) => category.name === '惊讶').folderRelativePath, '自定义分类/惊讶');
    assert.equal(result.state.library.rootPath, managedRootPath);

    const legacyUserDataPath = path.join(testRoot, 'legacy-user-data');
    const legacyService = createExpressionLibraryService({ userDataPath: legacyUserDataPath });
    let legacyResult = await legacyService.getState({ rescan: true });
    const legacyHappy = legacyResult.state.categories.find((category) => category.name === '开心');
    await legacyService.importImages({ categoryId: legacyHappy.id, sourcePaths: [sourcePath] });
    const migratedManagedRootPath = path.join(testRoot, 'migrated-application', '表情包');
    const migratedService = createExpressionLibraryService({ managedRootPath: migratedManagedRootPath, userDataPath: legacyUserDataPath });
    legacyResult = await migratedService.getState({ rescan: true });
    assert.equal(legacyResult.state.library.rootPath, migratedManagedRootPath);
    assert.equal(fs.existsSync(path.join(migratedManagedRootPath, '开心', 'smile.png')), true);

    const externalRoot = path.join(testRoot, 'external');
    const externalCategory = path.join(externalRoot, '疑惑');
    await fs.promises.mkdir(externalCategory, { recursive: true });
    await fs.promises.copyFile(sourcePath, path.join(externalCategory, 'question.png'));
    result = await service.setLibrary({ mode: 'external', rootPath: externalRoot });
    result = await service.selectLibraryMode({ mode: 'managed' });
    assert.equal(result.state.library.mode, 'managed');
    result = await service.selectLibraryMode({ mode: 'external' });
    assert.equal(result.modeAvailable, true);
    assert.equal(result.state.library.mode, 'external');
    assert.equal(result.state.library.rootPath, externalRoot);
    const externalAsset = result.state.assets.find((item) => item.fileName === 'question.png');
    const externalCategoryState = result.state.categories.find((item) => item.name === '疑惑');
    result = await service.updateCategory({
      categoryId: externalCategoryState.id,
      description: '不理解、需要说明或提出问题。',
      name: externalCategoryState.name,
    });
    assert.equal(result.state.categories.find((item) => item.id === externalCategoryState.id).description, '不理解、需要说明或提出问题。');
    result = await service.setAssetStatus({ assetIds: [externalAsset.id], status: 'accepted' });
    const replyCatalog = await service.getReplyCatalog();
    assert.equal(replyCatalog.catalog.roots[0].assets.some((item) => item.assetId === externalAsset.id), true);
    assert.equal(JSON.stringify(replyCatalog).includes(externalRoot), false);
    result = await service.moveAssets({ assetIds: [externalAsset.id], targetCategoryId: 'cat_unclassified' });
    assert.equal(result.batch.successCount, 1);
    result = await service.getState({ rescan: true });
    assert.equal(result.state.assets.find((item) => item.id === externalAsset.id).categoryId, 'cat_unclassified');
    assert.equal(fs.existsSync(path.join(externalCategory, 'question.png')), true);
    await service.removeAssets({ assetIds: [externalAsset.id] });
    assert.equal(fs.existsSync(path.join(externalCategory, 'question.png')), true);

    const legacyDefaultsUserDataPath = path.join(testRoot, 'legacy-defaults-user-data');
    const legacyDefaultsManagedRootPath = path.join(testRoot, 'legacy-defaults-application', '表情包');
    await fs.promises.mkdir(path.join(legacyDefaultsManagedRootPath, '愤怒'), { recursive: true });
    await fs.promises.mkdir(legacyDefaultsUserDataPath, { recursive: true });
    await fs.promises.writeFile(path.join(legacyDefaultsUserDataPath, 'expression-library.json'), JSON.stringify({
      assets: [],
      categories: [
        { available: true, description: '', folderRelativePath: '', id: 'cat_unclassified', name: '未分类', reviewRequired: false, semanticVersion: 1 },
        { available: true, description: '生气、不满、恼火或强烈反对。', folderRelativePath: '愤怒', id: 'cat_legacy_angry', name: '愤怒', reviewRequired: false, semanticVersion: 1 },
      ],
      library: { mode: 'managed', rootPath: legacyDefaultsManagedRootPath },
      librarySnapshots: [],
      managedDefaultsInitialized: true,
      version: 4,
    }), 'utf8');
    const legacyDefaultsService = createExpressionLibraryService({
      managedRootPath: legacyDefaultsManagedRootPath,
      userDataPath: legacyDefaultsUserDataPath,
    });
    const migratedDefaults = await legacyDefaultsService.getState({ rescan: true });
    assert.equal(migratedDefaults.state.categories.some((item) => item.name === '开心'), true);
    assert.equal(migratedDefaults.state.categories.some((item) => item.name === '伤心'), true);
    assert.equal(migratedDefaults.state.categories.some((item) => item.name === '愤怒'), false);
    assert.equal(fs.existsSync(path.join(legacyDefaultsManagedRootPath, '愤怒')), false);

    result = await service.setLibrary({ mode: 'managed' });
    assert.equal(result.state.categories.some((item) => item.id === happy.id), true);
    const renamedCategoryPath = await service.resolveCategoryDirectory({ categoryId: happy.id });
    assert.equal(path.basename(renamedCategoryPath), '生气');
    result = await service.deleteCategory({ categoryId: happy.id });
    const migratedAsset = result.state.assets.find((item) => item.id === asset.id);
    assert.equal(migratedAsset.categoryId, 'cat_unclassified');
    assert.equal(migratedAsset.classificationStatus, 'needs-review');
    assert.equal(result.state.categories.some((item) => item.id === happy.id), false);
    assert.equal(fs.existsSync(renamedCategoryPath), false);
    console.log('expression library smoke: ok');
  } finally {
    await fs.promises.rm(testRoot, { force: true, recursive: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
