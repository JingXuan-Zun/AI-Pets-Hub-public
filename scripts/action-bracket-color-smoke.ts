import assert from 'node:assert/strict';
import { splitBubbleText } from '../src/components/chat/PetSpeechBubbleCard';

// From a real reply: "【…}" opens with one bracket and closes with another. Every later line
// used to stay "inside the bracket" and lost the spoken-text colour.
const text = '（走到楼梯口又回头）**至于“再继续”……这话妾身可记下了。** 【嘴角压不住地弯}\n\n（上楼时脚步比方才稳当）**浴室的温泉池水妾身让它先蓄着。** 【回头看你一眼】';
const spoken = splitBubbleText(text).filter((part) => !part.isBracket).map((part) => part.text).join('');
assert.match(spoken, /至于“再继续”/u);
assert.match(spoken, /浴室的温泉池水妾身让它先蓄着/u, 'a line after a mismatched bracket is spoken text again');

// A bracket left open ends at the line break.
const open = splitBubbleText('（还没写完的动作\n这句是说出来的话');
assert.deepEqual(open.filter((part) => !part.isBracket).map((part) => part.text.trim()).filter(Boolean), ['这句是说出来的话']);
console.log('action bracket color smoke ok');
