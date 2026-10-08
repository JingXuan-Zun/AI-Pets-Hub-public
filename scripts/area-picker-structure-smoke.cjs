const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const directory = path.resolve(__dirname, '../electron');
const files = fs.readdirSync(directory).filter(name => /^areaPicker.*\.cjs$/.test(name)).map(name => path.join(directory, name));
const graph = new Map();
let functions = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  assert.ok(source.split('\n').length <= 300, path.basename(file) + ' source budget');
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true), dependencies = [];
  function visit(n) {
    if (ts.isFunctionLike(n) && n.body) {
      functions++;
      const lines = tree.getLineAndCharacterOfPosition(n.end).line - tree.getLineAndCharacterOfPosition(n.getStart(tree)).line + 1;
      assert.ok(lines <= 50, path.basename(file) + ':' + (n.name?.getText(tree) ?? 'callback') + ' function budget');
    }
    if (ts.isCallExpression(n) && n.expression.getText(tree) === 'require' && n.arguments.length === 1 && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text.startsWith('./areaPicker')) {
      const target = path.resolve(path.dirname(file), n.arguments[0].text);
      assert.ok(files.includes(target), 'Missing area picker dependency ' + target);
      dependencies.push(target);
    }
    ts.forEachChild(n, visit);
  }
  visit(tree); graph.set(file, dependencies);
}
const visited = new Set(), active = new Set();
function walk(file) {
  assert.ok(!active.has(file), 'Area picker dependency cycle at ' + file);
  if (visited.has(file)) return;
  active.add(file);
  for (const target of graph.get(file)) walk(target);
  active.delete(file); visited.add(file);
}
walk(path.join(directory, 'areaPickerService.cjs'));
assert.equal(visited.size, files.length, 'All area picker modules must be reachable from production entry');
const fixtureModule = { exports: {} };
new Function('require', 'module', fs.readFileSync(path.join(directory, 'areaPickerService.cjs'), 'utf8'))(id => id === 'electron' ? { BrowserWindow: class {}, globalShortcut: {}, screen: {} } : require(path.resolve(directory, id)), fixtureModule);
assert.deepEqual(Object.keys(fixtureModule.exports), ['createAreaPickerService']);
const options = { captureService: {}, windowManager: {} };
const first = fixtureModule.exports.createAreaPickerService(options), second = fixtureModule.exports.createAreaPickerService(options);
assert.deepEqual(Object.keys(first), ['cancelAreaPickerSelection','dispose','getAreaPickerContext','getAreaPickerWindow','getPersistentAreaBorderWindow','openNativeAreaPickerWindow','refreshPersistentAreaBorder','submitAreaPickerSelection','syncPersistentAreaBorderFromSettingsAction']);
for (const name of Object.keys(first)) assert.notEqual(first[name], second[name]);
assert.equal(first.getAreaPickerContext(), null); assert.equal(second.getAreaPickerWindow(), null);
console.log('Area picker structure passed: ' + files.length + ' reachable, acyclic modules; ' + functions + ' functions; all files within 300 lines and all functions within 50 lines; public API and instance isolation.');
