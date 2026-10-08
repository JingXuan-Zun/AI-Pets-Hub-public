const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.join(__dirname, '../electron/localFileSystemSearch.cjs');
const source = fs.readFileSync(file, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['normalizeExtensionFilter', 'shouldSkipSearchDirectory', 'searchFiles'];
const constants = ['DEFAULT_SEARCH_LIMIT', 'DEFAULT_SEARCH_MAX_DEPTH', 'MAX_SEARCH_LIMIT', 'MAX_SEARCH_DEPTH', 'DEFAULT_IGNORED_DIRECTORY_NAMES'];
let cases = 0;

function run(pathApi, requestFactory, config, original = false) {
  const root = pathApi === path.win32 ? 'C:\\搜索' : '/搜索';
  const trace = [];
  const trees = new Map([
    [root, [['match.TXT', 'file'], ['child', 'directory'], ['.hidden-dir', 'directory'],
      ['node_modules', 'directory'], ['.hiddenmatch.txt', 'file'], ['matchgone.txt', 'missing'], ['link', 'symlink']]],
    [pathApi.join(root, 'child'), [['other.txt', 'file'], ['match.png', 'file'], ['deep', 'directory'], ['blocked', 'directory']]],
    [pathApi.join(root, 'child', 'deep'), [['match.md', 'file']]],
    [pathApi.join(root, '.hidden-dir'), [['match.secret', 'file']]],
    [pathApi.join(root, 'node_modules'), [['match.js', 'file']]],
  ]);
  if (config.many) trees.set(root, Array.from({ length: 305 }, (_, index) => [`match${index}.txt`, 'file']));
  if (config.single) trees.set(root, [['match.txt', 'file']]);
  const fakeFs = {
    statSync(target) {
      trace.push(['stat', target]);
      const kind = target === root ? config.rootKind || 'directory'
        : trees.get(pathApi.dirname(target))?.find(([name]) => name === pathApi.basename(target))?.[1] || 'missing';
      if (kind === 'missing' || kind === 'error') throw new Error('stat denied');
      return { birthtimeMs: 1, mtimeMs: 2, size: 42,
        isDirectory() {
          trace.push(['stat directory', target]);
          if (kind === 'method-error') throw new Error('directory failed');
          return kind === 'directory';
        },
        isFile() { trace.push(['stat file', target]); return kind === 'file'; },
        isSymbolicLink() { return kind === 'symlink'; },
      };
    },
    readdirSync(target, options) {
      trace.push(['read', target, options]);
      if (config.rootReadError || !trees.has(target)) throw new Error('read denied');
      return trees.get(target).map(([name, kind]) => ({
        get name() { trace.push(['name', name]); return name; },
        isDirectory() { trace.push(['entry directory', name]); return kind === 'directory'; },
        isFile() {
          trace.push(['entry file', name]);
          if (config.entryError) throw new Error('entry failed');
          return kind === 'file' || kind === 'missing';
        },
      }));
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
  let search = load(file).searchFiles;
  if (original) {
    const ast = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
    const nodes = ast.statements.filter((node) => (ts.isFunctionDeclaration(node) && names.includes(node.name.text))
      || (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => constants.includes(d.name.getText(ast)))));
    const helpers = Object.assign({}, ...['localFileSystemInputUtils.cjs', 'localFileSystemDestinationUtils.cjs',
      'localFileSystemDirectoryReader.cjs'].map((name) => load(path.join(__dirname, '../electron', name))));
    search = new Function('fs', 'path', ...Object.keys(helpers),
      `${nodes.map((node) => node.getText(ast)).join('\n')}\nreturn searchFiles;`,
    )(fakeFs, pathApi, ...Object.values(helpers));
  }
  try {
    return { value: search(requestFactory(trace, root)), trace };
  } catch (error) {
    return { error: error.constructor.name, message: error.message, trace };
  }
}

function check(pathApi, factory, config = {}) {
  const result = run(pathApi, factory, config);
  if (baseline) assert.deepEqual(result, run(pathApi, factory, config, true));
  cases += 1;
  return result;
}
for (const pathApi of [path.win32, path.posix]) {
  for (const maxDepth of [0, 1, 2, 8]) {
    for (const limit of [1, 2, 300]) {
      for (const extensions of [undefined, 'TXT, png', ['.md', '.txt']]) {
        for (const includeHidden of [false, true]) {
          for (const nameQuery of ['match', 'OTHER', 'absent']) {
            const result = check(pathApi, (trace, root) => ({ path: root, maxDepth, limit, extensions, includeHidden, nameQuery }));
            assert.equal(result.value.ok, true);
            assert.ok(result.value.matches.length <= limit);
            assert.equal(result.value.query, nameQuery.toLowerCase());
            assert.ok(!result.trace.some((event) => event[0] === 'read' && event[1].includes('node_modules')));
            if (!includeHidden) assert.ok(!result.trace.some((event) => event[0] === 'read' && event[1].includes('.hidden-dir')));
          }
        }
      }
    }
  }
  const basic = check(pathApi, (trace, root) => ({ path: root, query: 'match' }));
  assert.deepEqual(basic.value.matches.map((entry) => entry.name), ['match.TXT', 'match.png', 'match.md', '.hiddenmatch.txt']);
  assert.equal(basic.value.visitedDirectoryCount, 4);
  assert.equal(basic.value.visitedFileCount, 6);
  assert.equal(basic.value.truncated, false);
  const single = check(pathApi, (trace, root) => ({ path: root, query: 'match', limit: 1 }), { single: true });
  assert.equal(single.value.truncated, false);
  const many = check(pathApi, (trace, root) => ({ path: root, query: 'match', limit: 999 }), { many: true });
  assert.equal(many.value.matches.length, 300);
  assert.equal(many.value.visitedFileCount, 300);
  assert.equal(many.value.truncated, true);
  const unreadable = check(pathApi, (trace, root) => ({ path: root, query: 'match' }), { rootReadError: true });
  assert.equal(unreadable.value.ok, true);
  assert.equal(unreadable.value.visitedDirectoryCount, 1);
  assert.deepEqual(unreadable.value.matches, []);
  for (const rootKind of ['file', 'missing', 'error', 'method-error']) {
    const result = check(pathApi, (trace, root) => ({ path: root, query: 'match' }), { rootKind });
    assert.ok(result.value?.ok === false || result.message === 'directory failed');
    assert.ok(!result.trace.some((event) => event[0] === 'read'));
  }
  for (const field of ['path', 'folderPath', 'rootPath', 'queryRoot']) check(pathApi, (trace, root) => ({ [field]: root, nameQuery: 'match' }));
  for (const field of ['nameQuery', 'fileName', 'pattern', 'query']) check(pathApi, (trace, root) => ({ path: root, [field]: 'match' }));
  assert.equal(check(pathApi, (trace, root) => ({ path: root })).value.error, 'Missing file search query.');
  const invalid = check(pathApi, () => ({ path: 'relative', query: 'match' }));
  assert.deepEqual(invalid.trace, []);
  assert.equal(check(pathApi, () => null).error, 'TypeError');
  assert.equal(check(pathApi, (trace, root) => ({ path: root, query: 'match', limit: Symbol('bad') })).error, 'TypeError');
  assert.equal(check(pathApi, (trace, root) => ({ path: root, query: 'match' }), { entryError: true }).message, 'entry failed');
  check(pathApi, (trace, root) => ({ path: root, nameQuery: 'match',
    get includeHidden() { trace.push('hidden'); return true; }, get extensions() { trace.push('extensions'); return 'txt'; },
    get limit() { trace.push('limit'); return 3; }, get maxDepth() { trace.push('depth'); return 2; },
  }));
}
const exported = require(file);
assert.deepEqual(exported.normalizeExtensionFilter('TXT; .png TXT'), new Set(['.txt', '.png']));
assert.equal(exported.normalizeExtensionFilter(' ; '), null);
assert.equal(exported.shouldSkipSearchDirectory('node_modules', true), true);
assert.equal(exported.shouldSkipSearchDirectory('Node_Modules', true), false);
assert.equal(exported.shouldSkipSearchDirectory('.custom', false), true);
assert.equal(exported.shouldSkipSearchDirectory('.custom', true), false);
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
  const nodes = oldAst.statements.filter((node) => (ts.isFunctionDeclaration(node) && names.includes(node.name.text))
    || (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => constants.includes(d.name.getText(oldAst)))));
  let expected = baseline;
  for (const node of nodes.sort((a, b) => b.pos - a.pos)) {
    if (!ts.isFunctionDeclaration(node) || node.name.text !== 'searchFiles') assert.ok(source.includes(node.getText(oldAst)));
    expected = expected.slice(0, node.pos) + expected.slice(node.end);
  }
  expected = expected.replace('{ normalizeEntry, createPathInfo, listDirectory }', '{ createPathInfo, listDirectory }')
    .replace('  normalizeInputPath,\n', '').replace("const path = require('path');",
      "const path = require('path');\nconst { searchFiles } = require('./localFileSystemSearch.cjs');");
  assert.equal(fs.readFileSync(path.join(__dirname, '../electron/localFileSystemService.cjs'), 'utf8'), expected);
}
console.log(`local filesystem search smoke passed: ${cases} cases, Windows/POSIX${baseline ? ', original results and traversal order compared' : ''}.`);
