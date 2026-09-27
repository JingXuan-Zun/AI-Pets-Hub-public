const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { MODEL_ASSET_DIRECTORY_NAME } = require('./modelAssetRoot.cjs');
const { spawn } = require('child_process');

const IMAGE_EXTENSIONS = new Set(['.avif', '.bmp', '.gif', '.jpeg', '.jpg', '.png', '.webp']);
const MAX_SEQUENCE_FRAME_COUNT = 300;
const MAX_SEQUENCE_TOTAL_BYTES = 256 * 1024 * 1024;
const MAX_VIDEO_BYTES = 256 * 1024 * 1024;
const VIDEO_EXTENSIONS = new Set(['.webm', '.mp4', '.m4v', '.mov', '.gif']);

function toLocalAssetUrl(assetPath) {
  const protocolUrl = new URL('desktop-pet-file://local/');
  protocolUrl.pathname = `/${path.resolve(assetPath).replace(/\\/g, '/').replace(/^\/+/, '')}`;
  return protocolUrl.toString();
}

function parseSequenceName(fileName) {
  const match = String(fileName || '').match(/^(.*?)(\d+)(\.[^.]+)$/u);
  if (!match) return null;
  return { extension: match[3].toLowerCase(), index: Number(match[2]), prefix: match[1].toLowerCase() };
}

function createSafeSequenceFolderName(value) {
  const normalized = String(value || '')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/[. ]+$/u, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80);
  return normalized || '未命名序列帧动画';
}

function sortByFrameName(left, right) {
  const leftPattern = parseSequenceName(path.basename(left));
  const rightPattern = parseSequenceName(path.basename(right));
  return (leftPattern?.index ?? Number.MAX_SAFE_INTEGER) - (rightPattern?.index ?? Number.MAX_SAFE_INTEGER)
    || path.basename(left).localeCompare(path.basename(right), 'zh-Hans-CN', { numeric: true });
}

function getSafeImagePath(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const sourcePath = path.resolve(value.trim());
  const extension = path.extname(sourcePath).toLowerCase();
  if (!IMAGE_EXTENSIONS.has(extension)) return null;
  try {
    return fs.statSync(sourcePath).isFile() ? sourcePath : null;
  } catch {
    return null;
  }
}

