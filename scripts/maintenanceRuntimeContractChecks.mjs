import { spawnSync } from 'node:child_process';

// Keep the historical failure set repeatable without running packaged apps,
// real model requests, or using observation fixtures as production evidence.
const checks = [
  'agent-typing-state-cleanup-smoke.ts',
  'agent-desktop-execution-window-isolation-smoke.ts',
  'agent-runtime-cancellation-guard-smoke.mjs',
];

let failed = 0;
for (const file of checks) {
  const result = spawnSync(process.execPath, [
    ...(file.endsWith('.ts') ? ['--import', 'tsx'] : []),
    `scripts/${file}`,
  ], { encoding: 'utf8', windowsHide: true, timeout: 120_000 });
  const passed = result.status === 0 && !result.error;
  console.log(`${passed ? 'PASS' : 'FAIL'} ${file}`);
  if (!passed) {
    failed += 1;
    console.error(result.error ?? [result.stdout, result.stderr].filter(Boolean).join('\n'));
  }
}
console.log(`Runtime maintenance contracts: ${checks.length - failed}/${checks.length} passed`);
process.exitCode = failed ? 1 : 0;
