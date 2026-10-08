const path = require('path');
const { normalizeRelativePath } = require('./expressionLibraryFiles.cjs');
const { UNCLASSIFIED_ID, createCategory } = require('./expressionLibraryIndex.cjs');

function mergeScannedCategories(index, scanned) {
  const categoriesByFolder = new Map(index.categories.map((category) => [category.folderRelativePath, category]));
  const categories = [{ ...(categoriesByFolder.get('') ?? createCategory('', '未分类')), id: UNCLASSIFIED_ID, available: true }];
  for (const folderName of scanned.folders) {
    const folderRelativePath = normalizeRelativePath(folderName);
    const categoryDisplayName = path.basename(folderRelativePath);
    categories.push({
      ...(categoriesByFolder.get(folderRelativePath) ?? createCategory(folderRelativePath, categoryDisplayName)),
      available: true,
    });
  }
  for (const category of index.categories) {
    if (category.id !== UNCLASSIFIED_ID && !categories.some((item) => item.id === category.id)) {
      categories.push({ ...category, available: false });
    }
  }
  return categories;
}

function completeScannedIndex(index, assets, categories, categoryNameIssue) {
  for (const asset of index.assets) {
    if (!assets.some((item) => item.id === asset.id)) assets.push({ ...asset, available: false });
  }
  for (const category of categories) {
    category.nameIssue = categoryNameIssue(category);
    category.reviewRequired = assets.some((asset) => (
      asset.available && !asset.removedFromLibrary && asset.categoryId === category.id && asset.classificationStatus !== 'accepted'
    ));
  }
  return { ...index, assets, categories };
}

module.exports = { mergeScannedCategories, completeScannedIndex };
