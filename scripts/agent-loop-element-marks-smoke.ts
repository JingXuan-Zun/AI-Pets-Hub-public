import assert from 'node:assert/strict';
import { buildElementMarks, formatElementMarks, mapOcrLinesToScreen } from '../src/agent/loop/elementMarks';

// WeGame login window as seen in live runs: 1191x670 at (685,385); UIA exposes no named
// buttons, so the clickable labels come from OCR on a 1191x670 window image.
const windowBox = { height: 670, width: 1191, x: 685, y: 385 };
const ocrLines = mapOcrLinesToScreen([
  { height: 30, text: 'WeGame', width: 150, x: 520, y: 220 },
  { height: 22, text: '10000001', width: 110, x: 540, y: 405 },
  { height: 24, text: '快捷安全登录', width: 110, x: 540, y: 467 },
  { height: 18, text: 'QQ 账号密码登录', width: 120, x: 535, y: 609 },
], { imageHeight: 670, imageWidth: 1191, windowBox });

const marks = buildElementMarks({ ocrLines, windowBox });
assert.deepEqual(marks.map((mark) => mark.label), ['WeGame', '10000001', '快捷安全登录', 'QQ 账号密码登录'], 'reading order');
const login = marks.find((mark) => mark.label === '快捷安全登录');
assert.deepEqual(login?.center, { x: 1280, y: 864 }, 'OCR box mapped to native screen; click point is the box center');

// A half-resolution image maps back to full native coordinates.
const halfScale = mapOcrLinesToScreen([{ height: 12, text: '快捷安全登录', width: 55, x: 270, y: 233 }], { imageHeight: 335, imageWidth: 595, windowBox });
assert.equal(Math.round(halfScale[0].x), 685 + Math.round(270 * (1191 / 595)));

// UIA controls: named controls win over repeated OCR text; unnamed controls take the OCR label.
const withControls = buildElementMarks({
  controls: [
    { bounds: { height: 40, width: 224, x: 1168, y: 844 }, controlType: 'Button', name: '' },
    { bounds: { height: 30, width: 80, x: 300, y: 200 }, controlType: 'Button', name: '启动' },
    { bounds: { height: 30, width: 80, x: 300, y: 260 }, controlType: 'Button', name: '隐藏', offscreen: true },
    { bounds: { height: 30, width: 80, x: 300, y: 320 }, controlType: 'Pane', name: '面板' },
    { bounds: { height: 30, width: 80, x: 300, y: 380 }, controlType: 'Button', name: '禁用', enabled: false },
  ],
  ocrLines: [
    { height: 24, text: '快捷安全登录', width: 110, x: 1225, y: 852 },
    { height: 20, text: '启动', width: 40, x: 320, y: 205 },
  ],
});
assert.deepEqual(withControls.map((mark) => `${mark.role}:${mark.label}`), ['按钮:启动', '按钮:禁用', '按钮:快捷安全登录'],
  'offscreen and non-interactive controls dropped; duplicate OCR text merged into its control');
assert.equal(withControls.find((mark) => mark.label === '禁用')?.enabled, false);
assert.equal(withControls.find((mark) => mark.label === '快捷安全登录')?.source, 'uia', 'unnamed button labelled by the OCR text inside it');

// Elements outside the observed window are ignored; ids are 1-based and contiguous.
const clipped = buildElementMarks({ ocrLines: [{ height: 20, text: '外部', width: 40, x: 10, y: 10 }, ...ocrLines], windowBox });
assert.ok(!clipped.some((mark) => mark.label === '外部'));
assert.deepEqual(clipped.map((mark) => mark.id), [1, 2, 3, 4]);

const text = formatElementMarks(marks);
assert.match(text, /^\[3\] 文字 "快捷安全登录" @1280,864$/mu);

// Windows OCR spaces out Chinese characters; labels are joined back, mixed text keeps word gaps.
const spaced = buildElementMarks({ ocrLines: [{ height: 20, text: '快 捷 安 全 登 录', width: 120, x: 10, y: 10 }, { height: 20, text: 'QQ 账 号 密 码 登 录', width: 120, x: 10, y: 60 }] });
assert.deepEqual(spaced.map((mark) => mark.label), ['快捷安全登录', 'QQ 账号密码登录']);

console.log('agent loop element marks smoke ok');
