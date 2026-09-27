const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createExpressionLibraryService } = require('../electron/expressionLibraryService.cjs');

async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'expression-batch-review-'));
  try {
    const source = path.join(root, 'sample.png');
    await fs.writeFile(source, Buffer.from([137, 80, 78, 71]));
    const service = createExpressionLibraryService({ managedRootPath: path.join(root, 'managed'), userDataPath: path.join(root, 'data') });
    let result = await service.getState({ rescan: true });
    const happy = result.state.categories.find((item) => item.name === '开心');
    const sad = result.state.categories.find((item) => item.name === '伤心');
    result = await service.importImages({ categoryId: happy.id, sourcePaths: [source] });
    const asset = result.state.assets[0];
    assert.equal(asset.classificationStatus, 'needs-review');
    await Promise.all([
      service.setAssetStatus({ assetIds: [asset.id], status: 'accepted' }),
      service.getState({ rescan: true }),
    ]);
    assert.equal((await service.getState()).state.assets[0].classificationStatus, 'accepted', '并行扫描不覆盖审核结果');
    result = await service.setAssetStatus({ assetIds: [asset.id, 'missing-record'], status: 'accepted' });
    assert.equal(result.batch.successCount, 1);
    assert.equal(result.batch.failureCount, 1);
    assert.match(result.batch.failures[0].reason, /不存在/);
    assert.ok(result.state.assets[0].reviewedAt);
    assert.equal((await service.getReplyCatalog()).catalog.roots[0].assets.length, 1);
    result = await service.setAssetStatus({ assetIds: [asset.id], status: 'needs-review' });
    assert.equal((await service.getReplyCatalog()).catalog.roots[0].assets.length, 0);
    await service.undoBatchOperation({ operationId: result.batch.id });
    assert.equal((await service.getReplyCatalog()).catalog.roots[0].assets.length, 1);
    result = await service.moveAssets({ assetIds: [asset.id], targetCategoryId: sad.id });
    assert.equal(result.state.assets[0].classificationStatus, 'needs-review', '移动到有详解的分类也不得自动通过审核');
    assert.equal((await service.getReplyCatalog()).catalog.roots[0].assets.length, 0);
    const movedPath = path.join(root, 'managed', result.state.assets[0].relativePath);
    await fs.stat(movedPath);
    await assert.rejects(fs.stat(path.join(root, 'managed', asset.relativePath)));
    await service.undoBatchOperation({ operationId: result.batch.id });
    await fs.stat(path.join(root, 'managed', asset.relativePath));
    assert.equal((await service.getReplyCatalog()).catalog.roots[0].assets.length, 1);

    result = await service.moveAssets({ assetIds: [asset.id], targetCategoryId: sad.id });
    const collisionPath = path.join(root, 'managed', asset.relativePath);
    await fs.copyFile(source, collisionPath);
    const blockedUndo = await service.undoBatchOperation({ operationId: result.batch.id });
    assert.equal(blockedUndo.batch.failureCount, 1);
    assert.match(blockedUndo.batch.failures[0].reason, /同名/);
    assert.deepEqual(await fs.readFile(collisionPath), await fs.readFile(source));
    await fs.unlink(collisionPath);
    await service.moveAssets({ assetIds: [asset.id], targetCategoryId: happy.id });

    result = await service.setAssetStatus({ assetIds: [asset.id], status: 'needs-review' });
    await service.updateCategory({ categoryId: happy.id, name: happy.name, description: '新的开心含义' });
    result = await service.undoBatchOperation({ operationId: result.batch.id });
    assert.equal(result.batch.failureCount, 1);
    assert.match(result.batch.failures[0].reason, /语义已改变/);
    assert.equal((await service.getReplyCatalog()).catalog.roots[0].assets.length, 0);
    result = await service.setAssetStatus({ assetIds: [asset.id], status: 'accepted' });
    const olderOperation = result.batch.id;
    await service.setAssetStatus({ assetIds: [asset.id], status: 'needs-review' });
    result = await service.undoBatchOperation({ operationId: olderOperation });
    assert.equal(result.batch.failureCount, 1);
    assert.match(result.batch.failures[0].reason, /后续操作/);

    await service.setAssetStatus({ assetIds: [asset.id], status: 'accepted' });
    await fs.appendFile(path.join(root, 'managed', asset.relativePath), 'changed');
    assert.equal((await service.getReplyCatalog()).catalog.roots[0].assets.length, 0, '替换同路径图片需要重新审核');
    await fs.unlink(path.join(root, 'managed', asset.relativePath));
    result = await service.setAssetStatus({ assetIds: [asset.id], status: 'accepted' });
    assert.equal(result.batch.failureCount, 1);
    result = await service.removeAssets({ assetIds: [asset.id] });
    assert.equal(result.batch.successCount, 1, '允许清理已经丢失文件的索引');

    for (const name of ['CON', 'aux.png', 'COM1', 'bad.', ' x', 'a/b', 'a\nb', 'x'.repeat(65)]) {
      await assert.rejects(() => service.createCategory({ name }));
    }
    await service.createCategory({ name: 'Hello' });
    await assert.rejects(() => service.createCategory({ name: 'hello' }), /同名/);

    // 历史异常名称修复：保留分类 ID 和原图片，不自动删除文件夹。
    const indexPath = path.join(root, 'data', 'expression-library.json');
    let raw = JSON.parse(await fs.readFile(indexPath, 'utf8'));
    raw.categories.find((category) => category.id === happy.id).name = '旧名称\n含换行';
    await fs.writeFile(indexPath, JSON.stringify(raw));
    result = await service.getState();
    assert.ok(result.state.categories.find((category) => category.id === happy.id).nameIssue);
    result = await service.updateCategory({ categoryId: happy.id, name: '修复开心' });
    assert.equal(result.state.categories.find((category) => category.id === happy.id).nameIssue, undefined);
    await fs.stat(path.join(root, 'managed', '修复开心'));

    const externalRoot = path.join(root, 'external');
    await fs.mkdir(path.join(externalRoot, 'A'), { recursive: true });
    await fs.mkdir(path.join(externalRoot, 'B'));
    const externalFile = path.join(externalRoot, 'A', 'sample.png');
    await fs.copyFile(source, externalFile);
    const originalStats = await fs.stat(externalFile);
    result = await service.setLibrary({ mode: 'external', rootPath: externalRoot });
    const externalAsset = result.state.assets[0];
    const target = result.state.categories.find((category) => category.name === 'B');
    result = await service.moveAssets({ assetIds: [externalAsset.id], targetCategoryId: target.id });
    const externalMoveId = result.batch.id;
    result = await service.getState({ rescan: true });
    assert.equal(result.state.assets[0].categoryId, target.id);
    assert.equal(result.state.assets[0].relativePath, externalAsset.relativePath);
    assert.equal((await fs.readdir(path.join(externalRoot, 'B'))).length, 0);
    await service.undoBatchOperation({ operationId: externalMoveId });
    result = await service.getState({ rescan: true });
    assert.equal(result.state.assets[0].categoryId, externalAsset.categoryId);

    // 旧“排除”不自动转为 accepted，但可由用户明确审核。
    raw = JSON.parse(await fs.readFile(indexPath, 'utf8'));
    raw.assets[0].classificationStatus = 'excluded';
    await fs.writeFile(indexPath, JSON.stringify(raw));
    assert.equal((await service.getReplyCatalog()).catalog.roots[0].assets.length, 0);
    result = await service.getState();
    assert.equal(result.state.assets[0].classificationStatus, 'excluded');
    await service.setAssetStatus({ assetIds: [externalAsset.id], status: 'accepted' });
    assert.equal((await service.getReplyCatalog()).catalog.roots[0].assets.length, 1);
    result = await service.removeAssets({ assetIds: [externalAsset.id] });
    assert.equal(result.state.assets.length, 0);
    assert.equal(result.batch.undoExpiresAt, undefined);
    assert.equal((await fs.stat(externalFile)).mtimeMs, originalStats.mtimeMs);
    assert.deepEqual(await fs.readFile(externalFile), await fs.readFile(source));
    await service.selectLibraryMode({ mode: 'managed' });
    await service.selectLibraryMode({ mode: 'external' });
    const restarted = createExpressionLibraryService({ managedRootPath: path.join(root, 'managed'), userDataPath: path.join(root, 'data') });
    result = await restarted.getState({ rescan: true });
    assert.equal(result.state.assets.length, 0, '切库、重启、扫描都不应重新纳入已移除图片');
    result = await restarted.setAssetStatus({ assetIds: [externalAsset.id], status: 'accepted' });
    assert.equal(result.batch.failureCount, 1);
    assert.equal((await restarted.getReplyCatalog()).catalog.roots[0].assets.length, 0);
    raw = JSON.parse(await fs.readFile(indexPath, 'utf8'));
    const auditedMove = raw.batchHistory.find((operation) => operation.id === externalMoveId);
    assert.equal(auditedMove.actor, 'local-user');
    assert.equal(auditedMove.source, 'settings-batch-review');
    assert.equal(auditedMove.targetCategoryId, target.id);
    assert.ok(auditedMove.at);
    const expiredOperation = raw.batchHistory.find((operation) => operation.undoExpiresAt && !operation.undone);
    expiredOperation.undoExpiresAt = new Date(0).toISOString();
    await fs.writeFile(indexPath, JSON.stringify(raw));
    await assert.rejects(() => restarted.undoBatchOperation({ operationId: expiredOperation.id }), /过期/);

    await restarted.selectLibraryMode({ mode: 'managed' });
    result = await restarted.importImages({ categoryId: sad.id, sourcePaths: [source] });
    const deleteAsset = result.state.assets.find((item) => item.categoryId === sad.id);
    await restarted.removeAssets({ assetIds: [deleteAsset.id] });
    await assert.rejects(fs.stat(path.join(root, 'managed', deleteAsset.relativePath)));
    assert.equal((await restarted.getState({ rescan: true })).state.assets.length, 0);
    console.log('expression batch review smoke: ok');
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('expression-batch-review-'));
    await fs.rm(root, { recursive: true, force: true });
  }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
