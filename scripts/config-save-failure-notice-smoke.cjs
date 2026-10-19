const assert = require('node:assert/strict');
const { createConfigSaveFailureNotifier, describeConfigSaveFailure } = require('../electron/configSaveFailureNotice.cjs');

const shown = [];
let time = 0;
const dialog = { showMessageBox: async (...args) => { shown.push(args.at(-1)); return { response: 0 }; } };
const notify = createConfigSaveFailureNotifier({ dialog, now: () => time });

assert.equal(notify({ ok: true }), false, 'a successful save shows nothing');
assert.equal(notify({ ok: false, error: 'credential-endpoint-changed-reenter-key' }), true);
assert.equal(shown[0].message, '设置没有保存成功');
assert.match(shown[0].detail, /重新填写 API Key/u, 'known reasons are explained in plain words');
time += 2000;
assert.equal(notify({ ok: false, error: 'credential-endpoint-changed-reenter-key' }), false, 'the same failure in a burst is not repeated');
assert.equal(notify({ ok: false, error: 'EBUSY: resource busy' }), true, 'a different failure is shown');
time += 9000;
assert.equal(notify({ ok: false, error: 'EBUSY: resource busy' }), true, 'shown again once the burst is over');
assert.match(describeConfigSaveFailure('weird thing'), /weird thing/u, 'unknown reasons are passed through');

let parentUsed = false;
const withParent = createConfigSaveFailureNotifier({
  dialog: { showMessageBox: async (parent) => { parentUsed = Boolean(parent?.isDestroyed); } },
  getParentWindow: () => ({ isDestroyed: () => false }),
});
withParent({ ok: false, error: 'x' });
assert.equal(parentUsed, true, 'the dialog is attached to the focused window');
console.log('config save failure notice smoke ok');
