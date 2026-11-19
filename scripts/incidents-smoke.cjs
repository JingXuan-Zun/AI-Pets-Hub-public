// Incidents on the computer: which log entries become incidents, what is cleaned out (keys, the
// user's name in paths, long quoted text), that the same problem in another version or build is
// one incident, the store's counting and consent, and that uploads only happen with consent and
// never carry the log lines.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { incidentFromLogEntry, parseFrames, shapeIncident } = require('../electron/incidents/incidentRecord.cjs');
const { createIncidentStore } = require('../electron/incidents/incidentStore.cjs');
const { createIncidentUploader } = require('../electron/incidents/incidentUpload.cjs');

let checks = 0;
const check = (condition, label) => { assert.ok(condition, label); checks += 1; };
const redactOptions = { homeDir: 'C:\\Users\\Alice', userName: 'Alice' };

(async () => {
  // Which entries count.
  const stack = 'TypeError: Cannot read properties of undefined (reading \'voice\')\n    at speak (C:\\Users\\Alice\\AppData\\Local\\Temp\\2abc\\resources\\app.asar\\electron\\voice.cjs:41:9)\n    at node:internal/timers:5:1';
  const main = incidentFromLogEntry({ details: stack, message: 'uncaughtException', scope: 'error', side: 'backend' });
  check(main?.source === 'main' && main.message.startsWith('TypeError'), 'main-process errors are incidents');
  check(incidentFromLogEntry({ details: { reason: 'clean-exit' }, message: 'render-process-gone', scope: 'error', side: 'backend' }) === null, 'a window closing normally is not');
  check(incidentFromLogEntry({ details: { exitCode: -1, reason: 'crashed' }, message: 'render-process-gone', scope: 'error', side: 'backend' })?.source === 'crash', 'a window crash is');
  const ui = incidentFromLogEntry({ details: { errorMessage: 'boom', errorName: 'RangeError', errorStack: 'RangeError: boom\n    at draw (file:///C:/Users/Alice/x/resources/app.asar/dist/assets/index-Ck897HSc.js:1:200)' }, message: 'window error captured', scope: 'unhandled-error', side: 'frontend' });
  check(ui?.source === 'window' && ui.kind === 'RangeError', 'window errors are incidents');
  check(incidentFromLogEntry({ details: { errorMessage: 'boom' }, message: 'window error captured', scope: '主界面/unhandled-error', side: 'frontend' })?.source === 'window', 'with the window name in front too (as the real app logs them)');
  check(incidentFromLogEntry({ message: 'something', scope: 'frontend-error', side: 'frontend' }) === null, 'console noise is not');

  // Cleaning.
  const frames = parseFrames(stack.split('\n').slice(1).join('\n'));
  check(frames[0].file === 'electron/voice.cjs' && frames[0].line === '41:9', 'frames keep only the path inside the app');
  check(!JSON.stringify(frames).includes('Alice'), 'no user name in frames');
  const leaky = shapeIncident({ kind: 'Error', message: 'failed for C:\\Users\\Alice\\Documents\\secret plan.txt with key sk-abcdefghijklmnopqrstuvwxyz and text "这是用户说的一整句很长很长的话，不应该被原样发出去，因为它可能是聊天内容"', source: 'main', stack: '' }, redactOptions);
  check(!leaky.title.includes('Alice') && !leaky.title.includes('sk-abcdefghijklmnop') && !leaky.title.includes('聊天内容'), 'no name, key or long quoted text in the title');

  // Same problem across versions and builds → same fingerprint; a different problem → another.
  const v1 = shapeIncident({ kind: 'RangeError', message: 'index 12 out of range', source: 'window', stack: 'at draw (x/resources/app.asar/dist/assets/index-Ck897HSc.js:1:200)' }, redactOptions);
  const v2 = shapeIncident({ kind: 'RangeError', message: 'index 7 out of range', source: 'window', stack: 'at draw (y/resources/app.asar/dist/assets/index-Zz111Abc.js:1:950)' }, redactOptions);
  const other = shapeIncident({ kind: 'RangeError', message: 'index 7 out of range', source: 'window', stack: 'at paint (y/resources/app.asar/dist/assets/index-Zz111Abc.js:1:950)' }, redactOptions);
  check(v1.fingerprint === v2.fingerprint, 'numbers, line numbers and build hashes do not split a problem');
  check(v1.fingerprint !== other.fingerprint, 'another place is another problem');

  // Store: counting, versions, context, consent, removal, saved to disk.
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'incidents-smoke-'));
  let version = '0.4.4';
  const logs = ['[12:00:01][frontend][chat] text: 用户的话 reply sent', '[12:00:00][backend][voice] started'];
  const store = createIncidentStore({ getAppVersion: () => version, getRecentLogs: () => logs, getUserDataPath: () => userData, redactOptions });
  store.record(main);
  version = '0.4.5';
  const again = store.record(main);
  check(again.count === 2 && again.versions.join() === '0.4.4,0.4.5', 'a repeat raises the count and adds the version');
  check(again.context.length === 2 && !again.context.join().includes('用户的话'), 'context lines kept, words people said taken out');
  check(store.consent() === 'unasked', 'consent starts unasked');
  store.record(ui);
  check(store.list().length === 2, 'two different problems');
  store.flush();
  check(JSON.parse(fs.readFileSync(path.join(userData, 'incidents.json'), 'utf8')).items.length === 2, 'saved to disk');

  // Upload: nothing without consent; with it, only new occurrences, no context lines; fixed versions come back.
  const sent = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    sent.push({ body, url });
    if (url.endsWith('/incidents/status')) return { json: async () => ({ fixed: { [main ? store.list().find((item) => item.source === 'main').fingerprint : '']: '0.4.6' } }), ok: true };
    return { json: async () => ({ ok: true, received: body.items.length }), ok: true };
  };
  const uploader = createIncidentUploader({ apiUrl: 'https://market.test', fetchImpl, getAppVersion: () => version, store });
  check((await uploader.run()).reason === 'no-consent' && sent.length === 0, 'nothing is sent before the user agrees');
  store.setConsent('yes');
  const result = await uploader.run();
  const upload = sent.find((entry) => entry.url.endsWith('/incidents')).body;
  check(result.ok && result.sent === 2, 'both problems sent once agreed');
  check(upload.items.every((item) => !('context' in item)) && !JSON.stringify(upload).includes('voice] started'), 'log lines never leave the computer');
  check(upload.items.find((item) => item.source === 'main').count === 2 && upload.installId === store.installId(), 'counts and the anonymous install id are sent');
  check(store.list().find((item) => item.source === 'main').fixedIn === '0.4.6', 'the fixed version comes back');
  sent.length = 0;
  await uploader.run();
  check(!sent.some((entry) => entry.url.endsWith('/incidents')), 'nothing new → nothing sent again');
  store.record(main);
  await uploader.run();
  check(sent.find((entry) => entry.url.endsWith('/incidents')).body.items[0].count === 1, 'only the new occurrence is sent');
  store.setConsent('no');
  sent.length = 0;
  store.record(main);
  await uploader.run();
  check(sent.length === 0, 'switching it off stops sending');
  store.remove(store.list()[0].fingerprint);
  check(store.list().length === 1, 'the user can delete one');

  // The pet window hears about a brand-new problem only while the user has not decided.
  const { createIncidentHub } = require('../electron/incidents/incidentHub.cjs');
  const hubData = fs.mkdtempSync(path.join(os.tmpdir(), 'incidents-hub-'));
  const sentToWindow = [];
  const hub = createIncidentHub({ app: { getPath: () => hubData, getVersion: () => '0.4.4' }, getRecentLogs: () => [] });
  hub.registerIpc({ handle: () => {} }, { getMainWindow: () => ({ webContents: { send: (channel, payload) => sentToWindow.push({ channel, payload }) } }) });
  const crash = { details: 'TypeError: a\n    at f (x/app.asar/electron/a.cjs:1:1)', message: 'uncaughtException', scope: 'error', side: 'backend' };
  hub.onLogEntry(crash);
  check(sentToWindow.length === 1 && sentToWindow[0].channel === 'desktop-pet:incident-new' && /^[0-9a-f]{16}$/u.test(sentToWindow[0].payload.fingerprint), 'a new problem reaches the pet window');
  hub.onLogEntry(crash);
  check(sentToWindow.length === 1, 'the same problem again does not ask again');
  hub.onLogEntry({ details: 'RangeError: b\n    at g (x/app.asar/electron/b.cjs:1:1)', message: 'uncaughtException', scope: 'error', side: 'backend' });
  check(sentToWindow.length === 1, 'not more than once in half an hour');
  hub.store.setConsent('no');
  check(hub.store.consent() === 'no', 'after the user decided, nothing more is asked (consent is set)');
  hub.store.flush();
  fs.rmSync(hubData, { force: true, recursive: true });

  fs.rmSync(userData, { force: true, recursive: true });
  console.log(`incidents smoke ok: ${checks} checks`);
})().catch((error) => { console.error(error); process.exit(1); });
