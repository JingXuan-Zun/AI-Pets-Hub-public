const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const moduleFile = require.resolve('../electron/browserSearchDiscovery.cjs');
const rootFile = require.resolve('../electron/browserSearchService.cjs');
const source = fs.readFileSync(moduleFile, 'utf8');
const tree = ts.createSourceFile(moduleFile, source, ts.ScriptTarget.Latest, true);
const names = Object.keys(require(moduleFile));
assert.ok(source.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
const baseline = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
let oldSource;
if (baseline) {
  const t = ts.createSourceFile(rootFile, baseline, ts.ScriptTarget.Latest, true);
  const selected = n => ts.isFunctionDeclaration(n) && names.includes(n.name.text)
    || ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.name.getText(t) === 'WINDOWS_BROWSER_ROOT_NAMES');
  oldSource = "const fs = require('fs'); const path = require('path');\n" + t.statements.filter(selected).map(n => n.getText(t)).join('\n') + '\nmodule.exports = { ' + names.join(',') + ' };';
  const printer = ts.createPrinter();
  const retained = t.statements.filter(n => !selected(n)).map(n => printer.printNode(ts.EmitHint.Unspecified, n, t)).join('\n');
  const current = ts.createSourceFile(rootFile, fs.readFileSync(rootFile, 'utf8'), ts.ScriptTarget.Latest, true);
  assert.equal(current.statements.filter(n => !n.getText(current).includes("require('./browserSearchDiscovery.cjs')")).map(n => printer.printNode(ts.EmitHint.Unspecified, n, current)).join('\n'), retained, 'Remaining service statements unchanged');
}
function run(platform, environment, disks, files, input, original) {
  const trace = [], cache = new Map(), paths = platform === 'win32' ? path.win32 : path.posix;
  const envValues = environment === 'default' ? {} : environment === 'duplicate' ? { LOCALAPPDATA: 'C:\\Program Files', ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files' }
    : environment === 'custom' ? { LOCALAPPDATA: 'D:\\用户\\Local', ProgramFiles: 'D:\\Apps', 'ProgramFiles(x86)': 'D:\\Apps32' }
    : { LOCALAPPDATA: '', ProgramFiles: '', 'ProgramFiles(x86)': '' };
  const env = {};
  for (const key of ['LOCALAPPDATA', 'ProgramFiles', 'ProgramFiles(x86)']) Object.defineProperty(env, key, { get() { trace.push(['env', key]); return envValues[key]; } });
  const io = {
    existsSync(target) { trace.push(['exists', target]); if (disks === 'throw' && target.startsWith('D:')) throw Error('inaccessible drive'); return disks === 'all' || disks === 'two' && /^[CD]:/.test(target); },
    statSync(target) {
      trace.push(['stat', target]);
      const configured = target === 'C:\\custom\\custom.exe';
      if (!configured && !/(?:chrome|msedge)\.exe$/.test(target)) throw Error('missing');
      if (files === 'none' || files === 'throw' || files === 'configured' && !configured) throw Error('missing');
      const isFile = files === 'both' || files === 'configured' || files === 'chrome' && /chrome\.exe$/.test(target) || files === 'edge' && /msedge\.exe$/.test(target);
      const stat = { isFile() { assert.equal(this, stat); trace.push(['isFile', target]); if (files === 'method-throw') throw Error('stat method failed'); return Boolean(isFile); } };
      return stat;
    },
  };
  function load(file) {
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const code = original && file === rootFile ? baseline : original && file === moduleFile ? oldSource : fs.readFileSync(file, 'utf8');
    new Function('require', 'module', 'process', code)(id => {
      if (id.startsWith('./')) return load(path.resolve(path.dirname(file), id));
      if (id === 'fs') return io;
      if (id === 'path') return paths;
      if (id === 'http') return { request() { throw Error('Unexpected network access'); } };
      if (id === 'child_process') return { spawn() { throw Error('Unexpected process launch'); } };
      throw Error('Unexpected dependency ' + id);
    }, module, { platform, env });
    return module.exports;
  }
  const api = load(moduleFile);
  const configured = input === 'valid' ? '  C:\\custom\\custom.exe  ' : input === 'missing' ? 'C:\\missing.exe' : input === 'number' ? 42 : undefined;
  const roots = api.getBrowserSearchCandidateRoots(), descriptors = api.buildBrowserCandidateDescriptors(), detected = api.getDetectedBrowserCandidates(), resolved = api.resolveBrowserPath(configured);
  const service = load(rootFile).createBrowserSearchService({ app: {}, log() {} });
  const detection = service.detect({ browserSearchBrowserPath: configured });
  assert.equal(detection.detectedCount, descriptors.filter(candidate => candidate.exists).length);
  assert.equal(detection.scannedRootCount, roots.length);
  if (platform !== 'win32') { assert.deepEqual(roots, []); assert.ok(!trace.some(row => row[0] === 'exists' || row[0] === 'env')); }
  else assert.equal(trace.filter(row => row[0] === 'exists').length % 26, 0);
  if (files === 'both' && platform === 'win32') {
    assert.equal(descriptors[0].browserLabel, 'Edge');
    assert.equal(detected[0].browserLabel, 'Chrome');
    assert.equal(api.resolveBrowserLabel(resolved), input === 'valid' ? 'custom.exe' : 'Chrome');
    assert.equal(detection.browserLabel, input === 'valid' ? 'custom.exe' : 'Edge');
  }
  assert.deepEqual(api.uniqueStrings(['a', '', null, false, 'a', 'A']), ['a', 'A']);
  const labels = ['msedge.exe', 'chrome.exe', 'CHROME.EXE', 'msedge-chrome.exe', 'other.exe', ''].map(value => api.resolveBrowserLabel(value));
  for (const value of ['', null, undefined, 42]) assert.equal(api.isExecutableFile(value), false);
  return { roots, descriptors, detected, resolved, detection, labels, trace };
}
const fingerprint = crypto.createHash('sha256');
let cases = 0;
for (const platform of ['win32', 'linux']) for (const environment of ['default', 'duplicate', 'custom', 'empty'])
  for (const disks of ['none', 'two', 'all', 'throw']) for (const files of ['none', 'both', 'chrome', 'edge', 'configured', 'directory', 'throw', 'method-throw'])
    for (const input of ['valid', 'missing', 'number', 'undefined']) {
      const actual = run(platform, environment, disks, files, input, false);
      if (baseline) assert.deepEqual(actual, run(platform, environment, disks, files, input, true));
      fingerprint.update(JSON.stringify(actual) + '\n');
      cases++;
    }
const hash = fingerprint.digest('hex');
assert.equal(hash, 'dfd78c7f160402b5f7999901c001c4272232d01be061d059fce730af3f570aa8', 'Reviewed browser discovery and filesystem order remain unchanged');
console.log('Browser discovery passed: ' + cases + ' platform/environment/drive/stat/configuration/order/real-root cases; hash ' + hash);
