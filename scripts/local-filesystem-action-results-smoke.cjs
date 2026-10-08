const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.join(__dirname, '../electron/localFileSystemActionResults.cjs');
const source = fs.readFileSync(file, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['createFileManagementPreview', 'validateNoOverwrite',
  'createFileManagementError', 'createFileManagementSuccess'];
const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
const labels = require(file).FILE_MANAGEMENT_ACTION_LABELS;
let cases = 0;

function run(name, args, statKind, original = false) {
  const trace = [];
  const fakeFs = { statSync(target) {
    trace.push(['stat', target]);
    if (statKind === 'error') throw new Error('stat denied');
    if (statKind === 'missing') return null;
    return {
      isDirectory() { trace.push(['directory']); return statKind === 'directory'; },
      isFile() { trace.push(['file']); return statKind === 'file'; },
      isSymbolicLink() { trace.push(['symlink']); return statKind === 'symlink'; },
    };
  } };
  const cache = new Map();
  function load(target) {
    if (cache.has(target)) return cache.get(target);
    const module = { exports: {} };
    new Function('require', 'module', fs.readFileSync(target, 'utf8'))((id) => {
      if (id === 'fs') return fakeFs;
      if (id === 'path') return path;
      assert.ok(id.startsWith('./'));
      return load(path.resolve(path.dirname(target), id));
    }, module);
    cache.set(target, module.exports);
    return module.exports;
  }
  let functions = load(file);
  if (original) {
    const oldAst = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
    const nodes = oldAst.statements.filter((node) => ts.isFunctionDeclaration(node)
      && names.includes(node.name.text));
    const labelNode = oldAst.statements.find((node) => ts.isVariableStatement(node)
      && node.declarationList.declarations.some((d) => d.name.getText(oldAst) === 'FILE_MANAGEMENT_ACTION_LABELS'));
    functions = new Function('getSafeStat', 'getPathKind',
      `${[labelNode, ...nodes].map((node) => node.getText(oldAst)).join('\n')}
      return { ${names.join(',')} };`)(
      load(path.join(__dirname, '../electron/localFileSystemDestinationUtils.cjs')).getSafeStat,
      load(path.join(__dirname, '../electron/localFileSystemInputUtils.cjs')).getPathKind,
    );
  }
  try {
    return { value: functions[name](...args), trace };
  } catch (error) {
    return { error: error.constructor.name, message: error.message, trace };
  }
}

function check(name, args, kind, expected, trace) {
  const result = run(name, args, kind);
  if (expected !== undefined) assert.deepEqual(result.value, expected);
  if (trace !== undefined) assert.deepEqual(result.trace, trace);
  if (baseline) assert.deepEqual(result, run(name, args, kind, true));
  cases += 1;
  return result;
}

for (const action of [...Object.keys(labels), 'unknown', '', undefined, 'toString']) {
  for (const kind of ['directory', 'file', 'symlink', 'other', 'missing', 'error']) {
    for (const options of [{}, { sourcePath: '/source' }, { destinationPath: '/target' },
      { sourcePath: '/source', destinationPath: '/target' }]) {
      const exists = kind !== 'missing' && kind !== 'error';
      const expectedKind = exists ? kind : 'missing';
      const expected = {
        action, actionLabel: labels[action] ?? action,
        destinationExists: Boolean(options.destinationPath && exists),
        destinationKind: options.destinationPath ? expectedKind : 'missing',
        destinationPath: options.destinationPath || '', dryRun: true,
        itemKind: options.sourcePath ? expectedKind : 'missing', ok: true,
        sourceExists: Boolean(options.sourcePath && exists),
        sourcePath: options.sourcePath || '', willOverwrite: false,
      };
      check(names[0], [action, options], kind, expected);
    }
  }
  check(names[2], [action, 'failed'], 'missing', {
    action, actionLabel: labels[action] ?? action, error: 'failed', ok: false,
  }, []);
  check(names[3], [action], 'missing', {
    action, actionLabel: labels[action] ?? action, ok: true, verified: true,
  }, []);
  const extras = { action: 'override', actionLabel: 'custom', ok: false, verified: false, error: 'extra' };
  check(names[2], [action, 'failed', extras], 'file', extras, []);
  check(names[3], [action, extras], 'file', extras, []);
}
for (const request of [{ overwrite: true }, { allowOverwrite: 'yes' }, { conflictPolicy: 'overwrite' }]) {
  check(names[1], [request, '/target'], 'directory', {
    error: 'Overwriting existing files is not supported by this Agent file tool.', ok: false, path: '/target',
  }, []);
}
for (const kind of ['directory', 'file', 'missing', 'error']) {
  const exists = kind === 'directory' || kind === 'file';
  check(names[1], [{ overwrite: false, conflictPolicy: 'OVERWRITE' }, '/target'], kind,
    exists ? { error: 'Destination already exists. Choose another name or destination.', ok: false, path: '/target' }
      : { ok: true }, [['stat', '/target']]);
}
check(names[1], [{}, ''], 'file', { ok: true }, []);
const shortCircuit = { overwrite: true, get allowOverwrite() { throw new Error('must short circuit'); } };
check(names[1], [shortCircuit, '/target'], 'file', {
  error: 'Overwriting existing files is not supported by this Agent file tool.', ok: false, path: '/target',
}, []);
for (const name of names.slice(2)) {
  const extras = { get ok() { throw new Error('extras getter'); } };
  const args = name === names[2] ? ['copy_path', 'failure', extras] : ['copy_path', extras];
  assert.equal(check(name, args, 'file').message, 'extras getter');
}
assert.equal(check(names[0], ['copy_path', null], 'file').error, 'TypeError');
assert.equal(check(names[1], [null, '/target'], 'file').error, 'TypeError');
const getterTrace = [];
const options = {
  get sourcePath() { getterTrace.push('source'); return '/source'; },
  get destinationPath() { getterTrace.push('destination'); return '/target'; },
};
const result = check(names[0], ['copy_path', options], 'missing');
assert.deepEqual(result.trace, [['stat', '/source'], ['stat', '/target']]);
assert.deepEqual(getterTrace, baseline
  ? ['source', 'source', 'destination', 'destination', 'destination', 'source',
    'source', 'source', 'destination', 'destination', 'destination', 'source']
  : ['source', 'source', 'destination', 'destination', 'destination', 'source']);
assert.ok(source.split('\n').length <= 300);
for (const node of ast.statements.filter(ts.isFunctionDeclaration)) {
  assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
    - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name.text);
}
if (baseline) {
  const oldAst = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
  const moved = oldAst.statements.filter((node) => (ts.isFunctionDeclaration(node)
    && names.includes(node.name.text)) || (ts.isVariableStatement(node)
    && node.declarationList.declarations.some((d) => d.name.getText(oldAst) === 'FILE_MANAGEMENT_ACTION_LABELS')));
  let expected = baseline;
  for (const node of moved.sort((a, b) => b.pos - a.pos)) {
    assert.ok(source.includes(node.getText(oldAst)));
    expected = expected.slice(0, node.pos) + expected.slice(node.end);
  }
  const exports = ['FILE_MANAGEMENT_ACTION_LABELS', ...names];
  expected = expected.replace("} = require('./localFileSystemDestinationUtils.cjs');",
    "} = require('./localFileSystemDestinationUtils.cjs');\nconst {\n"
      + exports.map((name) => '  ' + name + ',').join('\n')
      + "\n} = require('./localFileSystemActionResults.cjs');");
  assert.equal(fs.readFileSync(path.join(__dirname, '../electron/localFileSystemService.cjs'), 'utf8'), expected);
}
console.log(`local filesystem action results smoke passed: ${cases} cases${baseline ? ', original results and query order compared' : ''}.`);
