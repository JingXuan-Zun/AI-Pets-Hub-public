const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeReferenceTextUtils.cjs');
const { createLocalVoiceRuntimeReferenceTextUtils } = require(modulePath);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
function original(context) {
  const module = { exports: {} };
  new Function('module', 'exports', baseline)(module, module.exports);
  return module.exports.createLocalVoiceRuntimeReferenceTextUtils(context);
}
async function scenario(config, useOriginal = false) {
  const trace = [], calls = new Map(), map = new Map(), failure = new Error('reference preparation failure');
  const configured = { referenceText: config.configured, source: 'configured' };
  function call(name, args, run) {
    trace.push([name, ...args]); const count = (calls.get(name) || 0) + 1; calls.set(name, count);
    if (name === config.fail && count === config.at) throw failure;
    return run();
  }
  let memory = config.memory;
  if (config.coercion) memory = { toString: () => call('coerce', [], () => ' converted ') };
  map.set('key', memory);
  const context = {
    getConfiguredReferenceText: (...args) => call('configured', args, () => configured),
    buildReferenceTextCacheKey: (...args) => call('key', args, () => config.noKey ? null : 'key'),
    referenceTextCache: {
      get: key => call('get', [key], () => map.get(key)),
      set: (key, value) => call('set', [key, value], () => map.set(key, value)),
    },
    readPersistedReferenceText: key => call('read', [key], () => config.persisted),
    persistReferenceText: () => { throw new Error('must not persist reference text'); },
    writeRuntimeLog: (...args) => call('log', args, () => undefined),
  };
  const api = useOriginal ? original(context) : createLocalVoiceRuntimeReferenceTextUtils(context);
  assert.equal(trace.length, 0, 'creation must not resolve text or access cache');
  const input = { assetSelection: config.assets === 0 ? null : {
    referenceAudioPath: config.assets & 1 ? 'audio.wav' : '', sttModel: config.assets & 2 ? { path: 'model' } : null,
  }, settings: config.noSettings ? undefined : { speechRecognitionLang: 'en' }, purpose: config.purpose,
    requestId: 'request', signal: AbortSignal.abort(),
    runRunnerCommand: () => { throw new Error('must not auto-transcribe'); } };
  let promise, synchronousError = false;
  try { promise = api.ensureReferenceTextPrepared(input); } catch { synchronousError = true; }
  assert.equal(synchronousError, false, 'dependency failures remain async rejections');
  assert.ok(promise instanceof Promise);
  const immediateTrace = trace.slice();
  let result, error;
  try { result = await promise; } catch (e) { error = e === failure ? 'original-error' : e.message; }
  assert.deepEqual(trace, immediateTrace, 'do not introduce an await before cache lookup or promotion');
  return JSON.parse(JSON.stringify({ result, error, trace, configuredIdentity: result === configured,
    memory: [...map].map(([key, value]) => [key, typeof value === 'object' ? '<object>' : value]) }));
}
async function compare(config) {
  const actual = await scenario(config);
  if (baseline) assert.deepEqual(actual, await scenario(config, true), JSON.stringify(config));
  if (actual.error !== undefined) assert.equal(actual.error, 'original-error');
  return actual;
}
async function main() {
  let count = 0;
  for (const configured of ['', 'preset']) for (const assets of [0, 1, 2, 3]) for (const noKey of [true, false]) {
    for (const memory of [undefined, '', '  ', ' cached ', 42]) for (const persisted of ['', 'persistent']) {
      await compare({ configured, assets, noKey, memory, persisted }); count++;
    }
  }
  for (const memory of ['', 'cached']) for (const persisted of ['', 'persistent']) {
    for (const fail of ['configured', 'key', 'get', 'read', 'set', 'log', 'coerce']) for (const at of [1, 2]) {
      await compare({ configured: '', assets: 3, memory, persisted, fail, at, coercion: fail === 'coerce' }); count++;
    }
  }
  const configured = await compare({ configured: 'preset', assets: 0 });
  assert.equal(configured.configuredIdentity, true);
  assert.deepEqual(configured.trace.map(t => t[0]), ['configured']);
  const memory = await compare({ configured: '', assets: 3, memory: ' cached ', persisted: 'persistent' });
  assert.equal(memory.result.source, 'cache'); assert.equal(memory.result.referenceText, 'cached');
  assert.equal(memory.trace.some(t => t[0] === 'read' || t[0] === 'set'), false);
  const persisted = await compare({ configured: '', assets: 3, memory: '', persisted: 'persistent', purpose: 'warmup', noSettings: true });
  assert.deepEqual(persisted.trace.map(t => t[0]), ['configured', 'key', 'get', 'read', 'set', 'log']);
  assert.equal(persisted.trace.find(t => t[0] === 'key')[3], 'zh-CN');
  assert.equal(persisted.result.source, 'persistent-cache');
  const missing = await compare({ configured: '', assets: 3, memory: '', persisted: '' });
  assert.equal(missing.configuredIdentity, true);
  assert.equal(missing.trace.at(-1)[2].purpose, 'synthesize');
  const nullKey = await compare({ configured: '', assets: 3, noKey: true, persisted: 'persistent' });
  assert.equal(nullKey.trace.some(t => t[0] === 'get' || t[0] === 'set'), false);
  const maps = [new Map(), new Map()]; let reads = 0;
  const apis = maps.map((referenceTextCache, i) => createLocalVoiceRuntimeReferenceTextUtils({ referenceTextCache,
    getConfiguredReferenceText: () => ({ referenceText: '', source: 'none' }), buildReferenceTextCacheKey: () => 'same',
    readPersistedReferenceText: () => { reads++; return 'instance-' + i; }, writeRuntimeLog() {},
    persistReferenceText() { throw new Error('unexpected persist'); } }));
  const input = { assetSelection: { referenceAudioPath: 'audio', sttModel: { path: 'model' } }, settings: {},
    runRunnerCommand() { throw new Error('unexpected runner'); } };
  const results = await Promise.all([apis[0].ensureReferenceTextPrepared(input), apis[0].ensureReferenceTextPrepared(input), apis[1].ensureReferenceTextPrepared(input)]);
  assert.deepEqual(results.map(r => r.source), ['persistent-cache', 'cache', 'persistent-cache']);
  assert.deepEqual(results.map(r => r.referenceText), ['instance-0', 'instance-0', 'instance-1']); assert.equal(reads, 2);
  const source = fs.readFileSync(modulePath, 'utf8'); assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function walk(n) {
    if (ts.isFunctionLike(n) && n.body) assert.ok(ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1 <= 50);
    ts.forEachChild(n, walk);
  }
  walk(ast);
  console.log(`local voice reference preparation: ${count} source/cache/order/error cases, concurrent promotion and instance isolation passed${baseline ? ' against baseline' : ''}`);
}
main().catch(error => { console.error(error); process.exit(1); });
