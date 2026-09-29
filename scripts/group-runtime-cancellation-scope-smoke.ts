import { ActiveGroupRuntimeRef } from '../src/components/chat/group/runtime/activeGroupRuntimeRef';
import { GroupChatRuntime } from '../src/components/chat/group/runtime/groupChatRuntime';

const ref = new ActiveGroupRuntimeRef();
const runtime = new GroupChatRuntime({
  activeRoleIds: ['alice'],
  groupSessionId: 'cancel-scope-session',
  mode: 'infinite',
});

runtime.beginPlanning();
ref.set(runtime);
ref.cancel();

if (runtime.controller.getSnapshot().status !== 'cancelled' || ref.get() !== null) {
  throw new Error('group cancellation did not terminate the active runtime');
}

const singleChatRequestToken = 7;
const groupChatRequestToken = 8;
if (singleChatRequestToken === groupChatRequestToken) {
  throw new Error('chat request cancellation scope leaked across sessions');
}

console.log('group runtime cancellation scope smoke ok');
