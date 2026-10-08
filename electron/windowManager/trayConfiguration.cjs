const { createSettingsWindowControls } = require('./auxiliaryWindowControls.cjs');
function createTrayConfigurator({
  getTray, getMainWindow, markQuitting, Menu, app,
  showMainWindow, openSettingsWindow, hideMainWindow,
}) {
  return function configureTray() {
    getTray().setToolTip('AI Desktop Pet');
    const trayMenuTemplate = [
      {
        label: '\u663e\u793a\u5ba0\u7269',
        click: () => showMainWindow(),
      },
      {
        label: '\u6253\u5f00\u8bbe\u7f6e',
        click: () => openSettingsWindow(),
      },
      {
        label: '\u9690\u85cf\u5230\u540e\u53f0',
        click: () => hideMainWindow(),
      },
      { type: 'separator' },
      {
        label: '\u9000\u51fa',
        click: () => {
          markQuitting();
          app.quit();
        },
      },
    ];
    getTray().setContextMenu(Menu.buildFromTemplate(trayMenuTemplate));
    getTray().on('double-click', () => {
      if (!getMainWindow()) {
        return;
      }
      if (getMainWindow().isVisible()) {
        hideMainWindow();
        return;
      }
      showMainWindow();
    });
  };
}
function createSettingsTrayControllers({
  managerState, ensureSettingsWindowReady, showSettingsWindow, reportOpenSettingsError,
  windowOwnershipState, Menu, app, showMainWindow, hideMainWindow,
}) {
  const { closeSettingsWindow, openSettingsWindow } = createSettingsWindowControls({
    getSettingsWindow: () => managerState.settingsWindow, ensureSettingsWindowReady,
    showSettingsWindow, reportOpenSettingsError,
  });
  const configureTray = createTrayConfigurator({
    ...windowOwnershipState.trayOwnership, Menu, app,
    showMainWindow, openSettingsWindow, hideMainWindow,
  });
  return { closeSettingsWindow, openSettingsWindow, configureTray };
}

module.exports = { createTrayConfigurator, createSettingsTrayControllers };
