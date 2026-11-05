// Saving or copying a picture shown in the chat (drawn by ComfyUI, sent from QQ…), from the
// right-click menu on it. The page cannot open a save dialog or write the clipboard image itself.

const fs = require('node:fs');
const path = require('node:path');

const MAX_BYTES = 40 * 1024 * 1024;
const EXTENSIONS = { 'image/gif': 'gif', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function decodeDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/iu.exec(String(dataUrl || ''));
  if (!match) throw new Error('不是图片');
  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length || bytes.length > MAX_BYTES) throw new Error('图片太大或是空的');
  return { bytes, mimeType: match[1].toLowerCase() };
}

/** A file name without characters Windows refuses, ending in the picture's real type. */
function suggestedName(name, mimeType) {
  const extension = EXTENSIONS[mimeType] || 'png';
  const base = String(name || '').replace(/\.[a-z0-9]{2,5}$/iu, '').replace(/[\\/:*?"<>|]/gu, '_').trim() || `图片-${Date.now()}`;
  return `${base}.${extension}`;
}

function registerChatImageSaveIpcHandlers({ BrowserWindow, app, clipboard, dialog, ipcMain, nativeImage }) {
  ipcMain.handle('desktop-pet:chat-image-save', async (event, request) => {
    try {
      const { bytes, mimeType } = decodeDataUrl(request?.dataUrl);
      const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
      const result = await dialog.showSaveDialog(owner, {
        defaultPath: path.join(app.getPath('pictures'), suggestedName(request?.name, mimeType)),
        filters: [{ extensions: [EXTENSIONS[mimeType] || 'png'], name: '图片' }],
        title: '保存图片',
      });
      if (result.canceled || !result.filePath) return { canceled: true, ok: false };
      fs.writeFileSync(result.filePath, bytes);
      return { ok: true, path: result.filePath };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  });
  ipcMain.handle('desktop-pet:chat-image-copy', (_event, request) => {
    try {
      decodeDataUrl(request?.dataUrl);
      const image = nativeImage.createFromDataURL(request.dataUrl);
      if (image.isEmpty()) throw new Error('这张图复制不了');
      clipboard.writeImage(image);
      return { ok: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  });
}

module.exports = { registerChatImageSaveIpcHandlers, suggestedName };
