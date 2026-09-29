// Development-only, memory-backed IPC fixture. Never reads or modifies real pictures.
// Backend file/index behavior is covered by expression-batch-review-smoke.cjs.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExpressionLibraryManager } from '../../src/components/settings/ExpressionLibraryManager';
import { ExpressionReplyWeights } from '../../src/components/settings/ExpressionReplyWeights';
import { DEFAULT_EXPRESSION_REPLY_SETTINGS } from '../../src/expression/expressionSettings';
import type { ExpressionLibraryReadiness } from '../../src/expression/expressionLibraryReadiness';
import { expressionLibraryBridge } from '../../src/expression/expressionLibraryBridge';
import type { ExpressionBatchResult, ExpressionLibraryMode, ExpressionLibraryResult, ExpressionLibraryState } from '../../src/expression/expressionLibraryTypes';
import '../../src/index.css';

const initial: ExpressionLibraryState = {
  library: { mode: 'managed', rootPath: 'fixture/managed' }, version: 5, updatedAt: '2026-09-04',
  categories: [
    { id: 'cat_unclassified', name: '未分类', description: '', available: true, folderRelativePath: '', semanticVersion: 1, reviewRequired: true },
    ...['开心', '伤心'].map((name, i) => ({ id: `category-${i}`, name, description: name, available: true, folderRelativePath: name, semanticVersion: 2, reviewRequired: true })),
  ],
  assets: [
    ['待审核.png', 'needs-review', true, 2],
    ['已审核.png', 'accepted', true, 2],
    ['旧排除.png', 'excluded', true, 1],
    ['丢失.png', 'needs-review', false, 2],
    ['旧版本.png', 'accepted', true, 1],
  ].map(([fileName, classificationStatus, available, version], i) => ({
    id: `image-${i}`, categoryId: 'category-0', fileName: String(fileName), relativePath: `开心/${fileName}`, mimeType: 'image/png',
    available: Boolean(available), classificationStatus: classificationStatus as 'needs-review' | 'accepted' | 'excluded', assignmentSemanticVersion: Number(version),
  })),
};
let state = structuredClone(initial);
// Stub the native dialog only in this isolated fixture; the production manager
// still calls window.confirm before sending any delete request.
let confirmDeletion = true;
window.confirm = () => confirmDeletion;
const history = new Map<string, ExpressionLibraryState>();
const response = (batch?: ExpressionBatchResult): ExpressionLibraryResult => ({ ok: true, state: structuredClone(state), batch });
expressionLibraryBridge.getState = async () => response();
expressionLibraryBridge.selectMode = async (mode) => { state.library = { mode, rootPath: `fixture/${mode}` }; return response(); };
expressionLibraryBridge.getPreview = async () => ({ ok: true, dataUrl: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#e0f2fe"/><text x="36" y="50" font-size="28">^_^</text></svg>') });
expressionLibraryBridge.rescan = async () => response();
expressionLibraryBridge.deleteCategory = async (id) => {
  state.categories = state.categories.filter((category) => category.id !== id);
  state.assets = state.assets.flatMap((asset) => asset.categoryId !== id ? [asset] : asset.available
    ? [{ ...asset, categoryId: 'cat_unclassified', relativePath: asset.fileName, classificationStatus: 'needs-review' as const }]
    : []);
  return response();
};
expressionLibraryBridge.updateCategory = async (id, name, description) => {
  const category = state.categories.find((item) => item.id === id)!;
  category.name = name; category.description = description;
  return response();
};
const execute = (ids: string[], action: ExpressionBatchResult['action'], targetId?: string) => {
  const id = crypto.randomUUID();
  history.set(id, structuredClone(state));
  const failed = ids.filter((id) => !state.assets.find((asset) => asset.id === id)?.available);
  const succeeded = ids.filter((id) => !failed.includes(id));
  const target = state.categories.find((category) => category.id === targetId);
  state.assets = state.assets.flatMap((asset) => {
    if (!succeeded.includes(asset.id)) return [asset];
    if (action === 'remove') return [];
    return [{ ...asset, categoryId: target?.id ?? asset.categoryId, assignmentSemanticVersion: 2,
      classificationStatus: action === 'accepted' ? 'accepted' as const : 'needs-review' as const }];
  });
  return response({ id, action, at: new Date().toISOString(), successCount: succeeded.length, failureCount: failed.length, succeededIds: succeeded,
    failures: failed.map((id) => ({ assetId: id, fileName: '丢失.png', reason: '原文件已失效，请重新扫描。' })),
    targetCategoryName: target?.name, undoExpiresAt: action === 'remove' ? undefined : new Date(Date.now() + 60_000).toISOString() });
};
expressionLibraryBridge.setAssetStatus = async (ids, status) => execute(ids, status === 'accepted' ? 'accepted' : 'needs-review');
expressionLibraryBridge.moveAssets = async (ids, targetId) => execute(ids, 'move', targetId);
expressionLibraryBridge.removeAssets = async (ids) => execute(ids, 'remove');
expressionLibraryBridge.undoBatch = async (id) => {
  state = structuredClone(history.get(id)!);
  return response({ id: crypto.randomUUID(), action: 'undo', at: new Date().toISOString(), successCount: 1, failureCount: 0, succeededIds: [], failures: [] });
};

function Fixture() {
  const [mode, setMode] = useState<ExpressionLibraryMode | null>('managed');
  const [enabled, setEnabled] = useState(true);
  const [candidates, setCandidates] = useState(0);
  const [readiness, setReadiness] = useState<ExpressionLibraryReadiness | null>(null);
  const [reviewRequest, setReviewRequest] = useState(0);
  const [refreshRequest, setRefreshRequest] = useState(0);
  const [settings, setSettings] = useState({ ...DEFAULT_EXPRESSION_REPLY_SETTINGS, imageStickerWeight: 100, kaomojiWeight: 0, systemEmojiWeight: 0 });
  return <main className="w-full p-3" style={{ maxWidth: 460, margin: '0 auto' }}>
    <h1 className="mb-3 font-semibold">批量审核验收 · 仅模拟数据</h1>
    <label className="text-xs"><input type="checkbox" defaultChecked onChange={(event) => { confirmDeletion = event.target.checked; }} />模拟确认删除（取消勾选测试取消）</label>
    <p className="mb-3 text-xs">回复候选：{candidates}</p>
    <ExpressionReplyWeights imageCandidateCount={candidates} readiness={readiness} settings={{ ...settings, imageLibraryEnabled: enabled, imageLibraryMode: mode }} onChange={setSettings} onReview={() => setReviewRequest((v) => v + 1)} onRefresh={() => setRefreshRequest((v) => v + 1)} />
    <ExpressionLibraryManager enabled={enabled} selectedMode={mode} onSelectedModeChange={setMode} onEnabledChange={setEnabled} onImageCandidateCountChange={setCandidates} onReadinessChange={setReadiness} reviewRequest={reviewRequest} refreshRequest={refreshRequest} />
  </main>;
}
const root = createRoot(document.getElementById('root')!);
root.render(<Fixture />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
