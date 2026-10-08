const fs = require('fs');
const path = require('path');
const { normalizeRelativePath, resolveSafeLibraryPath, mimeTypeForFileName } = require('./expressionLibraryFiles.cjs');
const { createId } = require('./expressionLibraryIndex.cjs');

async function scanImageAsset(index, image, categories, categoriesByPath, assetsByPath, rootPath) {
  const relativePath = normalizeRelativePath(path.join(image.folderRelativePath, image.fileName));
  const previous = assetsByPath.get(relativePath);
  const physicalCategory = categoriesByPath.get(image.folderRelativePath) ?? categories[0];
  const category = index.library.mode === 'external' && previous?.categoryOverrideId
    ? categories.find((item) => item.id === previous.categoryOverrideId) ?? physicalCategory
    : physicalCategory;
  let fileSignature;
  let available = true;
  try {
    const filePath = await resolveSafeLibraryPath(rootPath, relativePath);
    const stats = await fs.promises.stat(filePath);
    fileSignature = `${stats.size}:${stats.mtimeMs}`;
  } catch { available = false; }
  const changed = Boolean(previous?.fileSignature && previous.fileSignature !== fileSignature);
  return {
    ...(previous ?? {
      assignmentSemanticVersion: category.semanticVersion,
      classificationStatus: 'needs-review',
      id: createId('sticker'),
    }),
    ...(changed ? { classificationStatus: previous.removedFromLibrary ? 'excluded' : 'needs-review', reviewedAt: null } : {}),
    available,
    categoryId: category.id,
    fileName: image.fileName,
    mimeType: mimeTypeForFileName(image.fileName),
    relativePath,
    fileSignature,
  };
}

async function scanImageAssets(index, scanned, categories, rootPath) {
  const categoriesByPath = new Map(categories.map((category) => [category.folderRelativePath, category]));
  const assetsByPath = new Map(index.assets.map((asset) => [asset.relativePath, asset]));
  return Promise.all(scanned.images.map((image) => scanImageAsset(index, image, categories, categoriesByPath, assetsByPath, rootPath)));
}

module.exports = { scanImageAssets };
