import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { readModuleProjectFile, readModuleProjectFunction } from './projectModuleSource.mjs';

const require = createRequire(import.meta.url);
const actualFactory = require('../electron/windowManager/windowIconResolver.cjs').createWindowIconResolver;
export function exerciseWindowManagerIcons(factory = actualFactory) {
  const outputs: unknown[] = [];
  for (const phase of ['window', 'tray']) for (let mask = 0; mask < 16; mask++) for (const exeAvailable of [false, true]) {
    for (const invalidate of [false, true]) outputs.push(exercise(phase, mask, exeAvailable, invalidate));
  }
  for (const [phase, failure] of [['window', 'resources'], ['window', 'create'], ['window', 'empty'],
    ['tray', 'exec'], ['tray', 'create'], ['tray', 'empty'], ['tray', 'resize'], ['tray', 'blank']]) {
    outputs.push(exercise(phase, failure === 'blank' ? 0 : 1, failure !== 'blank', false, failure));
  }
  return outputs;

  function exercise(phase: string, mask: number, exeAvailable: boolean, invalidate: boolean, failure?: string) {
    const calls: unknown[][] = []; const results: unknown[] = []; const error = new Error('icon dependency failure');
    const step = (name: string, value: unknown = null) => {calls.push([name, value]); if (failure === name) throw error;};
    const baseDirectory = path.resolve('fixture', 'project', 'electron');
    let resources = path.resolve('fixture', 'package', 'resources'); let executable = path.resolve('fixture', 'app.exe');
    let candidates: string[] = []; let attempts = new Map<string, number>();
    const resized = {marker: 'same resized image'}, blank = {marker: 'same blank image'};
    const processRef = {get resourcesPath() {step('resources', resources); return resources;}, get execPath() {step('exec', executable); return executable;}};
    const nativeImage = {
      createFromPath: (file: string) => {
        step('create', file); const count = (attempts.get(file) ?? 0) + 1; attempts.set(file, count);
        const index = candidates.indexOf(file); const available = index >= 0 ? Boolean(mask & (1 << index)) && !(invalidate && count > 1) : file === executable && exeAvailable;
        // Changing process paths here must not change candidates already constructed by this invocation.
        if (invalidate) resources = path.resolve('fixture', 'changed-during-read');
        return {isEmpty: () => {step('empty', !available); return !available;}, resize: (size: unknown) => {
          assert.deepEqual(size, {width: 16, height: 16}); step('resize', file); return resized;
        }};
      },
      createEmpty: () => {step('blank'); return blank;},
    };
    const api = factory({nativeImage, path, processRef, baseDirectory}); assert.deepEqual(calls, [], 'creating the resolver is lazy');
    assert.deepEqual(Object.keys(api).sort(), ['getBrowserWindowIconOptions', 'resolveTrayIcon']);
    for (let round = 0; round < (failure ? 1 : 2); round++) {
      resources = path.resolve('fixture', 'package' + round, 'resources'); executable = path.resolve('fixture', 'app' + round + '.exe'); attempts = new Map();
      candidates = [path.join(resources, 'icon.ico'), path.join(resources, 'icon.png'), path.join(baseDirectory, '..', 'build', 'icon.ico'), path.join(baseDirectory, '..', 'build', 'icon.png')];
      const found = candidates.find((_, index) => Boolean(mask & (1 << index)));
      const start = calls.length;
      try {
        const returned = phase === 'window' ? api.getBrowserWindowIconOptions() : api.resolveTrayIcon(); assert.ok(!failure);
        if (phase === 'window') {assert.deepEqual(returned, found ? {icon: found} : {}); results.push(returned);}
        else {assert.equal(returned, (found && !invalidate) || exeAvailable ? resized : blank); results.push(returned.marker);}
        const queried = calls.slice(start).filter(([name]) => name === 'create').map(([, file]) => file);
        const initialQueries = found ? candidates.slice(0, candidates.indexOf(found) + 1) : candidates;
        assert.deepEqual(queried, [...initialQueries, ...(phase === 'tray' ? [...(found ? [found] : []), ...(!found || invalidate ? [executable] : [])] : [])]);
        assert.equal(calls.slice(start).filter(([name]) => name === 'resources').length, 2);
        assert.equal(calls.slice(start).filter(([name]) => name === 'exec').length, phase === 'tray' ? 1 : 0);
      } catch (caught) {assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); results.push('original error');}
    }
    return JSON.parse(JSON.stringify({phase, mask, exeAvailable, invalidate, failure, calls, results}));
  }
}
const manager = readModuleProjectFunction('electron/windowManager/windowResourceResolvers.cjs', 'createWindowResourceResolvers');
assert.match(manager, /createWindowIconResolver\(\{\s*nativeImage, path, processRef, baseDirectory,/u);
assert.equal((readModuleProjectFile('electron/windowManager.cjs').match(/\.\.\.getBrowserWindowIconOptions\(\)/gu) ?? []).length, 3);
assert.match(readModuleProjectFile('electron/windowManager/windowManagerActions.cjs'), /managerState\.tray = new Tray\(resolveTrayIcon\(\)\)/u);
assert.equal(exerciseWindowManagerIcons().length, 136);
console.log('Window manager icons smoke passed (128 cases with two calls; 8 errors; original base directory/lazy live paths/ordered fallback/image identity).');
