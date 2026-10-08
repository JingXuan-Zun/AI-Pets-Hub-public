const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const directory = path.resolve(__dirname, '../electron');
const entry = path.join(directory, 'desktopInputService.cjs');
const visited = new Set(), active = new Set();
let functions = 0;
function walk(file) {
  assert.ok(!active.has(file), 'Dependency cycle: ' + file);
  if (visited.has(file)) return;
  active.add(file); visited.add(file);
  const text = fs.readFileSync(file, 'utf8'), tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  assert.ok(text.split('\n').length <= 300, 'File budget: ' + file);
  function scan(node) {
    if (ts.isFunctionLike(node) && node.body) {
      functions++;
      const lines = tree.getLineAndCharacterOfPosition(node.end).line - tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
      assert.ok(lines <= 50, 'Function budget: ' + file + ':' + node.name?.getText(tree) + '=' + lines);
    }
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'require') {
      assert.ok(ts.isStringLiteral(node.arguments[0]), 'Computed dependency needs review: ' + file);
      if (node.arguments[0].text.startsWith('.')) {
        const target = path.resolve(path.dirname(file), node.arguments[0].text);
        assert.ok(path.dirname(target) === directory && path.basename(target).startsWith('desktopInput'), 'Unexpected dependency ownership: ' + target);
        walk(target);
      }
    }
    ts.forEachChild(node, scan);
  }
  scan(tree); active.delete(file);
}
walk(entry);
const implementations = fs.readdirSync(directory).filter(name => /^desktopInput.*\.cjs$/.test(name));
for (const name of implementations) assert.ok(visited.has(path.join(directory, name)), 'Unreachable implementation: ' + name);
assert.equal(visited.size, implementations.length);
console.log('Desktop input structure passed: ' + (visited.size - 1) + ' reachable implementations, ' + functions + ' functions, no cycles; all files <=300 and functions <=50.');
