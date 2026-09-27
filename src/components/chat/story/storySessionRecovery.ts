import type { ChatMessage } from '../../../types';
import type { StoryDefinition, StorySessionState } from './storyTypes';

export function resolveStoryDefinitionForSend(
  messages: ChatMessage[],
  providedDefinition?: StoryDefinition,
) {
  if (providedDefinition) return providedDefinition;
  return [...messages].reverse().find((message) => (
    message.chatMode === 'story' && message.storyDefinition
  ))?.storyDefinition ?? null;
}

export function shouldRestoreStorySession(
  session: StorySessionState | null,
  definition: StoryDefinition | null,
  hasExplicitDefinition: boolean,
) {
  if (!definition) return false;
  if (hasExplicitDefinition) return true;
  return !session || session.definition.id !== definition.id;
}
