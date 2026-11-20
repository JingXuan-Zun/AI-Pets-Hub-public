// Rules of the live companion loop (watch-along now, game companion later): when the eyes look,
// where the ears cut what they heard, when she is asked, and what she is told. Pure functions so
// the smoke can check them; the numbers come from the 2026-11-20 experiments (see
// docs/watch-along-design-20261120.md).

export type LiveWatchMode = 'video';

export const LIVE_WATCH_LIMITS = {
  /** Grey difference (0–255) at which one thumbnail cell counts as changed. */
  cellChange: 24,
  /** Share of cells (inside the moving area) that changed: "the picture changed". */
  change: 0.2,
  /** A scene cut: look sooner than the look gap. */
  cut: 0.7,
  /** Seconds between looks; after a scene cut at least `cutGap`. */
  lookGap: 3,
  cutGap: 1.5,
  /** Something moved but below the bar: still look after this long. */
  idleLook: 10,
  /** Checks (twice a second) that make up the moving area: about the last 5 s. */
  motionChecks: 10,
  /** The moving area is used once it is smaller than this share of the capture. */
  cropBelow: 0.6,
  /** Seconds between asks (PASS answers included). */
  askGap: 5,
  /** Seconds she stays quiet after saying something. */
  speakGap: 15,
  /** The ears cut at the latest after this many seconds of continuous speech. */
  maxHeard: 8,
  /** Quiet seconds after the last word that end a sentence. */
  quietTail: 0.6,
  /** What she is given: the last few heard pieces and looks. */
  heardKept: 4,
  seenKept: 3,
  /** A spoken line is cut to this many characters as a last resort. */
  maxLineChars: 60,
} as const;

// A square grid whatever the capture's shape: a portrait phone video and a landscape screen both
// get enough cells to find where the video is.
export const THUMB_SIZE = 48;

export interface CellBox { bottom: number; left: number; right: number; top: number }

/** Which cells changed between two grey thumbnails (THUMB_SIZE × THUMB_SIZE). */
export function changedCells(first: ArrayLike<number>, second: ArrayLike<number>, limits = LIVE_WATCH_LIMITS) {
  const length = Math.min(first.length, second.length);
  const changed = new Uint8Array(length);
  for (let index = 0; index < length; index += 1) changed[index] = Math.abs(first[index] - second[index]) > limits.cellChange ? 1 : 0;
  return changed;
}

/**
 * Where things move on screen (the video), from the last few checks' changed cells: the box
 * around them, or null while nothing moved. A window covering part of the screen is found
 * this way, and the rest of the desktop (chat, the pet) stops counting as the picture.
 */
export function motionBox(recent: Uint8Array[], size = THUMB_SIZE): CellBox | null {
  const moved = new Uint8Array(size * size);
  for (const cells of recent) for (let index = 0; index < moved.length; index += 1) if (cells[index]) moved[index] = 1;
  // Neighbouring patches of one video (a still background between moving parts) are joined by
  // growing every moving cell by one; the pet's own small animation elsewhere stays apart.
  const grown = new Uint8Array(moved.length);
  for (let index = 0; index < moved.length; index += 1) {
    if (!moved[index]) continue;
    const x = index % size; const y = Math.floor(index / size);
    for (let dy = -1; dy <= 1; dy += 1) for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx; const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < size && ny < size) grown[ny * size + nx] = 1;
    }
  }
  // The biggest patch (by moving cells) is the video.
  const label = new Int32Array(moved.length).fill(-1);
  let best: CellBox | null = null; let bestCount = 0;
  for (let start = 0; start < moved.length; start += 1) {
    if (!grown[start] || label[start] >= 0) continue;
    const queue = [start]; label[start] = start;
    let count = 0; let left = size; let right = -1; let top = size; let bottom = -1;
    while (queue.length) {
      const index = queue.pop()!;
      const x = index % size; const y = Math.floor(index / size);
      if (moved[index]) {
        count += 1;
        if (x < left) left = x; if (x > right) right = x;
        if (y < top) top = y; if (y > bottom) bottom = y;
      }
      for (const next of [x > 0 ? index - 1 : -1, x < size - 1 ? index + 1 : -1, y > 0 ? index - size : -1, y < size - 1 ? index + size : -1]) {
        if (next >= 0 && grown[next] && label[next] < 0) { label[next] = start; queue.push(next); }
      }
    }
    if (count > bestCount) { bestCount = count; best = { bottom, left, right, top }; }
  }
  return best;
}

