const { createExpressionLibraryCategoryActions } = require('./expressionLibraryCategoryActions.cjs');
const { createExpressionLibraryImportActions } = require('./expressionLibraryImportActions.cjs');
const { createExpressionLibrarySwitchActions } = require('./expressionLibrarySwitchActions.cjs');
const { createExpressionLibraryQueryActions } = require('./expressionLibraryQueryActions.cjs');
const { createExpressionLibraryBatchActions } = require('./expressionLibraryBatchActions.cjs');
const { createExpressionLibraryRepository } = require('./expressionLibraryRepository.cjs');
const { publicState } = require('./expressionLibraryIndex.cjs');
const fs = require('fs');
const path = require('path');
const { ensureDirectory } = require('./expressionLibraryFiles.cjs');

const CUSTOM_IMPORT_FOLDER_NAME = '自定义分类';

function createExpressionLibraryService({ managedRootPath: configuredManagedRootPath, userDataPath }) {
  const legacyManagedRootPath = path.join(userDataPath, 'stickers');
  const managedRootPath = path.resolve(configuredManagedRootPath || legacyManagedRootPath);
  const indexPath = path.join(userDataPath, 'expression-library.json');
  const { loadIndex, saveIndex, scanIndex } = createExpressionLibraryRepository({
    indexPath, legacyManagedRootPath, managedRootPath, customImportFolderName: CUSTOM_IMPORT_FOLDER_NAME, ensureLibraryRoot,
  });

  function getStateFromIndex(index) {
    return { ok: true, state: publicState(index) };
  }

  const { setAssetStatus, moveAssets, removeAssets, undoBatchOperation } = createExpressionLibraryBatchActions({ loadIndex, saveIndex, getStateFromIndex });

  const { getState, getReplyCatalog, resolveCategoryDirectory, getPreview } = createExpressionLibraryQueryActions({ loadIndex, saveIndex, scanIndex });

  const { setLibrary, selectLibraryMode } = createExpressionLibrarySwitchActions({ loadIndex, saveIndex, scanIndex, managedRootPath, ensureLibraryRoot, getStateFromIndex });

  const { createCategoryEntry, updateCategory, deleteCategory } = createExpressionLibraryCategoryActions({ loadIndex, saveIndex, getStateFromIndex, customImportFolderName: CUSTOM_IMPORT_FOLDER_NAME });
  const { importImages, importClassifiedRoot } = createExpressionLibraryImportActions({ loadIndex, saveIndex, scanIndex, getStateFromIndex, customImportFolderName: CUSTOM_IMPORT_FOLDER_NAME });

  const api = {
    createCategory: createCategoryEntry, deleteCategory, getPreview, getReplyCatalog, getState, importClassifiedRoot,
    importImages, moveAssets, removeAssets, resolveCategoryDirectory, selectLibraryMode, setAssetStatus, setLibrary,
    updateCategory, undoBatchOperation,
  };
  // IPC scans and user operations share one index file. Serialize them so a
  // background reply scan cannot overwrite a completed review or removal.
  let queue = Promise.resolve();
  return Object.fromEntries(Object.entries(api).map(([name, action]) => [name, (...args) => {
    const task = queue.then(() => action(...args));
    queue = task.catch(() => {});
    return task;
  }]));
}

async function ensureLibraryRoot(library) {
  if (library.mode === 'managed') {
    await ensureDirectory(library.rootPath);
    return;
  }
  const stats = await fs.promises.stat(library.rootPath);
  if (!stats.isDirectory()) throw new Error('选择的外部表情包路径不是文件夹。');
}


module.exports = { createExpressionLibraryService };
