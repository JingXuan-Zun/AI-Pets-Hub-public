import { ActiveGroupRuntimeRef } from '../src/components/chat/group/runtime/activeGroupRuntimeRef';
import { GroupChatRuntime } from '../src/components/chat/group/runtime/groupChatRuntime';

const ref = new ActiveGroupRuntimeRef();
const runtime = new GroupChatRuntime({
  activeRoleIds: ['primary'],
  groupSessionId: 'active-ref-session',
  mode: 'infinite',
});

ref.set(runtime);
if (ref.get() !== runtime) {
  throw new Error('active runtime registration failed');
}

ref.cancel();
if (ref.get() !== null || runtime.controller.getSnapshot().status !== 'cancelled') {
  throw new Error('idle runtime cancellation boundary failed');
}

console.log('active group runtime ref smoke ok');