/** The box to measure and to look at: the moving area when it is clearly part of the capture. */
export function watchArea(box: CellBox | null, size = THUMB_SIZE, limits = LIVE_WATCH_LIMITS): CellBox {
  const whole = { bottom: size - 1, left: 0, right: size - 1, top: 0 };
  if (!box) return whole;
  const width = box.right - box.left + 1; const height = box.bottom - box.top + 1;
  if (width < 4 || height < 4 || (width * height) / (size * size) >= limits.cropBelow) return whole;
  return { bottom: Math.min(size - 1, box.bottom + 1), left: Math.max(0, box.left - 1), right: Math.min(size - 1, box.right + 1), top: Math.max(0, box.top - 1) };
}

/** Share of the area's cells that changed. */
export function changeInArea(cells: Uint8Array, area: CellBox, size = THUMB_SIZE) {
  let changed = 0; let total = 0;
  for (let y = area.top; y <= area.bottom; y += 1) {
    for (let x = area.left; x <= area.right; x += 1) { total += 1; changed += cells[y * size + x] ?? 0; }
  }
  return total ? changed / total : 0;
}

/**
 * Look now? A real change after the look gap, a scene cut a little sooner, and any movement at
 * all after a long quiet stretch. Measured on 11-20: a talking video changes ~0.27 of the area
 * per second, a fast game ~0.55.
 */
export function shouldLook(change: number, secondsSinceLook: number, limits = LIVE_WATCH_LIMITS) {
  if (change >= limits.cut) return secondsSinceLook >= limits.cutGap;
  if (change >= limits.change) return secondsSinceLook >= limits.lookGap;
  return change > 0 && secondsSinceLook >= limits.idleLook;
}

/**
 * Where to cut what the ears heard since the last cut. `tokens`/`times` come from the local
 * recognizer (punctuation tokens included, each with its start second). Returns seconds from the
 * window start, or null to keep listening.
 */
export function findHeardCut(tokens: string[], times: number[], windowSeconds: number, final: boolean, limits = LIVE_WATCH_LIMITS) {
  if (!tokens.length || tokens.length !== times.length) return null;
  const lastTime = times[times.length - 1];
  if (final || windowSeconds - lastTime >= limits.quietTail) return Math.min(windowSeconds, lastTime + 0.3);
  for (let index = tokens.length - 2; index >= 0; index -= 1) {
    if (/[。？！?!]/u.test(tokens[index])) return (times[index] + times[index + 1]) / 2;
  }
  if (windowSeconds < limits.maxHeard || times.length < 2) return null;
  for (let index = tokens.length - 2; index >= 0; index -= 1) {
    if (/[，,、；;]/u.test(tokens[index])) return (times[index] + times[index + 1]) / 2;
  }
  let best = 0; let cut: number | null = null;
  for (let index = 1; index < times.length; index += 1) {
    const gap = times[index] - times[index - 1];
    if (gap > best) { best = gap; cut = (times[index] + times[index - 1]) / 2; }
  }
  return cut;
}

/** Ask her now? Something new arrived, not asked a moment ago, and she has not just spoken. */
export function shouldAsk(state: { asking: boolean; fresh: boolean; now: number; lastAskAt: number; lastSpokeAt: number }, limits = LIVE_WATCH_LIMITS) {
  if (state.asking || !state.fresh) return false;
  return state.now - state.lastAskAt >= limits.askGap && state.now - state.lastSpokeAt >= limits.speakGap;
}

/** `song`: probably lyrics of background music (recognized badly), not someone talking. */
export interface LiveHeard { at: number; song?: boolean; text: string }
export interface LiveSeen { at: number; text: string }

/** A recognized piece worth keeping: at least a few real characters, not "。" or "The.". */
export function isUsefulHeard(text: string) {
  const letters = text.replace(/[\s\p{P}\p{S}]/gu, '');
  return letters.length >= 3 && !/^(the|a|and|so|oh|uh|um)$/iu.test(letters);
}

const SONG_LANGUAGE_WINDOW = 5;

/**
 * Song lyrics under a game or music video come out as scraps that jump between languages
 * (11-20 game video: en, en, zh, ja, zh, ja…), while someone talking stays in one language.
 * True once the last few pieces use two or more languages.
 */
export function isSongLikely(recentLanguages: string[]) {
  const known = recentLanguages.slice(-SONG_LANGUAGE_WINDOW).filter((lang) => /^(zh|en|ja|ko|yue)$/u.test(lang));
  return known.length >= 3 && new Set(known).size >= 2;
}

