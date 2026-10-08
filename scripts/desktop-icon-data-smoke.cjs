const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { normalizeDesktopIcon } = require('../electron/desktopIcons/desktopIconNormalization.cjs');
const { createDesktopIconFileFallbackReader } = require('../electron/desktopIcons/desktopIconFileFallback.cjs');

function exerciseNormalization(normalize) {
  const base = { index: -2.5, x: -12.6, y: 9.5, width: -4, height: 0, centerX: 8.2, centerY: -3.2 };
  const inputs = [null, undefined, '', 5, [], {}];
  for (const width of [0, 0.2, -3, '12.8', null, undefined, NaN, Infinity]) {
    for (const name of ['', ' \u0000名字\u202e ', 'plain', 5]) {
      inputs.push({ ...base, width, name, extension: '.LNK', canMove: false, isDirectory: true, isFile: 'true', filePath: ' C:\\icon ', targetPath: '', desktopGridCellWidth: 0.2, desktopGridCellHeight: -1 });
    }
  }
  for (const extension of ['..bad', 'a'.repeat(16), 'a'.repeat(17), 'tar-gz', ' 中文 ', 5]) inputs.push({ ...base, extension });
  const results = inputs.map(value => {
    const snapshot = value && typeof value === 'object' ? { ...value } : value;
    const result = normalize(value);
    if (value && typeof value === 'object') assert.deepEqual({ ...value }, snapshot);
    return result;
  });
  assert.equal(results[6].name, 'Desktop item 1'); assert.equal(results[6].width, 1);
  assert.equal(results[7].name, '名字'); assert.equal(results[7].extension, 'lnk');
  assert.equal(results[7].filePath, 'C:\\icon'); assert.equal(results[7].canMove, false);
  assert.equal(results[7].desktopGridCellWidth, 0); assert.equal(results[7].desktopGridCellHeight, undefined);
  for (const key of ['index', 'x', 'y', 'width', 'height', 'centerX', 'centerY', 'desktopGridCellWidth', 'name', 'filePath', 'extension', 'canMove']) {
    const calls = [], error = new Error(key), input = { ...base };
    Object.defineProperty(input, key, { get() { calls.push(key); throw error; } });
    assert.throws(() => normalize(input), caught => caught === error);
    results.push(calls);
  }
  return results;
}

function createFixture(mode, count, events) {
  const error = new Error('fixture failure');
  const fail = stage => { if (mode === stage) throw error; };
  let round = 0;
  const dependencies = {
    app: mode === 'missing-app' ? undefined : { getPath(kind) { events.push(['getPath', kind, ++round]); fail('getPath'); return mode === 'duplicate' ? path.win32.join(process.env.PUBLIC || 'C:\\Users\\Public', 'Desktop') : mode === 'blank' ? ' ' : 'C:\\Desktop'; } },
    path: { join(...parts) { events.push(['join', ...parts]); fail('join'); return path.win32.join(...parts); }, extname: path.win32.extname },
    fs: {
      existsSync(folder) { events.push(['exists', folder]); fail('exists'); return mode !== 'absent'; },
      readdirSync(folder, options) {
        events.push(['read', folder, options]); fail('read'); if (mode === 'log') throw error;
        return ['z.LNK', '文件夹', 'a.URL'].slice(0, count).map((name, index) => ({ name, isDirectory() { events.push(['directory', name]); if (index === 1) fail('directory'); return index === 1; } }));
      },
    },
    logMessage(...args) { events.push(['log', ...args]); fail('log'); },
    normalizeDesktopIcon(value) { events.push(['normalize', value]); fail('normalize'); return normalizeDesktopIcon(value); },
    attachDesktopIconCoordinateSpaces(value) { events.push(['attach', value]); fail('attach'); return { ...value, coordinateSpace: 'native-screen' }; },
  };
  return { dependencies, error };
}

function exerciseFallback(factory) {
  const records = [], originalPublic = process.env.PUBLIC;
  try {
    for (const publicRoot of [undefined, 'C:\\Shared']) {
      if (publicRoot === undefined) delete process.env.PUBLIC; else process.env.PUBLIC = publicRoot;
      for (const mode of ['normal', 'missing-app', 'duplicate', 'blank', 'absent', 'getPath', 'join', 'exists', 'read', 'directory', 'log', 'normalize', 'attach']) for (const count of [0, 1, 3]) {
        const events = [], fixture = createFixture(mode, count, events), read = factory(fixture.dependencies);
        assert.deepEqual(events, [], 'creating the reader does not read folders');
        for (let round = 0; round < 2; round++) {
          let value, failure;
          try { value = read(); } catch (caught) { assert.equal(caught, fixture.error); failure = caught.message; }
          if (mode === 'normal') for (const icon of value) {
            assert.equal(icon.canMove, false); assert.equal(icon.positionSource, 'filesystem-fallback');
            assert.equal(icon.width, 96); assert.equal(icon.height, 74); assert.equal(icon.y, icon.index * 96);
            assert.equal(icon.isShortcut, /\.(lnk|url)$/i.test(icon.name));
          }
          records.push({ value, failure, events: events.splice(0) });
        }
      }
    }
  } finally { if (originalPublic === undefined) delete process.env.PUBLIC; else process.env.PUBLIC = originalPublic; }
  return records;
}

function checkBudgets() {
  for (const file of ['desktopIconNormalization', 'desktopIconFileFallback']) {
    const source = fs.readFileSync(`electron/desktopIcons/${file}.cjs`, 'utf8');
    assert.ok(source.split('\n').length <= 300);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function visit(node) {
      if (ts.isFunctionLike(node) && node.body) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
  assert.match(fs.readFileSync('electron/desktopIconService.cjs', 'utf8'), /createDesktopIconFileFallbackReader\(\{/);
}

const normalized = exerciseNormalization(normalizeDesktopIcon);
const fallback = exerciseFallback(createDesktopIconFileFallbackReader);
if (process.argv[2]) {
  const source = fs.readFileSync(process.argv[2], 'utf8');
  const originalNormalize = new Function(source + '\nreturn normalizeDesktopIcon;')();
  const baselineAst = ts.createSourceFile('baseline.cjs', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const readerSource = source.slice(baselineAst.statements[0].end);
  const originalReader = new Function('dependencies', 'const { app, fs, path, logMessage, normalizeDesktopIcon, attachDesktopIconCoordinateSpaces } = dependencies;\n' + readerSource + '\nreturn listDesktopFileFallbackIcons;');
  assert.deepEqual(normalized, exerciseNormalization(originalNormalize));
  assert.deepEqual(fallback, exerciseFallback(originalReader));
}
checkBudgets();
console.log(`Desktop icon data smoke passed (${normalized.length} normalization cases, ${fallback.length} fallback calls${process.argv[2] ? ', original behavior identical' : ''}).`);
