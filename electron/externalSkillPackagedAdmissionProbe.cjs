const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPORT_KIND = 'external-skill-packaged-admission-probe-report.v1';
const PACKAGE_ID = 'diagnostic.release-admission@packaged-probe';
const KEY_ID = 'diagnostic-packaged-admission-key';
const ADD_ONE_WASM = Buffer.from(
  '0061736d0100000001060160017f017f030201000707010372756e00000a09010700200041016a0b',
  'hex',
).toString('base64');

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeJsonValue(value) {
  if (Array.isArray(value)) return value.map(normalizeJsonValue);
  if (!isRecord(value)) return value;
  return Object.keys(value).filter((key) => value[key] !== undefined).sort((a, b) => a.localeCompare(b))
    .reduce((result, key) => ({ ...result, [key]: normalizeJsonValue(value[key]) }), {});
}

function createSignedDiagnosticPackage(privateKey) {
  const packageValue = {
    kind: 'agent-skill-package.v1',
    runtime: {
      entrypoint: 'run',
      kind: 'wasm-pure-i32-v1',
      moduleBase64: ADD_ONE_WASM,
    },
    scaffold: { skill: { id: 'diagnostic.release-admission' } },
  };
  const payload = JSON.stringify(normalizeJsonValue({
    kind: 'agent-skill-package-signature-payload.v1',
    package: packageValue,
  }));
  return {
    ...packageValue,
    signature: {
      algorithm: 'ed25519',
      digest: 'sha256:canonical-v1',
      keyId: KEY_ID,
      signature: crypto.sign(null, Buffer.from(payload), privateKey).toString('base64'),
    },
  };
}

function createCheck(id, passed, detail) {
  return { detail, id, status: passed ? 'pass' : 'fail' };
}

function redactError(error) {
  return String(error instanceof Error ? error.message : error || 'unknown_error')
    .replace(/[A-Za-z]:\\[^\s]+/gu, '<redacted-path>')
    .slice(0, 400);
}

function writeReport(outputPath, report) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

function isExternalSkillPackagedAdmissionProbeEnabled(env = process.env) {
  return env.DESKTOP_PET_SKILL_PACKAGED_ADMISSION_ENABLE === '1';
}

