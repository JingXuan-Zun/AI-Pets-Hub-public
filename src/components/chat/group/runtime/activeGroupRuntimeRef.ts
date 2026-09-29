import type { GroupChatRuntime } from './groupChatRuntime';

export class ActiveGroupRuntimeRef {
  private runtime: GroupChatRuntime | null = null;

  set(runtime: GroupChatRuntime) {
    this.runtime = runtime;
  }

  get() {
    return this.runtime;
  }

  cancel() {
    this.runtime?.cancel();
    this.runtime = null;
  }

  clear(runtime?: GroupChatRuntime) {
    if (!runtime || this.runtime === runtime) {
      this.runtime = null;
    }
  }
}
