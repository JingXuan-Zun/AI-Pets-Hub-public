const fs = require('fs');
const path = require('path');
const { ensureDirectory, resolveWithinRoot } = require('./expressionLibraryFiles.cjs');
const LEGACY_ANGRY_DESCRIPTION = '生气、不满、恼火或强烈反对。';

function shouldMigrateLegacyManagedRoot(rawIndex, legacyManagedRootPath, managedRootPath) {
  if (!rawIndex || path.resolve(legacyManagedRootPath) === path.resolve(managedRootPath)) return false;
  const libraries = [rawIndex.library, ...(Array.isArray(rawIndex.librarySnapshots) ? rawIndex.librarySnapshots.map((snapshot) => snapshot?.library) : [])];
  return libraries.some((library) => (
    library?.mode === 'managed'
    && path.resolve(String(library.rootPath || legacyManagedRootPath)) === path.resolve(legacyManagedRootPath)
  ));
}

async function removeEmptyLegacyAngryDefaults(index, managedRootPath) {
  const libraries = [index, ...(Array.isArray(index.librarySnapshots) ? index.librarySnapshots : [])];
  for (const libraryIndex of libraries) {
    if (libraryIndex.library?.mode !== 'managed') continue;
    const legacyCategoryIds = new Set((Array.isArray(libraryIndex.categories) ? libraryIndex.categories : [])
      .filter((category) => (
        category.name === '愤怒'
        && category.folderRelativePath === '愤怒'
        && category.description === LEGACY_ANGRY_DESCRIPTION
        && !(Array.isArray(libraryIndex.assets) ? libraryIndex.assets : []).some((asset) => asset.categoryId === category.id)
      ))
      .map((category) => category.id));
    if (!legacyCategoryIds.size) continue;
    libraryIndex.categories = libraryIndex.categories.filter((category) => !legacyCategoryIds.has(category.id));
    await fs.promises.rm(resolveWithinRoot(managedRootPath, '愤怒'), { force: true, recursive: true });
  }
}

async function copyMissingDirectoryContents(sourcePath, targetPath) {
  let entries;
  try {
    entries = await fs.promises.readdir(sourcePath, { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  await ensureDirectory(targetPath);
  for (const entry of entries) {
    const sourceEntryPath = path.join(sourcePath, entry.name);
    const targetEntryPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      await copyMissingDirectoryContents(sourceEntryPath, targetEntryPath);
    } else if (entry.isFile()) {
      try {
        await fs.promises.copyFile(sourceEntryPath, targetEntryPath, fs.constants.COPYFILE_EXCL);
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
      }
    }
  }
}

module.exports = { shouldMigrateLegacyManagedRoot, removeEmptyLegacyAngryDefaults, copyMissingDirectoryContents };
