import { useEffect, useMemo, useState } from 'react';
import type { ExpressionBatchResult, ExpressionReviewFilter } from '../../expression/expressionLibraryTypes';
import { expressionReviewCounts, expressionReviewStatus } from '../../expression/expressionReviewQueue';
import { useExpressionLibrary } from '../../expression/useExpressionLibrary';

export function useExpressionLibraryManager(enabled: boolean) {
  const library = useExpressionLibrary(enabled);
  const [categoryId, setCategoryId] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [versionFilter, setVersionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<ExpressionReviewFilter>('needs-review');
  const [batchResult, setBatchResult] = useState<ExpressionBatchResult | null>(null);
  const [batchScope, setBatchScope] = useState<'category' | 'unassigned'>('category');
  const category = library.state?.categories.find((item) => item.id === categoryId)
    ?? library.state?.categories.find((item) => item.id !== 'cat_unclassified')
    ?? library.state?.categories[0];
  const unassignedCategory = library.state?.categories.find((item) => item.id === 'cat_unclassified');
  const unassignedCount = library.state?.assets.filter((asset) => !asset.removedFromLibrary && asset.categoryId === 'cat_unclassified').length ?? 0;
  const reviewCategory = batchScope === 'unassigned' || category?.id === 'cat_unclassified' ? unassignedCategory : category;
  const categoryAssets = useMemo(
    () => library.state?.assets.filter((asset) => !asset.removedFromLibrary && asset.categoryId === reviewCategory?.id) ?? [],
    [reviewCategory?.id, library.state?.assets],
  );
  const versions = useMemo(
    () => [...new Set(categoryAssets.map((asset) => asset.assignmentSemanticVersion))].sort((a, b) => b - a),
    [categoryAssets],
  );
  const counts = expressionReviewCounts(categoryAssets, reviewCategory);
  const visibleAssets = useMemo(() => categoryAssets.filter((asset) => (
    (statusFilter === 'all' || expressionReviewStatus(asset, reviewCategory) === statusFilter)
    && (versionFilter === 'all' || asset.assignmentSemanticVersion === Number(versionFilter))
  )), [categoryAssets, reviewCategory, statusFilter, versionFilter]);

  useEffect(() => {
    if (!category) return;
    setCategoryId(category.id);
    setSelectedIds(new Set());
    setVersionFilter('all');
    setStatusFilter('needs-review');
  }, [category?.id, reviewCategory?.id]);

  useEffect(() => {
    setBatchResult(null);
    setSelectedIds(new Set());
    setVersionFilter('all');
    setStatusFilter('needs-review');
    setBatchScope('category');
  }, [library.state?.library.mode, library.state?.library.rootPath]);
  useEffect(() => {
    const visibleIds = new Set(visibleAssets.map((asset) => asset.id));
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleAssets]);

  const runAndClear = async (action: Parameters<typeof library.run>[0]) => {
    const result = await library.run(action);
    if (result.batch) {
      setBatchResult(result.batch);
      setSelectedIds(new Set(result.batch.failures.map((failure) => failure.assetId)));
    } else if (result.ok) setSelectedIds(new Set());
    return result;
  };
  const toggleAsset = (assetId: string) => setSelectedIds((current) => {
    const next = new Set(current);
    if (next.has(assetId)) next.delete(assetId); else next.add(assetId);
    return next;
  });
  const selectAll = () => setSelectedIds((current) => (
    visibleAssets.every((asset) => current.has(asset.id))
      ? new Set()
      : new Set(visibleAssets.map((asset) => asset.id))
  ));
  const changeStatusFilter = (value: ExpressionReviewFilter) => { setStatusFilter(value); setSelectedIds(new Set()); };
  const changeVersionFilter = (value: string) => { setVersionFilter(value); setSelectedIds(new Set()); };
  const changeBatchScope = (value: 'category' | 'unassigned') => {
    setBatchScope(value); setSelectedIds(new Set()); setVersionFilter('all'); setStatusFilter('needs-review');
  };
  const selectCategory = (id: string) => { setCategoryId(id); changeBatchScope('category'); };

  return {
    ...library, category, categoryAssets, categoryId, runAndClear, selectedIds, counts, batchResult,
    setCategoryId: selectCategory, setSelectedIds, setVersionFilter: changeVersionFilter, selectAll,
    reviewCategory, unassignedCount, setBatchScope: changeBatchScope,
    clearBatchResult: () => setBatchResult(null),
    batchScope: reviewCategory?.id === 'cat_unclassified' ? 'unassigned' as const : 'category' as const,
    setStatusFilter: changeStatusFilter, statusFilter, toggleAsset, versionFilter, versions, visibleAssets,
  };
}
