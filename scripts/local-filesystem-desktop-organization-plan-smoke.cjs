const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.join(__dirname, '../electron/localFileSystemDesktopOrganizationPlan.cjs');
const source = fs.readFileSync(file, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let cases = 0;

function run(pathApi, requestFactory, config, original = false) {
  const trace = [];
  const home = pathApi === path.win32 ? 'C:\\用户' : '/用户';
  const desktop = pathApi.join(home, 'Desktop');
  const root = pathApi.join(desktop, 'Desktop Organized');
  const entries = config.many ? Array.from({ length: 205 }, (_, index) => [`file${index}.txt`, 'file'])
    : [['photo10.PNG', 'file'], ['photo2.png', 'file'], ['中文.pdf', 'file'], ['missing.txt', 'file'],
      ['folder', 'directory'], ['.hidden.txt', 'file'], ['desktop.ini', 'file'], ['Link.LNK', 'file'],
      ['strange', 'other'], ['Desktop Organized', 'directory'], ['plain', 'file'], ['code.ts', 'file']];
  const fakeFs = {
    statSync(target) {
      trace.push(['stat', target]);
      let kind;
      if (target === desktop) kind = config.desktopKind || 'directory';
      else if (target === root) kind = config.rootKind || 'missing';
      else if (pathApi.dirname(target) === desktop) {
        kind = entries.find(([name]) => name === pathApi.basename(target))?.[1] || 'missing';
        if (pathApi.basename(target) === 'missing.txt') kind = 'error';
      } else kind = config.conflicts && pathApi.basename(target) === 'photo2.png' ? 'file' : 'missing';
      if (kind === 'error') throw new Error('stat denied');
      if (kind === 'missing') return null;
      return {
        size: 42,
        isDirectory() {
          trace.push(['stat directory', target]);
          if (kind === 'method-error') throw new Error('directory failed');
          return kind === 'directory';
        },
        isFile() { trace.push(['stat file', target]); return kind === 'file'; },
        isSymbolicLink() { trace.push(['stat symlink', target]); return false; },
      };
    },
    readdirSync(target, options) {
      trace.push(['read', target, options]);
      if (config.readError) throw new Error('read denied');
      return entries.map(([name, kind]) => ({ name,
        isDirectory() { trace.push(['entry directory', name]); return kind === 'directory'; },
        isFile() { trace.push(['entry file', name]); return kind === 'file'; },
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
      if (id === 'os') return { homedir() { trace.push('home'); return home; } };
      assert.ok(id.startsWith('./'));
      return load(path.resolve(path.dirname(target), id));
    }, module);
    cache.set(target, module.exports);
    return module.exports;
  }
  let createPlan = load(file).createDesktopFileOrganizationPlan;
  if (original) {
    const ast = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
    const fn = ast.statements.find((node) => ts.isFunctionDeclaration(node)
      && node.name.text === 'createDesktopFileOrganizationPlan');
    const helpers = Object.assign({}, ...[
      'localFileSystemInputUtils.cjs', 'localFileSystemDestinationUtils.cjs',
      'localFileSystemDesktopOrganizationRules.cjs',
    ].map((name) => load(path.join(__dirname, '../electron', name))));
    createPlan = new Function('fs', 'path', ...Object.keys(helpers),
      `const MAX_DESKTOP_FILE_ORGANIZATION_ITEMS = 200;\n${fn.getText(ast)}\nreturn createDesktopFileOrganizationPlan;`,
    )(fakeFs, pathApi, ...Object.values(helpers));
  }
  try {
    return { value: createPlan(requestFactory(trace, desktop, root)), trace };
  } catch (error) {
    return { error: error.constructor.name, message: error.message, trace };
  }
}

function check(pathApi, request, config = {}) {
  const factory = typeof request === 'function' ? request : () => request;
  const result = run(pathApi, factory, config);
  if (baseline) assert.deepEqual(result, run(pathApi, factory, config, true));
  if (result.value?.ok) {
    const plan = result.value;
    assert.ok(plan.items.length <= 200);
    assert.equal(plan.groups.reduce((total, group) => total + group.count, 0), plan.items.length);
    assert.equal(plan.items.length + plan.skipped.length, config.many ? 205 : 12);
    assert.ok(plan.conflicts.every((conflict) => plan.items.some((item) => item.destinationPath === conflict.destinationPath)));
    assert.ok(plan.groups.every((group) => !Object.hasOwn(group, 'order')));
  }
  cases += 1;
  return result;
}

for (const pathApi of [path.win32, path.posix]) {
  for (const groupBy of ['category', 'extension', 'kind', 'none', 'unknown']) {
    for (let flags = 0; flags < 8; flags += 1) {
      for (const limit of [1, 3, 200]) {
        for (const conflicts of [false, true]) {
          const result = check(pathApi, { groupBy, limit, includeHidden: Boolean(flags & 1),
            includeDirectories: Boolean(flags & 2), includeShortcuts: Boolean(flags & 4) }, { conflicts });
          assert.equal(result.value.ok, true);
          assert.ok(result.value.items.length <= limit);
          assert.equal(result.value.truncated, result.value.skipped.some((item) => item.reason === 'limit-reached'));
          assert.ok(result.value.skipped.some((item) => item.reason === 'already-in-destination-root'));
          if (groupBy === 'none') assert.ok(result.value.groups.every((group) => pathApi.basename(group.destinationDirectory) === 'Files'));
        }
      }
    }
  }
  const basic = check(pathApi, {});
  assert.deepEqual(basic.value.items.map((item) => item.name), ['中文.pdf', 'code.ts', 'photo2.png', 'photo10.PNG', 'plain']);
  assert.deepEqual(basic.value.groups.map((group) => group.key), ['image', 'document', 'code', 'other']);
  const capped = check(pathApi, { limit: 999 }, { many: true });
  assert.equal(capped.value.items.length, 200);
  assert.equal(capped.value.skipped.length, 5);
  assert.equal(capped.value.truncated, true);
  for (const desktopKind of ['missing', 'file', 'error', 'method-error']) {
    const result = check(pathApi, {}, { desktopKind });
    assert.ok(result.value?.ok === false || result.message === 'directory failed');
    assert.ok(!result.trace.some((event) => event[0] === 'read'));
  }
  for (const rootKind of ['directory', 'file', 'error', 'method-error']) check(pathApi, {}, { rootKind });
  assert.equal(check(pathApi, {}, { readError: true }).message, 'read denied');
  const invalid = check(pathApi, { desktopPath: 'relative' });
  assert.equal(invalid.value.ok, false);
  assert.deepEqual(invalid.trace, []);
  assert.equal(check(pathApi, null).error, 'TypeError');
  for (const field of ['desktopPath', 'sourcePath', 'source', 'path']) {
    check(pathApi, (trace, desktop) => ({ [field]: desktop }));
  }
  check(pathApi, (trace, desktop, root) => ({ get desktopPath() { trace.push('desktop getter'); return desktop; },
    get groupBy() { trace.push('group getter'); return 'extension'; }, destinationDirectory: root, limit: 2 }));
  assert.equal(check(pathApi, { get groupBy() { throw new Error('group getter failed'); } }).message, 'group getter failed');
  assert.equal(check(pathApi, { limit: Symbol('bad') }).error, 'TypeError');
}

const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
function checkBudget(node) {
  if (ts.isFunctionLike(node) && node.body) {
    assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
      - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
  }
  ts.forEachChild(node, checkBudget);
}
checkBudget(ast);
if (baseline) {
  const oldAst = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
  const removed = oldAst.statements.filter((node) => (ts.isFunctionDeclaration(node)
    && node.name.text === 'createDesktopFileOrganizationPlan') || (ts.isVariableStatement(node)
    && node.declarationList.declarations.some((d) => d.name.getText(oldAst) === 'MAX_DESKTOP_FILE_ORGANIZATION_ITEMS')));
  let expected = baseline;
  for (const node of removed.sort((a, b) => b.pos - a.pos)) expected = expected.slice(0, node.pos) + expected.slice(node.end);
  expected = expected.replace(/const \{\r?\n  normalizeDesktopFileOrganizationGroupBy,[\s\S]*?\} = require\('\.\/localFileSystemDesktopOrganizationRules.cjs'\);/,
    "const { createDesktopFileOrganizationPlan } = require('./localFileSystemDesktopOrganizationPlan.cjs');");
  assert.equal(fs.readFileSync(path.join(__dirname, '../electron/localFileSystemService.cjs'), 'utf8'), expected);
}
console.log(`local filesystem desktop organization plan smoke passed: ${cases} cases, Windows/POSIX${baseline ? ', original plans and I/O order compared' : ''}.`);
