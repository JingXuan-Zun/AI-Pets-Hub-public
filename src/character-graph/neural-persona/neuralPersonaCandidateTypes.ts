import type { NeuralPersonaNode } from './neuralPersonaTypes';

export interface NeuralPersonaCandidateScore {
  baseWeight: number;
  confidence: number;
  cooldownPenalty: number;
  keywordRelevance: number;
  repeatPenalty: number;
  semanticRelevance?: number;
  tagRelevance: number;
  total: number;
}

export interface NeuralPersonaCandidate {
  depth: number;
  node: NeuralPersonaNode;
  path: string[];
  reason: string[];
  score: NeuralPersonaCandidateScore;
}
