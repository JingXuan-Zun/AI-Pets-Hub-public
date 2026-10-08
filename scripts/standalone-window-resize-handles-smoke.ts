import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

function assertIncludes(source: string, expected: string, message: string) {
  assert.ok(source.includes(expected), message);
}

function assertNotIncludes(source: string, unexpected: string, message: string) {
  assert.ok(!source.includes(unexpected), message);
}

const {
  standaloneWindowHandlesSource,
  windowFrameControlsSource,
  chatWindowSource,
  chatAutoScrollSource,
  embeddedChatHeaderSource,
  embeddedChatSurfaceSource,
  embeddedChatPanelSource,
  settingsPanelSource,
  standaloneWindowFrameSource,
  desktopShellRuntimeSource,
  desktopShellBridgeSource,
  viteEnvSource,
  preloadSource,
  ipcHandlersSource,
  standaloneWindowDragSource,
  windowManagerSource,
} = readProjectSources({
  standaloneWindowHandlesSource: 'src/components/StandaloneWindowResizeHandles.tsx',
  windowFrameControlsSource: 'src/components/WindowFrameControls.tsx',
  chatWindowSource: 'src/components/ChatWindow.tsx',
  chatAutoScrollSource: 'src/components/chat/usePetChatConversationAutoScroll.ts',
  embeddedChatHeaderSource: 'src/components/chat/EmbeddedPetChatPanelHeader.tsx',
  embeddedChatSurfaceSource: 'src/components/chat/EmbeddedPetChatPanelSurface.tsx',
  embeddedChatPanelSource: 'src/components/chat/EmbeddedPetChatPanel.tsx',
  settingsPanelSource: 'src/components/SettingsPanel.tsx',
  standaloneWindowFrameSource: 'src/standaloneWindowFrame.ts',
  desktopShellRuntimeSource: 'src/desktopShellRuntime.ts',
  desktopShellBridgeSource: 'src/desktopShellBridge.ts',
  viteEnvSource: 'src/vite-env.d.ts',
  preloadSource: 'electron/preload.cjs',
  ipcHandlersSource: 'electron/ipcHandlers.cjs',
  standaloneWindowDragSource: 'src/standaloneWindowDrag.ts',
  windowManagerSource: 'electron/windowManager.cjs',
});

