import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export function assertImplementationModuleGraph(options: {
  entry: string;
  directory: string;
  maxEntryLines?: number;
}) {
  const files = [options.entry, ...readdirSync(options.directory)
    .filter(file => /\.(?:tsx?|cjs)$/u.test(file)).map(file => `${options.directory}/${file}`)];
  const dependencies = new Map<string, string[]>();
  const allImports = new Map<string, string[]>();
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const budget = file === options.entry ? options.maxEntryLines ?? 300 : 300;
    assert.ok(text.split(/\r?\n/u).length <= budget, `${file} exceeds ${budget} lines`);
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const runtimeTargets: string[] = [], targets: string[] = [];
    function addTarget(specifier: string, runtime: boolean) {
      if (!specifier.startsWith('.')) return;
      const target = path.resolve(path.dirname(file), specifier).replace(/\.(?:tsx?|cjs)$/u, '');
      const resolved = files.find(candidate => path.resolve(candidate).replace(/\.(?:tsx?|cjs)$/u, '') === target);
      if (!resolved) return;
      targets.push(resolved);
      if (runtime) runtimeTargets.push(resolved);
    }
    for (const node of source.statements) {
      if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const typeOnly = node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause)
          && node.exportClause.elements.every(element => element.isTypeOnly));
        addTarget(node.moduleSpecifier.text, !typeOnly);
        continue;
      }
      if (!ts.isImportDeclaration(node)) continue;
      const specifier = (node.moduleSpecifier as ts.StringLiteral).text;
      const typeOnly = node.importClause?.isTypeOnly || (node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings)
        && node.importClause.namedBindings.elements.every(element => element.isTypeOnly));
      addTarget(specifier, !typeOnly);
    }
    function collectRequires(node: ts.Node) {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require'
        && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) addTarget(node.arguments[0].text, true);
      ts.forEachChild(node, collectRequires);
    }
    collectRequires(source);
    dependencies.set(file, runtimeTargets);
    allImports.set(file, targets);
  }
  const checked = new Set<string>();
  function visit(file: string, stack: string[]) {
    assert.ok(!stack.includes(file), `Runtime dependency cycle: ${[...stack, file].join(' -> ')}`);
    if (checked.has(file)) return;
    for (const target of dependencies.get(file) ?? []) visit(target, [...stack, file]);
    checked.add(file);
  }
  files.forEach(file => visit(file, []));
  const reachable = new Set<string>();
  function collect(file: string) {
    if (reachable.has(file)) return;
    reachable.add(file);
    for (const target of allImports.get(file) ?? []) collect(target);
  }
  collect(options.entry);
  assert.deepEqual(files.filter(file => !reachable.has(file)), [], 'Implementation modules must remain reachable');
}
