const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const crypto = require('node:crypto');
const { runSelection } = require('./area-picker-selection-smoke.cjs');
const rootFile = require.resolve('../electron/areaPickerService.cjs');
const old = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : null;
if (old) {
  const excluded = ['SelectionSession', 'ContextSync', 'WindowStack', 'EscapeShortcut', 'WindowController', 'InteractionAssembly'];
  function retained(text) {
    const t = ts.createSourceFile(rootFile, text, ts.ScriptTarget.Latest, true);
    const statements = t.statements.filter(n => !/require\('\.\/areaPicker(?:SelectionSession|ContextSync|WindowStack|EscapeShortcut|Window|InteractionAssembly).cjs'\)/.test(n.getText(t))).map(n => {
      if (!ts.isFunctionDeclaration(n) || n.name?.text !== 'createAreaPickerService') return n;
      const body = ts.factory.updateBlock(n.body, n.body.statements.filter(n => !(ts.isVariableStatement(n) && excluded.some(name => n.getText(t).includes('createAreaPicker' + name + '(')))));
      return ts.factory.updateFunctionDeclaration(n, n.modifiers, n.asteriskToken, n.name, n.typeParameters, n.parameters, n.type, body);
    });
    return ts.createPrinter().printFile(ts.factory.updateSourceFile(t, statements));
  }
  assert.equal(retained(fs.readFileSync(rootFile, 'utf8')), retained(old), 'Root border/disposal/API and original levels unchanged');
}
async function main() {
  const hash = crypto.createHash('sha256'); let cases = 0;
  for (const action of ['submit', 'cancel', 'escape', 'close', 'closed', 'dispose']) for (const loading of [false, true]) for (const shortcut of ['normal', 'false', 'throw']) for (const empty of [false, true]) {
    const actual = await runSelection(action, loading, shortcut, empty, false);
    if (old) assert.deepEqual(actual, await runSelection(action, loading, shortcut, empty, old));
    hash.update(JSON.stringify(actual) + '\n'); cases++;
  }
  assert.equal(hash.digest('hex'), '694d1e82bd625843be68682cf1822c58f9f5a8c12669750efc1b614fe7c7e566', 'Assembly preserves actual root window/selection/shortcut/timer behavior');
  console.log('Area root assembly passed: ' + cases + ' real-root selection/loading/shortcut/close/dispose/reuse cases; controlled Electron.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
