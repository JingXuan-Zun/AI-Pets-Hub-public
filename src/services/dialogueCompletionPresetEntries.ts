// Entry switches for a pasted SillyTavern preset, like SillyTavern's own prompt manager: a raw
// JSON box gave no way to turn off one entry (e.g. its "选项" entry that ends every reply with
// suggested lines) short of editing the JSON by hand.

const CUSTOM_ORDER_CHARACTER_ID = 100001;

interface PresetJson {
  prompt_order?: Array<{ character_id?: unknown; order?: Array<{ enabled?: unknown; identifier?: unknown }> }>;
  prompts?: Array<{ content?: unknown; identifier?: unknown; marker?: unknown; name?: unknown }>;
}

export interface PresetEntry {
  enabled: boolean;
  identifier: string;
  name: string;
}

function parsePreset(raw: string | undefined | null): PresetJson | null {
  const text = raw?.trim() ?? '';
  if (!text.startsWith('{')) return null;
  try {
    const parsed = JSON.parse(text) as PresetJson;
    return Array.isArray(parsed?.prompts) && Array.isArray(parsed.prompt_order) ? parsed : null;
  } catch {
    return null;
  }
}

function activeOrder(preset: PresetJson) {
  const orders = preset.prompt_order ?? [];
  return orders.find((entry) => entry.character_id === CUSTOM_ORDER_CHARACTER_ID) ?? orders.at(-1) ?? null;
}

/** The preset's own entries in order (null when the text is not a SillyTavern preset). */
export function listPresetEntries(raw: string | undefined | null): PresetEntry[] | null {
  const preset = parsePreset(raw);
  const order = preset ? activeOrder(preset) : null;
  if (!preset || !order || !Array.isArray(order.order)) return null;
  const byId = new Map((preset.prompts ?? []).map((prompt) => [prompt.identifier, prompt]));
  return order.order
    .map((entry) => ({ entry, prompt: byId.get(entry.identifier) }))
    .filter(({ prompt }) => prompt && prompt.marker !== true && typeof prompt.content === 'string' && prompt.content.trim())
    .map(({ entry, prompt }) => ({
      enabled: entry.enabled === true,
      identifier: String(entry.identifier),
      name: typeof prompt?.name === 'string' && prompt.name.trim() ? prompt.name.trim() : String(entry.identifier),
    }));
}

/** The same preset text with one entry switched on or off (formatting kept as JSON). */
export function setPresetEntryEnabled(raw: string, identifier: string, enabled: boolean) {
  const preset = parsePreset(raw);
  const order = preset ? activeOrder(preset) : null;
  if (!preset || !order?.order) return raw;
  order.order = order.order.map((entry) => (entry.identifier === identifier ? { ...entry, enabled } : entry));
  return JSON.stringify(preset, null, 2);
}
