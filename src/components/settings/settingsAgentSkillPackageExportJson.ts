import { createAgentSkillPackageExport } from '../../agent/agentSkillPackageExchange';

export function formatSettingsAgentSkillPackageExportJson(skillId: string) {
  const packageExport = createAgentSkillPackageExport(skillId, 'preview');
  return packageExport ? JSON.stringify(packageExport, null, 2) : '';
}
