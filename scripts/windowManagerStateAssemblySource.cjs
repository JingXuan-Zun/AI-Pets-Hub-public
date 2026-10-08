const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function expandWindowManagerStateSource(root) {
  const parse = text => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const tree = parse(root), owner = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager');
  const bindings = owner.body.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === 'createWindowManagerStateControllers'));
  assert.equal(bindings.length, 1);
  const options = bindings[0].declarationList.declarations[0].initializer.arguments[0].properties;
  const callbacks = new Map(options.filter(ts.isPropertyAssignment).map(p => [p.name.getText(tree), p.initializer.getText(tree)]));
  const moduleTree = parse(fs.readFileSync('electron/windowManager/windowManagerStateControllers.cjs', 'utf8'));
  const phase = moduleTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManagerStateControllers');
  const expanded = phase.body.statements.filter(ts.isVariableStatement).map(statement => {
    const edits = [];
    function visit(n) {
      if (ts.isShorthandPropertyAssignment(n) && callbacks.has(n.name.text)) edits.push([n.getStart(moduleTree), n.end, n.name.text + ': ' + callbacks.get(n.name.text)]);
      ts.forEachChild(n, visit);
    }
    visit(statement);
    let text = statement.getText(moduleTree);
    for (const [start, end, value] of edits.reverse()) text = text.slice(0, start - statement.getStart(moduleTree)) + value + text.slice(end - statement.getStart(moduleTree));
    return text;
  }).join('\n');
  return root.slice(0, bindings[0].getStart(tree)) + expanded + root.slice(bindings[0].end);
}
module.exports = { expandWindowManagerStateSource };
