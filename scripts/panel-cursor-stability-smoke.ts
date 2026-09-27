import { readProjectFile } from './smokeTestHarness.ts';

function assertNoGrabCursor(relativePath: string) {
  const source = readProjectFile(relativePath);
  if (source.includes('cursor-grab') || source.includes('cursor-grabbing')) {
    throw new Error(`${relativePath} should not set grab/grabbing cursor on panel-level drag surfaces.`);
  }
}

function assertIncludes(relativePath: string, expected: string) {
  const source = readProjectFile(relativePath);
  if (!source.includes(expected)) {
    throw new Error(`${relativePath} should still include ${expected}`);
  }
}

for (const relativePath of [
  'src/components/ChatWindow.tsx',
  'src/components/SettingsPanel.tsx',
  'src/components/chat/EmbeddedPetChatPanelHeader.tsx',
  'src/components/chat/EmbeddedPetChatPanelConversation.tsx',
]) {
  assertNoGrabCursor(relativePath);
}

assertIncludes('src/index.css', 'cursor: default;');
assertIncludes('src/index.css', 'input:not([type]),');
assertIncludes('src/index.css', 'input[type="text"],');
assertIncludes('src/index.css', 'textarea,');
assertIncludes('src/index.css', '[contenteditable="true"],');
assertIncludes('src/index.css', '[role="textbox"]');
assertIncludes('components/ui/input.tsx', 'cursor-text');
assertIncludes('src/components/ChatWindow.tsx', 'onPointerDown={interactiveDialogueActive ? undefined : startWindowDrag}');
assertIncludes('src/components/SettingsPanel.tsx', 'onPointerDown={standalone ? standaloneWindowDrag.startWindowDrag : startPanelDrag}');
assertIncludes('src/components/chat/EmbeddedPetChatPanelHeader.tsx', 'onPointerDown={dragDisabled ? undefined : onStartDrag}');
assertIncludes('src/components/chat/EmbeddedPetChatPanelConversation.tsx', 'composerProps={{ onPointerDown: onStartDrag }}');

console.log('panel cursor stability smoke passed');
