import assert from 'node:assert/strict';
import {
  removePresentedExpressionPrefix,
  resolveStreamingMessageExpressionAction,
} from '../src/components/pet/petMessageExpressionStreaming';

assert.equal(resolveStreamingMessageExpressionAction('[action:happy]'), 'HAPPY');
assert.equal(resolveStreamingMessageExpressionAction('[action:happy][action:sad]'), 'SAD');
assert.deepEqual(
  removePresentedExpressionPrefix(['HAPPY', 'SAD'], ['HAPPY']),
  ['SAD'],
);
assert.deepEqual(
  removePresentedExpressionPrefix(['HAPPY', 'SAD'], ['HAPPY', 'SAD']),
  [],
);
assert.deepEqual(
  removePresentedExpressionPrefix(['HAPPY', 'SAD'], ['SAD']),
  [],
);
assert.deepEqual(
  removePresentedExpressionPrefix(['SAD'], ['HAPPY']),
  ['SAD'],
);

console.log('pet message expression streaming smoke passed');
