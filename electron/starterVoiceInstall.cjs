// One click for 小玲's real voice (first-run starter pack): the bundled lite voice pack (reference
// recordings only, resources/starter-voice) is copied into local-models/voice/gpt-sovits, then the
// GPT-SoVITS runtime is installed (portable Python if needed, torch, dependencies, base models).
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { resolveVoiceRootPath } = require('./localVoiceLibrary.cjs');

const STARTER_VOICE_ID = 'xiaoling-lite';

/** The bundled pack: in the asar for packaged builds, in the repo for development. */
function bundledStarterVoiceDir() {
  return path.join(__dirname, '..', 'resources', 'starter-voice', STARTER_VOICE_ID);
}

/** An existing local-models/voice, or a new one next to the app (portable folder / project). */
function resolveOrCreateVoiceRoot({ app, projectRoot }) {
  const existing = resolveVoiceRootPath({ app, projectRoot });
  if (existing) return existing;
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR
    || (process.env.PORTABLE_EXECUTABLE_FILE ? path.dirname(process.env.PORTABLE_EXECUTABLE_FILE) : null);
  const base = portableDir || (app?.isPackaged && process.execPath ? path.dirname(process.execPath) : projectRoot);
  const root = path.join(base, 'local-models', 'voice');
  fs.mkdirSync(root, { recursive: true });
  return root;
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    const target = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(source, target);
    else fs.writeFileSync(target, fs.readFileSync(source));
  }
}

/** Puts the starter pack in place (once); returns its folder. */
function installStarterVoicePack({ app, projectRoot, sourceDir = bundledStarterVoiceDir() }) {
  const target = path.join(resolveOrCreateVoiceRoot({ app, projectRoot }), 'gpt-sovits', STARTER_VOICE_ID);
  if (!fs.existsSync(path.join(target, 'manifest.json'))) copyDir(sourceDir, target);
  return target;
}

/** An NVIDIA card with a driver (nvidia-smi lists it): the CUDA build of torch is worth its size. */
function detectNvidiaGpu(run = spawn) {
  return new Promise((resolve) => {
    let output = '';
    let child;
    try {
      child = run('nvidia-smi', ['-L'], { windowsHide: true });
    } catch {
      resolve(false);
      return;
    }
    const timer = setTimeout(() => { child.kill(); resolve(false); }, 10_000);
    child.stdout?.on('data', (data) => { output += String(data); });
    child.on('error', () => { clearTimeout(timer); resolve(false); });
    child.on('close', (code) => { clearTimeout(timer); resolve(code === 0 && /GPU \d+:/u.test(output)); });
  });
}

function createStarterVoiceInstaller({ app, projectRoot, gptSovitsService, log = () => undefined }) {
  return async function installStarterVoice(settings, { onProgress } = {}) {
    const say = (line) => onProgress?.({ messages: [line], stage: 'running' });
    try {
      say('放好小玲的声音包...');
      installStarterVoicePack({ app, projectRoot });
    } catch (error) {
      log('starter voice pack copy failed', error instanceof Error ? error.message : String(error));
      return { ok: false, error: '小玲的声音包放不进去，请检查软件所在文件夹能不能写入。', modelId: null };
    }
    // 'auto' would install the 3.3GB CUDA build; without an NVIDIA card the CPU build is the right one.
    let installSettings = settings ?? {};
    if (!installSettings.gptSovitsDevice || installSettings.gptSovitsDevice === 'auto') {
      const hasGpu = await detectNvidiaGpu();
      say(hasGpu ? '检测到 NVIDIA 显卡，安装显卡加速版。' : '没有检测到 NVIDIA 显卡，安装 CPU 版（说话会慢一些）。');
      installSettings = { ...installSettings, gptSovitsDevice: hasGpu ? 'cuda' : 'cpu' };
    }
    const result = await gptSovitsService.installRuntime(installSettings, { onProgress });
    return { ...result, modelId: result.ok ? STARTER_VOICE_ID : null };
  };
}

module.exports = { STARTER_VOICE_ID, createStarterVoiceInstaller, detectNvidiaGpu, installStarterVoicePack, resolveOrCreateVoiceRoot };
