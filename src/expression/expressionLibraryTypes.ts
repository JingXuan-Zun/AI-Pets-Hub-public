export type ExpressionLibraryMode = 'external' | 'managed';
export type ExpressionAssetStatus = 'accepted' | 'excluded' | 'needs-review';
export type ExpressionReviewFilter = 'all' | 'needs-review' | 'accepted' | 'missing';

export interface ExpressionCategory {
  available: boolean;
  description: string;
  folderRelativePath: string;
  id: string;
  name: string;
  nameIssue?: string;
  reviewRequired: boolean;
  semanticVersion: number;
}

export interface ExpressionImageAsset {
  fileSignature?: string;
  assignmentSemanticVersion: number;
  available: boolean;
  categoryId: string;
  classificationStatus: ExpressionAssetStatus;
  fileName: string;
  id: string;
  mimeType: string;
  relativePath: string;
  removedFromLibrary?: boolean;
  categoryOverrideId?: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  reviewSource?: string;
}

export interface ExpressionBatchResult {
  id: string;
  action: 'accepted' | 'needs-review' | 'move' | 'remove' | 'undo';
  at: string;
  successCount: number;
  failureCount: number;
  succeededIds: string[];
  failures: Array<{ assetId: string; fileName: string; reason: string }>;
  targetCategoryName?: string;
  undoExpiresAt?: string;
}

export interface ExpressionLibraryState {
  assets: ExpressionImageAsset[];
  categories: ExpressionCategory[];
  library: { mode: ExpressionLibraryMode; rootPath: string };
  updatedAt: string;
  version: number;
}

export interface ExpressionLibraryResult {
  batch?: ExpressionBatchResult;
  cancelled?: boolean;
  dataUrl?: string;
  error?: string;
  modeAvailable?: boolean;
  ok: boolean;
  state?: ExpressionLibraryState;
}

export interface SystemExpressionCatalogItem {
  id: string;
  intents: string[];
  value: string;
}

export interface ExpressionReplyImageRoot {
  assets: Array<{ assetId: string; categoryId: string; mimeType: string }>;
  categories: Array<{ description: string; id: string; name: string; semanticVersion: number }>;
  enabledForReply: boolean;
  id: string;
  name: string;
  replyPriority: number;
  sourceType: ExpressionLibraryMode;
}

export interface ExpressionReplyCatalog {
  roots: ExpressionReplyImageRoot[];
  system: {
    emoji: SystemExpressionCatalogItem[];
    kaomoji: SystemExpressionCatalogItem[];
    version: number;
  };
}

export interface ExpressionReplyCatalogResult {
  catalog?: ExpressionReplyCatalog;
  error?: string;
  ok: boolean;
}
