const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const entry = path.resolve(__dirname, '../electron/localFileSystemService.cjs');
const visited = new Set();
const active = new Set();
let functions = 0;
function walk(file) {
  assert.ok(!active.has(file), 'Dependency cycle: ' + file);
  if (visited.has(file)) return;
  visited.add(file); active.add(file);
  const text = fs.readFileSync(file, 'utf8');
  assert.ok(text.split('\n').length <= 300, 'File budget: ' + file);
  const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  function scan(node) {
    if (ts.isFunctionLike(node) && node.body) {
      functions++;
      const length = ast.getLineAndCharacterOfPosition(node.end).line
        - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      assert.ok(length <= 50, 'Function budget: ' + file + ':' + node.name?.getText(ast));
    }
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'require') {
      assert.ok(ts.isStringLiteral(node.arguments[0]), 'Computed dependency requires explicit review: ' + file);
      if (node.arguments[0].text.startsWith('.')) walk(path.resolve(path.dirname(file), node.arguments[0].text));
    }
    ts.forEachChild(node, scan);
  }
  scan(ast); active.delete(file);
}
walk(entry);
const owned = fs.readdirSync(path.dirname(entry)).filter(name => /^localFileSystem.*\.cjs$/.test(name));
for (const name of owned) assert.ok(visited.has(path.join(path.dirname(entry), name)), 'Unreachable module: ' + name);
assert.ok(visited.has(path.resolve(__dirname, '../electron/sensitivePathPolicy.cjs')));
console.log(`Local filesystem structure passed: ${visited.size} reachable modules, ${functions} functions, no cycles; all files <=300 and functions <=50.`);
