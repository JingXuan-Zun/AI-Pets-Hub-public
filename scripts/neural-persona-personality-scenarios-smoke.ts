import assert from 'node:assert/strict';
import {
  buildNeuralContextContribution,
  createReadonlyNeuralPersonaGraphStore,
} from '../src/character-graph/neural-persona';
import {
  NEURAL_PERSONA_PERSONALITY_SCENARIOS,
  type NeuralPersonaPersonalityScenario,
} from './fixtures/neural-persona-personality-scenario-fixture';

function verifyScenarioDefinition(scenario: NeuralPersonaPersonalityScenario) {
  assert.equal(scenario.graph.graphVersion, 'persona-scenarios.graph.v2');
  assert.equal(scenario.config.configVersion, 'persona-scenarios.v2');
  assert.equal(scenario.maxTokenBudget, scenario.config.maxTokenBudget);
  assert.ok(scenario.input.requestId && scenario.input.turnId && scenario.privacyBoundary);
}

function verifySelection(
  scenario: NeuralPersonaPersonalityScenario,
  selectedIds: string[],
  filteredIds: string[],
) {
  scenario.mustSelectNodeIds.forEach((nodeId) => {
    assert.ok(selectedIds.includes(nodeId), `${scenario.scenarioId} must select ${nodeId}`);
  });
  scenario.forbiddenNodeIds.forEach((nodeId) => {
    assert.ok(!selectedIds.includes(nodeId), `${scenario.scenarioId} must reject ${nodeId}`);
  });
  scenario.expectedFilteredNodeIds?.forEach((nodeId) => {
    assert.ok(filteredIds.includes(nodeId), `${scenario.scenarioId} must filter ${nodeId}`);
  });
}

function runScenario(scenario: NeuralPersonaPersonalityScenario) {
  verifyScenarioDefinition(scenario);
  const graphStore = createReadonlyNeuralPersonaGraphStore(scenario.graph, scenario.config);
  assert.equal(graphStore.valid, true, `${scenario.scenarioId} graph must be valid`);
  assert.ok(graphStore.store);
  const options = { config: scenario.config, input: scenario.input, store: graphStore.store! };
  const first = buildNeuralContextContribution(options);
  const second = buildNeuralContextContribution(options);
  assert.deepEqual(second, first, `${scenario.scenarioId} must be deterministic`);
  verifySelection(scenario, first.trace.selectedNodeIds, first.trace.filteredNodeIds);
  assert.ok(first.contribution.tokenBudgetUsed <= scenario.maxTokenBudget);
  assert.deepEqual(first.contribution.influences.map((value) => value.nodeId),
    first.trace.selectedNodeIds);
  first.contribution.influences.forEach((influence) => {
    assert.equal(Object.hasOwn(influence, 'sourceRef'), false,
      `${scenario.scenarioId} must not expose sourceRef`);
  });
}

assert.equal(NEURAL_PERSONA_PERSONALITY_SCENARIOS.length, 20);
assert.equal(new Set(NEURAL_PERSONA_PERSONALITY_SCENARIOS.map((value) => value.scenarioId)).size, 20);
NEURAL_PERSONA_PERSONALITY_SCENARIOS.forEach(runScenario);

console.log('neural persona 20 personality scenarios smoke ok');
