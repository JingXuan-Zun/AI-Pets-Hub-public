import {
  evaluateNeuralPersonaAbResponse,
  hashNeuralPersonaAbPrompt,
  NEURAL_PERSONA_RESPONSE_QUALITY_AB_RUNNER_VERSION,
  runNeuralPersonaAbBranch,
} from './neuralPersonaResponseQualityAbRunner';
import type {
  NeuralPersonaAbBranchResult,
  NeuralPersonaAbExecutor,
  NeuralPersonaAbModelIdentity,
  NeuralPersonaAbMode,
  NeuralPersonaAbProgress,
  NeuralPersonaAbScenarioResult,
  NeuralPersonaPreparedAbScenario,
  NeuralPersonaResponseQualityAbReport,
} from './neuralPersonaResponseQualityAbTypes';

const MODES: NeuralPersonaAbMode[] = ['classic', 'neural'];

function sameModelIdentity(
  left: NeuralPersonaAbModelIdentity,
  right: NeuralPersonaAbModelIdentity,
) {
  const entries = (value: NeuralPersonaAbModelIdentity) => (
    Object.entries(value.parameterSummary).sort(([a], [b]) => a.localeCompare(b))
  );
  return left.modelId === right.modelId && left.providerId === right.providerId
    && JSON.stringify(entries(left)) === JSON.stringify(entries(right));
}

function instruction(prepared: NeuralPersonaPreparedAbScenario, mode: NeuralPersonaAbMode) {
  return mode === 'classic'
    ? prepared.classicSystemInstruction : prepared.neuralSystemInstruction;
}

async function changedModes(
  existing: NeuralPersonaAbScenarioResult,
  prepared: NeuralPersonaPreparedAbScenario,
  forceAll = false,
) {
  if (forceAll || existing.userPrompt !== prepared.scenario.userPrompt) return [...MODES];
  const changed: NeuralPersonaAbMode[] = [];
  for (const mode of MODES) {
    const current = await hashNeuralPersonaAbPrompt(instruction(prepared, mode));
    if (current !== existing[mode].systemPromptSha256) changed.push(mode);
  }
  return changed;
}

export async function countNeuralPersonaAbChangedPromptBranches(options: {
  model?: NeuralPersonaAbModelIdentity;
  preparedScenarios: NeuralPersonaPreparedAbScenario[];
  report: NeuralPersonaResponseQualityAbReport;
}) {
  const existingById = new Map(options.report.scenarios.map((item) => [item.scenarioId, item]));
  const forceAll = options.model ? !sameModelIdentity(options.report.model, options.model) : false;
  let count = 0;
  for (const prepared of options.preparedScenarios) {
    const existing = existingById.get(prepared.scenario.scenarioId);
    if (!existing) throw new Error(`missing changed-prompt scenario: ${prepared.scenario.scenarioId}`);
    count += (await changedModes(existing, prepared, forceAll)).length;
  }
  return count;
}

function reassess(
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

function reviewCriteriaChanged(
  existing: NeuralPersonaAbScenarioResult,
  prepared: NeuralPersonaPreparedAbScenario,
) {
  const scenario = prepared.scenario;
  return existing.classicPersonaExpectation !== scenario.classicPersonaExpectation
    || existing.humanReviewPrompt !== scenario.humanReviewPrompt
    || existing.scenarioVersion !== scenario.scenarioVersion
    || JSON.stringify(existing.qualityRubric) !== JSON.stringify(scenario.qualityRubric)
    || JSON.stringify(existing.neuralForbiddenSignals) !== JSON.stringify(
      scenario.neuralForbiddenSignals,
    )
    || JSON.stringify(existing.neuralRequiredSignals) !== JSON.stringify(
      scenario.neuralRequiredSignals,
    );
}

function refreshScenario(options: {
  branches: Record<NeuralPersonaAbMode, NeuralPersonaAbBranchResult>;
  changed: NeuralPersonaAbMode[];
  existing: NeuralPersonaAbScenarioResult;
  prepared: NeuralPersonaPreparedAbScenario;
}) {
  const { existing, prepared } = options;
  const resetReview = options.changed.length > 0 || reviewCriteriaChanged(existing, prepared);
  return {
    ...existing,
    classic: options.branches.classic,
    classicPersonaExpectation: prepared.scenario.classicPersonaExpectation,
    configVersion: prepared.configVersion,
    graphVersion: prepared.graphVersion,
    humanReview: resetReview ? { notes: '', status: 'pending' as const }
      : existing.humanReview,
    humanReviewPrompt: prepared.scenario.humanReviewPrompt,
    instructionVersion: prepared.instructionVersion,
    neural: options.branches.neural,
    neuralForbiddenSignals: prepared.scenario.neuralForbiddenSignals,
    neuralRequiredSignals: prepared.scenario.neuralRequiredSignals,
    personaVersion: prepared.personaVersion,
    qualityRubric: prepared.scenario.qualityRubric,
    retrievalQuery: prepared.scenario.retrievalQuery,
    scenarioVersion: prepared.scenario.scenarioVersion,
    title: prepared.scenario.title,
    userPrompt: prepared.scenario.userPrompt,
  };
}

async function rerunScenario(options: {
  clock: () => number;
  executor: NeuralPersonaAbExecutor;
  existing: NeuralPersonaAbScenarioResult;
  forceAll: boolean;
  onRerun: (mode: NeuralPersonaAbMode) => void;
  prepared: NeuralPersonaPreparedAbScenario;
  signal?: AbortSignal;
}) {
  const changed = await changedModes(options.existing, options.prepared, options.forceAll);
  const branches = {
    classic: reassess(options.existing.classic, 'classic', options.prepared),
    neural: reassess(options.existing.neural, 'neural', options.prepared),
  };
  for (const mode of changed) {
    branches[mode] = await runNeuralPersonaAbBranch({ ...options, mode });
    options.onRerun(mode);
  }
  return refreshScenario({ branches, changed, existing: options.existing, prepared: options.prepared });
}

export async function rerunNeuralPersonaResponseQualityAbChangedPrompts(options: {
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
  const totalBranches = await countNeuralPersonaAbChangedPromptBranches({
    model: options.executor.identity,
    preparedScenarios: options.preparedScenarios,
    report: options.report,
  });
  const forceAll = !sameModelIdentity(options.report.model, options.executor.identity);
  const preparedById = new Map(options.preparedScenarios.map((item) => (
    [item.scenario.scenarioId, item]
  )));
  let completedBranches = 0;
  const scenarios: NeuralPersonaAbScenarioResult[] = [];
  for (const existing of options.report.scenarios) {
    const prepared = preparedById.get(existing.scenarioId);
    if (!prepared) throw new Error(`missing changed-prompt scenario: ${existing.scenarioId}`);
    scenarios.push(await rerunScenario({
      ...options, clock, existing, forceAll, prepared,
      onRerun: (mode) => {
        completedBranches += 1;
        options.onProgress?.({
          completedBranches, mode, scenarioId: existing.scenarioId, totalBranches,
        });
      },
    }));
  }
  return {
    ...options.report,
    completedAt: clock(),
    model: options.executor.identity,
    rerunReason: 'changed-request-input',
    retryOfRunId: options.report.runId,
    runId: options.runId,
    runnerVersion: NEURAL_PERSONA_RESPONSE_QUALITY_AB_RUNNER_VERSION,
    scenarios,
    startedAt,
  };
}
