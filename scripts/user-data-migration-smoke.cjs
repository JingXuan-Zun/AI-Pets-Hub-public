// Rename to AI Pets Hub (2026-11-18): the data in the old "react-example" folder moves to
// "ai-pets-hub" once, an earlier trial folder there is kept aside, a link stays at the old name,
// and a folder in use is left alone for this run.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { migrateLegacyUserData } = require('../electron/userDataMigration.cjs');

let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; };
const CONFIG = 'desktop-pet-config.v1.json';

function sandbox() {
  const appData = fs.mkdtempSync(path.join(os.tmpdir(), 'pets-hub-migration-'));
  let userData = path.join(appData, 'ai-pets-hub');
  const app = { getPath: (name) => (name === 'appData' ? appData : userData), setPath: (_name, value) => { userData = value; } };
  const write = (folder, file, text) => { fs.mkdirSync(path.join(appData, folder), { recursive: true }); fs.writeFileSync(path.join(appData, folder, file), text); };
  return { app, appData, cleanup: () => fs.rmSync(appData, { force: true, recursive: true }), userData: () => userData, write };
}

// The usual case: real data under react-example, a trial folder under ai-pets-hub.
let box = sandbox();
box.write('react-example', CONFIG, '{"real":true}');
box.write('react-example', 'desktop-pet-chat-history.v1.json', '[1,2,3]');
box.write('ai-pets-hub', 'desktop-pet-chat-history.v1.json', '[]');
let result = migrateLegacyUserData({ app: box.app, now: Date.UTC(2026, 10, 19, 1, 2) });
check(result.status === 'moved', 'old data moved');
check(fs.readFileSync(path.join(box.appData, 'ai-pets-hub', CONFIG), 'utf8') === '{"real":true}', 'the config is in the new folder');
check(fs.existsSync(path.join(box.appData, 'ai-pets-hub', 'desktop-pet-chat-history.v1.json')), 'with everything else');
check(Boolean(result.aside) && fs.readFileSync(path.join(result.aside, 'desktop-pet-chat-history.v1.json'), 'utf8') === '[]', 'the trial folder is kept aside, not deleted');
check(result.linked && fs.readFileSync(path.join(box.appData, 'react-example', CONFIG), 'utf8') === '{"real":true}', 'older builds still find the data through the old name');
check(migrateLegacyUserData({ app: box.app }).status === 'current', 'the next start does nothing');
box.cleanup();

// Nothing old: nothing happens.
box = sandbox();
check(migrateLegacyUserData({ app: box.app }).status === 'nothing-to-move', 'a fresh install is left alone');
box.cleanup();

// Two old folders: the newer config wins.
box = sandbox();
box.write('AI Desktop Pet', CONFIG, '{"which":"older"}');
fs.utimesSync(path.join(box.appData, 'AI Desktop Pet', CONFIG), new Date(2026, 0, 1), new Date(2026, 0, 1));
box.write('react-example', CONFIG, '{"which":"newer"}');
migrateLegacyUserData({ app: box.app });
check(fs.readFileSync(path.join(box.appData, 'ai-pets-hub', CONFIG), 'utf8') === '{"which":"newer"}', 'the most recently used old folder is moved');
box.cleanup();

// A folder in use: keep using it this run, nothing lost.
box = sandbox();
box.write('react-example', CONFIG, '{"real":true}');
const handle = fs.openSync(path.join(box.appData, 'react-example', CONFIG), 'r');
result = migrateLegacyUserData({ app: box.app });
fs.closeSync(handle);
if (process.platform === 'win32') {
  check(result.status === 'kept-old-folder' && box.userData() === path.join(box.appData, 'react-example'), 'in use: this run keeps the old folder');
  check(fs.existsSync(path.join(box.appData, 'react-example', CONFIG)), 'and the data is untouched');
  check(migrateLegacyUserData({ app: { ...box.app, getPath: (name) => (name === 'appData' ? box.appData : path.join(box.appData, 'ai-pets-hub')) } }).status === 'moved', 'the next start moves it');
}
box.cleanup();

console.log(`user data migration smoke ok: ${checks} checks`);
