export const NEURAL_PERSONA_RESPONSE_QUALITY_AB_SCHEMA_VERSION = (
  'neural-persona-response-quality-ab.v1'
);

export type NeuralPersonaAbMode = 'classic' | 'neural';
export type NeuralPersonaAbScalar = boolean | number | string | null;

export interface NeuralPersonaResponseQualityRubric {
  criterionId: string;
  description: string;
  label: string;
  weight: number;
}

export interface NeuralPersonaResponseQualityScenario {
  classicPersonaExpectation: string;
  humanReviewPrompt: string;
  neuralForbiddenSignals: string[];
  neuralRequiredSignals: string[];
  qualityRubric: NeuralPersonaResponseQualityRubric[];
  retrievalQuery: string;
  scenarioId: string;
  scenarioVersion: string;
  title: string;
  userPrompt: string;
}

export interface NeuralPersonaPreparedAbScenario {
  classicSystemInstruction: string;
  configVersion: string;
  graphVersion: string;
  instructionVersion: string;
  neuralSystemInstruction: string;
  personaVersion: string;
  scenario: NeuralPersonaResponseQualityScenario;
}

export interface NeuralPersonaAbModelIdentity {
  modelId: string;
  parameterSummary: Record<string, NeuralPersonaAbScalar>;
  providerId: string;
}

export interface NeuralPersonaAbExecutionInput {
  mode: NeuralPersonaAbMode;
  scenarioId: string;
  signal?: AbortSignal;
  systemInstruction: string;
  userPrompt: string;
}

export interface NeuralPersonaAbExecutor {
  execute: (input: NeuralPersonaAbExecutionInput) => Promise<string>;
  identity: NeuralPersonaAbModelIdentity;
}

export interface NeuralPersonaAbAutomaticCheck {
  forbiddenSignalHits: string[];
  internalTermHits: string[];
  missingRequiredSignals: string[];
  passed: boolean;
  requiredSignalHits: string[];
}

export interface NeuralPersonaAbBranchResult {
  automaticCheck: NeuralPersonaAbAutomaticCheck;
  errorCode?: string;
  latencyMs: number;
  mode: NeuralPersonaAbMode;
  output: string;
  status: 'error' | 'ok';
  systemPromptSha256: string;
}

export interface NeuralPersonaAbHumanReview {
  notes: string;
  reviewedAt?: number;
  reviewerId?: string;
  status: 'fail' | 'pass' | 'pending';
}

export interface NeuralPersonaAbScenarioResult {
  classic: NeuralPersonaAbBranchResult;
  classicPersonaExpectation: string;
  configVersion: string;
  executionOrder: NeuralPersonaAbMode[];
  graphVersion: string;
  humanReview: NeuralPersonaAbHumanReview;
  humanReviewPrompt: string;
  instructionVersion: string;
  neural: NeuralPersonaAbBranchResult;
  neuralForbiddenSignals: string[];
  neuralRequiredSignals: string[];
  personaVersion: string;
  qualityRubric: NeuralPersonaResponseQualityRubric[];
  retrievalQuery: string;
  scenarioId: string;
  scenarioVersion: string;
  title: string;
  userPrompt: string;
}

export interface NeuralPersonaResponseQualityAbReport {
  completedAt: number;
  model: NeuralPersonaAbModelIdentity;
  runId: string;
  runnerVersion: string;
  retryOfRunId?: string;
  rerunReason?: 'changed-request-input' | 'changed-system-prompt' | 'error-retry';
  scenarios: NeuralPersonaAbScenarioResult[];
  schemaVersion: typeof NEURAL_PERSONA_RESPONSE_QUALITY_AB_SCHEMA_VERSION;
  startedAt: number;
}

export interface NeuralPersonaAbProgress {
  completedBranches: number;
  mode: NeuralPersonaAbMode;
  scenarioId: string;
  totalBranches: number;
}
