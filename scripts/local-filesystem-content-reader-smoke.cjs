const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.join(__dirname, '../electron/localFileSystemContentReader.cjs');
const source = fs.readFileSync(file, 'utf8');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const names = ['looksBinary', 'readTextFile', 'readFileDataUrl'];
const constants = ['DEFAULT_READ_MAX_BYTES', 'MAX_READ_BYTES', 'IMAGE_MIME_TYPES'];
let cases = 0;

function run(pathApi, name, factory, config, original = false) {
  const trace = [];
  const target = pathApi === path.win32 ? 'C:\\文件\\内容.txt' : '/文件/内容.txt';
  const data = config.data || Buffer.from('中文 text');
  function fail(stage) {
    if (!config[stage]) return;
    if (config[stage] === 'null') throw null;
    if (config[stage] === 'string') throw `${stage} failed`;
    throw new Error(`${stage} failed`);
  }
  const fakeFs = {
    statSync(targetPath) {
      trace.push(['stat', targetPath]);
      if (config.kind === 'missing') throw new Error('missing');
      return {
        get size() { trace.push('size'); fail('sizeError'); return config.size ?? data.length; },
        get mtimeMs() { trace.push('mtime'); fail('mtimeError'); return 0; },
        isFile() { trace.push('file'); fail('methodError'); return !config.kind || config.kind === 'file'; },
        isDirectory() { trace.push('directory'); return config.kind === 'directory'; },
        isSymbolicLink() { trace.push('symlink'); return config.kind === 'symlink'; },
      };
    },
    openSync(targetPath, mode) {
      trace.push(['open', targetPath, mode]);
      fail('openError');
      return config.fd ?? 0;
    },
    readSync(fd, buffer, offset, length, position) {
      trace.push(['read', fd, offset, length, position]);
      fail('readError');
      const amount = config.partial ? Math.max(0, length - 1) : length;
      return data.copy(buffer, offset, position, position + amount);
    },
    closeSync(fd) { trace.push(['close', fd]); fail('closeError'); },
    readFileSync(targetPath) { trace.push(['readFile', targetPath]); fail('imageError'); return data; },
  };
  const cache = new Map();
  function load(targetFile) {
    if (cache.has(targetFile)) return cache.get(targetFile);
    const module = { exports: {} };
    new Function('require', 'module', fs.readFileSync(targetFile, 'utf8'))((id) => {
      if (id === 'fs') return fakeFs;
      if (id === 'path') return pathApi;
      assert.ok(id.startsWith('./'));
      return load(path.resolve(path.dirname(targetFile), id));
    }, module);
    cache.set(targetFile, module.exports);
    return module.exports;
  }
  let functions = load(file);
  if (original) {
    const ast = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
    const nodes = ast.statements.filter((node) => (ts.isFunctionDeclaration(node) && names.includes(node.name.text))
      || (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => constants.includes(d.name.getText(ast)))));
    const helpers = Object.assign({}, ...['localFileSystemInputUtils.cjs', 'localFileSystemDestinationUtils.cjs']
      .map((name) => load(path.join(__dirname, '../electron', name))));
    functions = new Function('fs', 'path', ...Object.keys(helpers),
      `${nodes.map((node) => node.getText(ast)).join('\n')}\nreturn { ${names.join(',')} };`,
    )(fakeFs, pathApi, ...Object.values(helpers));
  }
  try {
    return { value: functions[name](factory(trace, target)), trace };
  } catch (error) {
    return { error: error.constructor.name, message: error.message, trace };
  }
}

function check(pathApi, name, factory, config = {}) {
  const result = run(pathApi, name, factory, config);
  if (baseline) assert.deepEqual(result, run(pathApi, name, factory, config, true));
  cases += 1;
  return result;
}

