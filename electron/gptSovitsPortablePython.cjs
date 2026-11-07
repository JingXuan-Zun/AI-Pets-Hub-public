// A portable Python for the one-click voice install, when the computer has no Python 3.10–3.12.
// python-build-standalone (a full CPython with venv and pip), pinned with its published SHA-256.
// The npmmirror copy comes first (fast in China), GitHub second; both are checked against the hash.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORTABLE_PYTHON = {
  version: '3.12.16',
  release: '20261026',
  file: 'cpython-3.12.16+20261026-x86_64-pc-windows-msvc-install_only.tar.gz',
  sha256: '590dfcbe3a34c07301e6332e13e2188b98655cd072b08afa45a7998dc4c22bc5',
  size: 47113364,
};

function portablePythonUrls(spec = PORTABLE_PYTHON) {
  const encoded = encodeURIComponent(spec.file);
  return [
    `https://registry.npmmirror.com/-/binary/python-build-standalone/${spec.release}/${encoded}`,
    `https://github.com/astral-sh/python-build-standalone/releases/download/${spec.release}/${encoded}`,
  ];
}

/** Where it lives: next to the GPT-SoVITS runtime, never on the system drive by itself. */
function portablePythonPaths(runtimeRoot) {
  const dir = path.join(runtimeRoot, 'python-base');
  return { archive: path.join(dir, PORTABLE_PYTHON.file), dir, executable: path.join(dir, 'python', 'python.exe') };
}

async function downloadFile(url, target, onProgress, fetchImpl = fetch) {
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(15 * 60 * 1000) });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const total = Number(response.headers.get('content-length')) || PORTABLE_PYTHON.size;
  const hash = crypto.createHash('sha256');
  const out = fs.createWriteStream(target);
  let received = 0;
  let lastPercent = -1;
  try {
    for await (const chunk of response.body) {
      hash.update(chunk);
      received += chunk.length;
      if (!out.write(chunk)) await new Promise((resolve) => out.once('drain', resolve));
      const percent = Math.floor((received / total) * 100);
      if (percent >= lastPercent + 10) {
        lastPercent = percent;
        onProgress?.(`下载 Python 运行环境 ${Math.min(100, percent)}%...`);
      }
    }
  } finally {
    await new Promise((resolve) => out.end(resolve));
  }
  return hash.digest('hex');
}

function extractArchive(archive, dir) {
  // Windows 10+ ships bsdtar as tar.exe, which reads .tar.gz.
  return new Promise((resolve, reject) => {
    const child = spawn('tar', ['-xzf', archive, '-C', dir], { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (data) => { stderr += String(data); });
    child.on('error', reject);
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(stderr.trim() || `tar exited ${code}`))));
  });
}

/**
 * Makes sure the portable Python is there and returns its python.exe. Downloads at most once per
 * source; a file that does not match the published hash is deleted, never used.
 */
async function ensurePortablePython({ runtimeRoot, onProgress, writeLog, fetchImpl, extract = extractArchive }) {
  const paths = portablePythonPaths(runtimeRoot);
  if (fs.existsSync(paths.executable)) return paths.executable;
  fs.mkdirSync(paths.dir, { recursive: true });
  let lastError = null;
  for (const url of portablePythonUrls()) {
    try {
      onProgress?.('电脑上没有可用的 Python，正在下载一个只给语音用的 Python（约 45MB）...');
      const digest = await downloadFile(url, paths.archive, onProgress, fetchImpl);
      if (digest !== PORTABLE_PYTHON.sha256) {
        fs.rmSync(paths.archive, { force: true });
        throw new Error('下载的文件校验不通过');
      }
      onProgress?.('解压 Python 运行环境...');
      await extract(paths.archive, paths.dir);
      fs.rmSync(paths.archive, { force: true });
      if (!fs.existsSync(paths.executable)) throw new Error('解压后没有找到 python.exe');
      return paths.executable;
    } catch (error) {
      lastError = error;
      writeLog?.('portable Python download failed', { url, error: error instanceof Error ? error.message : String(error) });
      fs.rmSync(paths.archive, { force: true });
    }
  }
  throw new Error(`下载 Python 运行环境失败：${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

module.exports = { PORTABLE_PYTHON, ensurePortablePython, portablePythonPaths, portablePythonUrls };
