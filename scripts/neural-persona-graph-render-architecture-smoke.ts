import assert from 'node:assert/strict';
import fs from 'node:fs';

// The old Pixi/SVG neural graph canvas was removed; the settings section now opens the memory workspace.
const settingsSection = fs.readFileSync(
  'src/components/settings/SettingsNeuralPersonaGraphSection.tsx', 'utf8',
);
const editorMode = fs.readFileSync(
  'src/components/settings/useNeuralPersonaGraphFullscreen.ts', 'utf8',
);
const memoryWorkspace = fs.readFileSync('src/components/settings/memory-notes/NeuralMemoryWorkspace.tsx', 'utf8');
const settingsPanel = fs.readFileSync('src/components/SettingsPanel.tsx', 'utf8');
assert.match(settingsSection, /<NeuralMemoryWorkspace[\s\S]*open=\{display\.fullscreen\}/u);
assert.match(memoryWorkspace, /data-memory-workspace className="fixed inset-0/u);
// The workspace maximizes the window for real so dragging its header restores it.
assert.match(editorMode, /toggleMaximizeCurrentWindow/u);
assert.doesNotMatch(editorMode, /requestFullscreen/u);
assert.doesNotMatch(settingsPanel, /bg-card\/95|backdrop-blur-(?:md|2xl)/u);
console.log('neural persona graph render architecture smoke ok');
