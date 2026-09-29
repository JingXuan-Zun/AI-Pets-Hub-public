import {
  assertSourceMatches,
  readProjectSources,
} from './smokeTestHarness.ts';

const {
  approvalRuntimeSource,
  controllerSource,
  permissionRouterSource,
  readonlyFinalRejectionSource,
  sessionSource,
  shadowSource,
  unattemptedFinalRejectionSource,
} = readProjectSources({
  approvalRuntimeSource: 'src/agent/runtime/agentApprovalContinuationRuntime.ts',
  controllerSource: 'src/components/chat/agentRunController.ts',
  permissionRouterSource: 'src/agent/agentPermissionRouter.ts',
  readonlyFinalRejectionSource: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
  sessionSource: 'src/agent/agentProductionSessionImplementation.ts',
  shadowSource: 'src/agent/agentTaskRuntimeV4SessionV2ShadowAdapter.ts',
  unattemptedFinalRejectionSource: 'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
});

assertSourceMatches(
  sessionSource,
  /visualActionReadiness when present: ready means the target\/action\/location evidence is actionable and should flow into an approval-required desktop input\/sequence tool/u,
  'SessionV2 prompt must route locate-ready visual evidence into approval-required dispatch.',
);
assertSourceMatches(
  sessionSource,
  /After locate_screen_elements returns targetMatched, primaryAction, and usable elementCenter[\s\S]*do not ask_user or final_answer[\s\S]*Select an approval-required desktop input\/sequence tool/u,
  'SessionV2 prompt must reject chat confirmation/final answer after actionable locate evidence.',
);
assertSourceMatches(
  sessionSource,
  /Read-only observation can identify candidates[\s\S]*it cannot count as opening, launching, clicking, focusing, moving, closing, or controlling anything/u,
  'SessionV2 prompt must not treat read-only tools as completing direct action requests.',
);
assertSourceMatches(
  shadowSource,
  /classification: anyDispatchEntry && inAppTask[\s\S]*\? 'outer_dispatch_only'[\s\S]*: 'target_resolved_without_dispatch'/u,
  'V4 shadow must classify locate-ready-without-dispatch distinctly.',
);
assertSourceMatches(
  shadowSource,
  /classification: 'approval_pending'/u,
  'V4 shadow must classify locate-ready pending approval distinctly.',
);
assertSourceMatches(
  shadowSource,
  /classification: dispatchEntry \? 'input_dispatched_unverified'/u,
  'V4 shadow must classify dispatched-but-unverified distinctly.',
);
assertSourceMatches(
  permissionRouterSource,
  /AGENT_TASK_APPROVAL_CONTINUATION_TOOLS[\s\S]*'execute_desktop_input'/u,
  'RunController same-task approval continuation must include execute_desktop_input.',
);
assertSourceMatches(
  approvalRuntimeSource,
  /runAgentTaskScopedApprovalContinuations[\s\S]*while \(pendingApproval && count < maxContinuations\)[\s\S]*diagnoseAgentTaskScopedApprovalContinuation/u,
  'AgentRuntime must consume eligible same-task pending approvals instead of returning loop ownership to UI.',
);
assertSourceMatches(
  controllerSource,
  /task-scoped approval continuation executing after read-only follow-up/u,
  'RunController must continue consuming same-task approvals after read-only follow-up execution.',
);
assertSourceMatches(
  permissionRouterSource,
  /isAgentCommandHardGate\(pendingCommand, pendingPlan\)/u,
  'RunController approval continuation must still stop hard gates.',
);

console.log('agent runtime v4 session v2 main chain bridge smoke ok');
