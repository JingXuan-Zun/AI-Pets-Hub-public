const STORAGE_KEY = 'desktop-pet:deepseek-harness-agents:v1';
const SELECTED_AGENT_STORAGE_KEY = 'desktop-pet:deepseek-harness-selected-agent:v1';
const MAX_AGENT_COUNT = 32;
const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,79}$/iu;

export const DEEPSEEK_HARNESS_AGENT_IMPORT_TEMPLATE = JSON.stringify({
  description: 'Read approved Workspace files and present an evidence-based summary.',
  id: 'workspace-analyst',
  instructions: 'Use only the approved Workspace. Read relevant text files, cite file names, and separate evidence from assumptions.',
  kind: 'ai-desktop-pet-harness-agent.v1',
  name: 'Workspace Analyst',
}, null, 2);

export interface DeepSeekHarnessAgentDefinition {
  description: string;
  id: string;
  instructions: string;
  kind: 'ai-desktop-pet-harness-agent.v1';
  name: string;
}

function normalizeText(value: unknown, maximum: number) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function getStorage() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeAgent(value: unknown): DeepSeekHarnessAgentDefinition | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const id = normalizeText(raw.id, 80);
  const name = normalizeText(raw.name, 80);
  const description = normalizeText(raw.description, 280);
  const instructions = normalizeText(raw.instructions, 8_000);
  if (
    raw.kind !== 'ai-desktop-pet-harness-agent.v1'
    || !ID_PATTERN.test(id)
    || !name
    || !description
    || !instructions
  ) {
    return null;
  }

  return {
    description,
    id,
    instructions,
    kind: 'ai-desktop-pet-harness-agent.v1',
    name,
  };
}

export function parseDeepSeekHarnessAgentImport(text: string) {
  try {
    const agent = normalizeAgent(JSON.parse(text));
    return agent
      ? { agent, error: '' }
      : { agent: null, error: 'Agent JSON 必须包含 kind、id、name、description 和 instructions。' };
  } catch {
    return { agent: null, error: 'Agent 文件不是有效 JSON。' };
  }
}

export function loadDeepSeekHarnessAgents() {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value
      .map(normalizeAgent)
      .filter((agent): agent is DeepSeekHarnessAgentDefinition => Boolean(agent))
      .slice(0, MAX_AGENT_COUNT);
  } catch {
    return [];
  }
}

export function saveDeepSeekHarnessAgents(agents: readonly DeepSeekHarnessAgentDefinition[]) {
  getStorage()?.setItem(STORAGE_KEY, JSON.stringify(agents.slice(0, MAX_AGENT_COUNT)));
}

export function installDeepSeekHarnessAgent(agent: DeepSeekHarnessAgentDefinition) {
  const current = loadDeepSeekHarnessAgents().filter((item) => item.id !== agent.id);
  const next = [agent, ...current].slice(0, MAX_AGENT_COUNT);
  saveDeepSeekHarnessAgents(next);
  return next;
}

export function removeDeepSeekHarnessAgent(agentId: string) {
  const next = loadDeepSeekHarnessAgents().filter((agent) => agent.id !== agentId);
  saveDeepSeekHarnessAgents(next);
  if (getSelectedDeepSeekHarnessAgentId() === agentId) {
    setSelectedDeepSeekHarnessAgentId('');
  }
  return next;
}

export function getSelectedDeepSeekHarnessAgentId() {
  return getStorage()?.getItem(SELECTED_AGENT_STORAGE_KEY)?.trim() ?? '';
}

export function setSelectedDeepSeekHarnessAgentId(agentId: string) {
  const storage = getStorage();
  if (!storage) return;
  if (agentId) {
    storage.setItem(SELECTED_AGENT_STORAGE_KEY, agentId);
  } else {
    storage.removeItem(SELECTED_AGENT_STORAGE_KEY);
  }
}

export function getSelectedDeepSeekHarnessAgent() {
  const selectedId = getSelectedDeepSeekHarnessAgentId();
  return loadDeepSeekHarnessAgents().find((agent) => agent.id === selectedId) ?? null;
}

export function buildDeepSeekHarnessAgentGoal(
  userGoal: string,
  agent: DeepSeekHarnessAgentDefinition | null,
) {
  if (!agent) return userGoal;
  return [
    'Harness Agent: ' + agent.name,
    'Agent instructions:',
    agent.instructions,
    '',
    'User task:',
    userGoal,
  ].join('\n');
}
