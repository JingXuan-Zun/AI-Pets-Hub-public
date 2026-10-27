// The main window pushes the whole shared state about once a second (the runtime log changes
// that often). Keeping unchanged parts as the same objects lets memoized chat bubbles skip
// re-rendering; otherwise every push redrew every message. No imports, so it stays testable.

type MessageLike = { id?: string };
type SharedStateLike = {
  chatState: { messages: MessageLike[] } & Record<string, unknown>;
  config: unknown;
};

function sameJson(left: unknown, right: unknown) {
  return left === right || JSON.stringify(left) === JSON.stringify(right);
}

export function reuseUnchangedSharedState<T extends SharedStateLike>(previous: T, next: T): T {
  const previousById = new Map(previous.chatState.messages.map((message) => [message.id, message]));
  let messagesChanged = next.chatState.messages.length !== previous.chatState.messages.length;
  const messages = next.chatState.messages.map((message, index) => {
    const before = message.id ? previousById.get(message.id) : undefined;
    const kept = before && sameJson(before, message) ? before : message;
    if (kept !== previous.chatState.messages[index]) messagesChanged = true;
    return kept;
  });
  const chatState = { ...next.chatState, messages: messagesChanged ? messages : previous.chatState.messages };
  const chatStateChanged = Object.keys(chatState)
    .some((key) => chatState[key] !== previous.chatState[key] && !sameJson(chatState[key], previous.chatState[key]));
  return {
    ...next,
    chatState: chatStateChanged ? chatState : previous.chatState,
    config: sameJson(next.config, previous.config) ? previous.config : next.config,
  };
}
