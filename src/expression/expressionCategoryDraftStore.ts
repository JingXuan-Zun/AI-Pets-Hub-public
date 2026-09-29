import { expressionLibraryBridge } from './expressionLibraryBridge';

export interface ExpressionCategoryDraft {
  categoryId: string;
  description: string;
  name: string;
}

const drafts = new Map<string, ExpressionCategoryDraft>();

export function getExpressionCategoryDraft(categoryId: string) {
  return drafts.get(categoryId);
}

export function setExpressionCategoryDraft(draft: ExpressionCategoryDraft) {
  drafts.set(draft.categoryId, draft);
}

export function deleteExpressionCategoryDraft(categoryId: string) {
  drafts.delete(categoryId);
}

export function discardExpressionCategoryDrafts() {
  drafts.clear();
}

export async function flushExpressionCategoryDrafts() {
  for (const draft of drafts.values()) {
    const result = await expressionLibraryBridge.updateCategory(draft.categoryId, draft.name, draft.description);
    if (!result.ok) throw new Error(result.error || `保存分类“${draft.name}”失败。`);
  }
  drafts.clear();
}
