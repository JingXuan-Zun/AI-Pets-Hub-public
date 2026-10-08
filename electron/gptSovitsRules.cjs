const path = require('path');
const { isPathInside } = require('./localVoiceRuntimePathUtils.cjs');

const DEFAULT_GPT_SOVITS_API_URL = 'http://127.0.0.1:9881';
const GPT_SOVITS_MODEL_VERSION = 'v2ProPlus';
const GPT_SOVITS_DEVICES = ['auto', 'cuda', 'cpu'];
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const MODEL_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
const EMOTION_KEY_PATTERN = /^[a-z][a-z0-9_-]{0,31}$/u;

// The sidecar only ever listens on loopback; any other host falls back to the default.
function normalizeGptSovitsBaseUrl(rawUrl) {
  const candidate = typeof rawUrl === 'string' && rawUrl.trim() ? rawUrl.trim() : DEFAULT_GPT_SOVITS_API_URL;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) {
      return new URL(DEFAULT_GPT_SOVITS_API_URL);
    }
    url.pathname = '/';
    url.search = '';
    url.hash = '';
    return url;
  } catch {
    return new URL(DEFAULT_GPT_SOVITS_API_URL);
  }
}

function normalizeGptSovitsDevice(value) {
  return GPT_SOVITS_DEVICES.includes(value) ? value : 'auto';
}

function normalizeGptSovitsModelId(value) {
  return typeof value === 'string' && MODEL_ID_PATTERN.test(value.trim()) ? value.trim() : null;
}

function resolveGptSovitsPaths({ runtimeRoot, platform = process.platform }) {
  const home = path.join(runtimeRoot, 'gpt-sovits');
  const venvDir = path.join(home, 'venv');
  return {
    home,
    venvDir,
    venvPython: platform === 'win32'
      ? path.join(venvDir, 'Scripts', 'python.exe')
      : path.join(venvDir, 'bin', 'python'),
    sourceDir: path.join(home, 'GPT-SoVITS'),
  };
}

function resolveInside(baseDir, relativePath) {
  if (typeof relativePath !== 'string' || !relativePath.trim() || path.isAbsolute(relativePath)) {
    return null;
  }
  const resolved = path.resolve(baseDir, relativePath);
  return isPathInside(resolved, baseDir) ? resolved : null;
}

function parseEmotions(rawEmotions, modelDir) {
  const emotions = {};
  const errors = [];
  for (const [key, entry] of Object.entries(rawEmotions && typeof rawEmotions === 'object' ? rawEmotions : {})) {
    const wavPath = resolveInside(modelDir, entry?.wav);
    const text = typeof entry?.text === 'string' ? entry.text.trim() : '';
    if (!EMOTION_KEY_PATTERN.test(key) || !wavPath || !text) {
      errors.push(`emotion:${key}`);
      continue;
    }
    emotions[key] = { wavPath, text };
  }
  if (!emotions.neutral) {
    errors.push('emotion:neutral');
  }
  return { emotions, errors };
}

function optionalText(value, maxLength) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, maxLength) : '';
}

// Validates a voice pack manifest; every referenced file must stay inside the pack directory.
// A "full" pack ships fine-tuned weights (gpt + sovits); a "lite" pack ships only reference clips
// and runs on the shared pretrained base model. Naming just one of the two weights is an error.
function parseGptSovitsManifest(rawManifest, modelDir) {
  const manifest = rawManifest && typeof rawManifest === 'object' ? rawManifest : {};
  const errors = [];
  if (manifest.version !== GPT_SOVITS_MODEL_VERSION) {
    errors.push('version');
  }
  const kind = manifest.gpt === undefined && manifest.sovits === undefined ? 'lite' : 'full';
  const gptPath = kind === 'full' ? resolveInside(modelDir, manifest.gpt) : null;
  const sovitsPath = kind === 'full' ? resolveInside(modelDir, manifest.sovits) : null;
  if (kind === 'full' && !gptPath) errors.push('gpt');
  if (kind === 'full' && !sovitsPath) errors.push('sovits');
  const { emotions, errors: emotionErrors } = parseEmotions(manifest.emotions, modelDir);
  errors.push(...emotionErrors);
  return {
    ok: errors.length === 0,
    errors,
    kind,
    name: optionalText(manifest.name, 40) || path.basename(modelDir),
    description: optionalText(manifest.description, 200),
    author: optionalText(manifest.author, 40),
    gptPath,
    sovitsPath,
    emotions,
  };
}

function buildGptSovitsServerArgs(serverScript, { baseUrl, sourceDir, modelsRoot, device }) {
  return [
    serverScript,
    '--host', baseUrl.hostname === 'localhost' ? '127.0.0.1' : baseUrl.hostname.replace(/^\[|\]$/gu, ''),
    '--port', String(Number(baseUrl.port) || 9881),
    '--source-dir', sourceDir,
    '--models-root', modelsRoot,
    '--device', normalizeGptSovitsDevice(device),
  ];
}

module.exports = {
  DEFAULT_GPT_SOVITS_API_URL,
  GPT_SOVITS_MODEL_VERSION,
  buildGptSovitsServerArgs,
  normalizeGptSovitsBaseUrl,
  normalizeGptSovitsDevice,
  normalizeGptSovitsModelId,
  parseGptSovitsManifest,
  resolveGptSovitsPaths,
};
