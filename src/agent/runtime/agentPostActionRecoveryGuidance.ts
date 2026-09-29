import {
  compactAgentPlanningSignalText,
  getAgentPostActionState,
  getAgentStructuredEvidence,
} from './agentPlanningSignalEvidence';
import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

export function createAgentPostActionRecoveryGuidanceLines(entry: AgentRuntimeToolResultEntry) {
  const postActionState = getAgentPostActionState(entry);
  const recovery = getAgentStructuredEvidence(entry)?.postActionRecovery;
  const structuredRecoveryLines = [
    recovery?.strategy ? `postActionRecoveryStrategy=${recovery.strategy}` : '',
    recovery?.nextTool ? `nextTool=${recovery.nextTool}` : '',
    recovery?.nextArgs ? `nextArgs=${compactAgentPlanningSignalText(JSON.stringify(recovery.nextArgs), 420)}` : '',
    recovery?.reason ? `postActionRecoveryReason=${compactAgentPlanningSignalText(recovery.reason, 360)}` : '',
  ].filter(Boolean);

  switch (postActionState) {
    case 'loading':
      return [
        ...structuredRecoveryLines,
        'postActionRecovery=The latest UI appears to be loading or launching. Do not ask the user whether to continue waiting.',
        'nextTool=execute_desktop_observation',
        'nextArgs={"action":"wait_and_observe","waitMs":2500,"forceRefresh":true,"includeVisual":true}',
      ];
    case 'updating':
      return [
        ...structuredRecoveryLines,
        'postActionRecovery=The latest UI appears to be updating/downloading/installing. Do not click random controls or ask whether to keep waiting.',
        'nextTool=execute_desktop_observation',
        'nextArgs={"action":"wait_and_observe","waitMs":5000,"forceRefresh":true,"includeVisual":true}',
      ];
    case 'unchanged':
      return [
        ...structuredRecoveryLines,
        'postActionRecovery=The latest UI appears unchanged. Refresh visual evidence or re-locate the intended element before retrying only the unclear primitive.',
        'preferredTools=locate_screen_elements | execute_desktop_observation',
      ];
    case 'selection_mismatch':
      return [
        ...structuredRecoveryLines,
        'postActionRecovery=The latest UI appears to have selected/current detail evidence that does not match the requested target. Do not continue to the primary open/start/play action until the requested target is confirmed selected/current.',
        'preferredTools=locate_screen_elements | execute_desktop_observation',
      ];
    case 'visible_only':
      return [
        ...structuredRecoveryLines,
        'postActionRecovery=The requested target appears visible, but visible is not selected/current. Select the target first only after a permission card, then verify selection before any primary open/start/play action.',
        'preferredTools=locate_screen_elements | execute_desktop_observation',
      ];
    case 'unknown':
      return [
        ...structuredRecoveryLines,
        'postActionRecovery=The latest UI state is unknown. Refresh observation before retrying or asking one short question.',
        'preferredTools=execute_desktop_observation | locate_screen_elements',
      ];
    case 'error':
      return [
        ...structuredRecoveryLines,
        'postActionRecovery=The latest UI appears to show an error. Read visible error text before retrying or reporting failure.',
        'preferredTools=locate_screen_elements | execute_desktop_observation',
      ];
    case 'blocked':
      return [
        ...structuredRecoveryLines,
        'postActionRecovery=The latest UI appears blocked by a permission, modal, policy, or confirmation gate. Read the visible blocker before retrying.',
        'preferredTools=locate_screen_elements | execute_desktop_observation',
      ];
    case 'login_required':
      return [
        ...structuredRecoveryLines,
        'postActionRecovery=The latest UI appears to require login/account continuation. If credentials are already filled or remembered, locate and use a safe login/continue/confirm control. Ask the user only for captcha, QR scan, 2FA/SMS verification, empty required credentials, admin/UAC confirmation, or another non-automatable private gate.',
        'preferredTools=locate_screen_elements | execute_desktop_observation | execute_desktop_action',
      ];
    default:
      return structuredRecoveryLines;
  }
}
