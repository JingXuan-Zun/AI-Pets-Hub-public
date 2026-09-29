import type {
  RelationshipEvidenceWindowReadiness,
  RelationshipEvidenceWindowReason,
} from './relationshipEvidenceWindowTypes';

const DAY = 24 * 60 * 60 * 1000;

function signal(options: {
  createdAt: number;
  id: string;
  relationship?: 'forward' | 'reverse';
  trust: number;
}) {
  const reverse = options.relationship === 'reverse';
  return {
    createdAt: options.createdAt,
    deltas: { intimacy: Math.sign(options.trust), trust: options.trust, vigilance: 0 },
    id: options.id, screeningDecision: 'manual-review',
    sourceMessageId: `message-${options.id}`,
    sourceRoleId: reverse ? 'role-b' : 'role-a',
    targetRoleId: reverse ? 'role-a' : 'role-b',
  };
}

function sample(options: {
  expectedReadiness: RelationshipEvidenceWindowReadiness;
  expectedReasons: RelationshipEvidenceWindowReason[];
  id: string;
  now: number;
  signals: ReturnType<typeof signal>[];
}) {
  return {
    candidates: options.signals, corrections: [],
    expectedReadiness: options.expectedReadiness, expectedReasons: options.expectedReasons,
    id: options.id,
    now: options.now, reviews: [],
  };
}

export function createRelationshipEvidenceShadowCorpusTemplate(createdAt = Date.now()) {
  const now = 40 * DAY;
  return {
    corpusId: 'relationship-evidence-shadow-template-v2', createdAt,
    redactionConfirmed: false,
    samples: [
      sample({
        expectedReadiness: 'sustained-shadow', expectedReasons: ['sustained-pattern'],
        id: 'sustained-pattern', now,
        signals: [3, 2, 1].map((age, index) => signal({
          createdAt: now - age * DAY, id: `sustained-${index + 1}`, trust: 2,
        })),
      }),
      sample({
        expectedReadiness: 'volatile-shadow', expectedReasons: ['contradictory-signals'],
        id: 'contradictory-pattern', now,
        signals: [3, 2.5, 2, 1].map((age, index) => signal({
          createdAt: now - age * DAY, id: `volatile-${index + 1}`,
          relationship: 'reverse', trust: index % 2 ? -2 : 2,
        })),
      }),
      sample({
        expectedReadiness: 'insufficient-evidence',
        expectedReasons: ['insufficient-signals', 'insufficient-distinct-messages'],
        id: 'insufficient-pattern', now,
        signals: [2, 1].map((age, index) => signal({
          createdAt: now - age * DAY, id: `insufficient-${index + 1}`, trust: 1,
        })),
      }),
    ],
    schemaVersion: 2,
  } as const;
}

export function serializeRelationshipEvidenceShadowCorpusTemplate(createdAt = Date.now()) {
  return `${JSON.stringify(createRelationshipEvidenceShadowCorpusTemplate(createdAt), null, 2)}\n`;
}
