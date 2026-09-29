const assert = require('assert').strict;
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createExternalSkillCapabilityGateway } = require('../electron/externalSkillCapabilityGateway.cjs');
const { createExternalSkillSandboxSupervisorService } = require('../electron/externalSkillSandboxSupervisorService.cjs');
const { createSkillPackageArtifactStore } = require('../electron/skillPackageArtifactStore.cjs');
const { createSkillPackageSignedInstallCoordinator } = require('../electron/skillPackageSignedInstallCoordinator.cjs');
const { createCapabilityRequestWasmBase64 } = require('./external-skill-capability-wasm-fixture.cjs');

function normalizeJsonValue(value) {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).sort().reduce((result, key) => ({ ...result, [key]: normalizeJsonValue(value[key]) }), {});
}

function signPackage(packageValue, privateKey) {
  const unsigned = JSON.parse(JSON.stringify(packageValue));
  const payload = JSON.stringify(normalizeJsonValue({
    kind: 'agent-skill-package-signature-payload.v1',
    package: unsigned,
  }));
  return {
    ...packageValue,
    signature: {
      algorithm: 'ed25519',
      digest: 'sha256:canonical-v1',
      keyId: 'capability-gateway-test-key',
      signature: crypto.sign(null, Buffer.from(payload), privateKey).toString('base64'),
    },
  };
}

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-capability-gateway-'));
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const artifactStore = createSkillPackageArtifactStore({ userDataPath: tempRoot });
  const coordinator = createSkillPackageSignedInstallCoordinator({ artifactStore, userDataPath: tempRoot });
  const packageId = 'character.animation@capability-gateway';
  const packageValue = signPackage({
    kind: 'agent-skill-package.v1',
    runtime: {
      entrypoint: 'run',
      kind: 'wasm-pure-i32-v1',
      moduleBase64: Buffer.from('0061736d0100000001060160017f017f030201000707010372756e00000a09010700200041016a0b', 'hex').toString('base64'),
    },
    scaffold: { skill: { id: 'character.animation' } },
  }, privateKey);
  const trustedKeyRegistry = {
    keys: [{
      algorithm: 'ed25519',
      keyId: 'capability-gateway-test-key',
      publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    }],
    kind: 'agent-skill-trusted-signature-key-registry.v1',
  };
  assert.equal(coordinator.stageSignedPackage({
    packageId,
    rawPackageJson: JSON.stringify(packageValue),
    trustedKeyRegistry,
  }).ok, true);

  let executionCalls = 0;
  const supervisor = {
    runPackageExecution: async (request) => {
      executionCalls += 1;
      return { packageId: request.packageId, packageCodeLoaded: true, status: 'succeeded' };
    },
  };
  const gateway = createExternalSkillCapabilityGateway({ artifactStore, supervisor, userDataPath: tempRoot });
  assert.equal(gateway.listGrants().grants.length, 0);

  const zeroCapability = await gateway.runPackageExecution({
    input: { value: 1 },
    packageId,
    requestId: 'gateway-zero-capability',
  });
  assert.equal(zeroCapability.status, 'succeeded');
  assert.equal(zeroCapability.capabilityReceipt.status, 'not-requested');
  assert.equal(zeroCapability.capabilityDecision.status, 'allowed');
  assert.equal(executionCalls, 1);

  const granted = gateway.setGrant({ packageId, scopes: ['filesystem.read', 'screen.read'] });
  assert.equal(granted.ok, true);
  assert.deepEqual(granted.grant.scopes, ['filesystem.read', 'screen.read']);
  assert.match(granted.grant.artifactDigest, /^[a-f0-9]{64}$/u);
  assert.equal(gateway.decide({ packageId, permissionScopes: ['filesystem.read'] }).status, 'allowed');

  const capabilityBlocked = await gateway.runPackageExecution({
    input: { value: 1 },
    packageId,
    permissionScopes: ['filesystem.read'],
    requestId: 'gateway-authorized-but-disabled',
  });
  assert.equal(capabilityBlocked.status, 'rejected');
  assert.equal(capabilityBlocked.error, 'capability_execution_not_implemented');
  assert.equal(capabilityBlocked.capabilityReceipt.status, 'blocked');
  assert.equal(capabilityBlocked.capabilityReceipt.decision, 'allowed-but-disabled');
  assert.match(capabilityBlocked.capabilityReceipt.artifactDigest, /^[a-f0-9]{64}$/u);
  assert.equal(capabilityBlocked.capabilityDecision.artifactDigest, capabilityBlocked.capabilityReceipt.artifactDigest);
  assert.equal(executionCalls, 1);

  const persistedGateway = createExternalSkillCapabilityGateway({ artifactStore, supervisor, userDataPath: tempRoot });
  assert.equal(persistedGateway.listGrants().grants[0].packageId, packageId);
  assert.equal(persistedGateway.revokeGrant({ packageId }).revoked, true);
  const denied = await persistedGateway.runPackageExecution({
    input: { value: 1 },
    packageId,
    permissionScopes: ['filesystem.read'],
    requestId: 'gateway-revoked',
  });
  assert.equal(denied.status, 'rejected');
  assert.equal(denied.error, 'external_permission_not_granted');
  assert.equal(denied.capabilityReceipt.status, 'denied');
  assert.equal(executionCalls, 1);
  assert.equal(persistedGateway.setGrant({ packageId, scopes: ['unknown.scope'] }).error, 'permission_scope_unsupported');

  assert.equal(persistedGateway.setGrant({ packageId, scopes: ['storage.read'] }).ok, true);
  fs.writeFileSync(persistedGateway.getPaths().storagePath, JSON.stringify({
    kind: 'external-skill-capability-storage.v1',
    packages: {
      [packageId]: {
        'role.preference': { mood: 'calm', version: 1 },
      },
    },
  }), 'utf8');
  const storageRead = persistedGateway.readStorageValue({
    key: 'role.preference',
    packageId,
    permissionScopes: ['storage.read'],
    requestId: 'gateway-storage-read',
  });
  assert.equal(storageRead.status, 'succeeded');
  assert.deepEqual(storageRead.capabilityValue, { mood: 'calm', version: 1 });
  assert.equal(storageRead.capabilityReceipt.status, 'executed');
  assert.deepEqual(storageRead.capabilityReceipt.usedScopes, ['storage.read']);
  const wrongScope = persistedGateway.readStorageValue({
    key: 'role.preference',
    packageId,
    permissionScopes: ['filesystem.read'],
    requestId: 'gateway-storage-wrong-scope',
  });
  assert.equal(wrongScope.status, 'rejected');
  assert.equal(wrongScope.error, 'capability_scope_mismatch');

  const realSupervisor = createExternalSkillSandboxSupervisorService({ artifactStore });
  const realGateway = createExternalSkillCapabilityGateway({ artifactStore, supervisor: realSupervisor, userDataPath: tempRoot });
  const realExecution = await realGateway.runPackageExecution({
    input: { value: 41 },
    packageId,
    requestId: 'gateway-real-zero-capability',
  });
  assert.equal(realExecution.status, 'succeeded', JSON.stringify(realExecution));
  assert.deepEqual(realExecution.output, { value: 42 });
  assert.equal(realExecution.capabilityReceipt.status, 'not-requested');

  const updatedPackageValue = signPackage({
    ...packageValue,
    runtime: {
      ...packageValue.runtime,
      moduleBase64: Buffer.from('0061736d0100000001060160017f017f030201000707010372756e00000a09010700200041026a0b', 'hex').toString('base64'),
    },
    signature: undefined,
  }, privateKey);
  assert.equal(coordinator.stageSignedPackage({
    packageId,
    rawPackageJson: JSON.stringify(updatedPackageValue),
    trustedKeyRegistry,
  }).ok, true);
  const staleDecision = persistedGateway.decide({ packageId, permissionScopes: ['storage.read'] });
  assert.equal(staleDecision.status, 'denied');
  assert.ok(staleDecision.issueCodes.includes('permission_grant_stale'));

  const capabilityRequest = {
    capabilityRequestId: 'read-role-preference',
    key: 'role.preference',
    kind: 'external-skill-capability-request.v1',
    operation: 'get',
    scope: 'storage.read',
  };
  const capabilityWasm = createCapabilityRequestWasmBase64(capabilityRequest);
  const flowPackageId = 'character.animation@capability-flow';
  const flowPackage = signPackage({
    kind: 'agent-skill-package.v1',
    runtime: {
      capabilityEntrypoint: 'resume',
      entrypoint: 'run',
      kind: 'wasm-pure-json-v1',
      moduleBase64: capabilityWasm,
    },
    scaffold: { skill: { id: 'character.animation' } },
  }, privateKey);
  assert.equal(coordinator.stageSignedPackage({
    packageId: flowPackageId,
    rawPackageJson: JSON.stringify(flowPackage),
    trustedKeyRegistry,
  }).ok, true);
  assert.equal(realGateway.setGrant({ packageId: flowPackageId, scopes: ['storage.read'] }).ok, true);
  fs.writeFileSync(realGateway.getPaths().storagePath, JSON.stringify({
    kind: 'external-skill-capability-storage.v1',
    packages: {
      [flowPackageId]: { 'role.preference': { mood: 'focused', version: 2 } },
      [packageId]: { 'role.preference': { mood: 'calm', version: 1 } },
    },
  }), 'utf8');
  const capabilityFlow = await realGateway.runPackageExecution({
    input: { action: 'load-role-preference' },
    packageId: flowPackageId,
    requestId: 'gateway-capability-flow',
  });
  assert.equal(capabilityFlow.status, 'succeeded', JSON.stringify(capabilityFlow));
  assert.equal(capabilityFlow.capabilityFlow.status, 'completed');
  assert.equal(capabilityFlow.capabilityFlow.calls, 1);
  assert.equal(capabilityFlow.output.kind, 'external-skill-capability-response.v1');
  assert.deepEqual(capabilityFlow.output.response.value, { mood: 'focused', version: 2 });
  assert.deepEqual(capabilityFlow.capabilityReceipt.usedScopes, ['storage.read']);

  const quotaPackageId = 'character.animation@capability-quota';
  const quotaPackage = signPackage({
    kind: 'agent-skill-package.v1',
    runtime: {
      capabilityEntrypoint: 'run',
      entrypoint: 'run',
      kind: 'wasm-pure-json-v1',
      moduleBase64: capabilityWasm,
    },
    scaffold: { skill: { id: 'character.animation' } },
  }, privateKey);
  assert.equal(coordinator.stageSignedPackage({
    packageId: quotaPackageId,
    rawPackageJson: JSON.stringify(quotaPackage),
    trustedKeyRegistry,
  }).ok, true);
  assert.equal(realGateway.setGrant({ packageId: quotaPackageId, scopes: ['storage.read'] }).ok, true);
  const storageRegistry = JSON.parse(fs.readFileSync(realGateway.getPaths().storagePath, 'utf8'));
  storageRegistry.packages[quotaPackageId] = { 'role.preference': { mood: 'quota-test' } };
  fs.writeFileSync(realGateway.getPaths().storagePath, JSON.stringify(storageRegistry), 'utf8');
  const quotaExceeded = await realGateway.runPackageExecution({
    input: { action: 'request-twice' },
    packageId: quotaPackageId,
    requestId: 'gateway-capability-quota',
  });
  assert.equal(quotaExceeded.status, 'rejected');
  assert.equal(quotaExceeded.error, 'capability_call_quota_exceeded');
  assert.equal(quotaExceeded.capabilityFlow.status, 'quota-exceeded');

  const recoveryPackageId = 'character.animation@capability-recovery';
  const recoveryPackage = signPackage({
    kind: 'agent-skill-package.v1',
    runtime: {
      capabilityEntrypoint: 'resume',
      entrypoint: 'run',
      kind: 'wasm-pure-json-v1',
      moduleBase64: capabilityWasm,
    },
    scaffold: { skill: { id: 'character.animation' } },
  }, privateKey);
  assert.equal(coordinator.stageSignedPackage({
    packageId: recoveryPackageId,
    rawPackageJson: JSON.stringify(recoveryPackage),
    trustedKeyRegistry,
  }).ok, true);
  const recovered = await realGateway.runPackageExecution({
    input: { action: 'recover-from-denial' },
    packageId: recoveryPackageId,
    requestId: 'gateway-capability-recovery',
  });
  assert.equal(recovered.status, 'succeeded', JSON.stringify(recovered));
  assert.equal(recovered.capabilityFlow.status, 'recovered-with-capability-error');
  assert.equal(recovered.output.response.status, 'failed');
  assert.equal(recovered.output.response.error, 'external_permission_not_granted');

  const failingWasm = Buffer.from(
    '0061736d0100000001070160027f7f017e03020100050401010101071002066d656d6f727902000372756e00000a10010e0041f0a204ad4220862001ad840b',
    'hex',
  ).toString('base64');
  const failingPackageId = 'character.animation@health-real-worker';
  const failingPackage = signPackage({
    kind: 'agent-skill-package.v1',
    runtime: { entrypoint: 'run', kind: 'wasm-pure-json-v1', moduleBase64: failingWasm },
    scaffold: { skill: { id: 'character.animation' } },
  }, privateKey);
  assert.equal(coordinator.stageSignedPackage({
    packageId: failingPackageId,
    rawPackageJson: JSON.stringify(failingPackage),
    trustedKeyRegistry,
  }).ok, true);
  let healthNow = Date.parse('2026-07-26T14:00:00.000Z');
  const healthGateway = createExternalSkillCapabilityGateway({
    artifactStore,
    now: () => healthNow,
    supervisor: realSupervisor,
    userDataPath: tempRoot,
  });
  const healthFailure1 = await healthGateway.runPackageExecution({
    input: { action: 'bounds-check' },
    packageId: failingPackageId,
    requestId: 'gateway-health-real-1',
  });
  assert.equal(healthFailure1.error, 'wasm_json_output_bounds_invalid');
  assert.equal(healthFailure1.packageHealth.consecutiveFailures, 1);
  healthNow += 1001;
  const healthFailure2 = await healthGateway.runPackageExecution({
    input: { action: 'bounds-check' },
    packageId: failingPackageId,
    requestId: 'gateway-health-real-2',
  });
  assert.equal(healthFailure2.packageHealth.consecutiveFailures, 2);
  healthNow += 2001;
  const healthFailure3 = await healthGateway.runPackageExecution({
    input: { action: 'bounds-check' },
    packageId: failingPackageId,
    requestId: 'gateway-health-real-3',
  });
  assert.equal(healthFailure3.packageHealth.quarantineApplied, true);
  assert.equal(artifactStore.getPackage(failingPackageId).package.status, 'quarantined');
  const healthQuarantined = await healthGateway.runPackageExecution({
    input: { action: 'bounds-check' },
    packageId: failingPackageId,
    requestId: 'gateway-health-real-quarantined',
  });
  assert.equal(healthQuarantined.error, 'package_artifact_quarantined');
  realSupervisor.dispose();

  fs.rmSync(tempRoot, { force: true, recursive: true });
}

run().then(() => console.log('agent skill capability gateway smoke passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
