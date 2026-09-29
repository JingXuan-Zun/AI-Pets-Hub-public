import assert from 'node:assert/strict';
import { resolveGroupTaskEntryRoute } from '../src/components/chat/group/task/groupTaskEntryRoute';

assert.deepEqual(resolveGroupTaskEntryRoute({ mode: 'chat', reason: 'chat' }), { userDirectedTask: false, rewrittenGoal: null });
assert.deepEqual(resolveGroupTaskEntryRoute({ mode: 'agent', reason: 'task', rewrittenGoal: 'Observe desktop' }), { userDirectedTask: true, rewrittenGoal: 'Observe desktop' });
console.log('group task entry route smoke ok');
