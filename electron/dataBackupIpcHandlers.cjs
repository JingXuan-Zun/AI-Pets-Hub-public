const fs = require('node:fs/promises');
const path = require('node:path');

// Private-data backups the character makes from chat (“帮我备份一下”), kept in one folder inside
// the app's data directory. The page builds the backup (keys already removed); this side only
// writes, lists, reads and opens files in that folder, by bare file name.

const BACKUP_NAME_PATTERN = /^desktop-pet-backup-\d{8}-\d{6}(?:-\d+)?\.json$/u;
const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
const MAX_LISTED_BACKUPS = 30;

function pad(value) {
  return String(value).padStart(2, '0');
}

function backupFileName(date, attempt) {
  const stamp = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `desktop-pet-backup-${stamp}${attempt ? `-${attempt}` : ''}.json`;
}

function createDataBackupService({ backupDirectory }) {
  const resolveBackupPath = (name) => {
    if (typeof name !== 'string' || !BACKUP_NAME_PATTERN.test(name)) throw new Error('备份文件名无效。');
    return path.join(backupDirectory, name);
  };

  return {
    directory: backupDirectory,
    async save(text) {
      if (typeof text !== 'string' || !text.trim()) throw new Error('备份内容为空。');
      if (Buffer.byteLength(text, 'utf8') > MAX_BACKUP_BYTES) throw new Error('备份太大了。');
      JSON.parse(text);
      await fs.mkdir(backupDirectory, { recursive: true });
      const now = new Date();
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const name = backupFileName(now, attempt);
        try {
          await fs.writeFile(path.join(backupDirectory, name), text, { encoding: 'utf8', flag: 'wx' });
          return { name, ok: true, sizeBytes: Buffer.byteLength(text, 'utf8') };
        } catch (error) {
          if (error?.code !== 'EEXIST') throw error;
        }
      }
      throw new Error('无法创建备份文件。');
    },
    async list() {
      let names = [];
      try {
        names = (await fs.readdir(backupDirectory)).filter((name) => BACKUP_NAME_PATTERN.test(name));
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      const entries = await Promise.all(names.map(async (name) => {
        const stat = await fs.stat(path.join(backupDirectory, name));
        return { modifiedAt: stat.mtime.toISOString(), name, sizeBytes: stat.size };
      }));
      entries.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
      return { backups: entries.slice(0, MAX_LISTED_BACKUPS), ok: true };
    },
    async read(name) {
      const filePath = resolveBackupPath(name);
      const stat = await fs.stat(filePath);
      if (stat.size > MAX_BACKUP_BYTES) throw new Error('备份太大了。');
      return { ok: true, text: await fs.readFile(filePath, 'utf8') };
    },
  };
}

function registerDataBackupIpcHandlers({ ipcMain, service, shell }) {
  const handle = (channel, handler) => {
    ipcMain.handle(channel, async (_event, request) => {
      try {
        return await handler(request ?? {});
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error), ok: false };
      }
    });
  };

  handle('desktop-pet:data-backup-save', (request) => service.save(request.text));
  handle('desktop-pet:data-backup-list', () => service.list());
  handle('desktop-pet:data-backup-read', (request) => service.read(request.name));
  handle('desktop-pet:data-backup-open-folder', async () => {
    await fs.mkdir(service.directory, { recursive: true });
    const error = await shell.openPath(service.directory);
    if (error) throw new Error(error);
    return { ok: true };
  });
}

module.exports = { BACKUP_NAME_PATTERN, createDataBackupService, registerDataBackupIpcHandlers };
