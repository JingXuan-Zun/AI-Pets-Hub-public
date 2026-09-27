import assert from 'node:assert/strict';
import { desktopPetChatStore } from '../src/chatStore';

desktopPetChatStore.reset();

desktopPetChatStore.setSpeechExpressionAction('primary', 'HAPPY');
assert.equal(
  desktopPetChatStore.getState().speechExpressionActionByPetId.primary,
  'HAPPY',
);

desktopPetChatStore.setSpeechExpressionAction('companion-a', 'SAD');
assert.equal(
  desktopPetChatStore.getState().speechExpressionActionByPetId.primary,
  'HAPPY',
);
assert.equal(
  desktopPetChatStore.getState().speechExpressionActionByPetId['companion-a'],
  'SAD',
);

desktopPetChatStore.setSpeechExpressionAction('primary', null);
assert.equal(
  desktopPetChatStore.getState().speechExpressionActionByPetId.primary,
  undefined,
);
assert.equal(
  desktopPetChatStore.getState().speechExpressionActionByPetId['companion-a'],
  'SAD',
);

desktopPetChatStore.reset();
console.log('speech expression session smoke ok');
