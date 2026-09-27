import assert from 'node:assert/strict';
import { resolveRoutedGroupTask } from '../src/components/chat/group/task/groupTaskRouting';

const slot = { id: 'alice', label: 'Alice', slotNumber: 1, isPrimary: true, personality: { name: 'Alice' } } as never;
assert.equal(resolveRoutedGroupTask({ decision: { mode: 'agent', reason: 'task' }, groupSessionId: 'g', topicId: 't', sourceText: 'organize desktop', targetSlots: [slot] }), null);
assert.equal(resolveRoutedGroupTask({ decision: { mode: 'agent', reason: 'task', rewrittenGoal: 'Organize desktop' }, groupSessionId: 'g', topicId: 't', sourceText: 'Alice organize desktop', targetSlots: [slot] })?.sourceRoleIds[0], 'alice');
console.log('group task routing smoke ok');
