const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createAppLauncherService } = require('../electron/appLauncherService.cjs');

const opened = [];
const shellApi = {
  openExternal: async (url) => {
    opened.push(['external', url]);
  },
  openPath: async (target) => {
    opened.push(['path', target]);
    return '';
  },
};
const service = createAppLauncherService({ shellApi });
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-open-resource-'));

async function main() {
  for (const target of ['https://example.com/a', 'example.com']) {
    const result = await service.openResource({ target, resourceType: 'url' });
    assert.equal(result.ok, true, target);
  }
  for (const target of ['file:///C:/Windows/System32/calc.exe', 'search-ms://query=x', 'ms-settings://x']) {
    const result = await service.openResource({ target, resourceType: 'url' });
    assert.equal(result.ok, false, target);
    assert.match(result.error, /http, https and mailto/u, target);
  }

  const folder = path.join(root, 'folder.exe');
  fs.mkdirSync(folder);
  const textFile = path.join(root, 'notes.txt');
  fs.writeFileSync(textFile, 'x');
  for (const target of [folder, textFile]) {
    const result = await service.openResource({ target, resourceType: 'auto' });
    assert.equal(result.ok, true, target);
  }
  for (const name of ['setup.exe', 'run.bat', 'run.CMD', 'script.ps1', 'x.vbs', 'page.hta', 'pkg.msi', 'link.lnk', 'site.url']) {
    const target = path.join(root, name);
    fs.writeFileSync(target, 'x');
    const result = await service.openResource({ target, resourceType: 'file' });
    assert.equal(result.ok, false, name);
    assert.match(result.error, /launch_local_app/u, name);
  }

  assert.deepEqual(opened.map(([kind]) => kind), ['external', 'external', 'path', 'path']);
  assert.ok(opened.every(([, value]) => !/\.(?:exe|bat|cmd|ps1|vbs|hta|msi|lnk|url)$/iu.test(value) || value === folder));
  fs.rmSync(root, { recursive: true, force: true });
  console.log('open resource safety smoke passed');
}

main().catch((error) => {
  fs.rmSync(root, { recursive: true, force: true });
  console.error(error);
  process.exitCode = 1;
});
