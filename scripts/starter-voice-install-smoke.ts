// One-click install of 小玲's real voice: portable Python (hash-checked, mirror first), base Python
// choice, the bundled voice pack copy, and GPU detection.
import { strict as assert } from 'node:assert';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const portable = require('../electron/gptSovitsPortablePython.cjs');
const { resolveBasePython } = require('../electron/gptSovitsInstaller.cjs');
const starter = require('../electron/starterVoiceInstall.cjs');
const plan = require('../electron/gptSovitsInstallPlan.cjs');

let checks = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); checks += 1; };
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'starter-voice-'));

const run = async () => {
  // Portable Python: mirror first, GitHub second, both pinned to the same file.
  const urls = portable.portablePythonUrls();
  check([urls.length, urls[0].includes('npmmirror.com'), urls[1].includes('github.com/astral-sh'), urls.every((u: string) => u.includes('20261026'))], [2, true, true, true], 'sources');
  check(portable.PORTABLE_PYTHON.sha256.length, 64, 'pinned hash');

  // A download that does not match the hash is deleted and the next source tried; then it fails.
  const tried: string[] = [];
  const fakeFetch = async (url: string) => { tried.push(url); return new Response(new Uint8Array([1, 2, 3]), { status: 200 }); };
  let failure = '';
  try {
    await portable.ensurePortablePython({ fetchImpl: fakeFetch, runtimeRoot: path.join(tmp, 'rt1') });
  } catch (error) {
    failure = (error as Error).message;
  }
  check([tried.length, /校验不通过/u.test(failure)], [2, true], 'wrong hash: both sources tried, nothing used');
  check(fs.existsSync(portable.portablePythonPaths(path.join(tmp, 'rt1')).archive), false, 'bad archive deleted');

  // Already there: nothing downloaded.
  const ready = portable.portablePythonPaths(path.join(tmp, 'rt2'));
  fs.mkdirSync(path.dirname(ready.executable), { recursive: true });
  fs.writeFileSync(ready.executable, '');
  check(await portable.ensurePortablePython({ fetchImpl: async () => { throw new Error('no'); }, runtimeRoot: path.join(tmp, 'rt2') }), ready.executable, 'existing portable Python reused');

  // Base Python: the first candidate that passes the version check; none -> portable download.
  const paths = { home: path.join(tmp, 'rt3', 'gpt-sovits') };
  const progress = { push: () => undefined };
  const runCommand = async (candidate: { executable: string }) => ({ ok: candidate.executable === 'good-python' });
  const picked = await resolveBasePython({
    candidates: [{ args: [], executable: 'old-python', label: 'python' }, { args: [], executable: 'good-python', label: 'py' }],
    ensurePortable: async () => { throw new Error('should not download'); }, getSharedEnv: () => ({}), paths, progress, runCommand, writeLog: () => undefined,
  });
  check(picked.executable, 'good-python', 'a working system Python is used');
  const downloaded = await resolveBasePython({
    candidates: [{ args: [], executable: 'old-python', label: 'python' }],
    ensurePortable: async () => 'D:/portable/python.exe', getSharedEnv: () => ({}), paths, progress, runCommand, writeLog: () => undefined,
  });
  check([downloaded.label, downloaded.executable], ['portable', 'D:/portable/python.exe'], 'no Python: the portable one');

  // pip steps retry through the mirror; torch does not.
  const steps = plan.buildGptSovitsInstallSteps({ device: 'cpu', installScript: 'x.py', paths: { sourceDir: 's', venvDir: 'v' }, venvExists: true });
  check(steps.filter((step: { pipMirrorRetry?: boolean }) => step.pipMirrorRetry).map((step: { id: string }) => step.id), ['pip', 'requirements'], 'mirror retry on pip steps');

  // The bundled voice pack lands in local-models/voice/gpt-sovits/xiaoling-lite (folder created).
  const projectRoot = path.join(tmp, 'app');
  fs.mkdirSync(projectRoot, { recursive: true });
  const target = starter.installStarterVoicePack({ projectRoot });
  check(path.relative(projectRoot, target).split(path.sep), ['local-models', 'voice', 'gpt-sovits', 'xiaoling-lite'], 'pack location');
  const manifest = JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8'));
  check([manifest.version, Boolean(manifest.emotions.neutral), manifest.gpt, manifest.sovits], ['v2ProPlus', true, undefined, undefined], 'a lite pack (no trained weights)');
  for (const emotion of Object.values(manifest.emotions) as { wav: string }[]) {
    assert.ok(fs.statSync(path.join(target, emotion.wav)).size > 10_000, emotion.wav); checks += 1;
  }
  fs.writeFileSync(path.join(target, 'manifest.json'), '{"kept":true}');
  starter.installStarterVoicePack({ projectRoot });
  check(JSON.parse(fs.readFileSync(path.join(target, 'manifest.json'), 'utf8')), { kept: true }, 'an existing pack is not overwritten');

  // GPU detection.
  const fakeSpawn = (output: string, code: number) => () => {
    const child = new EventEmitter() as EventEmitter & { stdout: EventEmitter; kill: () => void };
    child.stdout = new EventEmitter();
    child.kill = () => undefined;
    setTimeout(() => { child.stdout.emit('data', output); child.emit('close', code); }, 5);
    return child;
  };
  check(await starter.detectNvidiaGpu(fakeSpawn('GPU 0: NVIDIA GeForce RTX 4060 Laptop GPU (UUID: x)', 0)), true, 'NVIDIA card found');
  check(await starter.detectNvidiaGpu(fakeSpawn('', 1)), false, 'no card');
  check(await starter.detectNvidiaGpu(() => { throw new Error('ENOENT'); }), false, 'no driver');

  fs.rmSync(tmp, { force: true, recursive: true });
  console.log(`starter voice install smoke ok: ${checks} checks`);
};
void run();
