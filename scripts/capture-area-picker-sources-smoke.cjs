const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const implementation = path.resolve(__dirname, '../electron/capture/areaPickerSources.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
const defaultSize = { width: 960, height: 540 };
const valid = label => ({ id: label, type: 'screen', displayId: '1', thumbnail: '' });
const ignored = [{ id: 'window', type: 'window', displayId: '1' }, { id: 'unknown', type: 'screen', displayId: '' }];
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const names = ['isAreaPickerScreenSourceCacheFresh', 'getAreaPickerThumbnailSizeKey', 'getAreaPickerScreenSources'];
  const declarations = names.map(name => root.body.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === name).getText(ast)).join('\n');
  oldFactory = new Function('dependencies', 'Date', `const { AREA_PICKER_PREVIEW_THUMBNAIL_SIZE,
    AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS, getCachedCaptureSources, fetchAreaPickerScreenSourceList,
    fetchScreenCaptureSourceListLite, getCaptureSourceListWithOptions } = dependencies;
    let areaPickerScreenSourceCache = [], areaPickerScreenSourceCacheUpdatedAt = 0, areaPickerScreenSourceCacheKey = '';
    ${declarations}
    return { getAreaPickerScreenSources, invalidateAreaPickerScreenSourceCache() {
      areaPickerScreenSourceCache = []; areaPickerScreenSourceCacheUpdatedAt = 0; areaPickerScreenSourceCacheKey = '';
    } };`);
}

function fixture(original, deferred = false) {
  let now = 100; let mode = 'preview'; let shared = 'empty';
  const trace = []; const pending = [];
  const clock = { now() { trace.push(['clock', now]); return now; } };
  const sharedSource = valid('shared');
  const combined = [valid('combined'), sharedSource, { ...sharedSource, thumbnail: 'duplicate' }, ...ignored];
  const dependencies = {
    AREA_PICKER_PREVIEW_THUMBNAIL_SIZE: defaultSize, AREA_PICKER_SCREEN_SOURCE_CACHE_TTL_MS: 15000,
    getCachedCaptureSources(types) {
      trace.push(['cached', types]);
      if (shared === 'null') return [null];
      return shared === 'mixed' ? (types ? [sharedSource, ...ignored] : combined) : [];
    },
    fetchAreaPickerScreenSourceList(size) {
      trace.push(['preview', size]);
      if (deferred) return new Promise((resolve, reject) => pending.push({ resolve, reject }));
      if (mode === 'preview-error') return Promise.reject(Error('preview-error'));
      return Promise.resolve(mode === 'null-preview' ? null : mode === 'preview' ? [valid('preview'), ...ignored] : ignored);
    },
    fetchScreenCaptureSourceListLite() {
      trace.push(['lite']);
      if (mode === 'lite-error') return Promise.reject(Error('lite-error'));
      return Promise.resolve(mode === 'lite' ? [valid('lite'), ...ignored] : ignored);
    },
    getCaptureSourceListWithOptions(options) {
      trace.push(['full', options]);
      return mode === 'full-error' ? Promise.reject(Error('full-error'))
        : Promise.resolve(mode === 'all-empty' ? ignored : [valid('full'), ...ignored]);
    },
  };
  const module = { exports: {} };
  new Function('module', 'Date', fs.readFileSync(implementation, 'utf8'))(module, clock);
  const api = original ? oldFactory(dependencies, clock) : module.exports.createAreaPickerScreenSources(dependencies);
  assert.deepEqual(trace, [], 'Construction must not read time or capture sources');
  return { api, trace, pending, configure(time, nextMode, nextShared) { now = time; mode = nextMode; shared = nextShared; } };
}

