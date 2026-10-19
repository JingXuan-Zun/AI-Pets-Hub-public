const fs = require('node:fs');
const path = require('node:path');
const { createSensitivePathPolicy } = require('./sensitivePathPolicy.cjs');
const { resolveVoiceRootPath } = require('./localVoiceLibrary.cjs');

// Where to start looking when the user asks about something on the computer: the usual user
// folders, the drives, and this app's own folders (voice packs, speech recognition). Without
// it the character had no starting path and answered “I don't know where” instead of looking.
// Private app data (config, chats) stays excluded, same as for the file tools.

function exists(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

function listDrives() {
  if (process.platform !== 'win32') return ['/'];
  return 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => `${letter}:\\`).filter(exists);
}

function createKnownFoldersService({ app, projectRoot, protectedRoots = [] }) {
  const policy = createSensitivePathPolicy({ extraRoots: protectedRoots });
  const userFolder = (name) => {
    try {
      return app.getPath(name);
    } catch {
      return null;
    }
  };
  const appFolder = () => {
    const portable = process.env.PORTABLE_EXECUTABLE_DIR;
    if (portable) return portable;
    return app.isPackaged ? path.dirname(process.execPath) : projectRoot;
  };

  return {
    list() {
      const voiceRoot = resolveVoiceRootPath({ app, projectRoot });
      const folders = [
        ['桌面', userFolder('desktop')],
        ['下载', userFolder('downloads')],
        ['文档', userFolder('documents')],
        ['图片', userFolder('pictures')],
        ['视频', userFolder('videos')],
        ['音乐', userFolder('music')],
        ['用户主目录', userFolder('home')],
        ['桌宠程序所在文件夹', appFolder()],
        ['语音包（每个子文件夹是一个语音包）', voiceRoot ? path.join(voiceRoot, 'gpt-sovits') : null],
        ['语音识别模型', voiceRoot ? path.join(voiceRoot, 'stt') : null],
      ]
        .filter(([, folder]) => folder && exists(folder))
        .map(([label, folder]) => ({ label, path: path.resolve(folder) }));
      return { drives: listDrives(), folders, ok: true };
    },
    // Opens a folder, or shows a file selected in its folder. Nothing on disk changes.
    async reveal(shell, target) {
      if (typeof target !== 'string' || !path.isAbsolute(target.trim())) throw new Error('需要完整的绝对路径。');
      const resolved = path.resolve(target.trim());
      if (policy.isSensitivePath(resolved)) throw new Error('这个位置存放着私密数据，不能打开。');
      let stat;
      try {
        stat = fs.statSync(resolved);
      } catch {
        throw new Error(`找不到 ${resolved}。`);
      }
      if (stat.isDirectory()) {
        const error = await shell.openPath(resolved);
        if (error) throw new Error(error);
      } else {
        shell.showItemInFolder(resolved);
      }
      return { kind: stat.isDirectory() ? 'directory' : 'file', ok: true, path: resolved };
    },
  };
}

function registerKnownFoldersIpcHandlers({ ipcMain, service, shell }) {
  const handle = (channel, handler) => {
    ipcMain.handle(channel, async (_event, request) => {
      try {
        return await handler(request ?? {});
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error), ok: false };
      }
    });
  };

  handle('desktop-pet:known-folders-list', () => service.list());
  handle('desktop-pet:known-folders-reveal', (request) => service.reveal(shell, request.path));
}

module.exports = { createKnownFoldersService, registerKnownFoldersIpcHandlers };
