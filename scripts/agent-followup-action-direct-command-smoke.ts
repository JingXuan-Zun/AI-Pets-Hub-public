import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';
import { assertProductionRuntimeSourceContracts } from './productionRuntimeSourceContracts.ts';
import { readModuleProjectFunction } from './projectModuleSource.mjs';
import { readProjectSources } from './smokeTestHarness.ts';

const {
  controller: controllerSource,
  sender: senderSource,
} = readProjectSources({
  controller: 'src/components/chat/agentRunController.ts',
  sender: 'src/components/chat/usePetChatMessageSender.ts',
});

assertProductionRuntimeSourceContracts();
const sendPath = 'src/components/chat/petChatMessageSendExecution.ts';
const initialInstruction = readModuleProjectFunction(sendPath, 'resolveInitialAgentInstruction');
const preparedExecution = readModuleProjectFunction(sendPath, 'executePreparedAgentSession');
assert.match(senderSource, /executePetChatMessageSend\(contextRef\.current/u);
assert.match(initialInstruction, /followUpAction\?\.kind === 'run-command'/u);
assert.match(initialInstruction, /const command = input\.followUpAction\.command/u);
assert.match(initialInstruction, /command\.toolCall\?\.goal[\s\S]*command\.instruction[\s\S]*command\.sourceText[\s\S]*input\.outgoingText/u);
assert.match(preparedExecution, /await runPreparedAgentProductionSession\(\{/u);
assert.doesNotMatch(initialInstruction + preparedExecution + senderSource, /await (?:context\.)?onAgentChatCommand\(|approvedToolResult:/u, 'UI follow-ups must enter the Runtime permission lifecycle before any write action');
assert.match(controllerSource, /approvedToolResult\?: AgentRuntimeToolResultEntry \| null/u);

const resolverModule = { exports: null as any };
let ordinaryInstructionCalls = 0;
vm.runInNewContext(ts.transpileModule(initialInstruction + '\nmodule.exports = resolveInitialAgentInstruction;', {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, {
  module: resolverModule,
  resolveAgentProductionSessionInstruction: (text: string) => { ordinaryInstructionCalls += 1; return `resolved:${text}`; },
});
const resolve = resolverModule.exports;
const base = { hasImageAttachments: false, outgoingText: 'button text', options: {} };
for (const [command, expected] of [
  [{ toolCall: { goal: 'bound goal' }, instruction: 'bound instruction', sourceText: 'bound source' }, 'bound goal'],
  [{ instruction: 'bound instruction', sourceText: 'bound source' }, 'bound instruction'],
  [{ sourceText: 'bound source' }, 'bound source'],
  [{}, 'button text'],
] as const) {
  assert.equal(resolve({ ...base, followUpAction: { kind: 'run-command', command, label: 'fallback label' } }), expected);
}
assert.equal(resolve({ ...base, outgoingText: '', followUpAction: { kind: 'run-command', command: {}, label: 'fallback label' } }), 'fallback label');
assert.equal(resolve({ ...base, hasImageAttachments: true, followUpAction: { kind: 'run-command', command: { instruction: 'bound' } } }), '');
assert.equal(resolve({ ...base, options: { agentMode: true } }), 'button text');
assert.equal(ordinaryInstructionCalls, 0, 'bound commands must not be reinterpreted as button labels');
assert.equal(resolve(base), 'resolved:button text');
assert.equal(ordinaryInstructionCalls, 1);

console.log('agent follow-up action direct command smoke ok');
