import type { ExpressionLibraryState } from './expressionLibraryTypes';
import { expressionReviewStatus } from './expressionReviewQueue';

export interface ExpressionLibraryReadiness {
  total: number;
  ready: number;
  pending: number;
  unassigned: number;
  missing: number;
}

export function getExpressionLibraryReadiness(state: ExpressionLibraryState): ExpressionLibraryReadiness {
  const result = { total: 0, ready: 0, pending: 0, unassigned: 0, missing: 0 };
  const categories = new Map(state.categories.map((category) => [category.id, category]));
  for (const asset of state.assets) {
    if (asset.removedFromLibrary) continue;
    result.total += 1;
    const category = categories.get(asset.categoryId);
    if (!asset.available || !category?.available) result.missing += 1;
    else if (asset.categoryId === 'cat_unclassified') result.unassigned += 1;
    else if (expressionReviewStatus(asset, category) === 'accepted') result.ready += 1;
    else result.pending += 1;
  }
  return result;
}