/** SenseVoice's "<|zh|>" → "zh". */
export function normalizeHeardLanguage(lang: unknown) {
  return typeof lang === 'string' ? lang.replace(/[<|>]/gu, '').toLowerCase() : '';
}

export const LIVE_PASS = 'PASS';

export function buildLookPrompt(previous: string) {
  return [
    `这是用户正在看的视频此刻的画面。上一张画面是：${previous || '（第一张）'}`,
    '用一两句中文写这张画面有什么（和上一张比变了什么）。说出具体是什么东西（比如货轮和吊车、飞机、沙发、人在干什么），不要只说“一个场景”。画面上的大字和字幕照抄，小字跳过。只写看得到的。',
    // 11-20 game video: five kinds of numbers on one screen; unnamed numbers made her say the score fell.
    '画面上有数字时（游戏界面、比分、计时），每个数字都要说清是哪一个：照抄它旁边的标签，没有标签就说位置和样子，比如“右上 Score 131/6,000”“左上连击 03、1664 PTS”“右上倒计时 02:41”“中间飘出来的伤害数字 10457”。只有同一个标签的数字和上一张比才说涨了还是少了；倒计时变少是时间在走，飘出来的伤害数字每张都不一样，不算涨跌。',
  ].join('\n');
}

/** What she is told when asked; `now` and every `at` are seconds since watching started. */
export function buildLiveLineInstruction(input: { heard: LiveHeard[]; now: number; said: string[]; seen: LiveSeen[] }, limits = LIVE_WATCH_LIMITS) {
  const ago = (at: number) => `${Math.max(0, Math.round(input.now - at))} 秒前`;
  const recentHeard = input.heard.slice(-limits.heardKept);
  const heard = recentHeard.map((item) => `（${ago(item.at)}${item.song ? '，背景歌曲的歌词，多半听错' : ''}）${item.text}`).join('\n') || '（还没听到有人说话）';
  const seen = input.seen.slice(-limits.seenKept).map((item) => `（${ago(item.at)}）${item.text}`).join('\n') || '（还没看清）';
  const songNote = recentHeard.some((item) => item.song)
    ? '视频里放着带歌词的背景音乐，标着“背景歌曲”的是识别出来的歌词碎片，不是台词，别当成有人在说话，也别去解读这些词。'
    : '';
  return [
    '（这不是用户发来的消息。你正和用户一起在电脑上看视频，还在继续播。）',
    `刚听到的（本地语音识别，英文名词常被听错，比如 Claude Code 会被听成 cloud code，结合画面理解）：\n${heard}${songNote ? `\n${songNote}` : ''}`,
    `刚看到的画面：\n${seen}`,
    `你这次已经说过的：${input.said.slice(-4).join(' / ') || '（还没说过）'}`,
    `真人陪着看视频，大多数时候是安静看着的。所以默认回 ${LIVE_PASS}（只回这四个字母）。只有眼前这一刻真的戳到你了（特别有意思、特别新鲜、想吐槽、想问他），才按你自己的性格说一句短话，口语，一读就懂。只说最近几秒的东西，十几秒前的已经过去了就别提。不复述画面，不重复说过的，不写分析。`,
    '这句话是要念出来的，视频还在放：只说一句，三十个字以内；不写括号里的动作、神态，不分段。没听清、没看懂的地方别下结论，也别去评判做视频的人。',
    '提到数字要说清是哪一个（总分、连击、伤害、倒计时……），别只说“分数”；画面描述里没写同一个数字前后变了多少，就别说它涨了或掉了。',
  ].join('\n\n');
}

export function isLivePass(reply: string) {
  return /^\s*PASS\b/iu.test(reply) || !reply.trim();
}

/** What is spoken: stage directions dropped, one line, capped. */
export function cleanLiveLine(reply: string, limits = LIVE_WATCH_LIMITS) {
  const line = reply.replace(/（[^）]*）|\([^)]*\)|\*[^*]*\*/gu, '').replace(/\s*\n+\s*/gu, '').trim();
  return line.length > limits.maxLineChars ? `${line.slice(0, limits.maxLineChars - 1)}…` : line;
}

/** "陪我看视频" / "一起看" starts; "不看了" / "别看了" stops (also used by the chat words hook). */
export function isWatchAlongStop(text: string) {
  return /(不|别|甭)(用|要)?(陪我)?(一起)?看(了|啦)|停(止|下)?(陪看|一起看)|关(掉|闭)?陪看/u.test(text.trim());
}
