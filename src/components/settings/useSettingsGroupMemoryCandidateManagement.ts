import {
  approveGroupMemoryCandidate,
  rejectGroupMemoryCandidate,
  rollbackGroupMemoryCandidateReview,
  type GroupMemoryCandidateReviewResult,
  type GroupMemoryCandidateReviewReason,
  type GroupMemoryRepositoryData,
} from '../../group-memory';
import { useState } from 'react';

const FEEDBACK: Record<GroupMemoryCandidateReviewReason, string> = {
  applied: '操作成功。请保存设置以持久化本次变更。',
  'already-reverted': '该审核已经撤销，不能重复撤销。',
  'candidate-not-found': '候选不存在，可能已被归档或移除。',
  'candidate-not-pending': '候选已审核，不能重复批准或拒绝。',
  'candidate-status-changed': '候选状态已变化，请刷新后重试。',
  'evidence-mismatch': '证据与候选来源、话题不一致，已阻止写入。',
  'group-not-writable': '目标记忆组不存在或已停用，已阻止写入。',
  'record-changed-after-approval': '正式记忆在批准后已被修改，不能直接撤销。',
  'record-conflict': '正式记忆存在更新版本或同时间戳冲突，已阻止覆盖。',
  'review-not-found': '没有可撤销的审核记录。',
};

export function useSettingsGroupMemoryCandidateManagement(
  repository: GroupMemoryRepositoryData,
  onChange: (repository: GroupMemoryRepositoryData) => void,
) {
  const [feedback, setFeedback] = useState('');
  const applyResult = (result: GroupMemoryCandidateReviewResult) => {
    setFeedback(FEEDBACK[result.reason]);
    if (result.receipt) onChange(result.repository);
  };
  return {
    approve: (candidateId: string, groupId: string) => applyResult(
      approveGroupMemoryCandidate(repository, candidateId, Date.now(), groupId),
    ),
    reject: (candidateId: string) => applyResult(
      rejectGroupMemoryCandidate(repository, candidateId),
    ),
    feedback,
    rollback: (candidateId: string) => applyResult(
      rollbackGroupMemoryCandidateReview(repository, candidateId),
    ),
  };
}
