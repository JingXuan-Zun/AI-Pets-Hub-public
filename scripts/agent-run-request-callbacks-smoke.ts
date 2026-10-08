import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { createAgentRunPresentationFixture } from './agentRunPresentationFixture';
import { readModuleProjectFunction } from './projectModuleSource.mjs';
import { AGENT_STOPPED_DETAIL_TEXT } from '../src/components/chat/runController/stoppedText';

function oldCallback(source: string, entry: string, name: string) {
  const ast = ts.createSourceFile('controller.ts', source, ts.ScriptTarget.Latest, true);
  const fn = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === entry);
  let callback = '';
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) {
      assert.equal(callback, '');
      callback = node.initializer!.getText(ast);
    }
    ts.forEachChild(node, visit);
  }
  assert.ok(fn); visit(fn); assert.ok(callback);
  return ts.transpileModule(`(env) => { const {
    abortController, preparedRequest, requestToken, activeChatRequestTokenRef,
    isStoppedAgentRunMessage, assessAgentCommandResult, AGENT_STOPPED_DETAIL_TEXT,
    createStoppedAgentExecutionReceipt, onAgentChatCommand, missingExecutorResult,
    runAgentToolExecutorWithLiveProgress, messageId, runMessageId,
    publishAgentRuntimeWorldProgress, updateAgentProductionSessionProgressMessage,
  } = env; return ${callback}; }`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
}

