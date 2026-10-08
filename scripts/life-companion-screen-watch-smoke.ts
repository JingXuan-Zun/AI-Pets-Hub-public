import assert from 'node:assert/strict';
import {
  classifyLifeCompanionActivity,
  isDesktopPetForeground,
} from '../src/life-companion/screen-watch/lifeCompanionActivity';
import { isScreenWatchAcceptance, isScreenWatchRefusal } from '../src/life-companion/screen-watch/screenWatchRefusal';
import { buildActivityLineInstruction, buildWatchCommentInstruction } from '../src/life-companion/screen-watch/screenWatchComment';
import { normalizeLifeCompanionSettings } from '../src/life-companion/lifeCompanionSettings';
import { readableScreenWatchSummary } from '../src/life-companion/screen-watch/screenWatchLook';
import { screenWatchGaps } from '../src/hooks/useLifeCompanionScreenWatch';
import { pickScreenWatchSource } from '../src/life-companion/screen-watch/screenWatchCapture';
import { keepLiveScreenWatchConsent } from '../src/life-companion/screen-watch/screenWatchConsentMerge';
import type { PetConfig } from '../src/types';

// Saying no in chat stops watching.
for (const text of ['你不用看了', '不准看了！', '别看了', '别盯着我屏幕', '不许再看', '停止观看', '你先别看', '看够了吧', '不想让你看', '断开观看']) {
  assert.ok(isScreenWatchRefusal(text), `refusal: ${text}`);
}
// Ordinary uses of 看 do not.
for (const text of ['你看这个怎么样', '我在看电影', '你看看吗', '帮我看一下这段代码', '今天看了一本书', '看起来不错', '好看吗']) {
  assert.ok(!isScreenWatchRefusal(text), `not a refusal: ${text}`);
}
assert.ok(isScreenWatchRefusal('不用了，你别看了'), 'a refusal still wins over a nearby invitation word');

// Short yes right after the character asked.
for (const text of ['好', '好呀～', '可以', '嗯嗯', 'OK', '你看吧', '当然可以！']) assert.ok(isScreenWatchAcceptance(text), `accept: ${text}`);
for (const text of ['好累啊', '可以帮我写个代码吗', '不可以']) assert.ok(!isScreenWatchAcceptance(text), `not accept: ${text}`);

// Rough activity from the foreground app.
assert.equal(classifyLifeCompanionActivity('chrome.exe', '哔哩哔哩 - 番剧')?.kind, 'video', 'a video site in a browser is video');
assert.equal(classifyLifeCompanionActivity('Code.exe', 'app.ts - Visual Studio Code')?.kind, 'code');
assert.equal(classifyLifeCompanionActivity('steam.exe', 'Steam')?.kind, 'game');
assert.equal(classifyLifeCompanionActivity('cloudmusic.exe', '网易云音乐')?.kind, 'music');
assert.equal(classifyLifeCompanionActivity('WeChat.exe', '微信')?.kind, 'chat');
assert.equal(classifyLifeCompanionActivity('chrome.exe', 'Google')?.kind, 'browser');
assert.equal(classifyLifeCompanionActivity('claude', 'Claude')?.kind, 'ai', 'AI assistants count as an activity');
assert.equal(classifyLifeCompanionActivity('Code.exe', 'Copilot Chat - Visual Studio Code')?.kind, 'code', 'an IDE stays code even with an AI panel');
assert.equal(classifyLifeCompanionActivity('notepad.exe', '无标题'), null, 'unknown apps are not guessed');
assert.ok(isDesktopPetForeground('electron.exe', '控制中心'), 'the pet window itself is not user activity');

// Prompts stay in character and ask to watch only when told to.
const activity = classifyLifeCompanionActivity('steam.exe', 'Steam')!;
assert.match(buildActivityLineInstruction(activity, true), /要不要让你看看/u);
assert.doesNotMatch(buildActivityLineInstruction(activity, false), /要不要让你看看/u);
assert.match(buildWatchCommentInstruction('一个游戏画面', activity), /SKIP/u, 'the character may stay quiet');

// Consent is a persisted setting that defaults to off.
assert.equal(normalizeLifeCompanionSettings({}).screenWatchConsented, false);
assert.equal(normalizeLifeCompanionSettings({ screenWatchConsented: true }).screenWatchConsented, true);

