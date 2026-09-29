import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const p0SmokeFiles = [
  'agent-session-v2-smoke.ts',
  'agent-execute-desktop-action-tool-smoke.ts',
  'agent-execute-desktop-sequence-tool-smoke.ts',
  'agent-execute-desktop-observation-tool-smoke.ts',
  'agent-execute-local-file-action-tool-smoke.ts',
  'agent-execute-file-management-action-tool-smoke.ts',
  'agent-execute-memory-action-tool-smoke.ts',
  'agent-permission-router-v1-smoke.ts',
  'agent-production-lifecycle-facts-smoke.ts',
  'agent-session-v2-actionable-area-gate-smoke.ts',
  'agent-browser-search-tool-smoke.ts',
  'agent-local-folder-app-launcher-search-smoke.ts',
  'agent-session-v2-open-app-observation-final-rejection-smoke.ts',
  'agent-session-v2-open-app-observation-next-action-signal-smoke.ts',
  'desktop-organization-verification-smoke.ts',
  'agent-session-v2-desktop-organization-unverified-final-smoke.ts',
  'app-launch-verification-smoke.ts',
  'app-launch-packaged-windows-app-smoke.ts',
  'agent-character-skill-intent-boundary-smoke.ts',
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
