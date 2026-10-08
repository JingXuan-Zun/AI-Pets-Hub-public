const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const helperFile = path.join(__dirname, '../electron/localFileSystemDestinationUtils.cjs');
const source = fs.readFileSync(helperFile, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['getSafeStat', 'getFileManagementDestinationPath', 'getCreateDirectoryPath'];
let cases = 0;

function loadInputs(pathApi) {
  const module = { exports: {} };
  new Function('require', 'module', fs.readFileSync(
    path.join(__dirname, '../electron/localFileSystemInputUtils.cjs'), 'utf8',
  ))(() => pathApi, module);
  return module.exports;
}

function run(pathApi, name, request, sourcePath, statKind, original = false) {
  const trace = [];
  const fakeFs = { statSync(target) {
    trace.push(['stat', target]);
    if (statKind === 'error') throw new Error('stat denied');
    if (statKind === 'missing') return null;
    return { isDirectory() {
      trace.push(['isDirectory']);
      if (statKind === 'method-error') throw new Error('stat method failed');
      return statKind === 'directory';
    } };
  } };
  const inputs = loadInputs(pathApi);
  let functions;
  if (original) {
    const ast = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
    const nodes = ast.statements.filter((node) => ts.isFunctionDeclaration(node)
      && names.includes(node.name.text));
    assert.equal(nodes.length, names.length);
    functions = new Function('fs', 'path', ...Object.keys(inputs),
      `${nodes.map((node) => node.getText(ast)).join('\n')}\nreturn { ${names.join(',')} };`,
    )(fakeFs, pathApi, ...Object.values(inputs));
  } else {
    const module = { exports: {} };
    new Function('require', 'module', source)((id) => {
      if (id === 'fs') return fakeFs;
      if (id === 'path') return pathApi;
      assert.equal(id, './localFileSystemInputUtils.cjs');
      return inputs;
    }, module);
    functions = module.exports;
  }
  try {
    return { value: functions[name](request, sourcePath), trace };
  } catch (error) {
    return { error: error.constructor.name, message: error.message, trace };
  }
}

for (const pathApi of [path.win32, path.posix]) {
  const root = pathApi === path.win32 ? 'C:\\目标' : '/目标';
  const from = pathApi.join(root, '原文件.txt');
  const target = pathApi.join(root, '新文件.txt');
  function check(name, request, kind, expected, expectedTrace) {
    const result = run(pathApi, name, request, from, kind);
    if (expected !== undefined) assert.deepEqual(result.value, expected);
    if (expectedTrace) assert.deepEqual(result.trace, expectedTrace);
    if (baseline) assert.deepEqual(result, run(pathApi, name, request, from, kind, true));
    cases += 1;
    return result;
  }
  const requests = [undefined, {}, null,
    { destinationPath: target }, { destinationPath: 'relative' },
    { destinationDirectory: root }, { destinationDirectory: 'relative', newName: 'safe' },
    { destinationPath: target, newName: 'safe' },
    { destinationDirectory: root, newName: '../bad' },
    { destinationPath: target, destinationDirectory: root, newName: 'safe' },
    { newName: 'safe' }, { newName: '.' }, { newName: '..' },
    { destinationDirectory: root, newName: ' \"新文件.txt\" ' },
    { destinationPath: { toString() { throw new Error('coercion'); } } },
    { get destinationPath() { throw new Error('path getter'); } },
    { destinationPath: target, get newName() { throw new Error('name getter'); } },
  ];
  for (const name of names.slice(1)) {
    for (const request of requests) {
      for (const kind of ['directory', 'file', 'missing', 'error', 'method-error']) {
        check(name, request, kind);
      }
    }
  }
  const absoluteError = { error: 'Path must be an absolute local path.', ok: false, path: 'relative' };
  check(names[1], { destinationPath: 'relative' }, 'directory', absoluteError, []);
  check(names[1], {}, 'directory', { error: 'Missing destination path.', ok: false, path: '' }, []);
  check(names[1], { destinationDirectory: root, newName: '../bad' }, 'directory', {
    error: 'New name must be a single file or folder name.', ok: false, path: '../bad',
  }, []);
  check(names[1], { destinationDirectory: root, newName: '新文件.txt' }, 'directory', {
    ok: true, path: target,
  }, [['stat', root], ['isDirectory']]);
  check(names[1], { destinationPath: root }, 'directory', { ok: true, path: from });
  check(names[1], { destinationPath: target }, 'error', { ok: true, path: target });
  check(names[1], { destinationDirectory: root }, 'error', {
    error: 'Destination directory must be an existing folder.', ok: false, path: root,
  });
  check(names[1], { destinationPath: target, newName: 'safe' }, 'file', {
    error: 'Use destinationDirectory with newName, or provide a full destinationPath without newName.',
    ok: false, path: target,
  });
  check(names[2], { destinationDirectory: root }, 'directory', {
    error: 'New folder name must be a single folder name.', ok: false, path: '',
  }, []);
  check(names[2], { destinationDirectory: root, newName: 'safe' }, 'file', {
    error: 'Parent directory must be an existing folder.', ok: false, path: root,
  });
  check(names[2], { destinationDirectory: root, newName: 'safe' }, 'directory', {
    ok: true, path: pathApi.join(root, 'safe'),
  });
  check(names[2], { destinationPath: target }, 'directory', { ok: true, path: target }, []);
  for (const [name, fields] of [
    [names[1], ['destinationPath', 'targetPath', 'newPath', 'destination', 'dest', 'to']],
    [names[2], ['destinationPath', 'targetPath', 'path', 'query', 'to']],
  ]) {
    for (let index = 0; index < fields.length; index += 1) {
      const request = Object.fromEntries(fields.slice(0, index).map((field) => [field, '']));
      request[fields[index]] = target;
      for (const field of fields.slice(index + 1)) {
        Object.defineProperty(request, field, { get() { throw new Error('must short circuit'); } });
      }
      check(name, request, 'file', { ok: true, path: target });
    }
  }
  for (const [name, fields] of [
    [names[1], ['destinationDirectory', 'targetDirectory', 'folderPath', 'directoryPath']],
    [names[2], ['destinationDirectory', 'targetDirectory', 'folderPath', 'parentPath']],
  ]) {
    for (const field of fields) check(name, { [field]: root, newName: 'safe' }, 'directory', {
      ok: true, path: pathApi.join(root, 'safe'),
    });
  }
  for (const kind of ['missing', 'error']) check('getSafeStat', root, kind, null);
  assert.equal(check(names[1], { destinationPath: root }, 'method-error').message, 'stat method failed');
}

const ast = ts.createSourceFile(helperFile, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
for (const node of ast.statements.filter(ts.isFunctionDeclaration)) {
  assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
    - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name.text);
}
if (baseline) {
  const oldAst = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
  let expected = baseline;
  const removed = oldAst.statements.filter((node) => ts.isFunctionDeclaration(node)
    && names.includes(node.name.text));
  for (const node of removed.sort((a, b) => b.pos - a.pos)) {
    expected = expected.slice(0, node.pos) + expected.slice(node.end);
    if (node.name.text !== names[1]) {
      assert.equal(ast.statements.find((entry) => ts.isFunctionDeclaration(entry)
        && entry.name.text === node.name.text).getText(ast), node.getText(oldAst));
    }
  }
  expected = expected.replace("} = require('./localFileSystemInputUtils.cjs');",
    "} = require('./localFileSystemInputUtils.cjs');\nconst {\n  getSafeStat,\n  getFileManagementDestinationPath,\n  getCreateDirectoryPath,\n} = require('./localFileSystemDestinationUtils.cjs');");
  assert.equal(fs.readFileSync(path.join(__dirname, '../electron/localFileSystemService.cjs'), 'utf8'), expected);
}
console.log(`local filesystem destination smoke passed: ${cases} cases, Windows/POSIX${baseline ? ', original results and I/O order compared' : ''}.`);
