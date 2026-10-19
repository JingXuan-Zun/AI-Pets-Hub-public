import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const p0SmokeFiles = [
  'app-launch-verification-smoke.ts',
  'app-launch-packaged-windows-app-smoke.ts',
];

const failures = [];

for (const fileName of p0SmokeFiles) {
  const scriptPath = path.join('scripts', fileName);
  const sourceText = readFileSync(scriptPath, 'utf8');
  const result = ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: scriptPath,
    reportDiagnostics: true,
  });
  const diagnostics = result.diagnostics ?? [];

  if (diagnostics.length > 0) {
    const output = diagnostics
      .map((diagnostic) => {
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
        if (!diagnostic.file || diagnostic.start === undefined) {
          return message;
        }

        const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        return `${position.line + 1}:${position.character + 1} ${message}`;
      })
      .join('\n');
    failures.push(`${fileName}\n${output}`);
  }
}

if (failures.length > 0) {
  console.error(`agent p0 smoke health failed (${failures.length}/${p0SmokeFiles.length})`);
  console.error(failures.join('\n\n---\n\n'));
  process.exit(1);
}

console.log(`agent p0 smoke health ok (${p0SmokeFiles.length} scripts)`);
