import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const actual = require('../electron/windowManager/windowStateMessaging.cjs');
const roles = ['main', 'settings', 'chat'];
const methods = ['getIsSettingsWindowOpen', 'getIsChatWindowOpen', 'notifySettingsWindowState', 'notifyChatWindowState', 'broadcastSharedState', 'broadcastRuntimeWorldPresentationIntent'];

export function exerciseWindowMessaging(factories = actual, assemble?: (deps: any) => any) {
  const outputs: unknown[] = [];
  const normal = { main: 'visible', settings: 'visible', chat: 'visible', shared: 'normal', operation: 'all', intent: 'normal', excluded: undefined };
  for (const main of ['null', 'destroyed', 'hidden', 'visible']) for (const settings of ['null', 'destroyed', 'hidden', 'visible'])
    for (const chat of ['null', 'destroyed', 'hidden', 'visible']) {
      for (const shared of ['null', 'zero', 'normal']) run({ ...normal, main, settings, chat, shared });
      for (const excluded of [undefined, null, 1, 3, '2']) run({ ...normal, main, settings, chat, operation: 'intent', excluded });
    }
  for (const intent of ['undefined', 'null', 'false', 'zero', 'string', 'function']) run({ ...normal, intent, operation: 'intent' });
  for (const visibility of [0, 'yes', {}]) run({ ...normal, visibility, operation: 'settingsOpen' });
  for (const intent of ['array', 'nullPrototype']) run({ ...normal, intent, operation: 'intent' });
  run({ ...normal, nullId: true, operation: 'intent' });
  for (const failure of ['getMain', 'getSettings', 'getChat', 'getShared', 'destroy:main', 'destroy:settings', 'destroy:chat',
    'visible:settings', 'visible:chat', 'contents:main', 'contents:settings', 'contents:chat',
    'send:main', 'send:settings', 'send:chat', 'id:main', 'id:settings', 'id:chat']) run(normal, failure);
  for (const [race, operation] of [
    ['destroySwitchSettings', 'settingsOpen'], ['visibleSwitchSettings', 'notifySettings'], ['mainSendClosesSettings', 'notifySettings'],
    ['mainSendClearsSettings', 'notifySettings'], ['mainSendReplacesChat', 'notifyChat'], ['settingsSendSwapsChat', 'shared'],
    ['settingsSendSwapsState', 'shared'], ['sharedReadReplacesSettings', 'shared'], ['sharedReadClearsState', 'shared'],
    ['filterReplacesOwners', 'intent'], ['sendReplacesOwners', 'intent'], ['idSwapsContents', 'intent'], ['filterDestroysChat', 'intent'],
    ['settingsDestroyClears', 'settingsOpen'], ['sendSettingsClearsChat', 'shared'],
  ]) run({ ...normal, operation }, undefined, race);
  return JSON.parse(JSON.stringify(outputs));

  function run(config: any, failure?: string, race?: string) {
    const calls: unknown[][] = [], sent: Array<{ id: unknown; role: string; channel: string; payload: unknown }> = [];
    const error = new Error('window messaging dependency failure');
    const stateA = { tag: 'A' }, stateB = { tag: 'B' };
    let state: any = config.shared === 'null' ? null : config.shared === 'zero' ? 0 : stateA;
    let windows: Record<string, any> = {}, alternates: Record<string, any> = {}, applied = false, sharedReads = 0, thrown: any;
    const intent: any = config.intent === 'undefined' ? undefined : config.intent === 'null' ? null : config.intent === 'false' ? false
      : config.intent === 'zero' ? 0 : config.intent === 'string' ? 'bad' : config.intent === 'function' ? () => {}
        : config.intent === 'array' ? [] : config.intent === 'nullPrototype' ? Object.create(null) : { tag: 'intent' };
    const step = (name: string, value?: unknown) => {
      calls.push([name, value]); if (name === failure) throw error;
      if (!applied && race) {
        if (race === 'destroySwitchSettings' && name === 'destroy:settings') { alternates.settings.mode = 'hidden'; windows.settings = alternates.settings; applied = true; }
        if (race === 'visibleSwitchSettings' && name === 'visible:settings') { alternates.settings.mode = 'hidden'; windows.settings = alternates.settings; applied = true; }
        if (race === 'mainSendClosesSettings' && name === 'send:main') { windows.settings.mode = 'hidden'; applied = true; }
        if (race === 'mainSendClearsSettings' && name === 'send:main') { windows.settings = null; applied = true; }
        if (race === 'mainSendReplacesChat' && name === 'send:main') { alternates.chat.mode = 'hidden'; windows.chat = alternates.chat; applied = true; }
        if (race === 'settingsSendSwapsChat' && name === 'send:settings') { windows.chat = alternates.chat; applied = true; }
        if (race === 'settingsSendSwapsState' && name === 'send:settings') { state = stateB; applied = true; }
        if (race === 'sharedReadReplacesSettings' && name === 'getShared' && sharedReads === 2) { windows.settings = alternates.settings; state = stateB; applied = true; }
        if (race === 'sharedReadClearsState' && name === 'getShared' && sharedReads === 2) { state = null; applied = true; }
        if (race === 'filterReplacesOwners' && name === 'destroy:main') { windows = { ...alternates }; applied = true; }
        if (race === 'sendReplacesOwners' && name === 'send:main') { windows = { ...alternates }; applied = true; }
        if (race === 'filterDestroysChat' && name === 'destroy:main') { windows.chat.mode = 'destroyed'; applied = true; }
        if (race === 'settingsDestroyClears' && name === 'destroy:settings') { windows.settings = null; applied = true; }
        if (race === 'sendSettingsClearsChat' && name === 'send:settings') { windows.chat = null; applied = true; }
      }
    };
    function window(role: string, mode: string, id: number) {
      let child: any;
      function contents(contentsId: unknown, changed = false) {
        const wc = {
          get id() {
            step('id:' + role, contentsId);
            if (race === 'idSwapsContents' && !changed) child = contents(id + 100, true);
            return contentsId;
          },
          send(channel: string, payload: unknown) {
            assert.equal(this, wc);
            if (channel.endsWith('window-state')) assert.equal(typeof payload, 'boolean');
            if (channel === 'desktop-pet:shared-state') assert.equal(payload, state);
            if (channel === 'desktop-pet:runtime-world-presentation-intent') assert.equal(payload, intent);
            const record = { id: contentsId, role, channel, payload: channel === 'desktop-pet:shared-state' ? (payload as any)?.tag ?? payload
              : channel === 'desktop-pet:runtime-world-presentation-intent' ? 'intent' : payload };
            sent.push(record); step('send:' + role, record); return 'ignored';
          },
        };
        return wc;
      }
      child = contents(config.nullId && role === 'main' ? null : id);
      const win = {
        role, mode, id,
        isDestroyed() { assert.equal(this, win); step('destroy:' + role, id); return win.mode === 'destroyed'; },
        isVisible() { assert.equal(this, win); step('visible:' + role, id); return config.visibility !== undefined ? config.visibility : win.mode === 'visible'; },
        get webContents() { step('contents:' + role, id); return child; },
      };
      return win;
    }
    roles.forEach((role, index) => {
      const win = window(role, config[role], index + 1); windows[role] = config[role] === 'null' ? null : win;
      alternates[role] = window(role, 'visible', index + 11);
    });
    const deps = {
      getMainWindow() { step('getMain', windows.main?.id ?? null); return windows.main; },
      getSettingsWindow() { step('getSettings', windows.settings?.id ?? null); return windows.settings; },
      getChatWindow() { step('getChat', windows.chat?.id ?? null); return windows.chat; },
      getSharedState() { sharedReads += 1; step('getShared', state?.tag ?? state); return state; },
    };
    const api = assemble ? assemble(deps) : { ...factories.createWindowStateNotifier(deps), ...factories.createWindowStateBroadcaster(deps) };
    assert.deepEqual(calls, [], 'factories must not read state or send messages');
    assert.deepEqual(Object.keys(api).sort(), [...methods].sort());
    for (const method of methods) assert.equal(api[method].name, method);
    function invoke() {
      if (config.operation === 'all') return [api.getIsSettingsWindowOpen(), api.getIsChatWindowOpen(), api.notifySettingsWindowState(), api.notifyChatWindowState(), api.broadcastSharedState(), api.broadcastRuntimeWorldPresentationIntent(intent, config.excluded)];
      if (config.operation === 'intent') return api.broadcastRuntimeWorldPresentationIntent(intent, config.excluded);
      if (config.operation === 'settingsOpen') return api.getIsSettingsWindowOpen();
      if (config.operation === 'notifySettings') return api.notifySettingsWindowState();
      if (config.operation === 'notifyChat') return api.notifyChatWindowState();
      return api.broadcastSharedState();
    }
    let result: any, secondResult: any;
    try {
      result = invoke();
      if (!failure && !race) {
        const eligible = (role: string) => config[role] !== 'null' && config[role] !== 'destroyed';
        if (config.operation === 'all') {
          assert.deepEqual(result, [config.settings === 'visible', config.chat === 'visible', undefined, undefined, undefined, undefined]);
          const expected = [
            ...['main', 'settings'].filter(eligible).map(role => [role, 'desktop-pet:settings-window-state', config.settings === 'visible']),
            ...roles.filter(eligible).map(role => [role, 'desktop-pet:chat-window-state', config.chat === 'visible']),
            ...['settings', 'chat'].filter(role => config.shared === 'normal' && config[role] === 'visible').map(role => [role, 'desktop-pet:shared-state', 'A']),
            ...roles.filter(eligible).map(role => [role, 'desktop-pet:runtime-world-presentation-intent', 'intent']),
          ];
          assert.deepEqual(sent.map(s => [s.role, s.channel, s.payload]), expected);
          windows = { ...alternates }; state = stateB;
          secondResult = invoke(); assert.deepEqual(secondResult, [true, true, undefined, undefined, undefined, undefined]);
          assert.ok(sent.slice(expected.length).every(s => Number(s.id) >= 11));
          assert.deepEqual(sent.filter(s => s.channel === 'desktop-pet:shared-state').slice(-2).map(s => s.payload), ['B', 'B']);
        } else if (config.operation === 'intent') {
          assert.equal(result, undefined);
          const valid = intent && typeof intent === 'object';
          const excluded = config.excluded === undefined ? null : config.excluded;
          const expected = valid ? roles.filter(role => eligible(role) && (config.nullId && role === 'main' ? null : roles.indexOf(role) + 1) !== excluded) : [];
          assert.deepEqual(sent.map(s => s.role), expected);
          if (!valid) assert.deepEqual(calls, [], 'invalid presentation intent must not read window state');
          assert.ok(!calls.some(c => String(c[0]).startsWith('visible:')), 'presentation intent includes hidden windows');
        } else assert.equal(result, Boolean(config.visibility !== undefined ? config.visibility : config.settings === 'visible'));
      }
      if (race === 'mainSendClosesSettings' || race === 'visibleSwitchSettings') assert.ok(sent.every(s => s.payload === true));
      if (race === 'mainSendReplacesChat') assert.ok(sent.every(s => s.payload === true));
      if (race === 'sharedReadReplacesSettings') { assert.equal(sent[0].id, 2); assert.deepEqual(sent.map(s => s.payload), ['B', 'B']); }
      if (race === 'settingsSendSwapsState') assert.deepEqual(sent.map(s => s.payload), ['A', 'B']);
      if (race === 'sharedReadClearsState') assert.deepEqual(sent.map(s => s.payload), [null, null]);
      if (race === 'filterReplacesOwners' || race === 'sendReplacesOwners') assert.deepEqual(sent.map(s => s.id), [1, 2, 3]);
      if (race === 'idSwapsContents') assert.deepEqual(sent.map(s => s.id), [101, 102, 103]);
      if (race === 'filterDestroysChat') assert.deepEqual(sent.map(s => s.role), ['main', 'settings']);
      if (race === 'mainSendClearsSettings' || race === 'sendSettingsClearsChat') assert.equal(sent.length, 1);
      if (race === 'destroySwitchSettings') assert.equal(result, false);
    } catch (caught: any) {
      if (race === 'settingsDestroyClears') assert.ok(caught instanceof TypeError);
      else { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)?.[0], failure); }
      thrown = { name: caught.name, message: caught.message };
    }
    assert.equal(Boolean(thrown), Boolean(failure || race === 'settingsDestroyClears'));
    outputs.push({ config, failure, race, calls, sent, result, secondResult, thrown, state: state?.tag ?? state });
  }
}

const root = fs.readFileSync('electron/windowManager.cjs', 'utf8');
const start = root.indexOf('= createWindowResourceMessagingControllers(');
assert.ok(start >= 0 && start < root.indexOf('= createSettingsStatePresentationControllers('));
assert.ok(start < root.indexOf('= createMainWindowLifecycleControllers('));
assert.ok(start < root.indexOf('= createAuxiliaryWindowContentControllers('));
assert.match(fs.readFileSync('electron/windowManager/windowStateMessaging.cjs', 'utf8'), /createWindowStateBroadcaster\(\{\s*getMainWindow: \(\) => managerState\.mainWindow, getSettingsWindow: \(\) => managerState\.settingsWindow, getChatWindow: \(\) => managerState\.chatWindow, getSharedState,/);
assert.match(fs.readFileSync('electron/windowManager/windowManagerStateControls.cjs', 'utf8'), /function getSharedState\(\)\s*\{\s*return managerState\.latestSharedState;/);
assert.equal(exerciseWindowMessaging().length, 557);
console.log('Window state messaging smoke passed (192 live state matrices, 320 intent recipients, 9 value cases, 18 dependency errors, 15 races, 3 coercion cases).');
