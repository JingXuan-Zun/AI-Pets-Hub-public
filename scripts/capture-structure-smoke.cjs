const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const entry = path.resolve(__dirname, '../electron/captureService.cjs');
const directory = path.resolve(__dirname, '../electron/capture');
const visited = new Set(), active = new Set();
const exceptions = []; let functions = 0;
function walk(file) {
  assert.ok(!active.has(file), 'Cycle: ' + file);
  if (visited.has(file)) return;
  active.add(file); visited.add(file);
  const text = fs.readFileSync(file, 'utf8'), ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const owned = file === entry || path.dirname(file) === directory;
  if (owned) assert.ok(text.split('\n').length <= 300, 'File budget: ' + file);
  function scan(n) {
    if (owned && ts.isFunctionLike(n) && n.body) {
      functions++;
      const lines = ast.getLineAndCharacterOfPosition(n.end).line - ast.getLineAndCharacterOfPosition(n.getStart(ast)).line + 1;
      if (lines > 50) {
        assert.ok(file === entry && n.name?.text === 'createCaptureService', 'Unexpected long function: ' + file + ':' + n.name?.getText(ast));
        exceptions.push({ name: n.name.text, lines });
      }
    }
    if (ts.isCallExpression(n) && n.expression.getText(ast) === 'require') {
      assert.ok(ts.isStringLiteral(n.arguments[0]), 'Computed dependency needs review: ' + file);
      if (n.arguments[0].text.startsWith('.')) walk(path.resolve(path.dirname(file), n.arguments[0].text));
    }
    ts.forEachChild(n, scan);
  }
  scan(ast); active.delete(file);
}
walk(entry);
for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.cjs'))) assert.ok(visited.has(path.join(directory, name)), 'Unreachable implementation: ' + name);
assert.equal(exceptions.length, 1, 'Reviewed root assembly exception still exceeds target');
assert.ok(exceptions[0].lines <= 69, 'Root assembly grew beyond its reviewed 69-line exception');
const implementations = [...visited].filter(file => path.dirname(file) === directory);
console.log(`Capture structure passed: ${implementations.length} reachable implementations, ${functions} owned functions, no cycles; files <=300, reviewed root assembly exception ${exceptions[0].lines}/50 remains.`);
