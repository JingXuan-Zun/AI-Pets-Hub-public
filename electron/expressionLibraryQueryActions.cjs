const fs = require('fs');
const { publicState } = require('./expressionLibraryIndex.cjs');
const { buildReplyCatalog } = require('./expressionLibraryReplyCatalog.cjs');
const { findCategory } = require('./expressionLibraryCategoryRules.cjs');
const { ensureDirectory, resolveSafeLibraryPath } = require('./expressionLibraryFiles.cjs');

function createExpressionLibraryQueryActions({ loadIndex, saveIndex, scanIndex }) {
  async function getState({ rescan = false } = {}) {
      let index = await loadIndex();
      if (rescan) index = await saveIndex(await scanIndex(index));
      return { ok: true, state: publicState(index) };
    }

  async function getReplyCatalog() {
      const index = await saveIndex(await scanIndex(await loadIndex()));
      return buildReplyCatalog(index);
    }

  async function resolveCategoryDirectory(request) {
      const index = await loadIndex();
      const category = findCategory(index, request?.categoryId);
      const directoryPath = await resolveSafeLibraryPath(index.library.rootPath, category.folderRelativePath, { allowMissing: index.library.mode === 'managed' && !category.nameIssue });
      if (index.library.mode === 'managed') {
        await ensureDirectory(directoryPath);
        return directoryPath;
      }
      if (!category.available) throw new Error('当前分类文件夹已失效。');
      return directoryPath;
    }

  async function getPreview(request) {
      const index = await loadIndex();
      const asset = index.assets.find((item) => item.id === request?.assetId);
      if (!asset || !asset.available || asset.removedFromLibrary) throw new Error('表情包图片不存在或已失效。');
      const filePath = await resolveSafeLibraryPath(index.library.rootPath, asset.relativePath);
      const stats = await fs.promises.stat(filePath);
      if (stats.size > 20 * 1024 * 1024) throw new Error('图片过大，无法预览。');
      const data = await fs.promises.readFile(filePath);
      return { dataUrl: `data:${asset.mimeType};base64,${data.toString('base64')}`, ok: true };
    }

  return { getState, getReplyCatalog, resolveCategoryDirectory, getPreview };
}

module.exports = { createExpressionLibraryQueryActions };
