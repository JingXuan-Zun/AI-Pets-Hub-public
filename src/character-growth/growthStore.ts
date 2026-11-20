import { describeRecentGrowth, GROWTH_AWARE_MS, type GrowthKind } from './growthRules';

// Per character: when she last looked back, when growth was proposed (weekly limit), and what
// was approved lately (she knows about it). Shared by the pet and chat windows (same origin).

const STORAGE_KEY = 'desktop-pet.character-growth.v1';
const WEEK_MS = 7 * 24 * 60 * 60_000;

export interface GrowthRoleState {
  approved: Array<{ approvedAt: number; kind: GrowthKind; text: string }>;
  lastReflectionAt: number | null;
  /** Memory count at the last reflection: new memories since then make the next one due. */
  memoryCountAtReflection: number;
  proposedAt: number[];
}

const EMPTY: GrowthRoleState = { approved: [], lastReflectionAt: null, memoryCountAtReflection: 0, proposedAt: [] };

function readAll(): Record<string, GrowthRoleState> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function readGrowthState(roleId: string): GrowthRoleState {
  const saved = readAll()[roleId];
  return saved ? { ...EMPTY, ...saved } : { ...EMPTY };
}

export function updateGrowthState(roleId: string, update: (state: GrowthRoleState) => GrowthRoleState, now = Date.now()) {
  const next = update(readGrowthState(roleId));
  const trimmed = {
    ...next,
    approved: next.approved.filter((item) => now - item.approvedAt < GROWTH_AWARE_MS),
    proposedAt: next.proposedAt.filter((time) => now - time < WEEK_MS),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [roleId]: trimmed }));
  } catch {
    // Without storage she still grows; only the limits and her awareness reset.
  }
  return trimmed;
}

export function proposalsThisWeek(state: GrowthRoleState, now: number) {
  return state.proposedAt.filter((time) => now - time < WEEK_MS).length;
}

/** For her replies: what she grew into this week (she knows, and may bring it up). */
export function growthNoteFor(roleId: string, now = Date.now()) {
  return describeRecentGrowth(readGrowthState(roleId).approved, now);
}