assertIncludes(
  windowFrameControlsSource,
  'ChevronDown, ChevronUp, Copy, Minus, Square, X',
  'shared window frame controls should render collapse/expand for embedded panels and minimize/maximize/close for windows',
);
assertIncludes(
  windowFrameControlsSource,
  'inline-flex h-10 w-12 items-center justify-center rounded-none',
  'window frame controls should use visible titlebar-style hit targets instead of small round icon buttons',
);
assertIncludes(
  windowFrameControlsSource,
  'export function WindowCompactHandle',
  'shared window frame controls should provide the visible compact square expand handle',
);
assertIncludes(
  windowFrameControlsSource,
  "WebkitAppRegion: 'no-drag'",
  'compact square expand handle should opt out of Electron drag regions',
);
assertIncludes(
  windowFrameControlsSource,
  'buttonClassName',
  'shared window frame controls should allow scoped panel color overrides',
);
assertIncludes(
  windowFrameControlsSource,
  'closeButtonClassName',
  'shared window frame controls should allow overriding the close button color per panel',
);
assertIncludes(
  windowFrameControlsSource,
  'closeDangerHover',
  'shared window frame controls should allow disabling red close hover per panel',
);
['Minus', 'Square', 'Copy', 'onToggleMaximize', 'isMaximized'].forEach((expected) => {
  assertIncludes(
    windowFrameControlsSource,
    expected,
    `shared window frame controls should provide standard window control token ${expected}`,
  );
});
assertIncludes(
  standaloneWindowHandlesSource,
  "WebkitAppRegion: 'no-drag'",
  'standalone window resize handles should opt out of Electron drag regions',
);
assertIncludes(
  standaloneWindowHandlesSource,
  'pointer-events-none absolute inset-0 z-[120] select-none',
  'standalone window resize handles should stay inside the original window frame',
);
assertIncludes(
  standaloneWindowHandlesSource,
  'left-[12px] right-[12px] top-0 h-[12px] touch-none cursor-ns-resize',
  'standalone window top edge should align with the 12px top corner handles to avoid cursor flicker gaps',
);
assertIncludes(
  standaloneWindowHandlesSource,
  'bottom-0 left-[12px] right-[12px] h-[8px] touch-none cursor-ns-resize',
  'standalone window bottom edge should leave the corner hit zones unshared',
);
assertIncludes(
  standaloneWindowHandlesSource,
  'bottom-[12px] left-0 top-[12px] w-[8px] touch-none cursor-ew-resize',
  'standalone window left edge should avoid overlapping the top and bottom corners',
);
assertIncludes(
  standaloneWindowHandlesSource,
  'bottom-[12px] right-0 top-[12px] w-[8px] touch-none cursor-ew-resize',
  'standalone window right edge should avoid overlapping the top and bottom corners',
);
assertIncludes(
  standaloneWindowHandlesSource,
  'left-0 top-0 h-[12px] w-[12px] touch-none cursor-nwse-resize',
  'standalone window top-left corner should restore the original corner hit target',
);
assertIncludes(
  standaloneWindowHandlesSource,
  'right-0 top-0 h-[12px] w-[12px] touch-none cursor-nesw-resize',
  'standalone window top-right corner should restore the original corner hit target',
);
assertIncludes(
  standaloneWindowDragSource,
  'desktopPetShellRuntime.setCurrentWindowBounds({',
  'standalone window drag hook should move the current window through the desktop shell bridge',
);
assertIncludes(
  standaloneWindowDragSource,
  'startScreenX: event.screenX',
  'standalone window drag hook should anchor dragging to screen coordinates',
);
assertIncludes(
  standaloneWindowFrameSource,
  'desktopPetShellRuntime.minimizeCurrentWindow();',
  'standalone window frame hook should minimize the OS window',
);
assertIncludes(
  standaloneWindowFrameSource,
  'desktopPetShellRuntime.toggleMaximizeCurrentWindow()',
  'standalone window frame hook should toggle maximize through the desktop shell',
);
assertIncludes(
  chatWindowSource,
  'const { isDragging, startWindowDrag } = useStandaloneWindowDrag({',
  'chat window should use the standalone window drag hook instead of Electron app-region drag',
);
assertIncludes(
  chatWindowSource,
  'onPointerDown={isInteractiveDialogue ? undefined : startWindowDrag}',
  'chat window should route standalone pointer drag through the current-window move hook',
);
assertIncludes(
  chatWindowSource,
  '<WindowFrameControls',
  'chat window should render visible titlebar-style frame controls',
);
assertIncludes(
  chatWindowSource,
  'useStandaloneWindowFrame({',
  'chat window should use standard window minimize/maximize controls',
);
assertIncludes(
  chatWindowSource,
  "const isInteractiveDialogue = interactiveDialogueActive && chatMode === 'single';",
  'only single-chat interactive dialogue should disable standalone window dragging',
);
assertIncludes(
  chatAutoScrollSource,
  'shouldStickToBottomRef.current = true;',
  'restored chat history should reset to follow the latest message instead of treating mount-at-top as manual scrolling',
);
assertIncludes(
  chatAutoScrollSource,
  'scrollViewportToLatest(viewport);',
  'restored chat history should actively scroll to the latest message after layout commits',
);
assertIncludes(
  chatWindowSource,
  'onMinimize={minimizeWindow}',
  'chat window minimize control should minimize the OS window',
);
assertIncludes(
  chatWindowSource,
  'onToggleMaximize={isInteractiveDialogue ? undefined : toggleMaximizeWindow}',
  'chat window should offer maximize/restore outside interactive dialogue',
);
[
  'useStandaloneWindowCompactFrame',
  'WindowCompactHandle',
  'CHAT_WINDOW_EXPAND_TITLE',
].forEach((unexpected) => {
  assertNotIncludes(
    chatWindowSource,
    unexpected,
    `chat window should no longer keep compact-frame token ${unexpected}`,
  );
});
assertIncludes(
  settingsPanelSource,
  'const standaloneWindowDrag = useStandaloneWindowDrag({',
  'settings window should use the standalone window drag hook instead of Electron app-region drag',
);
assertIncludes(
  settingsPanelSource,
  'onPointerDown={standalone ? standaloneWindowDrag.startWindowDrag : startPanelDrag}',
  'settings window should route standalone pointer drag through the current-window move hook',
);
assertIncludes(
  settingsPanelSource,
  '<WindowFrameControls',
  'settings window should render visible titlebar-style frame controls',
);
assertIncludes(
  settingsPanelSource,
  'useStandaloneWindowFrame({ enabled: standalone })',
  'settings window should use standard window minimize/maximize controls',
);
assertIncludes(
  settingsPanelSource,
  'standaloneWindowFrame.minimizeWindow();',
  'standalone settings minimize control should minimize the OS window',
);
assertIncludes(
  settingsPanelSource,
  'isEmbeddedMinimized',
  'embedded settings panel should keep local minimized frame state',
);
assertIncludes(
  settingsPanelSource,
  'EMBEDDED_SETTINGS_COMPACT_WIDTH = 56',
  'embedded settings minimized state should shrink to a small square width',
);
assertIncludes(
  settingsPanelSource,
  'EMBEDDED_SETTINGS_COMPACT_HEIGHT = 48',
  'embedded settings minimized state should shrink to a small square height',
);
assertIncludes(
  settingsPanelSource,
  'SETTINGS_FRAME_CONTROL_BUTTON_CLASS',
  'settings panel should define a control-center-colored frame control theme',
);
assertIncludes(
  settingsPanelSource,
  'SETTINGS_FRAME_CONTROL_CLOSE_BUTTON_CLASS',
  'settings panel close control should use the control-center theme instead of the red close hover',
);
assertIncludes(
  settingsPanelSource,
  'buttonClassName={SETTINGS_FRAME_CONTROL_BUTTON_CLASS}',
  'settings panel should apply the control-center color to collapse and close controls',
);
assertIncludes(
  settingsPanelSource,
  'closeButtonClassName={SETTINGS_FRAME_CONTROL_CLOSE_BUTTON_CLASS}',
  'settings panel should override close hover color to match the control-center theme',
);
assertIncludes(
  settingsPanelSource,
  'closeDangerHover={false}',
  'settings panel should disable the default red close hover',
);
assertIncludes(
  settingsPanelSource,
  'onToggleMaximize={standalone ? standaloneWindowFrame.toggleMaximizeWindow : undefined}',
  'standalone settings window should offer maximize/restore',
);
assertNotIncludes(
  settingsPanelSource,
  'useStandaloneWindowCompactFrame',
  'standalone settings window should no longer collapse into a compact square',
);
assertIncludes(
  embeddedChatHeaderSource,
  "minimizeTitle={isMinimized ? '展开聊天面板' : '收纳聊天面板'}",
  'embedded chat header should expose a local collapse/expand control',
);
assert.match(
  embeddedChatSurfaceSource,
  /<WindowCompactHandle\s+title="展开聊天面板"[\s\S]*?onExpand=\{onToggleMinimized\}\s*\/>/u,
  'embedded chat minimized state should render the compact square expand handle',
);
assertIncludes(
  embeddedChatSurfaceSource,
  'onStartDrag={dragDisabled ? undefined : (event) => onStartDrag(event, { allowControl: true })}',
  'embedded chat compact handle should delegate dragging while preserving the disabled guard and control allowance',
);
assertIncludes(
  embeddedChatSurfaceSource,
  'EMBEDDED_CHAT_COMPACT_WIDTH = 56',
  'embedded chat minimized state should shrink to a small square width',
);
assertIncludes(
  embeddedChatSurfaceSource,
  'EMBEDDED_CHAT_COMPACT_HEIGHT = 48',
  'embedded chat minimized state should shrink to a small square height',
);
assertIncludes(
  embeddedChatSurfaceSource,
  '<EmbeddedPetChatPanelResizeHandles onStartResize={onStartResize} />',
  'embedded chat resize handles should render in normal state',
);
[
  embeddedChatHeaderSource,
  embeddedChatSurfaceSource,
  embeddedChatPanelSource,
].forEach((source, index) => {
  [
    'isMaximized',
    'onToggleMaximized',
    'maximizeTitle',
    'restoreTitle',
    'maximized',
    '最大化',
    '还原',
  ].forEach((unexpected) => {
    assertNotIncludes(
      source,
      unexpected,
      `embedded chat source ${index} should not keep maximize token ${unexpected}`,
    );
  });
});
assertIncludes(
  preloadSource,
  "ipcRenderer.send('desktop-pet:minimize-current-window')",
  'preload should expose the current-window minimize IPC channel',
);
assertIncludes(
  preloadSource,
  "ipcRenderer.invoke('desktop-pet:toggle-maximize-current-window')",
  'preload should expose the current-window maximize/restore IPC channel',
);
assertIncludes(
  ipcHandlersSource,
  "ipcMain.on('desktop-pet:minimize-current-window'",
  'main process should handle current-window minimize requests',
);
assertIncludes(
  ipcHandlersSource,
  "ipcMain.handle('desktop-pet:toggle-maximize-current-window'",
  'main process should handle current-window maximize/restore requests',
);
assertIncludes(
  ipcHandlersSource,
  'createWindowMaximizeToggle({ screen })',
  'maximize should fill the display work area through the shared toggle module',
);
assertIncludes(
  desktopShellRuntimeSource,
  'toggleMaximizeCurrentWindow',
  'desktop shell runtime should publish the maximize/restore control',
);
assertIncludes(
  desktopShellBridgeSource,
  'toggleMaximizeCurrentWindow',
  'desktop shell bridge should publish the maximize/restore control',
);
assertIncludes(
  viteEnvSource,
  'toggleMaximizeCurrentWindow?: () => Promise<boolean>;',
  'renderer shell type should include the maximize/restore control',
);
assertIncludes(
  chatWindowSource,
  'relative flex h-screen w-screen min-h-0 flex-col overflow-hidden',
  'chat window should keep the original single-shell layout',
);
assertIncludes(windowFrameControlsSource, 'onPointerDownCapture={handlePointerDownCapture}', 'compact handles should capture pointerdown before stopping bubbling');
assertIncludes(windowFrameControlsSource, 'onStartDrag?.(event);', 'compact handles should forward pointerdown to the current drag delegate');
assert.match(windowFrameControlsSource, /if \(gesture\?\.moved\)\s*\{[\s\S]*return;\s*\}\s*onExpand\(\);/u, 'dragging a compact handle should not also expand it');
assertIncludes(
  settingsPanelSource,
  '<StandaloneWindowResizeHandles onStartResize={standaloneWindowResize.startWindowResize} />',
  'standalone settings window should keep the original inline resize handles',
);
assertNotIncludes(
  settingsPanelSource,
  'maxHeight: 1248',
  'standalone settings resize hook should not impose a fixed height ceiling',
);
assertNotIncludes(
  settingsPanelSource,
  'maxWidth: 1680',
  'standalone settings resize hook should not impose a fixed width ceiling',
);
assertNotIncludes(
  windowManagerSource,
  'maxWidth: SETTINGS_PANEL_WINDOW_BOUNDS.maxWidth',
  'settings window should not pass a fixed native width ceiling',
);
assertNotIncludes(
  windowManagerSource,
  'maxHeight: SETTINGS_PANEL_WINDOW_BOUNDS.maxHeight',
  'settings window should not pass a fixed native height ceiling',
);

assertIncludes(
  standaloneWindowDragSource,
  'desktopPetShellRuntime.restoreMaximizedWindowForDrag({',
  'dragging a maximized window should restore it to its normal size under the cursor',
);
assertIncludes(
  ipcHandlersSource,
  "ipcMain.handle('desktop-pet:restore-maximized-window-for-drag'",
  'main process should restore a maximized window when a drag starts',
);
assert.match(
  chatWindowSource,
  /useStandaloneWindowDrag\(\{[\s\S]*?isMaximized,\s*\}\);/u,
  'chat window drag should know whether the window is maximized',
);

console.log('standalone window resize handles smoke ok');
