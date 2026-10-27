// The progress card and decision log: what the user is working on right now (goal, what is
// settled, how far, what next) and the decisions made per project. Shared by every
// character, so whoever the user talks to stays on the same task and never contradicts a
// settled point. Filled by the characters through the work.* capabilities.

export type WorkTask = {
  id: string;
  /** "战斗系统的翻滚" */
  title: string;
  /** The project it belongs to ("动作游戏"); decisions are grouped by it. */
  project: string;
  goal: string;
  /** Points settled while doing this task. */
  decided: string[];
  progress: string;
  next: string;
  startedAt: number;
  updatedAt: number;
  finishedAt: number | null;
  /** Development assistant sessions of this task, keyed by agentSessionKey(), so later hand-offs continue them. */
  agentSessions: Record<string, string>;
};

const MAX_AGENT_SESSIONS = 8;

/** One session per provider and project folder: a session only resumes where it was made. */
export function agentSessionKey(provider: string, workspacePath: string) {
  return `${provider}|${workspacePath.trim().toLowerCase()}`;
}

function normalizeAgentSessions(value: unknown) {
  const sessions: Record<string, string> = {};
  if (!isRecord(value)) return sessions;
  for (const [key, id] of Object.entries(value).slice(-MAX_AGENT_SESSIONS)) {
    if (typeof id === 'string' && /^[0-9a-f-]{8,64}$/iu.test(id) && key.length <= 400) sessions[key] = id;
  }
  return sessions;
}

export type WorkDecision = {
  id: string;
  text: string;
  project: string;
  createdAt: number;
};

export type WorkTaskSettings = {
  activeTask: WorkTask | null;
  /** Finished tasks, newest first. */
  recentTasks: WorkTask[];
  decisions: WorkDecision[];
};

export const DEFAULT_WORK_TASK_SETTINGS: WorkTaskSettings = {
  activeTask: null,
  decisions: [],
  recentTasks: [],
};

export const MAX_TASK_DECIDED = 20;
export const MAX_RECENT_TASKS = 20;
export const MAX_WORK_DECISIONS = 300;
const MAX_FIELD_CHARS = 300;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown, max = MAX_FIELD_CHARS) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function time(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function createWorkId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeTask(value: unknown): WorkTask | null {
  if (!isRecord(value) || !text(value.title)) return null;
  return {
    agentSessions: normalizeAgentSessions(value.agentSessions),
    decided: (Array.isArray(value.decided) ? value.decided : []).map((item) => text(item)).filter(Boolean).slice(-MAX_TASK_DECIDED),
    finishedAt: typeof value.finishedAt === 'number' ? value.finishedAt : null,
    goal: text(value.goal),
    id: text(value.id, 80) || createWorkId('task'),
    next: text(value.next),
    progress: text(value.progress),
    project: text(value.project, 80),
    startedAt: time(value.startedAt),
    title: text(value.title, 120),
    updatedAt: time(value.updatedAt),
  };
}

function normalizeDecision(value: unknown): WorkDecision | null {
  if (!isRecord(value) || !text(value.text)) return null;
  return {
    createdAt: time(value.createdAt),
    id: text(value.id, 80) || createWorkId('decision'),
    project: text(value.project, 80),
    text: text(value.text),
  };
}

export function normalizeWorkTaskSettings(value: unknown): WorkTaskSettings {
  const raw = isRecord(value) ? value : {};
  return {
    activeTask: normalizeTask(raw.activeTask),
    decisions: (Array.isArray(raw.decisions) ? raw.decisions : [])
      .map(normalizeDecision)
      .filter((item): item is WorkDecision => Boolean(item))
      .slice(-MAX_WORK_DECISIONS),
    recentTasks: (Array.isArray(raw.recentTasks) ? raw.recentTasks : [])
      .map(normalizeTask)
      .filter((item): item is WorkTask => Boolean(item))
      .slice(0, MAX_RECENT_TASKS),
  };
}

/** Decisions of one project (all projects when it is empty), oldest first. */
export function projectDecisions(settings: WorkTaskSettings, project: string) {
  const wanted = project.trim();
  return settings.decisions.filter((item) => !wanted || !item.project || item.project === wanted);
}
