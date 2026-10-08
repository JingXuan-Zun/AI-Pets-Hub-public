const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const helperPath = path.join(__dirname, '../electron/localFileSystemInputUtils.cjs');
const helperSource = fs.readFileSync(helperPath, 'utf8');
const names = Object.keys(require(helperPath));
let assertions = 0;

function loadHelper(pathApi) {
  const module = { exports: {} };
  new Function('require', 'module', helperSource)((name) => {
    assert.equal(name, 'path');
    return pathApi;
  }, module);
  return module.exports;
}

function loadOriginal(source, pathApi) {
  const ast = ts.createSourceFile('original.cjs', source, ts.ScriptTarget.Latest, true);
  const nodes = ast.statements.filter((node) => ts.isFunctionDeclaration(node)
    && names.includes(node.name.text));
  assert.equal(nodes.length, names.length);
  return new Function('path', `${nodes.map((node) => node.getText(ast)).join('\n')}
    return { ${names.join(', ')} };`)(pathApi);
}

function outcome(fn, args) {
  try {
    return { value: fn(...args) };
  } catch (error) {
    return { error: error.constructor.name, message: error.message };
  }
}

const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
for (const pathApi of [path.win32, path.posix]) {
  const helper = loadHelper(pathApi);
  const original = baseline ? loadOriginal(baseline, pathApi) : null;
  function check(name, args, expected) {
    const result = outcome(helper[name], args);
    if (arguments.length === 3) assert.deepEqual(result, { value: expected }, name);
    if (original) assert.deepEqual(result, outcome(original[name], args), name);
    assertions += 1;
    return result;
  }
  for (const name of ['normalizeInputPath', 'normalizeInputName']) {
    for (const [input, expected] of [
      [undefined, ''], [null, ''], [false, ''], [0, ''], [42, '42'],
      [' \"`\' 中文 文件 `\'\" ', '中文 文件'], [' a`b ', 'a`b'],
    ]) check(name, [input], expected);
    const coercionError = { toString() { throw new Error('coercion failure'); } };
    assert.equal(check(name, [coercionError]).error, 'Error');
  }
  for (const [input, expected] of [
    [NaN, 7], [Infinity, 7], ['bad', 7], [null, 1], [2.5, 3], [-4, 1], [99, 10],
  ]) check('clampInteger', [input, 7, 1, 10], expected);
  assert.equal(check('clampInteger', [Symbol('bad'), 7, 1, 10]).error, 'TypeError');
  const aliases = {
    preview: ['plan', 'preview', 'dry_run'],
    move_path: ['move', 'move_path', 'move_file', 'move_folder'],
    organize_desktop_files: ['organize_desktop', 'organize_desktop_file',
      'organize_desktop_files', 'organize_desktop_items', 'desktop_file_organization'],
    copy_path: ['copy', 'copy_path', 'copy_file', 'copy_folder'],
    rename_path: ['rename', 'rename_path', 'rename_file', 'rename_folder'],
    create_directory: ['mkdir', 'new_folder', 'create_folder', 'create_directory'],
    trash_path: ['trash', 'trash_path', 'recycle', 'recycle_path'],
  };
  for (const [expected, inputs] of Object.entries(aliases)) {
    for (const input of inputs) {
      check('normalizeFileManagementAction', [input], expected);
      check('normalizeFileManagementAction', [` ${input.toUpperCase().replaceAll('_', ' - ')} `], expected);
    }
  }
  for (const input of ['', null, 'delete', 'move__file', 'copy.path']) {
    check('normalizeFileManagementAction', [input], '');
  }
  for (const input of ['', '.', '..', '../file', 'folder/file', 'folder\\file']) {
    check('isSafeFileName', [input], false);
  }
  check('isSafeFileName', [' \"中文.txt\" '], true);
  const root = pathApi === path.win32 ? 'C:\\root' : '/root';
  const child = pathApi.join(root, '中文.txt');
  check('normalizeAbsolutePath', [''], { error: 'Missing path.', ok: false, path: '' });
  check('normalizeAbsolutePath', ['relative'], {
    error: 'Path must be an absolute local path.', ok: false, path: 'relative',
  });
  check('normalizeAbsolutePath', [` \"${child}\" `], { ok: true, path: child });
  check('isPathInside', [child, root], true);
  check('isPathInside', [root, root], false);
  check('isPathInside', [pathApi.dirname(root), root], false);
  check('isPathInside', [root + '-sibling', root], false);
  if (pathApi === path.win32) {
    check('isPathInside', ['D:\\root\\child', root], false);
    check('isPathInside', ['c:\\ROOT\\child', root], true);
    check('normalizeAbsolutePath', ['\\\\server\\share\\file'], {
      ok: true, path: '\\\\server\\share\\file',
    });
  }
  const fields = ['sourcePath', 'source', 'from', 'path', 'query'];
  for (let index = 0; index < fields.length; index += 1) {
    const request = Object.fromEntries(fields.slice(0, index).map((field) => [field, '']));
    request[fields[index]] = child;
    for (const field of fields.slice(index + 1)) {
      Object.defineProperty(request, field, { get() { throw new Error('must short circuit'); } });
    }
    check('getFileManagementSourcePath', [request], { ok: true, path: child });
  }
  check('getFileManagementSourcePath', [], { error: 'Missing path.', ok: false, path: '' });
  assert.equal(check('getFileManagementSourcePath', [null]).error, 'TypeError');
  const getterError = { get sourcePath() { throw new Error('source getter'); } };
  assert.equal(check('getFileManagementSourcePath', [getterError]).error, 'Error');
  check('getPathKind', [null], 'missing');
  check('getPathKind', [{ isDirectory: () => true }], 'directory');
  check('getPathKind', [{ isDirectory: () => false, isFile: () => true }], 'file');
  for (const symlink of [false, true, undefined]) {
    check('getPathKind', [{ isDirectory: () => false, isFile: () => false,
      ...(symlink === undefined ? {} : { isSymbolicLink: () => symlink }) }],
    symlink ? 'symlink' : 'other');
  }
  assert.equal(check('getPathKind', [{}]).error, 'TypeError');
}

const ast = ts.createSourceFile(helperPath, helperSource, ts.ScriptTarget.Latest, true);
assert.ok(helperSource.split('\n').length <= 300);
for (const node of ast.statements.filter(ts.isFunctionDeclaration)) {
  const first = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line;
  const last = ast.getLineAndCharacterOfPosition(node.end).line;
  assert.ok(last - first + 1 <= 50, node.name.text);
}
if (baseline) {
  const oldAst = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
  let expected = baseline;
  const removed = oldAst.statements.filter((node) => ts.isFunctionDeclaration(node)
    && names.includes(node.name.text));
  for (const node of removed.sort((a, b) => b.pos - a.pos)) {
    const moved = ast.statements.find((entry) => ts.isFunctionDeclaration(entry)
      && entry.name.text === node.name.text);
    assert.equal(moved.getText(ast), node.getText(oldAst));
    expected = expected.slice(0, node.pos) + expected.slice(node.end);
  }
  const importText = `const {\n${names.map((name) => `  ${name},`).join('\n')}\n} = require('./localFileSystemInputUtils.cjs');`;
  expected = expected.replace("const path = require('path');", "const path = require('path');\n" + importText);
  assert.equal(fs.readFileSync(path.join(__dirname, '../electron/localFileSystemService.cjs'), 'utf8'), expected);
}
console.log(`local filesystem input smoke passed: ${assertions} cases, Windows/POSIX${baseline ? ', original comparison' : ''}.`);
