import {
  evaluateNeuralPersonaAbResponse,
  NEURAL_PERSONA_RESPONSE_QUALITY_AB_RUNNER_VERSION,
  runNeuralPersonaAbBranch,
} from './neuralPersonaResponseQualityAbRunner';
import type {
  NeuralPersonaAbBranchResult,
  NeuralPersonaAbExecutor,
  NeuralPersonaAbMode,
  NeuralPersonaAbProgress,
  NeuralPersonaAbScenarioResult,
  NeuralPersonaPreparedAbScenario,
  NeuralPersonaResponseQualityAbReport,
} from './neuralPersonaResponseQualityAbTypes';

const MODES: NeuralPersonaAbMode[] = ['classic', 'neural'];

export function countNeuralPersonaAbErrorBranches(
  report: NeuralPersonaResponseQualityAbReport,
) {
  return report.scenarios.reduce((total, scenario) => (
    total + MODES.filter((mode) => scenario[mode].status === 'error').length
  ), 0);
}

function reassessBranch(
  branch: NeuralPersonaAbBranchResult,
  mode: NeuralPersonaAbMode,
  prepared: NeuralPersonaPreparedAbScenario,
) {
  return {
    ...branch,
    automaticCheck: evaluateNeuralPersonaAbResponse(
      branch.output, mode, prepared.scenario,
    ),
  };
}

async function retryScenario(options: {
  clock: () => number;
  executor: NeuralPersonaAbExecutor;
  existing: NeuralPersonaAbScenarioResult;
  onRetried: (mode: NeuralPersonaAbMode) => void;
  prepared: NeuralPersonaPreparedAbScenario;
  signal?: AbortSignal;
}) {
  const branches = {
    classic: reassessBranch(options.existing.classic, 'classic', options.prepared),
    neural: reassessBranch(options.existing.neural, 'neural', options.prepared),
  };
  let retried = false;
  for (const mode of MODES) {
    if (branches[mode].status !== 'error') continue;
    branches[mode] = await runNeuralPersonaAbBranch({ ...options, mode });
    options.onRetried(mode);
    retried = true;
  }
  return {
    ...options.existing,
    classic: branches.classic,
    classicPersonaExpectation: options.prepared.scenario.classicPersonaExpectation,
    configVersion: options.prepared.configVersion,
    graphVersion: options.prepared.graphVersion,
    humanReview: retried ? { notes: '', status: 'pending' as const }
      : options.existing.humanReview,
    humanReviewPrompt: options.prepared.scenario.humanReviewPrompt,
    instructionVersion: options.prepared.instructionVersion,
    neural: branches.neural,
    neuralForbiddenSignals: options.prepared.scenario.neuralForbiddenSignals,
    neuralRequiredSignals: options.prepared.scenario.neuralRequiredSignals,
    personaVersion: options.prepared.personaVersion,
    qualityRubric: options.prepared.scenario.qualityRubric,
    retrievalQuery: options.prepared.scenario.retrievalQuery,
    scenarioVersion: options.prepared.scenario.scenarioVersion,
    title: options.prepared.scenario.title,
    userPrompt: options.prepared.scenario.userPrompt,
  };
}

export async function retryNeuralPersonaResponseQualityAbErrors(options: {
  clock?: () => number;
  executor: NeuralPersonaAbExecutor;
  onProgress?: (progress: NeuralPersonaAbProgress) => void;
  preparedScenarios: NeuralPersonaPreparedAbScenario[];
  report: NeuralPersonaResponseQualityAbReport;
  runId: string;
  signal?: AbortSignal;
}): Promise<NeuralPersonaResponseQualityAbReport> {
  const clock = options.clock ?? Date.now;
  const startedAt = clock();
  const totalBranches = countNeuralPersonaAbErrorBranches(options.report);
  let completedBranches = 0;
  const preparedById = new Map(options.preparedScenarios.map((item) => (
    [item.scenario.scenarioId, item]
  )));
  const scenarios: NeuralPersonaAbScenarioResult[] = [];
  for (const existing of options.report.scenarios) {
    const prepared = preparedById.get(existing.scenarioId);
    if (!prepared) throw new Error(`missing retry scenario: ${existing.scenarioId}`);
    scenarios.push(await retryScenario({
      ...options,
      clock,
      existing,
      onRetried: (mode) => {
        completedBranches += 1;
        options.onProgress?.({
          completedBranches, mode, scenarioId: existing.scenarioId, totalBranches,
        });
      },
      prepared,
    }));
  }
  return {
    ...options.report,
    completedAt: clock(),
    model: options.executor.identity,
    retryOfRunId: options.report.runId,
    rerunReason: 'error-retry',
    runId: options.runId,
    runnerVersion: NEURAL_PERSONA_RESPONSE_QUALITY_AB_RUNNER_VERSION,
    scenarios,
    startedAt,
  };
}
