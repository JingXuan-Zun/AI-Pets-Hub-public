import type { PetConfig, PetConfigUpdateHandler } from '../types';

/**
 * One platform feature the character can drive from conversation. Every feature —
 * built-in today, plugins later — declares itself the same way, and the agent reaches
 * all of them through the single `use_platform_capability` tool.
 */
/**
 * read: looks only. personal: changes only the user's own lists or timer (reminders, todos) or
 * how things look and sound (font size, pet size, reading speed) — seen at once, easy to undo —
 * and runs without asking. change: changes settings or behaviour, asks first.
 */
export type PlatformCapabilityRisk = 'read' | 'personal' | 'change';

export interface PlatformCapabilityArg {
  description: string;
  enumValues?: string[];
  key: string;
  required?: boolean;
  type: 'boolean' | 'number' | 'string';
}

export type PlatformCapabilityArgs = Record<string, unknown>;

export interface PlatformCapabilityContext {
  configRef: { current: PetConfig };
  onUpdateConfig: PetConfigUpdateHandler;
  /** The character the user is talking to. */
  petId?: string | null;
  /** Shows pictures in the chat as a message from that character (absent outside chat). */
  presentImages?: (images: PresentedImage[], caption: string) => void;
  /**
   * Runs a long job in the background so she keeps talking (absent outside chat: run it
   * inline). Returns at once with what to tell her; when the job ends its pictures are shown
   * and she says how it went.
   */
  runInBackground?: (job: BackgroundJob) => PlatformCapabilityResult;
  /** Asks the user on a confirmation card (absent outside chat: changes that need a yes are refused). */
  requestApproval?: (request: { detail: string; irreversible?: boolean; title: string }) => Promise<boolean>;
}

export interface BackgroundJob {
  /** One job of a kind at a time (“drawing”). */
  kind: string;
  run: (signal: AbortSignal) => Promise<{ images?: PresentedImage[]; ok: boolean; text: string }>;
  /** Shown while it runs and in her prompt, e.g. “画图：海边的小桃”. */
  title: string;
}

export interface PresentedImage {
  dataUrl: string;
  mimeType: string;
  name: string;
  sizeBytes?: number;
}

export interface PlatformCapabilityResult {
  ok: boolean;
  /** Plain-language outcome the character can relay to the user. */
  text: string;
  /** Ends her reply with these words instead of another model round (the model was just switched). */
  endsReply?: string;
}

export interface PlatformCapability {
  args: PlatformCapabilityArg[];
  /** For the model: when to use it. */
  description: string;
  /**
   * Plain-language sentence shown when asking the user to confirm a change
   * (e.g. “开启看屏幕陪伴”). Also used as the plan step text for reads.
   */
  describe: (args: PlatformCapabilityArgs) => string;
  /** Section the capability belongs to, e.g. “生活陪伴”. */
  group: string;
  id: string;
  risk: PlatformCapabilityRisk;
  run: (context: PlatformCapabilityContext, args: PlatformCapabilityArgs) => PlatformCapabilityResult | Promise<PlatformCapabilityResult>;
  title: string;
}
