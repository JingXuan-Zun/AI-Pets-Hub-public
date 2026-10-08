import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
// Expand actual composition stages for older wiring audits, preserving their positions.
function expandWindowManagerStageSource(root, moduleFile, name) {
  const parse = text => ts.createSourceFile('windowManager.cjs', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const tree = parse(root), owner = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'createWindowManager');
  const bindings = owner.body.statements.filter(n => ts.isVariableStatement(n) && n.declarationList.declarations.some(d => d.initializer && ts.isCallExpression(d.initializer) && d.initializer.expression.getText(tree) === name));
  assert.equal(bindings.length, 1, 'Actual root stage: ' + name);
  const moduleTree = parse(fs.readFileSync(moduleFile, 'utf8'));
  const phase = moduleTree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(phase);
  const aliases = ['createAuxiliaryWindowContentControllers', 'createMainWindowLifecycleControllers', 'createWindowPresentationTrayControllers'].includes(name) ? new Map(bindings[0].declarationList.declarations[0].initializer.arguments[0].properties.filter(ts.isPropertyAssignment).map(p => [p.name.getText(tree), p.initializer.getText(tree)])) : new Map();
  const expanded = phase.body.statements.filter(ts.isVariableStatement).map(statement => {
    const edits = [];
    function visit(n) {
      if (ts.isShorthandPropertyAssignment(n) && aliases.has(n.name.text)) edits.push([n.getStart(moduleTree), n.end, n.name.text + ': ' + aliases.get(n.name.text)]);
      ts.forEachChild(n, visit);
    }
    visit(statement); let text = statement.getText(moduleTree);
    for (const [start, end, value] of edits.reverse()) text = text.slice(0, start - statement.getStart(moduleTree)) + value + text.slice(end - statement.getStart(moduleTree));
    return text;
  }).join('\n');
  return root.slice(0, bindings[0].getStart(tree)) + expanded + root.slice(bindings[0].end);
}

export function expandAuxiliaryWindowCreationSource(root) {
  return expandWindowManagerStageSource(expandAuxiliaryWindowContentSource(root), 'electron/windowManager/auxiliaryWindowCreationControllers.cjs', 'createAuxiliaryWindowCreationControllers');
}
export function expandWindowResourceMessagingSource(root) {
  return expandWindowManagerStageSource(root, 'electron/windowManager/windowResourceMessagingControllers.cjs', 'createWindowResourceMessagingControllers');
}

export function expandAuxiliaryWindowContentSource(root) {
  return expandWindowManagerStageSource(root, 'electron/windowManager/auxiliaryWindowContentControllers.cjs', 'createAuxiliaryWindowContentControllers');
}

export function expandMainWindowLifecycleSource(root) {
  return expandWindowManagerStageSource(root, 'electron/windowManager/mainWindowLifecycleControllers.cjs', 'createMainWindowLifecycleControllers');
}

export function expandWindowPresentationTraySource(root) {
  return expandWindowManagerStageSource(root, 'electron/windowManager/windowPresentationTrayControllers.cjs', 'createWindowPresentationTrayControllers');
}
