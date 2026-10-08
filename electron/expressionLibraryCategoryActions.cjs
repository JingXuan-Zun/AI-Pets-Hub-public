const { UNCLASSIFIED_ID, createCategory } = require('./expressionLibraryIndex.cjs');
const { categoryNameIssue, normalizeDescription, findCategory, assertManaged, validateNewCategoryName } = require('./expressionLibraryCategoryRules.cjs');
const { renameCategoryDirectory, applyCategorySemantics } = require('./expressionLibraryCategoryUpdate.cjs');
const { deleteCategoryFiles } = require('./expressionLibraryCategoryFiles.cjs');
const { ensureDirectory, resolveWithinRoot, sanitizeFolderName } = require('./expressionLibraryFiles.cjs');

function createExpressionLibraryCategoryActions({ loadIndex, saveIndex, getStateFromIndex, customImportFolderName: CUSTOM_IMPORT_FOLDER_NAME }) {
  async function createCategoryEntry(request) {
      const index = await loadIndex();
      assertManaged(index);
      const name = validateNewCategoryName(index, request?.name, CUSTOM_IMPORT_FOLDER_NAME);
      await ensureDirectory(resolveWithinRoot(index.library.rootPath, name));
      const category = { ...createCategory(name, name), description: normalizeDescription(request?.description), reviewRequired: false };
      return getStateFromIndex(await saveIndex({ ...index, categories: [...index.categories, category] }));
    }

  async function updateCategory(request) {
      const index = await loadIndex();
      const category = findCategory(index, request?.categoryId);
      if (category.id === UNCLASSIFIED_ID) throw new Error('“未分类”不能重命名。');
      const requestedName = index.library.mode === 'managed' ? sanitizeFolderName(request?.name ?? category.name) : String(request?.name ?? category.name);
      if (index.library.mode === 'external' && requestedName !== category.name) {
        throw new Error('外部目录引用模式不能重命名原文件夹。');
      }
      const name = index.library.mode === 'managed' ? requestedName : category.name;
      const description = normalizeDescription(request?.description ?? category.description);
      const nameChanged = name !== category.name;
      const descriptionChanged = description !== category.description;
      const semanticsChanged = nameChanged || descriptionChanged || Boolean(category.nameIssue);
      if ((nameChanged || category.nameIssue) && index.library.mode === 'managed') {
        await renameCategoryDirectory(index, category, name, CUSTOM_IMPORT_FOLDER_NAME);
      }
      applyCategorySemantics(index, category, name, description, semanticsChanged, categoryNameIssue);
      return getStateFromIndex(await saveIndex(index));
    }

  async function deleteCategory(request) {
      const index = await loadIndex();
      assertManaged(index);
      const category = findCategory(index, request?.categoryId);
      await deleteCategoryFiles(index, category);
      return getStateFromIndex(await saveIndex(index));
    }

  return { createCategoryEntry, updateCategory, deleteCategory };
}

module.exports = { createExpressionLibraryCategoryActions };
