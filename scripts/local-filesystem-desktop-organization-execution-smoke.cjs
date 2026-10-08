const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.join(__dirname, '../electron/localFileSystemDesktopOrganizationExecution.cjs');
const source = fs.readFileSync(file, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['createDesktopFileOrganizationResult', 'executeDesktopFileOrganizationPlan'];
let cases = 0;

function createPlan(pathApi, config) {
  const desktop = pathApi === path.win32 ? 'C:\\桌面' : '/桌面';
  const root = pathApi.join(desktop, '整理');
  const groups = config.empty ? [] : ['Images', 'Documents'].map((label) => ({
    count: label === 'Images' ? 2 : 1, destinationDirectory: pathApi.join(root, label), key: label, label,
  }));
  const items = config.empty ? [] : ['photo2.png', 'photo10.png', '中文.pdf'].map((name, index) => ({
    name, sourcePath: pathApi.join(desktop, name),
    destinationDirectory: groups[index < 2 ? 0 : 1].destinationDirectory,
    destinationPath: pathApi.join(groups[index < 2 ? 0 : 1].destinationDirectory, name),
  }));
  return { conflicts: config.conflict ? [{ name: 'photo2.png' }] : [], destinationRoot: root,
    desktopPath: desktop, groupBy: 'category', groups, items, skipped: [], truncated: false };
}

function run(pathApi, config, original = false) {
  const trace = [];
  const plan = createPlan(pathApi, config);
  const files = new Map(plan.items.map((item) => [item.sourcePath, 'file']));
  if (config.rootExists) files.set(plan.destinationRoot, 'directory');
  if (config.groupsExist) for (const group of plan.groups) files.set(group.destinationDirectory, 'directory');
  const counters = { stat: 0, mkdir: 0, rename: 0 };
  function fault(kind) {
    counters[kind] += 1;
    if (config.fault?.kind === kind && counters[kind] === config.fault.at) {
      if (config.fault.value === 'string') throw 'primitive failure';
      if (config.fault.value === 'null') throw null;
      throw new Error(`${kind} failed`);
    }
  }
  const fakeFs = {
    statSync(target) {
      trace.push(['stat', target]);
      fault('stat');
      if (!files.has(target)) throw new Error('ENOENT');
      return { kind: files.get(target) };
    },
    mkdirSync(target, options) {
      trace.push(['mkdir', target, options]);
      fault('mkdir');
      files.set(target, 'directory');
      trace.push(['created', target]);
    },
    renameSync(from, to) {
      trace.push(['rename', from, to]);
      fault('rename');
      const kind = files.get(from);
      if (!config.retainSource) files.delete(from);
      if (!config.dropDestination) files.set(to, kind);
      trace.push(['renamed', from, to]);
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
    const nodes = ast.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name.text));
    functions = new Function('fs', 'getSafeStat', 'FILE_MANAGEMENT_ACTION_LABELS',
      `${nodes.map((node) => node.getText(ast)).join('\n')}\nreturn { ${names.join(',')} };`,
    )(fakeFs, load(path.join(__dirname, '../electron/localFileSystemDestinationUtils.cjs')).getSafeStat,
      load(path.join(__dirname, '../electron/localFileSystemActionResults.cjs')).FILE_MANAGEMENT_ACTION_LABELS);
  }
  try {
    return { value: functions.executeDesktopFileOrganizationPlan(plan), trace, files: [...files] };
  } catch (error) {
    return { error: error.constructor.name, message: error.message, trace, files: [...files] };
  }
}

