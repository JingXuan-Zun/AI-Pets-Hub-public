import assert from 'node:assert/strict';
import { splitBubbleText } from '../src/components/chat/PetSpeechBubbleCard';
import { splitMessageTextByBrackets } from '../src/components/chat/message/messageTextUtils';

// From a real reply: "【…}" opens with one bracket and closes with another. Every later line
// used to stay "inside the bracket" and lost the spoken-text colour.
const text = '（走到楼梯口又回头）**至于“再继续”……这话妾身可记下了。** 【嘴角压不住地弯}\n\n（上楼时脚步比方才稳当）**浴室的温泉池水妾身让它先蓄着。** 【回头看你一眼】';
const spoken = splitBubbleText(text).filter((part) => !part.isBracket).map((part) => part.text).join('');
assert.match(spoken, /至于“再继续”/u);
assert.match(spoken, /浴室的温泉池水妾身让它先蓄着/u, 'a line after a mismatched bracket is spoken text again');

// A bracket left open ends at the line break.
const open = splitBubbleText('（还没写完的动作\n这句是说出来的话');
assert.deepEqual(open.filter((part) => !part.isBracket).map((part) => part.text.trim()).filter(Boolean), ['这句是说出来的话']);
// Bold markers never show as asterisks: a kaomoji splits the text so the closing "**" lands in
// another piece, and models also write "***台词***".
const shownText = (input: string) => splitMessageTextByBrackets(input).map((part) => part.text).join('');
assert.equal(shownText('**尊上大人～现在快到六点半了哦？'), '尊上大人～现在快到六点半了哦？');
assert.equal(shownText('** 【轻笑声】'), ' 【轻笑声】');
assert.equal(shownText('***“不过啊，走路都飘。”***'), '“不过啊，走路都飘。”');
assert.ok(splitMessageTextByBrackets('**说出来的话**').every((part) => part.bold));
assert.ok(!splitBubbleText('**尊上～(・_・ヾ** ***“行了”***').some((part) => part.text.includes('*')), 'the desktop bubble drops bold markers too');
console.log('action bracket color smoke ok');
