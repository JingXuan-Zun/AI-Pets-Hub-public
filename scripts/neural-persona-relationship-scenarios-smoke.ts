import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  buildNeuralContextContribution,
  createReadonlyNeuralPersonaGraphStore,
  inspectNeuralPersonaActivation,
  inspectNeuralPersonaRelationshipCoverage,
} from '../src/character-graph/neural-persona';
import {
  NEURAL_PERSONA_RELATIONSHIP_SCENARIOS,
  type NeuralPersonaRelationshipScenario,
} from './fixtures/neural-persona-relationship-scenario-fixture';

const ARCHITECTURE_FILES = [
  'src/character-graph/neural-persona/neuralPersonaRelationshipKeys.ts',
  'src/character-graph/neural-persona/neuralPersonaRelationshipCoverage.ts',
  'src/character-graph/neural-persona/neuralPersonaPropagation.ts',
  'src/character-graph/neural-persona/neuralPersonaRelationshipCandidates.ts',
  'src/character-graph/neural-persona/neuralPersonaRelationshipBatchCommandService.ts',
  'src/services/neuralPersonaConfiguredRelationshipCandidateProvider.ts',
  'src/components/settings/useNeuralPersonaRelationshipCandidates.ts',
  'src/components/settings/NeuralPersonaRelationshipCandidatePanel.tsx',
  'src/components/settings/neuralPersonaGraphMutationActions.ts',
  'src/components/settings/useNeuralPersonaGraphSectionState.ts',
  'scripts/fixtures/neural-persona-relationship-scenario-fixture.ts',
];

function inspectSource(relativePath: string) {
  const text = fs.readFileSync(path.resolve(relativePath), 'utf8');
  assert.ok(text.split(/\r?\n/u).length <= 300, `${relativePath} exceeds 300 lines`);
  const source = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true);
  const line = (position: number) => source.getLineAndCharacterOfPosition(position).line + 1;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionLike(node) && node.body) {
      const size = line(node.body.end) - line(node.getStart(source)) + 1;
      assert.ok(size <= 50, `${relativePath} function has ${size} lines`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

function verifyDefinition(scenario: NeuralPersonaRelationshipScenario) {
  assert.equal(scenario.graph.graphVersion, 'relationship-scenarios.graph.v1');
  assert.equal(scenario.config.configVersion, 'relationship-scenarios.v1');
  assert.ok(scenario.input.requestId && scenario.input.turnId && scenario.privacyBoundary);
}

function verifySelection(scenario: NeuralPersonaRelationshipScenario, selected: string[], filtered: string[]) {
  scenario.mustSelectNodeIds.forEach((id) => assert.ok(selected.includes(id), `${scenario.scenarioId} must select ${id}`));
  scenario.forbiddenNodeIds.forEach((id) => assert.ok(!selected.includes(id), `${scenario.scenarioId} must reject ${id}`));
  scenario.expectedFilteredNodeIds?.forEach((id) => assert.ok(filtered.includes(id), `${scenario.scenarioId} must filter ${id}`));
}

function verifyPath(scenario: NeuralPersonaRelationshipScenario, nodes: ReturnType<typeof inspectNeuralPersonaActivation>['nodes']) {
  if (!scenario.expectedPath) return;
  const target = nodes.find((item) => item.nodeId === scenario.expectedPath?.at(-1));
  assert.ok(target, `${scenario.scenarioId} path target must be present`);
  assert.deepEqual(target.path.slice(-scenario.expectedPath.length), scenario.expectedPath);
}

function runScenario(scenario: NeuralPersonaRelationshipScenario) {
  verifyDefinition(scenario);
  const result = createReadonlyNeuralPersonaGraphStore(scenario.graph, scenario.config);
  assert.equal(result.valid, true, `${scenario.scenarioId} graph must be valid`);
  assert.ok(result.store);
  const options = { config: scenario.config, input: scenario.input, store: result.store! };
  const preview = inspectNeuralPersonaActivation(options);
  const contribution = buildNeuralContextContribution(options);
  const second = buildNeuralContextContribution(options);
  assert.deepEqual(second, contribution, `${scenario.scenarioId} must be deterministic`);
  verifySelection(scenario, contribution.trace.selectedNodeIds, contribution.trace.filteredNodeIds);
  verifySelection(scenario, preview.nodes.filter((node) => node.status === 'selected').map((node) => node.nodeId),
    preview.nodes.filter((node) => node.status !== 'selected').map((node) => node.nodeId));
  verifyPath(scenario, preview.nodes);
  assert.ok(contribution.contribution.tokenBudgetUsed <= scenario.config.maxTokenBudget);
  if (scenario.expectedCoverage) {
    const coverage = inspectNeuralPersonaRelationshipCoverage(scenario.graph);
    assert.deepEqual({ content: coverage.contentNodeCount, connected: coverage.connectedContentNodeCount, edges: coverage.semanticEdgeCount }, scenario.expectedCoverage);
  }
}

assert.equal(NEURAL_PERSONA_RELATIONSHIP_SCENARIOS.length, 20);
assert.equal(new Set(NEURAL_PERSONA_RELATIONSHIP_SCENARIOS.map((scenario) => scenario.scenarioId)).size, 20);
ARCHITECTURE_FILES.forEach(inspectSource);
NEURAL_PERSONA_RELATIONSHIP_SCENARIOS.forEach(runScenario);

console.log('neural persona 20 relationship scenarios smoke ok');
