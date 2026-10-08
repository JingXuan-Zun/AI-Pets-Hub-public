import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { auditAgentRuntimeLegacyImports } from './agentRuntimeLegacyImportAuditCore.mjs';
import { assertProductionRuntimeCancellation } from './agentRuntimeCancellationGuard.mjs';
import { readModuleProjectFile } from './projectModuleSource.mjs';

export const AGENT_RUNTIME_RETIREMENT_OBSERVATION_SCHEMA_VERSION = 1;

export const AGENT_RUNTIME_RETIREMENT_REQUIRED_OBSERVATIONS = [
  {
    id: 'initial-readonly-task',
    description: 'A new read-only task reaches a Runtime-owned terminal state.',
  },
  {
    id: 'approved-side-effect-continuation',
    description: 'An approved side effect resumes the same task and reaches verification.',
  },
  {
    id: 'automatic-recovery-continuation',
    description: 'A bounded read-only recovery remains in the same task and produces a terminal result.',
  },
  {
    id: 'cancellation',
    description: 'Cancellation stops the active production task without a legacy fallback.',
  },
  {
    id: 'model-iteration-limit',
    description: 'The persisted Task Runtime model-iteration budget stops the task at its limit.',
  },
  {
    id: 'task-state-identity',
    description: 'Initial execution, approval resume, and follow-up progress preserve one taskId and monotonic revisions.',
  },
];

function readProjectFile(rootDir, relativePath) {
  return readFileSync(join(rootDir, relativePath), 'utf8');
}

function listSourceFiles(directory) {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(path);
    }
    return /\.(?:ts|tsx|mjs|mts)$/u.test(entry.name) ? [path] : [];
  });
}

