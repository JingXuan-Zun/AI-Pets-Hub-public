import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const entry = 'electron/windowManager.cjs';
const directory = 'electron/windowManager';
const files = [entry, ...fs.readdirSync(directory).filter(name => name.endsWith('.cjs')).map(name => `${directory}/${name}`)];
// These stateful factories still contain nested functions. Keep the remaining
// composition debt explicit; it does not exempt their execution functions.
const compositionOwners = new Set([
  'createWindowManager',
]);
const edges = new Map<string, string[]>(), compositionDebt: string[] = [];
let functions = 0;
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n').length;
  assert.ok(lines <= (file === entry ? 250 : 300), `${file}: ${lines} lines exceeds budget`);
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const dependencies: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require'
      && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      const specifier = node.arguments[0].text;
      if (specifier.startsWith('.')) {
        const target = path.resolve(path.dirname(file), specifier);
        if (target.startsWith(path.resolve(directory) + path.sep)) {
          assert.ok(fs.existsSync(target) && fs.statSync(target).isFile(), `${file}: missing ${specifier}`);
          assert.ok(files.some(candidate => path.resolve(candidate) === target), `${file}: unexpected dependency ${specifier}`);
          dependencies.push(path.relative(process.cwd(), target).replaceAll('\\', '/'));
        }
      }
    }
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      functions++;
      const length = source.getLineAndCharacterOfPosition(node.end).line
        - source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const name = node.name?.getText(source);
      if (length > 50 && name && compositionOwners.has(name)) {
        assert.ok(file === entry && name === 'createWindowManager' && length <= 181,
          `${file}:${name}: composition owner exceeds the audited 181-line budget`);
        compositionDebt.push(`${file}:${name}=${length}`);
      }
      else assert.ok(length <= 50, `${file}:${name ?? '<anonymous>'}: ${length} execution lines exceeds 50`);
    }
    ts.forEachChild(node, visit);
  }
  visit(source); edges.set(file, dependencies);
}
const visited = new Set<string>(), active = new Set<string>();
function walk(file: string, chain: string[] = []) {
  assert.ok(!active.has(file), `module cycle: ${[...chain, file].join(' -> ')}`);
  if (visited.has(file)) return;
  visited.add(file); active.add(file);
  for (const dependency of edges.get(file) ?? []) walk(dependency, [...chain, file]);
  active.delete(file);
}
walk(entry);
assert.deepEqual(files.filter(file => !visited.has(file)), [], 'detached modules must not count as completed splits');
console.log(`Window module structure passed (${files.length - 1} reachable modules, no cycles, module/execution budgets; root ${fs.readFileSync(entry, 'utf8').split('\n').length}/300 file target met; composition target pending, ${compositionDebt.length} composition owners over 50 lines, ${functions} functions inspected).`);
console.log(compositionDebt.join('\n'));
