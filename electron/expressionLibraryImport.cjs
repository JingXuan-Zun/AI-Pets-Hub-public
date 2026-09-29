const fs = require('fs');
const path = require('path');
const {
  ensureDirectory,
  resolveAvailableFileName,
  resolveWithinRoot,
  sanitizeFolderName,
  scanLibraryRoot,
  validateSourceImage,
} = require('./expressionLibraryFiles.cjs');

async function assertSourceDirectory(sourceRootPath, managedRootPath) {
  const sourceRoot = path.resolve(String(sourceRootPath ?? ''));
  if (!String(sourceRootPath ?? '').trim()) throw new Error('请选择已分类的表情包根目录。');
  if (sourceRoot === path.resolve(managedRootPath)) throw new Error('不能从应用托管库自身重复导入。');
  const stats = await fs.promises.stat(sourceRoot);
  if (!stats.isDirectory()) throw new Error('选择的表情包路径不是文件夹。');
  return sourceRoot;
}

async function copySourceImage(sourceRoot, managedRoot, image, customImportFolderName, rootImageCategoryName) {
  const sourcePath = resolveWithinRoot(sourceRoot, path.join(image.folderRelativePath, image.fileName));
  const targetFolder = path.join(customImportFolderName, image.folderRelativePath
    ? sanitizeFolderName(image.folderRelativePath)
    : rootImageCategoryName);
  const targetDirectory = resolveWithinRoot(managedRoot, targetFolder);
  await ensureDirectory(targetDirectory);
  const source = await validateSourceImage(sourcePath);
  const fileName = await resolveAvailableFileName(targetDirectory, image.fileName);
  await fs.promises.copyFile(source.resolvedPath, path.join(targetDirectory, fileName));
}

async function importClassifiedLibrary(index, sourceRootPath, { customImportFolderName = '自定义分类' } = {}) {
  if (index.library.mode !== 'managed') throw new Error('只有应用托管库可以复制外部表情包。');
  const sourceRoot = await assertSourceDirectory(sourceRootPath, index.library.rootPath);
  const scanned = await scanLibraryRoot(sourceRoot);
  // The picker accepts a single category as well as a root containing categories.
  // Preserve the selected directory's name for loose images; copying them into
  // the managed root would turn them into the protected system collection.
  const needsRootCategory = scanned.images.some((image) => !image.folderRelativePath) || scanned.folders.length === 0;
  const rootImageCategoryName = needsRootCategory ? sanitizeFolderName(path.basename(sourceRoot)) : '';
  const categoryNames = new Set(scanned.folders.map(sanitizeFolderName));
  if (needsRootCategory) categoryNames.add(rootImageCategoryName);
  await ensureDirectory(resolveWithinRoot(index.library.rootPath, customImportFolderName));
  for (const categoryName of categoryNames) {
    const targetFolder = path.join(customImportFolderName, categoryName);
    await ensureDirectory(resolveWithinRoot(index.library.rootPath, targetFolder));
  }
  for (const image of scanned.images) {
    await copySourceImage(sourceRoot, index.library.rootPath, image, customImportFolderName, rootImageCategoryName);
  }
  return index;
}

module.exports = { importClassifiedLibrary };
