// Writing text files through the file service (benchmark 2026-11-05: she wrote files with PowerShell).
const assert = require('node:assert/strict');
const { createLocalFileSystemService } = require('../electron/localFileSystemService.cjs');
const fs = require('fs'); const os = require('os'); const path = require('path');
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-')); const f = path.join(dir, 'a.txt');
  const prot = fs.mkdtempSync(path.join(os.tmpdir(), 'prot-'));
  const svc = createLocalFileSystemService({ log: () => {}, protectedRoots: [prot] });
  const w = (o) => svc.executeFileManagementAction({ action: 'write_text_file', destinationPath: f, ...o });
  const r = [];
  r.push(['preview', (await w({ text: 'x', dryRun: true })).ok, fs.existsSync(f)]);
  r.push(['create', (await w({ text: '苹果' })).ok, fs.readFileSync(f, 'utf8')]);
  r.push(['create again refused', (await w({ text: 'b' })).ok]);
  r.push(['overwrite preview', (await w({ text: 'b', writeMode: 'overwrite', dryRun: true })).willOverwrite]);
  r.push(['append', (await w({ text: '香蕉', writeMode: 'append' })).ok, fs.readFileSync(f, 'utf8')]);
  r.push(['overwrite', (await w({ text: '橙子', writeMode: 'overwrite' })).ok, fs.readFileSync(f, 'utf8')]);
  r.push(['no BOM', fs.readFileSync(f)[0] !== 0xef]);
  r.push(['protected', (await svc.executeFileManagementAction({ action: 'write_text_file', destinationPath: path.join(prot, 'x.txt'), text: 'x' })).ok]);
  r.push(['no parent', (await svc.executeFileManagementAction({ action: 'write_text_file', destinationPath: path.join(dir, 'nope', 'x.txt'), text: 'x' })).ok]);
  assert.deepEqual(r, [['preview', true, false], ['create', true, '苹果'], ['create again refused', false], ['overwrite preview', true], ['append', true, '苹果香蕉'], ['overwrite', true, '橙子'], ['no BOM', true], ['protected', false], ['no parent', false]]);
  console.log('local filesystem write text smoke ok: 9 checks');
  fs.rmSync(dir, { recursive: true }); fs.rmSync(prot, { recursive: true });
})();
