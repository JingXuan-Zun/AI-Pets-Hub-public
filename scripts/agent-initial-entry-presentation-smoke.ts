import assert from 'node:assert/strict';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';

const json = (value: unknown) => value === undefined ? null : JSON.parse(JSON.stringify(value));
const name = 'beginInitialAgentRunPresentation';
export function exerciseInitialEntryPresentation(baselineSource?: string) {
  const outputs: unknown[] = [];
  for (const id of ['task', '', null, undefined]) for (const voice of [false, true]) {
    for (const race of [false, true]) outputs.push(exercise(id, voice, race));
  }
  for (const failure of ['settings', 'warm', 'create', 'id', 'token', 'journal', 'add', 'world', 'source', 'log']) {
    outputs.push(exercise(null, true, true, failure));
  }
  return outputs;

  function exercise(id: string | null | undefined, voice: boolean, race: boolean, failure?: string) {
    const calls: any[] = []; const error = new Error('original dependency failure');
    const step = (name: string, value: unknown) => { calls.push([name, json(value)]); if (failure === name) throw error; };
    const settings = { marker: 'settings' }; const journal = { marker: 'same journal' };
    let source = 'original source'; let token = 1; let currentId = id;
    const preparedRequest: any = {
      currentConfig: { get settings() { step('settings', settings); return settings; } },
      get requestToken() { step('token', token); return token; },
      get outgoingText() { step('source', source); return source; },
    };
    const message = { get id() { step('id', currentId); return currentId; }, text: 'running' };
    const fixture = createAgentRunPresentationFixture(baselineSource, [name], {
      sessionMessageProjection: { createAgentProductionSessionRunMessage: (options: any) => {
        assert.equal(options.preparedRequest, preparedRequest); assert.equal(options.instruction, 'original instruction');
        step('create', source); if (race) token = 9; return message;
      } },
      agent: { getOrCreateAgentCanonicalEventJournal: (key: string) => {
        step('journal', key); assert.equal(key, id ?? `request-${race ? 9 : 1}`);
        if (race) currentId = 'changed during journal'; return journal;
      } },
      chatStore: { desktopPetChatStore: { addMessage: (value: any) => {
        assert.equal(value, message); step('add', { sameMessage: true }); if (race) source = 'after add';
      } } },
      agentRuntimeWorldBridge: { publishAgentRuntimeWorldTaskStarted: (...args: any[]) => {
        assert.equal(args.length, 0); step('world', null); if (race) source = 'after world';
      } },
      frontendRuntimeLogger: { pushFrontendRuntimeLog: (...args: any[]) => step('log', args) },
    });
    const warmLocalReplyVoice = (value: any) => { assert.equal(value, settings); step('warm', value); if (race) source = 'after warm'; };
    try {
      const returned = fixture.module('initialEntryPresentation')[name]({ shouldAutoSpeakReply: voice, warmLocalReplyVoice, instruction: 'original instruction', preparedRequest });
      assert.ok(!failure); assert.equal(returned.runMessageId, id ?? null); assert.equal(returned.canonicalEventJournal, journal);
      assert.equal(typeof returned.then, 'undefined');
      assert.deepEqual(calls.map(([name]) => name), [...(voice ? ['settings', 'warm'] : []), 'create', 'id', ...((id === null || id === undefined) ? ['token'] : []), 'journal', 'add', 'world', 'source', 'log']);
      assert.deepEqual(calls.at(-1)[1], ['agent-session-v2', 'session started', { instruction: 'original instruction', sourceText: race ? 'after world' : 'original source', taskId: null, stateRevision: null }]);
      if (race && voice) assert.equal(calls.find(([name]) => name === 'create')[1], 'after warm');
    } catch (caught) { assert.ok(failure); assert.equal(caught, error); assert.equal(calls.at(-1)[0], failure); }
    return json({ id, voice, race, failure, calls });
  }
}
const prepared = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'runPreparedAgentProductionSession');
assert.match(prepared, /if \(!targetSlot\)\s*\{\s*return;\s*\}[\s\S]*createAgentRunRequestContext\(preparedRequest, targetSlot\);\s*const \{ runMessageId, canonicalEventJournal \} = beginInitialAgentRunPresentation\(/u);
assert.match(prepared, /beginInitialAgentRunPresentation\([\s\S]*registerAgentRunAbortController\(runMessageId,[\s\S]*try \{/u);
assert.equal(exerciseInitialEntryPresentation().length, 26);
console.log('Initial entry presentation smoke passed (26 cases; startup order/live reads/journal and message identity/errors).');
