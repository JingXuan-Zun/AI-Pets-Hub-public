const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const file = path.join(__dirname, '../electron/localFileSystemDesktopOrganizationRules.cjs');
const source = fs.readFileSync(file, 'utf8');
const names = Object.keys(require(file));
const constants = ['DESKTOP_FILE_CATEGORY_LABELS', 'DESKTOP_FILE_CATEGORY_ORDER', 'DESKTOP_FILE_EXTENSION_CATEGORIES'];
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let cases = 0;

function load(pathApi, trace, rootKind, parentKind, original = false) {
  const home = pathApi === path.win32 ? 'C:\\用户' : '/用户';
  const fakeOs = { homedir() { trace.push('home'); return home; } };
  let statCalls = 0;
  const fakeFs = { statSync(target) {
    const kind = statCalls++ === 0 ? rootKind : parentKind;
    trace.push(['stat', target]);
    if (kind === 'error') throw new Error('stat failed');
    if (kind === 'missing') return null;
    return { isDirectory() {
      trace.push(['isDirectory', target]);
      if (kind === 'method-error') throw new Error('directory method failed');
      return kind === 'directory';
    } };
  } };
  const cache = new Map();
  function loadFile(target) {
    if (cache.has(target)) return cache.get(target);
    const module = { exports: {} };
    new Function('require', 'module', fs.readFileSync(target, 'utf8'))((id) => {
      if (id === 'path') return pathApi;
      if (id === 'os') return fakeOs;
      if (id === 'fs') return fakeFs;
      assert.ok(id.startsWith('./'));
      return loadFile(path.resolve(path.dirname(target), id));
    }, module);
    cache.set(target, module.exports);
    return module.exports;
  }
  if (!original) return loadFile(file);
  const inputs = loadFile(path.join(__dirname, '../electron/localFileSystemInputUtils.cjs'));
  const getSafeStat = loadFile(path.join(__dirname, '../electron/localFileSystemDestinationUtils.cjs')).getSafeStat;
  const ast = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
  const moved = ast.statements.filter((node) => (ts.isFunctionDeclaration(node)
    && names.includes(node.name.text)) || (ts.isVariableStatement(node)
    && node.declarationList.declarations.some((d) => constants.includes(d.name.getText(ast)))));
  assert.equal(moved.length, 10);
  return new Function('os', 'path', 'getSafeStat', ...Object.keys(inputs),
    `${moved.map((node) => node.getText(ast)).join('\n')}\nreturn { ${names.join(',')} };`,
  )(fakeOs, pathApi, getSafeStat, ...Object.values(inputs));
}

function invoke(pathApi, name, makeArgs, rootKind, parentKind, original) {
  const trace = [];
  const functions = load(pathApi, trace, rootKind, parentKind, original);
  try {
    return { value: functions[name](...makeArgs(trace)), trace };
  } catch (error) {
    return { error: error.constructor.name, message: error.message, trace };
  }
}

function check(pathApi, name, args, expected, rootKind = 'directory', parentKind = 'directory') {
  const makeArgs = typeof args === 'function' ? args : () => args;
  const result = invoke(pathApi, name, makeArgs, rootKind, parentKind, false);
  if (expected !== undefined) assert.deepEqual(result.value, expected);
  if (baseline) assert.deepEqual(result, invoke(pathApi, name, makeArgs, rootKind, parentKind, true));
  cases += 1;
  return result;
}

