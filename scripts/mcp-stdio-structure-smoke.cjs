const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '../electron');
const expected = [
  'mcpArgumentSchemaValidation.cjs', 'mcpChildEnvironment.cjs', 'mcpFieldPolicy.cjs',
  'mcpFieldPolicyRules.cjs', 'mcpFieldPolicyResolvedRule.cjs',
  'mcpServerConfigLoader.cjs', 'mcpStdioCallPreflight.cjs', 'mcpStdioCallRequest.cjs',
  'mcpStdioCallResults.cjs', 'mcpStdioCallSchema.cjs', 'mcpStdioCancellation.cjs',
  'mcpStdioClientRules.cjs', 'mcpStdioClientService.cjs', 'mcpStdioIdleEviction.cjs',
  'mcpStdioPoolClosure.cjs',
  'mcpStdioPoolEntry.cjs',
  'mcpStdioPoolRpc.cjs', 'mcpStdioPoolControls.cjs',
  'mcpStdioRestartPolicyRules.cjs', 'mcpStdioRestartStatusStore.cjs', 'mcpStdioRestartRecorder.cjs',
  'mcpStdioSession.cjs', 'mcpStdioSessionCloseReason.cjs', 'mcpStdioSessionManagement.cjs',
  'mcpStdioSessionPool.cjs', 'mcpStdioSessionPoolStatus.cjs', 'mcpStdioSessionRestartPolicy.cjs',
  'mcpStdioSpawnSpec.cjs', 'mcpStdioToolCallHandler.cjs', 'mcpStdioToolCallRunner.cjs',
  'mcpStdioToolCatalog.cjs', 'mcpStdioToolDiscovery.cjs',
].sort();
const visited = new Set(), active = [], allFunctions = [];
function visit(file) {
  assert.ok(!active.includes(file), 'Circular MCP dependency: ' + [...active, file].join(' -> '));
  if (visited.has(file)) return;
  const relative = path.relative(root, file);
  assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative), 'Dependency must remain inside electron');
  const text = fs.readFileSync(file, 'utf8');
  const tree = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  assert.ok(text.split('\n').length <= 300, relative + ' exceeds the file budget');
  visited.add(file); active.push(file);
  function scan(node) {
    if (ts.isFunctionLike(node) && node.body) {
      const lines = tree.getLineAndCharacterOfPosition(node.end).line - tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1;
      const name = node.name?.getText(tree) || '<callback>';
      const key = relative + ':' + name;
      allFunctions.push(key);
      assert.ok(lines <= 50, `${key}: ${lines} exceeds the function budget`);
    }
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'require') {
      assert.ok(node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0]), 'Unexpected dynamic require in ' + relative);
      const id = node.arguments[0].text;
      if (id.startsWith('.')) {
        assert.ok(id.endsWith('.cjs'), 'Unexpected local dependency extension: ' + id);
        visit(path.resolve(path.dirname(file), id));
      }
    }
    ts.forEachChild(node, scan);
  }
  scan(tree); active.pop();
}
visit(path.join(root, 'mcpStdioClientService.cjs'));
assert.deepEqual([...visited].map(file => path.relative(root, file)).sort(), expected, 'Review all added or removed production dependencies');
assert.equal(allFunctions.length, 176, 'Review changed production function inventory');
console.log(`MCP structure passed: ${visited.size} reachable modules, ${allFunctions.length} functions, no circular dependencies, all files <=300, all functions <=50, no budget exceptions.`);
