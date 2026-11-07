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
// Since 2026-10-19 the interactive dialogue lives in the chat window, which stays draggable;
// the message area never starts a drag, empty gaps only when clicked directly.
assertIncludes('src/components/ChatWindow.tsx', 'onPointerDown: startWindowDrag,');
assertIncludes('src/components/ChatWindow.tsx', 'if (event.target === event.currentTarget) startWindowDrag(event);');
assertIncludes('src/components/SettingsPanel.tsx', 'onPointerDown={standalone ? standaloneWindowDrag.startWindowDrag : startPanelDrag}');
assertIncludes('src/components/chat/EmbeddedPetChatPanelHeader.tsx', 'onPointerDown={dragDisabled ? undefined : onStartDrag}');
// Since 2026-09-20 the composer does not drag the panel during an interactive dialogue.
assertIncludes('src/components/chat/EmbeddedPetChatPanelConversation.tsx', 'composerProps={isInteractiveDialogue ? undefined : { onPointerDown: onStartDrag }}');

console.log('panel cursor stability smoke passed');
