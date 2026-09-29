const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createExternalSkillCapabilityGateway } = require('../electron/externalSkillCapabilityGateway.cjs');

const packageId = 'character.animation@flow-control';
const capabilityRequest = {
  capabilityRequestId: 'flow-control-read',
  key: 'role.preference',
  kind: 'external-skill-capability-request.v1',
  operation: 'get',
  scope: 'storage.read',
};

function createArtifactStore() {
  return {
    readPackageArtifact: () => ({
      artifact: { artifactDigest: 'a'.repeat(64) },
      ok: true,
      rawPackageJson: JSON.stringify({
        runtime: { capabilityEntrypoint: 'resume', kind: 'wasm-pure-json-v1' },
        scaffold: { skill: { id: 'character.animation' } },
      }),
    }),
  };
}

function prepareGateway(gateway) {
  assert.equal(gateway.setGrant({ packageId, scopes: ['storage.read'] }).ok, true);
  fs.writeFileSync(gateway.getPaths().storagePath, JSON.stringify({
    kind: 'external-skill-capability-storage.v1',
    packages: { [packageId]: { 'role.preference': { mood: 'bounded' } } },
  }), 'utf8');
}

async function run() {
  const timeoutRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-capability-timeout-'));
  let timeoutExecutionCalls = 0;
  const timeoutSupervisor = {
    cancelProbe: () => ({ cancelled: false }),
    runPackageExecution: async (request) => {
      timeoutExecutionCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 650));
      return { output: capabilityRequest, packageCodeLoaded: true, requestId: request.requestId, status: 'succeeded' };
    },
  };
  const timeoutGateway = createExternalSkillCapabilityGateway({
    artifactStore: createArtifactStore(),
    supervisor: timeoutSupervisor,
    userDataPath: timeoutRoot,
  });
  prepareGateway(timeoutGateway);
  const timedOut = await timeoutGateway.runPackageExecution({
    input: { action: 'timeout-check' },
    packageId,
    requestId: 'capability-flow-timeout',
    timeoutMs: 1000,
  });
  assert.equal(timedOut.status, 'timed-out');
  assert.equal(timedOut.error, 'capability_flow_timed_out');
  assert.equal(timedOut.capabilityFlow.calls, 1);
  assert.equal(timeoutExecutionCalls, 1);
  fs.rmSync(timeoutRoot, { force: true, recursive: true });

  const cancelRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-capability-cancel-'));
  let resumeRequestId = '';
  let resolveResume;
  let markResumeStarted;
  const resumeStarted = new Promise((resolve) => { markResumeStarted = resolve; });
  const cancelSupervisor = {
    cancelProbe: (requestId) => {
      if (requestId === resumeRequestId && resolveResume) {
        resolveResume({ packageCodeLoaded: true, requestId, status: 'cancelled' });
        return { cancelled: true, requestId };
      }
      return { cancelled: false, requestId };
    },
    runPackageExecution: async (request) => {
      if (request.executionPhase === 'primary') {
        return { output: capabilityRequest, packageCodeLoaded: true, requestId: request.requestId, status: 'succeeded' };
      }
      resumeRequestId = request.requestId;
      markResumeStarted();
      return new Promise((resolve) => { resolveResume = resolve; });
    },
  };
  const cancelGateway = createExternalSkillCapabilityGateway({
    artifactStore: createArtifactStore(),
    supervisor: cancelSupervisor,
    userDataPath: cancelRoot,
  });
  prepareGateway(cancelGateway);
  const pending = cancelGateway.runPackageExecution({
    input: { action: 'cancel-check' },
    packageId,
    requestId: 'capability-flow-cancel',
  });
  await resumeStarted;
  const cancelled = cancelGateway.cancelExecution('capability-flow-cancel');
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.workerRequestId, resumeRequestId);
  const cancelledResult = await pending;
  assert.equal(cancelledResult.status, 'cancelled');
  assert.equal(cancelledResult.capabilityFlow.status, 'resume-cancelled');
  fs.rmSync(cancelRoot, { force: true, recursive: true });
}

run().then(() => console.log('agent skill capability flow control smoke passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
