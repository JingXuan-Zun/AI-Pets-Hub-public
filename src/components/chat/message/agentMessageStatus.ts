import { type ChatMessage } from '../../../types';

export function resolveAgentApprovalStatusText(status: NonNullable<ChatMessage['agentApproval']>['status']) {
  switch (status) {
    case 'pending':
      return '等待确认';
    case 'running':
      return '执行中';
    case 'awaiting-approval':
      return '待确认';
    case 'completed':
      return '已完成';
    case 'denied':
      return '已拒绝';
    case 'failed':
      return '失败';
    case 'blocked':
      return '\u5df2\u7ec8\u6b62';
    case 'approved':
      return '已允许';
    default:
      return '待处理';
  }
}

export function resolveAgentRunStatusText(status: NonNullable<ChatMessage['agentRun']>['status']) {
  switch (status) {
    case 'planned':
      return '已规划';
    case 'running':
      return '执行中';
    case 'awaiting-approval':
      return '待确认';
    case 'completed':
      return '已完成';
    case 'failed':
      return '失败';
    case 'blocked':
      return '已拦截';
    default:
      return '待处理';
  }
}

export function resolveAgentApprovalPermissionText(mode: string) {
  if (mode === 'silent') {
    return '自动';
  }

  if (mode === 'notify') {
    return '提示';
  }

  if (mode === 'confirm') {
    return '确认';
  }

  return '禁止';
}
