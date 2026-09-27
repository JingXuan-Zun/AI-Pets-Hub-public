const VALUE_ARGUMENTS = new Map([
  ['--desktop-pet-skill-packaged-admission-report', 'DESKTOP_PET_SKILL_PACKAGED_ADMISSION_REPORT'],
  ['--desktop-pet-skill-packaged-admission-user-data-dir', 'DESKTOP_PET_SKILL_PACKAGED_ADMISSION_USER_DATA_DIR'],
]);

const FLAG_ARGUMENTS = new Map([
  ['--desktop-pet-skill-packaged-admission-enable', 'DESKTOP_PET_SKILL_PACKAGED_ADMISSION_ENABLE'],
  ['--desktop-pet-skill-packaged-admission-headless', 'DESKTOP_PET_SKILL_PACKAGED_ADMISSION_HEADLESS'],
]);

function applyExternalSkillPackagedDiagnosticArgs(env = process.env, argv = process.argv) {
  const applied = [];
  for (const rawArgument of argv) {
    const argument = String(rawArgument || '');
    const flagEnvironmentKey = FLAG_ARGUMENTS.get(argument);
    if (flagEnvironmentKey) {
      env[flagEnvironmentKey] = '1';
      applied.push(flagEnvironmentKey);
      continue;
    }

    for (const [name, environmentKey] of VALUE_ARGUMENTS) {
      const prefix = `${name}=`;
      if (!argument.startsWith(prefix)) continue;
      const value = argument.slice(prefix.length).trim();
      if (value) {
        env[environmentKey] = value;
        applied.push(environmentKey);
      }
      break;
    }
  }

  return { applied: [...new Set(applied)] };
}

module.exports = { applyExternalSkillPackagedDiagnosticArgs };
