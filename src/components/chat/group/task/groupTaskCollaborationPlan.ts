export type GroupTaskCollaborationStage =
  | 'analysis'
  | 'review'
  | 'execution'
  | 'verification'
  | 'report'
  | 'completed'
  | 'failed';

export type GroupTaskCollaborationPlan = {
  analystRoleId: string;
  currentStage: GroupTaskCollaborationStage;
  executorRoleId: string;
  reporterRoleId: string;
  reviewerRoleId: string;
};

function roleAt(roleIds: string[], index: number) {
  return roleIds[index] ?? roleIds[index % roleIds.length] ?? '';
}

export function createGroupTaskCollaborationPlan(
  roleIds: string[],
  preferredAnalystRoleId?: string | null,
): GroupTaskCollaborationPlan | null {
  const uniqueRoleIds = [...new Set(roleIds.map((id) => id.trim()).filter(Boolean))];
  if (!uniqueRoleIds.length) return null;
  const analystRoleId = preferredAnalystRoleId && uniqueRoleIds.includes(preferredAnalystRoleId)
    ? preferredAnalystRoleId : uniqueRoleIds[0];
  const ordered = [analystRoleId, ...uniqueRoleIds.filter((id) => id !== analystRoleId)];
  return {
    analystRoleId,
    currentStage: 'analysis',
    executorRoleId: roleAt(ordered, 2),
    reporterRoleId: roleAt(ordered, 3),
    reviewerRoleId: roleAt(ordered, 1),
  };
}

const NEXT_STAGE: Partial<Record<GroupTaskCollaborationStage, GroupTaskCollaborationStage>> = {
  analysis: 'review',
  review: 'execution',
  execution: 'verification',
  verification: 'report',
  report: 'completed',
};

export function advanceGroupTaskCollaborationPlan(plan: GroupTaskCollaborationPlan) {
  const currentStage = NEXT_STAGE[plan.currentStage];
  return currentStage ? { ...plan, currentStage } : plan;
}

export function failGroupTaskCollaborationPlan(plan: GroupTaskCollaborationPlan) {
  return { ...plan, currentStage: 'failed' as const };
}
