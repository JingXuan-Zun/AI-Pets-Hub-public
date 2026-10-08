const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const base = path.resolve(__dirname, '../electron');
const moved = ['normalizeErrorMessage', 'ensureDirectory', 'isPlainObject', 'writeBufferFileSafely', 'externalizeConfigImageDataUrls'];
const tree = text => ts.createSourceFile('config.cjs', text, 99, true);
const printer = ts.createPrinter();
const canonical = n => printer.printNode(ts.EmitHint.Unspecified, n, n.getSourceFile());
if (old) {
  const original = tree(old);
  const shared = tree(fs.readFileSync(path.join(base, 'persistedConfigFiles.cjs'), 'utf8'));
  for (const name of moved.slice(0, -1)) assert.equal(canonical(shared.statements.find(n => n.name?.text === name)), canonical(original.statements.find(n => n.name?.text === name)));
  const imports = n => ts.isVariableStatement(n) && n.getText().includes('require(');
  const retained = text => tree(text).statements.filter(n => !imports(n) && !moved.includes(n.name?.text)).map(canonical);
  assert.deepEqual(retained(fs.readFileSync(path.join(base, 'persistedConfigStore.cjs'), 'utf8')), retained(old));
}
const large = 'data:image/png;base64,' + Buffer.alloc(49152, 7).toString('base64');
const small = 'data:image/png;base64,YQ==';
function fixtures() {
  const full = { extra: { kept: true }, settings: { chatBackgroundImageUrl: large, chatUserAvatarUrl: large }, personality: { chatAvatarUrl: large }, companionPets: [null, { personality: { chatAvatarUrl: large }, other: 1 }], customModelPresets: [{ type: '2d', sequenceAssetFolder: '../bad:* ', sequenceFrames: [small, small, 'remote'], url: small }, { type: '3d', url: large }] };
  return [null, [], 'text', {}, full, { settings: [], personality: null, companionPets: [null, {}, { personality: [] }], customModelPresets: [null, {}, []] },
    { settings: { chatBackgroundImageUrl: small, chatUserAvatarUrl: 'remote' }, personality: { chatAvatarUrl: 'data:image/unknown;base64,' + 'A'.repeat(65536) } },
    { customModelPresets: [{ type: '2d', sequenceFrames: [], url: small }, { type: '2d', sequenceFrames: 'bad', url: large }] },
    { customModelPresets: [{ type: '2d', sequenceFrames: ['', null, small], url: small }, { type: '2d', sequenceFrames: ['remote'], url: small }] },
    { settings: { chatBackgroundImageUrl: large }, customModelPresets: [{ type: '2d', sequenceAssetFolder: '中文目录', sequenceFrames: [large, small] }] }];
}
function run(baseline, config, existing, failure, root) {
  const trace = [], files = new Set(); let failed = false;
  const compact = value => Buffer.isBuffer(value) ? ['buffer', value.length, crypto.createHash('sha256').update(value).digest('hex')] : typeof value === 'string' ? value.replace(`.${process.pid}.tmp`, '.PID.tmp') : value;
  function call(name, args) {
    trace.push([name, ...args.map(compact)]);
    if (failure === name && !failed) { failed = true; throw Object.assign(new Error(name + ' denied'), { code: 'EACCES' }); }
  }
  const fakeFs = {
    existsSync(p) { call('exists', [p]); return existing || files.has(p); },
    mkdirSync(...args) { call('mkdir', args); },
    writeFileSync(...args) { call('write', args); },
    copyFileSync(...args) { call('copy', args); files.add(args[1]); },
    rmSync(...args) { call('rm', args); },
  };
  const fixedPath = { ...path.win32, resolve(p) { call('resolve', [p]); return path.win32.resolve('C:\\fixture', p); } };
  const cache = new Map();
  function load(id) {
    if (id === 'fs') return fakeFs;
    if (id === 'path') return fixedPath;
    if (id === 'crypto') return crypto;
    const file = path.join(base, id);
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    new Function('require', 'module', fs.readFileSync(file, 'utf8'))(load, module);
    return module.exports;
  }
  let execute;
  if (baseline) {
    const declarations = tree(old).statements.filter(n => moved.includes(n.name?.text)).map(n => n.getText()).join('\n');
    const rules = load('./persistedConfigImageRules.cjs');
    execute = new Function('fs', 'path', 'crypto', ...Object.keys(rules), declarations + '\nreturn externalizeConfigImageDataUrls;')(fakeFs, fixedPath, crypto, ...Object.values(rules));
  } else execute = load('./persistedConfigImageAssets.cjs').externalizeConfigImageDataUrls;
  const before = JSON.stringify(config); let result, error;
  try { result = execute(config, 'C:\\assets', root); } catch (e) { error = e.message; }
  assert.equal(JSON.stringify(config), before, 'Input remains unchanged');
  if (result) {
    if (!config || typeof config !== 'object' || Array.isArray(config)) assert.equal(result.config, config);
    else {
      assert.notEqual(result.config, config);
      if (config.extra) assert.equal(result.config.extra, config.extra);
      if (config.customModelPresets?.at(-1)?.type === '3d') assert.equal(result.config.customModelPresets.at(-1), config.customModelPresets.at(-1));
    }
  }
  const following = execute({}, 'C:\\assets', root);
  assert.equal(following.migratedCount, 0);
  assert.equal(following.migratedBytes, 0);
  assert.deepEqual(following.errors, []);
  if (result) assert.notEqual(following.errors, result.errors);
  return { result, error, trace };
}
const hash = crypto.createHash('sha256'); let cases = 0;
for (const config of fixtures()) for (const existing of [false, true]) for (const failure of ['none', 'exists', 'mkdir', 'write', 'copy', 'rm', 'resolve']) for (const root of [undefined, 'C:\\sequences', '\\\\server\\share']) {
  const actual = run(false, config, existing, failure, root);
  if (old) assert.deepEqual(actual, run(true, config, existing, failure, root));
  hash.update(JSON.stringify(actual)); cases++;
}
const success = run(false, fixtures()[4], false, 'none');
assert.equal(success.result.migratedCount, 6);
assert.equal(success.trace.filter(row => row[0] === 'write').length, 3, 'Repeated profile bytes reuse a file; sequence prefixes remain distinct');
assert.equal(success.result.config.customModelPresets[0].url, success.result.config.customModelPresets[0].sequenceFrames[0]);
const failed = run(false, { settings: { chatBackgroundImageUrl: large, chatUserAvatarUrl: large } }, false, 'copy');
assert.equal(failed.result.config.settings.chatBackgroundImageUrl, large);
assert.equal(failed.result.errors[0].field, 'settings.chatBackgroundImageUrl');
assert.equal(failed.result.migratedCount, 1, 'Later fields continue after one failure');
const digest = hash.digest('hex');
if (!old) assert.equal(digest, '2470215aa627f4b08ccd6782484e63f152ff868450027108a6f1ed1210e2b34c');
console.log(`Persisted config image assets passed: ${cases} cases; ${digest}`);
