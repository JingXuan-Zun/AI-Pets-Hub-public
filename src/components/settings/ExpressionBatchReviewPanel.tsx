import { useEffect, useState } from 'react';
import type { ExpressionBatchResult, ExpressionCategory, ExpressionImageAsset, ExpressionLibraryState, ExpressionReviewFilter } from '../../expression/expressionLibraryTypes';
import { Button } from '../../../components/ui/button';
import { ExpressionAssetGrid } from './ExpressionAssetGrid';

interface ExpressionBatchReviewPanelProps {
  category: ExpressionCategory;
  batchScope: 'category' | 'unassigned';
  unassignedCount: number;
  hasCurrentCategory: boolean;
  onScopeChange: (scope: 'category' | 'unassigned') => void;
  loading: boolean;
  managed: boolean;
  selectedIds: Set<string>;
  state: ExpressionLibraryState;
  statusFilter: ExpressionReviewFilter;
  counts: Record<ExpressionReviewFilter, number>;
  versionFilter: string;
  versions: number[];
  visibleAssets: ExpressionImageAsset[];
  batchResult: ExpressionBatchResult | null;
  onDelete: () => void;
  onMove: (targetCategoryId: string) => void;
  onSelectAll: () => void;
  onStatusChange: (status: 'accepted' | 'needs-review') => void;
  onStatusFilterChange: (value: ExpressionReviewFilter) => void;
  onToggle: (assetId: string) => void;
  onUndo: () => void;
  onVersionChange: (value: string) => void;
}

const FILTERS = [
  { value: 'all', label: '全部' },
  { value: 'needs-review', label: '待审核' },
  { value: 'accepted', label: '已审核' },
  { value: 'missing', label: '文件已失效' },
] as const;

function BatchFeedback({ result, managed, loading, onUndo }: { result: ExpressionBatchResult | null; managed: boolean; loading: boolean; onUndo: () => void }) {
  const [canUndo, setCanUndo] = useState(false);
  useEffect(() => {
    const remaining = result?.undoExpiresAt ? Date.parse(result.undoExpiresAt) - Date.now() : 0;
    setCanUndo(remaining > 0);
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setCanUndo(false), remaining);
    return () => window.clearTimeout(timer);
  }, [result]);
  if (!result) return null;
  const messages = {
    accepted: `已通过审核：${result.successCount} 张；桌宠现在可使用这些图片回复。`,
    'needs-review': `已退回待审核：${result.successCount} 张；桌宠暂不使用这些图片回复。`,
    move: `已移动：${result.successCount} 张至“${result.targetCategoryName || '目标分类'}”；这些图片已转为待审核。`,
    remove: managed ? `已删除：${result.successCount} 张托管图片。` : `已从应用图库移除：${result.successCount} 张；原始外部文件未修改。`,
    undo: `已撤销：${result.successCount} 张图片的操作。`,
  };
  return <div className="mt-3 rounded-md border border-border bg-secondary/25 p-3 text-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p role="status" aria-live="polite">{messages[result.action]}{result.failureCount > 0 ? ` 失败：${result.failureCount} 张。` : ''}</p>
      {canUndo ? <Button className="cursor-pointer" disabled={loading} size="sm" variant="outline" onClick={onUndo}>撤销（60 秒内）</Button> : null}
    </div>
    {result.failures.length > 0 ? <details className="mt-2" open>
      <summary className="cursor-pointer font-medium text-destructive">失败明细</summary>
      <ul className="mt-1 space-y-1 break-words">{result.failures.map((failure) => <li key={failure.assetId}>{failure.fileName}：{failure.reason}</li>)}</ul>
    </details> : null}
    {result.undoExpiresAt && !canUndo ? <p className="mt-1 text-muted-foreground">撤销窗口已结束；仍可重新审核或移动图片。</p> : null}
  </div>;
}

