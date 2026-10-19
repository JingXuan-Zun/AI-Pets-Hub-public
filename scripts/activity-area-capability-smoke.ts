import assert from 'node:assert/strict';
import { DISPLAY_SETTINGS_CAPABILITIES } from '../src/platform-capabilities/displaySettingsCapabilities';

// “把活动范围框关掉” had no tool; the character tried clicks and commands instead.
const capability = DISPLAY_SETTINGS_CAPABILITIES.find((item) => item.id === 'desktop.set_activity_area');
assert.ok(capability, 'activity area capability is offered');
assert.equal(capability.risk, 'personal', 'a look-only change runs without a confirmation card');

let saved: unknown = null;
const configRef = { current: { settings: { activityAreaLimitEnabled: true, activityBorderVisible: true } } } as never;
const context = { configRef, onUpdateConfig: (next: unknown) => { saved = next; } } as never;
const run = async (args: Record<string, unknown>) => capability.run(context, args);

const hidden = await run({ frameVisible: false });
assert.ok(hidden.ok);
assert.equal((configRef as { current: { settings: { activityBorderVisible: boolean } } }).current.settings.activityBorderVisible, false);
assert.match(hidden.text, /已隐藏/u);
assert.ok(saved, 'the change is saved');

const freed = await run({ limitEnabled: false });
assert.match(freed.text, /整个桌面/u);
assert.equal((await run({})).ok, false, 'asks what to change when nothing is given');
console.log('activity area capability smoke ok');
