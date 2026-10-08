const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.join(__dirname, '../electron/localFileSystemService.cjs');
const helperFile = path.join(__dirname, '../electron/localFileSystemDirectoryActions.cjs');
const current = fs.readFileSync(rootFile, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let cases = 0;

async function run(pathApi, factory, config, original = false) {
  const home = pathApi === path.win32 ? 'C:\\用户' : '/用户';
  const desktop = pathApi.join(home, 'Desktop');
  const target = pathApi.join(desktop, 'New');
  const organizeRoot = pathApi.join(desktop, 'Desktop Organized');
  const itemSource = pathApi.join(desktop, 'file.txt');
  const itemDestination = pathApi.join(organizeRoot, 'Documents', 'file.txt');
  const files = new Map([[home, 'directory'], [itemSource, 'file']]);
  if (!config.parentMissing) files.set(desktop, 'directory');
  if (config.conflict) { files.set(target, 'directory'); files.set(itemDestination, 'file'); }
  const trace = [];
  function fault(stage) {
    if (config.fault !== stage) return;
    if (config.primitive) throw 'primitive failure';
    throw new Error(`${stage} failed`);
  }
  const fakeFs = {
    constants: { COPYFILE_EXCL: 1 },
    statSync(targetPath) {
      trace.push(['stat', targetPath]); fault('stat');
      if (!files.has(targetPath)) throw new Error('ENOENT');
      return { size: 42, birthtimeMs: 1, mtimeMs: 2,
        isDirectory() { trace.push(['directory', targetPath]); fault('method'); return files.get(targetPath) === 'directory'; },
        isFile() { trace.push(['file', targetPath]); return files.get(targetPath) === 'file'; },
      };
    },
    readdirSync(targetPath, options) {
      trace.push(['read', targetPath, options]); fault('read');
      return [{ name: 'file.txt', isDirectory: () => false, isFile: () => true }];
    },
    mkdirSync(targetPath, options) {
      trace.push(['mkdir', targetPath, options]); fault('mkdir'); files.set(targetPath, 'directory');
    },
    renameSync(from, to) {
      trace.push(['rename', from, to]); fault('rename'); files.set(to, files.get(from)); files.delete(from);
    },
  };
  const cache = new Map();
  function requireFrom(id, from) {
    if (id === 'fs') return fakeFs;
    if (id === 'path') return pathApi;
    if (id === 'os') return { homedir: () => home };
    assert.ok(id.startsWith('./'));
    const targetFile = path.resolve(path.dirname(from), id);
    if (cache.has(targetFile)) return cache.get(targetFile);
    const module = { exports: {} };
    new Function('require', 'module', fs.readFileSync(targetFile, 'utf8'))(
      (child) => requireFrom(child, targetFile), module);
    cache.set(targetFile, module.exports);
    return module.exports;
  }
  const text = original ? baseline : current;
  const ast = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
  const imports = ast.statements.filter((node) => ts.isVariableStatement(node));
  const fn = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name.text === 'executeFileManagementAction');
  const execute = new Function('require', `${imports.map((node) => node.getText(ast)).join('\n')}
    ${fn.getText(ast)}\nreturn executeFileManagementAction;`)((id) => requireFrom(id, rootFile));
  try {
    const value = await execute(factory(trace, desktop, target), {});
    return { value, trace, files: [...files] };
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
  for (const action of ['create_directory', 'organize_desktop_files']) {
    for (const preview of ['execute', 'dryRun', 'preview']) {
      for (const fault of [undefined, 'stat', 'method', 'read', 'mkdir', 'rename']) {
        for (const parentMissing of [false, true]) {
          for (const conflict of [false, true]) {
            for (const overwrite of [false, true]) {
              const result = await check(pathApi, (trace, desktop, target) => ({
                action: preview === 'preview' ? 'preview' : action, intendedAction: action,
                dryRun: preview === 'dryRun', destinationPath: action === 'create_directory' ? target : undefined,
                desktopPath: desktop, overwrite,
              }), { fault, parentMissing, conflict, overwrite });
              if (preview !== 'execute') assert.ok(!result.trace.some((event) => ['mkdir', 'rename'].includes(event[0])));
              if (!fault && !parentMissing && !conflict && !overwrite) assert.equal(result.value.ok, true);
            }
          }
        }
      }
    }
  }
  for (const action of ['create_directory', 'organize_desktop_files']) {
    for (const fault of ['mkdir', 'rename', 'read']) {
      await check(pathApi, (trace, desktop, target) => ({ action, destinationPath: action === 'create_directory' ? target : undefined, desktopPath: desktop }), { fault, primitive: true });
    }
  }
  const invalid = await check(pathApi, () => ({ action: 'create_directory', destinationPath: 'relative' }));
  assert.equal(invalid.value.ok, false);
  assert.deepEqual(invalid.trace, []);
  await check(pathApi, (trace, desktop) => ({ action: 'mkdir', destinationDirectory: desktop, newName: '中文' }));
  await check(pathApi, () => ({ action: 'preview' }));
  const getter = await check(pathApi, (trace, desktop, target) => ({ action: 'create_directory', destinationPath: target,
    get overwrite() { trace.push('overwrite getter'); return false; },
  }));
  assert.equal(getter.value.ok, true);
}
const text = fs.readFileSync(helperFile, 'utf8');
const ast = ts.createSourceFile(helperFile, text, ts.ScriptTarget.Latest, true);
assert.ok(text.split('\n').length <= 300);
for (const node of ast.statements.filter(ts.isFunctionDeclaration)) {
  assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
    - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name.text);
}
if (baseline) {
  const oldAst = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const fn = oldAst.statements.find((node) => ts.isFunctionDeclaration(node) && node.name.text === 'executeFileManagementAction');
  const branches = [['organize_desktop_files', 'executeDesktopOrganizationAction'], ['create_directory', 'executeCreateDirectoryAction']]
    .map(([action, name]) => ({ name, node: fn.body.statements.find((node) => ts.isIfStatement(node)
      && node.expression.getText(oldAst) === `action === '${action}'`) }));
  let expected = baseline;
  for (const { name, node } of branches.sort((a, b) => b.node.pos - a.node.pos)) {
    const moved = ast.statements.find((entry) => ts.isFunctionDeclaration(entry) && entry.name.text === name);
    assert.equal(moved.body.getText(ast).slice(1, -1), node.thenStatement.getText(oldAst).slice(1, -1).replace(/^  /gm, ''));
    expected = expected.slice(0, node.getStart(oldAst)) + `if (${node.expression.getText(oldAst)}) {\n    return ${name}(request, dryRun, action);\n  }` + expected.slice(node.end);
  }
  expected = expected.replace("const { createDesktopFileOrganizationPlan } = require('./localFileSystemDesktopOrganizationPlan.cjs');\nconst { createDesktopFileOrganizationResult, executeDesktopFileOrganizationPlan } = require('./localFileSystemDesktopOrganizationExecution.cjs');",
    "const { executeDesktopOrganizationAction, executeCreateDirectoryAction } = require('./localFileSystemDirectoryActions.cjs');");
  assert.equal(current, expected);
}
console.log(`local filesystem directory actions smoke passed: ${cases} cases${baseline ? ', original async outcomes, file state and I/O order compared' : ''}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
