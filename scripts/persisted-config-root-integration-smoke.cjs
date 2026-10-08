const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'persisted-config-root-'));
const base = path.resolve(__dirname, '../electron');
const cache = new Map(), trace = [], failures = new Set();
const controlledFs = new Proxy(fs, {
  get(target, name) {
    const value = target[name];
    if (typeof value !== 'function') return value;
    return (...args) => {
      trace.push([name, args[0], ...(['renameSync', 'copyFileSync'].includes(name) ? [args[1]] : [])]);
      if (name === 'renameSync' && failures.delete(args[1])) throw Object.assign(new Error('fixture primary rename denied'), { code: 'EACCES' });
      return Reflect.apply(value, target, args);
    };
  },
});
function load(id, parent = base) {
  if (id === 'fs' || id === 'node:fs') return controlledFs;
  if (!id.startsWith('.')) return require(id);
  const file = path.resolve(parent, id);
  assert.equal(path.dirname(file), base, 'Only known local production modules');
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  new Function('require', 'module', fs.readFileSync(file, 'utf8'))(dependency => load(dependency, path.dirname(file)), module);
  return module.exports;
}
function codec(label) {
  return {
    isEncryptionAvailable: () => true,
    encryptString: text => Buffer.from(label + ':' + text),
    decryptString(bytes) {
      const text = bytes.toString();
      assert.ok(text.startsWith(label + ':'), 'Each instance uses its own codec');
      return text.slice(label.length + 1);
    },
  };
}
function decodeAsset(url) {
  return path.normalize(decodeURIComponent(new URL(url).pathname).replace(/^\/(?=[a-z]:)/i, ''));
}
function snapshot(paths) {
  return [paths.primaryPath, paths.backupPath].map(file => fs.readFileSync(file, 'utf8'));
}
let cases = 0;
try {
  const production = load('./persistedConfigStore.cjs');
  assert.equal(cache.size, 9, 'Actual root loads its complete production graph');
  for (const source of ['primary', 'backup']) for (const fail of [false, true]) for (const includeModelSecrets of [false, true]) {
    const scenario = path.join(root, String(cases));
    const logA = [], logB = [];
    trace.length = 0;
    const first = production.createPersistedConfigStore({ userDataPath: path.join(scenario, 'a'), assetRootPath: path.join(scenario, 'models-a'), safeStorage: codec('a'), log: (...args) => logA.push(args) });
    const peer = production.createPersistedConfigStore({ userDataPath: path.join(scenario, 'b'), assetRootPath: path.join(scenario, 'models-b'), safeStorage: codec('b'), log: (...args) => logB.push(args) });
    assert.deepEqual(trace, [], 'Construction does not perform IO');
    const paths = first.getPaths(), peerPaths = peer.getPaths();
    assert.equal(peer.save({ name: 'peer', settings: { customApiKey: 'fixture-peer' } }).ok, true);
    const peerBefore = snapshot(peerPaths), peerLogCount = logB.length;
    const image = 'data:image/png;base64,' + Buffer.alloc(49152, 7).toString('base64');
    const legacy = { name: 'first', settings: { customApiKey: 'fixture-first', chatBackgroundImageUrl: image }, customModelPresets: [{ type: '2d', sequenceAssetFolder: 'frames', sequenceFrames: ['data:image/png;base64,YQ=='] }] };
    fs.mkdirSync(paths.storeDir, { recursive: true });
    const text = JSON.stringify({ config: legacy });
    fs.writeFileSync(paths.primaryPath, source === 'primary' ? text : '{invalid');
    fs.writeFileSync(paths.backupPath, text);
    if (fail) failures.add(paths.primaryPath);
    trace.length = 0;
    const initial = first.load({ includeModelSecrets });
    assert.deepEqual(snapshot(peerPaths), peerBefore, 'Migration and repair leave peer files unchanged');
    assert.equal(logB.length, peerLogCount, 'Each instance keeps its logger');
    assert.ok(trace.length > 0);
    for (const row of trace) {
      for (const file of row.slice(1)) assert.ok(file.startsWith(paths.storeDir + path.sep) || file === paths.storeDir || file.startsWith(path.join(scenario, 'models-a') + path.sep), 'All production IO belongs to the selected instance');
    }
    if (fail && source === 'primary') {
      assert.equal(initial.ok, false);
      assert.equal(initial.source, 'credential-error');
    } else {
      assert.equal(initial.ok, true);
      assert.equal(initial.source, source + '-file');
      if (source === 'backup') {
        assert.equal(initial.repairedPrimary, !fail);
        assert.equal(initial.repairError, fail ? 'fixture primary rename denied' : null);
      }
    }
    assert.equal(failures.size, 0, 'One injected failure is consumed');
    const loaded = first.load({ includeModelSecrets });
    assert.equal(loaded.ok, true, 'Later load recovers after a failed save');
    assert.equal(loaded.config.name, 'first');
    assert.equal(loaded.config.settings.customApiKey, includeModelSecrets ? 'fixture-first' : 'desktop-pet-credential:customApiKey');
    const background = decodeAsset(loaded.config.settings.chatBackgroundImageUrl);
    const frame = decodeAsset(loaded.config.customModelPresets[0].sequenceFrames[0]);
    assert.equal(path.dirname(background), paths.assetDir);
    assert.equal(path.dirname(frame), path.join(paths.sequenceAssetDir, 'frames'));
    assert.equal(fs.readFileSync(background).length, 49152);
    assert.equal(fs.readFileSync(frame).toString(), 'a');
    assert.equal(loaded.config.customModelPresets[0].url, loaded.config.customModelPresets[0].sequenceFrames[0]);
    const repeated = first.load({ includeModelSecrets });
    assert.equal(repeated.migratedAssetCount, 0, 'Repeated load is already compacted');
    for (const value of snapshot(paths)) {
      assert.ok(!value.includes('fixture-first'), 'Both files protect the synthetic credential');
      assert.equal(typeof JSON.parse(value).config.settings.customApiKey, 'object');
    }
    assert.equal(peer.load({ includeModelSecrets: true }).config.settings.customApiKey, 'fixture-peer');
    assert.deepEqual(snapshot(peerPaths), peerBefore);
    assert.ok(logA.some(row => row[0] === 'persisted config image assets migrated'));
    cases++;
  }
  console.log(`Persisted config root integration passed: ${cases} actual-root dual-instance primary/backup/rename-failure/credential-projection cases; ${cache.size} production modules.`);
} finally {
  const resolved = path.resolve(root);
  assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()));
  assert.ok(path.basename(resolved).startsWith('persisted-config-root-'));
  fs.rmSync(resolved, { recursive: true, force: true });
}