// The recognizer's JSON is reduced to readable text.
assert.equal(readableScreenWatchSummary('{"summary":"在打对战游戏","primaryAction":"无需点击","readableText":[]}'), '在打对战游戏');
assert.equal(readableScreenWatchSummary('一段普通文字'), '一段普通文字');

// User intervals are clamped to the slider ranges, with shorter defaults.
const defaults = normalizeLifeCompanionSettings({});
assert.equal(defaults.desktopActivityAwarenessIntervalMinutes, 15);
assert.equal(defaults.screenWatchIntervalSeconds, 300);
assert.equal(normalizeLifeCompanionSettings({ desktopActivityAwarenessIntervalMinutes: 0 }).desktopActivityAwarenessIntervalMinutes, 1);
assert.equal(normalizeLifeCompanionSettings({ screenWatchIntervalSeconds: 5 }).screenWatchIntervalSeconds, 30);
assert.equal(normalizeLifeCompanionSettings({ screenWatchIntervalSeconds: 99999 }).screenWatchIntervalSeconds, 900);

// A shorter watch interval really looks and speaks more often.
const fast = screenWatchGaps(30); const slow = screenWatchGaps(600);
assert.equal(fast.maxLook, 30_000);
assert.ok(fast.minLook <= fast.maxLook && fast.minLook >= 20_000, 'a window switch looks sooner, but not instantly');
assert.equal(fast.comment, 30_000, 'with a short interval the character may speak each interval');
assert.equal(slow.comment, 180_000, 'remarks stay at most every 3 minutes for long intervals');

// A settings draft must not silently undo a disconnect made from the pet.
const withConsent = (on: boolean) => ({ settings: { lifeCompanion: { screenWatchConsented: on } } }) as unknown as PetConfig;
assert.equal(keepLiveScreenWatchConsent(withConsent(true), withConsent(true), withConsent(false)).settings.lifeCompanion.screenWatchConsented, false,
  'saving an untouched draft keeps the live disconnect');
assert.equal(keepLiveScreenWatchConsent(withConsent(true), withConsent(false), withConsent(false)).settings.lifeCompanion.screenWatchConsented, true,
  'turning it on in settings still wins');
assert.equal(keepLiveScreenWatchConsent(withConsent(false), withConsent(true), withConsent(true)).settings.lifeCompanion.screenWatchConsented, false,
  'turning it off in settings still wins');

// Capture the window in front by handle, never an oversized overlay, else the screen it is on.
const screen1 = { bounds: { height: 1440, width: 2560, x: 0, y: 0 }, displayId: 'd1', id: 'screen:0:0', name: '屏幕 1', type: 'screen' };
const screen2 = { bounds: { height: 1440, width: 3440, x: 2560, y: 0 }, displayId: 'd2', id: 'screen:1:0', name: '屏幕 2', type: 'screen' };
const chatgpt = { bounds: { height: 1188, width: 1695, x: 434, y: 99 }, id: 'window:394970:0', name: 'ChatGPT', type: 'window' };
const duplicateTitle = { bounds: { height: 600, width: 800, x: 0, y: 0 }, id: 'window:111:0', name: 'ChatGPT', type: 'window' };
const overlay = { bounds: { height: 1440, width: 6000, x: 0, y: 0 }, id: 'window:222:0', name: 'Weixin', type: 'window' };
const sources = [screen1, screen2, duplicateTitle, chatgpt, overlay] as DesktopPetCaptureSourceLike[];
assert.equal(pickScreenWatchSource(sources, { displayId: 'd1', hwnd: 394970, title: 'ChatGPT' })?.id, 'window:394970:0', 'matched by window handle');
assert.equal(pickScreenWatchSource(sources, { displayId: 'd2', hwnd: 222, title: 'Weixin' })?.id, 'screen:1:0', 'an all-monitor overlay falls back to its screen');
assert.equal(pickScreenWatchSource(sources, { displayId: 'd2', hwnd: 999, title: '未知' })?.id, 'screen:1:0', 'unknown windows use the screen they are on');

console.log('life companion screen watch smoke ok');
