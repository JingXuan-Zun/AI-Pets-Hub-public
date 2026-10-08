const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const rootFile = path.join(__dirname, '../electron/localFileSystemService.cjs');
const supportFile = path.join(__dirname, '../electron/localFileSystemServiceSupport.cjs');
const current = fs.readFileSync(rootFile, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const methods = ['getPathInfo', 'listDirectory', 'readTextFile', 'readFileDataUrl', 'searchFiles', 'executeFileManagementAction'];
const actions = ['get-path-info', 'list-directory', 'read-text-file', 'read-file-data-url', 'search-files', 'execute-file-management-action'];
let cases = 0;

function getFactory(text) {
  const ast = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
  return ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createLocalFileSystemService').getText(ast);
}

async function run(text, method, mode, logMode, instance) {
  const trace = [];
  const source = { ok: mode !== 'invalid-source', path: '/source-' + instance };
  const destination = { ok: true, path: '/destination-' + instance };
  const directory = { ok: true, path: '/directory-' + instance };
  const normalized = { ok: true, path: '/read-' + instance };
  const request = { path: '/requested-' + instance, action: 'copy_path' };
  const options = { instance };
  const roots = ['/protected-' + instance];
  const result = { ok: true, path: '/private-' + instance, entries: ['a', 'b'], matches: ['c'], text: '秘密内容' };
  if (mode === 'matches') delete result.entries;
  if (mode === 'no-count') { delete result.entries; delete result.matches; }
  if (mode === 'null-result') result.ok = false;
  if (mode === 'result-getter') Object.defineProperty(result, 'path', { get() { trace.push(['result-path']); throw Error('path getter'); } });
  const deps = {
    getFileManagementSourcePath(value) { assert.equal(value, request); trace.push(['source']); return source; },
    getFileManagementDestinationPath(value, sourcePath) {
      assert.equal(value, request); trace.push(['destination', sourcePath]);
      if (mode === 'destination-error') throw Error('destination');
      return destination;
    },
    getCreateDirectoryPath(value) { assert.equal(value, request); trace.push(['directory']); return directory; },
  };
  const policy = {
    isSensitivePath(value) {
      assert.equal(this, policy); trace.push(['sensitive', value]);
      if (mode === 'policy-error') throw Error('policy');
      return mode === 'block-all' || value === '/' + mode + '-' + instance;
    },
  };
  const logger = logMode === 'none' ? undefined : logMode === 'non-function' ? {} : function(action, projection) {
    trace.push(['log', action, projection]);
    if (logMode === 'throw') throw Error('logger');
  };
  const context = {
    ...deps, SENSITIVE_PATH_ERROR: 'sensitive error',
    createSensitivePathPolicy(value) { assert.equal(value.extraRoots, roots); trace.push(['policy-create', [...roots]]); return policy; },
    normalizeInputName(value) { trace.push(['action-name', value]); return value; },
    normalizeAbsolutePath(value) { trace.push(['normalize', value]); return normalized; },
    createFileManagementError(action, error, extra) { trace.push(['action-error', action]); return { action, error, ok: false, ...extra }; },
  };
  const delegate = name => (value, passedOptions) => {
    assert.equal(value, request);
    if (name === 'executeFileManagementAction') assert.equal(passedOptions, options);
    trace.push(['delegate', name]);
    if (mode === 'delegate-error') throw Error('delegate');
    return mode === 'null-result' ? null : result;
  };
  context.createPathInfo = delegate('getPathInfo');
  for (const name of methods.slice(1)) context[name] = delegate(name);
  const supportModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(supportFile, 'utf8'), {
    module: supportModule, require(id) {
      return id === './localFileSystemActionInputs.cjs'
        ? require('../electron/localFileSystemActionInputs.cjs') : deps;
    },
  }, { filename: supportFile });
  context.createFileSystemServiceSupport = supportModule.exports.createFileSystemServiceSupport;
  // These are the real root factory and real support module; terminal operations and policy are controlled.
  const factory = vm.runInNewContext('(' + getFactory(text) + ')', context);
  const service = factory({ log: logger, protectedRoots: roots });
  assert.deepEqual(Object.keys(service), methods);
  let outcome;
  try {
    const value = await service[method](request, options);
    outcome = { value: value === result ? 'same-result' : JSON.parse(JSON.stringify(value)), trace };
    if (value !== null && value !== result) assert.equal(value.ok, false);
  } catch (error) {
    outcome = { error: error.message, trace };
  }
  // Copy across VM realms for strict comparisons.
  return JSON.parse(JSON.stringify(outcome));
}

