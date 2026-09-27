import type { StorySessionState } from './storyTypes';

const MAX_SUGGESTIONS = 4;
const FALLBACK_SUGGESTIONS = [
  '先观察当前场景中最反常的细节。',
  '向眼前的角色询问与目标有关的线索。',
  '沿着当前目标继续行动，同时保持警惕。',
];

function cleanSuggestion(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 240) : '';
}

export function normalizeStoryActionSuggestions(
  suggestions: unknown,
  _session: StorySessionState,
) {
  const normalized = Array.from(new Set(
    (Array.isArray(suggestions) ? suggestions : [])
      .map(cleanSuggestion)
      .filter(Boolean),
  )).slice(0, MAX_SUGGESTIONS);

  return normalized.length > 0 ? normalized : FALLBACK_SUGGESTIONS;
}
