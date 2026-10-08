import assert from 'node:assert/strict';
import {
  extractCharacterToolInvocations,
  resolveCharacterToolActions,
} from '../src/components/chat/characterToolProtocol';
import {
  resolveExplicitToolActions,
  resolveExpressionActionPlaybackDurationMs,
  resolveMessageExpressionActionQueue,
} from '../src/components/pet/usePetMessageExpressionAction';

assert.deepEqual(resolveCharacterToolActions('开心、难过、睡觉'), [
  'HAPPY',
  'SAD',
  'SLEEPING',
]);

assert.deepEqual(resolveCharacterToolActions('害羞 然后 生气 再 闭眼'), [
  'HAPPY',
  'SAD',
  'SLEEPING',
]);

assert.deepEqual(
  extractCharacterToolInvocations('我来了。【动作:害羞】【动作:生气】【状态:放松】')
    .filter((invocation) => invocation.kind === 'action')
    .map((invocation) => invocation.action),
  ['HAPPY', 'SAD', 'SLEEPING'],
);

assert.deepEqual(resolveExplicitToolActions('【动作:开心】【动作:难过】【动作:吃东西】'), [
  'HAPPY',
  'SAD',
  'EATING',
]);

assert.deepEqual(
  resolveMessageExpressionActionQueue('可见文本已经剥掉工具标记', ['HAPPY', 'SAD', 'SLEEPING']),
  ['HAPPY', 'SAD', 'SLEEPING'],
);

assert.equal(resolveExpressionActionPlaybackDurationMs('HAPPY', 3, 3200), 2800);
assert.equal(resolveExpressionActionPlaybackDurationMs('SAD', 3, 3200), 3000);
assert.equal(resolveExpressionActionPlaybackDurationMs('SLEEPING', 3, 3200), 3400);

console.log('pet message expression queue smoke ok');
