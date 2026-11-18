// A plan / design / explanation as a mind map (2026-11-09, report plugin; replaces the fixed
// six-box proposal picture). The topic sits in the middle, branches spread left and right, each
// branch holds child nodes that may carry a few short notes. Plain text only.

export interface MindMapChild {
  notes?: string[];
  text: string;
}

export interface MindMapBranch {
  children?: MindMapChild[];
  text: string;
}

export interface MindMapData {
  avatarDataUrl?: string;
  branches: MindMapBranch[];
  characterName: string;
  createdAt: number;
  subtitle?: string;
  /** One sentence in her voice, shown under the map. */
  summary?: string;
  title: string;
}

export const MIND_MAP_LIMITS = {
  branchChars: 16,
  branches: 8,
  childChars: 30,
  children: 6,
  noteChars: 40,
  notes: 3,
  summaryChars: 100,
  titleChars: 24,
  totalChildren: 32,
} as const;

function clip(value: unknown, max: number) {
  const text = typeof value === 'string' ? value.replace(/\s+/gu, ' ').trim() : '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function asRecord(raw: unknown): Record<string, unknown> {
  // A bare string is a node with only its text.
  if (typeof raw === 'string') return { text: raw };
  return raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
}

/** Accepts `text`, or `name` / `label` (what models often write instead). */
function nodeText(record: Record<string, unknown>, max: number) {
  return clip(record.text ?? record.name ?? record.label, max);
}

type MindMapInput = Omit<Partial<MindMapData>, 'branches'> & { branches?: unknown };

/** Whatever came in (from the model), cut to what the picture can hold. */
export function normalizeMindMap(input: MindMapInput): MindMapData {
  let childBudget: number = MIND_MAP_LIMITS.totalChildren;
  const branches = (Array.isArray(input.branches) ? input.branches : []).flatMap((raw): MindMapBranch[] => {
    const record = asRecord(raw);
    const text = nodeText(record, MIND_MAP_LIMITS.branchChars);
    if (!text) return [];
    const children = (Array.isArray(record.children) ? record.children : []).flatMap((childRaw): MindMapChild[] => {
      const child = asRecord(childRaw);
      const childText = nodeText(child, MIND_MAP_LIMITS.childChars);
      if (!childText) return [];
      const notes = (Array.isArray(child.notes) ? child.notes : []).map((note) => clip(note, MIND_MAP_LIMITS.noteChars)).filter(Boolean).slice(0, MIND_MAP_LIMITS.notes);
      return [{ text: childText, ...(notes.length ? { notes } : {}) }];
    }).slice(0, MIND_MAP_LIMITS.children);
    const kept = children.slice(0, Math.max(0, childBudget));
    childBudget -= kept.length;
    return [{ text, ...(kept.length ? { children: kept } : {}) }];
  }).slice(0, MIND_MAP_LIMITS.branches);
  const subtitle = clip(input.subtitle, 40);
  const summary = clip(input.summary, MIND_MAP_LIMITS.summaryChars);
  return {
    ...(typeof input.avatarDataUrl === 'string' && input.avatarDataUrl.startsWith('data:image/') ? { avatarDataUrl: input.avatarDataUrl } : {}),
    branches,
    characterName: clip(input.characterName, 12) || '她',
    createdAt: Number.isFinite(Number(input.createdAt)) && Number(input.createdAt) > 0 ? Number(input.createdAt) : Date.now(),
    ...(subtitle ? { subtitle } : {}),
    ...(summary ? { summary } : {}),
    title: clip(input.title, MIND_MAP_LIMITS.titleChars) || '思维导图',
  };
}
