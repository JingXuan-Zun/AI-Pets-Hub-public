import { resolveUnsupportedLive2DMotionImportReason } from '../src/pet-runtime/live2d/live2dModelSupport';
import {
  resolveLive2DMotionAssetsFromDirectoryEntries,
} from '../src/pet-runtime/live2d/live2dExpressionDiscovery';

const modelUrl = 'D:/Unity 6_3/zc/ai-desktop-pet/public/models-3d/live2d/薇薇�?薇薇�?model3.json';
const entries = [
  { kind: 'file', name: 'Scene1.motion3.json', path: 'D:/Unity 6_3/zc/ai-desktop-pet/public/models-3d/live2d/薇薇�?Scene1.motion3.json' },
  { kind: 'file', name: '神秘动画.can3', path: 'D:/Unity 6_3/zc/ai-desktop-pet/public/models-3d/live2d/薇薇�?神秘动画.can3' },
];

const motions = resolveLive2DMotionAssetsFromDirectoryEntries(entries, modelUrl);
if (motions.length !== 1 || motions[0]?.name !== 'Scene1') {
  throw new Error(`Expected to discover Scene1.motion3.json, got ${JSON.stringify(motions)}`);
}

const can3Reason = resolveUnsupportedLive2DMotionImportReason('神秘动画.can3');
if (!can3Reason?.includes('.can3') || !can3Reason.includes('.motion3.json')) {
  throw new Error(`Expected .can3 export guidance, got ${can3Reason ?? 'null'}`);
}

console.log('live2d motion discovery smoke passed');
