import type { DesktopPetChatMode } from '../../types';

export function createChatRequestScope(chatMode: DesktopPetChatMode, petId?: string | null, storyId?: string | null) {
  if (chatMode === 'single') return `single:${petId?.trim() || 'primary'}`;
  if (chatMode === 'story') return `story:${storyId?.trim() || 'active'}`;
  return 'group';
}

export class ChatRequestScopeRegistry {
  private readonly tokens = new Map<string, number>();

  begin(scope: string) {
    const token = (this.tokens.get(scope) ?? 0) + 1;
    this.tokens.set(scope, token);
    return token;
  }

  cancel(scope: string) {
    this.tokens.set(scope, (this.tokens.get(scope) ?? 0) + 1);
  }

  isCurrent(scope: string, token: number) {
    return this.tokens.get(scope) === token;
  }
}
