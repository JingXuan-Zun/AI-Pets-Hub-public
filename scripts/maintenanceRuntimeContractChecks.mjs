import { spawnSync } from 'node:child_process';

// Keep the historical failure set repeatable without running packaged apps,
// real model requests, or using observation fixtures as production evidence.
const checks = [
  'agent-mode-router-v1-smoke.ts',
  'agent-production-session-boundary-smoke.ts',
  'agent-progress-store-performance-diagnostics-smoke.ts',
  'agent-followup-action-direct-command-smoke.ts',
  'agent-typing-state-cleanup-smoke.ts',
  'agent-desktop-execution-window-isolation-smoke.ts',
  'agent-fixed-directives-removed-smoke.ts',
  'agent-session-v2-in-app-launch-guidance-smoke.ts',
  'agent-runtime-legacy-retirement-gate-smoke.ts',
  'agent-run-controller-task-scoped-approval-continuation-smoke.ts',
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
