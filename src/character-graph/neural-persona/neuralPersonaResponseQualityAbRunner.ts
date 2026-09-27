import {
  NEURAL_PERSONA_RESPONSE_QUALITY_AB_SCHEMA_VERSION,
  type NeuralPersonaAbAutomaticCheck,
  type NeuralPersonaAbBranchResult,
  type NeuralPersonaAbExecutor,
  type NeuralPersonaAbMode,
  type NeuralPersonaAbProgress,
  type NeuralPersonaAbScenarioResult,
  type NeuralPersonaPreparedAbScenario,
  type NeuralPersonaResponseQualityAbReport,
  type NeuralPersonaResponseQualityScenario,
} from './neuralPersonaResponseQualityAbTypes';

export const NEURAL_PERSONA_RESPONSE_QUALITY_AB_RUNNER_VERSION = '1.0.0';
const INTERNAL_TERMS = [
  '人格节点', '神经节点', '人格图谱', '神经图谱', '节点权重',
  '检索结果', '内部 trace', 'sourceRef',
];

function includesSignal(output: string, signal: string) {
  const normalized = output.toLocaleLowerCase();
  return signal.split('|').some((alternative) => (
    normalized.includes(alternative.trim().toLocaleLowerCase())
  ));
}

export function evaluateNeuralPersonaAbResponse(
  output: string,
  mode: NeuralPersonaAbMode,
  scenario: NeuralPersonaResponseQualityScenario,
): NeuralPersonaAbAutomaticCheck {
  const required = mode === 'neural' ? scenario.neuralRequiredSignals : [];
  const forbidden = mode === 'neural' ? scenario.neuralForbiddenSignals : [];
  const requiredSignalHits = required.filter((signal) => includesSignal(output, signal));
  const missingRequiredSignals = required.filter((signal) => !includesSignal(output, signal));
  const forbiddenSignalHits = forbidden.filter((signal) => includesSignal(output, signal));
  const internalTermHits = INTERNAL_TERMS.filter((signal) => includesSignal(output, signal));
  return {
    forbiddenSignalHits,
    internalTermHits,
    missingRequiredSignals,
    passed: !missingRequiredSignals.length && !forbiddenSignalHits.length
      && !internalTermHits.length,
    requiredSignalHits,
  };
}

export async function hashNeuralPersonaAbPrompt(text: string) {
  const bytes = new TextEncoder().encode(text);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, '0')).join('');
}

export async function runNeuralPersonaAbBranch(options: {
  clock: () => number;
  executor: NeuralPersonaAbExecutor;
  mode: NeuralPersonaAbMode;
  prepared: NeuralPersonaPreparedAbScenario;
  signal?: AbortSignal;
}): Promise<NeuralPersonaAbBranchResult> {
  const systemInstruction = options.mode === 'classic'
    ? options.prepared.classicSystemInstruction : options.prepared.neuralSystemInstruction;
  const systemPromptSha256 = await hashNeuralPersonaAbPrompt(systemInstruction);
  const startedAt = options.clock();
  try {
    const output = await options.executor.execute({
      mode: options.mode,
      scenarioId: options.prepared.scenario.scenarioId,
      signal: options.signal,
      systemInstruction,
      userPrompt: options.prepared.scenario.userPrompt,
    });
    return {
      automaticCheck: evaluateNeuralPersonaAbResponse(
        output, options.mode, options.prepared.scenario,
      ),
      latencyMs: Math.max(0, options.clock() - startedAt),
      mode: options.mode,
      output,
      status: 'ok',
      systemPromptSha256,
    };
  } catch {
    return {
      automaticCheck: evaluateNeuralPersonaAbResponse(
        '', options.mode, options.prepared.scenario,
      ),
      errorCode: options.signal?.aborted ? 'ab-request-cancelled' : 'ab-model-request-failed',
      latencyMs: Math.max(0, options.clock() - startedAt),
      mode: options.mode,
      output: '',
      status: 'error',
      systemPromptSha256,
    };
  }
}

function executionOrder(index: number): NeuralPersonaAbMode[] {
  return index % 2 === 0 ? ['classic', 'neural'] : ['neural', 'classic'];
}

function scenarioResult(
  prepared: NeuralPersonaPreparedAbScenario,
  order: NeuralPersonaAbMode[],
  branches: Record<NeuralPersonaAbMode, NeuralPersonaAbBranchResult>,
): NeuralPersonaAbScenarioResult {
  return {
    classic: branches.classic,
    classicPersonaExpectation: prepared.scenario.classicPersonaExpectation,
    configVersion: prepared.configVersion,
    executionOrder: order,
    graphVersion: prepared.graphVersion,
    humanReview: { notes: '', status: 'pending' },
    humanReviewPrompt: prepared.scenario.humanReviewPrompt,
    instructionVersion: prepared.instructionVersion,
    neural: branches.neural,
    neuralForbiddenSignals: prepared.scenario.neuralForbiddenSignals,
    neuralRequiredSignals: prepared.scenario.neuralRequiredSignals,
    personaVersion: prepared.personaVersion,
    qualityRubric: prepared.scenario.qualityRubric,
    retrievalQuery: prepared.scenario.retrievalQuery,
    scenarioId: prepared.scenario.scenarioId,
    scenarioVersion: prepared.scenario.scenarioVersion,
    title: prepared.scenario.title,
    userPrompt: prepared.scenario.userPrompt,
  };
}

export async function runNeuralPersonaResponseQualityAb(options: {
  clock?: () => number;
  executor: NeuralPersonaAbExecutor;
  onProgress?: (progress: NeuralPersonaAbProgress) => void;
  preparedScenarios: NeuralPersonaPreparedAbScenario[];
  runId: string;
  signal?: AbortSignal;
}): Promise<NeuralPersonaResponseQualityAbReport> {
  const clock = options.clock ?? Date.now;
  const startedAt = clock();
  const scenarios: NeuralPersonaAbScenarioResult[] = [];
  const totalBranches = options.preparedScenarios.length * 2;
  let completedBranches = 0;
  for (const [index, prepared] of options.preparedScenarios.entries()) {
    const order = executionOrder(index);
    const branches = {} as Record<NeuralPersonaAbMode, NeuralPersonaAbBranchResult>;
    for (const mode of order) {
      branches[mode] = await runNeuralPersonaAbBranch({ ...options, clock, mode, prepared });
      completedBranches += 1;
      options.onProgress?.({
        completedBranches, mode, scenarioId: prepared.scenario.scenarioId, totalBranches,
      });
    }
    scenarios.push(scenarioResult(prepared, order, branches));
  }
  return {
    completedAt: clock(),
    model: options.executor.identity,
    runId: options.runId,
    runnerVersion: NEURAL_PERSONA_RESPONSE_QUALITY_AB_RUNNER_VERSION,
    scenarios,
    schemaVersion: NEURAL_PERSONA_RESPONSE_QUALITY_AB_SCHEMA_VERSION,
    startedAt,
  };
}
