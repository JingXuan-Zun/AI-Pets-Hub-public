/**
 * Recognizes a user telling the character to stop watching the screen, locally and
 * instantly. A refusal needs both a "stop/don't" word and a "look/watch" word close
 * together, so ordinary uses of 看 ("你看这个", "我在看电影") do not end watching.
 */
const STOP_THEN_LOOK = /(不用|不要|不许|不准|不能|别|甭|停止|停下|停|关掉|关闭|断开|不想让你|不让你)[^。！？!?\n]{0,6}(看|盯|观看|偷看|观察|瞧|截图|截屏)/u;
const LOOK_THEN_STOP = /(看|盯|观看|观察)[^。！？!?\n]{0,4}(够了|停一下|停下|停了|先停|别看了|不用了|可以了|结束)/u;
const STOP_WATCH_COMMANDS = /(断开观看|关闭观看|停止观看|别再看|不准再看|不许再看)/u;
// "你不看看吗" style questions ask the character to look, they don't refuse.
const INVITATION = /(看看吗|看一下吗|看不看|要不要看|你看看|帮我看|快看)/u;

export function isScreenWatchRefusal(text: string) {
  const value = text.replace(/\s+/gu, '');
  if (!value) return false;
  if (STOP_WATCH_COMMANDS.test(value)) return true;
  if (INVITATION.test(value) && !/(不用|不要|别|不准|不许)/u.test(value)) return false;
  return STOP_THEN_LOOK.test(value) || LOOK_THEN_STOP.test(value);
}

const ACCEPTANCE = /^(好|好的|好啊|好呀|好吧|可以|可以的|行|行啊|嗯|嗯嗯|ok|okay|看吧|你看吧|看呗|来吧|当然|当然可以|没问题)[。！!~～,，]*$/iu;

/** A short "yes" right after the character asked to watch. */
export function isScreenWatchAcceptance(text: string) {
  return ACCEPTANCE.test(text.replace(/\s+/gu, ''));
}
