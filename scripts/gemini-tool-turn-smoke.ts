import assert from 'node:assert/strict';
import { buildGeminiFunctionDeclarations, buildGeminiToolContents, readGeminiFunctionCalls } from '../src/services/geminiToolTurn';

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases++; };

// Tool definitions become one functionDeclarations entry with JSON-schema parameters.
const declarations = buildGeminiFunctionDeclarations([{
  function: { description: '查天气', name: 'get_weather', parameters: { properties: { city: { type: 'string' } }, required: ['city'], type: 'object' } },
  type: 'function',
}]);
check(declarations, [{ functionDeclarations: [{ description: '查天气', name: 'get_weather', parametersJsonSchema: { properties: { city: { type: 'string' } }, required: ['city'], type: 'object' } }] }], 'declarations');

// A loop round (assistant calls + two results) becomes a model turn and one grouped user turn.
const contents = buildGeminiToolContents([
  { content: '我看看～', role: 'assistant', tool_calls: [
    { function: { arguments: '{"city":"杭州"}', name: 'get_weather' }, id: 'c1', thought_signature: 'sig-1', type: 'function' },
    { function: { arguments: '{}', name: 'list_windows' }, id: 'c2', type: 'function' },
  ] },
  { content: '晴，26 度', role: 'tool', tool_call_id: 'c1' },
  { content: '3 个窗口', role: 'tool', tool_call_id: 'c2' },
]);
check(contents, [
  { parts: [
    { text: '我看看～' },
    { functionCall: { args: { city: '杭州' }, id: 'c1', name: 'get_weather' }, thoughtSignature: 'sig-1' },
    { functionCall: { args: {}, id: 'c2', name: 'list_windows' } },
  ], role: 'model' },
  { parts: [
    { functionResponse: { id: 'c1', name: 'get_weather', response: { result: '晴，26 度' } } },
    { functionResponse: { id: 'c2', name: 'list_windows', response: { result: '3 个窗口' } } },
  ], role: 'user' },
], 'tool round in Gemini shape');

// Function calls are read from the desktop bridge shape and from the SDK chunk shape.
check(readGeminiFunctionCalls({ functionCalls: [{ args: { city: '杭州' }, name: 'get_weather', thoughtSignature: 's' }], text: '' }, 0),
  [{ arguments: '{"city":"杭州"}', id: 'call_0', name: 'get_weather', thoughtSignature: 's' }], 'bridge shape');
check(readGeminiFunctionCalls({ candidates: [{ content: { parts: [{ text: 'hi' }, { functionCall: { args: {}, id: 'x', name: 'pets' } }] } }] }, 2),
  [{ arguments: '{}', id: 'x', name: 'pets' }], 'SDK shape');
check(readGeminiFunctionCalls({ text: '只是聊天' }, 0), [], 'plain text has no calls');

console.log(`gemini tool turn smoke ok: ${cases} checks`);
