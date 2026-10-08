const { sanitizeFolderName, normalizeRelativePath } = require('./expressionLibraryFiles.cjs');
const { UNCLASSIFIED_ID } = require('./expressionLibraryIndex.cjs');

function categoryNameIssue(category) {
  if (category.id === UNCLASSIFIED_ID) return undefined;
  try {
    sanitizeFolderName(category.name);
    const parts = normalizeRelativePath(category.folderRelativePath).split('/');
    if (parts.length > 2 || parts.some((part) => !part || part === '.' || part === '..')) throw new Error('分类路径异常。');
    parts.forEach(sanitizeFolderName);
    return undefined;
  } catch (error) { return error.message; }
}

function normalizeDescription(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, '').trim().slice(0, 240);
}

function findCategory(index, categoryId) {
  const category = index.categories.find((item) => item.id === categoryId);
  if (!category) throw new Error('表情包分类不存在。');
  return category;
}

function assertManaged(index) {
  if (index.library.mode !== 'managed') throw new Error('外部目录引用模式不会修改用户原文件。');
}

function validateNewCategoryName(index, value, customImportFolderName) {
  const name = sanitizeFolderName(value);
  if (name === customImportFolderName || index.categories.some((category) => category.name.toLowerCase() === name.toLowerCase() || category.folderRelativePath.toLowerCase() === name.toLowerCase())) {
    throw new Error('已存在同名分类。');
  }
  return name;
}

module.exports = { categoryNameIssue, normalizeDescription, findCategory, assertManaged, validateNewCategoryName };
