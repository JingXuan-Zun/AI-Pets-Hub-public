const { shouldMigrateLegacyManagedRoot, removeEmptyLegacyAngryDefaults, copyMissingDirectoryContents } = require('./expressionLibraryMigration.cjs');
const { scanImageAssets } = require('./expressionLibraryAssetScan.cjs');
const { mergeScannedCategories, completeScannedIndex } = require('./expressionLibraryScanRules.cjs');
const { INDEX_VERSION, UNCLASSIFIED_ID, nowIso, normalizeIndex } = require('./expressionLibraryIndex.cjs');
const { categoryNameIssue } = require('./expressionLibraryCategoryRules.cjs');
const { readJsonFile, writeJsonAtomic, ensureDirectory, resolveSafeLibraryPath, scanLibraryRoot } = require('./expressionLibraryFiles.cjs');

function createExpressionLibraryRepository({ indexPath, legacyManagedRootPath, managedRootPath, customImportFolderName: CUSTOM_IMPORT_FOLDER_NAME, ensureLibraryRoot }) {
  async function loadIndex() {
      const rawIndex = await readJsonFile(indexPath, null);
      if (shouldMigrateLegacyManagedRoot(rawIndex, legacyManagedRootPath, managedRootPath)) {
        await copyMissingDirectoryContents(legacyManagedRootPath, managedRootPath);
      }
      const index = normalizeIndex(rawIndex, managedRootPath);
      for (const library of [index, ...index.librarySnapshots]) {
        library.categories = library.categories.map((category) => ({ ...category, nameIssue: categoryNameIssue(category) }));
      }
      if (Number(rawIndex?.version ?? 0) < INDEX_VERSION) {
        await removeEmptyLegacyAngryDefaults(index, managedRootPath);
      }
      return index;
    }

  async function saveIndex(index) {
      const nextIndex = { ...index, updatedAt: nowIso(), version: INDEX_VERSION };
      await writeJsonAtomic(indexPath, nextIndex);
      return nextIndex;
    }

  async function scanIndex(index) {
      const { rootPath } = index.library;
      await ensureLibraryRoot(index.library);
      if (index.library.mode === 'managed') {
        for (const category of index.categories.filter((item) => item.id !== UNCLASSIFIED_ID && !item.nameIssue)) {
          await ensureDirectory(await resolveSafeLibraryPath(rootPath, category.folderRelativePath, { allowMissing: true }));
        }
        index.managedDefaultsInitialized = true;
      }
      const scanned = await scanLibraryRoot(rootPath, {
        nestedCategoryContainerName: index.library.mode === 'managed' ? CUSTOM_IMPORT_FOLDER_NAME : '',
      });
      const categories = mergeScannedCategories(index, scanned);
      const assets = await scanImageAssets(index, scanned, categories, rootPath);
      return completeScannedIndex(index, assets, categories, categoryNameIssue);
    }

  return { loadIndex, saveIndex, scanIndex };
}

module.exports = { createExpressionLibraryRepository };
