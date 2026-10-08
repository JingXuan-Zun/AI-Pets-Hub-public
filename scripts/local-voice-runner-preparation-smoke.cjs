const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeScriptUtils.cjs');
const source = fs.readFileSync(modulePath, 'utf8');

function loadBaseline(file) {
  const root = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const start = root.indexOf('  function ensureRunnerScriptPath() {');
  const end = root.indexOf('\n  return {\n    cancelSynthesis,', start);
  assert.ok(start >= 0 && end > start);
  return context => new Function(...Object.keys(context),
    `${root.slice(start, end)} return ensureRunnerScriptPath;`)(...Object.values(context));
}

function run(config, baseline) {
  const trace = [], files = new Map(), failure = new Error('controlled sync failure');
  const sourcePath = path.join('controlled-sources', config.tag + '.py');
  files.set(sourcePath, 'runner-v1');
  let call = 0;
  function record(stage, args, action) {
    trace.push([stage, ...args]);
    if (stage === config.fault && call === 1) throw failure;
    return action();
  }
  const controlledPath = {
    join: (...args) => record('join', args, () => path.join(...args)),
    dirname: value => record('dirname', [value], () => path.dirname(value)),
  };
  const controlledFs = {
    readFileSync: (value, encoding) => record(value === sourcePath ? 'source-read' : 'target-read',
      [value, encoding], () => {
        if (!files.has(value)) throw new Error('missing controlled file');
        return files.get(value);
      }),
    writeFileSync: (value, text, encoding) => record('write', [value, text, encoding], () => files.set(value, text)),
  };
  const loaded = { exports: {} }, realRequire = createRequire(modulePath);
  new Function('require', 'module', source)(name => {
    if (name === 'fs') return controlledFs;
    if (name === 'path') return controlledPath;
    if (name === './localVoiceRuntimePathUtils.cjs') return {
      ensureDir: value => record('mkdir', [value], () => {}),
      pathExists: value => record('exists', [value], () => files.has(value)),
    };
    return realRequire(name);
  }, loaded);
  if (typeof config.runtimeRoot === 'string') {
    const target = path.join(config.runtimeRoot, 'local_voice_runner.py');
    if (config.target !== 'missing') files.set(target, config.target === 'same' ? 'runner-v1' : 'stale-runner');
  }
  const resolver = baseline ? baseline({ path: controlledPath, runtimeRoot: config.runtimeRoot,
    embeddedRunnerPath: sourcePath, ensureSyncedTextFile: loaded.exports.ensureSyncedTextFile })
    : loaded.exports.createRunnerScriptResolver({ sourcePath, runtimeRoot: config.runtimeRoot });
  assert.deepEqual(trace, [], 'creating resolver must not resolve paths or access files');
  assert.equal(resolver.name, 'ensureRunnerScriptPath'); assert.equal(resolver.length, 0);
  const outcomes = [];
  for (call = 1; call <= 2; call++) {
    if (call === 2 && config.changeSource) files.set(sourcePath, 'runner-v2');
    try { outcomes.push({ result: resolver() }); }
    catch (error) {
      if (config.fault && typeof config.runtimeRoot === 'string' && call === 1) assert.equal(error, failure);
      outcomes.push({ error: { name: error.name, code: error.code, message: error.message } });
    }
  }
  return { trace, outcomes, files: [...files] };
}

const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
let count = 0;
for (const runtimeRoot of ['', 'controlled-runtime', '中文 空格目录', null]) {
  for (const target of ['missing', 'same', 'stale']) for (const changeSource of [false, true]) {
    for (const fault of [null, 'join', 'dirname', 'mkdir', 'source-read', 'exists', 'target-read', 'write']) {
      const config = { runtimeRoot, target, changeSource, fault, tag: 'A' };
      const actual = run(config); if (baseline) assert.deepEqual(actual, run(config, baseline)); count++;
    }
  }
}
const unchanged = run({ runtimeRoot: 'runtime', target: 'same', changeSource: false, tag: 'same' });
assert.equal(unchanged.trace.filter(item => item[0] === 'write').length, 0);
const changed = run({ runtimeRoot: 'runtime', target: 'missing', changeSource: true, tag: 'change' });
assert.equal(changed.trace.filter(item => item[0] === 'write').length, 2);
const { createRunnerScriptResolver } = require(modulePath);
assert.notEqual(createRunnerScriptResolver({}), createRunnerScriptResolver({}));
console.log(`Local voice runner preparation: ${count} two-call path/file/update/failure scenarios, lazy creation and resolver isolation passed${baseline ? ' against baseline' : ''}.`);
