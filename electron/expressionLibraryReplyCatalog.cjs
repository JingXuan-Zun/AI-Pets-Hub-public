const { UNCLASSIFIED_ID } = require('./expressionLibraryIndex.cjs');

function getAcceptedReplyAssets(index) {
  return index.assets.filter((asset) => {
    if (!asset.available || asset.removedFromLibrary || asset.categoryId === UNCLASSIFIED_ID || asset.classificationStatus !== 'accepted') return false;
    const category = index.categories.find((item) => item.id === asset.categoryId);
    return Boolean(category?.available && !category.nameIssue && asset.assignmentSemanticVersion === category.semanticVersion);
  });
}

function buildReplyCatalog(index) {
  const acceptedAssets = getAcceptedReplyAssets(index);
  return {
    catalog: {
      roots: [{
        categories: index.categories.filter((category) => category.available).map((category) => ({
          description: category.description,
          id: category.id,
          name: category.name,
          semanticVersion: category.semanticVersion,
        })),
        enabledForReply: true,
        id: index.library.mode === 'managed' ? 'root-main' : 'root-external-current',
        name: index.library.mode === 'managed' ? '我的表情包' : '外部目录库',
        replyPriority: 0,
        sourceType: index.library.mode,
        assets: acceptedAssets.map((asset) => ({
          assetId: asset.id,
          categoryId: asset.categoryId,
          mimeType: asset.mimeType,
        })),
      }],
    },
    ok: true,
  };
}

module.exports = { buildReplyCatalog };
