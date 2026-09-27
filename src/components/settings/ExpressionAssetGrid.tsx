import { useEffect, useState } from 'react';
import { expressionLibraryBridge } from '../../expression/expressionLibraryBridge';
import type { ExpressionCategory, ExpressionImageAsset } from '../../expression/expressionLibraryTypes';
import { expressionReviewStatus } from '../../expression/expressionReviewQueue';

interface ExpressionAssetGridProps {
  assets: ExpressionImageAsset[];
  category: ExpressionCategory;
  disabled?: boolean;
  selectedIds: Set<string>;
  onToggle: (assetId: string) => void;
}

function AssetThumbnail({ asset }: { asset: ExpressionImageAsset }) {
  const [dataUrl, setDataUrl] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!asset.available) return;
    setDataUrl('');
    setFailed(false);
    let active = true;
    void expressionLibraryBridge.getPreview(asset.id).then((result) => {
      if (!active) return;
      if (result.ok && result.dataUrl) setDataUrl(result.dataUrl);
      else setFailed(true);
    }).catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [asset.id, asset.available, asset.relativePath, asset.fileSignature]);

  if (!asset.available) {
    return <div className="flex h-20 items-center justify-center bg-secondary/30 text-[11px] text-muted-foreground">原文件已失效</div>;
  }

  return dataUrl
    ? <img alt={asset.fileName} className="h-20 w-full object-contain" src={dataUrl} />
    : <div className="flex h-20 items-center justify-center text-[11px] text-muted-foreground">{failed ? '预览失败，请重新扫描' : '加载预览…'}</div>;
}

export function ExpressionAssetGrid({ assets, category, disabled, selectedIds, onToggle }: ExpressionAssetGridProps) {
  if (assets.length === 0) {
    return <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">当前筛选下没有图片，可切换“全部”查看。</div>;
  }

  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
      {assets.map((asset) => (
        <button
          className={`relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-md border bg-background text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedIds.has(asset.id) ? 'border-primary ring-2 ring-primary' : 'border-border hover:border-primary/50'}`}
          aria-pressed={selectedIds.has(asset.id)}
          disabled={disabled}
          key={asset.id}
          type="button"
          onClick={() => onToggle(asset.id)}
        >
          {selectedIds.has(asset.id) ? <span className="absolute right-1.5 top-1.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] text-primary-foreground">✓</span> : null}
          <AssetThumbnail asset={asset} />
          <div className="w-full flex-1 border-t border-border px-2 py-1.5">
            <div className="truncate text-xs font-medium" title={asset.fileName}>{asset.fileName}</div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              {!asset.available ? '文件已失效' : asset.categoryId === 'cat_unclassified' ? '待审核 · 待重新归类' : `${asset.classificationStatus === 'excluded' ? '待处理（旧记录）' : expressionReviewStatus(asset, category) === 'accepted' ? '已审核' : '待审核'} · 分类语义 v${asset.assignmentSemanticVersion}`}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
