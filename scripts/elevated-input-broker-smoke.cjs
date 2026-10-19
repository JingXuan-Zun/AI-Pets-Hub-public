// The elevated input helper (electron/elevatedInputBroker*.cjs), run WITHOUT elevation:
// commands are converted to its fixed set, a command for a window that is not in front is
// refused before any input, a wrong token closes the pipe, and the helper then exits.
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const net = require('node:net');
const path = require('node:path');

const root = path.join(__dirname, '..');
const { createElevatedInputBrokerScript } = require(path.join(root, 'electron/elevatedInputBrokerScript.cjs'));
const { toBrokerCommand } = require(path.join(root, 'electron/elevatedInputBroker.cjs'));

assert.deepEqual(toBrokerCommand('double_click', { expectedForegroundHwnd: 7, nativeScreenX: 10.4, nativeScreenY: 20.6 }),
  { button: 'left', clicks: 2, expectedHwnd: 7, kind: 'click', x: 10, y: 21 });
assert.equal(toBrokerCommand('right_click', { nativeScreenX: 1, nativeScreenY: 2 }).button, 'right');
assert.deepEqual(toBrokerCommand('type_text', { text: '你好' }), { expectedHwnd: 0, kind: 'text', text: '你好' });
assert.deepEqual(toBrokerCommand('hotkey', { hotkey: 'ctrl+c' }).kind, 'hotkey');
assert.equal(toBrokerCommand('hotkey', { hotkey: 'ctrl+notakey' }), null);
assert.equal(toBrokerCommand('click', {}), null);
assert.equal(toBrokerCommand('run_script', { text: 'x' }), null);

if (process.platform !== 'win32') {
  console.log('elevated input broker smoke: conversion ok (pipe check needs Windows)');
  process.exit(0);
}

const sid = execFileSync('powershell.exe', ['-NoProfile', '-Command', '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], { encoding: 'utf8' }).trim();
const pipeName = `desktop-pet-probe-${crypto.randomBytes(8).toString('hex')}`;
const token = crypto.randomBytes(16).toString('hex');
const script = createElevatedInputBrokerScript({ idleMs: 8000, parentPid: process.pid, pipeName, token, userSid: sid });
const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { stdio: 'ignore' });
const events = [];
const timeout = setTimeout(() => { child.kill(); assert.fail(`helper did not finish: ${events.join(', ')}`); }, 45_000);

child.on('exit', (code) => {
  clearTimeout(timeout);
  assert.deepEqual(events, ['connected', 'refused-not-foreground', 'closed-after-wrong-token']);
  assert.equal(code, 0);
  console.log('elevated input broker smoke ok');
});

const connect = (attempts) => {
  const socket = net.connect(`\\\\.\\pipe\\${pipeName}`);
  socket.on('error', () => {
    socket.destroy();
    if (attempts > 0) setTimeout(() => connect(attempts - 1), 300);
  });
  socket.on('connect', () => {
    events.push('connected');
    let buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      buffer += chunk;
      if (!buffer.includes('\n')) return;
      const reply = JSON.parse(buffer.trim());
      buffer = '';
      if (reply.id === 1 && reply.ok === false && reply.error === 'target_window_not_foreground') events.push('refused-not-foreground');
      socket.write(`${JSON.stringify({ id: 2, kind: 'move', token: 'wrong', x: 0, y: 0 })}\n`);
    });
    socket.on('close', () => events.push('closed-after-wrong-token'));
    // hwnd 1 is never the foreground window, so this click is refused without any input.
    socket.write(`${JSON.stringify({ ...toBrokerCommand('click', { expectedForegroundHwnd: 1, nativeScreenX: 10, nativeScreenY: 10 }), id: 1, token })}\n`);
  });
};
setTimeout(() => connect(60), 300);
