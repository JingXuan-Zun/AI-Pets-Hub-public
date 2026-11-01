const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { resolveFfmpegPath } = require('./ffmpegPath.cjs');

// A bot on WeChat's ClawBot channel can send pictures, videos and files but not voice bubbles
// (the server accepts them and drops them). So her voice goes as a short video: her chat avatar
// (or a plain card) with the audio, which plays with one tap on the phone.

const SIZE = 480;
const BACKGROUND = '0xffe4ec';
const TIMEOUT_MS = 90_000;

function runFfmpeg(ffmpeg, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpeg, args, { windowsHide: true });
    let stderr = '';
    const timer = setTimeout(() => child.kill(), TIMEOUT_MS);
    child.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-2000); });
    child.on('error', (error) => { clearTimeout(timer); reject(error); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`视频合成失败：${stderr.trim().split(/\r?\n/u).at(-1) ?? code}`));
    });
  });
}

/** WAV bytes (+ optional picture bytes) → an MP4 buffer. */
async function makeVoiceVideo(wav, image, { ffmpegPath = resolveFfmpegPath() } = {}) {
  if (!ffmpegPath) throw new Error('找不到 FFmpeg，没法把语音做成视频');
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), `weixin-voice-${crypto.randomBytes(3).toString('hex')}-`));
  try {
    const audioPath = path.join(folder, 'voice.wav');
    const videoPath = path.join(folder, 'voice.mp4');
    fs.writeFileSync(audioPath, wav);
    const fit = `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease,pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2:color=${BACKGROUND},format=yuv420p`;
    let picture = ['-f', 'lavfi', '-i', `color=c=${BACKGROUND}:s=${SIZE}x${SIZE}:r=5`];
    if (image?.length) {
      const imagePath = path.join(folder, 'picture');
      fs.writeFileSync(imagePath, image);
      picture = ['-loop', '1', '-framerate', '5', '-i', imagePath];
    }
    await runFfmpeg(ffmpegPath, [
      '-y', '-hide_banner', '-loglevel', 'error', ...picture, '-i', audioPath,
      '-vf', fit, '-r', '5', '-c:v', 'libx264', '-preset', 'veryfast', '-tune', 'stillimage', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '64k', '-ar', '44100', '-shortest', '-movflags', '+faststart', videoPath,
    ]);
    return fs.readFileSync(videoPath);
  } finally {
    fs.rmSync(folder, { force: true, recursive: true });
  }
}

module.exports = { makeVoiceVideo };
