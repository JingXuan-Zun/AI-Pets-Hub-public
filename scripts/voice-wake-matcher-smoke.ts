import assert from 'node:assert/strict';
import { matchWakePhrase, normalizeWakeText, parseWakePhrases } from '../src/voice/voiceWakeMatcher';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

check(parseWakePhrases('你好小桃，  小桃 ; a , 嘿 小桃'), ['你好小桃', '小桃', '嘿小桃'], 'parse list, drop 1-char');
check(parseWakePhrases('', '甜心小桃'), ['甜心小桃'], 'fallback to pet name');
check(parseWakePhrases('', ''), [], 'nothing configured');
check(normalizeWakeText('Hi，小桃！'), 'hi小桃', 'normalize');

const phrases = ['你好小桃', '小桃'];
check(matchWakePhrase('你好小桃，现在几点了？', phrases), { phrase: '你好小桃', remainder: '现在几点了？' }, 'wake + remainder');
check(matchWakePhrase('你好，小桃。', phrases), { phrase: '你好小桃', remainder: '' }, 'punctuation between wake chars');
check(matchWakePhrase('你好小淘', ['你好小桃']), { phrase: '你好小桃', remainder: '' }, 'one homophone tolerated for 3+ chars');
check(matchWakePhrase('你号小淘', ['你好小桃']), { phrase: '你好小桃', remainder: '' }, 'same-sound characters count as equal');
check(matchWakePhrase('他看小桃', ['你好小桃']), null, 'two different syllables rejected');
// Real misrecognitions from testing: same pronunciation, different characters.
check(matchWakePhrase('小淘紫，今晚上有什么安排吗？', ['小桃子']), { phrase: '小桃子', remainder: '今晚上有什么安排吗？' }, '小淘紫 wakes 小桃子');
check(matchWakePhrase('阿机晚上有什么安排吗？', ['阿吉']), { phrase: '阿吉', remainder: '晚上有什么安排吗？' }, '2-char phrase by sound');
check(matchWakePhrase('阿家', ['阿吉']), null, '2-char phrase still needs every syllable');
check(matchWakePhrase('小苗子', ['小桃子']), { phrase: '小桃子', remainder: '' }, 'one different syllable tolerated for 3+ chars');
check(matchWakePhrase('张姐在吗', ['长姐']), { phrase: '长姐', remainder: '在吗' }, 'polyphonic character matches any reading');
// Fuzzy sounds (l/n, nasal endings, flat/retroflex) — "高冷" was heard as "高能" in testing.
check(matchWakePhrase('高能，我上次看的那本魔法书', ['高冷']), { phrase: '高冷', remainder: '我上次看的那本魔法书' }, 'l/n and eng fold together');
check(matchWakePhrase('赞姐', ['张姐']), { phrase: '张姐', remainder: '' }, 'zh/z and ang/an fold together');
check(matchWakePhrase('高然，前段时间', ['高冷']), null, 'distinct syllables still differ for 2-char phrases');
check(matchWakePhrase('高然姐，前段时间', ['高冷姐']), { phrase: '高冷姐', remainder: '前段时间' }, '3-char phrase tolerates the one misheard syllable');
check(matchWakePhrase('小淘', ['小桃']), { phrase: '小桃', remainder: '' }, '2-char homophone matches');
check(matchWakePhrase('嗯小桃陪我聊天', ['小桃']), { phrase: '小桃', remainder: '陪我聊天' }, 'phrase mid-sentence');
check(matchWakePhrase('今天天气不错', phrases), null, 'unrelated speech ignored');
check(matchWakePhrase('', phrases), null, 'empty transcript');

console.log(`voice wake matcher passed: ${cases} cases`);
