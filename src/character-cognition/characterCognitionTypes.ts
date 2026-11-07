// "What is on her mind" — the cognition layer (docs/cognition-layer-design-20261106.md).
// One small state per character: a mood, up to three concerns that build up charge and leak
// over time, and who she wants to talk to. It shapes who speaks in group chat, gives her
// replies a thread, and (phase 2) decides when she speaks first.

/** Rules read from her persona once, before anything changes (user, 2026-11-06). */
export interface CognitionBaseline {
  /** Persona rules about her feelings that always hold, e.g. "对用户的好感永远最高，只增不减". */
  rules: string[];
  /** Her persona says her feelings toward the user never turn cold: updates that would, are dropped. */
  neverNegativeTowardUser: boolean;
  /** The mood she falls back to when nothing is going on. */
  defaultMood: string;
}

export interface CognitionMood {
  label: string;
  /** 0–1. */
  intensity: number;
}

export interface CognitionConcern {
  id: string;
  /** What she keeps thinking about, in her own frame, one sentence. */
  text: string;
  /** 'user', another character's name, or null. */
  about: string | null;
  /** Words that, when they come up, remind her of it. */
  keywords: string[];
  /** 0–100 at `chargedAt`; leaks over time (see effectiveCharge). */
  charge: number;
  chargedAt: number;
  createdAt: number;
  /** When she last brought it up herself. */
  mentionedAt?: number;
}

export interface CharacterCognition {
  roleId: string;
  baseline: CognitionBaseline;
  mood: CognitionMood;
  concerns: CognitionConcern[];
  /** Who she wants to talk to and why; null when nobody in particular. */
  toward: { target: string; why: string } | null;
  initializedAt: number;
  updatedAt: number;
  /** Plain-language note of the last change, for the panel ("和你聊完比赛的事"). */
  lastChange?: string;
}

export const MAX_CONCERNS = 3;
/** A concern's charge halves in this time when nothing feeds it. */
export const CONCERN_HALF_LIFE_MS = 8 * 60 * 60 * 1000;