export async function exerciseAgentRunRequestCallbacks(baselineSource?: string) {
  const outputs: unknown[] = [];
  const originals = new Map<string, string>();
  if (baselineSource) for (const entry of ['runPreparedAgentProductionSession', 'resolveAgentApprovalRequest']) {
    for (const name of ['toolExecutor', 'onProgress']) originals.set(`${entry}:${name}`, oldCallback(baselineSource, entry, name));
  }
  for (const entry of ['runPreparedAgentProductionSession', 'resolveAgentApprovalRequest']) {
    for (const aborted of [false, true]) for (const stale of [false, true])
    for (const stopped of [false, true]) for (const hasExecutor of [false, true])
    for (const outcome of ['success', 'failed', 'throw']) for (const messageId of ['task', null]) {
      const calls: any[] = [];
      const command: any = { kind: 'tool-call', sourceText: 'read', toolCall: { name: 'get_system_info', input: {} } };
      const missing = { ok: false, responseText: 'missing executor' };
      const receipt = { status: 'blocked', title: 'stopped' };
      const response = { ok: outcome !== 'failed', responseText: outcome };
      const failure = new Error('executor failure');
      const abortController = new AbortController();
      const preparedRequest = { requestToken: 7 };
      const activeChatRequestTokenRef = { current: 7 };
      let stoppedNow = false;
      const isStopped = (id: string | null) => { assert.equal(id, messageId); calls.push(['stopped']); return stoppedNow; };
      const executor = hasExecutor ? async (actual: unknown) => {
        assert.equal(actual, command); calls.push(['executor']);
        if (outcome === 'throw') throw failure;
        return response;
      } : undefined;
      const assess = (actual: unknown, result: any) => { assert.equal(actual, command); calls.push(['assess', result]); return result; };
      const createReceipt = (actual: unknown) => { assert.equal(actual, command); calls.push(['receipt']); return receipt; };
      const live = async (options: any) => {
        assert.equal(options.command, command); assert.equal(options.executor, executor);
        assert.equal(options.messageId, messageId); assert.equal(options.signal, abortController.signal);
        calls.push(['live']); return options.executor(options.command);
      };
      const world = (event: unknown) => calls.push(['world', event]);
      const progress = (id: string | null, event: unknown) => calls.push(['progress', id, event]);
      const fixture = createAgentRunPresentationFixture(undefined, [], {
        agent: { assessAgentCommandResult: assess },
        executionReceipt: { createStoppedAgentExecutionReceipt: createReceipt },
        toolExecutionAdapter: { runAgentToolExecutorWithLiveProgress: live },
        agentRuntimeWorldBridge: { publishAgentRuntimeWorldProgress: world },
        sessionMessageProjection: { updateAgentProductionSessionProgressMessage: progress },
        agentRunStopPolicy: { isStoppedAgentRunMessage: isStopped },
      });
      const api = fixture.module('guardedRequestCallbacks');
      const originalGuard = () => abortController.signal.aborted
        || (entry === 'runPreparedAgentProductionSession' ? preparedRequest.requestToken : 7) !== activeChatRequestTokenRef.current
        || isStopped(messageId);
      const guardApi = fixture.module('requestCancellationGuards');
      const isCancelled = baselineSource ? originalGuard : entry === 'runPreparedAgentProductionSession'
        ? guardApi.createInitialAgentRunCancellationGuard({ abortController, preparedRequest, activeChatRequestTokenRef, messageId })
        : guardApi.createApprovedAgentRunCancellationGuard({ abortController, requestToken: 7, activeChatRequestTokenRef, messageId });
      const env = { abortController, preparedRequest, requestToken: 7, activeChatRequestTokenRef,
        isStoppedAgentRunMessage: isStopped, assessAgentCommandResult: assess,
        AGENT_STOPPED_DETAIL_TEXT, createStoppedAgentExecutionReceipt: createReceipt,
        onAgentChatCommand: executor, missingExecutorResult: missing, runAgentToolExecutorWithLiveProgress: live,
        messageId, runMessageId: messageId, publishAgentRuntimeWorldProgress: world,
        updateAgentProductionSessionProgressMessage: progress };
      const tool = baselineSource ? vm.runInNewContext(originals.get(`${entry}:toolExecutor`)!, { Error })(env)
        : api.createAgentRunToolExecutor({ isCancelled, executor, missingExecutorResult: missing, messageId, signal: abortController.signal });
      const handler = baselineSource ? vm.runInNewContext(originals.get(`${entry}:onProgress`)!, { Error })(env)
        : api.createAgentRunProgressHandler({ isCancelled, messageId });
      assert.equal(calls.length, 0, 'callback creation must not read request state or execute dependencies');
      // Change all mutable state after creation to detect captured cancellation.
      if (aborted) abortController.abort();
      if (stale) activeChatRequestTokenRef.current = 8;
      stoppedNow = stopped;
      const cancelled = aborted || stale || stopped;
      if (!cancelled && hasExecutor && outcome === 'throw') await assert.rejects(tool(command), error => error === failure);
      else {
        const result = await tool(command);
        if (cancelled) { assert.equal(result.ok, false); assert.equal(result.receipt, receipt); }
        else assert.equal(result, hasExecutor ? response : missing);
      }
      const expectedGuardCalls = aborted || stale ? [] : [['stopped']];
      assert.deepEqual(calls.map(row => row[0]), [...expectedGuardCalls.map(row => row[0]),
        ...(cancelled ? ['receipt', 'assess'] : hasExecutor ? ['live', 'executor'] : [])]);
      const toolCalls = structuredClone(calls); calls.length = 0;
      const event = Object.freeze({ type: 'fixture-progress' });
      handler(event);
      assert.deepEqual(calls.map(row => row[0]), [...expectedGuardCalls.map(row => row[0]), ...(cancelled ? [] : ['world', 'progress'])]);
      if (!cancelled) { assert.equal(calls[1][1], event); assert.equal(calls[2][1], messageId); assert.equal(calls[2][2], event); }
      const progressCalls = structuredClone(calls);
      const tokenReads: unknown[] = [];
      if (!cancelled && !hasExecutor && outcome === 'success' && messageId === 'task') {
        preparedRequest.requestToken = 8;
        calls.length = 0;
        const changedPreparedResult = await tool(command);
        if (entry === 'runPreparedAgentProductionSession') assert.equal(changedPreparedResult.receipt, receipt);
        else assert.equal(changedPreparedResult, missing, 'approval keeps its original local request token');
        handler(event);
        tokenReads.push({ result: structuredClone(changedPreparedResult), calls: structuredClone(calls) });
        activeChatRequestTokenRef.current = 8;
        calls.length = 0;
        const changedActiveResult = await tool(command);
        if (entry === 'runPreparedAgentProductionSession') assert.equal(changedActiveResult, missing, 'initial run reads the latest prepared request token');
        else assert.equal(changedActiveResult.receipt, receipt);
        handler(event);
        tokenReads.push({ result: structuredClone(changedActiveResult), calls: structuredClone(calls) });
      }
      outputs.push({ entry, aborted, stale, stopped, hasExecutor, outcome, messageId, toolCalls, progressCalls, tokenReads });
    }
  }
  return outputs;
}

