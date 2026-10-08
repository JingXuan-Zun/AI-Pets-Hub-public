const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const moduleFile = require.resolve('../electron/localProjectInspectorTexts.cjs');
const text = fs.readFileSync(moduleFile, 'utf8');
const tree = ts.createSourceFile(moduleFile, text, ts.ScriptTarget.Latest, true);
assert.ok(text.split('\n').length <= 300);
function budgets(n) {
  if (ts.isFunctionLike(n) && n.body) assert.ok(tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1 <= 50);
  ts.forEachChild(n, budgets);
}
budgets(tree);
let oldSource;
if (process.argv[2]) {
  const baseline = fs.readFileSync(process.argv[2], 'utf8');
  const tree = ts.createSourceFile('root.cjs', baseline, ts.ScriptTarget.Latest, true);
  const constants = tree.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => ['READABLE_KEY_FILES', 'README_NAMES'].includes(d.name.getText(tree))));
  assert.equal(constants.length, 2);
  const start = baseline.indexOf('    const texts = new Map()');
  const end = baseline.indexOf('    const { detectedProjectTypes', start);
  assert.ok(start > 0 && end > start);
  oldSource = "const path = require('path'); const { getSafeStat, readKeyTextFile } = require('./localProjectInspectorReader.cjs');\n"
    + constants.map(n => n.getText(tree)).join('\n') + '\nfunction prepareProjectTexts(rootPath, readFiles, warnings) {\n'
    + baseline.slice(start, end) + '\nreturn { texts, readmeText }; }\nmodule.exports = { prepareProjectTexts };';
}
const keyFiles = ['package.json', 'pyproject.toml', 'requirements.txt', 'setup.py', 'Cargo.toml', 'go.mod', 'pom.xml', 'build.gradle', 'build.gradle.kts', 'ProjectSettings/ProjectVersion.txt', 'Packages/manifest.json'];
const readmes = ['README.md', 'README.txt', 'README', 'readme.md', '说明.txt', '使用说明.txt'];
function run(paths, keyMode, firstReadme, readmeMode, original) {
  const root = paths === path.win32 ? 'C:\\controlled\\project' : '/controlled/project';
  const trace = [], loaded = new Map(), readFiles = ['existing'], warnings = ['existing'];
  const records = new Map();
  if (keyMode !== 'none') for (const [index, file] of keyFiles.entries()) records.set(paths.join(root, file), { text: keyMode === 'empty' || keyMode === 'mixed' && index % 2 ? '' : 'text:' + file, size: keyMode === 'large' ? 262145 : 262144, error: keyMode === 'error' });
  if (firstReadme >= 0) for (let index = firstReadme; index < readmes.length; index++) records.set(paths.join(root, readmes[index]), {
    text: index === firstReadme && readmeMode === 'empty' ? '' : 'readme:' + readmes[index],
    size: index === firstReadme && readmeMode === 'large' ? 262145 : 20,
    error: index === firstReadme && readmeMode === 'error', directory: index === firstReadme && readmeMode === 'directory',
  });
  const io = {
    statSync(target) { trace.push(['stat', target]); const record = records.get(target); if (!record) throw Error('missing'); return { isFile: () => !record.directory, size: record.size }; },
    readFileSync(target, encoding) { trace.push(['read', target, encoding]); const record = records.get(target); if (record.error) throw Error('controlled read failure'); return record.text; },
  };
  function load(file) {
    if (loaded.has(file)) return loaded.get(file).exports;
    const module = { exports: {} }; loaded.set(file, module);
    new Function('require', 'module', original && file === moduleFile ? oldSource : fs.readFileSync(file, 'utf8'))(id => {
      if (id.startsWith('./')) return load(path.resolve(path.dirname(file), id));
      if (id === 'path') return paths;
      if (id === 'fs') return io;
      throw Error('Unexpected dependency ' + id);
    }, module);
    return module.exports;
  }
  const value = load(moduleFile).prepareProjectTexts(root, readFiles, warnings);
  if (keyMode === 'empty') { assert.equal(value.texts.size, 0); assert.deepEqual(readFiles.slice(1, 12), keyFiles); }
  if (keyMode === 'normal') assert.deepEqual([...value.texts.keys()], keyFiles);
  if (firstReadme >= 0 && ['empty', 'large', 'error'].includes(readmeMode)) {
    assert.equal(value.readmeText, readmeMode === 'empty' ? '' : null);
    assert.ok(!trace.some(row => row[0] === 'read' && readmes.slice(firstReadme + 1).some(name => paths.basename(row[1]) === name)), 'First existing README does not fall through after empty/oversize/read failure');
  }
  assert.deepEqual(trace.filter(row => row[0] === 'stat').slice(0, 11).map(row => paths.relative(root, row[1]).replaceAll('\\', '/')), keyFiles);
  return { texts: [...value.texts.entries()], readmeText: value.readmeText, trace, readFiles, warnings };
}
const outcomes = [];
for (const paths of [path.win32, path.posix]) for (const keyMode of ['none', 'normal', 'empty', 'mixed', 'large', 'error'])
  for (const firstReadme of [-1, 0, 1, 2, 3, 4, 5]) for (const readmeMode of ['normal', 'empty', 'large', 'error', 'directory']) {
    const actual = run(paths, keyMode, firstReadme, readmeMode, false);
    if (oldSource) assert.deepEqual(actual, run(paths, keyMode, firstReadme, readmeMode, true));
    outcomes.push(actual);
  }
const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
assert.equal(hash, '12b728d3f421e59c94486def0d37aac1a8cfa1361d0ad33e06585bab2fa7e350', 'Reviewed text preparation results and reads remain unchanged');
console.log('Project text preparation passed: ' + outcomes.length + ' key/readme/order/empty/limit/read-failure/priority cases; hash ' + hash);
