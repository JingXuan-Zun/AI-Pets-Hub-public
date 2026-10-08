import assert from 'node:assert/strict';
import ts from 'typescript';
import { readProjectSources } from './smokeTestHarness.ts';

const { session: sessionSource, presentation: presentationSource } = readProjectSources({
  session: 'src/agent/agentProductionSessionImplementation.ts',
  presentation: 'src/agent/productionSession/sessionPresentation.ts',
});

function getFunctionSource(source: string, name: string) {
  const parsed = ts.createSourceFile('source.ts', source, ts.ScriptTarget.Latest, true);
  let result: string | null = null;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node.getText(parsed);
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.ok(result, name + ' should exist');
  return result;
}

assert.match(sessionSource, /from '\.\/productionSession\/sessionPresentation'/u);
assert.match(sessionSource, /createAgentProductionSessionPresentation\(\{/u);
assert.match(sessionSource, /createAgentProductionPresentationFinalResult: createAgentSessionV2FinalResult/u);
assert.match(sessionSource, /createAgentProductionPresentationMaxStepsAnswer: createAgentSessionV2MaxStepsAnswer/u);
const maxStepsAnswer = getFunctionSource(presentationSource, 'createAgentProductionPresentationMaxStepsAnswer');
const finalResultFunction = getFunctionSource(presentationSource, 'createAgentProductionPresentationFinalResult');
const runLoopFailureArea = getFunctionSource(sessionSource, 'runAgentProductionSessionImplementation');

assert.ok(maxStepsAnswer, 'Max steps answer helper should exist.');
assert.ok(maxStepsAnswer.includes('Agent processed ${maxSteps} steps and stopped to avoid looping.'));
assert.doesNotMatch(maxStepsAnswer, /Agent V2/u);

assert.ok(finalResultFunction, 'Final result helper should exist.');
assert.ok(finalResultFunction.includes('No usable reply was generated, so I stopped.'));
assert.doesNotMatch(finalResultFunction, /Agent V2/u);

assert.match(runLoopFailureArea, /Model call failed:/u);
assert.match(runLoopFailureArea, /The model did not return a usable next step/u);
assert.match(runLoopFailureArea, /No local tool executor is available/u);
assert.match(runLoopFailureArea, /tool execution failed/u);
assert.doesNotMatch(runLoopFailureArea, /Agent V2/u);

console.log('agent session v2 human-facing failure smoke ok');
