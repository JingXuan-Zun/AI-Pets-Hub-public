import type { StoryDefinition, StorySessionState } from './storyTypes';

export const STORY_LIBRARY_STORAGE_KEY = 'desktop-pet-story-library-v1';
export const STORY_SESSION_STORAGE_KEY = 'desktop-pet-story-session-v1';
const MAX_STORY_LIBRARY_SIZE = 30;

function canUseStorage() {
  return typeof globalThis !== 'undefined' && Boolean(globalThis.localStorage);
}

function isStoryDefinition(value: unknown): value is StoryDefinition {
  return Boolean(value && typeof value === 'object' && (value as StoryDefinition).version === 1);
}

function isStorySession(value: unknown, storyId: string): value is StorySessionState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StorySessionState>;
  return candidate.definition?.id === storyId
    && typeof candidate.currentScene === 'string'
    && typeof candidate.currentTime === 'string'
    && Number.isFinite(candidate.elapsedMinutes)
    && Array.isArray(candidate.activeCast)
    && Array.isArray(candidate.eventLog)
    && candidate.characterStates !== undefined
    && candidate.taskStatuses !== undefined;
}

export function mergeStoryLibrary(
  stories: StoryDefinition[],
  nextStory: StoryDefinition,
) {
  return [nextStory, ...stories.filter((story) => story.id !== nextStory.id)]
    .slice(0, MAX_STORY_LIBRARY_SIZE);
}

export function removeStoryFromLibrary(stories: StoryDefinition[], storyId: string) {
  return stories.filter((story) => story.id !== storyId);
}

function persistStoryLibrary(stories: StoryDefinition[]) {
  if (!canUseStorage()) return;
  try {
    globalThis.localStorage.setItem(STORY_LIBRARY_STORAGE_KEY, JSON.stringify(stories));
  } catch {
    // Storage failure must not interrupt story runtime.
  }
}

export function loadStoryLibrary() {
  if (!canUseStorage()) return [];
  try {
    const raw = globalThis.localStorage.getItem(STORY_LIBRARY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return (Array.isArray(parsed) ? parsed : []).filter(isStoryDefinition).slice(0, MAX_STORY_LIBRARY_SIZE);
  } catch {
    return [];
  }
}

export function saveStoryToLibrary(stories: StoryDefinition[], story: StoryDefinition) {
  const nextStories = mergeStoryLibrary(stories, story);
  persistStoryLibrary(nextStories);
  return nextStories;
}

export function deleteStoryFromLibrary(stories: StoryDefinition[], storyId: string) {
  const nextStories = removeStoryFromLibrary(stories, storyId);
  persistStoryLibrary(nextStories);
  if (canUseStorage()) {
    try {
      globalThis.localStorage.removeItem(`${STORY_SESSION_STORAGE_KEY}:${storyId}`);
    } catch {
      // Storage failure must not interrupt story runtime.
    }
  }
  return nextStories;
}

export function loadStorySessionSnapshot(storyId: string) {
  if (!canUseStorage() || !storyId.trim()) return null;
  try {
    const raw = globalThis.localStorage.getItem(`${STORY_SESSION_STORAGE_KEY}:${storyId}`);
    const parsed = raw ? JSON.parse(raw) : null;
    return isStorySession(parsed, storyId) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStorySessionSnapshot(session: StorySessionState) {
  if (!canUseStorage()) return;
  try {
    globalThis.localStorage.setItem(
      `${STORY_SESSION_STORAGE_KEY}:${session.definition.id}`,
      JSON.stringify(session),
    );
  } catch {
    // Snapshot failure must not interrupt story runtime.
  }
}
