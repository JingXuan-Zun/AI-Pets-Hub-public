const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.join(__dirname, '../electron/localFileSystemService.cjs');
const helperFile = path.join(__dirname, '../electron/localFileSystemActionInputs.cjs');
const current = fs.readFileSync(rootFile, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let cases = 0;

async function run(pathApi, requestFactory, config, original = false) {
  const root = pathApi === path.win32 ? 'C:\\文件' : '/文件';
  const from = pathApi.join(root, 'source.txt');
  const to = pathApi.join(root, 'target.txt');
  const files = new Map([[root, 'directory'], [from, config.kind || 'file']]);
  if (config.destinationExists) files.set(to, 'file');
  if (config.parentMissing) files.delete(root);
  const trace = [];
  let statCount = 0;
  function fault(stage) {
    if (config.fault !== stage) return;
    if (config.primitive) throw 'primitive failure';
    throw new Error(`${stage} failed`);
  }
  function performMove(sourcePath, targetPath, copy) {
    if (!copy && !config.retainSource) files.delete(sourcePath);
    if (!config.dropDestination) files.set(targetPath, config.kind || 'file');
  }
  const fakeFs = {
    constants: { COPYFILE_EXCL: 123 },
    statSync(target) {
      trace.push(['stat', target]);
      if (++statCount === config.statFailureAt || !files.has(target)) throw new Error('stat failed');
      const kind = files.get(target);
      return { isDirectory() { trace.push(['directory', target]); return kind === 'directory'; },
        isFile() { trace.push(['file', target]); return kind === 'file'; } };
    },
    renameSync(sourcePath, targetPath) { trace.push(['rename', sourcePath, targetPath]); fault('rename'); performMove(sourcePath, targetPath, false); },
    copyFileSync(sourcePath, targetPath, flags) {
      trace.push(['copyFile', sourcePath, targetPath, flags]); assert.equal(flags, 123);
      fault('copy'); performMove(sourcePath, targetPath, true);
    },
    cpSync(sourcePath, targetPath, options) {
      trace.push(['cp', sourcePath, targetPath, options]);
      assert.deepEqual(options, { errorOnExist: true, force: false, recursive: true });
      fault('copy'); performMove(sourcePath, targetPath, true);
    },
  };
  const shell = {};
  let release;
  if (['modern', 'both', 'false-modern', 'deferred'].includes(config.shell)) {
    shell.trashItem = async function(target) {
      trace.push(['trash', target, this === shell]);
      if (config.shell === 'deferred') await new Promise((resolve) => { release = resolve; });
      fault('trash');
      if (!config.retainSource) files.delete(target);
      return config.shell !== 'false-modern';
    };
  }
  if (['legacy', 'both', 'false-legacy'].includes(config.shell)) {
    shell.moveItemToTrash = function(target) {
      trace.push(['legacyTrash', target, this === shell]); fault('trash');
      if (config.shell === 'false-legacy') return false;
      if (!config.retainSource) files.delete(target);
      return true;
    };
  }
  const options = { get shell() { trace.push('shell getter'); return config.shell === 'missing' ? undefined : shell; } };
  const cache = new Map();
  function requireFrom(id, owner) {
    if (id === 'fs') return fakeFs;
    if (id === 'path') return pathApi;
    if (id === 'os') return { homedir: () => root };
    assert.ok(id.startsWith('./'));
    const target = path.resolve(path.dirname(owner), id);
    if (cache.has(target)) return cache.get(target);
    const module = { exports: {} };
    new Function('require', 'module', fs.readFileSync(target, 'utf8'))((child) => requireFrom(child, target), module);
    cache.set(target, module.exports);
    return module.exports;
  }
  const text = original ? baseline : current;
  const ast = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
  const imports = ast.statements.filter(ts.isVariableStatement);
  const fn = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name.text === 'executeFileManagementAction');
  const execute = new Function('require', `${imports.map((node) => node.getText(ast)).join('\n')}
    ${fn.getText(ast)}\nreturn executeFileManagementAction;`)((id) => requireFrom(id, rootFile));
  try {
    const pending = execute(requestFactory(trace, from, to), options);
    if (release) {
      assert.ok(files.has(from));
      trace.push('release trash');
      release();
    }
    return { value: await pending, trace, files: [...files] };
  } catch (error) {
    return { error: error.constructor.name, message: error.message, trace, files: [...files] };
  }
}

async function check(pathApi, factory, config = {}) {
  const result = await run(pathApi, factory, config);
  if (baseline) assert.deepEqual(result, await run(pathApi, factory, config, true));
  cases += 1;
  return result;
}

