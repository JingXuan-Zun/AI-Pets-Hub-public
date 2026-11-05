// A look at a GitHub link before anything is installed: the few files that tell what the plugin
// is (plugin.json, SKILL.md, the README with an MCP setup, package.json), read straight from
// GitHub without downloading the repository. The renderer decides what kind it is.

const MAX_TEXT = 60_000;
const FILES = { packageJson: 'package.json', pluginJson: 'plugin.json', readme: 'README.md', skillMd: 'SKILL.md' };
const README_FALLBACKS = ['readme.md', 'Readme.md', 'README.MD', 'README'];

/** https://github.com/owner/repo[/tree/<ref>/<sub/path>] → its parts, or null. */
function parseGitHubLink(input) {
  let url;
  try {
    url = new URL(String(input ?? '').trim());
  } catch {
    return null;
  }
  if (url.hostname !== 'github.com') return null;
  const [owner, repo, marker, ref, ...rest] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repo || !/^[\w.-]+$/u.test(owner) || !/^[\w.-]+$/u.test(repo)) return null;
  return {
    owner,
    ref: (marker === 'tree' || marker === 'blob') && ref ? ref : 'HEAD',
    repo: repo.replace(/\.git$/u, ''),
    subPath: marker === 'tree' ? rest.join('/') : '',
  };
}

function rawUrl(link, file) {
  const parts = [link.owner, link.repo, link.ref, ...(link.subPath ? link.subPath.split('/') : []), file];
  return `https://raw.githubusercontent.com/${parts.map(encodeURIComponent).join('/')}`;
}

async function readRaw(fetchImpl, link, file) {
  try {
    const response = await fetchImpl(rawUrl(link, file), { redirect: 'follow' });
    if (!response.ok) return { missing: response.status === 404, text: null };
    return { missing: false, text: (await response.text()).slice(0, MAX_TEXT) };
  } catch (error) {
    return { error: error?.message || String(error), missing: false, text: null };
  }
}

async function inspectGitHubLink(input, fetchImpl = globalThis.fetch) {
  const link = parseGitHubLink(input);
  if (!link) return { error: '请发 GitHub 上的仓库或文件夹链接，例如 https://github.com/作者/仓库。', ok: false };
  const entries = await Promise.all(Object.entries(FILES).map(async ([key, file]) => [key, await readRaw(fetchImpl, link, file)]));
  const files = Object.fromEntries(entries);
  for (const name of README_FALLBACKS) {
    if (files.readme.text !== null) break;
    files.readme = await readRaw(fetchImpl, link, name);
  }
  const found = Object.fromEntries(Object.entries(files).filter(([, value]) => value.text !== null).map(([key, value]) => [key, value.text]));
  if (!Object.keys(found).length) {
    const failed = Object.values(files).find((value) => value.error);
    return failed
      ? { error: `连不上 GitHub：${failed.error}。国内网络可能需要代理。`, ok: false }
      : { error: '这个链接下面什么都读不到：仓库不存在、是私有的，或分支 / 文件夹名不对。', ok: false };
  }
  return { ...found, link: { ...link, url: `https://github.com/${link.owner}/${link.repo}` }, ok: true };
}

module.exports = { inspectGitHubLink, parseGitHubLink };
