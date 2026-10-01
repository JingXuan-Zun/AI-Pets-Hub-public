const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-electron-credential-'));
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
env.DESKTOP_PET_CREDENTIAL_PROBE_DIR = root;
try {
  const output = execFileSync(require('electron'), [path.join(__dirname, 'electron-credential-storage-smoke.cjs')], {
    env, timeout: 20_000, windowsHide: true, encoding: 'utf8',
  });
  if (!output.includes('native Electron safeStorage smoke ok') || !output.includes('native isolated preload and model IPC smoke ok')) {
    throw new Error('native credential probe did not finish');
  }
  process.stdout.write(output);
} finally {
  if (path.dirname(path.resolve(root)) !== path.resolve(os.tmpdir()) || !path.basename(root).startsWith('pet-electron-credential-')) {
    throw new Error('unsafe temporary credential probe path');
  }
  fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}
