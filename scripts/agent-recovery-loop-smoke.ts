import assert from 'node:assert/strict';
import { readModuleProjectSources as readProjectSources } from './projectModuleSource.mjs';

const { controllerSource, typesSource, permissionRouterSource } = readProjectSources({
  controllerSource: 'src/components/chat/agentRunController.ts',
  typesSource: 'src/types.ts',
  permissionRouterSource: 'src/agent/agentPermissionRouter.ts',
});

assert.match(
  typesSource,
  /export type ChatAgentWorkStageId =[\s\S]*'verify-result'[\s\S]*'decide-next-step'[\s\S]*'persona-reply'/u,
  'Agent workflow stages should decide the next step after verification and before persona reply',
);

assert.match(
  permissionRouterSource,
  /export function isAgentPermissionRouteSilentReadOnly\([\s\S]*step\.action\.risk === 'read'[\s\S]*step\.decision\.mode === 'silent'/u,
  'Agent auto-continuation should be limited to silent read-only permission routes',
);

assert.match(
  controllerSource,
  /presentAgentRunPendingApproval\(\{\s*agentRuntime: result\.continuation[\s\S]*createAgentApprovalMessage\(\{\s*agentRuntime,\s*command: pendingApproval\.command/u,
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
