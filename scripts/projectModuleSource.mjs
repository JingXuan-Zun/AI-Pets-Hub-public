import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const moduleDirectories = new Map([
  ['src/agent/planning/agentResourcePlans.ts', 'src/agent/planning'],
  ['src/agent/desktopObservation/windowUiInspection.ts', 'src/agent/desktopObservation'],
  ['src/agent/runtime/agentTargetResolutionContext.ts', 'src/agent/runtime/targetResolution'],
  ['src/agent/runtime/agentRuntimeTaskEvidence.ts', 'src/agent/runtime/taskEvidence'],
  ['src/agent/planning/agentDesktopObservationPlans.ts', 'src/agent/planning'],
  ['src/agent/planning/agentDesktopActionPlans.ts', 'src/agent/planning'],
  ['src/agent/runtime/agentTaskRuntime.ts', 'src/agent/runtime/taskRuntime'],
  ['src/agent/desktopSequence/sequenceExecution.ts', 'src/agent/desktopSequence'],
  ['src/agent/resultAssessment/resultEvidenceAssessment.ts', 'src/agent/resultAssessment'],
  ['src/agent/capabilities/recoveryObservation/recoveryObservationBudget.ts', 'src/agent/capabilities/recoveryObservation'],
  ['src/agent/desktopObservation/windowAppObservation.ts', 'src/agent/desktopObservation'],
  ['src/agent/agentChatContext.ts', 'src/agent/chatContext'],
  ['src/agent/desktopTools/windowUiInteraction.ts', 'src/agent/desktopTools'],
  ['src/agent/runtime/agentApprovedDispatchResolution.ts', 'src/agent/runtime/approvedDispatch'],
  ['src/agent/runtime/agentApprovalContinuationRuntime.ts', 'src/agent/runtime/approvalContinuation'],
  ['src/agent/productionSession/visualApproval.ts', 'src/agent/productionSession'],
  ['src/agent/agentRuntimeCore.ts', 'src/agent/runtimeCore'],
  ['src/agent/productionSession/visualCandidateEvidence.ts', 'src/agent/productionSession'],
  ['src/agent/planner/plannerCommandNormalization.ts', 'src/agent/planner'],
  ['src/agent/agentExecutionStrategy.ts', 'src/agent/executionStrategy'],
  ['src/agent/desktopSequence/sequenceVerification.ts', 'src/agent/desktopSequence'],
  ['src/agent/agentRuntimeWindowTools.ts', 'src/agent/windowTools'],
  ['src/agent/desktopIconArrangementPlan.ts', 'src/agent/iconArrangement'],
  ['src/agent/runtime/agentActionCoverage.ts', 'src/agent/runtime/actionCoverage'],
  ['src/agent/agentRuntimeExecutor.ts', 'src/agent/executor'],
  ['src/agent/agentToolInputSchema.ts', 'src/agent/inputSchema'],
  ['src/agent/agentProductionSessionImplementation.ts', 'src/agent/productionSession'],
  ['src/agent/capabilities/agentVisualRefinementCapabilityAdapter.ts', 'src/agent/capabilities/visualRefinement'],
  ['src/agent/agentRuntimeSystemTools.ts', 'src/agent/systemTools'],
  ['src/agent/agentRuntimeLocalFileTools.ts', 'src/agent/localFiles'],
  ['src/agent/capabilities/agentDesktopRecoveryObservationBuilder.ts', 'src/agent/capabilities/recoveryObservation'],
  ['src/agent/agentPlanner.ts', 'src/agent/planner'],
  ['src/agent/agentResultAssessment.ts', 'src/agent/resultAssessment'],
  ['src/agent/agentRuntimeDesktopSequenceTools.ts', 'src/agent/desktopSequence'],
  ['src/agent/agentRuntimeDesktopObservationTools.ts', 'src/agent/desktopObservation'],
  ['src/agent/agentRuntimeDesktopTools.ts', 'src/agent/desktopTools'],
  ['src/agent/agentOrchestrator.ts', 'src/agent/planning'],
  ['electron/captureService.cjs', 'electron/capture'],
  ['src/components/chat/PetChatConversationMessageBubble.tsx', 'src/components/chat/message'],
  ['src/agent/agentRuntimeVisualTools.ts', 'src/agent/visual'],
  ['electron/appLauncherService.cjs', 'electron/appLauncher'],
  ['src/components/chat/agentRunController.ts', 'src/components/chat/runController'],
  ['electron/windowManager.cjs', 'electron/windowManager'],
  ['electron/desktopIconService.cjs', 'electron/desktopIcons'],
  ['src/components/pet/PetLive2DRenderer.tsx', 'src/components/pet/live2dRenderer'],
  ['src/components/pet/usePetContainerShellEffects.ts', 'src/components/pet/petContainerShell'],
]);

// Only follow modules reachable from each entry within its implementation
// directory. Detached code must not satisfy source architecture checks.
export function readModuleProjectFile(relativePath, rootDir = process.cwd()) {
  const normalized = relativePath.replaceAll('\\', '/');
  const directory = moduleDirectories.get(normalized);
  if (!directory) return readFileSync(path.resolve(rootDir, relativePath), 'utf8');
  const boundary = path.resolve(rootDir, directory) + path.sep;
  const visited = new Set();
  const sources = [];
  function visit(file) {
    if (visited.has(file)) return;
    visited.add(file);
    const text = readFileSync(file, 'utf8');
    sources.push(text);
    const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    const specifiers = [];
    function collect(node) {
      if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
        && ts.isStringLiteral(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text);
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require'
        && node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) specifiers.push(node.arguments[0].text);
      ts.forEachChild(node, collect);
    }
    collect(source);
    for (const specifier of specifiers) {
      if (!specifier.startsWith('.')) continue;
      const target = path.resolve(path.dirname(file), specifier);
      if (!target.startsWith(boundary)) continue;
      const resolved = [target, ...['.ts', '.tsx', '.cjs'].map(extension => target + extension)].find(existsSync);
      if (!resolved) throw new Error(`Missing implementation module: ${specifier}`);
      visit(resolved);
    }
  }
  visit(path.resolve(rootDir, relativePath));
  return sources.join('\n');
}

export function readModuleProjectSources(sources) {
  return Object.fromEntries(Object.entries(sources).map(([key, file]) => [key, readModuleProjectFile(file)]));
}

export function readModuleProjectFunction(relativePath, functionName) {
  const text = readModuleProjectFile(relativePath);
  const source = ts.createSourceFile(relativePath, text, ts.ScriptTarget.Latest, true);
  const declaration = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === functionName);
  if (!declaration) throw new Error(`Missing JavaScript/TypeScript function ${functionName}: ${relativePath}`);
  return declaration.getText(source);
}
