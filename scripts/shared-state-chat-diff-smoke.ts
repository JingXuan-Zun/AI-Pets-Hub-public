// Shared-state sync leaves out an unchanged (possibly huge) chat history; the main process fills it
// back in, so other windows still receive the full state (2026-11-07: dragging the pet stuttered).
import { strict as assert } from 'node:assert';
import { createRequire } from 'node:module';
import { resetSharedChatStateMemory, withoutUnchangedChatState } from '../src/hooks/useDesktopShellSharedStateSync';

const require = createRequire(import.meta.url);
const { mergeSharedState } = require('../electron/ipcHandlers.cjs');

let checks = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); checks += 1; };

const messages = [{ role: 'user', text: 'hi' }];
const chat1 = { isSpeaking: false, messages } as never;
const state = (chatState: unknown, x: number) => ({ chatState, config: { x } }) as never;

resetSharedChatStateMemory();
// First sync: everything goes.
const first = withoutUnchangedChatState(state(chat1, 1)) as unknown as Record<string, unknown>;
check([first.chatState === chat1, 'chatStateUnchanged' in first], [true, false], 'first sync is full');
let main = mergeSharedState(null, first);

// The pet moved, chat untouched: only a marker.
const moved = withoutUnchangedChatState(state(chat1, 2)) as unknown as Record<string, unknown>;
check([moved.chatState, moved.chatStateUnchanged], [undefined, true], 'unchanged chat left out');
main = mergeSharedState(main, moved);
check([main.config.x, main.chatState.messages === messages, 'chatStateUnchanged' in main], [2, true, false], 'main keeps the last chat');

// She started speaking: flags change, messages do not.
const chat2 = { isSpeaking: true, messages } as never;
const speaking = withoutUnchangedChatState(state(chat2, 3)) as unknown as Record<string, any>;
check([speaking.chatState.isSpeaking, speaking.chatState.messages, speaking.chatMessagesUnchanged], [true, undefined, true], 'only the flags go');
main = mergeSharedState(main, speaking);
check([main.chatState.isSpeaking, main.chatState.messages === messages, 'chatMessagesUnchanged' in main], [true, true, false], 'messages filled back in');

// A new message: the full chat goes again.
const chat3 = { isSpeaking: false, messages: [...messages, { role: 'model', text: 'hello' }] } as never;
const replied = withoutUnchangedChatState(state(chat3, 3)) as unknown as Record<string, any>;
check([replied.chatState.messages.length, 'chatMessagesUnchanged' in replied], [2, false], 'new message sent in full');
main = mergeSharedState(main, replied);
check(main.chatState.messages.length, 2, 'main has the new message');

// A main process without a previous copy keeps whatever came (never invents a chat state).
check(mergeSharedState(null, { chatStateUnchanged: true, config: { x: 1 } }), { config: { x: 1 } }, 'no previous copy');
check(mergeSharedState(null, null), null, 'null stays null');

console.log(`shared state chat diff smoke ok: ${checks} checks`);

// Large inline pictures are shrunk before they enter (or stay in) the chat history.
import('../src/services/chatImageCompression').then(({ CHAT_IMAGE_COMPRESS_OVER_BYTES, dataUrlBytes, fitWithin, hasLargeInlineImage }) => {
  assert.deepEqual(fitWithin(3840, 2160), { height: 900, width: 1600 });
  assert.deepEqual(fitWithin(800, 600), { height: 600, width: 800 });
  assert.equal(dataUrlBytes(`data:image/png;base64,${'A'.repeat(4000)}`), 3000);
  const big = { attachments: [{ dataUrl: `data:image/png;base64,${'A'.repeat(Math.ceil((CHAT_IMAGE_COMPRESS_OVER_BYTES + 10) / 0.75))}` }] } as never;
  assert.equal(hasLargeInlineImage(big), true);
  assert.equal(hasLargeInlineImage({ attachments: [{ dataUrl: 'data:image/png;base64,AAAA' }] } as never), false);
  console.log('chat image compression checks ok: 5');
});
