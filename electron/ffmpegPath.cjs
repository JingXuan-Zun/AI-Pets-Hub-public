const fs = require('fs');
const path = require('path');

/** Finds a runnable ffmpeg: the bundled ffmpeg-static (unpacked in packaged builds), an env override, or PATH. */
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
    if (bundled && /[\/]app\.asar[\/]/iu.test(bundled)) {
      const unpacked = bundled.replace(/[\/]app\.asar[\/]/iu, `${path.sep}app.asar.unpacked${path.sep}`);
      if (fs.existsSync(unpacked)) return unpacked;
    }
  } catch {}
  const candidates = process.platform === 'win32' ? ['ffmpeg.exe', 'ffmpeg'] : ['ffmpeg'];
  for (const candidate of candidates) {
    try {
      require('child_process').execFileSync(candidate, ['-version'], { windowsHide: true, stdio: 'ignore' });
      return candidate;
    } catch {}
  }
  return null;
}

module.exports = { resolveFfmpegPath };
