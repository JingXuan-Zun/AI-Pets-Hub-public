const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createCaptureSourceState } = require('../electron/capture/sourceState.cjs');
const rootFile = path.resolve(__dirname, '../electron/captureService.cjs');
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let oldFactory;
if (baseline) {
  const ast = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  const nodes = root.body.statements.filter(n => ts.isVariableStatement(n) && /^let captureSource(Cache|Request)ByKey =/.test(n.getText(ast)) || ts.isFunctionDeclaration(n) && n.name.text === 'invalidateCaptureSourceCache');
  assert.equal(nodes.length, 3);
  oldFactory = new Function('dependencies', 'const { invalidateAreaPickerScreenSourceCache, invalidateNativeDisplayBoundsCache } = dependencies;\n' + nodes.map(n => n.getText(ast)).join('\n') + '\nreturn { getCache: () => captureSourceCacheByKey, getRequests: () => captureSourceRequestByKey, invalidateCaptureSourceCache };');
}
function run(failure, seed, original) {
  const trace = [], apis = [];
  const create = original ? oldFactory : createCaptureSourceState;
  for (let instance = 0; instance < 2; instance++) {
    const dependencies = {};
    for (const [key, stage] of [['invalidateAreaPickerScreenSourceCache', 'area'], ['invalidateNativeDisplayBoundsCache', 'native']]) {
      dependencies[key] = () => {
        const api = apis[instance];
        trace.push([instance, stage, api.getCache().size, api.getRequests().size]);
        assert.equal(api.getCache().size, 0); assert.equal(api.getRequests().size, 0);
        if (failure === stage) throw Error(failure);
      };
    }
    apis.push(create(dependencies));
    assert.equal(trace.length, 0, 'Creation must not invoke invalidation');
    assert.deepEqual(Object.keys(apis[instance]), ['getCache', 'getRequests', 'invalidateCaptureSourceCache']);
  }
  assert.notStrictEqual(apis[0].getCache(), apis[1].getCache());
  assert.notStrictEqual(apis[0].getRequests(), apis[1].getRequests());
  for (const api of apis) {
    assert.notStrictEqual(api.getCache(), api.getRequests());
    for (let n = 0; n < seed; n++) { api.getCache().set('cache:' + n, {}); api.getRequests().set('request:' + n, {}); }
  }
  for (let i = 0; i < 2; i++) for (let cycle = 0; cycle < 3; cycle++) {
    const api = apis[i], cache = api.getCache(), requests = api.getRequests();
    const otherCache = apis[1 - i].getCache(), otherRequests = apis[1 - i].getRequests();
    const cacheEntries = [...cache], requestEntries = [...requests], before = trace.length;
    try { api.invalidateCaptureSourceCache(); assert.equal(failure, ''); }
    catch (error) { assert.equal(error.message, failure); }
    assert.notStrictEqual(api.getCache(), cache); assert.notStrictEqual(api.getRequests(), requests);
    assert.strictEqual(apis[1 - i].getCache(), otherCache); assert.strictEqual(apis[1 - i].getRequests(), otherRequests);
    assert.deepEqual([...cache], cacheEntries); assert.deepEqual([...requests], requestEntries);
    assert.deepEqual(trace.slice(before).map(row => row[1]), failure === 'area' ? ['area'] : ['area', 'native']);
    // Held getters must see the replacement, including writes made after invalidation.
    const getCache = api.getCache, getRequests = api.getRequests;
    getCache().set('next', cycle); getRequests().set('pending', cycle);
    assert.equal(api.getCache().get('next'), cycle); assert.equal(api.getRequests().get('pending'), cycle);
  }
  return trace;
}
function structure() {
  const source = fs.readFileSync(rootFile, 'utf8');
  const ast = ts.createSourceFile(rootFile, source, ts.ScriptTarget.Latest, true);
  const root = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
  assert.ok(!root.body.statements.some(n => ts.isFunctionDeclaration(n) && n.name.text === 'getShellRendererWindows'));
  assert.ok(root.body.statements.some(n => ts.isFunctionDeclaration(n) && n.name.text === 'setShellRendererWindowsProvider'));
  assert.ok(fs.readFileSync(path.resolve(__dirname, '../electron/main.cjs'), 'utf8').includes('captureService.setShellRendererWindowsProvider('));
  if (!baseline) return;
  function retained(text, original) {
    const tree = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const factory = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name.text === 'createCaptureService');
    return factory.body.statements.filter(n => original
      ? !(ts.isVariableStatement(n) && /^let captureSource(Cache|Request)ByKey =/.test(n.getText(tree))) && !(ts.isFunctionDeclaration(n) && ['getShellRendererWindows', 'invalidateCaptureSourceCache'].includes(n.name.text))
      : !(ts.isVariableStatement(n) && n.getText(tree).includes('= createCaptureSourceState(')))
      .map(n => n.getText(tree).replace('getCache: () => captureSourceCacheByKey, getRequests: () => captureSourceRequestByKey,', 'getCache, getRequests,'));
  }
  assert.deepEqual(retained(source, false), retained(baseline, true));
  const oldTree = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  let readers = 0;
  function visit(n) {
    if (ts.isIdentifier(n) && n.text === 'getShellRendererWindows' && !(ts.isFunctionDeclaration(n.parent) && n.parent.name === n) && !(ts.isBindingElement(n.parent) && n.parent.propertyName === n)) readers++;
    ts.forEachChild(n, visit);
  }
  visit(oldTree); assert.equal(readers, 0, 'Private reader has no lexical callers/exports');
}
structure(); let cases = 0;
for (const failure of ['', 'area', 'native']) for (const seed of [0, 1, 3]) {
  const actual = run(failure, seed, false); if (baseline) assert.deepEqual(actual, run(failure, seed, true)); cases++;
}
console.log('Capture source state passed: ' + cases + ' two-instance repeated reset/failure/identity scenarios; private reader and public setter audit.');
