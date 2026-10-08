import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  fitNeuralGraphStage,
  neuralGraphScreenToStage,
  neuralGraphSegmentBoundsVisible,
  neuralGraphVisibleStageBounds,
  neuralGraphVisibleWorldBounds,
} from '../src/components/settings/neuralPersonaGraphPixiViewport';

const wide = fitNeuralGraphStage(1000, 440);
assert.deepEqual(wide, { scale: 1, x: 120, y: 0 });
assert.deepEqual(neuralGraphScreenToStage({ x: 500, y: 220 }, wide), { x: 380, y: 220 });
assert.deepEqual(neuralGraphVisibleStageBounds(1000, 600), {
  bottom: 520, left: -120, right: 880, top: -80,
});
const narrow = fitNeuralGraphStage(380, 440);
assert.deepEqual(narrow, { scale: 0.5, x: 0, y: 110 });
const bounds = neuralGraphVisibleWorldBounds({ scale: 1, x: 0, y: 0 }, 0);
assert.deepEqual(bounds, { bottom: 440, left: 0, right: 760, top: 0 });
assert.equal(neuralGraphSegmentBoundsVisible(
  { x: -20, y: 220 }, { x: 780, y: 220 }, bounds,
), true);

const runtime = fs.readFileSync('src/components/settings/neuralPersonaGraphPixiRuntime.ts', 'utf8');
const interactions = fs.readFileSync(
  'src/components/settings/neuralPersonaGraphPixiInteractions.ts', 'utf8',
);
const canvas = fs.readFileSync('src/components/settings/NeuralPersonaGraphPixiCanvas.tsx', 'utf8');
const scene = [
  'src/components/settings/neuralPersonaGraphPixiScene.ts',
  'src/components/settings/neuralPersonaGraphPixiSceneRendering.ts',
].map((file) => fs.readFileSync(file, 'utf8')).join('\n');
const svgCanvas = fs.readFileSync('src/components/settings/NeuralPersonaGraphSvgCanvas.tsx', 'utf8');
const svgController = fs.readFileSync(
  'src/components/settings/useNeuralPersonaGraphCanvasController.ts', 'utf8',
);
const workerClient = fs.readFileSync('src/components/settings/neuralPersonaGraphWorkerPhysics.ts', 'utf8');
const worker = fs.readFileSync('src/components/settings/neuralPersonaGraphPhysics.worker.ts', 'utf8');
const usePixiCanvas = fs.readFileSync(
  'src/components/settings/useNeuralPersonaGraphPixiCanvas.ts', 'utf8',
);
const application = fs.readFileSync(
  'src/components/settings/neuralPersonaGraphPixiApplication.ts', 'utf8',
);
const toolbar = fs.readFileSync(
  'src/components/settings/NeuralPersonaGraphCanvasToolbar.tsx', 'utf8',
);
const settingsSection = fs.readFileSync(
  'src/components/settings/SettingsNeuralPersonaGraphSection.tsx', 'utf8',
);
const editorMode = fs.readFileSync(
  'src/components/settings/useNeuralPersonaGraphFullscreen.ts', 'utf8',
);
assert.doesNotMatch(runtime, /stage\.scale\.set\(width \/ GRAPH_WIDTH, 1\)/u);
assert.match(workerClient, /new Worker\(new URL/u);
assert.match(workerClient, /Float32Array/u);
assert.match(workerClient, /config: options\.config/u);
assert.match(worker, /NEURAL_PERSONA_GRAPH_PHYSICS_FRAME_MS/u);
assert.match(worker, /command\.config/u);
assert.match(worker, /update-config/u);
assert.match(workerClient, /setConfig/u);
assert.match(runtime, /setPhysicsConfig/u);
assert.match(scene, /updateDisplayPositions/u);
assert.match(scene, /setDraggedNode/u);
assert.match(runtime, /scene\.isAnimating\(\)/u);
assert.match(interactions, /hoveredNodeId/u);
assert.match(interactions, /runtime\.callbacks\.onSelectNode\(nodeId\)/u);
assert.match(svgCanvas, /onPointerEnter/u);
assert.doesNotMatch(usePixiCanvas, /JSON\.stringify\(options\.physicsConfig\)/u);
assert.doesNotMatch(worker, /setTimeout\(tick, 1000 \/ 60\)/u);
assert.match(application, /maxFPS = NEURAL_PERSONA_GRAPH_TARGET_FPS/u);
assert.doesNotMatch(canvas, /h-\[440px\]/u);
assert.match(toolbar, /编辑节点/u);
assert.match(toolbar, /NeuralPersonaGraphPhysicsSettings/u);
const memoryWorkspace = fs.readFileSync('src/components/settings/memory-notes/NeuralMemoryWorkspace.tsx', 'utf8');
assert.match(settingsSection, /<NeuralMemoryWorkspace[\s\S]*open=\{display\.fullscreen\}/u);
assert.match(memoryWorkspace, /data-memory-workspace className="fixed inset-0/u);
// The workspace maximizes the window for real so dragging its header restores it.
assert.match(editorMode, /toggleMaximizeCurrentWindow/u);
assert.doesNotMatch(editorMode, /requestFullscreen/u);
assert.doesNotMatch(runtime, /clampNeuralPersonaGraphWorldPoint/u);
assert.doesNotMatch(svgController, /clampNeuralPersonaGraphWorldPoint/u);
console.log('neural persona graph render architecture smoke ok');
