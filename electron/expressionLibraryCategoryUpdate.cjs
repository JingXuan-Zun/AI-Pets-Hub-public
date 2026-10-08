const fs = require('fs');
const path = require('path');
const { sanitizeFolderName, normalizeRelativePath, resolveSafeLibraryPath, ensureDirectory } = require('./expressionLibraryFiles.cjs');

async function renameCategoryDirectory(index, category, name, customImportFolderName) {
  if (name === customImportFolderName || index.categories.some((item) => item.id !== category.id && item.name.toLowerCase() === name.toLowerCase())) throw new Error('已存在同名分类，请更换名称。');
  const nextFolderName = sanitizeFolderName(name);
  const currentParent = path.dirname(category.folderRelativePath);
  const nextFolder = normalizeRelativePath(path.join(currentParent === customImportFolderName ? currentParent : '', nextFolderName));
  const destinationPath = await resolveSafeLibraryPath(index.library.rootPath, nextFolder, { allowMissing: true });
  let sourcePath;
  try {
    sourcePath = await resolveSafeLibraryPath(index.library.rootPath, category.folderRelativePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('历史分类路径异常，为保护原文件，请先在资源管理器中修复目录，再重新扫描。');
  }
  if (sourcePath && sourcePath !== destinationPath) {
    if (path.relative(sourcePath, destinationPath) !== '') {
      try { await fs.promises.lstat(destinationPath); throw new Error('目标文件夹已存在，不能覆盖。'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    await fs.promises.rename(sourcePath, destinationPath);
  } else if (!sourcePath) await ensureDirectory(destinationPath);
  category.folderRelativePath = nextFolder;
  for (const asset of index.assets.filter((item) => item.categoryId === category.id)) {
    asset.relativePath = normalizeRelativePath(path.join(nextFolder, asset.fileName));
  }
}

function applyCategorySemantics(index, category, name, description, semanticsChanged, categoryNameIssue) {
  if (semanticsChanged) category.semanticVersion += 1;
  category.name = name;
  category.nameIssue = categoryNameIssue(category);
  if (index.library.mode === 'managed') category.available = true;
  category.description = description;
  category.reviewRequired = semanticsChanged && index.assets.some((asset) => asset.categoryId === category.id && asset.available);
  for (const asset of index.assets.filter((item) => item.categoryId === category.id && item.available)) {
    if (semanticsChanged && !asset.removedFromLibrary) {
      asset.classificationStatus = 'needs-review';
      asset.reviewedAt = null;
    }
  }
}

module.exports = { renameCategoryDirectory, applyCategorySemantics };
