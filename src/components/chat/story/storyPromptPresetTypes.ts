export type StoryPromptInputMode = 'json' | 'manual';
export type StoryPromptRole = 'assistant' | 'system' | 'user';
export type StoryPromptStage = 'character' | 'director' | 'draft' | 'narrator';

export interface StoryPromptPresetItem {
  content?: string;
  forbid_overrides?: boolean;
  identifier: string;
  injection_depth?: number;
  injection_order?: number;
  injection_position?: number;
  injection_trigger?: string[];
  marker?: boolean;
  name: string;
  role: StoryPromptRole;
  system_prompt?: boolean;
}

export interface StoryPromptOrderEntry {
  enabled: boolean;
  identifier: string;
}

export interface StoryPromptOrderList {
  character_id: number | string;
  order: StoryPromptOrderEntry[];
}

export interface StoryPromptPreset {
  prompt_order: StoryPromptOrderList[];
  prompts: StoryPromptPresetItem[];
  version: 1;
}

export interface CompiledStoryPrompt {
  assistant: string;
  system: string;
  user: string;
}
