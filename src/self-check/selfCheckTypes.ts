import type { LocalVoiceHealth, PetConfig } from '../types';

// Self-check, level 1 of docs/self-repair-design-20261008.md: known problems with a read-only
// check and, where it is safe, a repeatable fix. A fix is always followed by the check again.

export type RepairRisk = 'safe' | 'confirm' | 'manual-only';

export type DiagnosticResult =
  | { status: 'ok'; summary?: string }
  | { status: 'problem'; summary: string; advice?: string }
  | { status: 'unknown'; summary: string };

export type RepairResult = { ok: boolean; summary: string };

/** What the checks may use; injected so they run in any window and in tests. */
export type SelfCheckDeps = {
  config: PetConfig;
  getLocalVoiceHealth: (settings: PetConfig['settings']) => Promise<LocalVoiceHealth>;
  warmupLocalVoice: (settings: PetConfig['settings']) => Promise<void>;
  testModel: (settings: PetConfig['settings']) => Promise<{ ok: boolean; error?: string }>;
  testOneBot: (url: string, accessToken: string) => Promise<{ ok: true; account: string } | { ok: false; error: string }>;
  /** Whether Claude Code is there and logged in (one tiny request). */
  testDevAgent: (executablePath: string, env?: Record<string, string>) => Promise<{ installed: boolean; loggedIn: boolean; error?: string; version?: string }>;
};

export type DiagnosticItem = {
  id: string;
  title: string;
  area: 'voice' | 'model' | 'config' | 'network';
  risk: RepairRisk;
  /** Longer than the default 20 s when the check is slow by nature (e.g. probing Python). */
  timeoutMs?: number;
  /** Whether the check means anything with the current settings (e.g. voice switched off). */
  applies: (deps: SelfCheckDeps) => boolean;
  check: (deps: SelfCheckDeps) => Promise<DiagnosticResult>;
  fix?: (deps: SelfCheckDeps) => Promise<RepairResult>;
};

export type SelfCheckEntry = {
  id: string;
  title: string;
  /** The final state after any fix. */
  result: DiagnosticResult;
  repair: RepairResult | null;
  checkedAt: number;
};
