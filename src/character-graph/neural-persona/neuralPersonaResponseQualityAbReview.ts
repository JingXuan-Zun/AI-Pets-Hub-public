import {
  NEURAL_PERSONA_RESPONSE_QUALITY_AB_SCHEMA_VERSION,
  type NeuralPersonaAbHumanReview,
  type NeuralPersonaResponseQualityAbReport,
} from './neuralPersonaResponseQualityAbTypes';

export interface NeuralPersonaAbHumanReviewDecision {
  notes: string;
  scenarioId: string;
  status: Exclude<NeuralPersonaAbHumanReview['status'], 'pending'>;
}

function assertDecision(decision: NeuralPersonaAbHumanReviewDecision) {
  if (!decision || typeof decision.scenarioId !== 'string' || !decision.scenarioId.trim()) {
    throw new Error('invalid-human-review-scenario');
  }
  if (decision.status !== 'pass' && decision.status !== 'fail') {
    throw new Error('invalid-human-review-status');
  }
  if (typeof decision.notes !== 'string') {
    throw new Error('invalid-human-review-notes');
  }
}

export function applyNeuralPersonaAbHumanReviews(options: {
  decisions: NeuralPersonaAbHumanReviewDecision[];
  report: NeuralPersonaResponseQualityAbReport;
  reviewedAt: number;
  reviewerId: string;
}): NeuralPersonaResponseQualityAbReport {
  if (options.report.schemaVersion !== NEURAL_PERSONA_RESPONSE_QUALITY_AB_SCHEMA_VERSION) {
    throw new Error('invalid-human-review-report-version');
  }
  if (!Number.isFinite(options.reviewedAt) || options.reviewedAt < 0) {
    throw new Error('invalid-human-review-time');
  }
  if (typeof options.reviewerId !== 'string' || !options.reviewerId.trim()) {
    throw new Error('invalid-human-reviewer');
  }
  options.decisions.forEach(assertDecision);
  const decisions = new Map(options.decisions.map((decision) => (
    [decision.scenarioId, decision]
  )));
  if (decisions.size !== options.decisions.length) {
    throw new Error('duplicate-human-review-scenario');
  }
  const scenarioIds = new Set(options.report.scenarios.map((item) => item.scenarioId));
  if (options.decisions.some((decision) => !scenarioIds.has(decision.scenarioId))) {
    throw new Error('unknown-human-review-scenario');
  }
  if (options.report.scenarios.some((scenario) => !decisions.has(scenario.scenarioId))) {
    throw new Error('incomplete-human-review-decisions');
  }
  return {
    ...options.report,
    scenarios: options.report.scenarios.map((scenario) => {
      const decision = decisions.get(scenario.scenarioId)!;
      return {
        ...scenario,
        humanReview: {
          notes: decision.notes,
          reviewedAt: options.reviewedAt,
          reviewerId: options.reviewerId.trim(),
          status: decision.status,
        },
      };
    }),
  };
}
