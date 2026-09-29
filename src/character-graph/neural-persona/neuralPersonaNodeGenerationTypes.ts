import type { NeuralPersonaNodeType } from './neuralPersonaTypes';
import type { NeuralPersonaRelationshipCandidate } from './neuralPersonaRelationshipCandidateTypes';

export const NEURAL_PERSONA_NODE_GENERATION_VERSION = (
  'neural-persona-node-generation.v1'
) as const;

export type NeuralPersonaGeneratedNodeType = Extract<NeuralPersonaNodeType,
  | 'belief-or-viewpoint'
  | 'concern-or-risk'
  | 'desire-or-goal'
  | 'emotional-tendency'
  | 'experience'
  | 'preference'
  | 'relationship-influence'
  | 'style-tendency'
>;

export interface NeuralPersonaNodeGenerationCandidate {
  baseWeight: number;
  candidateId: string;
  confidence: number;
  enabled: boolean;
  evidence: string;
  influenceSummary: string;
  origin: 'model' | 'user';
  tags: string[];
  topic?: string;
  type: NeuralPersonaGeneratedNodeType;
}

export interface NeuralPersonaNodeGenerationBatch {
  batchId: string;
  candidates: NeuralPersonaNodeGenerationCandidate[];
  generatedAt: number;
  personaName: string;
  providerId: string;
  relationshipAnalysis?: {
    candidates: NeuralPersonaRelationshipCandidate[];
    providerId: string;
    reason?: string;
    status: 'complete' | 'failed' | 'pending';
  };
  roleId: string;
  sourceText: string;
  version: typeof NEURAL_PERSONA_NODE_GENERATION_VERSION;
}

export interface NeuralPersonaNodeGenerationProgress {
  completedBatches: number;
  totalBatches: number;
}

export interface NeuralPersonaNodeGenerationRequest {
  batchId: string;
  now: number;
  personaName: string;
  requestId: string;
  roleId: string;
  onProgress?: (progress: NeuralPersonaNodeGenerationProgress) => void;
  signal?: AbortSignal;
  sourceText: string;
}

export type NeuralPersonaNodeGenerationProviderResult =
  | {
    candidates: unknown;
    fallbackCandidateCount?: number;
    fallbackReasons?: Record<string, number>;
    status: 'ok';
  }
  | { reason: string; status: 'unavailable' };

export interface NeuralPersonaNodeGenerationProvider {
  generate: (
    request: NeuralPersonaNodeGenerationRequest,
  ) => Promise<NeuralPersonaNodeGenerationProviderResult>;
  providerId: string;
}

export type NeuralPersonaNodeGenerationResult =
  | {
    batch: NeuralPersonaNodeGenerationBatch;
    recovery?: {
      mode: 'partial' | 'source-fallback';
      reason: string;
      rejectedCandidateCount: number;
      rejectionReasons?: Record<string, number>;
    };
    status: 'ok';
  }
  | { reason: string; status: 'invalid' | 'unavailable' };