for (const pathApi of [path.win32, path.posix]) {
  for (const rootExists of [false, true]) {
    for (const groupsExist of [false, true]) {
      const faults = [undefined,
        ...['mkdir', 'rename'].flatMap((kind) => [1, 2, 3].flatMap((at) =>
          ['error', 'string', 'null'].map((value) => ({ kind, at, value })))),
        ...Array.from({ length: 12 }, (_, index) => ({ kind: 'stat', at: index + 1 }))];
      for (const fault of faults) {
        for (const extra of [{}, { empty: true }, { conflict: true }, { retainSource: true }, { dropDestination: true }]) {
          const config = { rootExists, groupsExist, fault, ...extra };
          const result = run(pathApi, config);
          if (baseline) assert.deepEqual(result, run(pathApi, config, true));
          assert.ok(result.value);
          assert.equal(result.value.movedItemCount, result.trace.filter((event) => event[0] === 'renamed').length);
          assert.equal(result.value.changedPaths.length, result.value.movedItemCount * 2);
          assert.deepEqual(result.value.createdDirectories, result.trace.filter((event) => event[0] === 'created').map((event) => event[1]));
          assert.equal(result.value.ok, result.value.verified);
          if (extra.conflict) {
            assert.deepEqual(result.trace, []);
            assert.equal(result.value.error, 'Destination conflicts exist; no files were moved.');
          }
          if (!fault && !extra.conflict && !extra.retainSource && !extra.dropDestination) assert.equal(result.value.ok, true);
          if (!fault && (extra.retainSource || extra.dropDestination)) assert.equal(result.value.verified, false);
          cases += 1;
        }
      }
    }
  }
}

const { createDesktopFileOrganizationResult } = require(file);
const plan = createPlan(path.posix, {});
plan.items = Array.from({ length: 85 }, (_, index) => ({ name: `item${index}` }));
plan.conflicts = Array.from({ length: 23 }, (_, index) => ({ name: `conflict${index}` }));
plan.skipped = Array.from({ length: 35 }, (_, index) => ({ name: `skip${index}` }));
for (const dryRun of [false, true, 'yes']) {
  const changedPaths = ['/source', '/target'];
  const createdDirectories = ['/created'];
  const result = createDesktopFileOrganizationResult(plan, { dryRun, changedPaths, createdDirectories, movedItemCount: 1, ok: false, verified: false });
  assert.equal(result.planItems.length, 80);
  assert.equal(result.conflicts.length, 20);
  assert.equal(result.skipped.length, 30);
  assert.equal(result.plannedItemCount, 85);
  assert.equal(result.conflictCount, 23);
  assert.equal(result.skippedItemCount, 35);
  assert.equal(result.changedPaths, changedPaths);
  assert.equal(result.createdDirectories, createdDirectories);
  assert.equal(result.groups, plan.groups);
  assert.equal(result.willOverwrite, true);
  assert.equal(result.dryRun, Boolean(dryRun));
  assert.equal(result.responseText, `Desktop file organization ${dryRun ? 'preview ready' : 'completed'}: 85 item(s), 2 group(s), 23 conflict(s).`);
  cases += 1;
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
  const nodes = oldAst.statements.filter((node) => ts.isFunctionDeclaration(node) && names.includes(node.name.text));
  assert.equal(nodes.length, 2);
  assert.equal(ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name.text === names[0]).getText(ast),
    nodes.find((node) => node.name.text === names[0]).getText(oldAst));
  let expected = baseline;
  for (const node of nodes.sort((a, b) => b.pos - a.pos)) expected = expected.slice(0, node.pos) + expected.slice(node.end);
  expected = expected.replace('  FILE_MANAGEMENT_ACTION_LABELS,\n', '').replace(
    "const { createDesktopFileOrganizationPlan } = require('./localFileSystemDesktopOrganizationPlan.cjs');",
    "const { createDesktopFileOrganizationPlan } = require('./localFileSystemDesktopOrganizationPlan.cjs');\nconst { createDesktopFileOrganizationResult, executeDesktopFileOrganizationPlan } = require('./localFileSystemDesktopOrganizationExecution.cjs');");
  assert.equal(fs.readFileSync(path.join(__dirname, '../electron/localFileSystemService.cjs'), 'utf8'), expected);
}
console.log(`local filesystem desktop organization execution smoke passed: ${cases} cases${baseline ? ', original results, file state and I/O order compared' : ''}.`);
