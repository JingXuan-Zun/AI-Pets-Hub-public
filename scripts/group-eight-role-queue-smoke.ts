import assert from 'node:assert/strict';
import { createGroupChatSpeakerQueue } from '../src/components/chat/chatGroupInteractionPlanner';

function slot(id: string, name: string) {
  return {
    id, slotNumber: Number(id.replace('pet-', '')), label: name, isPrimary: id === 'pet-1',
    enabled: true, modelVisible: true, autoMovementEnabled: true, pointerLookEnabled: true,
    modelType: '2d', modelUrl: '', scale: 1, position: { x: 0, y: 0 },
    stats: { affection: 50, fatigue: 0, hunger: 50 }, currentAction: 'IDLE',
    personality: { name, traits: [], greeting: '', systemInstruction: '', chatAvatarUrl: '',
      beginDialogs: [], customErrorMessage: '', userMemory: '', chatHistoryMemory: '', knowledgeBase: '',
      webSearchEnabled: false, webLearningEnabled: false },
  } as never;
}

const targetSlots = Array.from({ length: 8 }, (_, index) => slot(`pet-${index + 1}`, `Role ${index + 1}`));
const queue = createGroupChatSpeakerQueue({ messages: [], targetSlots });
assert.equal(queue.length, 8);
assert.deepEqual(queue.map((plan) => plan.targetSlot.id), targetSlots.map((item) => item.id));
console.log('group eight role queue smoke ok');
