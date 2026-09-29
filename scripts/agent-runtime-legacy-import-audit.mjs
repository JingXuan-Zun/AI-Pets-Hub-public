import { auditAgentRuntimeLegacyImports } from './agentRuntimeLegacyImportAuditCore.mjs';

const { changed, violations } = auditAgentRuntimeLegacyImports({
  fix: process.argv.includes('--fix'),
});

if (changed.length) {
  console.log(`Migrated ${changed.length} historical script import(s) to agent/legacy/index.ts.`);
}
if (violations.length) {
  console.error('Historical V3/Pilot scripts still importing the production Agent barrel:');
  for (const filePath of violations) {
    console.error(`- ${filePath}`);
  }
  process.exitCode = 1;
} else {
  console.log('agent runtime legacy import audit ok');
}
