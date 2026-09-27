const assert = require('assert').strict;
const {
  applyExternalSkillPackagedDiagnosticArgs,
} = require('../electron/externalSkillPackagedDiagnosticArgs.cjs');

const env = {};
const result = applyExternalSkillPackagedDiagnosticArgs(env, [
  'AI Desktop Pet.exe',
  '--desktop-pet-skill-packaged-admission-enable',
  '--desktop-pet-skill-packaged-admission-headless',
  '--desktop-pet-skill-packaged-admission-report=D:\\Probe Output\\admission.json',
  '--desktop-pet-skill-packaged-admission-user-data-dir=D:\\Probe Profile',
]);

assert.equal(env.DESKTOP_PET_SKILL_PACKAGED_ADMISSION_ENABLE, '1');
assert.equal(env.DESKTOP_PET_SKILL_PACKAGED_ADMISSION_HEADLESS, '1');
assert.equal(env.DESKTOP_PET_SKILL_PACKAGED_ADMISSION_REPORT, 'D:\\Probe Output\\admission.json');
assert.equal(env.DESKTOP_PET_SKILL_PACKAGED_ADMISSION_USER_DATA_DIR, 'D:\\Probe Profile');
assert.equal(result.applied.length, 4);
assert.deepEqual(applyExternalSkillPackagedDiagnosticArgs({}, ['app.exe']), { applied: [] });

console.log('agent skill packaged diagnostic args smoke passed');
