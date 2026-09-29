import assert from 'node:assert/strict';
import { resolvePetMessageExpressionAction } from '../src/pet-runtime/interactions/petMessageExpressionSignals';

const happySamples = [
  '（笑�?,
  '（笑了笑�?,
  '轻笑了一�?,
  '含笑看着�?,
  '嘴角勾起一抹笑',
  '嘴角勾起一抹坏�?,
  '忍俊不禁',
  '噗嗤笑出�?,
  '莞尔一�?,
  '会心一�?,
];

for (const sample of happySamples) {
  assert.equal(
    resolvePetMessageExpressionAction(sample),
    'HAPPY',
    `expected "${sample}" to trigger HAPPY`,
  );
}

assert.equal(
  resolvePetMessageExpressionAction('苦笑了一�?),
  'SAD',
  '苦笑 should stay on the sad track',
);

assert.equal(
  resolvePetMessageExpressionAction('冷笑了一�?),
  null,
  '冷笑 should not be upgraded into a happy expression by accident',
);

console.log('pet message expression signals smoke ok');
