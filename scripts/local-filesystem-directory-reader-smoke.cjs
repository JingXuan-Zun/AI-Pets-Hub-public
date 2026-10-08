const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.join(__dirname, '../electron/localFileSystemDirectoryReader.cjs');
const source = fs.readFileSync(file, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = Object.keys(require(file));
const constants = ['DEFAULT_LIST_LIMIT', 'MAX_LIST_LIMIT'];
let cases = 0;

function run(pathApi, name, argsFactory, config, original = false) {
  const trace = [];
  const root = pathApi === path.win32 ? 'C:\\目录' : '/目录';
  const entries = config.many ? Array.from({ length: 305 }, (_, index) => [`file${index}.txt`, 'file'])
    : [['file10.TXT', 'file'], ['file2.txt', 'file'], ['目录', 'directory'], ['中文.txt', 'file'],
      ['.hidden', 'file'], ['gone.txt', 'missing'], ['link', 'symlink'], ['other', 'other']];
  function stat(target, kind) {
    return {
      get birthtimeMs() { trace.push(['birth', target]); return 0; },
      get mtimeMs() { trace.push(['modified', target]); return 12; },
      get size() { trace.push(['size', target]); return 42; },
      isDirectory() {
        trace.push(['directory', target]);
        if (kind === 'method-error') throw new Error('directory method failed');
        return kind === 'directory';
      },
      isFile() { trace.push(['file', target]); return kind === 'file'; },
      isSymbolicLink() { trace.push(['symlink', target]); return kind === 'symlink'; },
    };
  }
  const fakeFs = {
    statSync(target) {
      trace.push(['stat', target]);
      const kind = target === root ? config.rootKind || 'directory'
        : entries.find(([entryName]) => entryName === pathApi.basename(target))?.[1] || 'missing';
      if (kind === 'missing' || kind === 'error') throw new Error('stat denied');
      return stat(target, kind);
    },
    readdirSync(target, options) {
      trace.push(['read', target, options]);
      if (config.readError === 'string') throw 'read denied';
      if (config.readError === 'null') throw null;
      if (config.readError) throw new Error('read denied');
      return entries.map(([entryName]) => ({ get name() {
        trace.push(['name', entryName]);
        if (config.nameError) throw new Error('name failed');
        return entryName;
      } }));
    },
  };
  const cache = new Map();
  function load(target) {
    if (cache.has(target)) return cache.get(target);
    const module = { exports: {} };
    new Function('require', 'module', fs.readFileSync(target, 'utf8'))((id) => {
      if (id === 'fs') return fakeFs;
      if (id === 'path') return pathApi;
      assert.ok(id.startsWith('./'));
      return load(path.resolve(path.dirname(target), id));
    }, module);
    cache.set(target, module.exports);
    return module.exports;
  }
  let functions = load(file);
  if (original) {
    const ast = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
    const nodes = ast.statements.filter((node) => (ts.isFunctionDeclaration(node)
      && names.includes(node.name.text)) || (ts.isVariableStatement(node)
      && node.declarationList.declarations.some((d) => constants.includes(d.name.getText(ast)))));
    const inputs = load(path.join(__dirname, '../electron/localFileSystemInputUtils.cjs'));
    functions = new Function('fs', 'path', 'getSafeStat', ...Object.keys(inputs),
      `${nodes.map((node) => node.getText(ast)).join('\n')}\nreturn { ${names.join(',')} };`,
    )(fakeFs, pathApi, load(path.join(__dirname, '../electron/localFileSystemDestinationUtils.cjs')).getSafeStat,
      ...Object.values(inputs));
  }
  try {
    return { value: functions[name](...argsFactory(trace, root, stat)), trace };
  } catch (error) {
    return { error: error.constructor.name, message: error.message, trace };
  }
}

function check(pathApi, name, args, config = {}) {
  const result = run(pathApi, name, args, config);
  if (baseline) assert.deepEqual(result, run(pathApi, name, args, config, true));
  cases += 1;
  return result;
}

for (const pathApi of [path.win32, path.posix]) {
  for (const rootKind of ['directory', 'file', 'symlink', 'other', 'missing', 'error', 'method-error']) {
    for (const includeHidden of [false, true]) {
      for (const limit of [undefined, 1, 3, 0, 999, NaN, Symbol('bad')]) {
        for (const readError of [false, true, 'string', 'null']) {
          const result = check(pathApi, 'listDirectory', (trace, root) => [{ path: root, includeHidden, limit }],
            { rootKind, readError });
          if (rootKind === 'directory' && !readError && typeof limit !== 'symbol') {
            assert.equal(result.value.ok, true);
            assert.equal(result.value.totalEntryCount, 8);
            assert.equal(result.value.limit, limit === 1 || limit === 0 ? 1 : limit === 3 ? 3 : limit === 999 ? 300 : 80);
            assert.equal(result.value.truncated, (includeHidden ? 7 : 6) > result.value.limit);
            assert.ok(!result.value.entries.some((entry) => entry.name === 'gone.txt'));
            assert.equal(result.value.entries[0].kind, 'directory');
            assert.equal(result.value.entries[0].name, '目录');
          }
          if (rootKind === 'method-error') assert.equal(result.message, 'directory method failed');
          if (rootKind !== 'directory') assert.ok(!result.trace.some((event) => event[0] === 'read'));
        }
      }
    }
    const info = check(pathApi, 'createPathInfo', (trace, root) => [{ path: root }], { rootKind });
    if (rootKind !== 'method-error') assert.equal(info.value.ok, !['missing', 'error'].includes(rootKind));
  }
  for (const kind of ['directory', 'file', 'symlink', 'other']) {
    const entry = check(pathApi, 'normalizeEntry', (trace, root, stat) => [root, 'File.TXT', stat(root, kind)]);
    assert.equal(entry.value.kind, kind);
    assert.equal(entry.value.createdAt, 0);
    assert.equal(entry.value.modifiedAt, 12);
    assert.equal(entry.value.sizeBytes, kind === 'file' ? 42 : 0);
    assert.equal(entry.value.extension, kind === 'file' ? '.txt' : '');
  }
  for (const includeHidden of [false, true]) {
    const entries = check(pathApi, 'listDirectoryEntries', (trace, root) => [root, { includeHidden }]);
    assert.equal(entries.value.totalEntryCount, 8);
    assert.equal(entries.value.entries.length, includeHidden ? 7 : 6);
    assert.equal(entries.value.entries[0].kind, 'directory');
  }
  const many = check(pathApi, 'listDirectory', (trace, root) => [{ path: root, limit: 999 }], { many: true });
  assert.equal(many.value.entries.length, 300);
  assert.equal(many.value.totalEntryCount, 305);
  assert.equal(many.value.truncated, true);
  for (const name of ['listDirectory', 'createPathInfo']) {
    const invalid = check(pathApi, name, () => [{ path: 'relative' }]);
    assert.equal(invalid.value.ok, false);
    assert.deepEqual(invalid.trace, []);
    assert.equal(check(pathApi, name, () => [null]).error, 'TypeError');
  }
  for (const field of ['path', 'folderPath', 'query']) check(pathApi, 'listDirectory', (trace, root) => [{ [field]: root }]);
  for (const field of ['path', 'target', 'query']) check(pathApi, 'createPathInfo', (trace, root) => [{ [field]: root }]);
  const getter = check(pathApi, 'listDirectory', (trace, root) => [{ path: root,
    get limit() { trace.push('limit'); return 2; }, get includeHidden() { trace.push('hidden'); return true; },
  }]);
  assert.equal(getter.value.entries.length, 2);
  assert.equal(check(pathApi, 'listDirectory', (trace, root) => [{ path: root }], { nameError: true }).value.error, 'name failed');
}

const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function checkBudget(node) {
  if (ts.isFunctionLike(node) && node.body) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
    - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
  ts.forEachChild(node, checkBudget);
}
checkBudget(ast);
if (baseline) {
  const oldAst = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
  const nodes = oldAst.statements.filter((node) => (ts.isFunctionDeclaration(node)
    && names.includes(node.name.text)) || (ts.isVariableStatement(node)
    && node.declarationList.declarations.some((d) => constants.includes(d.name.getText(oldAst)))));
  assert.equal(nodes.length, 6);
  let expected = baseline;
  for (const node of nodes.sort((a, b) => b.pos - a.pos)) {
    assert.ok(source.includes(node.getText(oldAst)));
    expected = expected.slice(0, node.pos) + expected.slice(node.end);
  }
  expected = expected.replace("const path = require('path');",
    "const path = require('path');\nconst { normalizeEntry, createPathInfo, listDirectory } = require('./localFileSystemDirectoryReader.cjs');");
  assert.equal(fs.readFileSync(path.join(__dirname, '../electron/localFileSystemService.cjs'), 'utf8'), expected);
}
console.log(`local filesystem directory reader smoke passed: ${cases} cases, Windows/POSIX${baseline ? ', original results and I/O order compared' : ''}.`);