for (const entry of ['runPreparedAgentProductionSession', 'resolveAgentApprovalRequest']) {
  const source = readModuleProjectFunction('src/components/chat/agentRunController.ts', entry);
  const messageId = entry === 'runPreparedAgentProductionSession' ? 'runMessageId' : 'messageId';
  if (entry === 'runPreparedAgentProductionSession') {
    assert.match(source, new RegExp(`createAgentRunToolExecutor\\(\\{\\s*isCancelled,\\s*executor: onAgentChatCommand,\\s*messageId: ${messageId},\\s*missingExecutorResult,\\s*signal: abortController\\.signal,\\s*\\}\\)`, 'u'));
    assert.match(source, /createAgentRunProgressHandler\(\{ isCancelled, messageId:/u);
  } else {
    assert.match(source, /createApprovedAgentRuntimeCallbacks\(\{\s*approval, canonicalEventJournal, signal: abortController.signal, executor: onAgentChatCommand,\s*messageId, missingExecutorResult, isCancelled, configRef,/u);
    const factory = readModuleProjectFunction('src/components/chat/agentRunController.ts', 'createApprovedAgentRuntimeCallbacks');
    assert.match(factory, /createAgentRunProgressHandler\(\{ isCancelled, messageId: messageId \}\)/u);
    assert.match(factory, /createAgentRunToolExecutor\(\{\s*isCancelled,\s*executor: executor,\s*messageId: messageId,\s*missingExecutorResult,\s*signal: signal,/u);
    assert.match(factory, /createAgentApprovalContinuationConsumer\(\{[\s\S]*missingExecutorResult, isCancelled, onProgress, configRef, toolExecutor,/u);
  }
  const initial = entry === 'runPreparedAgentProductionSession';
  const factoryName = initial ? 'createInitialAgentRunCancellationGuard' : 'createApprovedAgentRunCancellationGuard';
  assert.match(source, new RegExp(`const isCancelled = ${factoryName}\\(\\{ abortController, ${initial ? 'preparedRequest' : 'requestToken'}, activeChatRequestTokenRef, messageId${initial ? ': runMessageId' : ''} \\}\\)`, 'u'));
  const predicate = readModuleProjectFunction('src/components/chat/agentRunController.ts', initial ? factoryName : 'isApprovedAgentRequestCancelled');
  assert.match(predicate, /abortController\.signal\.aborted[\s\S]*activeChatRequestTokenRef\.current[\s\S]*isStoppedAgentRunMessage/u);
}
const outputs = await exerciseAgentRunRequestCallbacks();

const exceptionalCases: unknown[] = [];
for (const failingDependency of ['guard', 'receipt', 'assess', 'live', 'world', 'progress']) {
  const error = new Error(`${failingDependency} failure`);
  const calls: string[] = [];
  const dependency = (name: string) => {
    calls.push(name);
    if (name === failingDependency) throw error;
  };
  const fixture = createAgentRunPresentationFixture(undefined, [], {
    agent: { assessAgentCommandResult: () => { dependency('assess'); return {}; } },
    executionReceipt: { createStoppedAgentExecutionReceipt: () => { dependency('receipt'); return {}; } },
    toolExecutionAdapter: { runAgentToolExecutorWithLiveProgress: () => { dependency('live'); return {}; } },
    agentRuntimeWorldBridge: { publishAgentRuntimeWorldProgress: () => dependency('world') },
    sessionMessageProjection: { updateAgentProductionSessionProgressMessage: () => dependency('progress') },
  });
  const api = fixture.module('guardedRequestCallbacks');
  const isCancelled = () => { dependency('guard'); return ['receipt', 'assess'].includes(failingDependency); };
  if (['world', 'progress'].includes(failingDependency)) {
    const handler = api.createAgentRunProgressHandler({ isCancelled, messageId: 'task' });
    assert.throws(() => handler({ type: 'progress' }), actual => actual === error);
    assert.deepEqual(calls, failingDependency === 'world' ? ['guard', 'world'] : ['guard', 'world', 'progress']);
  } else {
    const tool = api.createAgentRunToolExecutor({ isCancelled, messageId: 'task', signal: new AbortController().signal,
      missingExecutorResult: {}, executor: () => assert.fail('the fixture live adapter owns execution') });
    await assert.rejects(tool({ kind: 'unsupported' }), actual => actual === error);
    assert.deepEqual(calls, failingDependency === 'guard' ? ['guard'] : failingDependency === 'live'
      ? ['guard', 'live'] : failingDependency === 'receipt' ? ['guard', 'receipt'] : ['guard', 'receipt', 'assess']);
  }
  exceptionalCases.push(calls);
}
assert.equal(exceptionalCases.length, 6);
console.log(`agent run request callbacks smoke: PASS (${outputs.length} callback pairs; live cancellation, stale tokens, stopped requests, no executor, error identity, progress order)`);