for (const pathApi of [path.win32, path.posix]) {
  for (const data of [Buffer.alloc(0), Buffer.from('abc'), Buffer.from('中文 text'), Buffer.from([65, 0, 66]),
    Buffer.alloc(4097, 65)]) {
    for (const maxBytes of [undefined, 1, 3, 999999]) {
      for (const faults of [{}, { openError: true }, { readError: 'null' }, { closeError: 'string' },
        { readError: true, closeError: true }, { partial: true }, { mtimeError: true }]) {
        for (const fd of [0, 7]) {
          const result = check(pathApi, 'readTextFile', (trace, target) => ({ path: target, maxBytes }), { data, fd, ...faults });
          const opened = result.trace.some((event) => event[0] === 'open') && !faults.openError;
          assert.equal(result.trace.filter((event) => event[0] === 'close').length, opened ? 1 : 0);
          if (!faults.openError && faults.closeError) assert.equal(result.value.error, 'closeError failed');
          if (result.value.ok) {
            assert.equal(result.value.encoding, 'utf8');
            assert.equal(result.value.modifiedAt, 0);
            assert.equal(result.value.sizeBytes, data.length);
          }
        }
      }
    }
  }
  for (const kind of ['missing', 'directory', 'symlink', 'other']) {
    const result = check(pathApi, 'readTextFile', (trace, target) => ({ path: target }), { kind });
    assert.equal(result.value.ok, false);
    assert.ok(!result.trace.some((event) => event[0] === 'open'));
  }
  for (const config of [{ size: -1 }, { sizeError: true }, { methodError: true }]) {
    check(pathApi, 'readTextFile', (trace, target) => ({ path: target }), config);
  }
  for (const [extension, mime] of [['.avif', 'image/avif'], ['.bmp', 'image/bmp'], ['.gif', 'image/gif'],
    ['.jpeg', 'image/jpeg'], ['.jpg', 'image/jpeg'], ['.PNG', 'image/png'], ['.webp', 'image/webp']]) {
    for (const imageError of [false, true, 'null', 'string']) {
      const result = check(pathApi, 'readFileDataUrl', (trace, target) => ({ path: target + extension }), { imageError });
      if (!imageError) assert.equal(result.value.dataUrl, `data:${mime};base64,${Buffer.from('中文 text').toString('base64')}`);
      else assert.equal(result.value.ok, false);
    }
  }
  for (const size of [1, 16 * 1024 * 1024, 32 * 1024 * 1024 + 1]) {
    for (const maxBytes of [undefined, 1, 999999999]) {
      const result = check(pathApi, 'readFileDataUrl', (trace, target) => ({ path: target + '.png', maxBytes }), { size });
      const limit = maxBytes === 1 ? 1 : maxBytes === undefined ? 16 * 1024 * 1024 : 32 * 1024 * 1024;
      assert.equal(result.value.ok, size <= limit);
      assert.equal(result.trace.some((event) => event[0] === 'readFile'), size <= limit);
    }
  }
  for (const name of ['readTextFile', 'readFileDataUrl']) {
    const invalid = check(pathApi, name, () => ({ path: 'relative' }));
    assert.equal(invalid.value.ok, false);
    assert.deepEqual(invalid.trace, []);
    assert.equal(check(pathApi, name, () => null).error, 'TypeError');
    assert.equal(check(pathApi, name, (trace, target) => ({ path: target + '.png', maxBytes: Symbol('bad') })).error, 'TypeError');
    for (const field of ['path', 'filePath', 'query']) check(pathApi, name, (trace, target) => ({ [field]: target + '.png' }));
    check(pathApi, name, (trace, target) => ({ path: target + '.png', get maxBytes() { trace.push('limit getter'); return 3; } }));
  }
  const unsupported = check(pathApi, 'readFileDataUrl', (trace, target) => ({ path: target + '.svg' }));
  assert.equal(unsupported.value.error, 'Only supported image files can be read as data URLs.');
  assert.ok(!unsupported.trace.some((event) => event[0] === 'readFile'));
}
const exported = require(file);
const boundary = Buffer.alloc(4097, 65);
boundary[4096] = 0;
assert.equal(exported.looksBinary(boundary), false);
boundary[4095] = 0;
assert.equal(exported.looksBinary(boundary), true);
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
    if (!ts.isFunctionDeclaration(node) || node.name.text !== 'readTextFile') assert.ok(source.includes(node.getText(oldAst)));
    expected = expected.slice(0, node.pos) + expected.slice(node.end);
  }
  expected = expected.replace('  clampInteger,\n', '').replace("const path = require('path');",
    "const path = require('path');\nconst { readTextFile, readFileDataUrl } = require('./localFileSystemContentReader.cjs');");
  assert.equal(fs.readFileSync(path.join(__dirname, '../electron/localFileSystemService.cjs'), 'utf8'), expected);
}
console.log(`local filesystem content reader smoke passed: ${cases} cases, Windows/POSIX${baseline ? ', original results and descriptor lifecycle compared' : ''}.`);
