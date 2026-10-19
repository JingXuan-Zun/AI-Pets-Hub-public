import { spawnSync } from 'node:child_process';

const flows = [
  ['app-launch-layered-resolution-and-verification', 'app-launch-verification-smoke.ts'],
  ['open-packaged-windows-app', 'app-launch-packaged-windows-app-smoke.ts'],
  ['runtime-dispatch-evidence-commit-boundary', 'agent-dispatch-evidence-smoke.ts'],
  ['agent-performance-fast-observation-default', 'agent-observe-windows-fast-default-smoke.ts'],
];

if (!process.argv.includes('--run')) {
  for (const [flow, script] of flows) {
    console.log(`${flow}: scripts/${script}`);
  }
  console.log(`agent real user flow matrix manifest ok (${flows.length} flows)`);
} else {
  let failed = 0;
  for (const [flow, script] of flows) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', `scripts/${script}`], {
      encoding: 'utf8', windowsHide: true, timeout: 120_000,
    });
    const passed = result.status === 0 && !result.error;
    console.log(`${passed ? 'PASS' : 'FAIL'} ${flow}: scripts/${script}`);
    if (!passed) {
      failed += 1;
      console.error(result.error ?? [result.stdout, result.stderr].filter(Boolean).join('\n'));
    }
  }
  console.log(`Agent user-flow regressions: ${flows.length - failed}/${flows.length} passed`);
  process.exitCode = failed ? 1 : 0;
}
