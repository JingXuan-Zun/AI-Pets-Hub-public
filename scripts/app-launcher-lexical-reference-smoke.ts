import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

// CommonJS refactors can pass renderer tsc and source-pattern tests while leaving
// an unbound name in a rarely exercised branch. Check the actual implementation.
const files = ['electron/appLauncherService.cjs', ...readdirSync('electron/appLauncher')
  .filter(file => file.endsWith('.cjs')).map(file => `electron/appLauncher/${file}`)];
const program = ts.createProgram(files, {
  allowJs: true, checkJs: true, noEmit: true, skipLibCheck: true,
  target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext, types: ['node'],
});
const diagnostics = files.flatMap(file => program.getSemanticDiagnostics(program.getSourceFile(path.resolve(file))!))
  .filter(diagnostic => diagnostic.code === 2304 || diagnostic.code === 2552);
assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
  getCurrentDirectory: () => process.cwd(), getCanonicalFileName: file => file, getNewLine: () => '\n',
}));
console.log('app launcher lexical reference smoke: PASS (no unbound names in entry or implementation modules)');
