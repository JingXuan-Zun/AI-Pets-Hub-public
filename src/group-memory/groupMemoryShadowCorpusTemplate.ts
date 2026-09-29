import type { GroupMemoryCandidate } from './groupMemoryTypes';
import type { GroupMemoryCandidateScreeningDecision } from './groupMemoryCandidateScreening';
import type { GroupMemoryShadowCorpus } from './groupMemoryShadowCorpusImport';

export type GroupMemoryShadowCorpusTemplate = Omit<
  GroupMemoryShadowCorpus,
  'redactionConfirmed'
> & { redactionConfirmed: false };

function exampleCandidate(options: {
  excerpt: string;
  id: string;
  kind: GroupMemoryCandidate['proposedRecord']['kind'];
  evidenceKind: GroupMemoryCandidate['evidence']['kind'];
  confidence: number;
}) {
  return {
    createdAt: 1,
    evidence: {
      capturedAt: 1, excerpt: options.excerpt, kind: options.evidenceKind,
      sourceMessageId: `example-message-${options.id}`, sourceRoleId: 'example-role-a',
      topicId: 'example-topic-a',
    },
    id: `example-candidate-${options.id}`,
    proposedRecord: {
      confidence: options.confidence, createdAt: 1, groupId: 'current-group',
      id: `example-record-${options.id}`, kind: options.kind,
      sourceRoleId: 'example-role-a', summary: options.excerpt,
      topicId: 'example-topic-a', updatedAt: 1, visibility: 'group',
    },
    status: 'pending',
  } satisfies GroupMemoryCandidate;
}

function exampleSample(
  id: string,
  expectedDecision: GroupMemoryCandidateScreeningDecision,
  candidate: GroupMemoryCandidate,
) {
  return { candidate, expectedDecision, id: `example-sample-${id}` };
}

export function createGroupMemoryShadowCorpusTemplate(
  createdAt = Date.now(),
): GroupMemoryShadowCorpusTemplate {
  return {
    corpusId: 'group-memory-shadow-template-v1',
    createdAt,
    redactionConfirmed: false,
    samples: [
      exampleSample('eligible', 'eligible', exampleCandidate({
        confidence: 1, evidenceKind: 'task-result', excerpt: '实际工具结果确认：示例任务已经完成。',
        id: 'eligible', kind: 'verified-fact',
      })),
      exampleSample('manual', 'manual-review', exampleCandidate({
        confidence: 0.8, evidenceKind: 'chat-message', excerpt: '示例角色倾向于采用方案甲。',
        id: 'manual', kind: 'role-perspective',
      })),
      exampleSample('blocked', 'blocked', exampleCandidate({
        confidence: 0.8, evidenceKind: 'chat-message', excerpt: '是否应该把这条示例问题保存下来？',
        id: 'blocked', kind: 'discussion-summary',
      })),
    ],
    schemaVersion: 1,
  };
}

export function serializeGroupMemoryShadowCorpusTemplate(createdAt = Date.now()) {
  return `${JSON.stringify(createGroupMemoryShadowCorpusTemplate(createdAt), null, 2)}\n`;
}
