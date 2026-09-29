const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createExternalSkillCapabilityGateway } = require('../electron/externalSkillCapabilityGateway.cjs');

function createArtifactStore() {
  const packages = new Map();
  function add(packageId, digest) {
    packages.set(packageId, { artifactDigest: digest, packageId, status: 'staged' });
  }
  return {
    add,
    getPackage: (packageId) => ({ ok: true, package: packages.get(packageId) ?? null }),
    quarantinePackage: (packageId, reason) => {
      const current = packages.get(packageId);
      if (!current) return { error: 'package_artifact_not_found', ok: false };
      const quarantined = { ...current, reason, status: 'quarantined' };
      packages.set(packageId, quarantined);
      return { ok: true, package: quarantined };
    },
    readPackageArtifact: (packageId) => {
      const artifact = packages.get(packageId);
      if (!artifact) return { error: 'package_artifact_not_found', ok: false };
      if (artifact.status === 'quarantined') return { error: 'package_artifact_quarantined', ok: false };
      return {
        artifact,
        ok: true,
        rawPackageJson: JSON.stringify({
          kind: 'agent-skill-package.v1',
          runtime: { entrypoint: 'run', kind: 'wasm-pure-json-v1', moduleBase64: 'AA==' },
          scaffold: { skill: { id: 'character.animation' } },
        }),
      };
    },
  };
}

function createSupervisor() {
  let calls = 0;
  return {
    cancelProbe: () => ({ cancelled: false }),
    getCalls: () => calls,
    runPackageExecution: async (request) => {
      calls += 1;
      if (request.input?.action === 'infrastructure-failure') {
        return { error: 'spawn EPERM', packageCodeLoaded: false, packageId: request.packageId, requestId: request.requestId, status: 'failed' };
      }
      if (request.input?.action === 'cancelled') {
        return { packageCodeLoaded: true, packageId: request.packageId, requestId: request.requestId, status: 'cancelled' };
      }
      if (request.input?.action === 'timed-out') {
        return { packageCodeLoaded: true, packageId: request.packageId, requestId: request.requestId, status: 'timed-out' };
      }
      if (request.input?.action === 'worker-exit') {
        return { error: 'worker_exit_1', packageCodeLoaded: false, packageId: request.packageId, requestId: request.requestId, status: 'failed' };
      }
      if (request.input?.action === 'fail') {
        return {
          error: 'wasm_execution_failed',
          packageCodeLoaded: true,
          packageId: request.packageId,
          requestId: request.requestId,
          status: 'failed',
          workerReceipt: { kind: 'external-skill-sandbox-execution-receipt.v1' },
        };
      }
      return { output: { ok: true }, packageCodeLoaded: true, packageId: request.packageId, requestId: request.requestId, status: 'succeeded' };
    },
  };
}

