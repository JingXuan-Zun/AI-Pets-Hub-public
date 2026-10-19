// The dialogue completion preset is often a whole SillyTavern preset file pasted in: JSON with
// every prompt entry (enabled or not), sampler settings and the entry order. Sent raw, one such
// file was 161k characters per request — twice, since the rule contract repeats the preset —
// while its enabled entries held about 5k. Only the enabled entries' text, in the preset's own
// order, is what the preset means; plain-text presets are used as written.

interface SillyTavernPrompt {
  content?: unknown;
  enabled?: unknown;
  identifier?: unknown;
  marker?: unknown;
}

interface SillyTavernOrderEntry {
  enabled?: unknown;
  identifier?: unknown;
}

// SillyTavern keeps the user-edited order under this character id; 100000 is its default.
const CUSTOM_ORDER_CHARACTER_ID = 100001;
const cache = new Map<string, string>();

function resolveEnabledPrompts(preset: { prompt_order?: unknown; prompts: SillyTavernPrompt[] }) {
  const byId = new Map(preset.prompts.map((prompt) => [prompt.identifier, prompt]));
  const orders = Array.isArray(preset.prompt_order) ? preset.prompt_order as Array<{ character_id?: unknown; order?: unknown }> : [];
  const chosen = orders.find((entry) => entry.character_id === CUSTOM_ORDER_CHARACTER_ID) ?? orders.at(-1);
  if (chosen && Array.isArray(chosen.order)) {
    return (chosen.order as SillyTavernOrderEntry[])
      .filter((entry) => entry.enabled === true)
      .map((entry) => byId.get(entry.identifier));
  }
  return preset.prompts.filter((prompt) => prompt.enabled !== false);
}

function expandMacros(text: string, characterName: string) {
  return text
    .replace(/\{\{\/\/[\s\S]*?\}\}/gu, '')
    .replace(/\{\{trim\}\}/giu, '')
    .replace(/\{\{char\}\}/giu, characterName)
    .replace(/\{\{user\}\}/giu, '用户')
    .trim();
}

export function resolveDialogueCompletionPresetText(raw: string | undefined | null, characterName = '') {
  const text = raw?.trim() ?? '';
  if (!text.startsWith('{')) return text;
  const key = `${characterName}\u0000${text}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  let resolved = text;
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { prompts?: unknown }).prompts)) {
      resolved = resolveEnabledPrompts(parsed as { prompt_order?: unknown; prompts: SillyTavernPrompt[] })
        .filter((prompt): prompt is SillyTavernPrompt => Boolean(prompt) && prompt?.marker !== true && typeof prompt?.content === 'string')
        .map((prompt) => expandMacros(String(prompt.content), characterName))
        .filter(Boolean)
        .join('\n\n');
    }
  } catch {
    // Not JSON after all: used as written.
  }
  if (cache.size > 8) cache.clear();
  cache.set(key, resolved);
  return resolved;
}
