// node scripts/benchmark/desktop-icons.cjs snapshot <out.json> | restore <in.json> [--dry]
// Reads / restores desktop icon positions with the app's own PowerShell scripts.
const fs = require('fs'); const path = require('path'); const Module = require('module'); const { execFileSync } = require('child_process');
const repo = path.resolve(__dirname, '../..');
const file = path.join(repo, 'electron/desktopIconService.cjs');
const m = new Module(file, null); m.filename = file; m.paths = Module._nodeModulePaths(path.dirname(file));
m._compile(fs.readFileSync(file, 'utf8') + '\nmodule.exports.__s = { getDesktopIconPowerShellScript, getDesktopIconMovePowerShellScript, getDesktopIconFolderViewMovePowerShellScript };', file);
const s = m.exports.__s;
function ps(script) {
  const tmp = path.join(require('os').tmpdir(), 'dpi-' + process.pid + '-' + Date.now() + '.ps1');
  fs.writeFileSync(tmp, '\ufeff' + script, 'utf8');
  try { return execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', tmp], { encoding: 'utf8', maxBuffer: 64e6 }); } finally { fs.unlinkSync(tmp); }
}
const read = () => { const out = JSON.parse(ps(s.getDesktopIconPowerShellScript()).trim() || '[]'); return Array.isArray(out) ? out : [out]; };
const [cmd, target, flag] = process.argv.slice(2);
if (cmd === 'snapshot') {
  const icons = read(); fs.writeFileSync(target, JSON.stringify(icons, null, 1));
  console.log('icons', icons.length, 'keys', Object.keys(icons[0] || {}).join(','));
} else if (cmd === 'restore') {
  const saved = JSON.parse(fs.readFileSync(target, 'utf8')); let moved = 0, same = 0, missing = 0;
  for (const want of saved) {
    const now = read().find((i) => i.name === want.name);
    if (!now) { missing++; continue; }
    if (Math.abs(now.x - want.x) < 4 && Math.abs(now.y - want.y) < 4) { same++; continue; }
    console.log('move', want.name.length, 'chars', now.x, now.y, '->', want.x, want.y);
    if (flag !== '--dry') ps(s.getDesktopIconMovePowerShellScript({ index: now.index, nativeScreenX: want.x, nativeScreenY: want.y }));
    moved++;
  }
  console.log({ moved, same, missing });
}
