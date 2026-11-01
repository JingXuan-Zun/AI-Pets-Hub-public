const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { unzipSync, zipSync } = require('fflate');
const { MANIFEST_FILE, SKILL_FILE, readPluginPackage } = require('./pluginPackageManifest.cjs');

// Installed plugin packages: userData/plugins/<id>/ with a plugin.json each. Installing copies a
// folder (picked by the user, unpacked from a zip, or downloaded from GitHub) there; the version
// it replaces is kept in plugins/.previous/<id> so an update can be undone.

const MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;
const MAX_FILES = 3000;
const SKIPPED_DIRS = new Set(['.git', 'node_modules', '__pycache__', '.venv']);

function copyFolder(source, target) {
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIPPED_DIRS.has(entry.name)) continue;
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) copyFolder(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
}

/** Folders (up to three levels down) that hold a plugin.json or a SKILL.md. */
function findPackageFolders(root, depth = 0) {
  if (fs.existsSync(path.join(root, MANIFEST_FILE)) || fs.existsSync(path.join(root, SKILL_FILE))) return [root];
  if (depth >= 3) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !SKIPPED_DIRS.has(entry.name))
    .flatMap((entry) => findPackageFolders(path.join(root, entry.name), depth + 1));
}

/** https://github.com/owner/repo[/tree/<ref>/<sub/path>] → zip address and the sub folder. */
function parseGitHubUrl(input) {
  let url;
  try {
    url = new URL(String(input ?? '').trim());
  } catch {
    return null;
  }
  if (url.hostname !== 'github.com') return null;
  const [owner, repo, marker, ref, ...rest] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repo) return null;
  const cleanRepo = repo.replace(/\.git$/u, '');
  const branch = marker === 'tree' && ref ? ref : 'HEAD';
  return {
    subPath: marker === 'tree' ? rest.join('/') : '',
    zipUrl: `https://codeload.github.com/${owner}/${cleanRepo}/zip/${encodeURIComponent(branch)}`,
  };
}

function extractZip(bytes, target) {
  const files = unzipSync(bytes);
  const names = Object.keys(files);
  if (names.length > MAX_FILES) throw new Error(`压缩包里文件太多（${names.length} 个），不像一个插件。`);
  for (const name of names) {
    const normalized = path.normalize(name);
    if (path.isAbsolute(normalized) || normalized.split(/[\\/]/u).includes('..')) continue; // zip-slip
    if (normalized.split(/[\\/]/u).some((part) => SKIPPED_DIRS.has(part))) continue;
    const destination = path.join(target, normalized);
    if (name.endsWith('/')) fs.mkdirSync(destination, { recursive: true });
    else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, files[name]);
    }
  }
}

