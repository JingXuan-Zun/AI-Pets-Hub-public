import assert from 'node:assert/strict';
import { resolveAgentCharacterAnimationIntent } from '../src/agent/index.ts';

assert.equal(resolveAgentCharacterAnimationIntent('pet wave')?.animationId, 'wave');
assert.equal(resolveAgentCharacterAnimationIntent('show pet wave')?.animationId, 'wave');
assert.equal(resolveAgentCharacterAnimationIntent('which browser do I usually use'), null);
assert.equal(resolveAgentCharacterAnimationIntent('show browser history'), null);

console.log('agent character skill intent boundary smoke ok');