function collectSequenceSourcePaths(sourcePaths) {
  const selectedPaths = Array.from(new Set(
    (Array.isArray(sourcePaths) ? sourcePaths : [])
      .map(getSafeImagePath)
      .filter(Boolean),
  ));
  if (selectedPaths.length !== 1) return selectedPaths.sort(sortByFrameName);

  const selectedPath = selectedPaths[0];
  const selectedPattern = parseSequenceName(path.basename(selectedPath));
  if (!selectedPattern) return selectedPaths;

  try {
    const siblingPaths = fs.readdirSync(path.dirname(selectedPath), { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => path.join(path.dirname(selectedPath), entry.name))
      .filter((entryPath) => {
        const pattern = parseSequenceName(path.basename(entryPath));
        return Boolean(
          pattern
          && pattern.prefix === selectedPattern.prefix
          && pattern.extension === selectedPattern.extension
          && getSafeImagePath(entryPath),
        );
      })
      .sort(sortByFrameName);
    return siblingPaths.length > 1 ? siblingPaths : selectedPaths;
  } catch {
    return selectedPaths;
  }
}

function createSequenceAssetStore({ assetRootPath, log } = {}) {
  const sequenceRootPath = path.join(path.resolve(assetRootPath || process.cwd()), MODEL_ASSET_DIRECTORY_NAME);
  const videoRootPath = path.join(sequenceRootPath, 'video');
  const logMessage = (message, details) => {
    if (typeof log === 'function') log(message, details);
  };

  function resolveAvailableFolderName(requestedName) {
    const baseName = createSafeSequenceFolderName(requestedName);
    let candidateName = baseName;
    let suffix = 2;
    while (fs.existsSync(path.join(sequenceRootPath, candidateName))) {
      candidateName = `${baseName}-${suffix}`;
      suffix += 1;
    }
    return candidateName;
  }

  function stage2DSequence(request = {}) {
    const sourcePaths = collectSequenceSourcePaths(request.sourcePaths);
    if (sourcePaths.length === 0) {
      return { error: '未找到可导入的 PNG/JPG/WebP/GIF 序列帧。', ok: false };
    }
    if (sourcePaths.length > MAX_SEQUENCE_FRAME_COUNT) {
      return { error: `序列帧数量超过 ${MAX_SEQUENCE_FRAME_COUNT} 张。`, ok: false };
    }

    const totalBytes = sourcePaths.reduce((total, sourcePath) => total + fs.statSync(sourcePath).size, 0);
    if (totalBytes > MAX_SEQUENCE_TOTAL_BYTES) {
      return { error: '序列帧总大小超过 256MB。', ok: false };
    }

    fs.mkdirSync(sequenceRootPath, { recursive: true });
    const selectedPattern = parseSequenceName(path.basename(sourcePaths[0]));
    const folderId = resolveAvailableFolderName(request.sequenceName || selectedPattern?.prefix);
    const targetDirectory = path.join(sequenceRootPath, folderId);
    try {
      fs.mkdirSync(targetDirectory, { recursive: false });
      const frameUrls = sourcePaths.map((sourcePath, index) => {
        const extension = path.extname(sourcePath).toLowerCase();
        const targetPath = path.join(targetDirectory, `frame-${String(index + 1).padStart(4, '0')}${extension}`);
        fs.copyFileSync(sourcePath, targetPath);
        return toLocalAssetUrl(targetPath);
      });
      logMessage('staged custom 2D sequence', { folderId, frameCount: frameUrls.length, totalBytes });
      return { folderId, frameCount: frameUrls.length, frameUrls, ok: true };
    } catch (error) {
      fs.rmSync(targetDirectory, { force: true, recursive: true });
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function resolveFfmpegPath() {
    const packagedBinaryName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const resourcesUnpacked = process.resourcesPath
      ? path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'ffmpeg-static', packagedBinaryName)
      : '';
    // In packaged Electron builds this is the only path guaranteed to be a
    // real filesystem executable. Check it before ffmpeg-static's ASAR path.
    if (resourcesUnpacked && fs.existsSync(resourcesUnpacked)) return resourcesUnpacked;
    const configured = process.env.DESKTOP_PET_FFMPEG_PATH || process.env.FFMPEG_PATH;
    if (configured && fs.existsSync(configured)) return configured;
    try {
      const bundled = require('ffmpeg-static');
      if (bundled && !bundled.includes(`${path.sep}app.asar${path.sep}`) && fs.existsSync(bundled)) return bundled;
      // electron-builder unpacks native binaries outside app.asar. The
      // package export still points into app.asar, so resolve its unpacked
      // sibling before spawning the process.
      if (bundled && /[\\/]app\.asar[\\/]/iu.test(bundled)) {
        const unpacked = bundled.replace(/[\\/]app\.asar[\\/]/iu, `${path.sep}app.asar.unpacked${path.sep}`);
        if (fs.existsSync(unpacked)) return unpacked;
      }
    } catch {}
    const candidates = process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg'];
    for (const candidate of candidates) {
      try {
        const result = require('child_process').execFileSync(candidate, ['-version'], { windowsHide: true, stdio: 'ignore' });
        if (result !== undefined || candidate) return candidate;
      } catch {}
    }
    return null;
  }

  function convertToTransparentWebm(sourcePath, targetPath, sourceExtension) {
    const ffmpeg = resolveFfmpegPath();
    if (!ffmpeg) return Promise.resolve({ error: '未找到 FFmpeg，无法将视频转换为透明 WebM。请安装 FFmpeg 或设置 DESKTOP_PET_FFMPEG_PATH。', ok: false });
    return new Promise((resolve) => {
      const child = spawn(ffmpeg, [
        '-y', '-i', sourcePath,
        '-vf', sourceExtension === '.gif'
          ? 'format=yuva420p'
          : 'colorkey=0xFFFFFF:0.16:0.06,format=yuva420p',
        '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-auto-alt-ref', '0',
        '-deadline', 'realtime', '-cpu-used', '4', '-row-mt', '1',
        '-an', targetPath,
      ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      let stderr = '';
      const timeout = setTimeout(() => {
        child.kill();
        resolve({ error: '视频转换超时（超过 120 秒），请尝试降低视频分辨率或时长。', ok: false });
      }, 120000);
      child.stderr?.on('data', (chunk) => { stderr += String(chunk); });
      child.on('error', (error) => { clearTimeout(timeout); resolve({ error: error.message, ok: false }); });
      child.on('close', (code) => { clearTimeout(timeout); resolve(code === 0 && fs.existsSync(targetPath)
        ? { ok: true }
        : { error: `视频透明转换失败${stderr ? `：${stderr.slice(-500)}` : ''}`, ok: false }); });
    });
  }

  async function stage2DVideo(request = {}) {
    const sourcePath = typeof request.sourcePath === 'string' ? path.resolve(request.sourcePath.trim()) : '';
    const extension = path.extname(sourcePath).toLowerCase();
    if (!sourcePath || !['.webm', '.mp4', '.m4v', '.mov', '.gif'].includes(extension)) {
      return { error: '只支持导入 WebM、MP4、M4V、MOV 或 GIF 视频。', ok: false };
    }
    let stats;
    try { stats = fs.statSync(sourcePath); } catch { return { error: '找不到要导入的 WebM 文件。', ok: false }; }
    if (!stats.isFile()) return { error: 'WebM 路径不是文件。', ok: false };
    if (stats.size > MAX_VIDEO_BYTES) return { error: 'WebM 文件大小不能超过 256MB。', ok: false };

    try {
      fs.mkdirSync(videoRootPath, { recursive: true });
      const digest = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex').slice(0, 16);
      const baseName = createSafeSequenceFolderName(request.videoName || path.basename(sourcePath, extension));
      const outputDigest = crypto.createHash('sha256').update(`${digest}:white-key-v1`).digest('hex').slice(0, 16);
      const targetPath = path.join(videoRootPath, `${baseName}-${outputDigest}.webm`);
      if (!fs.existsSync(targetPath)) {
        if (extension === '.webm') fs.copyFileSync(sourcePath, targetPath);
        else {
          const conversion = await convertToTransparentWebm(sourcePath, targetPath, extension);
          if (!conversion.ok) return conversion;
        }
      }
      return { ok: true, videoUrl: toLocalAssetUrl(targetPath), converted: extension !== '.webm' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  function inspect2DVideoFolder(request = {}) {
    const folderPath = typeof request.folderPath === 'string' ? request.folderPath.trim() : '';
    if (!folderPath) return { error: '请选择视频文件夹。', ok: false };
    try {
      const resolvedPath = path.resolve(folderPath);
      if (!fs.statSync(resolvedPath).isDirectory()) return { error: '所选路径不是文件夹。', ok: false };
      const videoPaths = fs.readdirSync(resolvedPath, { withFileTypes: true })
        .filter((entry) => entry.isFile() && VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
        .map((entry) => path.join(resolvedPath, entry.name))
        .filter((filePath) => fs.statSync(filePath).size <= MAX_VIDEO_BYTES);
      if (videoPaths.length === 0) return { error: '文件夹中没有可用视频（支持 WebM、MP4、M4V、MOV、GIF，单个不超过 256MB）。', ok: false };
      return { folderPath: resolvedPath, ok: true, videoCount: videoPaths.length, videoPaths };
    } catch {
      return { error: '视频文件夹不存在或无法读取。', ok: false };
    }
  }

  async function pick2DVideoFromFolder(request = {}) {
    const inspected = inspect2DVideoFolder(request);
    if (!inspected.ok) return inspected;
    const paths = [...inspected.videoPaths];
    for (let remaining = paths.length; remaining > 0; remaining -= 1) {
      const index = Math.floor(Math.random() * remaining);
      const [selectedPath] = paths.splice(index, 1);
      const staged = await stage2DVideo({ sourcePath: selectedPath });
      if (staged.ok) return { ...staged, videoCount: inspected.videoCount };
    }
    return { error: '文件夹中的视频均无法播放，请检查文件格式。', ok: false };
  }

  return { getRootPath: () => sequenceRootPath, inspect2DVideoFolder, pick2DVideoFromFolder, stage2DSequence, stage2DVideo };
}

module.exports = { createSequenceAssetStore };
