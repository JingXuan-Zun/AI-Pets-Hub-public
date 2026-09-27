const VALUE_ARGUMENTS = new Map([
  ['--desktop-pet-marketplace-production-probe-report', 'DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_REPORT'],
  ['--desktop-pet-marketplace-production-probe-user-data-dir', 'DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_USER_DATA_DIR'],
]);

const FLAG_ARGUMENTS = new Map([
  ['--desktop-pet-marketplace-production-probe-enable', 'DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_ENABLE'],
  ['--desktop-pet-marketplace-production-probe-headless', 'DESKTOP_PET_MARKETPLACE_PRODUCTION_PROBE_HEADLESS'],
]);

function applyExternalSkillMarketplaceProductionProbeArgs(env = process.env, argv = process.argv) {
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

module.exports = { applyExternalSkillMarketplaceProductionProbeArgs };
