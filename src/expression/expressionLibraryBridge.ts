import type { ExpressionAssetStatus, ExpressionLibraryMode, ExpressionLibraryResult, ExpressionReplyCatalogResult } from './expressionLibraryTypes';

type ExpressionLibraryShell = {
  chooseExpressionLibraryRoot?: (request: { mode: ExpressionLibraryMode }) => Promise<ExpressionLibraryResult>;
  createExpressionCategory?: (request: { description: string; name: string }) => Promise<ExpressionLibraryResult>;
  deleteExpressionCategory?: (request: { categoryId: string }) => Promise<ExpressionLibraryResult>;
  getExpressionAssetPreview?: (request: { assetId: string }) => Promise<ExpressionLibraryResult>;
  getExpressionLibraryState?: (request?: { rescan?: boolean }) => Promise<ExpressionLibraryResult>;
  getExpressionReplyCatalog?: () => Promise<ExpressionReplyCatalogResult>;
  importExpressionImages?: (request: { categoryId: string }) => Promise<ExpressionLibraryResult>;
  importExpressionDroppedImages?: (request: { categoryId: string; sourcePaths: string[] }) => Promise<ExpressionLibraryResult>;
  importExpressionClassifiedRoot?: () => Promise<ExpressionLibraryResult>;
  moveExpressionAssets?: (request: { assetIds: string[]; targetCategoryId: string }) => Promise<ExpressionLibraryResult>;
  openExpressionCategoryFolder?: (request: { categoryId: string }) => Promise<ExpressionLibraryResult>;
  removeExpressionAssets?: (request: { assetIds: string[] }) => Promise<ExpressionLibraryResult>;
  rescanExpressionLibrary?: () => Promise<ExpressionLibraryResult>;
  undoExpressionBatch?: (request: { operationId: string }) => Promise<ExpressionLibraryResult>;
  selectExpressionLibraryMode?: (request: { mode: ExpressionLibraryMode }) => Promise<ExpressionLibraryResult>;
  setExpressionAssetStatus?: (request: { assetIds: string[]; status: ExpressionAssetStatus }) => Promise<ExpressionLibraryResult>;
  updateExpressionCategory?: (request: { categoryId: string; description: string; name: string }) => Promise<ExpressionLibraryResult>;
};

function getShell() {
  return window.desktopPetShell as typeof window.desktopPetShell & ExpressionLibraryShell;
}

const unavailable = (): Promise<ExpressionLibraryResult> => Promise.resolve({
  error: '当前不是桌面版，无法管理本地表情包库。', ok: false,
});

const unavailableCatalog = (): Promise<ExpressionReplyCatalogResult> => Promise.resolve({
  error: '当前不是桌面版，无法读取表情目录。', ok: false,
});

export const expressionLibraryBridge = {
  chooseRoot: (mode: ExpressionLibraryMode) => getShell()?.chooseExpressionLibraryRoot?.({ mode }) ?? unavailable(),
  createCategory: (name: string, description: string) => getShell()?.createExpressionCategory?.({ name, description }) ?? unavailable(),
  deleteCategory: (categoryId: string) => getShell()?.deleteExpressionCategory?.({ categoryId }) ?? unavailable(),
  getPreview: (assetId: string) => getShell()?.getExpressionAssetPreview?.({ assetId }) ?? unavailable(),
  getReplyCatalog: () => getShell()?.getExpressionReplyCatalog?.() ?? unavailableCatalog(),
  getState: () => getShell()?.getExpressionLibraryState?.({ rescan: true }) ?? unavailable(),
  importImages: (categoryId: string) => getShell()?.importExpressionImages?.({ categoryId }) ?? unavailable(),
  importDroppedImages: (categoryId: string, files: File[]) => {
    const shell = getShell();
    const sourcePaths = files.map((file) => shell?.getPathForFile?.(file) ?? '').filter(Boolean);
    return shell?.importExpressionDroppedImages?.({ categoryId, sourcePaths }) ?? unavailable();
  },
  importClassifiedRoot: () => getShell()?.importExpressionClassifiedRoot?.() ?? unavailable(),
  moveAssets: (assetIds: string[], targetCategoryId: string) => getShell()?.moveExpressionAssets?.({ assetIds, targetCategoryId }) ?? unavailable(),
  openCategoryFolder: (categoryId: string) => getShell()?.openExpressionCategoryFolder?.({ categoryId }) ?? unavailable(),
  removeAssets: (assetIds: string[]) => getShell()?.removeExpressionAssets?.({ assetIds }) ?? unavailable(),
  rescan: () => getShell()?.rescanExpressionLibrary?.() ?? unavailable(),
  undoBatch: (operationId: string) => getShell()?.undoExpressionBatch?.({ operationId }) ?? unavailable(),
  selectMode: (mode: ExpressionLibraryMode) => getShell()?.selectExpressionLibraryMode?.({ mode }) ?? unavailable(),
  setAssetStatus: (assetIds: string[], status: ExpressionAssetStatus) => getShell()?.setExpressionAssetStatus?.({ assetIds, status }) ?? unavailable(),
  updateCategory: (categoryId: string, name: string, description: string) => getShell()?.updateExpressionCategory?.({ categoryId, name, description }) ?? unavailable(),
};
