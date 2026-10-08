import { spawnSync } from 'node:child_process';

const flows = [
  ['readonly-observation-with-negated-side-effects', 'agent-readonly-negated-side-effect-scope-smoke.ts'],
  ['runtime-core-open-move-v0-2', 'agent-runtime-core-v0-2-smoke.ts'],
  ['open-website-move-secondary', 'agent-open-move-display-sequence-smoke.ts'],
  ['move-existing-window-after-display-observation', 'agent-session-v2-display-observation-open-move-continuation-smoke.ts'],
  ['move-localized-window-after-identity-preflight', 'agent-session-v2-window-target-identity-preflight-smoke.ts'],
  ['organize-desktop-verify-moved', 'desktop-organization-verification-smoke.ts'],
  ['organize-desktop-preview-continues-to-approval', 'agent-session-v2-approval-ready-followup-smoke.ts'],
  ['open-local-app-control-window', 'agent-execute-desktop-action-tool-smoke.ts'],
  ['app-launch-layered-resolution-and-verification', 'app-launch-verification-smoke.ts'],
  ['open-packaged-windows-app', 'app-launch-packaged-windows-app-smoke.ts'],
  ['search-find-app-launch', 'agent-local-folder-app-launcher-search-smoke.ts'],
  ['open-target-inside-app', 'agent-session-v2-in-app-launch-flow-smoke.ts'],
  ['runtime-in-app-gate-after-outer-observation', 'agent-runtime-in-app-gate-smoke.ts'],
  ['runtime-dispatch-evidence-commit-boundary', 'agent-dispatch-evidence-smoke.ts'],
  ['open-target-inside-app-after-unverified-launch', 'agent-session-v2-unverified-launch-then-in-app-locate-smoke.ts'],
  ['open-target-inside-app-uia-invoke-priority', 'agent-session-v2-in-app-uia-invoke-priority-smoke.ts'],
  ['open-target-inside-app-visual-coordinate-fallback', 'agent-session-v2-in-app-visual-coordinate-fallback-smoke.ts'],
  ['open-target-inside-app-select-then-primary-action', 'agent-session-v2-in-app-select-then-primary-action-smoke.ts'],
  ['in-app-action-loading-waits-then-completes', 'agent-session-v2-uia-disabled-loading-recovery-smoke.ts'],
  ['in-app-action-loading-waits-then-next-action', 'agent-session-v2-uia-loading-next-action-smoke.ts'],
  ['in-app-action-unchanged-recovery', 'agent-session-v2-uia-unchanged-recovery-smoke.ts'],
  ['in-app-action-same-control-coordinate-fallback', 'agent-session-v2-uia-unchanged-same-control-coordinate-fallback-smoke.ts'],
  ['agent-performance-fast-observation-default', 'agent-observe-windows-fast-default-smoke.ts'],
  ['agent-performance-light-action-evidence', 'agent-action-evidence-performance-guard-smoke.ts'],
  ['recovery-failed-tool-evidence-route', 'agent-session-v2-failed-tool-recovery-signal-smoke.ts'],
  ['recovery-recoverable-unverified-signal', 'agent-session-v2-recoverable-unverified-rejection-signal-smoke.ts'],
  ['recovery-repeated-unverified-retry-rejected', 'agent-session-v2-repeated-unverified-action-retry-rejection-signal-smoke.ts'],
  ['recovery-desktop-organization-unverified-final-rejected', 'agent-session-v2-desktop-organization-unverified-final-smoke.ts'],
  ['approval-continues-execution', 'agent-session-v2-merged-approval-tool-calls-smoke.ts'],
  ['approval-batched-sequence-ux', 'agent-approval-batching-ux-smoke.ts'],
  ['observation-not-completion', 'agent-session-v2-open-app-observation-final-rejection-smoke.ts'],
  ['unverified-not-completion', 'agent-session-v2-unverified-result-final-rejection-signal-smoke.ts'],
  ['explicit-display-role-binding', 'agent-session-v2-explicit-display-role-binding-smoke.ts'],
  ['stale-outer-target-evidence-continuation', 'agent-stale-outer-target-evidence-continuation-smoke.ts'],
  ['window-only-launch-recovery', 'agent-session-v2-window-only-launch-recovery-smoke.ts'],
  ['pre-dispatch-wait-observation-launch', 'agent-session-v2-pre-dispatch-wait-observation-launch-smoke.ts'],
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
