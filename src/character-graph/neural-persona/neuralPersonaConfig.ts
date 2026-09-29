export interface NeuralPersonaConfig {
  candidateThreshold: number;
  configVersion: string;
  maxCandidateNodes: number;
  maxInfluenceSummaryCharacters: number;
  maxPropagationDepth: number;
  maxSelectedNodes: number;
  maxTagsPerNode: number;
  maxTagRecordsPerNode: number;
  maxTokenBudget: number;
  propagationThreshold: number;
  repeatPenalty: number;
}

export const DEFAULT_NEURAL_PERSONA_CONFIG: Readonly<NeuralPersonaConfig> = Object.freeze({
  candidateThreshold: 0.2,
  configVersion: 'neural-persona-config.v1',
  maxCandidateNodes: 12,
  maxInfluenceSummaryCharacters: 240,
  maxPropagationDepth: 2,
  maxSelectedNodes: 5,
  maxTagsPerNode: 12,
  maxTagRecordsPerNode: 24,
  maxTokenBudget: 400,
  propagationThreshold: 0.15,
  repeatPenalty: 0.2,
});

export type NeuralPersonaConfigIssueCode =
  | 'candidate-limit-invalid'
  | 'candidate-threshold-invalid'
  | 'propagation-depth-invalid'
  | 'propagation-threshold-invalid'
  | 'repeat-penalty-invalid'
  | 'selected-limit-invalid'
  | 'summary-limit-invalid'
  | 'tag-limit-invalid'
  | 'tag-record-limit-invalid'
  | 'token-budget-invalid';

function inUnitRange(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

export function validateNeuralPersonaConfig(config: NeuralPersonaConfig) {
  const issues: NeuralPersonaConfigIssueCode[] = [];
  if (!Number.isInteger(config.maxSelectedNodes) || config.maxSelectedNodes < 1
    || config.maxSelectedNodes > 5) issues.push('selected-limit-invalid');
  if (!Number.isInteger(config.maxCandidateNodes) || config.maxCandidateNodes < 1
    || config.maxCandidateNodes > 30) issues.push('candidate-limit-invalid');
  if (!Number.isInteger(config.maxPropagationDepth) || config.maxPropagationDepth < 0
    || config.maxPropagationDepth > 2) issues.push('propagation-depth-invalid');
  if (!Number.isInteger(config.maxTokenBudget) || config.maxTokenBudget < 1
    || config.maxTokenBudget > 400) issues.push('token-budget-invalid');
  if (!Number.isInteger(config.maxInfluenceSummaryCharacters)
    || config.maxInfluenceSummaryCharacters < 1
    || config.maxInfluenceSummaryCharacters > 240) issues.push('summary-limit-invalid');
  if (!Number.isInteger(config.maxTagsPerNode) || config.maxTagsPerNode < 0
    || config.maxTagsPerNode > 12) issues.push('tag-limit-invalid');
  if (!Number.isInteger(config.maxTagRecordsPerNode)
    || config.maxTagRecordsPerNode < config.maxTagsPerNode
    || config.maxTagRecordsPerNode > 24) issues.push('tag-record-limit-invalid');
  if (!inUnitRange(config.candidateThreshold)) issues.push('candidate-threshold-invalid');
  if (!inUnitRange(config.propagationThreshold)) issues.push('propagation-threshold-invalid');
  if (!inUnitRange(config.repeatPenalty)) issues.push('repeat-penalty-invalid');
  return { issues, valid: issues.length === 0 };
}
