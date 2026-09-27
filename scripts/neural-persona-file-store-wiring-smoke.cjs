const assert = require('node:assert/strict');
const fs = require('node:fs');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

const main = read('electron/main.cjs');
const ipc = read('electron/ipcHandlers.cjs');
const preload = read('electron/preload.cjs');
const types = read('src/vite-env.d.ts');
const adapter = read('src/character-graph/neural-persona/neuralPersonaDesktopStorage.ts');
const packageJson = JSON.parse(read('package.json'));

assert.match(main, /createNeuralPersonaFileStore/u);
assert.match(main, /neuralPersonaFileStore,/u);
assert.match(ipc, /desktop-pet:read-neural-persona-record/u);
assert.match(ipc, /desktop-pet:compare-and-swap-neural-persona-record/u);
assert.match(preload, /readNeuralPersonaRecord/u);
assert.match(preload, /compareAndSwapNeuralPersonaRecord/u);
assert.match(types, /readNeuralPersonaRecord\?:/u);
assert.match(types, /compareAndSwapNeuralPersonaRecord\?:/u);
assert.match(adapter, /NeuralPersonaAtomicStorage/u);
assert.ok(packageJson.build.files.includes('electron/**/*'));

console.log('neural persona file store wiring smoke ok');
