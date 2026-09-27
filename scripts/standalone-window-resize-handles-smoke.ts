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
  standaloneWindowCompactFrameSource,
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
  standaloneWindowCompactFrameSource: 'src/standaloneWindowCompactFrame.ts',
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
  'ChevronDown, ChevronUp, X',
  'shared window frame controls should render collapse/expand and close icons only',
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
[
  'Copy',
  'Square',
  'isMaximized',
  'maximizeTitle',
  'restoreTitle',
  'onToggleMaximize',
].forEach((unexpected) => {
  assertNotIncludes(
    windowFrameControlsSource,
    unexpected,
    `shared window frame controls should not keep maximize UI token ${unexpected}`,
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
  standaloneWindowCompactFrameSource,
  'STANDALONE_WINDOW_COMPACT_WIDTH = 56',
  'standalone compact frame hook should use the shared compact square width',
);
assertIncludes(
  standaloneWindowCompactFrameSource,
  'STANDALONE_WINDOW_COMPACT_HEIGHT = 48',
  'standalone compact frame hook should use the shared compact square height',
);
assertIncludes(
  standaloneWindowCompactFrameSource,
  'restoreBoundsRef',
  'standalone compact frame hook should preserve restore bounds',
);
assertIncludes(
  standaloneWindowCompactFrameSource,
  'desktopPetShellRuntime.setCurrentWindowBounds({',
  'standalone compact frame hook should resize the current window instead of minimizing it',
);
assertIncludes(
  chatWindowSource,
  'const { isDragging, startWindowDrag } = useStandaloneWindowDrag({',
  'chat window should use the standalone window drag hook instead of Electron app-region drag',
);
assertIncludes(
  chatWindowSource,
  'onPointerDown={interactiveDialogueActive ? undefined : startWindowDrag}',
  'chat window should route standalone pointer drag through the current-window move hook',
);
assertIncludes(
  chatWindowSource,
  '<WindowFrameControls',
  'chat window should render visible titlebar-style frame controls',
);
assertIncludes(
  chatWindowSource,
  'useStandaloneWindowCompactFrame',
  'chat window should use local compact state instead of OS minimize',
);
assertIncludes(
  chatWindowSource,
  '<WindowCompactHandle title={CHAT_WINDOW_EXPAND_TITLE} onExpand={restoreWindow} />',
  'chat window should render a visible square expand handle while compacted',
);
assertIncludes(
  chatWindowSource,
  'onPointerDown={interactiveDialogueActive ? undefined : startWindowDrag}',
  'compacted chat window should keep an empty drag surface around its expand handle',
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
  'compactWindow();',
  'chat window minimize control should compact the current window',
);
[
  'desktopPetShellRuntime.minimizeCurrentWindow();',
  'toggleCurrentWindowMaximized',
  'isWindowMaximized',
  'CHAT_WINDOW_MAXIMIZE_TITLE',
  'CHAT_WINDOW_RESTORE_TITLE',
  'maximizeTitle',
  'restoreTitle',
].forEach((unexpected) => {
  assertNotIncludes(
    chatWindowSource,
    unexpected,
    `chat window should not keep maximize/minimize-to-system token ${unexpected}`,
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
  'useStandaloneWindowCompactFrame',
  'settings window should use local compact state instead of OS minimize',
);
assertIncludes(
  settingsPanelSource,
  'onExpand={restoreStandaloneWindow}',
  'standalone settings window should render a visible square expand handle while compacted',
);
assertIncludes(
  settingsPanelSource,
  'compactStandaloneWindow();',
  'settings window minimize control should compact the current window',
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
  'SETTINGS_COMPACT_HANDLE_CLASS',
  'settings compact square should use the control-center color theme',
);
[
  'desktopPetShellRuntime.minimizeCurrentWindow();',
  'toggleCurrentWindowMaximized',
  'isStandaloneMaximized',
  'isEmbeddedMaximized',
  'isFrameMaximized',
  'EMBEDDED_SETTINGS_MAXIMIZED_INSET',
  'maximizeTitle',
  'restoreTitle',
  'maximized',
  '最大化',
  '还原',
].forEach((unexpected) => {
  assertNotIncludes(
    settingsPanelSource,
    unexpected,
    `settings panel should not keep maximize/minimize-to-system token ${unexpected}`,
  );
});
assertIncludes(
  embeddedChatHeaderSource,
  "minimizeTitle={isMinimized ? '展开聊天面板' : '收纳聊天面板'}",
  'embedded chat header should expose a local collapse/expand control',
);
assertIncludes(
  embeddedChatSurfaceSource,
  '<WindowCompactHandle title="展开聊天面板" onExpand={onToggleMinimized} />',
  'embedded chat minimized state should render the compact square expand handle',
);
assertIncludes(
  embeddedChatSurfaceSource,
  'onPointerDown={dragDisabled ? undefined : onStartDrag}',
  'embedded chat compact frame should allow dragging from its empty surface',
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
  'preload should keep the current-window minimize IPC channel for non-compact callers',
);
assertNotIncludes(
  preloadSource,
  'toggleCurrentWindowMaximized',
  'preload should not expose current-window maximize IPC after removing the UI',
);
assertIncludes(
  ipcHandlersSource,
  "ipcMain.on('desktop-pet:minimize-current-window'",
  'main process should keep current-window minimize requests for non-compact callers',
);
assertIncludes(
  ipcHandlersSource,
  'currentWindowOriginalMinimumSize',
  'main process should remember original minimum size while a window is compacted',
);
assertIncludes(
  ipcHandlersSource,
  'targetWindow.setMinimumSize(',
  'main process should temporarily lower minimum size for compacted windows',
);
assertNotIncludes(
  ipcHandlersSource,
  'toggle-current-window-maximized',
  'main process should not keep current-window maximize handler after removing the UI',
);
assertIncludes(
  windowManagerSource,
  'isCurrentWindowCompactMinimumSizeActive',
  'window manager should not re-apply normal chat constraints while compacted',
);
assertNotIncludes(
  desktopShellRuntimeSource,
  'toggleCurrentWindowMaximized',
  'desktop shell runtime should not publish maximize/restore controls',
);
assertNotIncludes(
  desktopShellBridgeSource,
  'toggleCurrentWindowMaximized',
  'desktop shell bridge should not publish maximize/restore controls',
);
assertNotIncludes(
  viteEnvSource,
  'toggleCurrentWindowMaximized',
  'renderer shell type should not include maximize/restore controls',
);
assertIncludes(
  chatWindowSource,
  'relative flex h-screen w-screen min-h-0 flex-col overflow-hidden border border-sky-100 bg-white text-sky-900',
  'chat window should keep the original single-shell layout',
);
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

console.log('standalone window resize handles smoke ok');
