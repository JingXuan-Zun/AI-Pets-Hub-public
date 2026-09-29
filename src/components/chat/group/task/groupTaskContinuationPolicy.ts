import type { ChatAgentRunStatus } from '../../../../types';
import type { GroupTaskResultReceipt } from './groupTaskResultReceipt';

export function resolveGroupTaskContinuationOutcome(options: {
  hasPendingFollowUp?: boolean;
  runStatus: ChatAgentRunStatus;
}): GroupTaskResultReceipt['outcome'] {
  if (options.hasPendingFollowUp || options.runStatus === 'awaiting-approval') {
    return 'pending-approval';
  }
  return options.runStatus === 'completed' ? 'completed' : 'failed';
}
