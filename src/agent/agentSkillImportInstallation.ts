import { addAgentExternalSkillToLibrary, MAX_AGENT_EXTERNAL_SKILLS, parseAgentExternalSkillLibraryJson, serializeAgentExternalSkillLibrary } from './agentExternalSkillLibrary';
import type { AgentSkillArchiveImportResult } from './agentSkillArchiveImport';

export function installAgentImportedSkills(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, petId: string, preview: AgentSkillArchiveImportResult) {
  const libraryKey = 'desktop-pet.agent-external-skills.v1';
  const bindingsKey = 'desktop-pet.agent-skill-bindings.v1';
  const oldLibrary = storage.getItem(libraryKey);
  const oldBindings = storage.getItem(bindingsKey);
  let library = parseAgentExternalSkillLibraryJson(oldLibrary);
  const bindings = JSON.parse(oldBindings || '{}') as Record<string, string[]>;
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) throw new Error('技能启用配置异常，未安装。');
  const existingIds = new Set(library.skills.map((skill) => skill.id));
  const newIds = preview.skills.filter((skill) => !existingIds.has(skill.id));
  if (existingIds.size + newIds.length > MAX_AGENT_EXTERNAL_SKILLS) throw new Error(`最多安装 ${MAX_AGENT_EXTERNAL_SKILLS} 个外部技能，请先卸载不用的技能。`);
  for (const skill of preview.skills) library = addAgentExternalSkillToLibrary(library, skill);
  const enabled = Array.isArray(bindings[petId]) ? bindings[petId] : [];
  const nextBindings = { ...bindings, [petId]: [...new Set([...enabled, ...preview.skills.map((skill) => skill.id)])] };
  try {
    storage.setItem(libraryKey, serializeAgentExternalSkillLibrary(library));
    storage.setItem(bindingsKey, JSON.stringify(nextBindings));
  } catch (error) {
    if (oldLibrary === null) storage.removeItem(libraryKey); else storage.setItem(libraryKey, oldLibrary);
    if (oldBindings === null) storage.removeItem(bindingsKey); else storage.setItem(bindingsKey, oldBindings);
    throw error;
  }
  return { library, bindings: nextBindings };
}
