const assert = require('assert').strict;
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createExternalSkillCapabilityGateway } = require('../electron/externalSkillCapabilityGateway.cjs');
const { runExternalSkillPackagedAdmissionProbe } = require('../electron/externalSkillPackagedAdmissionProbe.cjs');
const { createSkillPackageArtifactStore } = require('../electron/skillPackageArtifactStore.cjs');
const { createSkillPackageSignedInstallCoordinator } = require('../electron/skillPackageSignedInstallCoordinator.cjs');

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-packaged-admission-probe-'));
const outputPath = path.join(tempRoot, 'report.json');
const artifactStore = createSkillPackageArtifactStore({ userDataPath: tempRoot });
const coordinator = createSkillPackageSignedInstallCoordinator({ artifactStore, userDataPath: tempRoot });
const gateway = createExternalSkillCapabilityGateway({
  artifactStore,
  hostContext: {
    arch: 'x64',
    electronVersion: '37.10.3',
    nodeVersion: process.versions.node,
    packaged: true,
    platform: 'win32',
  },
  supervisor: { cancelProbe: () => ({ cancelled: false }) },
  userDataPath: tempRoot,
});

async function run() {
  try {
    const report = await runExternalSkillPackagedAdmissionProbe({
      app: {
        getPath: (name) => name === 'userData' ? tempRoot : '',
        getVersion: () => '0.0.1-test',
        isPackaged: true,
      },
      capabilityGateway: gateway,
      env: {
        DESKTOP_PET_SKILL_PACKAGED_ADMISSION_REPORT: outputPath,
        DESKTOP_PET_SKILL_PACKAGED_ADMISSION_USER_DATA_DIR: tempRoot,
      },
      signedInstallCoordinator: coordinator,
    });
    assert.equal(report.ok, true, JSON.stringify(report));
    assert.equal(report.summary.failed, 0);
    assert.equal(report.admission.host.packaged, true);
    assert.equal(report.admission.rows[0].controlledRuntimeStatus, 'controlled-runtime-eligible');
    assert.equal(report.admission.rows[0].marketReleaseAllowed, false);
    assert.equal(report.marketReleaseEnabled, false);
    assert.equal(report.staging.signatureStatus, 'verified');
    assert.equal(fs.existsSync(outputPath), true);
    assert.equal(fs.readFileSync(outputPath, 'utf8').includes(tempRoot), false);

    const blockedOutputPath = path.join(tempRoot, 'blocked-report.json');
    const blockedStore = createSkillPackageArtifactStore({ userDataPath: path.join(tempRoot, 'default-profile') });
    const blockedCoordinator = createSkillPackageSignedInstallCoordinator({
      artifactStore: blockedStore,
      userDataPath: path.join(tempRoot, 'default-profile'),
    });
    const blockedGateway = createExternalSkillCapabilityGateway({
      artifactStore: blockedStore,
      hostContext: { packaged: true, platform: 'win32' },
      supervisor: { cancelProbe: () => ({ cancelled: false }) },
      userDataPath: path.join(tempRoot, 'default-profile'),
    });
    const blockedReport = await runExternalSkillPackagedAdmissionProbe({
      app: {
        getPath: () => path.join(tempRoot, 'default-profile'),
        getVersion: () => '0.0.1-test',
        isPackaged: true,
      },
      capabilityGateway: blockedGateway,
      env: {
        DESKTOP_PET_SKILL_PACKAGED_ADMISSION_REPORT: blockedOutputPath,
        DESKTOP_PET_SKILL_PACKAGED_ADMISSION_USER_DATA_DIR: path.join(tempRoot, 'different-profile'),
      },
      signedInstallCoordinator: blockedCoordinator,
    });
    assert.equal(blockedReport.ok, false);
    assert.equal(blockedReport.checks.find((item) => item.id === 'isolated-user-data').status, 'fail');
    assert.equal(blockedStore.listPackages().totalCount, 0);

    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'electron', 'main.cjs'), 'utf8');
    assert.match(mainSource, /shouldRunPackagedExternalSkillAdmissionProbe/u);
    assert.match(mainSource, /runExternalSkillPackagedAdmissionProbe/u);
    assert.match(mainSource, /app\.exit\(report\.ok \? 0 : 1\)/u);
  } finally {
    fs.rmSync(tempRoot, { force: true, recursive: true });
  }
}

run().then(() => console.log('agent skill packaged admission probe smoke passed')).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
