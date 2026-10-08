const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const { ensureDirectory, normalizeRelativePath, resolveAvailableFileName, resolveSafeLibraryPath, validateSourceImage } = require('./expressionLibraryFiles.cjs');

const UNDO_MS = 60_000;
const copy = (value) => JSON.parse(JSON.stringify(value));
const signature = (stats) => `${stats.size}:${stats.mtimeMs}`;
const errorText = (error) => error?.code === 'ENOENT' ? '原文件已失效，请重新扫描。' : error?.code === 'EPERM' || error?.code === 'EACCES' ? '文件被占用或没有访问权限。' : error.message || String(error);

async function assertReadable(index, asset) {
  if (!asset.available) throw new Error('原文件已失效，请重新扫描。');
  const filePath = await resolveSafeLibraryPath(index.library.rootPath, asset.relativePath);
  await validateSourceImage(filePath);
  return filePath;
}

function categoryFor(index, id) {
  const category = index.categories.find((item) => item.id === id);
  if (!category || !category.available || category.nameIssue) throw new Error('分类不可用，请先修复分类名称或重新扫描。');
  return category;
}

function summarize(operation) {
  return {
    id: operation.id, action: operation.action, at: operation.at,
    successCount: operation.entries.length, failureCount: operation.failures.length,
    succeededIds: operation.entries.map((entry) => entry.before.id), failures: operation.failures,
    targetCategoryName: operation.targetCategoryName, undoExpiresAt: operation.undoExpiresAt,
  };
}

function storeOperation(index, operation) {
  index.batchHistory = [...(index.batchHistory || []), operation].slice(-100);
  for (const category of index.categories) {
    category.reviewRequired = index.assets.some((asset) => asset.categoryId === category.id && !asset.removedFromLibrary
      && (asset.classificationStatus !== 'accepted' || asset.assignmentSemanticVersion !== category.semanticVersion));
  }
  return summarize(operation);
}

