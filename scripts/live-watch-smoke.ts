// Watch-along (11-20): when the eyes look, where the ears cut, when she is asked, what she is
// told and what is spoken. Numbers from the live experiments on a 36 s video.
import assert from 'node:assert/strict';
import {
  buildLiveLineInstruction, buildLookPrompt, changedCells, changeInArea, cleanLiveLine, findHeardCut, isLivePass, isSongLikely,
  isUsefulHeard, isWatchAlongStop, LIVE_WATCH_LIMITS, motionBox, normalizeHeardLanguage, shouldAsk, shouldLook,
  THUMB_SIZE, watchArea,
} from '../src/live-watch/liveWatchRules';
import { liveWatchStore } from '../src/live-watch/liveWatchStore';
import { BUILTIN_PLATFORM_CAPABILITIES } from '../src/platform-capabilities/builtinPlatformCapabilities';

let checks = 0;
const check = (condition: boolean, label: string) => { assert.ok(condition, label); checks += 1; };

// Eyes: change is the share of cells that changed, measured where the video is.
check(!shouldLook(0.1, 5), 'a small change is not looked at');
check(!shouldLook(0.3, 1) && shouldLook(0.3, 3), 'a normal change waits for the look gap');
check(!shouldLook(0.8, 1) && shouldLook(0.8, 1.5), 'a scene cut is looked at sooner, not every check');
check(shouldLook(0.05, 10) && !shouldLook(0, 30), 'a little movement is still looked at after a quiet stretch; a still picture is not');
check(shouldLook(Infinity, Infinity), 'the first picture is always looked at');
const S = THUMB_SIZE;
// A video window covering cells x 10–25, y 20–28 of a 48×48 screen thumbnail; the rest is still.
const still = new Uint8Array(S * S).fill(40);
const frame = (value: number) => { const cells = new Uint8Array(still); for (let y = 20; y <= 28; y += 1) for (let x = 10; x <= 25; x += 1) cells[y * S + x] = value; return cells; };
const moved = changedCells(frame(200), frame(60));
const box = motionBox([moved]);
check(box?.left === 10 && box.right === 25 && box.top === 20 && box.bottom === 28, 'the moving area is found');
const area = watchArea(box);
check(area.left === 9 && area.right === 26 && area.top === 19 && area.bottom === 29, 'the look area is the window plus a cell of margin');
check(changeInArea(moved, area) > 0.7 && changeInArea(moved, watchArea(null)) < 0.07, 'measured in the window, a fast video counts as changed (it does not across the whole screen)');
// The pet animating in a corner (cells 40–43, 40–44) must not stretch the area over the desktop.
const withPet = new Uint8Array(moved);
for (let y = 40; y <= 44; y += 1) for (let x = 40; x <= 43; x += 1) withPet[y * S + x] = 1;
const videoOnly = motionBox([withPet]);
check(videoOnly?.left === 10 && videoOnly.right === 25 && videoOnly.bottom === 28, 'the biggest moving patch is the video, not the pet in the corner');
const split = new Uint8Array(S * S);
for (let y = 10; y <= 20; y += 1) { split[y * S + 5] = 1; split[y * S + 7] = 1; } // two moving parts one still column apart
check(motionBox([split])?.left === 5 && motionBox([split])?.right === 7, 'parts of one video with a still strip between are joined');
const everywhere = changedCells(new Uint8Array(S * S).fill(200), still);
check(watchArea(motionBox([everywhere])).right === S - 1, 'a full-screen video uses the whole picture');
check(watchArea(motionBox([changedCells(frame(60), frame(60))])).right === S - 1, 'nothing moving: the whole picture');

// Ears: scraps and song lyrics.
for (const text of ['。', 'The.', '.', '然。', 'uh']) check(!isUsefulHeard(text), `scrap dropped: ${text}`);
for (const text of ['是在一个。', '这个开源项目是专为agent打造的', 'I love it.']) check(isUsefulHeard(text), `kept: ${text}`);
check(isSongLikely(['en', 'en', 'zh', 'ja', 'zh']) && !isSongLikely(['zh', 'zh', 'zh', 'zh', 'zh']) && !isSongLikely(['en', 'zh']), 'jumping languages mean song lyrics; one language is someone talking');
check(normalizeHeardLanguage('<|ja|>') === 'ja' && normalizeHeardLanguage(undefined) === '', 'language tags are normalized');
const songInstruction = buildLiveLineInstruction({ heard: [{ at: 8, song: true, text: '未来我的こ' }], now: 10, said: [], seen: [] });
check(/背景歌曲的歌词，多半听错/u.test(songInstruction) && /不是台词/u.test(songInstruction), 'lyrics are marked as lyrics, not dialogue');
check(!/背景歌曲/u.test(buildLiveLineInstruction({ heard: [{ at: 8, text: '这个开源项目' }], now: 10, said: [], seen: [] })), 'talking is not marked');

