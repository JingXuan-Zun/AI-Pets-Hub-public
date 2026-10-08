const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const names = ['createCategory','deleteCategory','getPreview','getReplyCatalog','getState','importClassifiedRoot','importImages','moveAssets','removeAssets','resolveCategoryDirectory','selectLibraryMode','setAssetStatus','setLibrary','updateCategory','undoBatchOperation'];
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function run(gateStage, outcome) {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'expression-root-queue-'));
  try {
    const firstPath = path.join(directory, 'first', 'expression-library.json');
    const gate = deferred(), started = deferred(), cache = new Map(), trace = [];
    let enabled = false, blocked = false, injected = false;
    const promises = { ...fs.promises };
    for (const method of ['readFile', 'writeFile', 'mkdir', 'rename']) promises[method] = async (...args) => {
      const target = String(args[0]); trace.push([method, target]);
      if (enabled && !blocked && method === gateStage && target.startsWith(firstPath)) {
        blocked = true; started.resolve(); await gate.promise;
      }
      if (enabled && outcome === 'file-error' && !injected && method === 'writeFile' && target.startsWith(firstPath) && /"name"\s*:\s*"Queued"/.test(String(args[1]))) {
        injected = true; const error = Error('fixture write failure'); error.code = 'EACCES'; throw error;
      }
      return fs.promises[method](...args);
    };
    function load(file) {
      if (cache.has(file)) return cache.get(file).exports;
      const module = { exports: {} }; cache.set(file, module);
      const source = fs.readFileSync(file, 'utf8');
      new Function('require', 'module', 'exports', '__filename', '__dirname', source)(id => {
        if (id === 'fs') return { ...fs, promises };
        if (id === 'fs/promises') return promises;
        if (id.startsWith('./')) return load(path.resolve(path.dirname(file), id));
        return require(id);
      }, module, module.exports, file, path.dirname(file));
      return module.exports;
    }
    const { createExpressionLibraryService } = load(require.resolve('../electron/expressionLibraryService.cjs'));
    const first = createExpressionLibraryService({ userDataPath: path.join(directory, 'first'), managedRootPath: path.join(directory, 'first-managed') });
    const peer = createExpressionLibraryService({ userDataPath: path.join(directory, 'peer'), managedRootPath: path.join(directory, 'peer-managed') });
    assert.deepEqual(Object.keys(first), names);
    await first.getState({ rescan: true }); await peer.getState({ rescan: true });
    trace.length = 0; enabled = true;
    const settled = [];
    function observe(promise, index) { return promise.then(value => { settled[index] = { value }; return value; }, error => { settled[index] = { error }; return undefined; }); }
    const initial = observe(first.getState({ rescan: gateStage === 'writeFile' }), 0);
    // If queue wiring fails, detect it without leaving this test silently pending.
    await Promise.race([started.promise, initial.then(() => { if (!blocked) throw Error('Expected IO gate was not reached'); })]);
    const queued = observe(outcome === 'validation-error' ? first.createCategory({ name: 'CON' })
      : outcome === 'batch-error' ? first.setAssetStatus({ status: 'accepted', assetIds: [] })
      : first.createCategory({ name: 'Queued', description: 'queued operation' }), 1);
    const trailing = observe(first.getReplyCatalog(), 2);
    await peer.createCategory({ name: 'Peer', description: 'independent queue' });
    const peerState = await peer.getState();
    assert.ok(peerState.state.categories.some(c => c.name === 'Peer'));
    assert.equal(settled[0], undefined); assert.equal(settled[1], undefined); assert.equal(settled[2], undefined);
    assert.equal(trace.filter(row => row[0] === 'readFile' && row[1] === firstPath).length, 1, 'Same-instance actions cannot start a second index read while first is blocked');
    gate.resolve(); await Promise.all([initial, queued, trailing]);
    assert.ok(settled[0].value); assert.ok(settled[2].value, 'Trailing catalog proceeds after failure');
    if (outcome === 'success') assert.ok(settled[1].value);
    else { assert.ok(settled[1].error); assert.match(settled[1].error.message, outcome === 'validation-error' ? /Windows 保留/ : outcome === 'batch-error' ? /1 至 1000/ : /fixture write failure/); }
    assert.equal(injected, outcome === 'file-error');
    const finalFirst = await first.getState(), finalPeer = await peer.getState();
    assert.ok(!finalFirst.state.categories.some(c => c.name === 'Peer'));
    assert.ok(!finalPeer.state.categories.some(c => c.name === 'Queued'));
    assert.equal(finalFirst.state.library.rootPath, path.join(directory, 'first-managed'));
    assert.equal(finalPeer.state.library.rootPath, path.join(directory, 'peer-managed'));
    assert.equal(finalFirst.state.categories.some(c => c.name === 'Queued'), outcome === 'success' || outcome === 'file-error', 'Trailing scan reconciles directory left by failed save');
    assert.equal(cache.size, 19, 'Execute complete production dependency graph');
    assert.ok([...cache.keys()].every(file => path.basename(file).startsWith('expressionLibrary')));
    const persistedPeer = JSON.parse(await fs.promises.readFile(path.join(directory, 'peer', 'expression-library.json'), 'utf8'));
    assert.ok(persistedPeer.categories.some(c => c.name === 'Peer'));
    return trace.length;
  } finally {
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('expression-root-queue-'));
    await fs.promises.rm(resolved, { recursive: true, force: true });
  }
}
async function main() {
  let cases = 0;
  for (const stage of ['readFile', 'writeFile']) for (const outcome of ['success', 'validation-error', 'batch-error', 'file-error']) { await run(stage, outcome); cases++; }
  console.log('Expression root queue integration passed: ' + cases + ' gated read/write sequences; two real services and all 19 modules, independent paths, serial cross-actions and error recovery; isolated temporary files.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