function createPluginPackageService({ userDataPath, trashItem, fetchImpl = globalThis.fetch, log }) {
  const pluginsRoot = path.join(userDataPath, 'plugins');
  const stagingRoot = path.join(pluginsRoot, '.staging');
  const previousRoot = path.join(pluginsRoot, '.previous');
  // Plugins the user makes with their character are written here first, then installed from here.
  const draftsRoot = path.join(userDataPath, 'plugin-drafts');

  function list() {
    if (!fs.existsSync(pluginsRoot)) return [];
    return fs.readdirSync(pluginsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .flatMap((entry) => {
        const folder = path.join(pluginsRoot, entry.name);
        const { manifest, error } = readPluginPackage(folder);
        if (error) log?.('plugin package unreadable', { folder: entry.name, error });
        return manifest ? [{ ...manifest, folder }] : [];
      });
  }

  async function removeFolder(folder) {
    if (!fs.existsSync(folder)) return;
    try {
      await trashItem(folder);
    } catch {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  }

  /** Copies a package folder into place; returns { ok, manifest } or { ok: false, error }. */
  async function installFromFolder(sourceFolder) {
    const { manifest, error } = readPluginPackage(sourceFolder);
    if (!manifest) return { error, ok: false };
    const target = path.join(pluginsRoot, manifest.id);
    if (path.resolve(sourceFolder) === path.resolve(target)) return { error: '这个插件已经装在这里了。', ok: false };
    const previous = path.join(previousRoot, manifest.id);
    if (fs.existsSync(target)) {
      await removeFolder(previous);
      fs.mkdirSync(previousRoot, { recursive: true });
      fs.renameSync(target, previous);
    }
    copyFolder(sourceFolder, target);
    // A bare SKILL.md gets its generated manifest written, so later reads see the same id.
    if (!fs.existsSync(path.join(target, MANIFEST_FILE))) {
      fs.writeFileSync(path.join(target, MANIFEST_FILE), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    }
    log?.('plugin installed', { id: manifest.id, kind: manifest.kind, version: manifest.version });
    return { manifest: { ...manifest, folder: target }, ok: true, replaced: fs.existsSync(previous) };
  }

  async function installFromZipBytes(bytes, subPath = '') {
    if (bytes.byteLength > MAX_ARCHIVE_BYTES) return { error: '压缩包超过 50 MB，不像一个插件。', ok: false };
    const staging = path.join(stagingRoot, `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
    try {
      extractZip(bytes, staging);
      // GitHub zips wrap everything in "<repo>-<ref>/".
      const top = fs.readdirSync(staging, { withFileTypes: true });
      const base = top.length === 1 && top[0].isDirectory() ? path.join(staging, top[0].name) : staging;
      const searchRoot = subPath ? path.join(base, ...subPath.split('/')) : base;
      if (!fs.existsSync(searchRoot)) return { error: `压缩包里没有 ${subPath} 这个文件夹。`, ok: false };
      const folders = findPackageFolders(searchRoot);
      if (!folders.length) return { error: '里面没有找到 plugin.json 或 SKILL.md。', ok: false };
      if (folders.length > 1) {
        return { error: `里面有 ${folders.length} 个插件，请用指向其中一个文件夹的链接（…/tree/分支/文件夹）：${folders.slice(0, 5).map((folder) => path.relative(base, folder) || '.').join('、')}`, ok: false };
      }
      return await installFromFolder(folders[0]);
    } catch (error) {
      return { error: `解压失败：${error.message}`, ok: false };
    } finally {
      fs.rmSync(staging, { recursive: true, force: true });
    }
  }

  async function installFromGitHub(url) {
    const parsed = parseGitHubUrl(url);
    if (!parsed) return { error: '请填 GitHub 上的仓库或文件夹链接，例如 https://github.com/作者/仓库。', ok: false };
    let response;
    try {
      response = await fetchImpl(parsed.zipUrl, { redirect: 'follow' });
    } catch (error) {
      return { error: `下载失败，连不上 GitHub：${error.message}。国内网络可能需要代理。`, ok: false };
    }
    if (!response.ok) return { error: `下载失败（${response.status}）：仓库不存在、是私有的，或分支名不对。`, ok: false };
    return installFromZipBytes(new Uint8Array(await response.arrayBuffer()), parsed.subPath);
  }

  /** Installs a plugin from the online market; the zip must match the catalog's checksum. */
  async function installFromMarket({ url, sha256 }) {
    if (!/^https:\/\//u.test(String(url ?? ''))) return { error: '插件市场地址不对。', ok: false };
    let response;
    try {
      response = await fetchImpl(url);
    } catch (error) {
      return { error: `连不上插件市场：${error.message}`, ok: false };
    }
    if (!response.ok) return { error: response.status === 429 ? '下载太频繁了，过一分钟再试。' : `下载失败（${response.status}）。`, ok: false };
    const bytes = new Uint8Array(await response.arrayBuffer());
    const actual = crypto.createHash('sha256').update(bytes).digest('hex');
    if (sha256 && actual !== sha256) return { error: '下载的文件和市场记录的不一致（可能被篡改或没下完整），没有安装。', ok: false };
    return installFromZipBytes(bytes);
  }

  /** Zips an installed plugin's folder and uploads it to the market, where it waits for review. */
  async function publish({ id, apiUrl }) {
    const folder = path.join(pluginsRoot, String(id ?? ''));
    if (!id || path.dirname(folder) !== pluginsRoot || !fs.existsSync(folder)) return { error: '没有这个插件。', ok: false };
    if (!/^https:\/\//u.test(String(apiUrl ?? ''))) return { error: '插件市场地址不对。', ok: false };
    const files = {};
    const collect = (dir, prefix) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (SKIPPED_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) collect(full, `${prefix}${entry.name}/`);
        else if (entry.isFile()) files[`${prefix}${entry.name}`] = new Uint8Array(fs.readFileSync(full));
      }
    };
    collect(folder, '');
    const zip = zipSync(files, { level: 6 });
    if (zip.byteLength > 10 * 1024 * 1024) return { error: '插件打包后超过 10 MB，不能上传。', ok: false };
    const form = new FormData();
    form.append('file', new Blob([zip], { type: 'application/zip' }), `${id}.zip`);
    let response;
    try {
      response = await fetchImpl(`${apiUrl.replace(/\/+$/u, '')}/plugins`, { body: form, headers: { 'X-Plugin-Upload': '1' }, method: 'POST' });
    } catch (error) {
      return { error: `连不上插件市场：${error.message}`, ok: false };
    }
    const body = await response.json().catch(() => ({}));
    if (response.status === 202) return { ok: true, status: 'pending', uploadId: body.uploadId, version: body.version };
    const reasons = { 422: body.message, 429: '今天上传次数用完了，明天再试。', 503: body.error === 'uploads-paused' ? '插件市场暂停接收上传。' : '插件市场暂时不可用。' };
    return { error: reasons[response.status] || `上传失败（${response.status}）。`, ok: false };
  }

  /**
   * Writes (or updates) a plugin draft: { id, files: { 'relative/path': text } }. Only plain
   * relative paths inside the draft folder; returns the folder for the dev assistant or install.
   */
  function writeDraft({ id, files }) {
    if (!/^[a-z0-9][a-z0-9._-]{1,62}$/u.test(String(id ?? ''))) return { error: '插件 id 只能用小写字母、数字、点、横线和下划线。', ok: false };
    const folder = path.join(draftsRoot, id);
    const entries = Object.entries(files && typeof files === 'object' ? files : {});
    for (const [name, content] of entries) {
      const target = path.resolve(folder, name);
      if (typeof content !== 'string' || !target.startsWith(`${path.resolve(folder)}${path.sep}`)) return { error: `文件名不合格：${name}`, ok: false };
    }
    fs.mkdirSync(folder, { recursive: true });
    for (const [name, content] of entries) {
      const target = path.resolve(folder, name);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, content, 'utf8');
    }
    log?.('plugin draft written', { files: entries.length, id });
    return { folder, ok: true };
  }

  async function uninstall(id) {
    const target = path.join(pluginsRoot, String(id ?? ''));
    if (!id || path.dirname(target) !== pluginsRoot || !fs.existsSync(target)) return { error: '没有这个插件。', ok: false };
    const manifest = readPluginPackage(target).manifest ?? null;
    await removeFolder(target);
    log?.('plugin uninstalled', { id });
    return { manifest, ok: true };
  }

  /** The SKILL.md of an installed skill plugin, for registering it with the skill runtime. */
  function readSkillText(id) {
    const folder = path.join(pluginsRoot, String(id ?? ''));
    if (path.dirname(folder) !== pluginsRoot) return null;
    const { manifest } = readPluginPackage(folder);
    if (manifest?.kind !== 'skill') return null;
    const file = path.join(folder, manifest.skill.file);
    return path.resolve(file).startsWith(path.resolve(folder)) && fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  }

  return { draftsRoot, installFromFolder, installFromGitHub, installFromMarket, installFromZipBytes, list, pluginsRoot, publish, readSkillText, uninstall, writeDraft };
}



// Registered on the trusted (sender-guarded) ipcMain; failures resolve to { ok: false, error }.
function registerPluginPackageIpcHandlers({ ipcMain, service, log = () => undefined }) {
  const handle = (channel, handler) => {
    ipcMain.handle(channel, async (_event, request) => {
      try {
        return await handler(request ?? {});
      } catch (error) {
        log(`failed ${channel}`, error instanceof Error ? error.message : String(error));
        return { error: error instanceof Error ? error.message : '插件操作失败。', ok: false };
      }
    });
  };
  handle('desktop-pet:plugins-list', async () => ({ ok: true, plugins: service.list() }));
  handle('desktop-pet:plugins-install-folder', ({ folder }) => service.installFromFolder(String(folder ?? '')));
  handle('desktop-pet:plugins-install-github', ({ url }) => service.installFromGitHub(url));
  handle('desktop-pet:plugins-uninstall', ({ id }) => service.uninstall(id));
  handle('desktop-pet:plugins-install-market', (request) => service.installFromMarket(request));
  handle('desktop-pet:plugins-publish', (request) => service.publish(request));
  handle('desktop-pet:plugins-write-draft', (request) => service.writeDraft(request));
  handle('desktop-pet:plugins-read-skill', async ({ id }) => {
    const text = service.readSkillText(id);
    return text === null ? { error: '没有这个技能插件。', ok: false } : { ok: true, text };
  });
}
module.exports = { createPluginPackageService, parseGitHubUrl, registerPluginPackageIpcHandlers };