function findVersionedImports(rootDir, directories) {
  const versionedImportPattern = /(?:from\s*['"][^'"]*(?:agentSessionV[23]|\/legacy\/)|import\s*\(\s*['"][^'"]*(?:agentSessionV[23]|\/legacy\/))/u;
  return directories.flatMap((directory) => listSourceFiles(join(rootDir, directory)))
    .filter((filePath) => versionedImportPattern.test(readFileSync(filePath, 'utf8')))
    .map((filePath) => relative(rootDir, filePath).replaceAll('\\', '/'));
}

function createStaticCheck(id, passed, detail) {
  return { detail, id, passed };
}

function hasProductionRuntimeCancellation(source) {
  try {
    assertProductionRuntimeCancellation(source);
    return true;
  } catch (error) {
    if (error?.code === 'ERR_ASSERTION') return false;
    throw error;
  }
}

export function inspectAgentRuntimeLegacyRetirementStaticCoverage(rootDir = process.cwd()) {
  const controllerSource = readModuleProjectFile('src/components/chat/agentRunController.ts', rootDir);
  const chatRuntimeCompatibilitySource = readProjectFile(
    rootDir,
    'src/components/chat/chatAgentRuntimeCompatibility.ts',
  );
  const sharedTypesSource = readProjectFile(rootDir, 'src/types.ts');
  const productionBarrelSource = readProjectFile(rootDir, 'src/agent/index.ts');
  const productionSessionContractSource = readProjectFile(
    rootDir,
    'src/agent/agentProductionSessionContract.ts',
  );
  const productionSessionSource = readProjectFile(rootDir, 'src/agent/agentProductionSession.ts');
  const productionSessionImplementationSource = readProjectFile(rootDir, 'src/agent/agentProductionSessionImplementation.ts');
  const productionSessionImplementationModulesSource = readModuleProjectFile(
    'src/agent/agentProductionSessionImplementation.ts', rootDir,
  );
  const modelPlanningTurnConnected = productionSessionImplementationSource.includes("from './productionSession/modelPlanningTurn'")
    && productionSessionImplementationSource.includes('const { executeModelPlanningTurn } = createAgentProductionModelPlanningTurn({')
    && productionSessionImplementationSource.includes('await executeModelPlanningTurn({');
  const retiredSessionV2EntryExists = existsSync(join(rootDir, 'src/agent/agentSessionV2.ts'));
  const retiredSessionV2Modules = readdirSync(join(rootDir, 'src/agent'))
    .filter((name) => /^agentSessionV2.*\.ts$/u.test(name));
  const modelDecisionRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentModelDecisionRuntime.ts',
  );
  const decisionContractRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentDecisionContract.ts',
  );
  const planningContextRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentPlanningContextRuntime.ts',
  );
  const workingMemoryBiasRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentWorkingMemoryBias.ts',
  );
  const workingMemoryConflictRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentWorkingMemoryConflict.ts',
  );
  const taskProgressSignalSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentTaskProgressSignal.ts',
  );
  const visualPlanningSignalsSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentVisualPlanningSignals.ts',
  );
  const resultVerificationSignalSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentResultVerificationSignal.ts',
  );
  const replanSignalRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentReplanSignal.ts',
  );
  const postActionRecoveryFollowUpSignalRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentPostActionRecoveryFollowUpSignal.ts',
  );
  const traceStuckGuardRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentTraceStuckSignalGuard.ts',
  );
  const traceStuckSignalRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentTraceStuckSignal.ts',
  );
  const traceEventsRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentTraceEvents.ts',
  );
  const toolResultCacheEvidenceRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentToolResultCacheEvidence.ts',
  );
  const toolResultSummaryRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentToolResultSummary.ts',
  );
  const decisionRepairSignalRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentDecisionRepairSignal.ts',
  );
  const compatibilityToolRejectionRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentCompatibilityToolRejection.ts',
  );
  const finalAnswerRejectionSignalsRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentFinalAnswerRejectionSignals.ts',
  );
  const decisionRejectionSignalsRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentDecisionRejectionSignals.ts',
  );
  const postActionRecoveryGuidanceRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentPostActionRecoveryGuidance.ts',
  );
  const approvalReasonSignalsRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentApprovalReasonSignals.ts',
  );
  const executionProgressSignalsRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentExecutionProgressSignals.ts',
  );
  const commandEvidencePredicatesRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentCommandEvidencePredicates.ts',
  );
  const pendingApprovalAssemblyRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentPendingApprovalAssembly.ts',
  );
  const parallelToolPreparationRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentParallelToolPreparation.ts',
  );
  const deterministicSkillRouteRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentDeterministicSkillRoute.ts',
  );
  const verificationRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentVerificationRuntime.ts',
  );
  const recoveryExecutionRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentRecoveryExecutionRuntime.ts',
  );
  const visualRefinementExecutionRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentVisualRefinementExecutionRuntime.ts',
  );
  const decisionTraceSummaryRuntimeSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentDecisionTraceSummary.ts',
  );
  const planningSignalEvidenceSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentPlanningSignalEvidence.ts',
  );
  const toolCommandFactorySource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentToolCommandFactory.ts',
  );
  const desktopRecoveryCommandBuilderSource = readProjectFile(
    rootDir,
    'src/agent/capabilities/agentDesktopRecoveryCommandBuilder.ts',
  );
  const desktopRecoveryObservationBuilderSource = readProjectFile(
    rootDir,
    'src/agent/capabilities/agentDesktopRecoveryObservationBuilder.ts',
  );
  const stuckSignatureMetricsSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentStuckSignatureMetrics.ts',
  );
  const recoveryStrategyRankingSource = readProjectFile(
    rootDir,
    'src/agent/runtime/agentRecoveryStrategyRanking.ts',
  );
  const runtimeViolations = findVersionedImports(rootDir, [
    'src/agent/runtime',
    'src/agent/capabilities',
  ]);
  const importAudit = auditAgentRuntimeLegacyImports({ rootDir });

  return [
    createStaticCheck(
      'runtime-capability-version-neutral',
      runtimeViolations.length === 0,
      runtimeViolations.length === 0
        ? 'Runtime and Capability modules do not import versioned or Legacy modules.'
        : `Versioned imports remain: ${runtimeViolations.join(', ')}`,
    ),
    createStaticCheck(
      'controller-production-entry',
      controllerSource.includes('runAgentProductionRuntime(')
        && !controllerSource.includes('runAgentRuntime(')
        && !controllerSource.includes('runAgentSessionV2('),
      'Production Controller must call only the consolidated production Runtime entry.',
    ),
    createStaticCheck(
      'production-runtime-lifecycle-interface',
      productionSessionSource.includes('export async function runAgentProductionRuntime')
        && productionSessionSource.includes('export async function runAgentProductionApprovedAction')
        && productionSessionSource.includes('export function runAgentProductionApprovalContinuations')
        && productionSessionSource.includes('export function cancelAgentProductionRuntime')
        && hasProductionRuntimeCancellation(controllerSource)
        && !controllerSource.includes('transitionAgentRuntimeTaskTransaction'),
      'Production start, approval, continuation, and cancellation must stay behind the version-neutral Runtime lifecycle Interface.',
    ),
    createStaticCheck(
      'persisted-runtime-continuation-version-neutral',
      sharedTypesSource.includes('agentRuntime?: AgentRuntimeContinuation | null;')
        && sharedTypesSource.includes('@deprecated Read compatibility for persisted records created before Runtime V4.')
        && chatRuntimeCompatibilitySource.includes('record?.agentRuntime ?? record?.agentSessionV2 ?? null')
        && !controllerSource.includes('agentSessionV2'),
      'New chat state writes must use agentRuntime while one explicit reader preserves old persisted agentSessionV2 records.',
    ),
    createStaticCheck(
      'production-session-version-neutral',
      !/(?:from\s*['"]\.\/agentSessionV[23]['"]|\brunAgentSessionV[23]\b|\bAgentSessionV[23]Result\b)/u
        .test(productionSessionSource)
        && productionSessionSource.includes("from './agentProductionSessionImplementation'")
        && productionSessionSource.includes('runAgentProductionSessionImplementation(options)'),
      'Production Session must no longer import, alias, or invoke a versioned Session implementation.',
    ),
    createStaticCheck(
      'legacy-session-wrapper-retired',
      productionSessionImplementationSource.includes('export async function runAgentProductionSessionImplementation')
        && !retiredSessionV2EntryExists
        && retiredSessionV2Modules.length === 0,
      'The retired SessionV2 entry Module must stay deleted while the neutral production implementation remains canonical.',
    ),
    createStaticCheck(
      'production-session-contract-version-neutral',
      !/(?:AgentSessionV[23]|agentSessionV[23]|\/legacy\/)/u.test(productionSessionContractSource),
      'Production Session public options and result contracts must remain version-neutral.',
    ),
    createStaticCheck(
      'model-decision-runtime-owned',
      modelDecisionRuntimeSource.includes('export async function runAgentModelDecisionTurn')
        && productionSessionImplementationModulesSource.includes('runAgentModelDecisionTurn<AgentModelDecision>')
        && modelPlanningTurnConnected
        && !productionSessionImplementationSource.includes('runAgentSessionV2ModelDecisionTurn'),
      'Model-call timing, cancellation classification, parsing outcome, Step, and Trace creation must be Runtime-owned.',
    ),
    createStaticCheck(
      'decision-contract-runtime-owned',
      decisionContractRuntimeSource.includes('export function parseAgentDecisionContract')
        && decisionContractRuntimeSource.includes('export function prepareAgentDecisionToolInput')
        && productionSessionImplementationModulesSource.includes('parseDecision: parseAgentDecisionContract')
        && modelPlanningTurnConnected
        && productionSessionImplementationModulesSource.includes('prepareToolInput: prepareAgentDecisionToolInput')
        && !productionSessionImplementationSource.includes('parseAgentSessionV2DecisionContract'),
      'Decision parsing, understanding normalization, tool schema validation, and decision Trace summaries must be Runtime-owned.',
    ),
    createStaticCheck(
      'planning-context-runtime-owned',
      planningContextRuntimeSource.includes('export function createAgentPlanningContext')
        && planningContextRuntimeSource.includes('export function createAgentModelInput')
        && productionSessionImplementationModulesSource.includes('const planningContext = createAgentPlanningContext({')
        && modelPlanningTurnConnected
        && productionSessionImplementationModulesSource.includes('const modelInput = createAgentModelInput({')
        && modelPlanningTurnConnected
        && !productionSessionImplementationSource.includes('const modelInput = createAgentSessionV2ModelInput({'),
      'Planning-signal assembly, priority ordering, history compression, and model-input formatting must be Runtime-owned.',
    ),
    createStaticCheck(
      'working-memory-bias-runtime-owned',
      workingMemoryBiasRuntimeSource.includes('export function createAgentGuardedWorkingMemoryText')
        && productionSessionImplementationModulesSource.includes("from '../runtime/agentWorkingMemoryBias'")
        && modelPlanningTurnConnected
        && productionSessionImplementationModulesSource.includes('formatWorkingMemory: createAgentGuardedWorkingMemoryText')
        && modelPlanningTurnConnected,
      'Working-memory scoring, recency, kind policy, and guarded formatting must be Runtime-owned.',
    ),
    createStaticCheck(
      'working-memory-conflict-runtime-owned',
      workingMemoryConflictRuntimeSource.includes('export function createAgentWorkingMemoryConflictSignalText')
        && workingMemoryConflictRuntimeSource.includes('toolResults: AgentRuntimeToolResultEntry[]')
        && productionSessionImplementationSource.includes("from './runtime/agentWorkingMemoryConflict'")
        && productionSessionImplementationSource.includes('createMemoryConflictSignalText: createAgentWorkingMemoryConflictSignalText'),
      'Working-memory fact extraction, conflict classification, negation detection, and signal formatting must be Runtime-owned.',
    ),
    createStaticCheck(
      'task-progress-signal-runtime-owned',
      taskProgressSignalSource.includes('export function createAgentTaskProgressText')
        && taskProgressSignalSource.includes('steps: AgentRuntimeStep[]')
        && productionSessionImplementationSource.includes("from './runtime/agentTaskProgressSignal'")
        && productionSessionImplementationSource.includes('createTaskProgressText: createAgentTaskProgressText')
        && !productionSessionImplementationSource.includes('function createAgentSessionV2TaskProgressText'),
      'Task-understanding selection and progress-board formatting must be Runtime-owned.',
    ),
    createStaticCheck(
      'visual-planning-signals-runtime-owned',
      visualPlanningSignalsSource.includes('export function createAgentRecentVisualContextText')
        && visualPlanningSignalsSource.includes('export function createAgentVisualRecoveryText')
        && visualPlanningSignalsSource.includes('toolResults: AgentRuntimeToolResultEntry[]')
        && productionSessionImplementationSource.includes("from './runtime/agentVisualPlanningSignals'")
        && productionSessionImplementationSource.includes('createRecentVisualContextText: createAgentRecentVisualContextText')
        && productionSessionImplementationSource.includes('createVisualRecoveryText: createAgentVisualRecoveryText')
        && productionSessionImplementationModulesSource.includes('isAgentVisualContextToolCommand(command)'),
      'Visual-context classification, recent evidence formatting, and advisory recovery text must be Runtime-owned.',
    ),
    createStaticCheck(
      'result-verification-signal-runtime-owned',
      resultVerificationSignalSource.includes('export function createAgentResultVerificationSignalText')
        && resultVerificationSignalSource.includes('toolResults: AgentRuntimeToolResultEntry[]')
        && productionSessionImplementationSource.includes("from './runtime/agentResultVerificationSignal'")
        && productionSessionImplementationSource.includes('createResultVerificationText: createAgentResultVerificationSignalText')
        && !productionSessionImplementationSource.includes('createResultVerificationText: createAgentSessionV2ResultVerificationSignalText'),
      'Latest-result selection, action-evidence formatting, and verification guidance must be Runtime-owned.',
    ),
    createStaticCheck(
      'replan-signal-runtime-owned',
      replanSignalRuntimeSource.includes('export function createAgentReplanSignalText')
        && replanSignalRuntimeSource.includes('steps: AgentRuntimeStep[]')
        && replanSignalRuntimeSource.includes('toolResults: AgentRuntimeToolResultEntry[]')
        && replanSignalRuntimeSource.includes("from './agentRecoveryStrategyRanking'")
        && productionSessionImplementationSource.includes("from './runtime/agentReplanSignal'")
        && productionSessionImplementationSource.includes('createReplanSignalText: (options) => createAgentReplanSignalText({'),
      'Replan evidence assembly, open/launch observation guidance, and recovery hints must be Runtime-owned.',
    ),
    createStaticCheck(
      'post-action-recovery-followup-runtime-owned',
      postActionRecoveryFollowUpSignalRuntimeSource.includes('export function createAgentPostActionRecoveryFollowUpText')
        && postActionRecoveryFollowUpSignalRuntimeSource.includes('toolResults: AgentRuntimeToolResultEntry[]')
        && postActionRecoveryFollowUpSignalRuntimeSource.includes("from './agentRecoveryStrategyRanking'")
        && productionSessionImplementationSource.includes("from './runtime/agentPostActionRecoveryFollowUpSignal'")
        && productionSessionImplementationSource.includes('createPostActionRecoveryFollowUpText: (toolResults) => (')
        && productionSessionImplementationSource.includes('createAgentPostActionRecoveryFollowUpText({'),
      'Post-action recovery evidence, locate hints, retry memory, and advisory formatting must be Runtime-owned.',
    ),
    createStaticCheck(
      'trace-stuck-guard-runtime-owned',
      traceStuckGuardRuntimeSource.includes('export function createAgentGuardedTraceStuckSignalText')
        && traceStuckGuardRuntimeSource.includes('AGENT_TRACE_STUCK_SIGNAL_MAX_BLOCKS')
        && traceStuckSignalRuntimeSource.includes("from './agentTraceStuckSignalGuard'")
        && traceStuckSignalRuntimeSource.includes('createAgentGuardedTraceStuckSignalText(lines)'),
      'Trace-stuck severity scoring, required reasons, and signal compression must be Runtime-owned.',
    ),
    createStaticCheck(
      'trace-stuck-signal-runtime-owned',
      traceStuckSignalRuntimeSource.includes('export function createAgentTraceStuckSignalText')
        && traceStuckSignalRuntimeSource.includes('AgentRuntimeTraceEvent[]')
        && traceStuckSignalRuntimeSource.includes("from './agentRecoveryStrategyRanking'")
        && productionSessionImplementationSource.includes("from './runtime/agentTraceStuckSignal'")
        && productionSessionImplementationSource.includes('createTraceStuckSignalText: (options) => createAgentTraceStuckSignalText({'),
      'Trace-stuck evidence assembly and advisory recovery ranking must be Runtime-owned.',
    ),
    createStaticCheck(
      'trace-events-runtime-owned',
      traceEventsRuntimeSource.includes('export function createAgentTraceRecorder')
        && traceEventsRuntimeSource.includes('export function compactAgentTraceEvents')
        && traceEventsRuntimeSource.includes('export function createAgentToolFinishedTraceDetails')
        && traceEventsRuntimeSource.includes('AgentRuntimeTraceEvent[]')
        && productionSessionImplementationSource.includes("from './runtime/agentTraceEvents'")
        && productionSessionImplementationSource.includes('const traceRecorder = createAgentTraceRecorder(traceEvents)'),
      'Trace IDs, retention, Recorder writes, detail compaction, and Tool-finished evidence must be Runtime-owned.',
    ),
    createStaticCheck(
      'trace-summary-runtime-owned',
      decisionTraceSummaryRuntimeSource.includes('export function createAgentPermissionRoutedTraceSummary')
        && decisionTraceSummaryRuntimeSource.includes('export function createAgentApprovalRequiredTraceSummary')
        && productionSessionImplementationModulesSource.includes('createAgentPermissionRoutedTraceSummary({')
        && productionSessionImplementationModulesSource.includes('createAgentApprovalRequiredTraceSummary({')
        && productionSessionImplementationSource.includes("from './productionSession/singleToolExecution'")
        && productionSessionImplementationSource.includes('const { executeSingleToolCommand } = createAgentProductionSingleToolExecution({')
        && productionSessionImplementationSource.includes('await executeSingleToolCommand({'),
      'Generic approval, permission, and Tool lifecycle Trace summaries must be Runtime-owned.',
    ),
    createStaticCheck(
      'tool-result-cache-evidence-runtime-owned',
      toolResultCacheEvidenceRuntimeSource.includes('export function isAgentCachedToolResult')
        && traceEventsRuntimeSource.includes("from './agentToolResultCacheEvidence'"),
      'Cache-hit evidence detection and its persisted compatibility marker must be Runtime-owned.',
    ),
    createStaticCheck(
      'tool-result-summary-runtime-owned',
      toolResultSummaryRuntimeSource.includes('export function createAgentToolResultCriticalFacts')
        && toolResultSummaryRuntimeSource.includes('export function formatAgentToolResultForModel')
        && toolResultSummaryRuntimeSource.includes("from './agentPlanningSignalEvidence'")
        && productionSessionImplementationSource.includes("from './runtime/agentToolResultSummary'")
        && productionSessionImplementationModulesSource.includes('formatAgentToolResultForModel(')
        && productionSessionImplementationSource.includes("from './productionSession/singleToolExecution'")
        && productionSessionImplementationSource.includes('const { executeSingleToolCommand } = createAgentProductionSingleToolExecution({')
        && productionSessionImplementationSource.includes('await executeSingleToolCommand({'),
      'Critical Tool facts and model-facing Tool Result formatting must be Runtime-owned.',
    ),
    createStaticCheck(
      'decision-repair-signal-runtime-owned',
      decisionRepairSignalRuntimeSource.includes('export function createAgentInvalidModelOutputRepairText')
        && decisionRepairSignalRuntimeSource.includes('export function createAgentUnavailableToolRepairText')
        && decisionRepairSignalRuntimeSource.includes('export function createAgentInvalidToolInputRepairText')
        && productionSessionImplementationSource.includes("from './runtime/agentDecisionRepairSignal'")
        && productionSessionImplementationModulesSource.includes('createAgentInvalidModelOutputRepairText(')
        && modelPlanningTurnConnected,
      'Decision-contract repair prompts for invalid output, unavailable Tools, and invalid inputs must be Runtime-owned.',
    ),
    createStaticCheck(
      'compatibility-tool-rejection-runtime-owned',
      compatibilityToolRejectionRuntimeSource.includes('export function createAgentCompatibilityToolRejection')
        && compatibilityToolRejectionRuntimeSource.includes('AGENT_DESKTOP_COMPATIBILITY_TOOLS')
        && productionSessionImplementationSource.includes("from './runtime/agentCompatibilityToolRejection'")
        && productionSessionImplementationModulesSource.includes('rejectCompatibilityTool: createAgentCompatibilityToolRejection'),
      'Compatibility Tool classification and decision-contract rejection guidance must be Runtime-owned.',
    ),
    createStaticCheck(
      'final-answer-rejection-signals-runtime-owned',
      finalAnswerRejectionSignalsRuntimeSource.includes('export function createAgentIncompleteTaskProgressFinalRejection')
        && finalAnswerRejectionSignalsRuntimeSource.includes('export function createAgentUnverifiedResultFinalRejection')
        && finalAnswerRejectionSignalsRuntimeSource.includes('export function createAgentReadonlyObservationFinalRejection')
        && finalAnswerRejectionSignalsRuntimeSource.includes('export function createAgentUnattemptedRequestedActionFinalRejection')
        && finalAnswerRejectionSignalsRuntimeSource.includes('export function createAgentPrematureDesktopOrganizationFinalRejection')
        && finalAnswerRejectionSignalsRuntimeSource.includes('export function createAgentPrematureWindowMoveFinalRejection')
        && finalAnswerRejectionSignalsRuntimeSource.includes('export function createAgentRecoverableUnverifiedRejection')
        && finalAnswerRejectionSignalsRuntimeSource.includes('AgentRuntimeToolResultEntry[]')
        && productionSessionImplementationModulesSource.includes("from '../runtime/agentFinalAnswerRejectionSignals'")
        && productionSessionImplementationSource.includes("from './productionSession/finalResponse'")
        && productionSessionImplementationSource.includes('const { prepareFinalResponse } = createAgentProductionFinalResponse({')
        && productionSessionImplementationSource.includes('prepareFinalResponse(decision, stepIndex'),
      'Advisory final-answer rejection evidence for incomplete, unverified, read-only-only, unattempted, and premature tasks must be Runtime-owned.',
    ),
    createStaticCheck(
      'decision-rejection-signals-runtime-owned',
      decisionRejectionSignalsRuntimeSource.includes('export function createAgentPrematureActionConfirmationRejection')
        && decisionRejectionSignalsRuntimeSource.includes('export function createAgentTransitionalDesktopActionRejection')
        && decisionRejectionSignalsRuntimeSource.includes('export function createAgentVideoSummarySearchRejection')
        && decisionRejectionSignalsRuntimeSource.includes('export function createAgentRepeatedFailedToolCallRejection')
        && decisionRejectionSignalsRuntimeSource.includes('export function createAgentRepeatedUnverifiedActionRetryRejection')
        && decisionRejectionSignalsRuntimeSource.includes('AgentRuntimeToolResultEntry')
        && productionSessionImplementationSource.includes("from './runtime/agentDecisionRejectionSignals'")
        && productionSessionImplementationModulesSource.includes('createAgentPrematureActionConfirmationRejection(')
        && productionSessionImplementationSource.includes("from './productionSession/finalResponse'")
        && productionSessionImplementationSource.includes('const { prepareFinalResponse } = createAgentProductionFinalResponse({')
        && productionSessionImplementationSource.includes('prepareFinalResponse(decision, stepIndex')
        && productionSessionImplementationSource.includes("from './productionSession/executionPreflight'")
        && productionSessionImplementationSource.includes('prepareExecutionPreflight({')
        && productionSessionImplementationModulesSource.includes('createAgentTransitionalDesktopActionRejection(')
        && productionSessionImplementationSource.includes("from './productionSession/singleToolSelection'")
        && productionSessionImplementationSource.includes('prepareSingleToolSelection(decision, stepIndex)')
        && productionSessionImplementationModulesSource.includes('createAgentVideoSummarySearchRejection('),
      'Advisory rejection evidence for premature confirmation, compatibility-only desktop actions, video-summary search substitution, and repeated failed or unverified actions must be Runtime-owned.',
    ),
    createStaticCheck(
      'post-action-recovery-guidance-runtime-owned',
      postActionRecoveryGuidanceRuntimeSource.includes('export function createAgentPostActionRecoveryGuidanceLines')
        && postActionRecoveryGuidanceRuntimeSource.includes('AgentRuntimeToolResultEntry')
        && finalAnswerRejectionSignalsRuntimeSource.includes("from './agentPostActionRecoveryGuidance'"),
      'Post-action state guidance used by rejection evidence must be Runtime-owned.',
    ),
    createStaticCheck(
      'approval-reason-signals-runtime-owned',
      approvalReasonSignalsRuntimeSource.includes('export function createAgentApprovalReadyFollowUpReason')
        && approvalReasonSignalsRuntimeSource.includes('export function createAgentApprovalRequiredToolReason')
        && approvalReasonSignalsRuntimeSource.includes('export function createAgentTargetSelectionApprovalReason')
        && approvalReasonSignalsRuntimeSource.includes('export function createAgentVisualActionApprovalReason')
        && approvalReasonSignalsRuntimeSource.includes('export function createAgentVisualInvokeApprovalReason')
        && productionSessionImplementationSource.includes("from './runtime/agentApprovalReasonSignals'")
        && !/[鍙]|寰呮壒/u.test(approvalReasonSignalsRuntimeSource),
      'Approval-ready, permission, target-selection, coordinate, and UI Automation reason formatting must be Runtime-owned.',
    ),
    createStaticCheck(
      'execution-progress-signals-runtime-owned',
      executionProgressSignalsRuntimeSource.includes('export function createAgentAutoRecoveryStepReason')
        && executionProgressSignalsRuntimeSource.includes('export function createAgentPostApprovalVerificationStepReason')
        && executionProgressSignalsRuntimeSource.includes('export function createAgentVisualRefinementStepReason')
        && executionProgressSignalsRuntimeSource.includes('export function createAgentAutoRecoveryLoopContinuedHistoryLine')
        && executionProgressSignalsRuntimeSource.includes('export function createAgentPostActionTerminalStoppedHistoryLine')
        && verificationRuntimeSource.includes("from './agentExecutionProgressSignals'")
        && recoveryExecutionRuntimeSource.includes("from './agentExecutionProgressSignals'")
        && visualRefinementExecutionRuntimeSource.includes("from './agentExecutionProgressSignals'")
        && productionSessionImplementationModulesSource.includes("from '../runtime/agentExecutionProgressSignals'")
        && productionSessionImplementationSource.includes("from './productionSession/actionOutcomeLifecycle'")
        && productionSessionImplementationSource.includes('} = createAgentProductionActionOutcomeLifecycle({')
        && productionSessionImplementationSource.includes('recordActionRuntimeDecision, recordRecoveryTriggerDecision, decideRecoveryTrigger,'),
      'Recovery, verification, refinement, and loop-history presentation must be Runtime-owned.',
    ),
    createStaticCheck(
      'command-evidence-predicates-runtime-owned',
      commandEvidencePredicatesRuntimeSource.includes('export function isAgentPostApprovalVerificationCommand')
        && commandEvidencePredicatesRuntimeSource.includes('export function isAgentVerifiedTargetWindowObservation')
        && commandEvidencePredicatesRuntimeSource.includes('AgentRuntimeToolResultEntry')
        && productionSessionImplementationSource.includes("from './runtime/agentCommandEvidencePredicates'")
        && !productionSessionImplementationSource.includes("from './agentSessionV2CommandEvidencePredicates'"),
      'Post-approval and verified-window command evidence predicates must be Runtime-owned.',
    ),
    createStaticCheck(
      'session-helper-modules-runtime-owned',
      pendingApprovalAssemblyRuntimeSource.includes('export function createAgentPendingApprovalAssembly')
        && pendingApprovalAssemblyRuntimeSource.includes('AgentRuntimePendingApproval')
        && parallelToolPreparationRuntimeSource.includes('export function prepareAgentParallelToolCommands')
        && parallelToolPreparationRuntimeSource.includes('AgentModelParallelToolCall')
        && deterministicSkillRouteRuntimeSource.includes('export function resolveAgentDeterministicSkillRoute')
        && deterministicSkillRouteRuntimeSource.includes('AgentRuntimeToolResultEntry')
        && productionSessionImplementationSource.includes("from './runtime/agentPendingApprovalAssembly'")
        && productionSessionImplementationSource.includes("from './productionSession/parallelPreparation'")
        && productionSessionImplementationSource.includes('prepareParallelSelection(decision, stepIndex)')
        && productionSessionImplementationModulesSource.includes("from '../runtime/agentParallelToolPreparation'")
        && productionSessionImplementationSource.includes("from './runtime/agentDeterministicSkillRoute'")
        && !/from ['"]\.\/agentSessionV2[^'"]*['"]/u.test(productionSessionImplementationSource),
      'Pending approval assembly, parallel preparation, and deterministic Skill routing must be Runtime-owned, leaving no versioned helper imports in Production Session implementation.',
    ),
    createStaticCheck(
      'planning-signal-evidence-runtime-owned',
      planningSignalEvidenceSource.includes('export function createAgentActionPrimitiveSignature')
        && planningSignalEvidenceSource.includes('AgentRuntimeToolResultEntry')
        && replanSignalRuntimeSource.includes("from './agentPlanningSignalEvidence'")
        && productionSessionImplementationSource.includes("from './runtime/agentPlanningSignalEvidence'")
        && !productionSessionImplementationSource.includes("from './agentSessionV2PlanningSignalUtils'"),
      'Structured/action evidence and stable Tool/Action Primitive signatures must be Runtime-owned.',
    ),
    createStaticCheck(
      'session-command-builders-version-neutral',
      toolCommandFactorySource.includes('export function createAgentToolCommand')
        && desktopRecoveryCommandBuilderSource.includes('export function resolveAgentDesktopAutoRecoveryQuery')
        && desktopRecoveryObservationBuilderSource.includes('export function createAgentDesktopAutoRecoveryObservationCommand')
        && productionSessionImplementationSource.includes("from './runtime/agentToolCommandFactory'")
        && productionSessionImplementationSource.includes("from './capabilities/agentDesktopRecoveryCommandBuilder'")
        && productionSessionImplementationSource.includes("from './capabilities/agentDesktopRecoveryObservationBuilder'")
        && !productionSessionImplementationSource.includes("from './agentSessionV2ToolCommandFactory'")
        && !productionSessionImplementationSource.includes("from './agentSessionV2RecoveryCommandBuilder'")
        && !productionSessionImplementationSource.includes("from './agentSessionV2AutoRecoveryObservationBuilder'"),
      'Production Session must consume Runtime Tool Command and Desktop Recovery Capability builders directly.',
    ),
    createStaticCheck(
      'stuck-signature-metrics-runtime-owned',
      stuckSignatureMetricsSource.includes('export function findAgentRepeatedActionOutcomeWindowMetric')
        && stuckSignatureMetricsSource.includes('AgentRuntimeToolResultEntry')
        && traceStuckSignalRuntimeSource.includes("from './agentStuckSignatureMetrics'"),
      'Repeated Tool signatures and action/outcome window metrics must be Runtime-owned.',
    ),
    createStaticCheck(
      'recovery-strategy-ranking-runtime-owned',
      recoveryStrategyRankingSource.includes('export function createAgentRankedRecoveryStrategies')
        && recoveryStrategyRankingSource.includes('AgentRuntimeToolResultEntry')
        && recoveryStrategyRankingSource.includes("from './agentRecoveryStrategyBudget'")
        && replanSignalRuntimeSource.includes("from './agentRecoveryStrategyRanking'"),
      'Recovery strategy scoring, budget application, fallback ranking, and formatting must be Runtime-owned.',
    ),
    createStaticCheck(
      'production-barrel-version-neutral',
      !/export\s+\*\s+from\s+['"]\.\/agentSessionV[23]/u.test(productionBarrelSource),
      'Production Agent barrel must not export versioned Session APIs.',
    ),
    createStaticCheck(
      'historical-imports-isolated',
      importAudit.violations.length === 0,
      importAudit.violations.length === 0
        ? 'Historical V3/Pilot imports enter through the Legacy barrel.'
        : `Legacy import violations remain: ${importAudit.violations.join(', ')}`,
    ),
    createStaticCheck(
      'compatibility-boundary-covered',
      existsSync(join(rootDir, 'scripts/agent-production-session-boundary-smoke.ts')),
      'Production Session compatibility entry has a dedicated regression smoke.',
    ),
    createStaticCheck(
      'legacy-config-migration-covered',
      existsSync(join(rootDir, 'scripts/agent-runtime-legacy-config-migration-smoke.ts')),
      'One-way legacy runtime-setting migration has a regression smoke.',
    ),
  ];
}

function isValidDate(value) {
  return typeof value === 'string' && value.trim().length > 0 && !Number.isNaN(Date.parse(value));
}

export function evaluateAgentRuntimeRetirementObservations(manifest, currentSourceRevision) {
  const failures = [];
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return {
      failures: ['No production observation manifest was supplied.'],
      passed: false,
    };
  }

  if (manifest.schemaVersion !== AGENT_RUNTIME_RETIREMENT_OBSERVATION_SCHEMA_VERSION) {
    failures.push(`schemaVersion must be ${AGENT_RUNTIME_RETIREMENT_OBSERVATION_SCHEMA_VERSION}.`);
  }
  if (typeof manifest.sourceRevision !== 'string' || !manifest.sourceRevision.trim()) {
    failures.push('sourceRevision is required.');
  }
  if (typeof currentSourceRevision !== 'string' || !currentSourceRevision.trim()) {
    failures.push('Current source revision is required to validate production observations.');
  } else if (manifest.sourceRevision !== currentSourceRevision) {
    failures.push('Observation manifest sourceRevision does not match current source revision; rerun production observations for this checkout.');
  }
  if (typeof manifest.reviewedBy !== 'string' || !manifest.reviewedBy.trim()) {
    failures.push('reviewedBy is required.');
  }
  if (!Array.isArray(manifest.unresolvedRegressions)) {
    failures.push('unresolvedRegressions must be an array.');
  } else if (manifest.unresolvedRegressions.length > 0) {
    failures.push('unresolvedRegressions must be empty.');
  }

  const observations = Array.isArray(manifest.observations) ? manifest.observations : [];
  for (const requirement of AGENT_RUNTIME_RETIREMENT_REQUIRED_OBSERVATIONS) {
    const matchingObservations = observations.filter((candidate) => candidate?.id === requirement.id);
    if (matchingObservations.length > 1) {
      failures.push(`Duplicate observation: ${requirement.id}.`);
    }
    const observation = matchingObservations[0];
    if (!observation) {
      failures.push(`Missing observation: ${requirement.id}.`);
      continue;
    }
    if (observation.status !== 'passed') {
      failures.push(`Observation ${requirement.id} is not passed.`);
    }
    if (observation.sourceRevision !== manifest.sourceRevision) {
      failures.push(`Observation ${requirement.id} does not match sourceRevision.`);
    }
    if (!isValidDate(observation.observedAt)) {
      failures.push(`Observation ${requirement.id} requires a valid observedAt timestamp.`);
    }
    if (typeof observation.evidenceRef !== 'string' || !observation.evidenceRef.trim()) {
      failures.push(`Observation ${requirement.id} requires an evidenceRef.`);
    }
  }

  return { failures, passed: failures.length === 0 };
}

export function evaluateAgentRuntimeLegacyRetirementGate(options) {
  const staticChecks = options.staticChecks ?? [];
  const failedStaticChecks = staticChecks.filter((check) => !check.passed);
  const observations = evaluateAgentRuntimeRetirementObservations(
    options.observationManifest,
    options.currentSourceRevision,
  );
  const status = failedStaticChecks.length > 0
    ? 'blocked-static'
    : observations.passed
      ? 'ready-for-legacy-deletion'
      : 'blocked-observation';

  return {
    failedStaticChecks,
    observations,
    ready: status === 'ready-for-legacy-deletion',
    staticChecks,
    status,
  };
}

export function formatAgentRuntimeLegacyRetirementGateReport(result) {
  const lines = [
    'Agent Runtime Legacy Retirement Gate',
    `status=${result.status}`,
    `ready=${String(result.ready)}`,
    '',
    'Static coverage:',
    ...result.staticChecks.map((check) => (
      `${check.passed ? 'PASS' : 'BLOCK'} ${check.id}: ${check.detail}`
    )),
    '',
    'Production observations:',
    ...(result.observations.failures.length > 0
      ? result.observations.failures.map((failure) => `BLOCK ${failure}`)
      : ['PASS all required production observations are present and reviewed.']),
  ];
  return lines.join('\n');
}
