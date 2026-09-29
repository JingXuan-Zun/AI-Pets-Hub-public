import { createEmptyStoryDefinition, createStorySession } from '../src/components/chat/story/storyDefaults';

export function createEmptyStorySessionForSmoke() {
  const definition = createEmptyStoryDefinition(['primary'], 'random');
  definition.title = '测试故事';
  definition.premise = '测试旁白生成';
  return createStorySession(definition);
}
