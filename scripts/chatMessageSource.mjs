import { readModuleProjectFile } from './projectModuleSource.mjs';
export { readModuleProjectFile as readMessageProjectFile, readModuleProjectSources as readMessageProjectSources } from './projectModuleSource.mjs';
export function readChatMessageSource() { return readModuleProjectFile('src/components/chat/PetChatConversationMessageBubble.tsx'); }
