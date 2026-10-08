const { UNCLASSIFIED_ID } = require('./expressionLibraryIndex.cjs');
const { findCategory, assertManaged } = require('./expressionLibraryCategoryRules.cjs');
const { importCategoryImages } = require('./expressionLibraryCategoryFiles.cjs');
const { importClassifiedLibrary } = require('./expressionLibraryImport.cjs');

function createExpressionLibraryImportActions({ loadIndex, saveIndex, scanIndex, getStateFromIndex, customImportFolderName: CUSTOM_IMPORT_FOLDER_NAME }) {
  async function importImages(request) {
      const index = await loadIndex();
      assertManaged(index);
      const category = findCategory(index, request?.categoryId ?? UNCLASSIFIED_ID);
      await importCategoryImages(index, category, request);
      return getStateFromIndex(await saveIndex(await scanIndex(index)));
    }

  async function importClassifiedRoot(request) {
      const index = await loadIndex();
      await importClassifiedLibrary(index, request?.sourceRootPath, { customImportFolderName: CUSTOM_IMPORT_FOLDER_NAME });
      return getStateFromIndex(await saveIndex(await scanIndex(index)));
    }

  return { importImages, importClassifiedRoot };
}

module.exports = { createExpressionLibraryImportActions };
