import assert from 'node:assert/strict';
import { reuseUnchangedSharedState } from '../src/sharedStateReuse';

// A push where only the log changed keeps the same chat objects, so the chat window does not
// redraw every message once a second.
const message = (id: string, text: string) => ({ createdAt: 1, id, role: 'model', text });
const base = {
  chatState: { chatMode: 'private', isTyping: false, messages: [message('a', '你好'), message('b', '在吗')], storyLibrary: [] },
  config: { settings: { ttsProvider: 'gpt-sovits' } },
  interactiveDialogueActive: false,
  logs: ['one'],
  petVisualSize: null,
  screenCaptureActive: false,
  screenCaptureOptions: null,
} as never;
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const logOnly = reuseUnchangedSharedState(base, { ...clone(base), logs: ['one', 'two'] } as never) as typeof base & Record<string, never>;
const b = base as unknown as { chatState: { messages: unknown[] }; config: unknown };
const l = logOnly as unknown as { chatState: { messages: unknown[] }; config: unknown; logs: string[] };
assert.equal(l.chatState, b.chatState, 'chat state kept');
assert.equal(l.config, b.config, 'config kept');
assert.deepEqual(l.logs, ['one', 'two'], 'the new log still arrives');

const edited = clone(base) as unknown as { chatState: { messages: Array<{ text: string }> } };
edited.chatState.messages[1].text = '在吗？';
const e = reuseUnchangedSharedState(base, edited as never) as unknown as { chatState: { messages: unknown[] } };
assert.notEqual(e.chatState, b.chatState, 'a changed message updates the chat state');
assert.equal(e.chatState.messages[0], b.chatState.messages[0], 'untouched messages keep their objects');
assert.notEqual(e.chatState.messages[1], b.chatState.messages[1]);

const added = clone(base) as unknown as { chatState: { messages: unknown[] } };
added.chatState.messages.push(message('c', '新消息'));
const a = reuseUnchangedSharedState(base, added as never) as unknown as { chatState: { messages: unknown[] } };
assert.equal(a.chatState.messages.length, 3);
assert.equal(a.chatState.messages[1], b.chatState.messages[1]);

console.log('shared state reuse smoke ok');