function createGateway({ artifactStore, now, supervisor, tempRoot }) {
  return createExternalSkillCapabilityGateway({ artifactStore, now, supervisor, userDataPath: tempRoot });
}

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-package-health-'));
  const artifactStore = createArtifactStore();
  const supervisor = createSupervisor();
  const packageId = 'character.animation@health-crash';
  artifactStore.add(packageId, 'a'.repeat(64));
  let nowMs = Date.parse('2026-07-26T13:00:00.000Z');
  let gateway = createGateway({ artifactStore, now: () => nowMs, supervisor, tempRoot });

  const firstFailure = await gateway.runPackageExecution({ input: { action: 'fail' }, packageId, requestId: 'health-failure-1' });
  assert.equal(firstFailure.status, 'failed');
  assert.equal(firstFailure.packageHealth.status, 'backoff');
  assert.equal(firstFailure.packageHealth.consecutiveFailures, 1);
  assert.equal(firstFailure.packageHealth.retryAfterMs, 1000);

  gateway = createGateway({ artifactStore, now: () => nowMs, supervisor, tempRoot });
  const blockedAfterRestart = await gateway.runPackageExecution({ input: { action: 'fail' }, packageId, requestId: 'health-backoff-1' });
  assert.equal(blockedAfterRestart.error, 'external_skill_retry_backoff_active');
  assert.equal(supervisor.getCalls(), 1);

  nowMs += 1001;
  const secondFailure = await gateway.runPackageExecution({ input: { action: 'fail' }, packageId, requestId: 'health-failure-2' });
  assert.equal(secondFailure.packageHealth.consecutiveFailures, 2);
  assert.equal(secondFailure.packageHealth.retryAfterMs, 2000);

  nowMs += 2001;
  const thirdFailure = await gateway.runPackageExecution({ input: { action: 'fail' }, packageId, requestId: 'health-failure-3' });
  assert.equal(thirdFailure.packageHealth.status, 'quarantined');
  assert.equal(thirdFailure.packageHealth.quarantineApplied, true);
  assert.equal(artifactStore.getPackage(packageId).package.status, 'quarantined');
  const blockedQuarantine = await gateway.runPackageExecution({ input: { action: 'ok' }, packageId, requestId: 'health-quarantined' });
  assert.equal(blockedQuarantine.error, 'package_artifact_quarantined');
  assert.equal(supervisor.getCalls(), 3);
  assert.equal(gateway.resetPackageHealth({ packageId }).error, 'package_artifact_quarantined');

  artifactStore.add(packageId, 'b'.repeat(64));
  const updatedSuccess = await gateway.runPackageExecution({ input: { action: 'ok' }, packageId, requestId: 'health-updated-artifact' });
  assert.equal(updatedSuccess.status, 'succeeded');
  assert.equal(updatedSuccess.packageHealth.status, 'healthy');
  assert.equal(updatedSuccess.packageHealth.artifactDigest, 'b'.repeat(64));

  const infrastructurePackage = 'character.animation@health-infrastructure';
  artifactStore.add(infrastructurePackage, 'c'.repeat(64));
  const infrastructureFailure = await gateway.runPackageExecution({
    input: { action: 'infrastructure-failure' },
    packageId: infrastructurePackage,
    requestId: 'health-infrastructure-failure',
  });
  assert.equal(infrastructureFailure.packageHealth.classification, 'ignored');
  const afterInfrastructureFailure = await gateway.runPackageExecution({
    input: { action: 'ok' },
    packageId: infrastructurePackage,
    requestId: 'health-infrastructure-retry',
  });
  assert.equal(afterInfrastructureFailure.status, 'succeeded');

  const classificationPackage = 'character.animation@health-classification';
  artifactStore.add(classificationPackage, 'e'.repeat(64));
  const timedOut = await gateway.runPackageExecution({ input: { action: 'timed-out' }, packageId: classificationPackage, requestId: 'health-timeout' });
  assert.equal(timedOut.packageHealth.consecutiveFailures, 1);
  nowMs += 1001;
  const cancelled = await gateway.runPackageExecution({ input: { action: 'cancelled' }, packageId: classificationPackage, requestId: 'health-cancelled' });
  assert.equal(cancelled.packageHealth.classification, 'ignored');
  assert.equal(cancelled.packageHealth.consecutiveFailures, 1);
  const workerExit = await gateway.runPackageExecution({ input: { action: 'worker-exit' }, packageId: classificationPackage, requestId: 'health-worker-exit' });
  assert.equal(workerExit.packageHealth.consecutiveFailures, 2);
  nowMs += 2001;
  const permissionRejected = await gateway.runPackageExecution({
    input: { action: 'ok' },
    packageId: classificationPackage,
    permissionScopes: ['filesystem.read'],
    requestId: 'health-permission-rejected',
  });
  assert.equal(permissionRejected.packageHealth.classification, 'ignored');
  assert.equal(permissionRejected.packageHealth.consecutiveFailures, 2);

  const recoveryPackage = 'character.animation@health-recovery';
  artifactStore.add(recoveryPackage, 'd'.repeat(64));
  const recoveryFailure = await gateway.runPackageExecution({ input: { action: 'fail' }, packageId: recoveryPackage, requestId: 'health-recovery-fail' });
  assert.equal(recoveryFailure.packageHealth.consecutiveFailures, 1);
  nowMs += 1001;
  const recovered = await gateway.runPackageExecution({ input: { action: 'ok' }, packageId: recoveryPackage, requestId: 'health-recovery-success' });
  assert.equal(recovered.packageHealth.consecutiveFailures, 0);
  assert.equal(recovered.packageHealth.status, 'healthy');

  const health = gateway.listPackageHealth({ packageId });
  assert.equal(health.totalCount, 1);
  assert.equal(health.entries[0].artifactDigest, 'b'.repeat(64));
  assert.equal(fs.existsSync(gateway.getPaths().healthStatePath), true);

  const ipcSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'ipcHandlers.cjs'), 'utf8');
  const preloadSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'preload.cjs'), 'utf8');
  assert.match(ipcSource, /desktop-pet:list-external-skill-package-health/u);
  assert.match(ipcSource, /desktop-pet:reset-external-skill-package-health/u);
  assert.match(preloadSource, /listExternalSkillPackageHealth/u);
  assert.match(preloadSource, /resetExternalSkillPackageHealth/u);
  fs.rmSync(tempRoot, { force: true, recursive: true });
}

run().then(() => console.log('agent skill package health policy smoke passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