async function main() {
  for (const pathApi of [path.win32, path.posix]) {
    for (const action of ['move_path', 'copy_path', 'rename_path']) {
      for (const kind of ['file', 'directory']) {
        for (const dryRun of [false, true]) {
          for (const extra of [{}, { destinationExists: true }, { parentMissing: true }, { retainSource: true },
            { dropDestination: true }, { fault: 'rename' }, { fault: 'copy', primitive: true },
            ...Array.from({ length: 8 }, (_, index) => ({ statFailureAt: index + 1 }))]) {
            const result = await check(pathApi, (trace, from, to) => ({ action, sourcePath: from,
              destinationPath: to, newName: action === 'rename_path' ? 'target.txt' : undefined, dryRun }), { kind, ...extra });
            if (dryRun) assert.ok(!result.trace.some((event) => ['rename', 'copyFile', 'cp'].includes(event[0])));
            if (!Object.keys(extra).length) assert.equal(result.value.ok, true);
          }
        }
      }
    }
    for (const shell of ['modern', 'legacy', 'both', 'false-modern', 'false-legacy', 'missing', 'empty', 'deferred']) {
      for (const dryRun of [false, true]) {
        for (const extra of [{}, { retainSource: true }, { fault: 'trash' }, { fault: 'trash', primitive: true }]) {
          const result = await check(pathApi, (trace, from) => ({ action: 'trash_path', sourcePath: from, dryRun }), { shell, ...extra });
          if (dryRun) assert.ok(!result.trace.some((event) => ['trash', 'legacyTrash'].includes(event[0])));
          if (shell === 'both') assert.ok(!result.trace.some((event) => event[0] === 'legacyTrash'));
          if (shell === 'false-modern' && !dryRun && !Object.keys(extra).length) assert.equal(result.value.ok, true);
          if (shell === 'false-legacy' && !dryRun) assert.equal(result.value.ok, false);
        }
      }
    }
    const denied = await check(pathApi, (trace, from, to) => ({ action: 'copy_path', sourcePath: from, destinationPath: to, overwrite: true }));
    assert.equal(denied.value.ok, false);
    assert.ok(!denied.trace.some((event) => ['copyFile', 'cp'].includes(event[0])));
  }
  for (const pathApi of [path.win32, path.posix]) {
    for (const factory of [
      (trace, from) => ({ action: 'move_path', sourcePath: from, destinationPath: from }),
      (trace, from) => ({ action: 'copy_path', sourcePath: from, destinationPath: pathApi.join(from, 'child') }),
      (trace, from) => ({ action: 'copy_path', sourcePath: from, destinationPath: 'relative' }),
      (trace, from) => ({ action: 'copy_path', sourcePath: from, destinationPath: pathApi.join(pathApi.dirname(from), 'missing', 'child') }),
      () => ({ action: 'move_path', sourcePath: 'relative', get destinationPath() { throw Error('must not read destination'); } }),
      () => ({ action: 'rename_path', sourcePath: 'relative' }),
      (trace, from) => ({ action: 'rename_path', sourcePath: from, newName: '../bad' }),
      (trace, from) => ({ action: 'rename_path', sourcePath: from }),
      () => ({ action: 'preview' }),
      () => ({ action: 'unsupported' }),
    ]) {
      const result = await check(pathApi, factory, { kind: 'directory' });
      assert.equal(result.value.ok, false);
      assert.ok(!result.trace.some(event => ['rename','copyFile','cp'].includes(event[0])));
    }
    for (const field of ['action','fileAction','operation']) {
      await check(pathApi, (trace, from, to) => ({ [field]: 'copy', sourcePath: from, destinationPath: to }));
    }
    for (const field of ['intendedAction','previewAction','targetAction','operationType']) {
      const result = await check(pathApi, (trace, from, to) => ({ action: 'preview', [field]: 'copy', sourcePath: from, destinationPath: to }));
      assert.equal(result.value.dryRun, true);
    }
    for (const field of ['newName','name','fileName','folderName']) {
      const result = await check(pathApi, (trace, from) => ({ action: 'rename_path', sourcePath: from, [field]: '中文.txt' }));
      assert.equal(result.value.ok, true);
    }
    await check(pathApi, (trace, from, to) => ({ action: 'copy_path', sourcePath: from, destinationPath: to,
      get overwrite() { trace.push('overwrite'); return false; },
      get dryRun() { trace.push('dryRun'); return false; },
    }));
    const throwing = await check(pathApi, () => ({ get action() { throw Error('action getter failed'); } }));
    assert.equal(throwing.message, 'action getter failed');
  }
  const text = fs.readFileSync(helperFile, 'utf8');
  const ast = ts.createSourceFile(helperFile, text, ts.ScriptTarget.Latest, true);
  assert.ok(text.split('\n').length <= 300);
  for (const node of ast.statements.filter(ts.isFunctionDeclaration)) {
    assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
      - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name.text);
  }
  console.log(`local filesystem action inputs smoke passed: ${cases} cases${baseline ? ', original async outcomes, receivers, file state and I/O order compared' : ''}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
