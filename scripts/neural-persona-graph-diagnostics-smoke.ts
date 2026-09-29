import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  calculateNeuralPersonaGraphDiagnosticsSample,
  formatNeuralPersonaGraphDiagnostics,
} from '../src/components/settings/neuralPersonaGraphDiagnostics';

const sample = calculateNeuralPersonaGraphDiagnosticsSample({
  browserRafCount: 60,
  frameIntervals: [4, 8, 20],
  inputLatencies: [6, 10],
  longTaskCount: 1,
  longestTaskMs: 57,
  motionLagCount: 3,
  motionLagSum: 30,
  pointerCount: 144,
  renderCount: 120,
  renderDurationMs: 240,
  tickerStartCount: 0,
  tickerStopCount: 0,
  tickerUpdateCount: 0,
  workerCount: 60,
  workerIntervals: [8, 18],
}, 1_000);

assert.deepEqual(sample, {
  averageRenderMs: 2,
  browserRafHz: 60,
  frameIntervalP95Ms: 20,
  inputToFrameP95Ms: 10,
  longTaskCount: 1,
  longestTaskMs: 57,
  pointerHz: 144,
  renderFps: 120,
  tickerHz: 0,
  tickerStartCount: 0,
  tickerStopCount: 0,
  visualLagPx: 10,
  workerIntervalP95Ms: 18,
  workerHz: 60,
});
assert.match(formatNeuralPersonaGraphDiagnostics(sample), /120\.0 FPS/u);
assert.match(formatNeuralPersonaGraphDiagnostics(sample), /Visual lag 10\.0 px/u);
assert.match(formatNeuralPersonaGraphDiagnostics(sample, {
  bufferSize: '760x440', cssSize: '760x440', devicePixelRatio: 1.25,
  focused: true, gpuRenderer: 'ANGLE AMD Radeon', visibility: 'visible',
}), /GPU\s+ANGLE AMD Radeon[\s\S]*Canvas\s+760x440 -> 760x440[\s\S]*DPR 1\.25/u);

const canvas = fs.readFileSync(
  'src/components/settings/NeuralPersonaGraphPixiCanvas.tsx',
  'utf8',
);
const application = fs.readFileSync(
  'src/components/settings/neuralPersonaGraphPixiApplication.ts',
  'utf8',
);
const frameRate = fs.readFileSync(
  'src/components/settings/neuralPersonaGraphFrameRate.ts',
  'utf8',
);
const settingsPanel = fs.readFileSync('src/components/SettingsPanel.tsx', 'utf8');
const env = fs.readFileSync('.env.example', 'utf8');
assert.match(canvas, /data-neural-graph-diagnostics/u);
assert.match(canvas, /className="overflow-hidden bg-background"/u);
assert.match(application, /backgroundAlpha:\s*1/u);
assert.doesNotMatch(application, /backgroundAlpha:\s*0/u);
assert.match(application, /NEURAL_PERSONA_GRAPH_RENDER_RESOLUTION\s*=\s*2/u);
assert.doesNotMatch(application, /resolution:\s*window\.devicePixelRatio/u);
assert.match(frameRate, /NEURAL_PERSONA_GRAPH_PHYSICS_FPS\s*=\s*60/u);
assert.match(frameRate, /NEURAL_PERSONA_GRAPH_TARGET_FPS\s*=\s*60/u);
assert.doesNotMatch(settingsPanel, /bg-card\/95|backdrop-blur-(?:md|2xl)/u);
assert.match(env, /VITE_NEURAL_PERSONA_GRAPH_DIAGNOSTICS="false"/u);
console.log('neural persona graph diagnostics smoke ok');
