const assert = require('assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createExternalSkillSandboxSupervisorService } = require('../electron/externalSkillSandboxSupervisorService.cjs');
const { createSkillPackageArtifactStore } = require('../electron/skillPackageArtifactStore.cjs');
const { createSkillPackageSignedInstallCoordinator } = require('../electron/skillPackageSignedInstallCoordinator.cjs');

function normalizeJsonValue(value) {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).filter((key) => value[key] !== undefined).sort((a, b) => a.localeCompare(b))
    .reduce((result, key) => ({ ...result, [key]: normalizeJsonValue(value[key]) }), {});
}

function signPackage(packageValue, privateKey) {
  const unsigned = JSON.parse(JSON.stringify(packageValue));
  delete unsigned.signature;
  const payload = JSON.stringify(normalizeJsonValue({
    kind: 'agent-skill-package-signature-payload.v1',
    package: unsigned,
  }));
  return {
    ...packageValue,
    signature: {
      algorithm: 'ed25519',
      digest: 'sha256:canonical-v1',
      keyId: 'wasm-market-test-key',
      signature: crypto.sign(null, Buffer.from(payload), privateKey).toString('base64'),
    },
  };
}

// (i32) -> i32, returns input + 1.
const addOneWasm = Buffer.from(
  '0061736d0100000001060160017f017f030201000707010372756e00000a09010700200041016a0b',
  'hex',
).toString('base64');

// Exports one 64 KiB memory and returns the input JSON byte range unchanged.
const echoJsonWasm = Buffer.from(
  '0061736d0100000001070160027f7f017e03020100050401010101071002066d656d6f727902000372756e00000a0e010c002000ad4220862001ad840b',
  'hex',
).toString('base64');

// Returns output offset 70000, outside the exported 64 KiB memory.
const outOfBoundsJsonWasm = Buffer.from(
  '0061736d0100000001070160027f7f017e03020100050401010101071002066d656d6f727902000372756e00000a10010e0041f0a204ad4220862001ad840b',
  'hex',
).toString('base64');

