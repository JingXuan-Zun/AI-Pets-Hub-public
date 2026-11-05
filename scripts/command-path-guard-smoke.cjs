const assert = require('node:assert/strict');
const { createCommandPathGuard } = require('../electron/commandPathGuard.cjs');

// Commands may not read or write the app's own data and settings, or credential stores.

const guard = createCommandPathGuard({ protectedRoots: ['C:\\Users\\me\\AppData\\Roaming\\react-example', 'D:\\proj\\.desktop-pet-mcp.json'] });
const blocked = (command, cwd) => assert.ok(guard.check(command, cwd), `blocked: ${command}`);
const allowed = (command, cwd) => assert.equal(guard.check(command, cwd), null, `allowed: ${command}`);

blocked("[IO.File]::WriteAllText('D:\\proj\\.desktop-pet-mcp.json','{}')"); // what she did
blocked('Select-String -Path "C:\\Users\\me\\AppData\\Roaming\\react-example\\desktop-pet-config.v1.json" -Pattern uvx');
blocked('Get-Content $env:APPDATA\\react-example\\something.json');
blocked('type .desktop-pet-mcp.json');
blocked('dir', 'C:\\Users\\me\\AppData\\Roaming\\react-example');
blocked('Get-Content "C:\\Users\\me\\.ssh\\id_rsa"');
allowed('where.exe uv uvx');
allowed('python -m pip install uv');
allowed('Get-ChildItem "D:\\Downloads"');
allowed('Get-Process chrome');
console.log('command path guard smoke ok: 10 checks');
