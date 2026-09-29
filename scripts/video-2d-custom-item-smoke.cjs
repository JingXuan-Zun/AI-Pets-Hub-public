const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const esbuild = require('esbuild');

const filename = path.join(__dirname, '..', 'src', 'foodAppearances.ts');
const bundle = esbuild.buildSync({
  entryPoints: [filename], bundle: true, platform: 'node', format: 'cjs', write: false,
  loader: { '.svg': 'text' },
});
const testModule = new Module(filename, module);
testModule.filename = filename;
testModule.paths = module.paths;
testModule._compile(bundle.outputFiles[0].text, filename);
const { normalizeFoodAppearances, resolveFoodInteractionType } = testModule.exports;

const appearances = normalizeFoodAppearances([{
  id: 'pat', name: '小手', imageUrl: 'data:image/png;base64,AA==',
  interactionType: 'custom', interactionLabel: '抚摸',
}]);
assert.equal(appearances[0].interactionType, 'custom');
assert.equal(appearances[0].interactionLabel, '抚摸');
const folder = { id: 'pat-item', name: '小手', position: { x: 0, y: 0 }, appearanceId: 'pat' };
assert.equal(resolveFoodInteractionType(folder, appearances), 'custom');
assert.equal(resolveFoodInteractionType({ ...folder, interactionType: 'toy' }, appearances), 'custom');
assert.equal(resolveFoodInteractionType(folder, normalizeFoodAppearances([{
  id: 'pat', name: '小手', imageUrl: 'data:image/png;base64,AA==', interactionType: 'toy',
}])), 'toy');
const effectsFilename = path.join(__dirname, '..', 'src', 'pet-runtime', 'core', 'petItemInteractionEffects.ts');
const effectsBundle = esbuild.buildSync({
  entryPoints: [effectsFilename], bundle: true, platform: 'node', format: 'cjs', write: false,
});
const effectsModule = new Module(effectsFilename, module);
effectsModule.filename = effectsFilename;
effectsModule.paths = module.paths;
effectsModule._compile(effectsBundle.outputFiles[0].text, effectsFilename);
const { resolvePetItemInteractionEffects } = effectsModule.exports;
const stats = { affection: 20, hunger: 60, fatigue: 40 };
const customEffects = resolvePetItemInteractionEffects([folder], stats, folder, 'custom', { x: 10, y: 20 });
assert.deepEqual(customEffects.stats, stats);
assert.deepEqual(customEffects.folders, [{ ...folder, position: { x: 10, y: 20 } }]);
const deliveredVideoEffects = resolvePetItemInteractionEffects([folder], stats, folder, 'custom', undefined, true);
assert.equal(deliveredVideoEffects.folders.length, 0);
assert.deepEqual(deliveredVideoEffects.stats, stats);
assert.equal(resolvePetItemInteractionEffects([folder], stats, folder, 'eat').folders.length, 0);
assert.equal(resolvePetItemInteractionEffects([folder], stats, folder, 'toy').stats.affection, 25);
console.log('2D 视频自定义动作配置与路由通过');
