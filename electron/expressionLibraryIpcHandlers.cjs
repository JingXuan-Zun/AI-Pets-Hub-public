function registerExpressionLibraryIpcHandlers({ dialog, expressionLibraryService, ipcMain, shell, systemExpressionCatalogService }) {
  const handle = (channel, handler) => {
    ipcMain.handle(channel, async (_event, request) => {
      try {
        return await handler(request ?? {});
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error), ok: false };
      }
    });
  };

  handle('desktop-pet:expression-library-get-state', (request) => expressionLibraryService.getState(request));
  handle('desktop-pet:expression-reply-catalog-get', async () => {
    const [imageResult, systemResult] = await Promise.all([
      expressionLibraryService.getReplyCatalog(),
      systemExpressionCatalogService.getCatalog(),
    ]);
    return { catalog: { ...imageResult.catalog, system: systemResult.catalog }, ok: true };
  });
  handle('desktop-pet:expression-library-rescan', () => expressionLibraryService.getState({ rescan: true }));
  handle('desktop-pet:expression-library-select-mode', (request) => expressionLibraryService.selectLibraryMode(request));
  handle('desktop-pet:expression-library-create-category', (request) => expressionLibraryService.createCategory(request));
  handle('desktop-pet:expression-library-update-category', (request) => expressionLibraryService.updateCategory(request));
  handle('desktop-pet:expression-library-delete-category', (request) => expressionLibraryService.deleteCategory(request));
  handle('desktop-pet:expression-library-set-asset-status', (request) => expressionLibraryService.setAssetStatus(request));
  handle('desktop-pet:expression-library-move-assets', (request) => expressionLibraryService.moveAssets(request));
  handle('desktop-pet:expression-library-remove-assets', (request) => expressionLibraryService.removeAssets(request));
  handle('desktop-pet:expression-library-undo-batch', (request) => expressionLibraryService.undoBatchOperation(request));
  handle('desktop-pet:expression-library-get-preview', (request) => expressionLibraryService.getPreview(request));
  handle('desktop-pet:expression-library-import-dropped-images', (request) => expressionLibraryService.importImages(request));

  handle('desktop-pet:expression-library-open-category-folder', async (request) => {
    const directoryPath = await expressionLibraryService.resolveCategoryDirectory(request);
    const error = await shell.openPath(directoryPath);
    if (error) throw new Error(error);
    return { ok: true };
  });

  handle('desktop-pet:expression-library-choose-root', async (request) => {
    if (request?.mode !== 'external') return expressionLibraryService.setLibrary({ mode: 'managed' });
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择外部表情包根目录' });
    if (result.canceled || !result.filePaths[0]) return { cancelled: true, ok: true };
    return expressionLibraryService.setLibrary({ mode: 'external', rootPath: result.filePaths[0] });
  });

  handle('desktop-pet:expression-library-import-images', async (request) => {
    const result = await dialog.showOpenDialog({
      filters: [{ extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'], name: '表情包图片' }],
      properties: ['openFile', 'multiSelections'],
      title: '导入表情包图片',
    });
    if (result.canceled || result.filePaths.length === 0) return { cancelled: true, ok: true };
    return expressionLibraryService.importImages({ categoryId: request?.categoryId, sourcePaths: result.filePaths });
  });

  handle('desktop-pet:expression-library-import-classified-root', async () => {
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择分类文件夹或包含多个分类的目录' });
    if (result.canceled || !result.filePaths[0]) return { cancelled: true, ok: true };
    return expressionLibraryService.importClassifiedRoot({ sourceRootPath: result.filePaths[0] });
  });
}

module.exports = { registerExpressionLibraryIpcHandlers };
