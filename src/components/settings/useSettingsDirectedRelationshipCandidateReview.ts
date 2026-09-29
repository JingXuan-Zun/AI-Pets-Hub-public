import { useState } from 'react';
import {
  approveDirectedRelationshipCandidate,
  rejectDirectedRelationshipCandidate,
  reviewDirectedRelationshipCandidateBatch,
  rollbackDirectedRelationshipCandidateReview,
  type DirectedRelationshipRepositoryData,
} from '../../character-relationship';

export function useSettingsDirectedRelationshipCandidateReview(options: {
  onChange: (repository: DirectedRelationshipRepositoryData) => void;
  repository: DirectedRelationshipRepositoryData;
}) {
  const [feedback, setFeedback] = useState('');
  const review = (candidateId: string, decision: 'approve' | 'reject') => {
    const result = decision === 'approve'
      ? approveDirectedRelationshipCandidate(options.repository, candidateId)
      : rejectDirectedRelationshipCandidate(options.repository, candidateId);
    setFeedback(result.reason === 'applied' ? '审核已记录。'
      : result.reason === 'relationship-version-conflict' ? '正式关系已发生变化，请拒绝旧候选并重新评估。'
      : result.reason === 'blocked-candidate' ? '该候选已被规则阻断，不能批准。' : '候选状态已变化，未重复执行。');
    if (result.repository !== options.repository) options.onChange(result.repository);
  };
  const rollback = (candidateId: string) => {
    const result = rollbackDirectedRelationshipCandidateReview(options.repository, candidateId);
    setFeedback(result.reason === 'applied' ? '审核已撤销，候选恢复为待处理。'
      : result.reason === 'record-changed-after-approval' ? '正式关系在批准后已变化，不能安全撤销该审核。'
      : '审核已撤销或候选状态已变化，未重复执行。');
    if (result.repository !== options.repository) options.onChange(result.repository);
  };
  const batch = (candidateIds: string[], decision: 'approve' | 'reject') => {
    const selected = new Set(candidateIds);
    const candidates = options.repository.candidates.filter((candidate) => candidate.status === 'pending'
      && selected.has(candidate.id)
      && (decision === 'reject' || candidate.screeningDecision === 'manual-review'));
    const result = reviewDirectedRelationshipCandidateBatch(
      options.repository, candidates.map((candidate) => candidate.id), decision,
    );
    setFeedback(`批量审核完成：成功 ${result.appliedCount}，跳过 ${result.outcomes.length - result.appliedCount}。`);
    if (result.repository !== options.repository) options.onChange(result.repository);
  };
  return {
    feedback,
    onApprove: (candidateId: string) => review(candidateId, 'approve'),
    onApproveAll: () => batch(options.repository.candidates.map((item) => item.id), 'approve'),
    onApproveGroup: (candidateIds: string[]) => batch(candidateIds, 'approve'),
    onReject: (candidateId: string) => review(candidateId, 'reject'),
    onRejectAll: () => batch(options.repository.candidates.map((item) => item.id), 'reject'),
    onRejectGroup: (candidateIds: string[]) => batch(candidateIds, 'reject'),
    onRollback: rollback,
  };
}
