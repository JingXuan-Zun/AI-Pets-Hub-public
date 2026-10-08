const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const crypto = require('node:crypto');
const rules = require('../electron/localProjectInspectorRules.cjs');
const { inspectPython } = require('../electron/localProjectInspectorPython.cjs');
const { inspectUnity } = require('../electron/localProjectInspectorUnity.cjs');
const originals = {};
if (process.argv[2]) {
  const baseline = fs.readFileSync(process.argv[2], 'utf8');
  const tree = ts.createSourceFile('root.cjs', baseline, ts.ScriptTarget.Latest, true);
  for (const name of ['inspectPython', 'inspectUnity']) {
    const fn = tree.statements.find(node => ts.isFunctionDeclaration(node) && node.name.text === name);
    originals[name] = new Function(...Object.keys(rules), fn.getText(tree) + '\nreturn ' + name + ';')(...Object.values(rules));
  }
  function retained(value) {
    const tree = ts.createSourceFile('root.cjs', value, ts.ScriptTarget.Latest, true);
    return tree.statements.filter(node => !(ts.isFunctionDeclaration(node) && Object.hasOwn(originals, node.name.text))
      && !/require\('\.\/localProjectInspector(?:Python|Unity)\.cjs'\)/.test(node.getText(tree)))
      .map(node => ts.createPrinter().printNode(ts.EmitHint.Unspecified, node, tree)).join('\n');
  }
  assert.equal(retained(fs.readFileSync(path.resolve(__dirname, '../electron/localProjectInspectorService.cjs'), 'utf8')), retained(baseline));
}
for (const suffix of ['Python', 'Unity']) {
  const text = fs.readFileSync(require.resolve('../electron/localProjectInspector' + suffix + '.cjs'), 'utf8');
  assert.ok(text.split('\n').length <= 300);
  const tree = ts.createSourceFile('module.cjs', text, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isFunctionLike(node) && node.body) assert.ok(tree.getLineAndCharacterOfPosition(node.end).line - tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1 <= 50);
    ts.forEachChild(node, visit);
  }
  visit(tree);
}
const outcomes = [];
function compare(name, args) {
  const fn = name === 'inspectPython' ? inspectPython : inspectUnity;
  const actual = fn(...args);
  if (originals[name]) assert.deepEqual(actual, originals[name](...args));
  outcomes.push(actual);
  return actual;
}
const entry = (name, isFile = true, extension = '.py') => ({ name, isFile, extension });
const pythonNames = ['main.py', 'APP.PY', 'server.py', 'MANAGE.py', 'run.py', 'extra.py', 'not-python.txt'];
for (let mask = 0; mask < 128; mask++) for (const pyproject of [null, '[project]']) for (const requirements of [null, 'django']) {
  const entries = pythonNames.filter((_, index) => mask & (1 << index)).map(name => entry(name, true, name.endsWith('.txt') ? '.txt' : '.py'));
  compare('inspectPython', [entries, 'C:\\controlled\\project', pyproject, requirements]);
}
for (const entries of [[entry('main.py', false)], [entry('main.py', true, '.PY')], [entry('a.py'), entry('b.py'), entry('c.py'), entry('d.py'), entry('e.py')], [entry('manage.py'), entry('main.py')]])
  compare('inspectPython', [entries, '/controlled/project', '', '']);
const django = inspectPython([entry('manage.py'), entry('main.py')], '/project', null, 'django');
assert.equal(django.actions[0].command, 'python manage.py runserver');
assert.equal(django.actions[1].command, 'pip install -r requirements.txt');
assert.deepEqual(inspectPython([entry('MAIN.py')], '/project', null, null).info.entryFiles, ['main.py', 'MAIN.py'], 'Existing canonical-priority and original-case entries are preserved');
for (let mask = 0; mask < 4; mask++) for (const version of [undefined, null, '', 'm_EditorVersion: 6000.3\n', 'header\nm_EditorVersion: 2022.3.1  \r\n', 'no version', 'm_EditorVersion: first\nm_EditorVersion: second'])
  for (const manifest of [null, '', '{}']) {
    const entries = ['Assets', 'ProjectSettings'].filter((_, index) => mask & (1 << index)).map(name => ({ name }));
    compare('inspectUnity', [entries, '/controlled/project', version, manifest]);
  }
compare('inspectUnity', [[{ name: 'ASSETS' }, { name: 'projectsettings' }], '/project', null, null]);
assert.equal(inspectUnity([], '/project', null, '{}').detection.id, 'unity', 'Manifest-only detection remains supported');
assert.equal(inspectUnity([], '/project', null, null), null);
function exceptional(name, mode, original) {
  const trace = [], failure = Error('controlled ' + mode);
  const fn = original ? originals[name] : name === 'inspectPython' ? inspectPython : inspectUnity;
  try {
    let value;
    if (name === 'inspectPython') value = fn([{ get isFile() { trace.push('isFile'); return mode !== 'skip'; }, get extension() { trace.push('extension'); if (mode === 'extension') throw failure; return '.py'; }, get name() { trace.push('name'); if (mode === 'name') throw failure; return 'main.py'; } }], '/project', null, null);
    else value = fn([{ get name() { trace.push('name'); if (mode === 'name') throw failure; return 'Assets'; } }], '/project', { match(pattern) { trace.push(['match', String(pattern)]); if (mode === 'match') throw failure; return [null, { trim() { trace.push('trim'); if (mode === 'trim') throw failure; return 'version'; } }]; } }, null);
    return { value, trace };
  } catch (error) { assert.strictEqual(error, failure); return { error: error.message, trace }; }
}
for (const name of ['inspectPython', 'inspectUnity']) for (const mode of name === 'inspectPython' ? ['normal', 'skip', 'extension', 'name'] : ['normal', 'name', 'match', 'trim']) {
  const actual = exceptional(name, mode, false);
  if (originals[name]) assert.deepEqual(actual, exceptional(name, mode, true));
  outcomes.push(actual);
}
const hash = crypto.createHash('sha256').update(JSON.stringify(outcomes)).digest('hex');
assert.equal(hash, '4fdd95e03daf16e2bd64845f328a29db377bbf6835a5f6875116c2089a09cc9f', 'Reviewed Python/Unity results and evaluation order remain unchanged');
console.log('Project inspector Python/Unity passed: ' + outcomes.length + ' priority/case/limits/detection/version/getter/error cases; hash ' + hash);
