import assert from 'node:assert/strict';
import { readProjectFile } from './smokeTestHarness.ts';

const source = readProjectFile('src/rendererEventLoopDiagnostics.ts');
const mainSource = readProjectFile('src/main.tsx');

assert.match(source, /EVENT_LOOP_SAMPLE_INTERVAL_MS = 250/u);
assert.match(source, /EVENT_LOOP_REPORT_THRESHOLD_MS = 100/u);
assert.match(source, /LONG_TASK_REPORT_THRESHOLD_MS = 80/u);
assert.match(source, /window\.setInterval\(sample, EVENT_LOOP_SAMPLE_INTERVAL_MS\)/u);
assert.match(source, /new PerformanceObserver/u);
assert.match(source, /type: 'longtask'/u);
assert.match(source, /REPORT_COOLDOWN_MS/u);
assert.match(source, /document\.visibilityState !== 'visible'/u);
assert.match(source, /contextScope: context\?\.scope/u);
assert.match(source, /export function markRendererDiagnosticContext/u);
assert.match(mainSource, /installRendererEventLoopDiagnostics\(\)/u);

console.log('renderer event loop diagnostics smoke ok');
