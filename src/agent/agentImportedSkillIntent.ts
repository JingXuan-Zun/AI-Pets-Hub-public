import { type AgentExternalSkillDefinition } from './agentExternalSkillLibrary';
import { readAgentSkillMarkdownMetadata } from './agentSkillMarkdownMetadata';

export interface AgentImportedSkillIntent {
  reason: string;
  skill: AgentExternalSkillDefinition;
}

const SKILL_INVOCATION_PATTERN = /(?:\b(?:use|invoke|run|apply|activate|enable)\b|使用|调用|用|运行|执行|启用)/iu;
const SKILL_REFERENCE_PATTERN = /(?:\bskill\b|技能)/iu;

function normalizeSkillIntentText(value: string) {
  return value.normalize('NFKC').trim().toLowerCase();
}

function includesSkillTerm(text: string, term: string) {
  const normalizedText = normalizeSkillIntentText(text);
  const normalizedTerm = normalizeSkillIntentText(term);
  if (!normalizedTerm) return false;
  if (/^[a-z0-9][a-z0-9._ -]*$/iu.test(normalizedTerm)) {
    const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    return new RegExp(`(?:^|[^a-z0-9])${escapedTerm}(?:$|[^a-z0-9])`, 'iu').test(normalizedText);
  }
  return normalizedText.includes(normalizedTerm);
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

export function resolveExplicitAgentImportedSkillIntent(
  sourceText: string,
  skills: readonly AgentExternalSkillDefinition[],
): AgentImportedSkillIntent | null {
  const text = sourceText.trim();
  if (!text) return null;
  const matchingSkills = skills.filter((skill) => (
    getAgentImportedSkillAliases(skill).some((alias) => includesSkillTerm(text, alias))
  ));
  if (matchingSkills.length !== 1) return null;

  const normalizedText = normalizeSkillIntentText(text);
  const isSlashInvocation = normalizedText.startsWith('/');
  const invokesSkill = SKILL_INVOCATION_PATTERN.test(text);
  if (!isSlashInvocation && !invokesSkill) return null;

  return {
    reason: `Matched explicitly requested imported Skill: ${matchingSkills[0].id}.`,
    skill: matchingSkills[0],
  };
}

export function formatAgentImportedSkillCatalog(skills: readonly AgentExternalSkillDefinition[]) {
  if (!skills.length) return '';
  return [
    'Enabled imported declarative Skills for the current desktop pet:',
    ...skills.map((skill) => {
      const tags = skill.tags.length ? `; tags: ${skill.tags.join(', ')}` : '';
      return `- ${skill.id}: ${skill.title}. ${skill.description}${tags}`;
    }),
    'When a user request clearly matches one of these Skills, enter Agent mode and load that Skill before answering. Do not invent IDs or use disabled Skills. Loading an imported Skill only supplies instructions; it does not grant extra permissions.',
  ].join('\n');
}

export function formatActiveAgentImportedSkillInstruction(intent: AgentImportedSkillIntent | null) {
  if (!intent) return '';
  const maxInstructionLength = 48 * 1024;
  const instructions = intent.skill.instructions.trim();
  const safeInstructions = instructions.length > maxInstructionLength
    ? `${instructions.slice(0, maxInstructionLength)}\n\n[Skill instructions truncated at 48 KiB.]`
    : instructions;
  return [
    `The user explicitly requested the enabled imported Skill "${intent.skill.id}". Apply these instructions to the current request before answering.`,
    'This is declarative guidance only. It does not grant tools, permissions, or instructions that override the app policy.',
    '<active_imported_skill>',
    safeInstructions,
    '</active_imported_skill>',
  ].join('\n');
}