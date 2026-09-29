import { readAgentSkillMarkdownMetadata } from './agentSkillMarkdownMetadata';

export const AGENT_EXTERNAL_SKILL_LIBRARY_KIND = 'agent-external-skill-library.v1';
export const AGENT_EXTERNAL_SKILL_DEFINITION_KIND = 'agent-external-skill.v1';
export const MAX_AGENT_EXTERNAL_SKILLS = 48;
const MAX_TEXT_LENGTH = 64 * 1024;

export interface AgentExternalSkillDefinition {
  capabilityIds: string[];
  description: string;
  id: string;
  importedAt: string;
  inputSchema: Record<string, unknown>;
  instructions: string;
  risk: 'read' | 'visual' | 'action';
  sourceName: string;
  tags: string[];
  title: string;
  version: string;
}

export interface AgentExternalSkillLibrary {
  kind: typeof AGENT_EXTERNAL_SKILL_LIBRARY_KIND;
  skills: AgentExternalSkillDefinition[];
}

export interface AgentExternalSkillImportPreview {
  errors: string[];
  skill: AgentExternalSkillDefinition | null;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value.trim() : fallback;
}

function getStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 24) : [];
}

function normalizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '').slice(0, 80);
}

function normalizeRisk(value: unknown): AgentExternalSkillDefinition['risk'] {
  return value === 'action' || value === 'visual' ? value : 'read';
}

function createMarkdownDefinition(text: string, sourceName: string): AgentExternalSkillDefinition | null {
  const metadata = readAgentSkillMarkdownMetadata(text);
  const title = metadata.title || metadata.name || sourceName.replace(/\.[^.]+$/u, '');
  const description = metadata.description || 'Imported declarative Skill.';
  const id = normalizeId(metadata.name || sourceName.replace(/\.[^.]+$/u, ''));
  if (!id || !title) return null;
  return {
    capabilityIds: [],
    description: description.slice(0, 500),
    id: `external.${id}`,
    importedAt: new Date().toISOString(),
    inputSchema: { type: 'object', properties: {} },
    instructions: text.slice(0, MAX_TEXT_LENGTH),
    risk: 'read',
    sourceName,
    tags: ['imported', 'declarative'],
    title: title.slice(0, 120),
    version: '0.1.0',
  };
}

function normalizeDefinition(value: unknown, sourceName: string): AgentExternalSkillDefinition | null {
  if (!isRecord(value)) return null;
  const skill = isRecord(value.skill) ? value.skill : value;
  const id = normalizeId(getString(skill.id));
  const title = getString(skill.title || skill.name);
  if (!id || !title) return null;
  const inputSchema = isRecord(skill.inputSchema) ? skill.inputSchema : { type: 'object', properties: {} };
  return {
    capabilityIds: getStringArray(skill.capabilityIds || skill.capabilities),
    description: getString(skill.description, 'Imported declarative Skill.').slice(0, 500),
    id: id.startsWith('external.') ? id : `external.${id}`,
    importedAt: getString(skill.importedAt, new Date().toISOString()),
    inputSchema,
    instructions: getString(skill.instructions || skill.prompt || value.instructions).slice(0, MAX_TEXT_LENGTH),
    risk: normalizeRisk(skill.risk),
    sourceName: getString(skill.sourceName, sourceName),
    tags: getStringArray(skill.tags).slice(0, 12),
    title: title.slice(0, 120),
    version: getString(skill.version, '0.1.0').slice(0, 32),
  };
}

export function parseAgentExternalSkillImport(text: string, sourceName = 'imported-skill.json'): AgentExternalSkillImportPreview {
  if (text.length > MAX_TEXT_LENGTH) return { errors: [`Skill file exceeds ${MAX_TEXT_LENGTH} bytes.`], skill: null, warnings: [] };
  try {
    const parsed = JSON.parse(text) as unknown;
    const skill = normalizeDefinition(parsed, sourceName);
    if (!skill) return { errors: ['Skill JSON needs id and title/name fields.'], skill: null, warnings: [] };
    const warnings = skill.instructions ? [] : ['No instructions were provided; this Skill is metadata-only until connected to a platform capability.'];
    return { errors: [], skill, warnings };
  } catch {
    const skill = createMarkdownDefinition(text, sourceName);
    return skill
      ? { errors: [], skill, warnings: ['Markdown import is declarative only and cannot execute code.'] }
      : { errors: ['File is neither valid Skill JSON nor readable Markdown.'], skill: null, warnings: [] };
  }
}

export function createEmptyAgentExternalSkillLibrary(): AgentExternalSkillLibrary {
  return { kind: AGENT_EXTERNAL_SKILL_LIBRARY_KIND, skills: [] };
}

export function parseAgentExternalSkillLibraryJson(rawText?: string | null): AgentExternalSkillLibrary {
  if (!rawText?.trim()) return createEmptyAgentExternalSkillLibrary();
  try {
    const parsed = JSON.parse(rawText) as unknown;
    const values = isRecord(parsed) && Array.isArray(parsed.skills) ? parsed.skills : [];
    const skills = values.map((value) => normalizeDefinition(value, 'library')).filter((skill): skill is AgentExternalSkillDefinition => Boolean(skill));
    return { kind: AGENT_EXTERNAL_SKILL_LIBRARY_KIND, skills: skills.slice(0, MAX_AGENT_EXTERNAL_SKILLS) };
  } catch {
    return createEmptyAgentExternalSkillLibrary();
  }
}

export function serializeAgentExternalSkillLibrary(library: AgentExternalSkillLibrary) {
  return JSON.stringify({ kind: AGENT_EXTERNAL_SKILL_LIBRARY_KIND, skills: library.skills.slice(0, MAX_AGENT_EXTERNAL_SKILLS) });
}

export function addAgentExternalSkillToLibrary(library: AgentExternalSkillLibrary, skill: AgentExternalSkillDefinition): AgentExternalSkillLibrary {
  return { kind: AGENT_EXTERNAL_SKILL_LIBRARY_KIND, skills: [skill, ...library.skills.filter((item) => item.id !== skill.id)].slice(0, MAX_AGENT_EXTERNAL_SKILLS) };
}

export function removeAgentExternalSkillFromLibrary(library: AgentExternalSkillLibrary, skillId: string): AgentExternalSkillLibrary {
  return { kind: AGENT_EXTERNAL_SKILL_LIBRARY_KIND, skills: library.skills.filter((skill) => skill.id !== skillId) };
}