async function run() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-external-wasm-'));
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
  const artifactStore = createSkillPackageArtifactStore({ userDataPath: tempRoot });
  const coordinator = createSkillPackageSignedInstallCoordinator({ artifactStore, userDataPath: tempRoot });
  const packageId = 'character.animation@wasm-add-one';
  const packageValue = signPackage({
    kind: 'agent-skill-package.v1',
    runtime: { entrypoint: 'run', kind: 'wasm-pure-i32-v1', moduleBase64: addOneWasm },
    scaffold: { skill: { id: 'character.animation' } },
  }, privateKey);
  const trustedKeyRegistry = {
    keys: [{
      algorithm: 'ed25519',
      keyId: 'wasm-market-test-key',
      publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
    }],
    kind: 'agent-skill-trusted-signature-key-registry.v1',
  };
  const service = createExternalSkillSandboxSupervisorService({ artifactStore });

  try {
    const staged = coordinator.stageSignedPackage({
      packageId,
      rawPackageJson: JSON.stringify(packageValue),
      trustedKeyRegistry,
    });
    assert.equal(staged.ok, true);

    const executed = await service.runPackageExecution({
      input: { value: 41 },
      packageId,
      requestId: 'wasm-add-one-success',
    });
    assert.equal(executed.status, 'succeeded', JSON.stringify(executed));
    assert.equal(executed.packageCodeLoaded, true);
    assert.equal(executed.executionKind, 'wasm-pure-i32-v1');
    assert.deepEqual(executed.output, { value: 42 });
    assert.deepEqual(executed.capabilityScopes, []);

    const jsonPackageId = 'character.animation@wasm-json-echo';
    const jsonPackage = signPackage({
      kind: 'agent-skill-package.v1',
      runtime: { entrypoint: 'run', kind: 'wasm-pure-json-v1', moduleBase64: echoJsonWasm },
      scaffold: { skill: { id: 'character.animation' } },
    }, privateKey);
    assert.equal(coordinator.stageSignedPackage({
      packageId: jsonPackageId,
      rawPackageJson: JSON.stringify(jsonPackage),
      trustedKeyRegistry,
    }).ok, true);
    const jsonInput = {
      action: 'wave',
      parameters: { strength: 0.75 },
      tags: ['friendly', 'short'],
    };
    const jsonExecuted = await service.runPackageExecution({
      input: jsonInput,
      packageId: jsonPackageId,
      requestId: 'wasm-json-echo-success',
    });
    assert.equal(jsonExecuted.status, 'succeeded', JSON.stringify(jsonExecuted));
    assert.equal(jsonExecuted.executionKind, 'wasm-pure-json-v1');
    assert.deepEqual(jsonExecuted.output, jsonInput);
    assert.deepEqual(jsonExecuted.capabilityScopes, []);

    const oversizedInput = await service.runPackageExecution({
      input: { payload: 'x'.repeat(32 * 1024) },
      packageId: jsonPackageId,
      requestId: 'wasm-json-input-too-large',
    });
    assert.equal(oversizedInput.status, 'rejected');
    assert.equal(oversizedInput.error, 'external_wasm_json_input_size_invalid');
    assert.equal(oversizedInput.packageCodeLoaded, false);

    const boundsPackageId = 'character.animation@wasm-json-bounds';
    const boundsPackage = signPackage({
      kind: 'agent-skill-package.v1',
      runtime: { entrypoint: 'run', kind: 'wasm-pure-json-v1', moduleBase64: outOfBoundsJsonWasm },
      scaffold: { skill: { id: 'character.animation' } },
    }, privateKey);
    assert.equal(coordinator.stageSignedPackage({
      packageId: boundsPackageId,
      rawPackageJson: JSON.stringify(boundsPackage),
      trustedKeyRegistry,
    }).ok, true);
    const boundsRejected = await service.runPackageExecution({
      input: { action: 'bounds-check' },
      packageId: boundsPackageId,
      requestId: 'wasm-json-output-bounds',
    });
    assert.equal(boundsRejected.status, 'failed');
    assert.equal(boundsRejected.error, 'wasm_json_output_bounds_invalid');
    assert.equal(boundsRejected.packageCodeLoaded, true);

    const missingMemoryPackageId = 'character.animation@wasm-json-no-memory';
    const missingMemoryPackage = signPackage({
      kind: 'agent-skill-package.v1',
      runtime: { entrypoint: 'run', kind: 'wasm-pure-json-v1', moduleBase64: addOneWasm },
      scaffold: { skill: { id: 'character.animation' } },
    }, privateKey);
    assert.equal(coordinator.stageSignedPackage({
      packageId: missingMemoryPackageId,
      rawPackageJson: JSON.stringify(missingMemoryPackage),
      trustedKeyRegistry,
    }).ok, true);
    const missingMemoryRejected = await service.runPackageExecution({
      input: { action: 'memory-check' },
      packageId: missingMemoryPackageId,
      requestId: 'wasm-json-memory-missing',
    });
    assert.equal(missingMemoryRejected.status, 'failed');
    assert.equal(missingMemoryRejected.error, 'wasm_memory_export_missing');
    assert.equal(missingMemoryRejected.packageCodeLoaded, true);

    const deepInput = { value: {} };
    let deepCursor = deepInput.value;
    for (let index = 0; index < 17; index += 1) {
      deepCursor.value = {};
      deepCursor = deepCursor.value;
    }
    const deepInputRejected = await service.runPackageExecution({
      input: deepInput,
      packageId: jsonPackageId,
      requestId: 'wasm-json-input-too-deep',
    });
    assert.equal(deepInputRejected.status, 'rejected');
    assert.equal(deepInputRejected.error, 'external_wasm_json_input_size_invalid');
    assert.equal(deepInputRejected.packageCodeLoaded, false);

    const permissionRejected = await service.runPackageExecution({
      input: { value: 1 },
      packageId,
      permissionScopes: ['filesystem.read'],
      requestId: 'wasm-permission-rejected',
    });
    assert.equal(permissionRejected.status, 'rejected');
    assert.equal(permissionRejected.error, 'external_permission_not_granted');
    assert.equal(permissionRejected.packageCodeLoaded, false);

    artifactStore.quarantinePackage(packageId, 'smoke-quarantine');
    const quarantined = await service.runPackageExecution({
      input: { value: 1 },
      packageId,
      requestId: 'wasm-quarantined',
    });
    assert.equal(quarantined.status, 'rejected');
    assert.equal(quarantined.error, 'package_artifact_quarantined');
  } finally {
    service.dispose();
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
}

run().then(() => console.log('agent skill external WASM execution smoke passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