async function runExternalSkillPackagedAdmissionProbe(options = {}) {
  const env = options.env || process.env;
  const outputValue = typeof env.DESKTOP_PET_SKILL_PACKAGED_ADMISSION_REPORT === 'string'
    ? env.DESKTOP_PET_SKILL_PACKAGED_ADMISSION_REPORT.trim()
    : '';
  if (!outputValue) throw new Error('external_skill_packaged_admission_report_path_missing');
  const outputPath = path.resolve(outputValue);
  const generatedAt = new Date().toISOString();
  const checks = [];
  let admission = null;
  let healthDiagnostics = null;
  let staging = null;

  try {
    const appIsPackaged = Boolean(options.app?.isPackaged);
    const configuredProfile = typeof env.DESKTOP_PET_SKILL_PACKAGED_ADMISSION_USER_DATA_DIR === 'string'
      ? env.DESKTOP_PET_SKILL_PACKAGED_ADMISSION_USER_DATA_DIR.trim()
      : '';
    const activeProfile = options.app?.getPath?.('userData') || '';
    const isolatedProfile = Boolean(configuredProfile)
      && path.resolve(configuredProfile) === path.resolve(activeProfile);
    checks.push(createCheck('packaged-runtime', appIsPackaged, appIsPackaged
      ? 'Probe is running in an Electron packaged process.'
      : 'Probe is not running in an Electron packaged process.'));
    checks.push(createCheck('isolated-user-data', isolatedProfile, isolatedProfile
      ? 'Probe is using the explicitly configured isolated userData directory.'
      : 'Probe userData does not match the explicit diagnostic profile.'));
    if (!appIsPackaged || !isolatedProfile) {
      throw new Error('packaged_admission_probe_runtime_isolation_required');
    }

    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const rawPackageJson = JSON.stringify(createSignedDiagnosticPackage(privateKey));
    staging = options.signedInstallCoordinator.stageSignedPackage({
      packageId: PACKAGE_ID,
      rawPackageJson,
      trustedKeyRegistry: {
        keys: [{
          algorithm: 'ed25519',
          keyId: KEY_ID,
          publicKey: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
        }],
        kind: 'agent-skill-trusted-signature-key-registry.v1',
      },
    });
    const signatureVerified = staging?.ok === true
      && staging.package?.signatureVerification?.status === 'verified'
      && staging.package?.signatureVerification?.verifier === 'main-process-ed25519';
    checks.push(createCheck('main-process-signature-staging', signatureVerified, signatureVerified
      ? 'Diagnostic package was staged with main-process Ed25519 evidence.'
      : staging?.error || 'Diagnostic package staging did not produce trusted evidence.'));

    admission = options.capabilityGateway.createReleaseAdmissionReport({ packageIds: [PACKAGE_ID] });
    const row = admission?.rows?.[0] || null;
    const controlledEligible = admission?.ok === true
      && admission.host?.packaged === true
      && row?.controlledRuntimeStatus === 'controlled-runtime-eligible';
    checks.push(createCheck('controlled-runtime-admission', controlledEligible, controlledEligible
      ? 'Packaged static admission marked the controlled WASM runtime eligible.'
      : 'Packaged static admission did not reach controlled-runtime-eligible.'));
    const marketDisabled = admission?.marketReleaseEnabled === false
      && row?.marketReleaseAllowed === false
      && row?.marketReleaseStatus === 'disabled'
      && row?.marketReleaseIssueCodes?.includes('marketplace-release-disabled');
    checks.push(createCheck('market-release-disabled', marketDisabled, marketDisabled
      ? 'Market release remains explicitly disabled.'
      : 'Market release disablement evidence is incomplete.'));

    const admissionExport = options.capabilityGateway.exportReleaseAdmissionReport({ packageIds: [PACKAGE_ID] });
    const exportedAdmission = admissionExport?.ok ? JSON.parse(admissionExport.text) : null;
    const admissionExportValid = exportedAdmission?.rows?.[0]?.packageId === PACKAGE_ID;
    checks.push(createCheck('admission-json-export', admissionExportValid, admissionExportValid
      ? 'Admission JSON export parsed successfully.'
      : admissionExport?.error || 'Admission JSON export was invalid.'));

    const healthExport = options.capabilityGateway.exportPackageHealthDiagnostics({ packageId: PACKAGE_ID });
    healthDiagnostics = healthExport?.ok ? JSON.parse(healthExport.text) : null;
    const internalPaths = Object.values(options.capabilityGateway.getPaths?.() || {})
      .filter((value) => typeof value === 'string' && value);
    const healthText = healthExport?.text || '';
    const healthExportValid = healthDiagnostics?.kind === 'external-skill-package-health-diagnostics.v1'
      && internalPaths.every((internalPath) => !healthText.includes(internalPath));
    checks.push(createCheck('health-diagnostics-json-export', healthExportValid, healthExportValid
      ? 'Health diagnostics JSON parsed without exposing internal state paths.'
      : healthExport?.error || 'Health diagnostics export was invalid or exposed an internal path.'));
  } catch (error) {
    checks.push(createCheck('probe-execution', false, redactError(error)));
  }

  const report = {
    admission,
    checks,
    generatedAt,
    healthDiagnostics,
    kind: REPORT_KIND,
    marketReleaseEnabled: false,
    ok: checks.length >= 7 && checks.every((check) => check.status === 'pass'),
    packageId: PACKAGE_ID,
    runtime: {
      appIsPackaged: Boolean(options.app?.isPackaged),
      arch: process.arch,
      electronVersion: process.versions.electron ?? null,
      platform: process.platform,
      version: options.app?.getVersion?.() ?? null,
    },
    staging: staging?.ok ? {
      artifactDigest: staging.package?.artifactDigest ?? null,
      signatureStatus: staging.package?.signatureVerification?.status ?? null,
      verifier: staging.package?.signatureVerification?.verifier ?? null,
    } : { error: staging?.error || 'staging_not_completed' },
    summary: {
      failed: checks.filter((check) => check.status === 'fail').length,
      passed: checks.filter((check) => check.status === 'pass').length,
      total: checks.length,
    },
    version: 1,
  };
  writeReport(outputPath, report);
  return report;
}

module.exports = {
  isExternalSkillPackagedAdmissionProbeEnabled,
  runExternalSkillPackagedAdmissionProbe,
};