// Ears: tokens as the recognizer gives them (punctuation tokens with times).
const tokens = ['接', '上', '它', '。', '最', '有', '意', '思', '的', '是'];
const times = [0.3, 0.5, 0.7, 0.82, 0.94, 1.1, 1.3, 1.5, 1.7, 1.9];
check(Math.abs((findHeardCut(tokens, times, 2.1, false) ?? 0) - 0.88) < 0.01, 'cut right after the finished sentence');
check(findHeardCut(['最', '有', '意', '思'], [0.1, 0.3, 0.5, 0.7], 1.0, false) === null, 'a half sentence still being spoken waits');
check(Math.abs((findHeardCut(['好', '吧'], [0.1, 0.3], 1.2, false) ?? 0) - 0.6) < 0.01, 'a pause after the last word ends it');
const long = Array.from({ length: 30 }, (_, index) => (index === 12 ? '，' : '字'));
const longTimes = long.map((_, index) => 0.1 + index * 0.27);
const forced = findHeardCut(long, longTimes, 8.2, false);
check(forced !== null && Math.abs(forced - (longTimes[12] + longTimes[13]) / 2) < 0.01, 'a long run is cut at the comma after 8 s');
check(findHeardCut(['看'], [0.2], 0.4, true) !== null, 'the last piece is always taken when it ends');
check(findHeardCut([], [], 3, false) === null, 'nothing heard, nothing cut');

// When she is asked.
const base = { asking: false, fresh: true, lastAskAt: -Infinity, lastSpokeAt: -Infinity, now: 10 };
check(shouldAsk(base), 'something new arrived: ask');
check(!shouldAsk({ ...base, fresh: false }), 'nothing new: do not ask');
check(!shouldAsk({ ...base, asking: true }), 'one ask at a time');
check(!shouldAsk({ ...base, lastAskAt: 7 }), 'not again within the ask gap');
check(!shouldAsk({ ...base, lastSpokeAt: 0 }) && shouldAsk({ ...base, lastSpokeAt: 10 - LIVE_WATCH_LIMITS.speakGap }), 'quiet for 15 s after a line');

// What she is told.
const instruction = buildLiveLineInstruction({
  heard: [{ at: 4, text: '这个开源项目是专为 agent 打造的' }],
  now: 12,
  said: ['标题党也太夸张了吧'],
  seen: [{ at: 9, text: '机场跑道上停着几架客机' }],
});
check(instruction.includes('（8 秒前）这个开源项目') && instruction.includes('（3 秒前）机场跑道'), 'every item says how long ago');
check(/默认回 PASS/u.test(instruction) && /三十个字以内/u.test(instruction) && /不写括号里的动作/u.test(instruction), 'PASS by default, one short line, no stage actions');
check(instruction.includes('标题党也太夸张了吧') && /别下结论/u.test(instruction), 'knows what she said; no verdicts on unclear parts');
check(/这不是用户发来的消息/u.test(instruction), 'not mistaken for the user speaking');
check(/说清是哪一个/u.test(instruction) && /别说它涨了或掉了/u.test(instruction), 'numbers: say which one, no up/down without the same number read twice');
const lookPrompt = buildLookPrompt('');
check(/每个数字都要说清是哪一个/u.test(lookPrompt) && /倒计时变少是时间在走/u.test(lookPrompt) && /伤害数字每张都不一样/u.test(lookPrompt), 'the eyes name every number and do not read a countdown or damage as a score change');

// What is spoken.
check(isLivePass('PASS') && isLivePass(' pass。') && isLivePass('') && !isLivePass('这个挺好玩'), 'PASS and empty mean silent');
check(cleanLiveLine('（偏头看你）\n\n这一步倒是省事。') === '这一步倒是省事。', 'stage directions and breaks dropped');
check(cleanLiveLine('字'.repeat(100)).length === LIVE_WATCH_LIMITS.maxLineChars, 'a runaway line is capped');

// Stop words.
for (const text of ['不看了', '别看了', '不用陪我看了', '停止一起看', '关掉陪看']) check(isWatchAlongStop(text), `stop: ${text}`);
for (const text of ['看看这个', '一起看视频吧', '这个视频好看', '我不看好这个']) check(!isWatchAlongStop(text), `not a stop: ${text}`);

// Session state and the capability.
check(liveWatchStore.start('video') && liveWatchStore.getState().active && !liveWatchStore.start('video'), 'starts once');
check(liveWatchStore.stop() && !liveWatchStore.getState().active && !liveWatchStore.stop(), 'stops once');
const capability = BUILTIN_PLATFORM_CAPABILITIES.find((item) => item.id === 'life_companion.watch_along');
check(Boolean(capability) && capability?.risk === 'change', 'watch_along capability is registered');
check(capability?.confirmWhen?.({ on: true }) === true && capability?.confirmWhen?.({ on: false }) === false, 'starting is asked first, stopping is not');
const context = {} as Parameters<NonNullable<typeof capability>['run']>[0];
const started = await capability!.run(context, { on: true });
check(started.ok && liveWatchStore.getState().active, 'the capability starts a session');
const stopped = await capability!.run(context, { on: false });
check(stopped.ok && !liveWatchStore.getState().active, 'the capability stops it');

console.log(`live-watch smoke: ${checks} checks passed`);
