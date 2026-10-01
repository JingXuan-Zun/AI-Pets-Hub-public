import assert from 'node:assert/strict';
import ts from 'typescript';

export function assertProductionRuntimeCancellation(source, fileName = 'controller.ts') {
  const ast = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true);
  const calls = [];
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)
      && node.expression.text === 'cancelAgentProductionRuntime') calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(calls.length > 0, 'Controller cancellation must enter the production Runtime.');
  for (const call of calls) {
    const options = call.arguments[0];
    assert.ok(options && ts.isObjectLiteralExpression(options), 'Cancellation must receive explicit Runtime options.');
    assert.ok(options.properties.some((property) => (
      (ts.isShorthandPropertyAssignment(property) && property.name.text === 'continuation')
      || (ts.isPropertyAssignment(property) && property.name.getText(ast) === 'continuation'
        && ts.isIdentifier(property.initializer) && property.initializer.text === 'continuation')
    )), 'Cancellation must forward the existing continuation to the production Runtime.');
  }
}