async function main() {
  if (baseline) {
    const before = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
    const after = ts.createSourceFile(supportFile, fs.readFileSync(supportFile, 'utf8'), ts.ScriptTarget.Latest, true);
    const oldFactory = before.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createLocalFileSystemService');
    const newFactory = after.statements.find(ts.isFunctionDeclaration);
    const normalize = value => value.split('\n').map(line => line.trim()).join('\n');
    for (const oldFunction of oldFactory.body.statements.filter(ts.isFunctionDeclaration)) {
      if (oldFunction.name.text === 'getFileManagementCandidatePaths') continue; // Rename target protection intentionally changed.
      const newFunction = newFactory.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === oldFunction.name.text);
      assert.equal(normalize(newFunction.getText(after)), normalize(oldFunction.getText(before)));
    }
  }
  for (const method of methods) {
    for (const mode of ['normal', 'matches', 'no-count', 'null-result', 'result-getter',
      'invalid-source', 'destination-error', 'policy-error', 'delegate-error',
      'source', 'destination', 'directory', 'read', 'block-all']) {
      for (const logMode of ['normal', 'none', 'non-function', 'throw']) {
        for (const instance of [1, 2]) {
          const actual = await run(current, method, mode, logMode, instance);
          if (baseline) assert.deepEqual(actual, await run(baseline, method, mode, logMode, instance));
          const events = actual.trace;
          if (mode === 'normal' && logMode === 'normal') {
            assert.equal(actual.value, 'same-result');
            assert.deepEqual(events.at(-1), ['log', actions[methods.indexOf(method)],
              { ok: true, path: 'configured', count: 2, textLength: 4 }]);
          }
          if (logMode === 'none' || logMode === 'non-function') assert.ok(!events.some(e => e[0] === 'log' || e[0] === 'result-path'));
          if (method === 'executeFileManagementAction') {
            assert.deepEqual(events.slice(1, 3), [['source'], ['destination', mode === 'invalid-source' ? '' : '/source-' + instance]]);
            if (mode === 'source' || mode === 'block-all') {
              assert.ok(!events.some(e => e[0] === 'delegate'));
              assert.equal(events.filter(e => e[0] === 'sensitive').length, 1);
            }
            if (mode === 'destination') assert.equal(events.filter(e => e[0] === 'sensitive').length, 2);
            if (mode === 'directory') assert.equal(events.filter(e => e[0] === 'sensitive').length, 3);
          } else if (method === 'readTextFile' || method === 'readFileDataUrl') {
            if (mode === 'read' || mode === 'block-all') assert.ok(!events.some(e => e[0] === 'delegate'));
          } else {
            assert.ok(!events.some(e => e[0] === 'sensitive'));
          }
          cases++;
        }
      }
    }
  }
  const { createFileSystemServiceSupport } = require(supportFile);
  const logs = [[], []];
  const supports = logs.map((log, index) => createFileSystemServiceSupport({
    log: (...args) => log.push(args),
    sensitivePathPolicy: { isSensitivePath: value => value === '/protected-' + index },
  }));
  supports[0].logResult('first', { ok: true, path: '/secret', text: 'abc' });
  supports[1].logResult('second', { ok: false, entries: ['a'] });
  supports[0].logResult('third', null);
  assert.deepEqual(logs.map(log => log.map(entry => entry[0])), [['first', 'third'], ['second']]);
  assert.equal(logs[0][0][1].path, 'configured');
  for (const [index, support] of supports.entries()) {
    const candidate = { ok: true, path: '/protected-' + index };
    assert.equal(support.findSensitivePath([null, { ok: false, path: candidate.path }, candidate]), candidate);
    assert.equal(supports[1 - index].findSensitivePath([candidate]), null);
  }
  for (const file of [rootFile, supportFile]) {
    const text = fs.readFileSync(file, 'utf8');
    assert.ok(text.split('\n').length <= 300);
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    function visit(node) {
      if (ts.isFunctionLike(node) && node.body) {
        assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
          - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name?.getText(ast));
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  console.log('local filesystem service support smoke passed: ' + cases + ' root factory cases; privacy projection, rejection order, errors and budgets.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