async function runCase(shared, mode, force, size, now, reset, original) {
  const f = fixture(original); const seed = await f.api.getAreaPickerScreenSources();
  assert.equal(seed[0].thumbnail, '', 'A valid screen without thumbnail is still cacheable');
  f.trace.length = 0; f.configure(now, mode, shared);
  if (reset) f.api.invalidateAreaPickerScreenSourceCache();
  const options = {};
  Object.defineProperties(options, {
    forceRefresh: { get() { f.trace.push(['force', force]); return force; } },
    thumbnailSize: { get() { f.trace.push(['size']); return size; } },
  });
  const outcomes = [];
  let first;
  for (let index = 0; index < 2; index++) {
    try {
      const value = await f.api.getAreaPickerScreenSources(options);
      outcomes.push({ value, sameSeed: value === seed, samePrevious: index > 0 && value === first });
      if (index === 0) first = value;
    } catch (error) { outcomes.push({ error: error.message }); }
  }
  if (!force && !reset && now - 100 <= 15000 && size.width === 960) {
    assert.equal(outcomes[0].sameSeed, true); assert.equal(outcomes[1].samePrevious, true);
  }
  if (outcomes[0].value?.[0]?.id === 'shared') assert.deepEqual(outcomes[0].value.map(x => x.id), ['shared', 'combined']);
  if (outcomes[0].value?.[0]?.id === 'lite' || outcomes[0].value?.[0]?.id === 'full') {
    assert.equal(outcomes[1].samePrevious, false, 'Lite/full fallback results do not fill the dedicated preview cache');
    assert.equal(f.trace.filter(x => x[0] === 'preview').length, 2);
  }
  return { outcomes, trace: f.trace };
}

async function runConcurrent(reset, reverse, differentSize, original) {
  const f = fixture(original, true);
  const old = f.api.getAreaPickerScreenSources();
  if (reset) f.api.invalidateAreaPickerScreenSourceCache();
  const otherSize = differentSize ? { width: 1920, height: 1080 } : defaultSize;
  const newer = f.api.getAreaPickerScreenSources({ forceRefresh: true, thumbnailSize: otherSize });
  assert.equal(f.pending.length, 2);
  const [a, b] = f.pending.splice(0);
  let oldValue, newValue;
  async function finishOld() { a.resolve([valid('old')]); oldValue = await old; }
  async function finishNew() { b.resolve([valid('new')]); newValue = await newer; }
  if (reverse) { await finishNew(); await finishOld(); } else { await finishOld(); await finishNew(); }
  const cached = await f.api.getAreaPickerScreenSources({ thumbnailSize: reverse ? defaultSize : otherSize });
  assert.strictEqual(cached, reverse ? oldValue : newValue, 'Last completion wins, including pre-invalidation requests');
  assert.equal(f.pending.length, 0);
  return { trace: f.trace, oldValue, newValue, cached };
}

async function runGetter(original) {
  const f = fixture(original);
  const size = {};
  Object.defineProperties(size, {
    width: { get() { f.trace.push(['width']); return 959.6; } },
    height: { get() { f.trace.push(['height']); return 540.4; } },
  });
  const first = await f.api.getAreaPickerScreenSources({ thumbnailSize: size });
  const second = await f.api.getAreaPickerScreenSources();
  assert.strictEqual(first, second, 'Rounded thumbnail dimensions share the same key');
  let error;
  try { await f.api.getAreaPickerScreenSources({ thumbnailSize: { get width() { throw Error('size-error'); } } }); }
  catch (caught) { error = caught.message; }
  assert.equal(error, 'size-error');
  return { trace: f.trace, first, error };
}

