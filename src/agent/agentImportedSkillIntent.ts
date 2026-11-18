import { type AgentExternalSkillDefinition } from './agentExternalSkillLibrary';
import { readAgentSkillMarkdownMetadata } from './agentSkillMarkdownMetadata';

function normalizeSkillIntentText(value: string) {
  return value.normalize('NFKC').trim().toLowerCase();
}

export function getAgentImportedSkillAliases(skill: AgentExternalSkillDefinition) {
  return [
    skill.id,
    skill.id.replace(/^external\./u, ''),
    readAgentSkillMarkdownMetadata(skill.instructions).name,
    skill.title,
  ].filter((value): value is string => Boolean(value?.trim()))
    .map(normalizeSkillIntentText)
    .filter((value, index, entries) => entries.indexOf(value) === index);
}