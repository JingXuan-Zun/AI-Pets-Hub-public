import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  collectOcrSnapTargets,
  scoreOcrTextMatch,
  matchOcrSnapTarget,
  normalizeOcrText,
} from '../src/agent/visual/visualSnapshotOcrSnap';
import { createScreenTextRecognitionScript } from '../electron/screenTextRecognition.cjs';

// Real Windows OCR output for the WeGame login window (1190x670) from a live agent test.
const lines = [
  { height: 21, text: '孬', width: 25, x: 485, y: 409 },
  { height: 24, text: 'WeGame', width: 143, x: 523, y: 225 },
  { height: 12, text: '5757 264', width: 80, x: 555, y: 410 },
  { height: 18, text: '快 捷 安 全 登 录', width: 108, x: 541, y: 471 },
  { height: 14, text: 'QQ 账 号 匣 码 登 景', width: 119, x: 536, y: 612 },
];
const imageSize = { height: 670, width: 1190 };
// The vision model pointed at the account dropdown (ratio 0.5013, 0.6478), 46px above the button.
const approx = { x: 0.5013 * imageSize.width, y: 0.6478 * imageSize.height };

assert.equal(normalizeOcrText('快 捷 安 全 登 录'), '快捷安全登录', 'OCR spacing between CJK characters is ignored');
const targets = collectOcrSnapTargets(['快捷安全登录', 'Click "快捷安全登录" for login']);
assert.ok(targets.includes('快捷安全登录'), 'quoted labels in the model\'s primary action become targets');

const match = matchOcrSnapTarget({ approx, imageSize, lines, targets });
assert.ok(match, 'the login button text is found near the model point');
assert.equal(Math.round(match!.centerX), 595);
assert.equal(Math.round(match!.centerY), 480, 'the click moves from the dropdown (y≈434) onto the button (y≈480)');

assert.equal(matchOcrSnapTarget({ approx, imageSize, lines, targets: collectOcrSnapTargets(['开始游戏']) }), null,
  'no matching text: the model point is left unchanged');
// The model paraphrased the label ("快速" for the real "快捷"); a long shared run still matches.
const paraphrased = matchOcrSnapTarget({ approx, imageSize, lines, targets: collectOcrSnapTargets(['点击橙色主按钮进行快速安全登录', '快速安全登录']) });
assert.equal(Math.round(paraphrased?.centerY ?? 0), 480, 'a one-character paraphrase still snaps onto the button');
assert.equal(scoreOcrTextMatch('快捷安全登录', '退出登录'), 0, 'sharing only "登录" is not a match');
const far = { x: 50, y: 50 };
assert.equal(matchOcrSnapTarget({ approx: far, imageSize, lines, targets }), null,
  'text far from where the model pointed is not used');

// The OCR script prefers Chinese and writes UTF-8 JSON to a file (console output would be GBK).
const script = createScreenTextRecognitionScript("C:\\tmp\\a'b.png", 'C:\\tmp\\out.json');
assert.match(script, /zh-Hans-CN/u);
assert.match(script, /'C:\\tmp\\a''b\.png'/u, 'paths are quoted for PowerShell');
assert.match(script, /UTF8Encoding/u);
assert.ok(fs.existsSync('electron/screenTextRecognition.cjs'));

console.log('agent visual ocr snap smoke ok');
