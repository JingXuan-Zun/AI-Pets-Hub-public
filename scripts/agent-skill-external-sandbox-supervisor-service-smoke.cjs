const assert = require('assert').strict;
const {
  createExternalSkillSandboxSupervisorService,
  createSandboxEnvironment,
} = require('../electron/externalSkillSandboxSupervisorService.cjs');

async function run() {
  const environment = createSandboxEnvironment({ API_KEY: 'must-not-leak', PATH: 'safe-path', SystemRoot: 'C:\\Windows' });
  assert.deepEqual(environment, { PATH: 'safe-path', SystemRoot: 'C:\\Windows' });

  const service = createExternalSkillSandboxSupervisorService();
  const succeeded = await service.runBootstrapProbe({
    bootstrapPlanId: 'dance:package:probe',
    packageId: 'package:verified',
    requestId: 'supervisor-success',
  });
  assert.equal(succeeded.status, 'succeeded');
  assert.equal(succeeded.packageCodeLoaded, false);
  assert.equal(succeeded.permissionRequests, 0);
  assert.equal(succeeded.workerReceipt.packageCodeLoaded, false);

  const permissionRejected = await service.runBootstrapProbe({
    bootstrapPlanId: 'dance:package:permission',
    packageId: 'package:verified',
    permissionScopes: ['filesystem.read'],
    requestId: 'supervisor-permission',
  });
  assert.equal(permissionRejected.status, 'rejected');
  assert.equal(permissionRejected.error, 'external_permission_not_granted');
  assert.deepEqual(permissionRejected.requestedPermissionScopes, ['filesystem.read']);

  const timedOut = await service.runBootstrapProbe({
    bootstrapPlanId: 'dance:package:timeout',
    packageId: 'package:verified',
    requestId: 'supervisor-timeout',
    testDelayMs: 1000,
    timeoutMs: 500,
  });
  assert.equal(timedOut.status, 'timed-out');

  const pending = service.runBootstrapProbe({
    bootstrapPlanId: 'dance:package:cancel',
    packageId: 'package:verified',
    requestId: 'supervisor-cancel',
    testDelayMs: 1000,
  });
  assert.deepEqual(service.cancelProbe('supervisor-cancel'), { cancelled: true, requestId: 'supervisor-cancel' });
  assert.equal((await pending).status, 'cancelled');
  assert.throws(() => service.runBootstrapProbe({ packageId: '../unsafe', requestId: 'invalid', bootstrapPlanId: 'safe' }), /invalid_package_id/u);
  service.dispose();
}

run().then(() => console.log('agent skill external sandbox supervisor service smoke passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
