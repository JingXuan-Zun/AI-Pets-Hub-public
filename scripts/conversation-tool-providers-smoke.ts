import assert from 'node:assert/strict';
import { collectConversationTools, registerConversationToolProvider } from '../src/agent/conversation/conversationToolProviders';

// Every source of tools registers a provider; the list keeps a fixed order (cacheable prefix),
// a later source cannot take over a tool name, and a plugin's tools go away when it is removed.

const tool = (name: string) => ({ confirmation: () => null, definition: { function: { description: name, name, parameters: { properties: {}, type: 'object' } }, type: 'function' }, run: async () => name }) as never;
const scope = { configRef: { current: {} }, petId: 'primary' } as never;
const names = () => [...collectConversationTools(scope).keys()];

registerConversationToolProvider({ id: 'builtin-b', order: 20, tools: () => [tool('b')] });
registerConversationToolProvider({ id: 'builtin-a', order: 10, tools: () => [tool('a')] });
assert.deepEqual(names(), ['a', 'b'], 'ordered by order, not by when they registered');

const removePlugin = registerConversationToolProvider({ id: 'plugin:weather', order: 90, tools: () => [tool('weather_get'), tool('a')] });
assert.deepEqual(names(), ['a', 'b', 'weather_get'], 'a plugin adds its tools at the end and cannot take over “a”');
assert.equal((collectConversationTools(scope).get('a') as unknown as { definition: { function: { description: string } } }).definition.function.description, 'a', 'the first “a” is kept');
removePlugin();
assert.deepEqual(names(), ['a', 'b'], 'removing the plugin removes its tools');

console.log('conversation tool providers smoke ok');
