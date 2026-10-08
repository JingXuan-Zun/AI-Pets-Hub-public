const fs = require('fs');
const path = require('path');
const { resolveSafeLibraryPath, resolveAvailableFileName, ensureDirectory, validateSourceImage } = require('./expressionLibraryFiles.cjs');
const { UNCLASSIFIED_ID } = require('./expressionLibraryIndex.cjs');

async function deleteCategoryFiles(index, category) {
  if (category.id === UNCLASSIFIED_ID) throw new Error('“未分类”不能删除。');
  if (category.nameIssue || !category.folderRelativePath) throw new Error('请先修复历史分类名称和路径，再删除分类。');
  const rootPath = index.library.rootPath;
  const categoryDirectory = await resolveSafeLibraryPath(rootPath, category.folderRelativePath, { allowMissing: true });
  if (!path.relative(path.resolve(rootPath), categoryDirectory)) throw new Error('不能删除图库根目录。');
  for (const asset of index.assets.filter((item) => item.categoryId === category.id && item.available)) {
    const sourcePath = await resolveSafeLibraryPath(rootPath, asset.relativePath);
    const fileName = await resolveAvailableFileName(rootPath, asset.fileName);
    await fs.promises.rename(sourcePath, path.join(rootPath, fileName));
    Object.assign(asset, { categoryId: UNCLASSIFIED_ID, fileName, relativePath: fileName, classificationStatus: 'needs-review', reviewedAt: null, reviewedBy: null });
  }
  await fs.promises.rm(categoryDirectory, { force: true, recursive: true });
  index.categories = index.categories.filter((item) => item.id !== category.id);
  index.assets = index.assets.filter((item) => item.categoryId !== category.id || item.available);
}

async function importCategoryImages(index, category, request) {
  if (category.nameIssue) throw new Error('请先修复分类名称，再导入图片。');
  const targetDirectory = await resolveSafeLibraryPath(index.library.rootPath, category.folderRelativePath, { allowMissing: true });
  await ensureDirectory(targetDirectory);
  const sourcePaths = Array.isArray(request?.sourcePaths) ? request.sourcePaths : [];
  const sources = await Promise.all(sourcePaths.map((sourcePath) => validateSourceImage(sourcePath)));
  for (const source of sources) {
    const fileName = await resolveAvailableFileName(targetDirectory, path.basename(source.resolvedPath));
    await fs.promises.copyFile(source.resolvedPath, path.join(targetDirectory, fileName));
  }
}

module.exports = { deleteCategoryFiles, importCategoryImages };
