import type { ExpressionCategory, ExpressionImageAsset, ExpressionReviewFilter } from './expressionLibraryTypes';

export function expressionReviewStatus(asset: ExpressionImageAsset, category?: ExpressionCategory): Exclude<ExpressionReviewFilter, 'all'> {
  if (!asset.available) return 'missing';
  if (asset.categoryId === 'cat_unclassified') return 'needs-review';
  if (asset.classificationStatus === 'accepted' && category?.available && !category.nameIssue
    && asset.assignmentSemanticVersion === category.semanticVersion) return 'accepted';
  return 'needs-review';
}

export function expressionReviewCounts(assets: ExpressionImageAsset[], category?: ExpressionCategory) {
  const counts = { all: 0, 'needs-review': 0, accepted: 0, missing: 0 };
  for (const asset of assets) {
    if (asset.removedFromLibrary) continue;
    counts.all += 1;
    counts[expressionReviewStatus(asset, category)] += 1;
  }
  return counts;
}
