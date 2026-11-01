import assert from 'node:assert/strict';
import { buildDiagramDocument, readDiagramAspect, splitMessageDiagrams, stripMessageDiagrams } from '../src/components/chat/message/messageDiagrams';
import { formatQqReplyText } from '../src/qq-bridge/qqBridgeRelay';

// A character's ```svg diagram is drawn in the chat, cleaned of anything that could run or load,
// and left out of speech, the desktop bubble and QQ.
const reply = '剪影就是把人涂成全黑：\n```svg\n<svg viewBox="0 0 200 100" onload="alert(1)"><script>alert(2)</script><rect width="200" height="100" fill="black"/><image href="https://evil.example/x.png"/><use href="#a"/></svg>\n```\n看手臂和身体之间有没有空隙。';
const parts = splitMessageDiagrams(reply);
assert.equal(parts.diagrams.length, 1);
assert.doesNotMatch(parts.diagrams[0], /script|onload|evil\.example/u, 'scripts, handlers and outside links removed');
assert.match(parts.diagrams[0], /href="#a"/u, 'links inside the drawing stay');
assert.equal(parts.text, '剪影就是把人涂成全黑：\n\n看手臂和身体之间有没有空隙。');
assert.equal(parts.drawing, false);

const streaming = splitMessageDiagrams('我画给你看：\n```svg\n<svg viewBox="0 0 10');
assert.deepEqual([streaming.text, streaming.drawing, streaming.diagrams.length], ['我画给你看：', true, 0], 'a block still streaming in is hidden');

assert.equal(splitMessageDiagrams('```svg\nnot svg\n```').diagrams.length, 0, 'only real <svg> markup is drawn');
assert.equal(splitMessageDiagrams('普通回复').text, '普通回复');
assert.equal(stripMessageDiagrams(reply), parts.text);
assert.match(formatQqReplyText(reply), /在电脑上的聊天窗口里看/u);
assert.doesNotMatch(formatQqReplyText(reply), /<svg/u);
assert.equal(readDiagramAspect('<svg viewBox="0 0 200 100"></svg>'), 2);
assert.match(buildDiagramDocument('<svg></svg>'), /default-src 'none'/u, 'the frame may not load anything');
console.log('message diagrams smoke passed');
