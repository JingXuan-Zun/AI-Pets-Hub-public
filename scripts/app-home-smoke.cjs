// Where the big files live (11-19, installer added): the portable exe keeps them beside itself,
// the installed app in "AI Pets Hub Data" beside the install folder (upgrades wipe that folder).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { INSTALLED_HOME_NAME, installedHomeFor, resolveAppHome } = require('../electron/appHome.cjs');

let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; };
const same = (a, b) => path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase();

check(resolveAppHome({ isPackaged: false, projectRoot: 'D:/proj' }).kind === 'dev', 'development: the project folder');
let home = resolveAppHome({ env: { PORTABLE_EXECUTABLE_DIR: 'D:/Pets' }, execPath: 'C:/Temp/x/AI Pets Hub.exe', isPackaged: true });
check(home.kind === 'portable' && same(home.dir, 'D:/Pets'), 'portable: beside the exe the user keeps, not the temp copy');
home = resolveAppHome({ env: { PORTABLE_EXECUTABLE_FILE: 'D:/Pets/AI-Pets-Hub.exe' }, execPath: 'C:/Temp/x/AI Pets Hub.exe', isPackaged: true });
check(home.kind === 'portable' && same(home.dir, 'D:/Pets'), 'portable (file only): the same');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'app-home-'));
const installDir = path.join(root, 'AI Pets Hub');
fs.mkdirSync(installDir);
fs.writeFileSync(path.join(installDir, 'AI Pets Hub.exe'), '');
home = resolveAppHome({ env: {}, execPath: path.join(installDir, 'AI Pets Hub.exe'), isPackaged: true });
check(home.kind === 'folder' && same(home.dir, installDir), 'an unpacked folder build: its own folder');
fs.writeFileSync(path.join(installDir, 'Uninstall AI Pets Hub.exe'), '');
home = resolveAppHome({ env: {}, execPath: path.join(installDir, 'AI Pets Hub.exe'), isPackaged: true });
check(home.kind === 'installed' && same(home.dir, path.join(root, INSTALLED_HOME_NAME)), 'installed: "AI Pets Hub Data" beside the install folder');
check(!home.dir.toLowerCase().startsWith(installDir.toLowerCase() + path.sep), 'never inside the folder an upgrade wipes');
check(/^[\x20-\x7e]+$/u.test(INSTALLED_HOME_NAME), 'a plain ASCII name (Python tools choke on some paths)');
check(same(installedHomeFor('D:\\', {}), path.join('D:\\', INSTALLED_HOME_NAME)), 'installed at a drive root: a folder on that drive');
const machineEnv = { LOCALAPPDATA: 'C:\\Users\\u\\AppData\\Local', ProgramFiles: 'C:\\Program Files' };
check(same(installedHomeFor('C:\\Program Files\\AI Pets Hub', machineEnv), 'C:\\Users\\u\\AppData\\Local\\AI Pets Hub Data'), 'installed for all users: the user\'s own AppData (Program Files is read-only)');
check(same(installedHomeFor('D:\\Apps\\AI Pets Hub', machineEnv), 'D:\\Apps\\AI Pets Hub Data'), 'installed on D:: beside it, on D:');
check(same(installedHomeFor('C:\\Program Files Extra\\AI Pets Hub', machineEnv), 'C:\\Program Files Extra\\AI Pets Hub Data'), 'a folder that only starts like Program Files is not it');

// Switching from the portable exe to the installed app: the voice packs are still found.
const { resolveVoiceRootPath } = require('../electron/localVoiceLibrary.cjs');
const userData = path.join(root, 'userData');
const portableDir = path.join(root, 'old-portable');
fs.mkdirSync(path.join(portableDir, 'local-models', 'voice'), { recursive: true });
const fakeApp = { getAppPath: () => path.join(root, 'nowhere'), getPath: () => userData, isPackaged: true };
const savedEnv = process.env.PORTABLE_EXECUTABLE_DIR;
process.env.PORTABLE_EXECUTABLE_DIR = portableDir;
const first = resolveVoiceRootPath({ app: fakeApp, projectRoot: path.join(root, 'nowhere') });
delete process.env.PORTABLE_EXECUTABLE_DIR;
const later = resolveVoiceRootPath({ app: fakeApp, projectRoot: path.join(root, 'nowhere') });
if (savedEnv !== undefined) process.env.PORTABLE_EXECUTABLE_DIR = savedEnv;
check(first && same(first, path.join(portableDir, 'local-models', 'voice')), 'portable: the packs beside the exe');
check(later && same(later, first), 'installed later: the same packs, remembered');
fs.rmSync(root, { force: true, recursive: true });

console.log(`app home smoke ok: ${checks} checks`);
