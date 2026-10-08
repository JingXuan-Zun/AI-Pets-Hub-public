import { type AgentRuntimeToolResultEntry } from '../runtime/agentRuntimeContract';
import { getAgentStructuredEvidence } from '../runtime/agentToolEvidence';

/**
 * The latest screen read already located the requested control as ready to click with an
 * audited coordinate. Another automatic read only re-confirms it (10-45s per vision call);
 * live WeGame runs ran out of the 90s stage budget re-reading a ready login button.
 */
export function isAgentReadyVisualActionEvidence(entry: AgentRuntimeToolResultEntry | null) {
  if (!entry || entry.result.ok === false || entry.command.toolCall?.name !== 'locate_screen_elements') {
    return false;
  }
  const evidence = getAgentStructuredEvidence(entry);
  const auditStatus = evidence?.coordinateAudit?.status ?? evidence?.coordinateAuditStatus ?? null;
  return evidence?.visualActionReadiness === 'ready'
    && evidence.captureTrusted !== false
    && auditStatus === 'coordinate_ok'
    && Boolean(evidence.primaryAction?.trim() || evidence.targetMatched?.trim());
}
