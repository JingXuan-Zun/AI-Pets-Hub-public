import { useEffect, useRef, useState } from 'react';
import { getExpressionLibraryReadiness, type ExpressionLibraryReadiness } from '../../expression/expressionLibraryReadiness';
import { expressionReviewStatus } from '../../expression/expressionReviewQueue';
import {
  deleteExpressionCategoryDraft,
  flushExpressionCategoryDrafts,
  getExpressionCategoryDraft,
  setExpressionCategoryDraft,
} from '../../expression/expressionCategoryDraftStore';
import { expressionLibraryBridge } from '../../expression/expressionLibraryBridge';
import type { ExpressionLibraryMode, ExpressionLibraryResult } from '../../expression/expressionLibraryTypes';
import { ExpressionBatchReviewPanel } from './ExpressionBatchReviewPanel';
import { ExpressionCategoryPanel } from './ExpressionCategoryPanel';
import { ExpressionLibraryModePanel } from './ExpressionLibraryModePanel';
import { SettingsToggleSwitch } from './SettingsToggleSwitch';
import { useExpressionLibraryManager } from './useExpressionLibraryManager';
import { useExpressionLibraryScrollAnchor } from './useExpressionLibraryScrollAnchor';

interface ExpressionLibraryManagerProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onImageCandidateCountChange: (count: number) => void;
  onSelectedModeChange: (mode: ExpressionLibraryMode) => void;
  selectedMode: ExpressionLibraryMode | null;
  onReadinessChange?: (readiness: ExpressionLibraryReadiness | null) => void;
  reviewRequest?: number;
  refreshRequest?: number;
}