async function executeBatchAsset(index, id, action, target, operation) {
  const asset = index.assets.find((item) => item.id === id);
  try {
    if (!asset) throw new Error('图片记录不存在。');
    if (asset.removedFromLibrary) throw new Error('该图片已永久从应用图库移除。');
    const before = copy(asset);
    let fingerprint;
    if (action === 'remove') {
      if (index.library.mode === 'external') {
        Object.assign(asset, { classificationStatus: 'excluded', removedFromLibrary: true, removedAt: operation.at, lastOperationId: operation.id });
      } else {
        const filePath = await resolveSafeLibraryPath(index.library.rootPath, asset.relativePath, { allowMissing: true });
        try { await fs.unlink(filePath); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        index.assets = index.assets.filter((item) => item.id !== id);
      }
    } else {
      const sourcePath = await assertReadable(index, asset);
      fingerprint = signature(await fs.stat(sourcePath));
      if (action === 'move') {
        if (index.library.mode === 'managed' && asset.categoryId !== target.id) {
          const targetDirectory = await resolveSafeLibraryPath(index.library.rootPath, target.folderRelativePath, { allowMissing: true });
          await ensureDirectory(targetDirectory);
          const fileName = await resolveAvailableFileName(targetDirectory, asset.fileName);
          await fs.rename(sourcePath, path.join(targetDirectory, fileName));
          asset.fileName = fileName;
          asset.relativePath = normalizeRelativePath(path.join(target.folderRelativePath, fileName));
        }
        Object.assign(asset, {
          categoryId: target.id, assignmentSemanticVersion: target.semanticVersion, classificationStatus: 'needs-review',
          ...(index.library.mode === 'external' ? { categoryOverrideId: target.id } : {}),
        });
      } else {
        const category = categoryFor(index, asset.categoryId);
        if (action === 'accepted' && category.id === 'cat_unclassified') throw new Error('请先将图片移动到一个分类，再通过审核。');
        asset.classificationStatus = action;
        if (action === 'accepted') asset.assignmentSemanticVersion = category.semanticVersion;
      }
      asset.reviewedAt = action === 'accepted' ? operation.at : null;
      asset.fileSignature = fingerprint;
      asset.reviewedBy = action === 'accepted' ? operation.actor : null;
      asset.reviewSource = operation.source;
      asset.lastOperationId = operation.id;
    }
    operation.entries.push({ before, after: index.assets.find((item) => item.id === id) ? copy(asset) : null, fingerprint,
      beforeCategoryVersion: index.categories.find((item) => item.id === before.categoryId)?.semanticVersion,
      afterCategoryVersion: index.categories.find((item) => item.id === asset.categoryId)?.semanticVersion });
  } catch (error) {
    operation.failures.push({ assetId: id, fileName: asset?.fileName || id, reason: errorText(error) });
  }
}

async function executeBatch(index, request, action) {
  const ids = [...new Set(Array.isArray(request?.assetIds) ? request.assetIds : [])];
  if (ids.some((id) => String(id).startsWith('system-'))) throw new Error('系统 Emoji 与颜文字目录为只读，不能修改。');
  if (!ids.length || ids.length > 1000) throw new Error('请每次选择 1 至 1000 张图片。');
  if (!['accepted', 'needs-review', 'move', 'remove'].includes(action)) throw new Error('不支持的批量操作。');
  const target = action === 'move' ? categoryFor(index, request.targetCategoryId) : null;
  const operation = {
    id: crypto.randomUUID(), action, at: new Date().toISOString(),
    actor: 'local-user', source: 'settings-batch-review',
    targetCategoryId: target?.id, targetCategoryName: target?.name,
    entries: [], failures: [],
  };
  for (const id of ids) {
    await executeBatchAsset(index, id, action, target, operation);
  }
  if (action !== 'remove' && operation.entries.length) operation.undoExpiresAt = new Date(Date.now() + UNDO_MS).toISOString();
  return storeOperation(index, operation);
}

async function undoBatch(index, request) {
  const original = (index.batchHistory || []).find((operation) => operation.id === request?.operationId);
  if (!original || original.undone || !original.undoExpiresAt || Date.parse(original.undoExpiresAt) < Date.now()) throw new Error('撤销已过期或已执行，请手动重新审核或移动。');
  const operation = { id: crypto.randomUUID(), action: 'undo', at: new Date().toISOString(), actor: 'local-user', source: 'settings-batch-review', undoOf: original.id, entries: [], failures: [] };
  for (const entry of original.entries) {
    const asset = index.assets.find((item) => item.id === entry.before.id);
    try {
      if (!asset || asset.removedFromLibrary || asset.lastOperationId !== original.id) throw new Error('图片已发生后续操作，不能覆盖。');
      const beforeCategory = categoryFor(index, entry.before.categoryId);
      const afterCategory = categoryFor(index, asset.categoryId);
      if (beforeCategory.semanticVersion !== entry.beforeCategoryVersion || afterCategory.semanticVersion !== entry.afterCategoryVersion) throw new Error('分类语义已改变，不能恢复旧审核结果。');
      const sourcePath = await assertReadable(index, asset);
      if (signature(await fs.stat(sourcePath)) !== entry.fingerprint) throw new Error('原文件已改变，不能撤销旧操作。');
      if (entry.before.classificationStatus === 'accepted' && entry.before.fileSignature && entry.before.fileSignature !== entry.fingerprint) throw new Error('操作前图片已改变，不能恢复旧审核结果。');
      if (index.library.mode === 'managed' && asset.relativePath !== entry.before.relativePath) {
        const targetPath = await resolveSafeLibraryPath(index.library.rootPath, entry.before.relativePath, { allowMissing: true });
        try { await fs.lstat(targetPath); throw new Error('原位置已有同名文件，不能覆盖。'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        await fs.rename(sourcePath, targetPath);
      }
      const restored = { ...copy(entry.before), lastOperationId: operation.id };
      index.assets = index.assets.map((item) => item.id === asset.id ? restored : item);
      operation.entries.push({ before: copy(asset), after: copy(restored) });
    } catch (error) {
      operation.failures.push({ assetId: entry.before.id, fileName: entry.before.fileName, reason: errorText(error) });
    }
  }
  original.undone = true;
  return storeOperation(index, operation);
}

module.exports = { executeBatch, undoBatch };
