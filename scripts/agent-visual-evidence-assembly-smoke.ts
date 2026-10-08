import assert from 'node:assert/strict';
import { createVisualSnapshotStructuredEvidence as assemble } from '../src/agent/visual/visualSnapshotStructuredEvidence';
import type { AgentCaptureQualityAnalysis } from '../src/agent/agentCaptureQuality';

const source: DesktopPetCaptureSourceLike = {
  id: 'window:fixture', type: 'window', name: '启动器', width: 800, height: 600,
  bounds: { x: 200, y: 100, width: 800, height: 600 },
};
const metrics = {
  dominantColorRatio: 1, entropy: 0, height: 600, lumaStdDev: 0, meanLuma: 0,
  nearBlackRatio: 1, sampledPixelCount: 100, uniqueColorBucketCount: 1, width: 800,
};
const quality: AgentCaptureQualityAnalysis = {
  metrics, reason: 'black frame', status: 'capture_black_frame', trusted: false,
};
const plain = assemble('ordinary description', 'desktop');
assert.equal(plain.structuredEvidence, null);
assert.equal(plain.responseText, 'ordinary description');
assert.deepEqual(plain.evidenceLines, ['Visual summary: ordinary description']);

const low = assemble(JSON.stringify({ summary: '页面模糊', confidence: 0.2 }), 'desktop', source);
assert.equal(low.structuredEvidence?.confidence, 'low');
assert.equal(low.structuredEvidence?.status, 'unverified');
assert.ok(low.missingEvidence.length);

const unreadable = assemble(JSON.stringify({ summary: '启动器', confidence: 0.95 }), 'desktop', source, [source], '', {
  quality, fallbackLine: '屏幕裁剪回退', selectedSource: source,
});
assert.equal(unreadable.structuredEvidence?.captureTrusted, false);
assert.equal(unreadable.structuredEvidence?.visualReadable, false);
assert.equal(unreadable.structuredEvidence?.desktopTargetPresence, 'present_unreadable');
assert.equal(unreadable.structuredEvidence?.status, 'unverified');
assert.equal(unreadable.structuredEvidence?.captureFallback?.fromSourceId, source.id);
assert.equal(unreadable.structuredEvidence?.captureFallback?.toSourceId, source.id);
assert.deepEqual(unreadable.structuredEvidence?.captureQuality, metrics);

const login = assemble(JSON.stringify({ summary: '需要登录', confidence: 0.95, postActionState: 'login-required', primaryAction: '登录' }), 'desktop', source);
assert.equal(login.structuredEvidence?.status, 'unverified');
assert.equal(login.structuredEvidence?.interactionReady, false);
assert.ok(login.recommendedRecovery.length);

const game = assemble(JSON.stringify({ summary: '游戏画面', confidence: 0.9, companionCue: '等待观察' }), 'game', source);
assert.equal(game.summaryText, '游戏画面');
assert.equal(game.companionCue, '等待观察');
assert.ok(game.evidenceLines.some(line => line.includes('游戏画面')));
console.log('visual evidence assembly smoke: PASS (fallback, low confidence, capture trust, recovery, game projection)');