export function ExpressionLibraryManager(props: ExpressionLibraryManagerProps) {
  const control = useExpressionLibraryManager(props.enabled);
  const { preserveScrollPosition, sectionRef } = useExpressionLibraryScrollAnchor();
  const [, setDraftRevision] = useState(0);
  const batchRef = useRef<HTMLDivElement>(null);
  const handledReviewRequest = useRef(0);
  const handledRefreshRequest = useRef(0);
  const selectedLibraryLoaded = Boolean(props.selectedMode && control.state?.library.mode === props.selectedMode);
  const managed = selectedLibraryLoaded && props.selectedMode === 'managed';
  useEffect(() => {
    if (!props.enabled || !selectedLibraryLoaded) {
      props.onImageCandidateCountChange(0);
      props.onReadinessChange?.(null);
      return;
    }
    const readiness = control.state ? getExpressionLibraryReadiness(control.state) : null;
    props.onImageCandidateCountChange(readiness?.ready ?? 0);
    props.onReadinessChange?.(readiness);
  }, [control.state, props.enabled, props.onImageCandidateCountChange, props.onReadinessChange, selectedLibraryLoaded]);
  useEffect(() => {
    if (!props.refreshRequest || handledRefreshRequest.current === props.refreshRequest || !props.enabled) return;
    handledRefreshRequest.current = props.refreshRequest;
    void control.run(expressionLibraryBridge.rescan);
  }, [props.refreshRequest, props.enabled, control.run]);
  useEffect(() => {
    if (!props.reviewRequest || handledReviewRequest.current === props.reviewRequest || !control.state || control.loading) return;
    handledReviewRequest.current = props.reviewRequest;
    const target = control.state.assets.find((asset) => asset.categoryId !== 'cat_unclassified'
      && asset.available && !asset.removedFromLibrary
      && expressionReviewStatus(asset, control.state!.categories.find((category) => category.id === asset.categoryId)) === 'needs-review');
    if (target) control.setCategoryId(target.categoryId);
    else control.setBatchScope('unassigned');
    control.setStatusFilter('needs-review');
    control.setVersionFilter('all');
    requestAnimationFrame(() => {
      batchRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      batchRef.current?.focus({ preventScroll: true });
    });
  }, [props.reviewRequest, control.state, control.loading, control.setCategoryId, control.setBatchScope, control.setStatusFilter, control.setVersionFilter]);
  const categoryDraft = control.category ? getExpressionCategoryDraft(control.category.id) : undefined;
  const draftName = categoryDraft?.name ?? control.category?.name ?? '';
  const draftDescription = categoryDraft?.description ?? control.category?.description ?? '';
  const run = control.run;
  const runAfterSavingDrafts = async (
    action: () => Promise<ExpressionLibraryResult>,
    onSuccess?: (result: ExpressionLibraryResult) => void,
  ) => {
    try {
      await flushExpressionCategoryDrafts();
      setDraftRevision((current) => current + 1);
      const result = await run(action);
      if (result.ok && !result.cancelled) onSuccess?.(result);
      return result;
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '分类草稿保存失败。');
      return { error: error instanceof Error ? error.message : '分类草稿保存失败。', ok: false };
    }
  };
  const selectLibraryMode = (mode: ExpressionLibraryMode) => preserveScrollPosition(() => runAfterSavingDrafts(
    () => expressionLibraryBridge.selectMode(mode),
    () => props.onSelectedModeChange(mode),
  ));
  const importManagedLibrary = async () => {
    try {
      await flushExpressionCategoryDrafts();
      const switched = await run(() => expressionLibraryBridge.selectMode('managed'));
      if (!switched.ok) return;
      props.onSelectedModeChange('managed');
      await run(expressionLibraryBridge.importClassifiedRoot);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '分类草稿保存失败。');
    }
  };

  const createCategory = async () => {
    const names = new Set(control.state?.categories.map((item) => item.name));
    let index = 1;
    while (names.has(`新分类 ${index}`)) index += 1;
    const name = `新分类 ${index}`;
    const result = await run(() => expressionLibraryBridge.createCategory(name, ''));
    const created = result.state?.categories.find((item) => item.name === name);
    if (created) control.setCategoryId(created.id);
  };
  const updateDraft = (name: string, description: string) => {
    if (!control.category) return;
    setExpressionCategoryDraft({ categoryId: control.category.id, description, name });
    setDraftRevision((current) => current + 1);
  };
  const deleteCategory = async (categoryId: string, categoryName: string) => {
    if (!window.confirm(`确定删除分类“${categoryName}”吗？已登记图片将保留在批量处理的“待重新归类”待审核队列，不会新增分类卡片；原分类文件夹及其中未识别的文件将被删除。`)) return;
    deleteExpressionCategoryDraft(categoryId);
    const result = await run(() => expressionLibraryBridge.deleteCategory(categoryId));
    if (!result.ok) {
      window.alert(result.error || `删除分类“${categoryName}”失败。`);
      return;
    }
    if (control.category?.id === categoryId) {
      const nextCategoryId = result.state?.categories.find((item) => item.id !== 'cat_unclassified')?.id
        ?? 'cat_unclassified';
      control.setCategoryId(nextCategoryId);
    }
    control.setBatchScope('unassigned');
    control.clearBatchResult();
  };
  const performBatch = async (action: () => Promise<ExpressionLibraryResult>) => {
    try {
      await flushExpressionCategoryDrafts();
      setDraftRevision((revision) => revision + 1);
      await control.runAndClear(action);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '分类草稿保存失败，批量操作未执行。');
    }
  };
  const deleteAssets = async () => {
    const message = managed
      ? `确定删除选中的 ${control.selectedIds.size} 张托管图片及其索引记录？此操作不可撤销。`
      : `确定将选中的 ${control.selectedIds.size} 张图片永久从应用图库移除？外部原文件不会被修改，重新扫描也不会恢复。`;
    if (!control.selectedIds.size || !window.confirm(message)) return;
    await performBatch(() => expressionLibraryBridge.removeAssets([...control.selectedIds]));
  };

  return (
    <div className="space-y-3">
      {props.enabled && selectedLibraryLoaded && control.state && control.category ? (
        <ExpressionCategoryPanel category={control.category} description={draftDescription} loading={control.loading} managed={managed} name={draftName} state={control.state} onChange={updateDraft} onCreate={() => void createCategory()} onDelete={(categoryId, categoryName) => void deleteCategory(categoryId, categoryName)} onDropImages={(files) => void run(() => expressionLibraryBridge.importDroppedImages(control.category!.id, files))} onOpenFolder={() => void run(() => expressionLibraryBridge.openCategoryFolder(control.category!.id))} onSelect={control.setCategoryId} />
      ) : null}
      {props.enabled && selectedLibraryLoaded && control.state && control.reviewCategory ? (
        <div ref={batchRef} tabIndex={-1} className="outline-none">
        <ExpressionBatchReviewPanel
          category={control.reviewCategory} loading={control.loading} managed={managed}
          batchScope={control.batchScope} unassignedCount={control.unassignedCount}
          hasCurrentCategory={control.category?.id !== 'cat_unclassified'} onScopeChange={control.setBatchScope}
          selectedIds={control.selectedIds} state={control.state}
          statusFilter={control.statusFilter} counts={control.counts} onStatusFilterChange={control.setStatusFilter}
          versionFilter={control.versionFilter} versions={control.versions} visibleAssets={control.visibleAssets}
          batchResult={control.batchResult} onUndo={() => void performBatch(() => expressionLibraryBridge.undoBatch(control.batchResult!.id))}
          onDelete={() => void deleteAssets()}
          onMove={(targetId) => void performBatch(() => expressionLibraryBridge.moveAssets([...control.selectedIds], targetId))}
          onSelectAll={control.selectAll}
          onStatusChange={(status) => void performBatch(() => expressionLibraryBridge.setAssetStatus([...control.selectedIds], status))}
          onToggle={control.toggleAsset} onVersionChange={control.setVersionFilter}
        />
        </div>
      ) : null}
      <section ref={sectionRef} className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div><h3 className="text-sm font-semibold">图片表情包库</h3><p className="text-[11px] text-muted-foreground">选择图库来源，或导入已有的一级分类文件夹。</p></div>
          <SettingsToggleSwitch checked={props.enabled} label="启用" onChange={props.onEnabledChange} />
        </div>
        {props.enabled && control.state ? (
          <ExpressionLibraryModePanel
            loadedMode={control.state.library.mode}
            loading={control.loading}
            rootPath={control.state.library.rootPath}
            selectedMode={props.selectedMode}
            onImportExternal={() => void runAfterSavingDrafts(
              () => expressionLibraryBridge.chooseRoot('external'),
              () => props.onSelectedModeChange('external'),
            )}
            onImportManaged={() => void importManagedLibrary()}
            onRescan={() => void run(expressionLibraryBridge.rescan)}
            onSelectExternal={() => void selectLibraryMode('external')}
            onSelectManaged={() => void selectLibraryMode('managed')}
          />
        ) : props.enabled ? <div className="mt-3 text-xs text-muted-foreground">正在读取表情包库…</div> : null}
        {props.enabled && control.error ? <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{control.error}</div> : null}
      </section>
    </div>
  );
}
