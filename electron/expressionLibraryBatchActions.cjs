const { executeBatch, undoBatch } = require('./expressionLibraryAssetMutations.cjs');

function createExpressionLibraryBatchActions({ loadIndex, saveIndex, getStateFromIndex }) {
  async function setAssetStatus(request) {
      if (!['accepted', 'needs-review'].includes(request?.status)) {
        if (request?.assetIds?.some((id) => String(id).startsWith('system-'))) throw new Error('系统 Emoji 与颜文字目录为只读，不能修改。');
        throw new Error('不支持的审核状态。');
      }
      const index = await loadIndex();
      const batch = await executeBatch(index, request, request?.status);
      return { ...getStateFromIndex(await saveIndex(index)), batch };
    }

  async function moveAssets(request) {
      const index = await loadIndex();
      const batch = await executeBatch(index, request, 'move');
      return { ...getStateFromIndex(await saveIndex(index)), batch };
    }

  async function removeAssets(request) {
      const index = await loadIndex();
      const batch = await executeBatch(index, request, 'remove');
      return { ...getStateFromIndex(await saveIndex(index)), batch };
    }

  async function undoBatchOperation(request) {
      const index = await loadIndex();
      const batch = await undoBatch(index, request);
      return { ...getStateFromIndex(await saveIndex(index)), batch };
    }

  return { setAssetStatus, moveAssets, removeAssets, undoBatchOperation };
}

module.exports = { createExpressionLibraryBatchActions };
