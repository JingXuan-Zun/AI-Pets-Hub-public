import assert from 'node:assert/strict';
import {
  buildVisibleCharacterReplyText,
  extractCharacterToolInvocations,
  shouldEnforcePersonaExtraInfo,
  stripCharacterToolMarkers,
} from '../src/components/chat/characterToolProtocol';

const message = '（轻轻抖尾巴）我查一下再告诉你。【动�?开心】【查�?今天上海天气�?;
const invocations = extractCharacterToolInvocations(message);

assert.deepEqual(invocations, [
  {
    kind: 'action',
    action: 'HAPPY',
    raw: '【动�?开心�?,
  },
  {
    kind: 'web-search',
    query: '今天上海天气',
    raw: '【查�?今天上海天气�?,
  },
]);
assert.equal(stripCharacterToolMarkers(message), '（轻轻抖尾巴）我查一下再告诉你�?);

assert.deepEqual(
  extractCharacterToolInvocations('[动画:scratch_head][action:sleep]'),
  [
    {
      animationId: 'scratch_head',
      kind: 'animation',
      raw: '[动画:scratch_head]',
    },
    {
      action: 'SLEEPING',
      kind: 'action',
      raw: '[action:sleep]',
    },
  ],
);
assert.equal(stripCharacterToolMarkers('嗯。[动画:scratch_head]好了�?), '嗯。好了�?);

const formatPersona = '你的常规回复格式：“（动作）语言 【附加信息】”。额外信息，包括表情、心情、声音等等用方括号【】括起来�?;
assert.equal(shouldEnforcePersonaExtraInfo(formatPersona), true);
assert.equal(
  buildVisibleCharacterReplyText('（轻轻靠近）我在这里�?, formatPersona),
  '（轻轻靠近）我在这里�?,
);
assert.equal(
  buildVisibleCharacterReplyText('（轻轻靠近）我在这里。【摩擦声�?, formatPersona),
  '（轻轻靠近）我在这里。【摩擦声�?,
);
assert.equal(
  buildVisibleCharacterReplyText('（轻轻靠近）我在这里。【动�?开心�?, formatPersona),
  '（轻轻靠近）我在这里�?,
);
assert.equal(
  buildVisibleCharacterReplyText('我在这里。【小声�?, formatPersona),
  '我在这里。【小声�?,
);
assert.equal(
  buildVisibleCharacterReplyText('(摇尾�? 我马上过来[开心]', formatPersona),
  '(摇尾�? 我马上过来[开心]',
);

console.log('character tool protocol smoke ok');