export function ExpressionBatchReviewPanel(props: ExpressionBatchReviewPanelProps) {
  const disabled = !props.selectedIds.size || props.loading;
  const unassigned = props.batchScope === 'unassigned';
  const allSelected = props.visibleAssets.length > 0 && props.visibleAssets.every((asset) => props.selectedIds.has(asset.id));
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-sm">
      <h3 className="truncate text-sm font-semibold" title={unassigned ? '待重新归类' : props.category.name}>批量处理 · {unassigned ? '待重新归类' : props.category.name}</h3>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="批量处理范围">
        <Button aria-pressed={!unassigned} disabled={props.loading || !props.hasCurrentCategory} className="cursor-pointer" size="sm" variant={!unassigned ? 'default' : 'outline'} onClick={() => props.onScopeChange('category')}>当前分类</Button>
        <Button aria-pressed={unassigned} disabled={props.loading} className="cursor-pointer" size="sm" variant={unassigned ? 'default' : 'outline'} onClick={() => props.onScopeChange('unassigned')}>待重新归类 {props.unassignedCount}</Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{unassigned ? '删除分类后保留的图片在这里待审核。请先移动到一个分类，再通过审核；也可直接删除图片。' : '图片通过审核后，桌宠才能用于回复。移动图片会退回待审核。'}</p>
      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="审核状态筛选">
        {FILTERS.map((filter) => <button key={filter.value} type="button" aria-pressed={props.statusFilter === filter.value}
          className={`cursor-pointer rounded-md border px-2.5 py-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${props.statusFilter === filter.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-secondary'}`}
          onClick={() => props.onStatusFilterChange(filter.value)}>{filter.label} {props.counts[filter.value]}</button>)}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button className="cursor-pointer" disabled={props.loading || !props.visibleAssets.length} size="sm" variant="outline" onClick={props.onSelectAll}>{allSelected ? '取消全选' : '全选'}</Button>
        <span className="text-xs text-muted-foreground">已选 {props.selectedIds.size} 张 · 当前显示 {props.visibleAssets.length} 张</span>
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">高级筛选</summary>
          <label className="mt-2 flex items-center gap-2">分类语义版本
            <select aria-label="分类语义版本" className="cursor-pointer rounded border border-input bg-background px-2 py-1.5 focus-visible:ring-2 focus-visible:ring-ring" value={props.versionFilter} onChange={(event) => props.onVersionChange(event.target.value)}>
              <option value="all">全部版本</option>
              {props.versions.map((version) => <option key={version} value={version}>v{version}</option>)}
            </select>
          </label>
        </details>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-y border-border py-2">
        <Button className="cursor-pointer" disabled={disabled || unassigned} size="sm" variant="default" onClick={() => props.onStatusChange('accepted')}>通过审核</Button>
        <Button className="cursor-pointer" disabled={disabled || unassigned} size="sm" variant="outline" onClick={() => props.onStatusChange('needs-review')}>退回待审核</Button>
        <select aria-label="移动到分类" className="h-7 max-w-full cursor-pointer rounded border border-input bg-background px-2 text-xs focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" disabled={disabled} value="" onChange={(event) => { if (event.target.value) props.onMove(event.target.value); }}>
          <option value="">移动到…</option>
          {props.state.categories.filter((item) => item.id !== 'cat_unclassified' && item.available && !item.nameIssue && item.id !== props.category.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <Button className="cursor-pointer" disabled={disabled} size="sm" variant="destructive" onClick={props.onDelete}>{props.managed ? '删除' : '从应用图库移除'}</Button>
      </div>
      {!props.managed ? <p className="mt-2 rounded bg-secondary/35 px-3 py-2 text-xs text-muted-foreground">外部目录只读：移动仅调整应用内归类；移除后不再参与回复，重新扫描也不会恢复。所有操作都不修改原文件。</p> : null}
      <BatchFeedback result={props.batchResult} managed={props.managed} loading={props.loading} onUndo={props.onUndo} />
      <div className="mt-3"><ExpressionAssetGrid assets={props.visibleAssets} category={props.category} disabled={props.loading} selectedIds={props.selectedIds} onToggle={props.onToggle} /></div>
    </section>
  );
}
