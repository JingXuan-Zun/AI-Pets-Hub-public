import assert from 'node:assert/strict';
import { readProjectSources } from './smokeTestHarness.ts';

const { controllerSource, coreSource, typesSource, permissionRouterSource } = readProjectSources({
  controllerSource: 'src/components/chat/agentRunController.ts',
  coreSource: 'src/agent/agentCore.ts',
  typesSource: 'src/types.ts',
  permissionRouterSource: 'src/agent/agentPermissionRouter.ts',
});

assert.match(
  typesSource,
  /export type ChatAgentWorkStageId =[\s\S]*'verify-result'[\s\S]*'decide-next-step'[\s\S]*'persona-reply'/u,
  'Agent workflow stages should decide the next step after verification and before persona reply',
);

assert.match(
  coreSource,
  /function createAgentRecoveryFollowUpActions\([\s\S]*assessmentStatus === 'unverified'[\s\S]*assessmentStatus === 'failed'[\s\S]*assessmentStatus === 'needs-user'/u,
  'Agent recovery should branch from assessment statuses instead of one-off command names',
);

assert.match(
  coreSource,
  /createAgentReobserveCommand\([\s\S]*organize_desktop_icons[\s\S]*inspect_local_project[\s\S]*get_display_info[\s\S]*launch_local_app/u,
  'Agent recovery should offer observation or retry routes across existing tool families',
);

assert.match(
  coreSource,
  /function enrichAgentResultWithRecoveryActions\([\s\S]*followUpAction: followUpActions\[0\][\s\S]*followUpActions: followUpActions\.length/u,
  'Agent assessment should enrich results with clickable recovery actions',
);

assert.match(
  coreSource,
  /function resolveAgentAutoContinuationCandidate\([\s\S]*status !== 'unverified' && status !== 'failed'[\s\S]*buildAgentPermissionRoute\(action\.command\)[\s\S]*isAgentPermissionRouteAutoContinuableObservation\(route\)/u,
  'Agent should auto-continue only from failed or unverified results through permission-routed observation recovery',
);

assert.match(
  permissionRouterSource,
  /export function isAgentPermissionRouteSilentReadOnly\([\s\S]*step\.action\.risk === 'read'[\s\S]*step\.decision\.mode === 'silent'/u,
  'Agent auto-continuation should be limited to silent read-only permission routes',
);

assert.match(
  coreSource,
  /const AGENT_CORE_RUN_LOOP_MAX_ROUNDS = 3/u,
  'Agent run loop should have a small bounded iteration cap',
);

assert.match(
  coreSource,
  /async function executeAgentCoreRunLoop\([\s\S]*roundIndex <= AGENT_CORE_RUN_LOOP_MAX_ROUNDS[\s\S]*resolveAgentAutoContinuationCandidate/u,
  'Agent should execute recovery through a bounded multi-round loop',
);

assert.match(
  coreSource,
  /function resolveAgentApprovalPauseCandidate\([\s\S]*buildAgentPermissionRoute\(candidate\.command\)[\s\S]*shouldRequestAgentPermissionRouteApproval\(route\)[\s\S]*reason:/u,
  'Agent run loop should pause when a discovered continuation requires confirmation',
);

assert.match(
  controllerSource,
  /createAgentApprovalMessage\(\{[\s\S]*agentRuntime: result\.continuation/u,
  'Agent Runtime should create a continuation approval message when the model selects an approval-required tool',
);

assert.match(
  controllerSource,
  /pushFrontendRuntimeLog\('agent-session-v2', 'session completed'[\s\S]*toolResultCount: result\.toolResults\.length/u,
  'AgentSessionV2 runtime logs should record status, steps, and tool results',
);

assert.match(
  controllerSource,
  /'decide-next-step'[\s\S]*createAgentDecisionSummary\(result, followUpActions\)/u,
  'Agent workflow should record the next-step decision summary',
);

assert.match(
  controllerSource,
  /followUpActions: resolveAgentResultFollowUpActions\(result\)/u,
  'Agent messages should persist recovery actions for the UI',
);

assert.match(
  typesSource,
  /export interface ChatAgentRunLoopRound[\s\S]*index: number;[\s\S]*stopReason: string;/u,
  'Agent chat state should persist per-round run loop evidence for legacy Core traces',
);

assert.doesNotMatch(
  controllerSource,
  /runLoop\.rounds|addAgentRunLoopApprovalPauseMessage|executeAgentCoreRunLoop/u,
  'Agent controller should no longer store old Core run loop rounds',
);
console.log('agent recovery loop smoke ok');
