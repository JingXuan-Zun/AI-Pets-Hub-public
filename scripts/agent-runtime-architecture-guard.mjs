import { readChatMessageSource } from './chatMessageSource.mjs';
import { readModuleProjectFile, readModuleProjectFunction } from './projectModuleSource.mjs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { assertProductionRuntimeCancellation } from './agentRuntimeCancellationGuard.mjs';
import { auditAgentRuntimeLegacyImports } from './agentRuntimeLegacyImportAuditCore.mjs';

const readOnlyFileToolsEntry = readFileSync(join(process.cwd(), 'src/agent/agentRuntimeLocalFileTools.ts'), 'utf8');
const readOnlyFileResultsSource = readFileSync(join(process.cwd(), 'src/agent/localFiles/readOnlyFileResults.ts'), 'utf8');
assert.match(readOnlyFileToolsEntry, /from '\.\/localFiles\/readOnlyFileResults'/u);
assert.match(readOnlyFileToolsEntry, /return createLocalPathInfoResult\(localPath, result\)/u);
assert.match(readOnlyFileToolsEntry, /return createLocalDirectoryListResult\(localPath, result\)/u);
assert.match(readOnlyFileToolsEntry, /return createLocalFileSearchResult\(localPath, query, result\)/u);
assert.match(readOnlyFileToolsEntry, /return createLocalTextReadResult\(localPath, result\)/u);
assert.doesNotMatch(readOnlyFileResultsSource, /desktopPetShellRuntime|appendAgentRuntimeToolEvidence|buildAgentPermissionRoute|await /u);
const localAppProjectPlansSource = readFileSync(join(process.cwd(), 'src/agent/planning/agentLocalAppProjectPlans.ts'), 'utf8');
const localAppProjectPlansEntry = readFileSync(join(process.cwd(), 'src/agent/planning/agentResourcePlans.ts'), 'utf8');
assert.match(localAppProjectPlansEntry, /from '\.\/agentLocalAppProjectPlans'/u);
assert.match(localAppProjectPlansEntry, /return buildLocalAppProjectToolPlan\(command, toolName, targetDescription, explicitGoal\)/u);
assert.match(localAppProjectPlansSource, /case 'run_local_project_action':[\s\S]*'inspect-local-project'[\s\S]*'run-local-project-action'/u);
assert.match(localAppProjectPlansSource, /from '\.\/agentPlanShared'/u);
assert.doesNotMatch(localAppProjectPlansSource, /desktopPetShellRuntime|appendAgentRuntimeToolEvidence|await /u);
const windowUiInspectionEntry = readFileSync(join(process.cwd(), 'src/agent/desktopObservation/windowUiInspection.ts'), 'utf8');
const windowUiInspectionEvidenceSource = readFileSync(join(process.cwd(), 'src/agent/desktopObservation/windowUiInspectionEvidence.ts'), 'utf8');
assert.match(windowUiInspectionEntry, /from '\.\/windowUiInspectionEvidence'/u);
assert.match(windowUiInspectionEntry, /const structuredEvidence = createWindowUiStructuredEvidence\(result\)/u);
assert.match(windowUiInspectionEntry, /structuredEvidence \?\? createFailedWindowUiInspectionStructuredEvidence\(result \?\? \{\}\)/u);
assert.match(windowUiInspectionEvidenceSource, /export function createWindowUiStructuredEvidence/u);
assert.doesNotMatch(windowUiInspectionEvidenceSource, /desktopPetShellRuntime|buildAgentPermissionRoute|appendAgentRuntimeToolEvidence|await /u);
const targetContextEntry = readFileSync(join(process.cwd(), 'src/agent/runtime/agentTargetResolutionContext.ts'), 'utf8');
const targetWindowHintsSource = readFileSync(join(process.cwd(), 'src/agent/runtime/targetResolution/windowEvidenceAndHints.ts'), 'utf8');
assert.match(targetContextEntry, /from '\.\/targetResolution\/windowEvidenceAndHints'/u);
assert.match(targetContextEntry, /findLatestOuterAppWindowEvidenceEntry\(options.toolResults, requestText\)/u);
assert.match(targetContextEntry, /resolveAgentTargetResolutionHints\(options.sourceText, options.userGoal\)/u);
assert.match(targetWindowHintsSource, /export function resolveAgentObservedWindowTargetEvidence/u);
assert.doesNotMatch(targetWindowHintsSource, /desktopPetShellRuntime|createAgentRequestedActionCoverage|appendAgentRuntimeToolEvidence|await /u);
const taskEvidenceEntry = readFileSync(join(process.cwd(), 'src/agent/runtime/agentRuntimeTaskEvidence.ts'), 'utf8');
const surfaceIdentitySource = readFileSync(join(process.cwd(), 'src/agent/runtime/taskEvidence/operationSurfaceIdentity.ts'), 'utf8');
assert.match(taskEvidenceEntry, /from '\.\/taskEvidence\/operationSurfaceIdentity'/u);
assert.match(taskEvidenceEntry, /resolveAgentRuntimeOperationSurface\(\{ entry, now: options.now, previous: surface \}\)/u);
assert.match(taskEvidenceEntry, /const resolvedTargetBinding = resolveTargetBinding\(/u);
assert.match(surfaceIdentitySource, /export function resolveAgentRuntimeOperationSurface/u);
assert.doesNotMatch(surfaceIdentitySource, /desktopPetShellRuntime|appendAgentRuntimeToolEvidence|completedActions|evidenceById|await /u);
const desktopObservationPlansEntry = readFileSync(join(process.cwd(), 'src/agent/planning/agentDesktopObservationPlans.ts'), 'utf8');
const executeDesktopObservationPlanSource = readFileSync(join(process.cwd(), 'src/agent/planning/executeDesktopObservationPlan.ts'), 'utf8');
assert.match(desktopObservationPlansEntry, /from '\.\/executeDesktopObservationPlan'/u);
assert.match(desktopObservationPlansEntry, /return buildExecuteDesktopObservationPlan\(command\)/u);
assert.match(executeDesktopObservationPlanSource, /export function buildExecuteDesktopObservationPlan/u);
assert.match(executeDesktopObservationPlanSource, /from '\.\/agentPlanShared'/u);
assert.doesNotMatch(executeDesktopObservationPlanSource, /desktopPetShellRuntime|executeDesktopObservation\(|appendAgentRuntimeToolEvidence|await /u);
const desktopActionPlansEntry = readFileSync(join(process.cwd(), 'src/agent/planning/agentDesktopActionPlans.ts'), 'utf8');
const executeDesktopActionPlanSource = readFileSync(join(process.cwd(), 'src/agent/planning/executeDesktopActionPlan.ts'), 'utf8');
assert.match(desktopActionPlansEntry, /from '\.\/executeDesktopActionPlan'/u);
assert.match(desktopActionPlansEntry, /return buildExecuteDesktopActionPlan\(command\)/u);
assert.match(executeDesktopActionPlanSource, /export function buildExecuteDesktopActionPlan/u);
assert.match(executeDesktopActionPlanSource, /from '\.\/agentPlanShared'/u);
assert.doesNotMatch(executeDesktopActionPlanSource, /desktopPetShellRuntime|executeDesktopAction\(|appendAgentRuntimeToolEvidence|await /u);
const taskRuntimeEntry = readFileSync(join(process.cwd(), 'src/agent/runtime/agentTaskRuntime.ts'), 'utf8');
const taskTransitionPolicySource = readFileSync(join(process.cwd(), 'src/agent/runtime/taskRuntime/transitionPolicy.ts'), 'utf8');
assert.match(taskRuntimeEntry, /from '\.\/taskRuntime\/transitionPolicy'/u);
assert.match(taskRuntimeEntry, /validateAgentTaskRuntimeLifecycleTransition\(/u);
assert.match(taskRuntimeEntry, /const selection = selectAgentTaskRuntimeNextSubgoal\(state\)/u);
assert.match(taskTransitionPolicySource, /export function validateAgentTaskRuntimeLifecycleTransition/u);
assert.doesNotMatch(taskTransitionPolicySource, /desktopPetShellRuntime|buildAgentPermissionRoute|appendAgentRuntimeToolEvidence|upsertAgentRuntimeDiagnostic|await /u);
const sequenceExecutionEntry = readFileSync(join(process.cwd(), 'src/agent/desktopSequence/sequenceExecution.ts'), 'utf8');
const sequenceOutcomeSource = readFileSync(join(process.cwd(), 'src/agent/desktopSequence/sequenceOutcome.ts'), 'utf8');
assert.match(sequenceExecutionEntry, /from '\.\/sequenceOutcome'/u);
assert.match(sequenceExecutionEntry, /return createAgentRuntimeDesktopSequenceOutcome\(/u);
assert.match(sequenceExecutionEntry, /await executeDesktopSequencePostVerification\(/u);
assert.match(sequenceOutcomeSource, /hasChangedStepBeforeFailure[\s\S]*failed && !hasChangedStepBeforeFailure/u);
assert.match(sequenceOutcomeSource, /hasUnverifiedStep[\s\S]*'unverified'/u);
assert.doesNotMatch(sequenceOutcomeSource, /desktopPetShellRuntime|buildAgentPermissionRoute|await |executeDesktopAction\(|executeDesktopInput\(/u);
const resultEvidenceEntry = readFileSync(join(process.cwd(), 'src/agent/resultAssessment/resultEvidenceAssessment.ts'), 'utf8');
const readOnlyCompletionSource = readFileSync(join(process.cwd(), 'src/agent/resultAssessment/readOnlyObservationCompletion.ts'), 'utf8');
assert.match(resultEvidenceEntry, /from '\.\/readOnlyObservationCompletion'/u);
assert.match(resultEvidenceEntry, /!hasAgentReadOnlyObservationActionCompletionEvidence\(result\)[\s\S]*return 'unverified'/u);
assert.match(resultEvidenceEntry, /createAgentReadOnlyActionCompletionMissingEvidence\(command, result\)/u);
assert.match(readOnlyCompletionSource, /export function hasAgentReadOnlyObservationActionCompletionEvidence/u);
assert.match(readOnlyCompletionSource, /missing:action-completion-evidence/u);
assert.doesNotMatch(readOnlyCompletionSource, /desktopPetShellRuntime|buildAgentPermissionRoute|appendAgentRuntimeToolEvidence|await /u);
const recoveryBudgetEntry = readFileSync(join(process.cwd(), 'src/agent/capabilities/recoveryObservation/recoveryObservationBudget.ts'), 'utf8');
const recoveryProgressSource = readFileSync(join(process.cwd(), 'src/agent/capabilities/recoveryObservation/recoveryProgressEvidence.ts'), 'utf8');
assert.match(recoveryBudgetEntry, /from '\.\/recoveryProgressEvidence'/u);
assert.match(recoveryBudgetEntry, /const extraWaits = hasAgentDesktopAutoRecoveryAdvancingProgressEvidence\(/u);
assert.match(recoveryBudgetEntry, /return previousWaits < maxWaits/u);
assert.match(recoveryProgressSource, /export function hasAgentDesktopAutoRecoveryAdvancingProgressEvidence/u);
assert.doesNotMatch(recoveryProgressSource, /desktopPetShellRuntime|buildAgentPermissionRoute|AGENT_DESKTOP_AUTO_RECOVERY_PROGRESS_EXTRA_WAITS|executeObservation|await /u);
const windowAppObservationEntry = readFileSync(join(process.cwd(), 'src/agent/desktopObservation/windowAppObservation.ts'), 'utf8');
const windowAppEvidenceSource = readFileSync(join(process.cwd(), 'src/agent/desktopObservation/windowAppEvidence.ts'), 'utf8');
assert.match(windowAppObservationEntry, /from '\.\/windowAppEvidence'/u);
assert.match(windowAppObservationEntry, /attachWindowObservationFreshness\(createObserveWindowsAndAppsStructuredEvidence\(/u);
assert.match(windowAppObservationEntry, /lastGoodObserveWindowsAndAppsSnapshot = result/u);
assert.match(windowAppObservationEntry, /observationFallback \? 'stale-fallback' : 'live'/u);
assert.match(windowAppEvidenceSource, /export function createObserveWindowsAndAppsStructuredEvidence/u);
assert.doesNotMatch(windowAppEvidenceSource, /desktopPetShellRuntime|buildAgentPermissionRoute|lastGoodObserveWindowsAndAppsSnapshot|observationGeneration|await /u);
const chatContextEntry = readFileSync(join(process.cwd(), 'src/agent/agentChatContext.ts'), 'utf8');
const chatWorkingMemorySource = readFileSync(join(process.cwd(), 'src/agent/chatContext/workingMemory.ts'), 'utf8');
assert.match(chatContextEntry, /createAgentWorkingMemorySnapshot,[\s\S]*from '\.\/chatContext\/workingMemory'/u);
assert.match(chatContextEntry, /export function createAgentContextFromResult/u);
assert.match(chatWorkingMemorySource, /export function createAgentWorkingMemorySnapshot/u);
assert.match(chatWorkingMemorySource, /seenIds\.has\(entryId\)/u);
assert.doesNotMatch(chatWorkingMemorySource, /desktopPetShellRuntime|buildAgentPermissionRoute|appendAgentRuntimeToolEvidence|await /u);
const windowUiInteractionEntry = readFileSync(join(process.cwd(), 'src/agent/desktopTools/windowUiInteraction.ts'), 'utf8');
const windowUiInteractionEvidence = readFileSync(join(process.cwd(), 'src/agent/desktopTools/windowUiInteractionEvidence.ts'), 'utf8');
assert.match(windowUiInteractionEntry, /from '\.\/windowUiInteractionEvidence'/u);
assert.match(windowUiInteractionEntry, /return createWindowUiMissingValueResult\(/u);
assert.match(windowUiInteractionEntry, /createWindowUiInteractionStructuredEvidence\(result/u);
assert.match(windowUiInteractionEvidence, /export function createWindowUiInteractionStructuredEvidence/u);
assert.match(windowUiInteractionEvidence, /export function createWindowUiMissingValueResult/u);
assert.doesNotMatch(windowUiInteractionEvidence, /desktopPetShellRuntime|buildAgentPermissionRoute|executeObservation|await /u);
const approvedDispatchEntry = readFileSync(join(process.cwd(), 'src/agent/runtime/agentApprovedDispatchResolution.ts'), 'utf8');
const windowCommandIdentitySource = readFileSync(join(process.cwd(), 'src/agent/runtime/approvedDispatch/windowCommandIdentity.ts'), 'utf8');
assert.match(approvedDispatchEntry, /from '\.\/approvedDispatch\/windowCommandIdentity'/u);
assert.match(approvedDispatchEntry, /nextSteps = updateDependentInputIdentities\(/u);
assert.match(approvedDispatchEntry, /await options.executeObservation\(forcedObservation\)/u);
assert.match(windowCommandIdentitySource, /export function getResolutionArgs/u);
assert.match(windowCommandIdentitySource, /export function updateDependentInputIdentities/u);
assert.doesNotMatch(windowCommandIdentitySource, /desktopPetShellRuntime|buildAgentPermissionRoute|appendAgentRuntimeToolEvidence|resolveAgentWindowTargetBeforeDispatch|executeObservation/u);

const approvalContinuationEntry = readFileSync(join(process.cwd(), 'src/agent/runtime/agentApprovalContinuationRuntime.ts'), 'utf8');
const approvalResultPresentation = readFileSync(join(process.cwd(), 'src/agent/runtime/approvalContinuation/resultPresentation.ts'), 'utf8');
assert.match(approvalContinuationEntry, /from '\.\/approvalContinuation\/resultPresentation'/u);
assert.match(approvalContinuationEntry, /result = appendAgentApprovalContinuationDiagnostic\(result, outcome, maxContinuations\)/u);
assert.match(approvalResultPresentation, /export function createAgentDuplicateApprovalBlockedResult/u);
assert.match(approvalResultPresentation, /export function appendAgentApprovalContinuationDiagnostic/u);
assert.doesNotMatch(approvalResultPresentation, /desktopPetShellRuntime|advanceAgentTaskRuntimeLifecycle|validateAgentRuntimeApprovalContext|options.execute/u);

const visualApprovalEntry = readFileSync(join(process.cwd(), 'src/agent/productionSession/visualApproval.ts'), 'utf8');
const visualInputFallbackSource = readFileSync(join(process.cwd(), 'src/agent/productionSession/visualInputFallback.ts'), 'utf8');
assert.match(visualApprovalEntry, /from '\.\/visualInputFallback'/u);
assert.match(visualApprovalEntry, /createAgentProductionVisualInputFallback\(\{/u);
assert.match(visualApprovalEntry, /const route = buildAgentPermissionRoute\(command\)/u);
assert.match(visualInputFallbackSource, /getAgentPostActionState\(previousAttempt\) !== 'unchanged'/u);
assert.match(visualInputFallbackSource, /previousActions.includes\('double_click'\)/u);
assert.doesNotMatch(visualInputFallbackSource, /desktopPetShellRuntime|buildAgentPermissionRoute|authorizeRecovery|authorizeModelIteration/u);

const runtimeCoreEntry = readFileSync(join(process.cwd(), 'src/agent/agentRuntimeCore.ts'), 'utf8');
const runtimeCorePlanSource = readFileSync(join(process.cwd(), 'src/agent/runtimeCore/openMovePlan.ts'), 'utf8');
assert.match(runtimeCoreEntry, /from '\.\/runtimeCore\/openMovePlan'/u);
assert.match(runtimeCoreEntry, /export function appendAgentRuntimeCoreEvent/u);
assert.match(runtimeCoreEntry, /export function resolveAgentRuntimeCoreSequenceOutcome/u);
assert.match(runtimeCorePlanSource, /export function createAgentRuntimeCoreOpenMoveTaskPlan/u);
assert.match(runtimeCorePlanSource, /export function parseAgentRuntimeCoreTaskPlanJson/u);
assert.match(runtimeCorePlanSource, /import type \{[^}]*\} from '\.\.\/agentRuntimeCore'/u);
assert.doesNotMatch(runtimeCorePlanSource, /desktopPetShellRuntime|appendAgentRuntimeCoreEvent|authorizeRecovery|authorizeModelIteration/u);

const visualCandidateEvidenceEntry = readFileSync(join(process.cwd(), 'src/agent/productionSession/visualCandidateEvidence.ts'), 'utf8');
const visualCandidateScoringSource = readFileSync(join(process.cwd(), 'src/agent/productionSession/visualCandidateScoring.ts'), 'utf8');
assert.match(visualCandidateEvidenceEntry, /from '\.\/visualCandidateScoring'/u);
assert.match(visualCandidateEvidenceEntry, /export function hasAgentVisualVerifiedPrimaryActionOwnership/u);
assert.match(visualCandidateEvidenceEntry, /export function hasAgentVisualSafeLoginContinuationApprovalEvidence/u);
assert.match(visualCandidateScoringSource, /export function getAgentVisualCandidateCrossSourceAgreementScore/u);
assert.match(visualCandidateScoringSource, /export function createAgentVisualCandidateFocusBounds/u);
assert.doesNotMatch(visualCandidateScoringSource, /desktopPetShellRuntime|from ['"]\.\/visualCandidateEvidence|authorizeRecovery|authorizeModelIteration|resolveAgentAuthenticationGate/u);

const plannerNormalizationEntry = readFileSync(join(process.cwd(), 'src/agent/planner/plannerCommandNormalization.ts'), 'utf8');
const plannerRequestTextSource = readFileSync(join(process.cwd(), 'src/agent/planner/plannerRequestText.ts'), 'utf8');
assert.match(plannerNormalizationEntry, /from '\.\/plannerRequestText'/u);
assert.match(plannerNormalizationEntry, /const targetDisplay = normalizePlannerDisplayMoveTarget\(sourceText\)/u);
assert.match(plannerRequestTextSource, /export function extractPlannerOpenAndMoveTargetFromText/u);
assert.match(plannerRequestTextSource, /export function isPlannerVideoSummaryIntentWithoutSearch/u);
assert.match(plannerRequestTextSource, /resolveAgentExplicitDisplayRoleFromText\(text\)/u);
assert.doesNotMatch(plannerRequestTextSource, /desktopPetShellRuntime|from ['"]\.\/plannerCommandNormalization|authorizeRecovery|authorizeModelIteration/u);

const executionStrategyEntry = readFileSync(join(process.cwd(), 'src/agent/agentExecutionStrategy.ts'), 'utf8');
const executionVisualEvidenceSource = readFileSync(join(process.cwd(), 'src/agent/executionStrategy/visualEvidence.ts'), 'utf8');
assert.match(executionStrategyEntry, /from '\.\/executionStrategy\/visualEvidence'/u);
assert.match(executionStrategyEntry, /const evidence = resolveAgentVisualExecutionStrategyStructuredEvidence\(options.result\)/u);
assert.match(executionStrategyEntry, /const coordinateResolution = resolveAgentExecutionStrategyCoordinatePoint\(evidence\)/u);
assert.match(executionStrategyEntry, /export \{ resolveAgentExecutionStrategyExpectedWindowHwnd \}/u);
assert.match(executionVisualEvidenceSource, /export function resolveAgentExecutionStrategyCoordinatePoint/u);
assert.match(executionVisualEvidenceSource, /export function resolveAgentExecutionStrategyExpectedWindowHwnd/u);
assert.doesNotMatch(executionVisualEvidenceSource, /desktopPetShellRuntime|createAgentToolCommand|authorizeRecovery|authorizeModelIteration/u);

const sequenceVerificationEntry = readFileSync(join(process.cwd(), 'src/agent/desktopSequence/sequenceVerification.ts'), 'utf8');
const sequenceRecoverySource = readFileSync(join(process.cwd(), 'src/agent/desktopSequence/sequencePostActionRecovery.ts'), 'utf8');
assert.match(sequenceVerificationEntry, /from '\.\/sequencePostActionRecovery'/u);
assert.match(sequenceVerificationEntry, /const postActionState = inferAgentRuntimeDesktopSequencePostActionState\(visualVerificationResult\)/u);
assert.match(sequenceVerificationEntry, /const postActionRecovery = createAgentRuntimeDesktopSequencePostActionRecoveryDirective\(/u);
assert.match(sequenceRecoverySource, /export function inferAgentRuntimeDesktopSequencePostActionState/u);
assert.match(sequenceRecoverySource, /export function createAgentRuntimeDesktopSequencePostActionRecoveryDirective/u);
assert.doesNotMatch(sequenceRecoverySource, /desktopPetShellRuntime|executeSummarizeVisualSnapshot|executeObserveWindowsAndApps|authorizeRecovery|authorizeModelIteration/u);

const windowToolEntry = readFileSync(join(process.cwd(), 'src/agent/agentRuntimeWindowTools.ts'), 'utf8');
const windowMovementSource = readModuleProjectFile('src/agent/agentRuntimeWindowTools.ts');
assert.match(windowToolEntry, /export \{ executeMoveWindowToDisplay, executeControlWindow \} from '\.\/windowTools\/windowMovementControl'/u);
assert.match(windowToolEntry, /from '\.\/desktopTools\/desktopToolInput'/u);
assert.match(windowMovementSource, /export async function executeMoveWindowToDisplay/u);
assert.match(windowMovementSource, /export async function executeControlWindow/u);
assert.match(readFileSync(join(process.cwd(), 'src/agent/windowTools/windowMovementControl.ts'), 'utf8'), /from '\.\.\/desktopTools\/desktopToolInput'/u);

const iconPlanEntry = readFileSync(join(process.cwd(), 'src/agent/desktopIconArrangementPlan.ts'), 'utf8');
const iconGeometrySource = readModuleProjectFile('src/agent/desktopIconArrangementPlan.ts');
assert.match(iconPlanEntry, /from '\.\/iconArrangement\/layoutGeometry'/u);
assert.match(iconPlanEntry, /const grid = createDesktopIconGrid\(/u);
assert.match(iconPlanEntry, /const nextPosition = resolveRelativePlacementPosition\(/u);
assert.match(iconGeometrySource, /export function createDesktopIconGrid/u);
assert.match(iconGeometrySource, /export function resolveRelativePlacementPosition/u);
assert.doesNotMatch(readFileSync(join(process.cwd(), 'src/agent/iconArrangement/layoutGeometry.ts'), 'utf8'), /desktopPetShellRuntime|window\.|document\./u);

const resourcePlanEntry = readFileSync(join(process.cwd(), 'src/agent/planning/agentResourcePlans.ts'), 'utf8');
const localFilePlanSource = readFileSync(join(process.cwd(), 'src/agent/planning/agentLocalFilePlans.ts'), 'utf8');
assert.match(resourcePlanEntry, /import \{ buildLocalFileToolPlan \} from '\.\/agentLocalFilePlans'/u);
assert.match(resourcePlanEntry, /return buildLocalFileToolPlan\(command, toolName, targetDescription, explicitGoal\)/u);
assert.match(localFilePlanSource, /export function buildLocalFileToolPlan/u);
assert.match(localFilePlanSource, /from '\.\/agentPlanShared'/u);
assert.doesNotMatch(localFilePlanSource, /desktopPetShellRuntime|AgentSessionV[23]|agentSessionV[23]/u);

const actionCoverageEntry = readFileSync(join(process.cwd(), 'src/agent/runtime/agentActionCoverage.ts'), 'utf8');
const requestedCoverageSource = readModuleProjectFile('src/agent/runtime/agentActionCoverage.ts');
assert.match(actionCoverageEntry, /from '\.\/actionCoverage\/requestedActionCoverage'/u);
assert.match(actionCoverageEntry, /export \{ createAgentCommandActionCoverage, diagnoseAgentCommandExplicitProhibition \} from '\.\/actionCoverage\/commandActionCoverage'/u);
assert.match(actionCoverageEntry, /export \{ createAgentAttemptedActionCoverage \} from '\.\/actionCoverage\/attemptedActionCoverage'/u);
assert.match(requestedCoverageSource, /const prohibitedActionCoverage = createAgentExplicitlyProhibitedActionCoverage\(/u);
assert.match(requestedCoverageSource, /export function createAgentRequestedActionCoverage/u);
assert.match(requestedCoverageSource, /export function createAgentExplicitlyProhibitedActionCoverage/u);
assert.doesNotMatch(requestedCoverageSource, /AgentSessionV[23]|agentSessionV[23]|v2-fallback/u);

const sharedCancellation = readFileSync(join(process.cwd(), 'src/agent/agentRuntimeCancellation.ts'), 'utf8');
for (const [file, specifier] of [
  ['src/agent/agentRuntimeExecutor.ts', './agentRuntimeCancellation'],
  ['src/agent/agentRuntimeBrowserTools.ts', './agentRuntimeCancellation'],
  ['src/agent/agentRuntimeWindowWorkflowTools.ts', './agentRuntimeCancellation'],
  ['src/agent/systemTools/localProjectTools.ts', '../agentRuntimeCancellation'],
]) {
  const source = readFileSync(join(process.cwd(), file), 'utf8');
  assert.ok(source.includes(`from '${specifier}'`), 'Tool cancellation must use the shared implementation.');
  assert.doesNotMatch(source, /function isAgentRuntimeCancellationRequested|function runCancellableAgentRuntimeTask/u, 'Duplicate cancellation detection/racing must remain removed.');
}
assert.match(sharedCancellation, /export async function runCancellableAgentRuntimeTask/u);
assert.match(readFileSync(join(process.cwd(), 'src/agent/visual/visualTaskCancellation.ts'), 'utf8'), /from '\.\.\/agentRuntimeCancellation'/u);

const toolExecutorRoot = readFileSync(join(process.cwd(), 'src/agent/agentRuntimeExecutor.ts'), 'utf8');
const observationExecutor = readFileSync(join(process.cwd(), 'src/agent/executor/desktopObservationExecution.ts'), 'utf8');
assert.match(toolExecutorRoot, /import \{ createDesktopObservationExecutor \} from '\.\/executor\/desktopObservationExecution'/u);
assert.match(toolExecutorRoot, /const executeDesktopObservation = createDesktopObservationExecutor\(\{\s*isAgentRuntimeCancellationRequested,\s*createAgentRuntimeCancelledResult,/u);
assert.match(toolExecutorRoot, /executeDesktopObservation\(runtime, toolCall, command\.sourceText\)/u);
assert.match(observationExecutor, /export function createDesktopObservationExecutor/u);
assert.match(observationExecutor, /return executeDesktopObservation;/u);

const toolInputSchemaRoot = readFileSync(join(process.cwd(), 'src/agent/agentToolInputSchema.ts'), 'utf8');
const toolInputSchemaModules = readModuleProjectFile('src/agent/agentToolInputSchema.ts');
for (const [moduleName, symbol] of [
  ['desktopActionSpecs', 'AGENT_DESKTOP_ACTION_INPUT_SPECS'],
  ['observationSpecs', 'AGENT_OBSERVATION_INPUT_SPECS'],
  ['localServiceSpecs', 'AGENT_LOCAL_SERVICE_INPUT_SPECS'],
]) {
  assert.ok(toolInputSchemaRoot.includes(`from './inputSchema/${moduleName}'`), 'Schema entry must import its capability declarations.');
  assert.ok(toolInputSchemaRoot.includes(`${symbol}.`), 'Schema entry must assemble the imported capability declarations.');
  assert.ok(toolInputSchemaModules.includes(`export const ${symbol} = {`), 'Schema declarations must remain reachable from the public entry.');
}
assert.match(toolInputSchemaRoot, /export function prepareAgentToolInput/u, 'Input validation must retain one public implementation.');

const runtimeDir = join(process.cwd(), 'src', 'agent', 'runtime');
assert.deepEqual(
  auditAgentRuntimeLegacyImports().violations,
  [],
  'Historical V3/Pilot imports and barrel assertions must remain isolated in agent/legacy/index.ts.',
);
const runtimeFiles = readdirSync(runtimeDir)
  .filter((name) => name.endsWith('.ts'))
  .map((name) => join(runtimeDir, name));

const forbiddenRuntimeDependency = /AgentSessionV[23]|agentSessionV[23]|v2-fallback|ExperimentalV2Adapter/gu;
for (const filePath of runtimeFiles) {
  const source = readFileSync(filePath, 'utf8');
  assert.doesNotMatch(
    source,
    forbiddenRuntimeDependency,
    `Versioned Agent session dependency leaked into Runtime core: ${filePath}`,
  );
}

const controllerPath = join(process.cwd(), 'src', 'components', 'chat', 'agentRunController.ts');
const controllerSource = readModuleProjectFile('src/components/chat/agentRunController.ts');
const chatSendExecutionSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'chat', 'petChatMessageSendExecution.ts'),
  'utf8',
);
const runtimeUiStatusProjectionSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'chat', 'agentRuntimeUiStatusProjection.ts'),
  'utf8',
);
const chatRuntimeCompatibilitySource = readFileSync(
  join(process.cwd(), 'src', 'components', 'chat', 'chatAgentRuntimeCompatibility.ts'),
  'utf8',
);
const chatProcessPanelSource = readChatMessageSource();
const sharedTypesSource = readFileSync(join(process.cwd(), 'src', 'types.ts'), 'utf8');
const productionSessionSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'agentProductionSession.ts'),
  'utf8',
);
const permissionRouterSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'agentPermissionRouter.ts'),
  'utf8',
);
const approvalContinuationRuntimeSource = readModuleProjectFile('src/agent/runtime/agentApprovalContinuationRuntime.ts');
const pendingApprovalResolverSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentPendingApprovalResolver.ts'),
  'utf8',
);
const staleApprovalCompatibilitySource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentStaleApprovalCompatibility.ts'),
  'utf8',
);
assert.match(sharedTypesSource, /agentRuntime\?: AgentRuntimeContinuation \| null/u);
assert.match(sharedTypesSource, /@deprecated Read compatibility[\s\S]*agentSessionV2\?: AgentRuntimeContinuation \| null/u);
assert.match(
  chatRuntimeCompatibilitySource,
  /record\?\.agentRuntime \?\? record\?\.agentSessionV2 \?\? null/u,
  'Persisted Agent records must resolve the canonical Runtime field before the legacy read fallback.',
);
assert.doesNotMatch(
  controllerSource,
  /agentSessionV2/u,
  'Production Controller must write only the version-neutral agentRuntime persisted field.',
);
assert.doesNotMatch(
  chatProcessPanelSource,
  /(?:\.|\b)agentSessionV2\b/u,
  'Chat process UI must read persisted Runtime state through the compatibility reader.',
);
assert.doesNotMatch(
  controllerSource,
  /runAgentSessionV3ExperimentalFeatureFlagRoute/gu,
  'The UI controller must enter through the single production Runtime entry instead of routing runtime versions directly.',
);
assert.doesNotMatch(
  chatSendExecutionSource,
  /await context\.onAgentChatCommand\(action\.command\)/u,
  'Chat follow-up buttons must not dispatch a tool command before Runtime approval and transaction handling.',
);
assert.match(
  chatSendExecutionSource,
  /command\.toolCall\?\.goal[\s\S]*command\.instruction[\s\S]*command\.sourceText/u,
  'Chat follow-up buttons must return the original command semantics to the Runtime instead of relying on display labels.',
);
assert.doesNotMatch(
  controllerSource,
  /resolveAgentRunControllerReadOnlyFollowUp|runAgentReadOnlyFollowUpsWithLiveProgress/u,
  'UI Controller must not own a post-Runtime read-only recovery loop.',
);
assert.match(permissionRouterSource, /diagnoseAgentTaskScopedApprovalContinuation/u);
assert.match(approvalContinuationRuntimeSource, /runAgentTaskScopedApprovalContinuations/u);
assert.match(
  approvalContinuationRuntimeSource,
  /kind: 'approval-granted'[\s\S]*kind: 'execution-started'[\s\S]*kind: 'action-dispatched'/u,
  'Runtime-owned approval continuation must commit approval, execution, and dispatch lifecycle transitions.',
);
assert.match(
  approvalContinuationRuntimeSource,
  /const wasCommittedDispatch = hasAgentRuntimeCommittedDesktopDispatch\([\s\S]*if \(wasCommittedDispatch/u,
  'Approved lifecycle must record dispatch only after the transaction returns committed dispatch evidence.',
);
assert.match(
  productionSessionSource,
  /runAgentApprovedActionLifecycle\(\{[\s\S]*createAgentRuntimeWaitingApprovalSnapshot\(\{/u,
  'The first user-approved action must enter the same Runtime lifecycle used by automatic continuations.',
);
assert.match(controllerSource, /runAgentProductionApprovedAction\(\{/u);
assert.doesNotMatch(
  controllerSource,
  /const rawApprovedResult = onAgentChatCommand/u,
  'Controller must not execute the first approved action before entering the Runtime lifecycle.',
);
assert.match(
  approvalContinuationRuntimeSource,
  /createAgentApprovalContinuationOutcome[\s\S]*appendAgentApprovalContinuationDiagnostic/u,
  'Approval continuation outcomes and diagnostic envelopes must remain Runtime-owned.',
);
assert.match(
  approvalContinuationRuntimeSource,
  /staleOuterApprovalSkipped=true[\s\S]*!wasSkippedWithoutDispatch[\s\S]*action-dispatched/u,
  'A skipped stale approval must never be recorded as an action dispatch.',
);
assert.match(
  approvalContinuationRuntimeSource,
  /createAgentStaleOuterApprovalSkippedResult[\s\S]*staleOuterApprovalSkipped=true/u,
  'Runtime must construct stale outer-approval evidence and receipts.',
);
assert.match(
  approvalContinuationRuntimeSource,
  /createAgentDuplicateApprovalBlockedResult[\s\S]*duplicateApproval=true/u,
  'Runtime must construct duplicate approval evidence and receipts.',
);
assert.match(pendingApprovalResolverSource, /resolveAgentRuntimePendingFollowUpApproval/u);
assert.match(staleApprovalCompatibilitySource, /canSkipAgentStaleOuterApprovalAfterTaskEvidence/u);
assert.match(
  staleApprovalCompatibilitySource,
  /hasAgentRuntimeCommittedInputDispatch[\s\S]*hasAgentRuntimeCommittedDesktopDispatch/u,
  'Stale approval compatibility must use committed dispatch evidence rather than ok=true alone.',
);
assert.match(
  approvalContinuationRuntimeSource,
  /canSkipAgentStaleOuterApprovalAfterTaskEvidence\(\{/u,
  'Runtime continuation runner must apply stale-approval compatibility policy itself.',
);
assert.doesNotMatch(
  controllerSource,
  /canSkipAgentStaleOuterApprovalAfterTaskEvidence|function (?:isAgentRunControllerOuterDesktopDispatchCommand|canSkipStaleOuterApprovalAfterTaskEvidence|hasAgentRunControllerOuterDispatchEvidence)/u,
  'UI Controller must consume Runtime stale-approval compatibility policy instead of implementing it.',
);
assert.doesNotMatch(
  controllerSource,
  /function resolveAgentRunControllerVisualExecutionStrategyApproval|const visualStrategyApproval =/u,
  'UI Controller must consume the Runtime pending-approval resolver instead of selecting follow-up approvals.',
);
assert.doesNotMatch(
  controllerSource,
  /while \(\s*isAgentTaskRuntimeWaitingApproval\(nextSessionResult\)/u,
  'UI Controller must not own the task-scoped approval continuation loop.',
);
assert.doesNotMatch(
  controllerSource,
  /while \([\s\S]{0,240}pendingApproval/u,
  'UI Controller must not restore another pending-approval continuation loop.',
);
assert.doesNotMatch(
  controllerSource,
  /const continuationResult = await runAgentSessionV2\(/u,
  'Controller continuation entry must return through AgentRuntime instead of invoking a Legacy Session directly.',
);
assert.match(approvalContinuationRuntimeSource, /initialPendingApproval\?: AgentRuntimePendingApproval/u);
assert.doesNotMatch(
  controllerSource,
  /isAgentTaskScopedApprovalContinuationAllowed\(/u,
  'Controller must submit initial pending approvals to the Runtime runner instead of deciding whether to execute them.',
);
assert.match(
  controllerSource,
  /initialPendingApproval: pendingRunFollowUpApproval/u,
  'Initial-run follow-up approval must enter through the Runtime continuation runner.',
);
assert.match(
  controllerSource,
  /initialPendingApproval: pendingReadOnlyFollowUpApproval/u,
  'Approved-result follow-up approval must enter through the Runtime continuation runner.',
);
assert.doesNotMatch(
  controllerSource,
  /function (?:hasSameAgentTaskScope|isAgentCommandHardGate|isAgentPendingApprovalWithinApprovedRiskCeiling|diagnoseAgentTaskScopedApprovalContinuation)/u,
  'UI Controller must consume Permission Router approval-continuation policy instead of implementing it.',
);
assert.doesNotMatch(
  controllerSource,
  /approvalContinuation(?:Reason|Count|Limit|Tool)|appendAgentRuntimeApprovalContinuationDiagnostic/u,
  'UI Controller must not write Runtime approval-continuation diagnostics.',
);
assert.doesNotMatch(
  controllerSource,
  /approved command fingerprint matched|duplicateApproval=true|staleOuterApprovalSkipped=true/iu,
  'UI Controller must not classify or construct duplicate/stale approval evidence.',
);
assert.match(controllerSource, /runAgentProductionRuntime/gu);
assertProductionRuntimeCancellation(controllerSource, controllerPath);
assert.doesNotMatch(
  controllerSource,
  /\brunAgentRuntime\b|createAgentRuntimeProductionAdapter|\brunAgentProductionSession\b|transitionAgentRuntimeTaskTransaction/u,
  'Controller must use the consolidated production Runtime entry instead of assembling Runtime, Adapter, and Session.',
);
assert.match(productionSessionSource, /export function cancelAgentProductionRuntime/u);
assert.match(productionSessionSource, /transitionAgentRuntimeTaskTransaction\(\{/u);
assert.match(
  runtimeUiStatusProjectionSource,
  /function isAgentTaskRuntimeWaitingApproval[\s\S]*result\.taskState\.state === ['"]waiting_approval['"]/u,
  'Approval UI projection must prefer the production Task Runtime state.',
);
for (const lifecycle of ['initialRunLifecycle', 'approvalRunLifecycle']) {
  const lifecycleSource = readFileSync(join(process.cwd(), 'src', 'components', 'chat', 'runController', `${lifecycle}.ts`), 'utf8');
  assert.match(
    lifecycleSource,
    /import\s*\{\s*isAgentTaskRuntimeWaitingApproval\s*\}\s*from ['"]\.\.\/agentRuntimeUiStatusProjection['"]/u,
    `${lifecycle} must consume the centralized Task Runtime UI status projection.`,
  );
  assert.match(lifecycleSource, /isAgentTaskRuntimeWaitingApproval\((?:result|sessionResult)\)/u);
}
assert.equal(
  (runtimeUiStatusProjectionSource.match(/result\.status === ['"]needs-approval['"]/gu) ?? []).length,
  1,
  'Legacy needs-approval status may only remain inside the Task Runtime compatibility fallback.',
);
assert.doesNotMatch(
  controllerSource,
  /result\.status === ['"]needs-approval['"]/u,
  'Controller must not duplicate the Task Runtime compatibility fallback.',
);

const publicRuntimePath = join(runtimeDir, 'agentRuntime.ts');
const publicRuntimeSource = readFileSync(publicRuntimePath, 'utf8');
assert.doesNotMatch(
  publicRuntimeSource,
  /legacy|agentSession/giu,
  'The public Runtime entry must not directly depend on legacy session implementations.',
);
const publicAgentIndexSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'index.ts'),
  'utf8',
);
const legacyAgentIndexSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'legacy', 'index.ts'),
  'utf8',
);
const sessionSource = readModuleProjectFile(
  'src/agent/agentProductionSessionImplementation.ts',
).replace(/\r\n?/gu, '\n');
const dispatchEvidenceSource = readFileSync(
  join(runtimeDir, 'agentDispatchEvidence.ts'),
  'utf8',
);
assert.match(
  dispatchEvidenceSource,
  /const receiptStatus = result\?\.receipt\?\.status[\s\S]*hasExplicitSuccessReceipt[\s\S]*hasChangedActionEvidence[\s\S]*result\?\.ok === true[\s\S]*receiptStatus !== 'unverified'[\s\S]*actionOutcome !== 'no-op'[\s\S]*actionOutcome !== 'uncertain'/u,
  'Committed dispatch evidence must require explicit success or changed evidence and reject weak outcomes.',
);
const dispatchActionCoverageSource = readModuleProjectFile('src/agent/runtime/agentActionCoverage.ts');
const windowTargetResolutionSource = readFileSync(
  join(runtimeDir, 'agentWindowTargetResolutionRuntime.ts'),
  'utf8',
);
const approvedDispatchResolutionSource = readModuleProjectFile('src/agent/runtime/agentApprovedDispatchResolution.ts');
const desktopSequenceSource = readModuleProjectFile('src/agent/agentRuntimeDesktopSequenceTools.ts');
const shadowAdapterSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'agentTaskRuntimeV4SessionV2ShadowAdapter.ts'),
  'utf8',
);
assert.match(sessionSource, /export async function runAgentProductionSessionImplementation/u);
assert.match(sessionSource, /const commitToolResult =/u);
assert.match(sessionSource, /getProductionLifecycleFacts/u);
const productionSessionResultContextSource = readModuleProjectFile('src/agent/productionSession/sessionResultContext.ts');
assert.match(sessionSource, /from '\.\/productionSession\/sessionResultContext'/u);
assert.match(sessionSource, /const \{ createProgressSnapshot, createFinalResult, createBudgetExceededResult \} = createAgentProductionSessionResultContext\(\{/u);
assert.match(productionSessionResultContextSource, /createAgentTaskRuntimeV4SessionV2Shadow\(/u);
assert.match(sessionSource, /collectAgentRuntimeLifecycleFacts/u);
assert.equal(
  (sessionSource.match(/toolResults\.push\(/gu) ?? []).length,
  1,
  'Production Session tool results must enter through the single commitToolResult boundary.',
);
assert.doesNotMatch(
  sessionSource,
  /toolResults\.push\(\.\.\./u,
  'Production Session must not bypass the single-result commit boundary with batch pushes.',
);
assert.match(dispatchEvidenceSource, /export function hasAgentRuntimeInputDispatch/u);
assert.match(dispatchEvidenceSource, /export function hasAgentRuntimeDesktopDispatch/u);
assert.match(dispatchEvidenceSource, /export function hasAgentRuntimeInAppDispatch/u);
assert.match(dispatchEvidenceSource, /export function hasAgentRuntimeCommittedInputDispatch/u);
assert.match(dispatchEvidenceSource, /export function hasAgentRuntimeCommittedDesktopDispatch/u);
assert.match(
  dispatchEvidenceSource,
  /hasExplicitInAppTarget[\s\S]*hasAgentRuntimeInAppDispatch/u,
  'In-app dispatch classification must require explicit target/window scope for low-level input.',
);
assert.match(
  dispatchEvidenceSource,
  /select_window_ui[\s\S]*set_window_ui_value/u,
  'Shared dispatch evidence must cover the complete generic UI Automation action family.',
);
assert.match(
  dispatchActionCoverageSource,
  /from ['"]\.\.\/agentDispatchEvidence['"]/u,
  'Action Coverage must use the shared dispatch evidence predicates.',
);
assert.match(
  shadowAdapterSource,
  /from ['"]\.\/runtime\/agentDispatchEvidence['"]/u,
  'V4 shadow must use the shared dispatch evidence predicates.',
);
assert.match(
  shadowAdapterSource,
  /latestProductionDispatchIndex = -1[\s\S]*kind === 'action-dispatched'[\s\S]*index > latestProductionDispatchIndex/u,
  'V4 shadow verification must belong to the latest production dispatch.',
);
const actionLifecycleSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'agentActionLifecycle.ts'),
  'utf8',
);
const taskEvidenceSource = readModuleProjectFile('src/agent/runtime/agentRuntimeTaskEvidence.ts');
assert.match(
  actionLifecycleSource,
  /postActionState !== 'launched'[\s\S]*actionEvidence\?\.outcome === 'no-op'[\s\S]*status: 'failed_no_effect'[\s\S]*receipt\?\.status === 'success'/u,
  'Action lifecycle must reject explicit no-op evidence before accepting a success receipt.',
);
assert.match(
  taskEvidenceSource,
  /existingEvidenceId[\s\S]*evidenceById\.has\(existingEvidenceId\)[\s\S]*continue/u,
  'Task evidence aggregation must be idempotent when the same tool result is reprocessed.',
);
assert.ok(
  taskEvidenceSource.includes('const isStaleFallback =')
    && taskEvidenceSource.includes('const nextSurface = isStaleFallback')
    && taskEvidenceSource.includes('structuredEvidence && !isStaleFallback')
    && taskEvidenceSource.includes('isStaleFallback ? null : createActionReceipt')
    && taskEvidenceSource.includes('if (!isStaleFallback) {\n      verification'),
  'Stale fallback observations must remain diagnostic-only and must not mutate live task identity or success state.',
);
assert.match(
  taskEvidenceSource,
  /function getStableEvidenceSourceId[\s\S]*stableEvidenceJson[\s\S]*Math\.imul[\s\S]*toString\(16\)/u,
  'Evidence source IDs must include a stable digest so long tool arguments cannot collide after normalization truncation.',
);
const taskContractSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentRuntimeTaskContract.ts'),
  'utf8',
);
assert.ok(
  taskContractSource.includes('const sourcePart = normalizeRuntimeContractIdPart')
    && taskContractSource.includes('const kindPart = normalizeRuntimeContractIdPart')
    && taskContractSource.includes('const taskPart = normalizeRuntimeContractIdPart')
    && taskContractSource.includes('`${sourcePart}-${kindPart}-${taskPart}`'),
  'Evidence IDs must place the action discriminator before the truncated task identifier.',
);
assert.ok(
  taskContractSource.includes('toolCallId?: string | null;')
    && taskContractSource.includes('inputFingerprint?: string | null;')
    && taskContractSource.includes('const discriminator ='),
  'Action IDs must include a per-call discriminator for same-time repeated tool actions.',
);
assert.match(
  taskEvidenceSource,
  /function resolveStableToolEvidenceCapturedAt[\s\S]*actionEvidence\?\.timestamp[\s\S]*observationCapturedAt[\s\S]*entry\.timing\?\.endedAt/u,
  'Task evidence deduplication must use stable evidence timestamps and must not collapse entries onto a shared now value.',
);
assert.match(
  taskEvidenceSource,
  /surface\.owner\.hwnd === window\.hwnd[\s\S]*surface\.owner\.pid[\s\S]*window\.pid/u,
  'Surface identity must compare PID when HWND and PID are both available.',
);
assert.match(
  windowTargetResolutionSource,
  /function isFreshWindowInventory[\s\S]*observationFreshness === 'stale-fallback'[\s\S]*return false[\s\S]*entry\.result\.ok !== true[\s\S]*receiptStatus === 'unverified'[\s\S]*age >= -AGENT_WINDOW_INVENTORY_CLOCK_SKEW_TOLERANCE_MS && age <= 1500/u,
  'Window target resolution must require bounded freshness evidence.',
);
assert.match(
  sessionSource,
  /evaluateAgentVisualSampleConsensus[\s\S]*previousVisualEntries[\s\S]*status !== 'passed'/u,
  'Coordinate visual actions must require independent visual agreement before approval.',
);
assert.match(
  sessionSource,
  /hasAgentSessionV2PointInsideActionableArea[\s\S]*return null/u,
  'Coordinate visual actions must land inside an actionable candidate area before approval.',
);
assert.match(
  readModuleProjectFile('src/agent/runtime/agentTargetResolutionContext.ts'),
  /function isUsableTargetEvidence[\s\S]*receiptStatus !== 'unverified'[\s\S]*observationFreshness !== 'stale-fallback'/u,
  'Target resolution must reject unverified receipts and stale fallback observations while allowing read-only assessment states.',
);
assert.match(
  readModuleProjectFile('src/agent/runtime/agentTargetResolutionContext.ts'),
  /hasAgentTargetResolutionSinceLastDispatch[\s\S]*isUsableTargetEvidence\(entry\)/u,
  'Target-resolution suppression must use the same usable-evidence gate as actionable window binding.',
);
assert.match(
  approvedDispatchResolutionSource,
  /export async function resolveAgentApprovedDispatch[\s\S]*executeObservation/u,
  'Approved side-effect dispatch must re-resolve live window identity through the Runtime boundary.',
);
assert.match(
  approvedDispatchResolutionSource,
  /resolveAgentWindowTargetBeforeDispatch/u,
  'Approved side-effect dispatch must use the shared live window identity resolver.',
);
assert.match(
  approvedDispatchResolutionSource,
  /WINDOW_UI_ACTIONS[\s\S]*interact_window_ui[\s\S]*set_window_ui_value/u,
  'Approved dispatch re-resolution must cover generic UI Automation actions.',
);
assert.match(
  approvedDispatchResolutionSource,
  /isWindowUiAction[\s\S]*applyResolvedIdentity[\s\S]*WINDOW_UI_ACTIONS\.has\(directAction\)/u,
  'Approved UI Automation actions must retain their original action while receiving refreshed identity.',
);
assert.match(
  approvedDispatchResolutionSource,
  /if \(!query\)[\s\S]*return args/u,
  'Approved identity-only commands must preserve HWND/PID when no semantic query is available.',
);
assert.match(
  approvedDispatchResolutionSource,
  /args\.sourceQuery[\s\S]*args\.sourceWindowTitle[\s\S]*args\.windowQuery/u,
  'Approved UI Automation re-resolution must accept generic source/window query fields.',
);
assert.match(
  approvedDispatchResolutionSource,
  /expectedForegroundHwnd \?\? args\.hwnd \?\? args\.windowHandle[\s\S]*expectedForegroundPid \?\? args\.pid/u,
  'Approved low-level input re-resolution must accept the normalized HWND/PID aliases.',
);
assert.match(
  approvedDispatchResolutionSource,
  /try \{[\s\S]*executeObservation\(forcedObservation\)[\s\S]*catch \(error\)[\s\S]*createBlockedResult/u,
  'Dispatch-time observation failures must be normalized into a blocked Runtime result.',
);
assert.match(
  approvedDispatchResolutionSource,
  /followsWindowCreation[\s\S]*stripWindowIdentity[\s\S]*continue/u,
  'A sequence step after window creation must discard stale HWND/PID before the new window exists.',
);
assert.match(
  desktopSequenceSource,
  /refreshAgentRuntimeDesktopSequenceWindowAfterSurfaceChange[\s\S]*previousWindow[\s\S]*forceRefresh: true[\s\S]*includeRunningApps: true/u,
  'The sequence executor must obtain a fresh window inventory after a surface-changing desktop action.',
);
assert.match(
  desktopSequenceSource,
  /resolveAgentRuntimeDesktopSequencePostCreationTarget[\s\S]*nextStepTarget\.trim\(\) \|\| options\.createdTarget\.trim\(\)/u,
  'Post-creation target binding must prefer the current step semantic target over the preceding launch target.',
);
assert.match(
  desktopSequenceSource,
  /const targetBasename[\s\S]*split[\s\S]*replace[\s\S]*targetBasename\.length/u,
  'Post-creation window lookup must support executable/path targets whose full path is absent from the window title.',
);
assert.match(
  desktopSequenceSource,
  /getAgentRuntimeDesktopSequenceWindowTarget[\s\S]*interact_window_ui[\s\S]*invoke_window_ui[\s\S]*\? \[\]/u,
  'Post-creation window lookup must not treat a UI control label as the containing window target.',
);
assert.match(
  desktopSequenceSource,
  /step\.tool === 'execute_desktop_input'[\s\S]*sourceQuery[\s\S]*sourceWindowTitle[\s\S]*windowQuery[\s\S]*\]\s*:\s*\[/u,
  'Post-creation input lookup must use semantic source fields rather than stale expected foreground identity fields.',
);
assert.match(
  desktopSequenceSource,
  /function isAgentRuntimeDesktopSequenceWindowDependentStep[\s\S]*execute_desktop_input[\s\S]*close_window[\s\S]*move_window_to_display/u,
  'A window-dependent step after surface creation must be stopped before dispatch when no live target window is uniquely resolved.',
);
assert.match(
  desktopSequenceSource,
  /identityActions = new Set\(\[[\s\S]*close_window[\s\S]*interact_window_ui[\s\S]*invoke_window_ui/u,
  'All window-dependent sequence actions must inherit the freshly resolved window identity when available.',
);
assert.match(
  readModuleProjectFunction('src/agent/agentRuntimeDesktopSequenceTools.ts', 'runAgentRuntimeDesktopSequenceSteps'),
  /isAgentRuntimeDesktopSequenceSurfaceChangingStep\(previousStep\)[\s\S]*isAgentRuntimeDesktopSequenceWindowDependentStep\(step\)[\s\S]*!latestFocusedWindow[\s\S]*createAgentRuntimeDesktopSequenceUnresolvedWindowResult/u,
  'A post-creation dispatch must be blocked when the live target window cannot be resolved.',
);
assert.match(
  readModuleProjectFunction('src/agent/agentRuntimeDesktopSequenceTools.ts', 'createAgentRuntimeDesktopSequenceUnresolvedWindowResult'),
  /preDispatchWindowResolution=blocked/u,
  'An unresolved post-creation window must report blocked dispatch evidence.',
);
assert.match(
  desktopSequenceSource,
  /isAgentRuntimeDesktopSequenceAuxiliaryStep[\s\S]*focus_window did not complete[\s\S]*continuing/u,
  'A failed focus helper must not prevent a later critical desktop input from running.',
);
assert.match(
  productionSessionSource,
  /resolveAgentApprovedDispatch\([\s\S]*executeObservation:/u,
  'Production approval entry must invoke dispatch-time target re-resolution before execution.',
);
assert.match(
  productionSessionSource,
  /command: executionApproval\.command/u,
  'Production approval entry must execute the re-resolved approval command.',
);
assert.match(
  productionSessionSource,
  /approvedToolResult:[\s\S]*command: executionApproval\.command/u,
  'Production approval result must retain the re-resolved command identity.',
);
const approvalContinuationSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentApprovalContinuationRuntime.ts'),
  'utf8',
);
assert.match(
  approvalContinuationSource,
  /resolvedDispatch\.plan \?\? pendingApproval\.plan[\s\S]*plan: executionPlan/u,
  'Approval continuations must carry the plan rebuilt from the re-resolved command.',
);
assert.match(
  productionSessionSource,
  /const resolvedApproval = previousApproval[\s\S]*command,[\s\S]*plan: buildAgentPermissionRoute\(command\)\.plan[\s\S]*approval: resolvedApproval/u,
  'Approval continuation resume must record the same command and plan that were actually re-resolved and executed.',
);
assert.equal(
  existsSync(join(process.cwd(), 'src', 'agent', 'agentSessionV2.ts')),
  false,
  'The retired SessionV2 entry Module must remain deleted.',
);
const retiredSessionV2Modules = readdirSync(join(process.cwd(), 'src', 'agent'))
  .filter((name) => /^agentSessionV2.*\.ts$/u.test(name));
assert.deepEqual(
  retiredSessionV2Modules,
  [],
  'Retired SessionV2 compatibility Modules must remain deleted.',
);
for (const relativePath of [
  'src/agent/agentCore.ts',
  'src/agent/agentLegacy.ts',
  'src/agent/agentLegacyChatCommand.ts',
  'src/agent/agentSessionV3ExperimentalChatRunner.ts',
  'src/agent/agentSessionV3ExperimentalFeatureFlag.ts',
  'src/agent/agentSessionV3ExperimentalSession.ts',
  'src/agent/agentSessionV3ExperimentalV2Adapters.ts',
  'src/agent/agentSessionV3PilotCorpusReadiness.ts',
  'src/agent/agentSessionV3PilotDebugSampleCollector.ts',
  'src/agent/agentSessionV3PilotDebugSampleCorpus.ts',
  'src/agent/agentSessionV3PilotDiagnosticSampleRunner.ts',
  'src/agent/agentSessionV3PilotExternalReadinessCalibration.ts',
  'src/agent/agentSessionV3PilotExternalSampleFixtureBatch.ts',
  'src/agent/agentSessionV3PilotExternalSampleFixtureSetExport.ts',
  'src/agent/agentSessionV3PilotExternalSampleIntake.ts',
  'src/agent/agentSessionV3PilotHarness.ts',
  'src/agent/agentSessionV3PilotPhaseCoverageReadiness.ts',
  'src/agent/agentSessionV3PilotPhaseDriver.ts',
  'src/agent/agentSessionV3PilotReadinessFailureDiagnostics.ts',
  'src/agent/agentSessionV3PilotReadinessThresholdProfileComparison.ts',
  'src/agent/agentSessionV3PilotShadowAgreement.ts',
  'src/agent/agentSessionV3PilotShadowDebugExport.ts',
  'src/agent/agentSessionV3RuntimeAdapters.ts',
  'src/agent/agentSessionV3RuntimeBoundary.ts',
  'src/agent/agentSessionV3RuntimeController.ts',
]) {
  assert.equal(
    existsSync(join(process.cwd(), relativePath)),
    false,
    `Unreachable V3 Experimental/Pilot, legacy Core and Legacy barrel Modules must remain deleted: ${relativePath}`,
  );
}
const modelDecisionRuntimeSource = readFileSync(
  join(runtimeDir, 'agentModelDecisionRuntime.ts'),
  'utf8',
);
const decisionContractRuntimeSource = readFileSync(
  join(runtimeDir, 'agentDecisionContract.ts'),
  'utf8',
);
const decisionTraceRuntimeSource = readFileSync(
  join(runtimeDir, 'agentDecisionTraceSummary.ts'),
  'utf8',
);
const planningContextRuntimeSource = readFileSync(
  join(runtimeDir, 'agentPlanningContextRuntime.ts'),
  'utf8',
);
const workingMemoryBiasRuntimeSource = readFileSync(
  join(runtimeDir, 'agentWorkingMemoryBias.ts'),
  'utf8',
);
const workingMemoryConflictRuntimeSource = readFileSync(
  join(runtimeDir, 'agentWorkingMemoryConflict.ts'),
  'utf8',
);
const taskProgressSignalSource = readFileSync(
  join(runtimeDir, 'agentTaskProgressSignal.ts'),
  'utf8',
);
const visualPlanningSignalsSource = readFileSync(
  join(runtimeDir, 'agentVisualPlanningSignals.ts'),
  'utf8',
);
const resultVerificationSignalSource = readFileSync(
  join(runtimeDir, 'agentResultVerificationSignal.ts'),
  'utf8',
);
const replanSignalRuntimeSource = readFileSync(
  join(runtimeDir, 'agentReplanSignal.ts'),
  'utf8',
);
const postActionRecoveryFollowUpSignalRuntimeSource = readFileSync(
  join(runtimeDir, 'agentPostActionRecoveryFollowUpSignal.ts'),
  'utf8',
);
const traceStuckGuardRuntimeSource = readFileSync(
  join(runtimeDir, 'agentTraceStuckSignalGuard.ts'),
  'utf8',
);
const traceStuckSignalRuntimeSource = readFileSync(
  join(runtimeDir, 'agentTraceStuckSignal.ts'),
  'utf8',
);
const traceEventsRuntimeSource = readFileSync(
  join(runtimeDir, 'agentTraceEvents.ts'),
  'utf8',
);
const toolResultCacheEvidenceRuntimeSource = readFileSync(
  join(runtimeDir, 'agentToolResultCacheEvidence.ts'),
  'utf8',
);
const toolResultSummaryRuntimeSource = readFileSync(
  join(runtimeDir, 'agentToolResultSummary.ts'),
  'utf8',
);
const decisionRepairSignalRuntimeSource = readFileSync(
  join(runtimeDir, 'agentDecisionRepairSignal.ts'),
  'utf8',
);
const compatibilityToolRejectionRuntimeSource = readFileSync(
  join(runtimeDir, 'agentCompatibilityToolRejection.ts'),
  'utf8',
);
const finalAnswerRejectionSignalsRuntimeSource = readFileSync(
  join(runtimeDir, 'agentFinalAnswerRejectionSignals.ts'),
  'utf8',
);
const decisionRejectionSignalsRuntimeSource = readFileSync(
  join(runtimeDir, 'agentDecisionRejectionSignals.ts'),
  'utf8',
);
const postActionRecoveryGuidanceRuntimeSource = readFileSync(
  join(runtimeDir, 'agentPostActionRecoveryGuidance.ts'),
  'utf8',
);
const approvalReasonSignalsRuntimeSource = readFileSync(
  join(runtimeDir, 'agentApprovalReasonSignals.ts'),
  'utf8',
);
const executionProgressSignalsRuntimeSource = readFileSync(
  join(runtimeDir, 'agentExecutionProgressSignals.ts'),
  'utf8',
);
const commandEvidencePredicatesRuntimeSource = readFileSync(
  join(runtimeDir, 'agentCommandEvidencePredicates.ts'),
  'utf8',
);
const pendingApprovalAssemblyRuntimeSource = readFileSync(
  join(runtimeDir, 'agentPendingApprovalAssembly.ts'),
  'utf8',
);
const parallelToolPreparationRuntimeSource = readFileSync(
  join(runtimeDir, 'agentParallelToolPreparation.ts'),
  'utf8',
);
const deterministicSkillRouteRuntimeSource = readFileSync(
  join(runtimeDir, 'agentDeterministicSkillRoute.ts'),
  'utf8',
);
const planningSignalEvidenceSource = readFileSync(
  join(runtimeDir, 'agentPlanningSignalEvidence.ts'),
  'utf8',
);
const stuckSignatureMetricsSource = readFileSync(
  join(runtimeDir, 'agentStuckSignatureMetrics.ts'),
  'utf8',
);
assert.doesNotMatch(
  publicAgentIndexSource,
  /agentRuntimeLegacyVersionAdapter|agentRecoveryLegacyV2Adapter|agentSessionV3/u,
  'The production Agent barrel must not export Legacy routers or V3 diagnostic/runtime APIs.',
);
assert.doesNotMatch(
  legacyAgentIndexSource,
  /agentRuntimeLegacyVersionAdapter|agentRecoveryLegacyV2Adapter/u,
  'Retired Legacy routing and recovery Adapters must not be exported again.',
);
assert.match(modelDecisionRuntimeSource, /export async function runAgentModelDecisionTurn/u);
assert.match(decisionContractRuntimeSource, /export function parseAgentDecisionContract/u);
assert.match(decisionContractRuntimeSource, /export function prepareAgentDecisionToolInput/u);
assert.match(decisionTraceRuntimeSource, /export function createAgentDecisionAcceptedTraceSummary/u);
assert.match(planningContextRuntimeSource, /export function createAgentPlanningContext/u);
assert.match(planningContextRuntimeSource, /export function createAgentModelInput/u);
assert.match(workingMemoryBiasRuntimeSource, /export function createAgentGuardedWorkingMemoryText/u);
assert.match(workingMemoryBiasRuntimeSource, /function resolveAgentWorkingMemoryBiasRecency/u);
assert.match(workingMemoryBiasRuntimeSource, /function resolveAgentWorkingMemoryBiasStatusWeight/u);
assert.match(workingMemoryConflictRuntimeSource, /export function createAgentWorkingMemoryConflictSignalText/u);
assert.match(workingMemoryConflictRuntimeSource, /toolResults: AgentRuntimeToolResultEntry\[\]/u);
assert.match(workingMemoryConflictRuntimeSource, /function rankAgentWorkingMemoryConflict/u);
assert.match(taskProgressSignalSource, /export function createAgentTaskProgressText/u);
assert.match(taskProgressSignalSource, /steps: AgentRuntimeStep\[\]/u);
assert.match(visualPlanningSignalsSource, /export function createAgentRecentVisualContextText/u);
assert.match(visualPlanningSignalsSource, /export function createAgentVisualRecoveryText/u);
assert.match(visualPlanningSignalsSource, /toolResults: AgentRuntimeToolResultEntry\[\]/u);
assert.match(resultVerificationSignalSource, /export function createAgentResultVerificationSignalText/u);
assert.match(resultVerificationSignalSource, /toolResults: AgentRuntimeToolResultEntry\[\]/u);
assert.match(replanSignalRuntimeSource, /export function createAgentReplanSignalText/u);
assert.match(replanSignalRuntimeSource, /steps: AgentRuntimeStep\[\]/u);
assert.match(replanSignalRuntimeSource, /toolResults: AgentRuntimeToolResultEntry\[\]/u);
assert.match(postActionRecoveryFollowUpSignalRuntimeSource, /export function createAgentPostActionRecoveryFollowUpText/u);
assert.match(postActionRecoveryFollowUpSignalRuntimeSource, /toolResults: AgentRuntimeToolResultEntry\[\]/u);
assert.match(traceStuckGuardRuntimeSource, /export function createAgentGuardedTraceStuckSignalText/u);
assert.match(traceStuckGuardRuntimeSource, /AGENT_TRACE_STUCK_SIGNAL_MAX_BLOCKS/u);
assert.match(planningSignalEvidenceSource, /export function createAgentActionPrimitiveSignature/u);
assert.match(planningSignalEvidenceSource, /AgentRuntimeToolResultEntry/u);
assert.match(sessionSource, /from '\.\/runtime\/agentPlanningSignalEvidence'/u);
assert.doesNotMatch(sessionSource, /from '\.\/agentSessionV2PlanningSignalUtils'/u);
assert.match(stuckSignatureMetricsSource, /export function findAgentRepeatedActionOutcomeWindowMetric/u);
assert.match(stuckSignatureMetricsSource, /AgentRuntimeToolResultEntry/u);
assert.match(traceStuckSignalRuntimeSource, /from '\.\/agentTraceStuckSignalGuard'/u);
assert.match(traceStuckSignalRuntimeSource, /createAgentGuardedTraceStuckSignalText\(lines\)/u);
assert.match(traceStuckSignalRuntimeSource, /from '\.\/agentStuckSignatureMetrics'/u);
assert.match(traceStuckSignalRuntimeSource, /export function createAgentTraceStuckSignalText/u);
assert.match(traceEventsRuntimeSource, /export function createAgentTraceRecorder/u);
assert.match(traceEventsRuntimeSource, /export function compactAgentTraceEvents/u);
assert.match(traceEventsRuntimeSource, /export function createAgentToolFinishedTraceDetails/u);
assert.match(traceEventsRuntimeSource, /AgentRuntimeTraceEvent\[\]/u);
assert.match(toolResultCacheEvidenceRuntimeSource, /export function isAgentCachedToolResult/u);
assert.match(toolResultSummaryRuntimeSource, /export function createAgentToolResultCriticalFacts/u);
assert.match(toolResultSummaryRuntimeSource, /export function formatAgentToolResultForModel/u);
assert.match(toolResultSummaryRuntimeSource, /from '\.\/agentPlanningSignalEvidence'/u);
assert.match(decisionRepairSignalRuntimeSource, /export function createAgentInvalidModelOutputRepairText/u);
assert.match(decisionRepairSignalRuntimeSource, /export function createAgentInvalidToolInputRepairText/u);
assert.match(compatibilityToolRejectionRuntimeSource, /export function createAgentCompatibilityToolRejection/u);
assert.match(compatibilityToolRejectionRuntimeSource, /AGENT_DESKTOP_COMPATIBILITY_TOOLS/u);
assert.match(finalAnswerRejectionSignalsRuntimeSource, /export function createAgentIncompleteTaskProgressFinalRejection/u);
assert.match(finalAnswerRejectionSignalsRuntimeSource, /export function createAgentUnverifiedResultFinalRejection/u);
assert.match(finalAnswerRejectionSignalsRuntimeSource, /export function createAgentReadonlyObservationFinalRejection/u);
assert.match(finalAnswerRejectionSignalsRuntimeSource, /export function createAgentUnattemptedRequestedActionFinalRejection/u);
assert.match(finalAnswerRejectionSignalsRuntimeSource, /export function createAgentPrematureDesktopOrganizationFinalRejection/u);
assert.match(finalAnswerRejectionSignalsRuntimeSource, /export function createAgentPrematureWindowMoveFinalRejection/u);
assert.match(finalAnswerRejectionSignalsRuntimeSource, /export function createAgentRecoverableUnverifiedRejection/u);
assert.match(finalAnswerRejectionSignalsRuntimeSource, /AgentRuntimeToolResultEntry\[\]/u);
assert.match(decisionRejectionSignalsRuntimeSource, /export function createAgentPrematureActionConfirmationRejection/u);
assert.match(decisionRejectionSignalsRuntimeSource, /export function createAgentTransitionalDesktopActionRejection/u);
assert.match(decisionRejectionSignalsRuntimeSource, /export function createAgentVideoSummarySearchRejection/u);
assert.match(decisionRejectionSignalsRuntimeSource, /export function createAgentRepeatedFailedToolCallRejection/u);
assert.match(decisionRejectionSignalsRuntimeSource, /export function createAgentRepeatedUnverifiedActionRetryRejection/u);
assert.match(decisionRejectionSignalsRuntimeSource, /AgentRuntimeToolResultEntry/u);
assert.match(postActionRecoveryGuidanceRuntimeSource, /export function createAgentPostActionRecoveryGuidanceLines/u);
assert.match(postActionRecoveryGuidanceRuntimeSource, /AgentRuntimeToolResultEntry/u);
assert.match(approvalReasonSignalsRuntimeSource, /export function createAgentApprovalReadyFollowUpReason/u);
assert.match(approvalReasonSignalsRuntimeSource, /export function createAgentApprovalRequiredToolReason/u);
assert.match(approvalReasonSignalsRuntimeSource, /export function createAgentTargetSelectionApprovalReason/u);
assert.match(approvalReasonSignalsRuntimeSource, /export function createAgentVisualActionApprovalReason/u);
assert.match(approvalReasonSignalsRuntimeSource, /export function createAgentVisualInvokeApprovalReason/u);
assert.doesNotMatch(approvalReasonSignalsRuntimeSource, /鍙|寰呮壒/u);
assert.match(executionProgressSignalsRuntimeSource, /export function createAgentAutoRecoveryStepReason/u);
assert.match(executionProgressSignalsRuntimeSource, /export function createAgentPostApprovalVerificationStepReason/u);
assert.match(executionProgressSignalsRuntimeSource, /export function createAgentVisualRefinementStepReason/u);
assert.match(executionProgressSignalsRuntimeSource, /export function createAgentAutoRecoveryLoopContinuedHistoryLine/u);
assert.match(executionProgressSignalsRuntimeSource, /export function createAgentPostActionTerminalStoppedHistoryLine/u);
assert.match(commandEvidencePredicatesRuntimeSource, /export function isAgentPostApprovalVerificationCommand/u);
assert.match(commandEvidencePredicatesRuntimeSource, /export function isAgentVerifiedTargetWindowObservation/u);
assert.match(
  commandEvidencePredicatesRuntimeSource,
  /observationFreshness === 'stale-fallback'[\s\S]*return false/u,
  'Verified window evidence must reject stale fallback observations.',
);
assert.match(
  readFileSync(join(process.cwd(), 'src', 'agent', 'runtime', 'agentPostActionTerminalEvaluator.ts'), 'utf8'),
  /hasAgentVerifiedAuthenticationCompletion[\s\S]*hasAgentRuntimeCommittedInputDispatch[\s\S]*observationFreshness === 'stale-fallback'/u,
  'Authentication completion must require a committed login input and fresh completion evidence.',
);
assert.match(commandEvidencePredicatesRuntimeSource, /AgentRuntimeToolResultEntry/u);
assert.match(pendingApprovalAssemblyRuntimeSource, /export function createAgentPendingApprovalAssembly/u);
assert.match(pendingApprovalAssemblyRuntimeSource, /AgentRuntimePendingApproval/u);
assert.match(parallelToolPreparationRuntimeSource, /export function prepareAgentParallelToolCommands/u);
assert.match(parallelToolPreparationRuntimeSource, /AgentModelParallelToolCall/u);
assert.match(deterministicSkillRouteRuntimeSource, /export function resolveAgentDeterministicSkillRoute/u);
assert.match(deterministicSkillRouteRuntimeSource, /AgentRuntimeToolResultEntry/u);
assert.match(traceEventsRuntimeSource, /from '\.\/agentToolResultCacheEvidence'/u);
assert.match(decisionTraceRuntimeSource, /export function createAgentPermissionRoutedTraceSummary/u);
assert.match(decisionTraceRuntimeSource, /export function createAgentApprovalRequiredTraceSummary/u);
assert.match(replanSignalRuntimeSource, /from '\.\/agentPlanningSignalEvidence'/u);
const productionModelPlanningTurnSource = readModuleProjectFile('src/agent/productionSession/modelPlanningTurn.ts');
assert.match(sessionSource, /from '\.\/productionSession\/modelPlanningTurn'/u);
assert.match(sessionSource, /const \{ executeModelPlanningTurn \} = createAgentProductionModelPlanningTurn\(\{/u);
assert.match(sessionSource, /await executeModelPlanningTurn\(\{/u);
assert.match(productionModelPlanningTurnSource, /runAgentModelDecisionTurn<AgentModelDecision>/u);
assert.match(sessionSource, /runAgentModelDecisionTurn<AgentModelDecision>/u);
assert.match(sessionSource, /parseDecision: parseAgentDecisionContract/u);
assert.match(sessionSource, /prepareToolInput: prepareAgentDecisionToolInput/u);
assert.match(sessionSource, /const planningContext = createAgentPlanningContext\(\{/u);
assert.match(sessionSource, /const modelInput = createAgentModelInput\(\{/u);
assert.match(sessionSource, /from '\.\.\/runtime\/agentWorkingMemoryBias'/u);
assert.match(sessionSource, /formatWorkingMemory: createAgentGuardedWorkingMemoryText/u);
assert.match(sessionSource, /from '\.\/runtime\/agentWorkingMemoryConflict'/u);
assert.match(sessionSource, /createMemoryConflictSignalText: createAgentWorkingMemoryConflictSignalText/u);
assert.match(sessionSource, /from '\.\/runtime\/agentTaskProgressSignal'/u);
assert.match(sessionSource, /createTaskProgressText: createAgentTaskProgressText/u);
assert.doesNotMatch(sessionSource, /function createAgentSessionV2TaskProgressText/u);
assert.match(sessionSource, /from '\.\/runtime\/agentVisualPlanningSignals'/u);
assert.match(sessionSource, /createRecentVisualContextText: createAgentRecentVisualContextText/u);
assert.match(sessionSource, /createVisualRecoveryText: createAgentVisualRecoveryText/u);
assert.match(sessionSource, /isAgentVisualContextToolCommand\(command\)/u);
assert.match(sessionSource, /from '\.\/runtime\/agentResultVerificationSignal'/u);
assert.match(sessionSource, /createResultVerificationText: createAgentResultVerificationSignalText/u);
assert.doesNotMatch(sessionSource, /createResultVerificationText: createAgentSessionV2ResultVerificationSignalText/u);
assert.match(sessionSource, /from '\.\/runtime\/agentReplanSignal'/u);
assert.match(sessionSource, /createReplanSignalText:[\s\S]*createAgentReplanSignalText/u);
assert.match(sessionSource, /from '\.\/runtime\/agentPostActionRecoveryFollowUpSignal'/u);
assert.match(sessionSource, /createPostActionRecoveryFollowUpText:[\s\S]*createAgentPostActionRecoveryFollowUpText/u);
assert.match(sessionSource, /from '\.\/runtime\/agentTraceEvents'/u);
assert.match(sessionSource, /const traceRecorder = createAgentTraceRecorder\(traceEvents\)/u);
assert.match(sessionSource, /createAgentToolFinishedTraceDetails\(/u);
assert.match(sessionSource, /createAgentPermissionRoutedTraceSummary\(/u);
assert.match(sessionSource, /from '\.\/runtime\/agentToolResultSummary'/u);
assert.match(sessionSource, /formatAgentToolResultForModel\(/u);
assert.match(sessionSource, /from '\.\/runtime\/agentDecisionRejectionSignals'/u);
assert.match(sessionSource, /createAgentPrematureActionConfirmationRejection\(/u);
assert.match(sessionSource, /createAgentTransitionalDesktopActionRejection\(/u);
assert.match(sessionSource, /createAgentVideoSummarySearchRejection\(/u);
assert.match(sessionSource, /createAgentRepeatedFailedToolCallRejection\(/u);
assert.match(sessionSource, /createAgentRepeatedUnverifiedActionRetryRejection\(/u);
assert.match(sessionSource, /createAgentPrematureDesktopOrganizationFinalRejection\(/u);
assert.match(sessionSource, /createAgentPrematureWindowMoveFinalRejection\(/u);
assert.match(sessionSource, /createAgentRecoverableUnverifiedRejection\(/u);
assert.match(sessionSource, /from '\.\/runtime\/agentApprovalReasonSignals'/u);
assert.match(sessionSource, /createAgentApprovalReadyFollowUpReason\(/u);
assert.match(sessionSource, /createAgentApprovalRequiredToolReason\(/u);
assert.match(sessionSource, /createAgentTargetSelectionApprovalReason\(/u);
assert.match(sessionSource, /createAgentVisualActionApprovalReason\(/u);
assert.match(sessionSource, /createAgentVisualInvokeApprovalReason\(/u);
assert.match(sessionSource, /from '\.\.\/runtime\/agentExecutionProgressSignals'/u);
assert.match(sessionSource, /createAgentAutoRecoveryLoopContinuedHistoryLine\(/u);
assert.match(sessionSource, /createAgentPostActionTerminalStoppedHistoryLine\(/u);
assert.match(sessionSource, /from '\.\/runtime\/agentCommandEvidencePredicates'/u);
assert.doesNotMatch(sessionSource, /from '\.\/agentSessionV2CommandEvidencePredicates'/u);
assert.match(sessionSource, /from '\.\/runtime\/agentPendingApprovalAssembly'/u);
assert.match(readModuleProjectFile('src/agent/productionSession/parallelPreparation.ts'), /from '\.\.\/runtime\/agentParallelToolPreparation'/u);
assert.match(sessionSource, /from '\.\/runtime\/agentDeterministicSkillRoute'/u);
assert.doesNotMatch(
  sessionSource,
  /from ['"]\.\/agentSessionV2[^'"]*['"]/u,
  'Production Session implementation must not import versioned Session helper modules.',
);
assert.match(sessionSource, /from '\.\/runtime\/agentDecisionRepairSignal'/u);
assert.match(sessionSource, /createAgentInvalidModelOutputRepairText\(/u);
assert.match(sessionSource, /from '\.\/runtime\/agentCompatibilityToolRejection'/u);
assert.match(sessionSource, /rejectCompatibilityTool: createAgentCompatibilityToolRejection/u);
assert.match(sessionSource, /from '\.\.\/runtime\/agentFinalAnswerRejectionSignals'/u);
assert.match(sessionSource, /createAgentIncompleteTaskProgressFinalRejection\(/u);
assert.match(sessionSource, /createAgentReadonlyObservationFinalRejection\(/u);
assert.doesNotMatch(
  sessionSource,
  /import\s*\{[^}]*createAgentSessionV3PilotShadowInputCollector|import\s*\{[^}]*runAgentSessionV3PilotShadowEventList/u,
  'Production Session must not statically load V3 Shadow implementations.',
);
assert.match(
  sessionSource,
  /import\('\.\/agentSessionV3PilotShadowInputCollector'\)[\s\S]*import\('\.\/agentSessionV3PilotShadowMode'\)/u,
  'Legacy V3 Shadow diagnostics must load only when explicitly enabled.',
);
assert.equal(
  existsSync(join(process.cwd(), 'src', 'agent', 'legacy', 'agentRuntimeLegacyVersionAdapter.ts')),
  false,
  'The retired Legacy version router must remain deleted.',
);
const productionAdapterSource = readFileSync(
  join(runtimeDir, 'agentRuntimeProductionAdapter.ts'),
  'utf8',
);
assert.match(productionAdapterSource, /implementation: 'stable'[\s\S]*result: await options\.run\(context\)/u);
assert.match(productionSessionSource, /return runAgentProductionSessionImplementation\(options\)/u);
assert.match(productionSessionSource, /from '\.\/agentProductionSessionImplementation'/u);
assert.doesNotMatch(productionSessionSource, /runAgentSessionV2/u);
assert.match(productionSessionSource, /createNativeAgentRuntimeAdapter\(nativeRun\)/u);
assert.match(
  readFileSync(join(runtimeDir, 'agentRuntimeAdapterFactory.ts'), 'utf8'),
  /createAgentRuntimeProductionAdapter\(\{\s*id: 'native-runtime-adapter',\s*run\s*\}/u,
  'The native production adapter must be created behind the version-neutral adapter factory.',
);
assert.match(controllerSource, /runAgentProductionApprovalContinuations/u);
assert.doesNotMatch(
  controllerSource,
  /\brunAgentSessionV2\b|\bAgentSessionV2Result\b|(?:function|interface)\s+\w*AgentSessionV2/u,
  'Production Controller must depend on the version-neutral Production Session boundary.',
);
assert.doesNotMatch(
  controllerSource,
  /createAgentRuntimeLegacyVersionAdapter|compatibilityMode:|runCandidate:|candidateAvailable:/u,
  'Production Controller must use one Runtime adapter and must not route or fall back by legacy version.',
);
assert.match(productionSessionSource, /onProgress:\s*runtimeContext\.onProgress/u);

const versionedPublicTypePattern = /\bAgentSessionV2(?:ContinuationState|ProgressEvent|ProgressHandler|Status|Step|TimingEntry|TimingTrace|ToolExecutor|ToolResultEntry|TraceEvent)\b/gu;
const persistedTypesPath = join(process.cwd(), 'src', 'types.ts');
const persistedTypesSource = readFileSync(persistedTypesPath, 'utf8');
assert.doesNotMatch(
  persistedTypesSource,
  versionedPublicTypePattern,
  'Persisted UI contracts must use version-neutral AgentRuntime types.',
);
const defaultConfigSource = readFileSync(join(process.cwd(), 'src', 'constants.ts'), 'utf8');
const configNormalizationSource = readFileSync(
  join(process.cwd(), 'src', 'petConfigNormalization.ts'),
  'utf8',
);
const settingsSystemSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'settings', 'SettingsSystemTab.tsx'),
  'utf8',
);
const chatSessionSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'chat', 'usePetChatSession.ts'),
  'utf8',
);
const chatSenderSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'chat', 'usePetChatMessageSender.ts'),
  'utf8',
);
const petChatContainerSource = readFileSync(
  join(process.cwd(), 'src', 'components', 'pet', 'usePetContainerPanelChatState.ts'),
  'utf8',
);
for (const [label, source] of [
  ['persisted types', persistedTypesSource],
  ['default config', defaultConfigSource],
  ['settings UI', settingsSystemSource],
  ['chat session', chatSessionSource],
  ['chat sender', chatSenderSource],
  ['pet chat container', petChatContainerSource],
  ['production controller', controllerSource],
]) {
  assert.doesNotMatch(
    source,
    /agentRuntimeMode|AgentRuntimeMode|AgentSessionV3ExperimentalFeatureFlagMode/u,
    `${label} must not expose or consume a Runtime version selector.`,
  );
}
assert.match(
  configNormalizationSource,
  /migrateLegacyAgentRuntimeSettings\(rawSettings\)[\s\S]*\.\.\.activeRawSettings/u,
  'Config normalization must read and discard the retired persisted Runtime selector.',
);
assert.doesNotMatch(
  configNormalizationSource,
  /normalizeAgentRuntimeMode|agentRuntimeMode:\s*normalize/u,
  'Legacy Runtime mode must not be normalized back into active settings.',
);

const controllerVersionedTypePattern = /\bAgentSessionV2(?:ProgressEvent|ProgressHandler|ToolExecutor|ToolResultEntry|TraceEvent)\b/gu;
assert.doesNotMatch(
  controllerSource,
  controllerVersionedTypePattern,
  'The UI controller must not depend on versioned progress, trace, executor, or tool-result types.',
);

const transactionConsumers = [
  'src/agent/agentProductionSessionImplementation.ts',
];
for (const relativePath of transactionConsumers) {
  const source = readModuleProjectFile(relativePath);
  assert.doesNotMatch(
    source,
    /runAgentSessionV2(?:Parallel)?ToolExecutionTransaction/gu,
    `Active runtime code must use the version-neutral Tool Transaction Executor: ${relativePath}`,
  );
  assert.match(
    source,
    /runAgent(?:Parallel)?ToolTransaction/gu,
    `Active runtime code must consume the Runtime transaction authority: ${relativePath}`,
  );
}

assert.match(
  controllerSource,
  /runAgentControllerToolTransactionWithLiveProgress[\s\S]*runAgentToolTransaction\(/u,
  'Controller-owned approval execution must enter through the Runtime Tool Transaction Executor.',
);
const rawControllerExecutorCallCount = (
  controllerSource.match(/runAgentToolExecutorWithLiveProgress\(/gu) ?? []
).length;
assert.equal(
  rawControllerExecutorCallCount,
  3,
  'Raw UI executor calls are only allowed in its definition, the transaction adapter, and the shared guarded request adapter.',
);
assert.match(
  productionSessionSource,
  /runAgentApprovedActionLifecycle\(\{[\s\S]{0,420}execute:\s*executeApprovedCommand/u,
  'The user-approved command must execute through the Runtime approval lifecycle and Tool Transaction adapter.',
);
assert.match(
  controllerSource,
  /runAgentProductionApprovedAction\(\{[\s\S]{0,900}executeApprovedCommand:[\s\S]{0,220}runAgentControllerToolTransactionWithLiveProgress\(/u,
  'Controller must supply approved execution only through the consolidated production approval entry.',
);

const postActionTerminalSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentPostActionTerminalEvaluator.ts'),
  'utf8',
);
const evidenceEngineSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentEvidenceEngine.ts'),
  'utf8',
);
assert.match(
  evidenceEngineSource,
  /hasAgentEvidenceNonSuccessfulActionOutcome[\s\S]*outcome === 'no-op'[\s\S]*status: 'insufficient'/u,
  'Evidence Engine must reject no-op action evidence before terminal completion.',
);
const runtimeContractSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentRuntimeContract.ts'),
  'utf8',
);
const actionCoverageSource = readModuleProjectFile('src/agent/runtime/agentActionCoverage.ts');
const chatCommandSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'agentChatCommand.ts'),
  'utf8',
);
const toolCommandFactorySource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentToolCommandFactory.ts'),
  'utf8',
);
const taskIdentitySource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentTaskIdentity.ts'),
  'utf8',
);
const targetResolutionRuntimeSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentTargetResolutionRuntime.ts'),
  'utf8',
);
const targetResolutionContextSource = readModuleProjectFile('src/agent/runtime/agentTargetResolutionContext.ts');
const targetResolutionExecutionSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentTargetResolutionExecutionRuntime.ts'),
  'utf8',
);
const verificationRuntimeSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentVerificationRuntime.ts'),
  'utf8',
);
const verificationOutcomeRuntimeSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentVerificationOutcomeRuntime.ts'),
  'utf8',
);
const approvedActionOutcomeRuntimeSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentApprovedActionOutcomeRuntime.ts'),
  'utf8',
);
const toolOutcomeRuntimeSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentToolOutcomeRuntime.ts'),
  'utf8',
);
const continuationDispatcherSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentRuntimeContinuationDispatcher.ts'),
  'utf8',
);
const commandExecutionRuntimeSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentCommandExecutionRuntime.ts'),
  'utf8',
);
const taskRuntimeSource = readModuleProjectFile('src/agent/runtime/agentTaskRuntime.ts');
const recoveryControllerSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentRecoveryController.ts'),
  'utf8',
);
const recoveryExecutionRuntimeSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentRecoveryExecutionRuntime.ts'),
  'utf8',
);
const visualRefinementExecutionRuntimeSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'runtime', 'agentVisualRefinementExecutionRuntime.ts'),
  'utf8',
);
assert.equal(
  existsSync(join(process.cwd(), 'src', 'agent', 'legacy', 'agentRecoveryLegacyV2Adapter.ts')),
  false,
  'The retired Legacy recovery Adapter must remain deleted.',
);
const desktopRecoveryCapabilitySource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'capabilities', 'agentDesktopRecoveryCapabilityAdapter.ts'),
  'utf8',
);
const desktopRecoveryObservationSource = readModuleProjectFile('src/agent/capabilities/agentDesktopRecoveryObservationBuilder.ts');
const desktopRecoveryCommandSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'capabilities', 'agentDesktopRecoveryCommandBuilder.ts'),
  'utf8',
);
const visualRefinementCapabilitySource = readModuleProjectFile('src/agent/capabilities/agentVisualRefinementCapabilityAdapter.ts');
assert.match(publicRuntimeSource, /advanceAgentTaskRuntimeProgress\(/u);
assert.match(chatCommandSource, /actionScope\?: AgentActionScope/u);
assert.match(
  taskIdentitySource,
  /createAgentTaskGoalId[\s\S]*createAgentSubgoalId/u,
  'Runtime commands must have stable task/subgoal identity helpers.',
);
assert.match(
  toolCommandFactorySource,
  /from ['"]\.\/agentTaskIdentity['"]/u,
  'Runtime Tool Command Factory must consume Runtime task identity.',
);
assert.match(sessionSource, /from '\.\/runtime\/agentToolCommandFactory'/u);
assert.match(sessionSource, /from '\.\/capabilities\/agentDesktopRecoveryCommandBuilder'/u);
assert.match(sessionSource, /from '\.\/capabilities\/agentDesktopRecoveryObservationBuilder'/u);
assert.doesNotMatch(
  sessionSource,
  /from '\.\/agentSessionV2(?:ToolCommandFactory|RecoveryCommandBuilder|AutoRecoveryObservationBuilder)'/u,
  'Production Session must consume Runtime and Capability command builders directly.',
);
assert.match(
  actionCoverageSource,
  /isAgentIntermediateActionCommand[\s\S]*latestUiChangingActionIsIntermediate/u,
  'Intermediate subgoals and their follow-up verification must not satisfy root in-app coverage.',
);
assert.match(
  sessionSource,
  /forceLoginContinuationInput \? 'intermediate' : 'terminal'[\s\S]*isIntermediateContinuation \? 'intermediate' : 'terminal'/u,
  'Coordinate and UIA visual execution paths must declare equivalent subgoal completion scope.',
);
assert.match(publicRuntimeSource, /authorizeAgentTaskRuntimeRecovery\(/u);
assert.match(publicRuntimeSource, /commitAgentTaskRuntimeState\(outcome\.result, undefined, currentTaskState\)/u);
assert.match(taskRuntimeSource, /owner:\s*['"]task-runtime['"]/u);
assert.match(taskRuntimeSource, /export function transitionAgentTaskRuntimeState/u);
assert.match(
  taskRuntimeSource,
  /AGENT_TASK_RUNTIME_LIFECYCLE_PREDECESSORS[\s\S]*validateAgentTaskRuntimeLifecycleTransition/u,
  'Task Runtime must validate lifecycle predecessor phases before committing production state.',
);
assert.match(
  taskRuntimeSource,
  /upsertAgentTaskRuntimeSubgoal[\s\S]*type: 'subgoal-status'[\s\S]*completeAgentTaskRuntimeSubgoals/u,
  'Task Runtime must persist scoped subgoal status and close it only through Runtime state commits.',
);
assert.match(
  taskRuntimeSource,
  /selectAgentTaskRuntimeNextSubgoal[\s\S]*nextSubgoalAction:[\s\S]*nextSubgoalId:/u,
  'Task Runtime must select and persist the next unresolved subgoal action.',
);
assert.match(
  taskRuntimeSource,
  /selectAgentTaskRuntimeNextTransition[\s\S]*case 'execute':[\s\S]*kind: 'target-resolution'[\s\S]*case 'verify':[\s\S]*kind: 'verification'/u,
  'Task Runtime must own deterministic subgoal-to-transition selection.',
);
assert.doesNotMatch(
  sessionSource,
  /taskState\?*\.nextSubgoalAction|taskState\.nextSubgoalAction/u,
  'Legacy Session must pass the Task State Record without interpreting nextSubgoalAction.',
);
for (const [label, source] of [
  ['Approved Action Outcome Runtime', approvedActionOutcomeRuntimeSource],
  ['Target Resolution Runtime', targetResolutionRuntimeSource],
  ['Verification Runtime', verificationRuntimeSource],
]) {
  assert.match(
    source,
    /selectAgentTaskRuntimeNextTransition\(\{ taskState: options\.taskState \}\)/u,
    `${label} must consume the production Task Runtime transition interface.`,
  );
}
assert.match(
  targetResolutionRuntimeSource,
  /resolveAgentTargetResolution[\s\S]*createAgentTargetResolutionContext/u,
  'Runtime Target Resolver must own context extraction before command selection.',
);
assert.match(
  targetResolutionRuntimeSource,
  /resolveAgentTargetResolutionCommand[\s\S]*taskState[\s\S]*selectAgentTaskRuntimeNextTransition[\s\S]*locate_screen_elements/u,
  'Runtime Target Resolver must own execute-selection gating and locate command construction.',
);
assert.match(
  sessionSource,
  /runAgentTargetResolutionExecution\(\{[\s\S]{0,500}actionCoverageDependencies:/u,
  'Legacy Session must submit evidence to the single Runtime Target Resolution execution interface.',
);
assert.doesNotMatch(
  sessionSource,
  /(?:alreadyResolvedSinceLastDispatch|missingInAppActionCoverage|windowEvidenceAvailable|resolveAgentSessionV2OuterAppWindowHwnd|resolveAgentSessionV2WindowSourceHintFromEntry|hasAgentSessionV2InAppTargetLocateRun)/u,
  'Legacy Session must not independently assemble Target Resolver eligibility or source-window context.',
);
assert.match(
  targetResolutionContextSource,
  /createAgentTargetResolutionContext[\s\S]*hasAgentTargetResolutionSinceLastDispatch[\s\S]*sourceHwnd:/u,
  'Runtime target-resolution context must own duplicate suppression and exact HWND extraction.',
);
assert.match(
  targetResolutionExecutionSource,
  /runAgentTargetResolutionExecution[\s\S]*buildAgentPermissionRoute[\s\S]*getBudgetStopReason[\s\S]*runAgentToolTransaction/u,
  'Runtime target-resolution execution must own permission, budget, and Tool Transaction dispatch.',
);
assert.match(
  targetResolutionExecutionSource,
  /target-resolution-started[\s\S]*target-resolution-collected/u,
  'Runtime target-resolution execution must own its lifecycle transition facts.',
);
assert.match(sessionSource, /from '\.\/productionSession\/visualObservationExecution'/u);
assert.match(sessionSource, /createAgentProductionVisualObservationExecution\(\{/u);
const visualObservationExecutionSource = ts.createSourceFile(
  'visualObservationExecution.ts',
  readFileSync(join(process.cwd(), 'src/agent/productionSession/visualObservationExecution.ts'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
let targetResolutionExecutionDeclaration;
function findTargetResolutionExecutionDeclaration(node) {
  if (ts.isVariableDeclaration(node)
    && node.name.getText(visualObservationExecutionSource) === 'executeInAppTargetLocateObservation'
    && node.initializer && ts.isArrowFunction(node.initializer)) {
    targetResolutionExecutionDeclaration = node;
  }
  ts.forEachChild(node, findTargetResolutionExecutionDeclaration);
}
findTargetResolutionExecutionDeclaration(visualObservationExecutionSource);
assert.ok(targetResolutionExecutionDeclaration, 'Production visual observation must retain its target-resolution adapter.');
const legacyTargetResolutionExecutionHelper = targetResolutionExecutionDeclaration.getText(visualObservationExecutionSource);
assert.match(
  legacyTargetResolutionExecutionHelper,
  /runAgentTargetResolutionExecution\(/u,
  'Legacy Session target-resolution adapter must call the Runtime execution interface.',
);
assert.doesNotMatch(
  legacyTargetResolutionExecutionHelper,
  /runAgentToolTransaction\(|buildAgentPermissionRoute\(locateCommand\)|locateBudgetStopReason|taskTransition:\s*\{\s*kind:\s*['"]target-resolution-/u,
  'Legacy Session must not own target-resolution permission, budget, transaction, or lifecycle transitions.',
);
assert.match(
  verificationRuntimeSource,
  /resolveAgentVerificationCommand[\s\S]*taskState[\s\S]*selectAgentTaskRuntimeNextTransition[\s\S]*observe_windows_and_apps[\s\S]*execute_desktop_observation/u,
  'Verification Runtime must own verify selection and read-only verification command construction.',
);
assert.match(
  verificationRuntimeSource,
  /runAgentVerificationExecution[\s\S]*buildAgentPermissionRoute[\s\S]*getBudgetStopReason[\s\S]*runAgentToolTransaction/u,
  'Verification Runtime must own permission, budget, and Tool Transaction dispatch.',
);
assert.match(
  verificationRuntimeSource,
  /verification-started[\s\S]*verification-collected/u,
  'Verification Runtime must own verification lifecycle transition facts.',
);
assert.match(sessionSource, /from '\.\/productionSession\/postApprovalVerification'/u);
assert.match(sessionSource, /createAgentProductionPostApprovalVerification\(\{/u);
const legacyVerificationExecutionHelper = /const executePostApprovalVerification[\s\S]*?return \{ executed: true, finalResult: null \};[\s\S]{0,40}\};/u
  .exec(sessionSource)?.[0] ?? '';
assert.match(
  legacyVerificationExecutionHelper,
  /runAgentVerificationExecution\(/u,
  'Legacy Session verification adapter must call the Runtime execution interface.',
);
assert.doesNotMatch(
  legacyVerificationExecutionHelper,
  /createAgentSessionV2PostApprovalVerificationCommand|buildAgentPermissionRoute\(verificationCommand\)|verificationBudgetStopReason|runAgentToolTransaction\(|taskTransition:\s*\{\s*kind:\s*['"]verification-/u,
  'Legacy Session must not own verification command, permission, budget, transaction, or lifecycle transitions.',
);
assert.doesNotMatch(
  sessionSource,
  /function (?:resolveAgentSessionV2PostApprovalVerificationQuery|shouldRunAgentSessionV2PostApprovalVerification|createAgentSessionV2PostApprovalVerificationCommand)/u,
  'Legacy Session must not restore verification selection or command construction.',
);
assert.match(
  verificationOutcomeRuntimeSource,
  /transitionAgentVerificationOutcome[\s\S]*evaluateAgentActionRuntime[\s\S]*terminalEvaluation[\s\S]*resolveVisualApproval[\s\S]*decideVerificationRecovery/u,
  'Verification outcome transition must prioritize terminal evidence, then approval, then recovery.',
);
assert.match(
  verificationOutcomeRuntimeSource,
  /automatic-observation[\s\S]*kind:\s*['"]target-resolution['"][\s\S]*action === ['"]wait['"][\s\S]*kind:\s*['"]recovery['"]/u,
  'Verification outcome transition must map missing coverage to target resolution and waiting state to recovery.',
);
assert.match(
  legacyVerificationExecutionHelper,
  /runAgentVerificationContinuation<AgentRuntimeResult>\(/u,
  'Legacy Session must enter the combined Runtime verification transition-and-dispatch interface.',
);
assert.doesNotMatch(
  legacyVerificationExecutionHelper,
  /const postApprovalActionRuntimeDecision = evaluateAgentActionRuntime|const postApprovalRecoveryTrigger = decideRecoveryTrigger|const visualActionApproval = resolveAgentSessionV2VisualActionApproval/u,
  'Legacy Session must not independently select verification terminal, approval, or recovery outcomes.',
);
assert.match(
  continuationDispatcherSource,
  /selectAgentRuntimeContinuationAdapterKind[\s\S]*case 'planning':[\s\S]*case 'verification':[\s\S]*dispatchAgentRuntimeContinuation[\s\S]*options\.adapters\[adapterKind\]/u,
  'Runtime continuation dispatcher must own selection of terminal, approval, planning, target-resolution, recovery, refinement, and verification adapters.',
);
assert.match(
  commandExecutionRuntimeSource,
  /runAgentCommandExecution[\s\S]*buildAgentPermissionRoute\(command\)[\s\S]*getBudgetStopReason\(1\)[\s\S]*runAgentToolTransaction/u,
  'Command Execution Runtime must own permission, budget, and Tool Transaction dispatch for normalized commands.',
);
const productionModelCommandExecutionHelper = readModuleProjectFile('src/agent/productionSession/singleToolExecution.ts');
assert.match(sessionSource, /from '\.\/productionSession\/singleToolExecution'/u);
assert.match(sessionSource, /createAgentProductionSingleToolExecution\(\{/u);
assert.match(sessionSource, /await executeSingleToolCommand\(\{/u);
assert.match(sessionSource, /const command = createAgentToolCommand\(\{/u);
assert.match(
  productionModelCommandExecutionHelper,
  /runAgentCommandExecution\(/u,
  'Production Session model-selected commands must enter through Command Execution Runtime.',
);
assert.doesNotMatch(
  productionModelCommandExecutionHelper,
  /buildAgentPermissionRoute\(command\)|getBudgetStopReason\(1\)|runAgentToolTransaction\(/u,
  'Production Session must not restore permission, budget, or transaction ownership in the model single-tool path.',
);
assert.match(
  legacyVerificationExecutionHelper,
  /runAgentVerificationContinuation<AgentRuntimeResult>\(/u,
  'Legacy Session verification must submit evidence and Adapters through the combined Runtime interface.',
);
assert.doesNotMatch(
  sessionSource,
  /transitionAgentVerificationOutcome\(|verificationOutcomeTransition\.kind\s*===|verificationOutcomeTransition\.kind\s*!==/u,
  'Legacy Session must not select or branch on Runtime verification continuation kinds.',
);
assert.match(
  continuationDispatcherSource,
  /runAgentVerificationContinuation[\s\S]*transitionAgentVerificationOutcome\(options\)[\s\S]*dispatchAgentRuntimeContinuation\([\s\S]*decideAgentTaskRuntimeLoopContinuation\(\{ dispatch \}\)/u,
  'Runtime must select, dispatch, and decide loop continuation for verification through one production interface.',
);
assert.match(
  approvedActionOutcomeRuntimeSource,
  /transitionAgentApprovedActionOutcome[\s\S]*terminalEvaluation[\s\S]*options\.approval[\s\S]*stop-needs-user[\s\S]*failed-action[\s\S]*selectAgentTaskRuntimeNextTransition[\s\S]*kind: 'verification'/u,
  'Approved Action Outcome Runtime must own the single continuation priority after approved execution.',
);
const productionExecutionPreflightSource = readModuleProjectFile('src/agent/productionSession/executionPreflight.ts');
assert.match(sessionSource, /from '\.\/productionSession\/executionPreflight'/u);
assert.match(sessionSource, /createAgentProductionExecutionPreflight\(\{/u);
assert.match(sessionSource, /prepareExecutionPreflight\(\{/u);
assert.match(productionExecutionPreflightSource, /resolveAgentWindowTargetBeforeDispatch\(\{/u);
assert.match(productionExecutionPreflightSource, /createAgentVisibleClickActionablePreflightCommand\(\{/u);
assert.doesNotMatch(productionExecutionPreflightSource, /runAgentCommandExecution|buildAgentPermissionRoute|let modelOutputRepairRuns/u);
const productionSingleToolSelectionSource = readModuleProjectFile('src/agent/productionSession/singleToolSelection.ts');
assert.match(sessionSource, /from '\.\/productionSession\/singleToolSelection'/u);
assert.match(sessionSource, /createAgentProductionSingleToolSelection\(\{/u);
assert.match(sessionSource, /prepareSingleToolSelection\(decision, stepIndex\)/u);
assert.match(productionSingleToolSelectionSource, /prepareAgentDecisionToolInput\(\{/u);
assert.doesNotMatch(productionSingleToolSelectionSource, /runAgentCommandExecution|executeAgentSessionV2ToolCommandWithCache|let modelOutputRepairRuns/u);
const productionParallelPreparationSource = readModuleProjectFile('src/agent/productionSession/parallelPreparation.ts');
assert.match(sessionSource, /from '\.\/productionSession\/parallelPreparation'/u);
assert.match(sessionSource, /createAgentProductionParallelPreparation\(\{/u);
assert.match(sessionSource, /prepareParallelSelection\(decision, stepIndex\)/u);
assert.match(productionParallelPreparationSource, /prepareAgentParallelToolCommands\(\{/u);
assert.doesNotMatch(productionParallelPreparationSource, /executeAgentSessionV2ToolCommandWithCache|runAgentParallelToolTransaction|let modelOutputRepairRuns/u);
const productionParallelExecutionSource = readModuleProjectFile('src/agent/productionSession/parallelExecution.ts');
assert.match(sessionSource, /from '\.\/productionSession\/parallelExecution'/u);
assert.match(sessionSource, /createAgentProductionParallelExecution\(\{/u);
assert.match(sessionSource, /await executeParallelBatch\(\{/u);
assert.match(productionParallelExecutionSource, /runAgentToolOutcomeContinuation<AgentRuntimeResult>\(/u);
assert.match(productionParallelExecutionSource, /parallelContinuationDispatch\.loopDecision/u);
assert.doesNotMatch(productionParallelExecutionSource, /transitionAgentToolOutcome\(|parallelContinuationDispatch\.(?:finalResult|executed|adapterKind)/u);
const legacyApprovedResultHelper = readModuleProjectFile('src/agent/productionSession/approvedResultContinuation.ts');
assert.match(sessionSource, /from '\.\/productionSession\/approvedResultContinuation'/u);
assert.match(sessionSource, /createAgentProductionApprovedResultContinuation\(\{/u);
assert.match(sessionSource, /await executeApprovedResultContinuation\(approvedToolResult\)/u);
assert.match(
  legacyApprovedResultHelper,
  /runAgentApprovedActionContinuation<AgentRuntimeResult>\(/u,
  'Legacy Session approved-result handling must enter the combined Runtime transition-and-dispatch interface.',
);
assert.doesNotMatch(
  legacyApprovedResultHelper,
  /transitionAgentApprovedActionOutcome\(|transition:\s*approvedOutcomeTransition/u,
  'Legacy Session must not select or manually submit the approved-action continuation transition.',
);
assert.match(
  continuationDispatcherSource,
  /runAgentApprovedActionContinuation[\s\S]*transitionAgentApprovedActionOutcome\(options\)[\s\S]*dispatchAgentRuntimeContinuation\([\s\S]*decideAgentTaskRuntimeLoopContinuation\(\{ dispatch \}\)/u,
  'Runtime must select, dispatch, and decide loop continuation for approved actions through one production interface.',
);
assert.doesNotMatch(
  legacyApprovedResultHelper,
  /approvedRecoveryTrigger\.action\s*===|runtimeNextSubgoalAction\s*===|const postApprovalVerification = await/u,
  'Legacy Session approved-result handling must not independently select locate, recovery, or verification continuations.',
);
const legacyAutoRecoveryObservationStart = sessionSource.indexOf(
  'const executeAutoRecoveryObservation = async',
);
const legacyAutoRecoveryObservationEnd = sessionSource.indexOf(
  'const executeAutoRecoveryLoop = async',
  legacyAutoRecoveryObservationStart,
);
const legacyAutoRecoveryObservationHelper = (
  legacyAutoRecoveryObservationStart >= 0 && legacyAutoRecoveryObservationEnd >= 0
)
  ? sessionSource.slice(legacyAutoRecoveryObservationStart, legacyAutoRecoveryObservationEnd)
  : '';
assert.match(sessionSource, /from '\.\/productionSession\/autoRecoveryExecution'/u);
assert.match(sessionSource, /createAgentProductionAutoRecoveryExecution\(\{/u);
assert.match(
  legacyAutoRecoveryObservationHelper,
  /runAgentVerificationContinuation<AgentRuntimeResult>\(/u,
  'Recovery-collected evidence must re-enter the combined Runtime verification continuation interface.',
);
assert.doesNotMatch(
  legacyAutoRecoveryObservationHelper,
  /latestVerificationRecoveryTrigger\.action\s*===/u,
  'Legacy automatic recovery must not independently select the next continuation from recovered evidence.',
);
assert.match(
  toolOutcomeRuntimeSource,
  /transitionAgentToolOutcome[\s\S]*terminalEvaluation[\s\S]*visualApproval[\s\S]*if \(options\.approvalReadyApproval\)[\s\S]*structuredEvidence\?\.postActionRecovery[\s\S]*if \(options\.refinementAvailable\)[\s\S]*options\.recoveryEnabled[\s\S]*kind: 'planning'/u,
  'Tool Outcome Runtime must prioritize terminal, actionable visual approval, explicit approval-ready follow-up, recovery/refinement, and planning.',
);
assert.match(
  toolOutcomeRuntimeSource,
  /structuredEvidence\?\.postActionRecovery[\s\S]*recoveryMode: 'automatic-observation'[\s\S]*if \(options\.refinementAvailable\)/u,
  'Explicit structured recovery must outrank visual refinement and select its Runtime recovery mode.',
);
assert.match(
  sessionSource,
  /'recoveryMode' in transition && transition\.recoveryMode === 'failed-action'/u,
  'Legacy Session recovery Adapter must execute the recovery mode selected by Tool Outcome Runtime.',
);
const legacySingleToolOutcomeHelper = readModuleProjectFile('src/agent/productionSession/singleToolResultContinuation.ts');
assert.match(sessionSource, /from '\.\/productionSession\/singleToolResultContinuation'/u);
assert.match(sessionSource, /const \{ executeSingleToolResultContinuation \} = createAgentProductionSingleToolResultContinuation\(\{/u);
assert.match(sessionSource, /await executeSingleToolResultContinuation\(\{/u);
assert.match(
  legacySingleToolOutcomeHelper,
  /runAgentToolOutcomeContinuation<AgentRuntimeResult>\(/u,
  'Single-tool results must enter the combined Runtime Tool Outcome transition-and-dispatch interface.',
);
assert.doesNotMatch(
  legacySingleToolOutcomeHelper,
  /immediateVisualApprovalResult|const visualRefinement = await|recoveryTrigger\.action\s*===|const visualActionApproval =/u,
  'Single-tool results must not restore duplicate approval, refinement, or recovery selection branches.',
);
const legacyParallelOutcomeHelper = productionParallelExecutionSource;
assert.match(
  legacyParallelOutcomeHelper,
  /runAgentToolOutcomeContinuation<AgentRuntimeResult>\([\s\S]*recoveryEnabled: false/u,
  'Parallel read-only results must use Tool Outcome Runtime without starting per-result recovery.',
);
assert.doesNotMatch(
  sessionSource,
  /transitionAgentToolOutcome\(|toolOutcomeTransition|parallelOutcomeTransition/u,
  'Legacy Session must not select or manually submit Tool Outcome transitions.',
);
assert.match(
  continuationDispatcherSource,
  /runAgentToolOutcomeContinuation[\s\S]*transitionAgentToolOutcome\(options\)[\s\S]*dispatchAgentRuntimeContinuation\([\s\S]*decideAgentTaskRuntimeLoopContinuation\(\{ dispatch \}\)/u,
  'Runtime must select, dispatch, and decide loop continuation for Tool Outcomes through one production interface.',
);
assert.match(
  taskRuntimeSource,
  /decideAgentTaskRuntimeLoopContinuation[\s\S]*action: 'return-final'[\s\S]*action: 'continue-runtime'[\s\S]*action: 'request-planning'/u,
  'Task Runtime must own final, deterministic-continuation, and planning loop decisions.',
);
assert.match(
  taskRuntimeSource,
  /authorizeAgentTaskRuntimeModelIteration[\s\S]*iteration >= limit[\s\S]*request\.cancellationRequested[\s\S]*iteration \+ 1/u,
  'Task Runtime must authorize persisted outer-loop iteration, limit, and cancellation gates in order.',
);
assert.match(runtimeContractSource, /modelIterationCount:\s*number[\s\S]*modelIterationLimit:\s*number/u);
assert.doesNotMatch(
  sessionSource,
  /for \(let runStepIndex = 1; runStepIndex <= maxSteps; runStepIndex \+= 1\)|createAgentTaskRuntimeModelLoopState|transitionAgentTaskRuntimeModelLoop/u,
  'Legacy Session must not own or construct outer model-loop state.',
);
assert.match(
  sessionSource,
  /requestModelIteration\(\{[\s\S]*requestedLimit: maxSteps[\s\S]*taskState[\s\S]*action === 'stop-limit'[\s\S]*action === 'stop-cancelled'/u,
  'Legacy Session must request and consume the persisted Task Runtime model-loop authorization.',
);
assert.doesNotMatch(
  legacySingleToolOutcomeHelper,
  /toolContinuationDispatch\.(?:finalResult|executed|adapterKind)/u,
  'Legacy Session must consume the Task Runtime loop decision instead of interpreting Tool Outcome dispatch fields.',
);
assert.match(
  legacySingleToolOutcomeHelper,
  /toolContinuationDispatch\.loopDecision[\s\S]*action === 'return-final'[\s\S]*action === 'continue-runtime'/u,
  'Legacy Session must adapt the Task Runtime Tool Outcome loop decision.',
);
assert.doesNotMatch(
  sessionSource,
  /(?:approvedContinuationDispatch|recoveryContinuationDispatch|continuationDispatch|parallelContinuationDispatch|toolContinuationDispatch)\.(?:finalResult|executed|adapterKind)/u,
  'Legacy Session must not derive loop control directly from Runtime continuation dispatch fields.',
);
for (const outcomePath of [
  'recoveryContinuationDispatch', 'continuationDispatch', 'approvedContinuationDispatch',
  'parallelContinuationDispatch', 'toolContinuationDispatch',
]) {
  assert.match(
    sessionSource,
    new RegExp(`${outcomePath}\\.loopDecision`, 'u'),
    `${outcomePath} must consume Task Runtime Loop Continuation Decisions.`,
  );
}
assert.match(
  approvalContinuationRuntimeSource,
  /status: 'in_progress'[\s\S]*status: 'dispatched'[\s\S]*status: 'blocked'/u,
  'Runtime approved-action lifecycle must own subgoal execution status.',
);
assert.doesNotMatch(
  controllerSource,
  /subgoals\s*:/u,
  'UI Controller must not write Task Runtime subgoal state.',
);
assert.doesNotMatch(
  sessionSource,
  /subgoals\s*:/u,
  'Legacy Session must not write Task Runtime subgoal state.',
);
assert.match(
  taskRuntimeSource,
  /lastRejectedTransitionKind:[\s\S]*lastTransitionError:[\s\S]*phase: previous\.phase[\s\S]*state: previous\.state/u,
  'Invalid lifecycle transitions must preserve production state and record rejection evidence.',
);
assert.match(
  taskRuntimeSource,
  /createAgentTaskRuntimeStateRecord[\s\S]*transitionAgentTaskRuntimeState\(/u,
  'Final Runtime results must commit through the Task Runtime transition interface.',
);
assert.match(
  taskRuntimeSource,
  /authorizeAgentTaskRuntimeRecovery[\s\S]*transitionAgentTaskRuntimeState\(/u,
  'Recovery authorization must commit through the Task Runtime transition interface.',
);
assert.match(
  taskRuntimeSource,
  /advanceAgentTaskRuntimeProgress[\s\S]*transitionAgentTaskRuntimeState\(/u,
  'Progress must commit through the Task Runtime transition interface.',
);
assert.match(taskRuntimeSource, /if \(event\.taskPhase\)[\s\S]*return event\.taskPhase/u);
assert.match(taskRuntimeSource, /options\.event\.taskTransition[\s\S]*type: 'lifecycle'/u);
assert.match(verificationRuntimeSource, /taskTransition:\s*\{ kind: 'verification-started' \}/u);
assert.match(recoveryExecutionRuntimeSource, /taskTransition:\s*\{ kind: 'recovery-started' \}/u);
assert.match(targetResolutionExecutionSource, /taskTransition:\s*\{ kind: 'target-resolution-started' \}/u);
assert.match(visualRefinementExecutionRuntimeSource, /taskTransition:\s*\{ kind: 'target-resolution-started' \}/u);
assert.match(verificationRuntimeSource, /from '\.\/agentExecutionProgressSignals'/u);
assert.match(recoveryExecutionRuntimeSource, /from '\.\/agentExecutionProgressSignals'/u);
assert.match(visualRefinementExecutionRuntimeSource, /from '\.\/agentExecutionProgressSignals'/u);
assert.doesNotMatch(
  sessionSource,
  /taskPhase:/u,
  'Legacy Session may report lifecycle facts but must not assign production Task Runtime phases.',
);
assert.match(recoveryExecutionRuntimeSource, /options\.authorizeRecovery\?\.\(\{/u);
assert.match(sessionSource, /proposeAgentRecovery\(\{/u);
assert.match(
  recoveryExecutionRuntimeSource,
  /runAgentRecoveryExecution[\s\S]*buildAgentPermissionRoute\(command\)[\s\S]*authorizeRecovery[\s\S]*getBudgetStopReason\(1\)[\s\S]*runAgentToolTransaction/u,
  'Recovery Execution Runtime must own permission, Task Runtime authorization, budget, and Tool Transaction dispatch.',
);
assert.match(
  visualRefinementExecutionRuntimeSource,
  /runAgentVisualRefinementExecution[\s\S]*buildAgentPermissionRoute\(command\)[\s\S]*getBudgetStopReason\(1\)[\s\S]*runAgentToolTransaction/u,
  'Visual Refinement Execution Runtime must own permission, budget, and Tool Transaction dispatch.',
);
assert.match(sessionSource, /runAgentRecoveryExecution\(/u);
assert.match(sessionSource, /runAgentVisualRefinementExecution\(/u);
assert.doesNotMatch(
  sessionSource,
  /runAgentToolTransaction\(/u,
  'Legacy Session must not directly dispatch Tool Transactions after command, target, verification, recovery, and refinement execution migration.',
);
assert.doesNotMatch(
  sessionSource,
  /requestRecoveryAuthorization|getBudgetStopReason\(1\)/u,
  'Legacy Session must not restore recovery authorization or single-tool budget ownership.',
);
assert.doesNotMatch(
  sessionSource,
  /createAgentSessionV2(?:AutoRecoveryObservation|FailedDesktopActionRecovery)Command/u,
  'Session must request recovery through Recovery Controller instead of constructing recovery commands directly.',
);
assert.match(recoveryControllerSource, /status:\s*['"]rejected['"]/u);
assert.match(recoveryControllerSource, /AGENT_RECOVERY_READ_ONLY_TOOLS/u);
assert.match(recoveryControllerSource, /transitionAgentRecoveryLoop/u);
assert.match(recoveryControllerSource, /decideAgentRecoveryTrigger/u);
assert.match(recoveryControllerSource, /stop-no-new-evidence/u);
assert.doesNotMatch(
  sessionSource,
  /AGENT_SESSION_V2_AUTO_RECOVERY_LOOP_MAX_RUNS/u,
  'Session must not own the automatic recovery loop limit.',
);
assert.match(sessionSource, /transitionAgentRecoveryLoop\(/u);
const productionActionOutcomeLifecycleSource = readModuleProjectFile('src/agent/productionSession/actionOutcomeLifecycle.ts');
assert.match(sessionSource, /from '\.\/productionSession\/actionOutcomeLifecycle'/u);
assert.match(sessionSource, /createAgentProductionActionOutcomeLifecycle\(\{/u);
assert.match(sessionSource, /recordActionRuntimeDecision, recordRecoveryTriggerDecision, decideRecoveryTrigger,[\s\S]*\} = createAgentProductionActionOutcomeLifecycle\(\{/u);
assert.match(productionActionOutcomeLifecycleSource, /decideAgentRecoveryTrigger\(/u);
assert.match(sessionSource, /decideAgentRecoveryTrigger\(/u);
assert.doesNotMatch(
  sessionSource,
  /ActionRuntimeDecision\.status === ['"](?:failed|needs-recovery|waiting)['"]/u,
  'Session must consume Recovery Controller trigger decisions instead of selecting recovery from lifecycle status.',
);
assert.doesNotMatch(
  recoveryControllerSource,
  /AgentSessionV[23]|agentSessionV[23]|LegacyV2/u,
  'Recovery Controller must remain version-neutral.',
);
assert.match(sessionSource, /createAgentDesktopRecoveryCapabilityAdapter\(/u);
assert.match(sessionSource, /createAgentVisualRefinementCommand\(/u);
assert.doesNotMatch(
  sessionSource,
  /createAgentRecoveryLegacyV2Adapter|function createAgentSessionV2VisualRefinementCommand/u,
  'Legacy Session must consume Capability Adapters instead of owning recovery/refinement command construction.',
);
for (const [label, source] of [
  ['Desktop Recovery Capability Adapter', desktopRecoveryCapabilitySource],
  ['Desktop Recovery Observation Builder', desktopRecoveryObservationSource],
  ['Desktop Recovery Command Builder', desktopRecoveryCommandSource],
  ['Visual Refinement Capability Adapter', visualRefinementCapabilitySource],
]) {
  assert.doesNotMatch(
    source,
    /from ['"][^'"]*agentSessionV[23]|AgentSessionV[23]ToolResultEntry|from ['"][^'"]*\/legacy\//u,
    `${label} must not depend on versioned Session or Legacy implementation modules.`,
  );
}
assert.match(
  sessionSource,
  /kind:\s*['"]failed-action['"][\s\S]*executeFailedDesktopActionRecoveryObservation/u,
  'Failed-action recovery must request Task Runtime authorization before execution.',
);
assert.match(
  sessionSource,
  /kind:\s*['"]automatic-observation['"][\s\S]*executeAutoRecoveryObservation/u,
  'Automatic observation recovery must request Task Runtime authorization before execution.',
);
assert.match(productionSessionSource, /authorizeRecovery:\s*runtimeContext\.authorizeRecovery/u);
assert.match(productionSessionSource, /authorizeModelIteration:\s*runtimeContext\.authorizeModelIteration/u);
assert.doesNotMatch(
  taskRuntimeSource,
  /AgentSessionV[23]|agentSessionV[23]|LegacyVersionAdapter/u,
  'Production Task Runtime state ownership must remain version-neutral.',
);
assert.doesNotMatch(
  runtimeContractSource,
  /AgentRuntimeResult<Debug|debug\?:\s*Debug/u,
  'The active Runtime result contract must not expose an unscoped debug payload.',
);
assert.match(runtimeContractSource, /authority:\s*['"]diagnostic-only['"]/u);
assert.match(runtimeContractSource, /diagnostics\?: AgentRuntimeDiagnosticEnvelope\[\]/u);
assert.doesNotMatch(
  sessionSource,
  /type:\s*['"]runtime_shadow['"]\s+as const/u,
  'New Session results must not append Runtime diagnostics to the active trace.',
);
assert.doesNotMatch(
  controllerSource,
  /type:\s*['"]runtime_shadow['"]/u,
  'The Controller must write approval diagnostics through the diagnostic envelope.',
);
assert.doesNotMatch(
  evidenceEngineSource,
  /assessment\?\.status === ['"]completed['"]/u,
  'A tool-level ResultAssessment must not authorize task completion by itself.',
);
const productionFinalResponseSource = readModuleProjectFile('src/agent/productionSession/finalResponse.ts');
assert.match(sessionSource, /from '\.\/productionSession\/finalResponse'/u);
assert.match(sessionSource, /const \{ prepareFinalResponse \} = createAgentProductionFinalResponse\(\{/u);
assert.match(sessionSource, /decision\.action === 'final_answer' \|\| decision\.action === 'ask_user'[\s\S]*prepareFinalResponse\(decision, stepIndex/u);
for (const [label, source] of [
  ['V2 final answer', productionFinalResponseSource],
  ['V2 post-action terminal', postActionTerminalSource],
]) {
  assert.match(
    source,
    /evaluateAgentEvidenceTerminal\(/gu,
    `${label} must obtain terminal authorization from the Evidence Engine.`,
  );
}
assert.match(
  productionFinalResponseSource,
  /rejected final answer without Evidence Engine authorization/gu,
  'Direct-action final answers must stop when the Evidence Engine rejects completion.',
);

const actionRuntimeSource = readFileSync(
  join(process.cwd(), 'src', 'agent', 'agentActionRuntime.ts'),
  'utf8',
);
assert.doesNotMatch(
  actionRuntimeSource,
  /agentSessionV2PostActionTerminalEvaluator|from ['"]\.\/agentSessionV2['"]/gu,
  'ActionRuntime must depend on the Evidence terminal interface, not a V2 implementation.',
);
assert.match(actionRuntimeSource, /dependencies\.evaluateTerminal\(/gu);

for (const relativePath of [
  'src/agent/runtime/agentActionCoverage.ts',
  'src/agent/runtime/agentPostActionTerminalEvaluator.ts',
  'src/agent/runtime/agentPostActionStateResolver.ts',
]) {
  const source = readFileSync(join(process.cwd(), relativePath), 'utf8');
  assert.doesNotMatch(
    source,
    /from ['"]\.\/agentSessionV2['"]/gu,
    `Runtime Evidence modules must consume version-neutral ToolResult contracts: ${relativePath}`,
  );
}

assert.match(sessionSource, /from ['"]\.\/runtime\/agentActionCoverage['"]/u);

console.log('agent runtime architecture guard ok');