for (const pathApi of [path.win32, path.posix]) {
  const desktop = pathApi === path.win32 ? 'C:\\用户\\Desktop' : '/用户/Desktop';
  const target = pathApi.join(desktop, '整理');
  check(pathApi, 'getDefaultDesktopPath', [], desktop);
  for (const [input, expected] of [
    ['ext', 'extension'], ['suffix', 'extension'], ['EXTENSION', 'extension'],
    ['item-kind', 'kind'], ['kind', 'kind'], [' none ', 'none'],
    ['type', 'category'], ['category', 'category'], [null, 'category'], ['bad', 'category'],
  ]) check(pathApi, names[0], [input], expected);
  for (const [extension, category] of [
    ['.exe', 'app'], ['.zip', 'archive'], ['.ts', 'code'], ['.pdf', 'document'],
    ['.png', 'image'], ['.wav', 'media'], ['.PNG', 'other'], ['', 'other'], ['.unknown', 'other'],
  ]) check(pathApi, 'getDesktopFileCategory', [extension], category);
  for (const [input, expected] of [
    [' \"中文\" ', '中文'], ['a<>:/\\|?*b', 'a-b'], ['', 'Other'], ['..', 'Other'],
    ['.', 'Other'], ['safe.txt', 'safe.txt'], [' x`y ', 'x`y'],
  ]) check(pathApi, 'sanitizeDesktopFileOrganizationFolderName', [input], expected);
  check(pathApi, 'getDesktopFileGroup', [{ extension: '.txt' }, 'extension'], { key: '.txt', label: 'TXT', order: 30 });
  check(pathApi, 'getDesktopFileGroup', [{}, 'extension'], { key: 'no-extension', label: 'No Extension', order: 95 });
  check(pathApi, 'getDesktopFileGroup', [{ kind: 'directory' }, 'kind'], { key: 'directory', label: 'Folders', order: 20 });
  check(pathApi, 'getDesktopFileGroup', [{ kind: 'file' }, 'kind'], { key: 'file', label: 'Files', order: 10 });
  for (const [category, label, order] of [
    ['app', 'Apps', 60], ['archive', 'Archives', 30], ['code', 'Code', 50],
    ['document', 'Documents', 20], ['image', 'Images', 10], ['media', 'Media', 40],
    ['other', 'Other', 90], ['unknown', 'Other', 90],
  ]) check(pathApi, 'getDesktopFileGroup', [{ category }, 'category'], { key: category, label, order });
  for (const name of ['.hidden', 'desktop.ini', 'DESKTOP.INI', 'photo.png', 'Link.LNK', 'Link.URL', '文件.txt']) {
    for (const kind of ['directory', 'file', 'other']) {
      for (let flags = 0; flags < 8; flags += 1) {
        const options = { includeHidden: Boolean(flags & 1), includeDirectories: Boolean(flags & 2), includeShortcuts: Boolean(flags & 4) };
        const expected = !options.includeHidden && name.startsWith('.') ? 'hidden'
          : name.toLowerCase() === 'desktop.ini' ? 'system-file'
            : kind === 'directory' ? options.includeDirectories ? '' : 'directory-skipped'
              : kind === 'other' ? 'not-a-file'
                : !options.includeShortcuts && /\.(lnk|url)$/i.test(name) ? 'shortcut-skipped' : '';
        check(pathApi, 'shouldSkipDesktopFileOrganizationEntry', (trace) => [{ name,
          isDirectory() { trace.push('entry directory'); return kind === 'directory'; },
          isFile() { trace.push('entry file'); return kind === 'file'; },
        }, options], expected);
      }
    }
  }
  for (const rootKind of ['directory', 'file', 'missing', 'error', 'method-error']) {
    for (const parentKind of ['directory', 'file', 'missing', 'error', 'method-error']) {
      const result = check(pathApi, 'getDesktopFileOrganizationRoot', [{ destinationDirectory: target }, desktop],
        undefined, rootKind, parentKind);
      if (rootKind === 'directory') assert.deepEqual(result.value, { ok: true, path: target });
      if (rootKind === 'file') assert.equal(result.value.error, 'Desktop organization destination must be a folder path.');
      if (['missing', 'error'].includes(rootKind) && parentKind === 'directory') {
        assert.deepEqual(result.value, { ok: true, path: target });
      }
    }
  }
  check(pathApi, 'getDesktopFileOrganizationRoot', [{}, desktop], { ok: true, path: pathApi.join(desktop, 'Desktop Organized') });
  const fields = ['destinationDirectory', 'destinationPath', 'targetDirectory', 'targetPath', 'organizeRoot', 'to'];
  for (let index = 0; index < fields.length; index += 1) {
    check(pathApi, 'getDesktopFileOrganizationRoot', (trace) => {
      const request = Object.fromEntries(fields.slice(0, index).map((field) => [field, '']));
      Object.defineProperty(request, fields[index], { get() { trace.push(fields[index]); return target; } });
      for (const field of fields.slice(index + 1)) {
        Object.defineProperty(request, field, { get() { throw new Error('must short circuit'); } });
      }
      return [request, desktop];
    }, { ok: true, path: target });
  }
  const invalid = check(pathApi, 'getDesktopFileOrganizationRoot', [{ destinationPath: 'relative' }, desktop], {
    error: 'Path must be an absolute local path.', ok: false, path: 'relative',
  });
  assert.deepEqual(invalid.trace, []);
  assert.equal(check(pathApi, 'getDesktopFileOrganizationRoot', [null, desktop]).error, 'TypeError');
}

const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
assert.ok(source.split('\n').length <= 300);
for (const node of ast.statements.filter(ts.isFunctionDeclaration)) {
  assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
    - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name.text);
}
if (baseline) {
  const oldAst = ts.createSourceFile('original.cjs', baseline, ts.ScriptTarget.Latest, true);
  const moved = oldAst.statements.filter((node) => (ts.isFunctionDeclaration(node)
    && names.includes(node.name.text)) || (ts.isVariableStatement(node)
    && node.declarationList.declarations.some((d) => constants.includes(d.name.getText(oldAst)))));
  let expected = baseline;
  for (const node of moved.sort((a, b) => b.pos - a.pos)) {
    assert.ok(source.includes(node.getText(oldAst)));
    expected = expected.slice(0, node.pos) + expected.slice(node.end);
  }
  expected = expected.replace("const os = require('os');\n", '').replace("} = require('./localFileSystemActionResults.cjs');",
    "} = require('./localFileSystemActionResults.cjs');\nconst {\n" + names.map((name) => '  ' + name + ',').join('\n')
      + "\n} = require('./localFileSystemDesktopOrganizationRules.cjs');");
  assert.equal(fs.readFileSync(path.join(__dirname, '../electron/localFileSystemService.cjs'), 'utf8'), expected);
}
console.log(`local filesystem desktop organization rules smoke passed: ${cases} cases, Windows/POSIX${baseline ? ', original results and query order compared' : ''}.`);