async function rootRun(mode, original) {
  const trace = []; let now = 100;
  const display = { id: '1', bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 }, scaleFactor: 1 };
  const electron = { app: {}, BrowserWindow: {},
    screen: { getAllDisplays: () => [display], getPrimaryDisplay: () => display },
    desktopCapturer: { async getSources(options) {
      trace.push(['capture', options]);
      if (mode === 'error') throw Error('capture-error');
      if (mode === 'empty') return [];
      return [{ id: 'screen:1', name: 'Primary', display_id: mode === 'missing-display' ? '' : '1',
        thumbnail: { isEmpty: () => mode === 'empty-image', getSize: () => ({ width: 960, height: 540 }), toDataURL: () => 'image' } }];
    } },
  };
  const loaded = new Map();
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    const module = { exports: {} }; loaded.set(file, module);
    new Function('require', 'module', 'exports', 'process', 'Date',
      file === rootFile && original ? baseline : fs.readFileSync(file, 'utf8'))(id => {
      if (id === 'electron') return electron;
      if (id === 'child_process') return { execFile() { throw Error('Unexpected native call'); } };
      if (id === 'fs') return {};
      if (id === 'path') return path;
      assert.ok(id.startsWith('./')); return load(path.resolve(path.dirname(file), id));
    }, module, module.exports, { platform: 'linux' }, { now: () => now });
    return module.exports;
  }
  const { createCaptureService } = load(rootFile);
  const first = createCaptureService(), second = createCaptureService(); const values = [Object.keys(first)];
  if (mode === 'error') {
    for (const service of [first, first, second]) {
      await assert.rejects(service.getAreaPickerScreenSources(), /capture-error/);
    }
    first.invalidateCaptureSourceCache();
    await assert.rejects(first.getAreaPickerScreenSources(), /capture-error/);
    first.dispose(); second.dispose(); return { values, trace };
  }
  const seed = await first.getAreaPickerScreenSources();
  const hit = await first.getAreaPickerScreenSources();
  if (mode === 'normal' || mode === 'empty-image') assert.strictEqual(seed, hit);
  const other = await second.getAreaPickerScreenSources(); assert.notStrictEqual(seed, other);
  values.push(seed, hit, other);
  now = 15100; values.push(await first.getAreaPickerScreenSources());
  now++; values.push(await first.getAreaPickerScreenSources());
  values.push(await first.getAreaPickerScreenSources({ forceRefresh: true }));
  values.push(await first.getAreaPickerScreenSources({ thumbnailSize: { width: 1920, height: 1080 } }));
  first.invalidateCaptureSourceCache(); values.push(await first.getAreaPickerScreenSources());
  first.dispose(); values.push(await first.getAreaPickerScreenSources()); second.dispose();
  return { values, trace };
}

function checkStructure() {
  const text = fs.readFileSync(implementation, 'utf8'); assert.ok(text.split('\n').length <= 300);
  const ast = ts.createSourceFile(implementation, text, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(ast.getLineAndCharacterOfPosition(node.end).line
      - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50, node.name?.text);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!baseline) return;
  function retained(source, original) {
    const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
    const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return root.body.statements.filter(node => original
      ? !(ts.isFunctionDeclaration(node) && ['isAreaPickerScreenSourceCacheFresh', 'getAreaPickerThumbnailSizeKey', 'getAreaPickerScreenSources'].includes(node.name.text))
        && !/^let areaPickerScreenSourceCache/.test(node.getText(ast))
      : !node.getText(ast).startsWith('const { getAreaPickerScreenSources, invalidateAreaPickerScreenSourceCache } ='))
      .map(node => node.getText(ast).replace(/areaPickerScreenSourceCache = \[\];\s*areaPickerScreenSourceCacheUpdatedAt = 0;\s*areaPickerScreenSourceCacheKey = '';/,
        'invalidateAreaPickerScreenSourceCache();'));
  }
  assert.deepEqual(retained(fs.readFileSync(rootFile, 'utf8'), false), retained(baseline, true));
}

async function main() {
  checkStructure(); let cases = 0;
  const sizes = [defaultSize, { width: 1920, height: 1080 }, { width: 0, height: -1 }];
  for (const shared of ['empty', 'mixed', 'null'])
    for (const mode of ['preview', 'lite', 'full', 'all-empty', 'preview-error', 'lite-error', 'full-error', 'null-preview'])
      for (const force of [false, true]) for (const size of sizes) for (const now of [0, 99, 100, 15100, 15101])
        for (const reset of [false, true]) {
          const actual = await runCase(shared, mode, force, size, now, reset, false);
          if (baseline) assert.deepEqual(actual, await runCase(shared, mode, force, size, now, reset, true));
          cases++;
        }
  for (const reset of [false, true]) for (const reverse of [false, true]) for (const size of [false, true]) {
    const actual = await runConcurrent(reset, reverse, size, false);
    if (baseline) assert.deepEqual(actual, await runConcurrent(reset, reverse, size, true)); cases++;
  }
  const getters = await runGetter(false); if (baseline) assert.deepEqual(getters, await runGetter(true)); cases++;
  for (const mode of ['normal', 'empty-image', 'missing-display', 'empty', 'error']) {
    const actual = await rootRun(mode, false);
    if (baseline) assert.deepEqual(actual, await rootRun(mode, true)); cases++;
  }
  console.log(`Capture area picker sources passed: ${cases} cache/fallback, getter, concurrent and controlled real-root scenarios.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
