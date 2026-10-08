const INSTALL_PROGRESS_CHANNEL = 'desktop-pet:gpt-sovits-install-progress';

// Registered on the trusted (sender-guarded) ipcMain; failures resolve to a health-shaped object
// so the renderer never sees Electron's "Error invoking remote method" wrapper or stack traces.
function registerGptSovitsIpcHandlers({ gptSovitsService, ipcMain, log = () => undefined }) {
  const handle = (channel, handler, fallbackError) => {
    ipcMain.handle(channel, async (event, request) => {
      try {
        return await handler(request ?? {}, event);
      } catch (error) {
        log(`failed ${channel}`, error instanceof Error ? error.message : String(error));
        return { available: false, ok: false, status: 'error', error: error instanceof Error ? error.message : fallbackError };
      }
    });
  };

  handle('desktop-pet:get-gpt-sovits-health', (settings) => gptSovitsService.getHealth(settings), 'GPT-SoVITS 状态检测失败。');
  handle('desktop-pet:start-gpt-sovits-service', (settings) => gptSovitsService.ensureStarted(settings), 'GPT-SoVITS 服务启动失败。');
  handle('desktop-pet:list-gpt-sovits-models', async () => ({ models: gptSovitsService.listModels() }), '角色音色列表读取失败。');
  handle('desktop-pet:install-gpt-sovits-runtime', (settings, event) => gptSovitsService.installRuntime(settings, {
    onProgress: (progress) => {
      if (event?.sender && !event.sender.isDestroyed()) event.sender.send(INSTALL_PROGRESS_CHANNEL, progress ?? null);
    },
  }), 'GPT-SoVITS 运行环境安装失败。');
}

module.exports = { GPT_SOVITS_INSTALL_PROGRESS_CHANNEL: INSTALL_PROGRESS_CHANNEL, registerGptSovitsIpcHandlers };
