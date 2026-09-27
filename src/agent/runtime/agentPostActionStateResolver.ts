import {
  type AgentRuntimeToolResultEntry,
} from './agentRuntimeContract';
import {
  type AgentEvidencePostActionStateResolverDependencies,
  resolveAgentEvidencePostActionState,
  resolveAgentEvidenceStructuredEvidence,
} from './agentEvidenceEngine';
import { resolveAgentTargetInteractionVerification } from './agentRuntimeVerificationEvidence';

export type AgentPostActionStateResolverDependencies = AgentEvidencePostActionStateResolverDependencies;

function normalizeAgentPostActionSearchText(value: unknown) {
  return typeof value === 'string'
    ? value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
    : '';
}

export function resolveAgentDesktopTargetPresence(
  entry: AgentRuntimeToolResultEntry | null,
) {
  const presence = resolveAgentEvidenceStructuredEvidence(entry)?.desktopTargetPresence;
  return typeof presence === 'string' ? presence.trim().toLowerCase() : '';
}

export function inferAgentSelectionPostActionStateFromStructuredEvidence(
  entry: AgentRuntimeToolResultEntry | null,
) {
  const evidence = resolveAgentEvidenceStructuredEvidence(entry);
  if (!evidence) {
    return '';
  }

  const targetInteractionVerification = resolveAgentTargetInteractionVerification(evidence);
  if (
    targetInteractionVerification?.detailMatchesTarget === false
    || (
      targetInteractionVerification?.targetSelected === false
      && targetInteractionVerification.currentSelection
      && targetInteractionVerification.targetMatched
    )
  ) {
    return 'selection_mismatch';
  }
  if (
    targetInteractionVerification?.targetVisible === true
    && targetInteractionVerification.targetSelected === false
  ) {
    return 'visible_only';
  }
  if (targetInteractionVerification?.status === 'needs-target-selection' && targetInteractionVerification.targetMatched) {
    return targetInteractionVerification.currentSelection ? 'selection_mismatch' : 'visible_only';
  }

  const selectionStatus = typeof evidence.selectionVerificationStatus === 'string'
    ? evidence.selectionVerificationStatus.trim().toLowerCase()
    : '';
  if (selectionStatus === 'mismatch') {
    return 'selection_mismatch';
  }
  if (selectionStatus === 'visible-only' || selectionStatus === 'visible_only') {
    return 'visible_only';
  }

  const targetText = normalizeAgentPostActionSearchText(evidence.targetMatched);
  const currentSelectionText = normalizeAgentPostActionSearchText(evidence.currentSelection);
  if (
    targetText
    && currentSelectionText
    && !targetText.includes(currentSelectionText)
    && !currentSelectionText.includes(targetText)
  ) {
    return 'selection_mismatch';
  }

  if (evidence.visualActionReadiness === 'needs-target-selection' && targetText) {
    return 'visible_only';
  }

  return '';
}

export function hasAgentUnverifiedPostActionSignal(options: {
  dependencies: Pick<AgentPostActionStateResolverDependencies, 'collectAutoRecoveryEvidenceText'>;
  entry: AgentRuntimeToolResultEntry;
}) {
  const { dependencies, entry } = options;
  if (
    entry.result.receipt?.status === 'unverified'
    || entry.result.assessment?.status === 'unverified'
    || Boolean(entry.result.stateSummary?.missingEvidence?.length)
    || Boolean(entry.result.stateSummary?.recommendedRecovery?.length)
  ) {
    return true;
  }

  const evidenceText = dependencies.collectAutoRecoveryEvidenceText(entry).normalize('NFKC').toLowerCase();
  return /(?:not\s+(?:confirmed|verified|visible|open|launched|selected)|unconfirmed|unverified|inconclusive|unknown|visible[-\s]?only|selection[_\s-]?mismatch|no\s+(?:evidence|target|window|selection)|still\s+(?:visible|focused|on)|\u672a(?:\u786e\u8ba4|\u9a8c\u8bc1|\u6253\u5f00|\u542f\u52a8|\u9009\u4e2d)|\u6ca1\u6709.{0,24}(?:\u8bc1\u636e|\u7a97\u53e3|\u542f\u52a8|\u6253\u5f00|\u9009\u4e2d)|\u4ecd\u7136.{0,24}(?:\u505c\u7559|\u663e\u793a|\u805a\u7126))/iu.test(evidenceText);
}

export function inferAgentPostActionStateFromEvidence(options: {
  dependencies: Pick<AgentPostActionStateResolverDependencies, 'collectAutoRecoveryEvidenceText'>;
  entry: AgentRuntimeToolResultEntry | null;
}) {
  const text = options.entry
    ? options.dependencies.collectAutoRecoveryEvidenceText(options.entry).normalize('NFKC').toLowerCase()
    : '';
  if (!text) {
    return '';
  }

  if (/(?:selection[_\s-]?mismatch|selected\s+(?:item|target)\s+(?:is|remains|still)\s+(?:not|different|wrong)|current\s+(?:selection|detail|page|title)\s+(?:is|remains|still)\s+(?:not|different|wrong))/iu.test(text)) {
    return 'selection_mismatch';
  }

  if (/(?:visible[-\s]?only|visible\s+but\s+not\s+(?:selected|current)|target\s+(?:is\s+)?(?:visible|shown)\s+but\s+not\s+(?:selected|current)|not\s+selected)/iu.test(text)) {
    return 'visible_only';
  }

  const hasNegatedError = /(?:no|without|not\s+(?:visible|shown|present)|absent|missing|cannot\s+see|can't\s+see)[^\n.]{0,36}(?:error|failed|failure|exception|crash)/iu.test(text);
  const hasFailure = !hasNegatedError
    && /(?:error|failed|failure|exception|crash|cannot\s+(?:open|launch|start)|unable\s+to\s+(?:open|launch|start))/iu.test(text);

  if (
    !hasFailure
    && /(?:launched-unverified|launch(?:ed)?\s+status:\s*unverified|launch\s+request\s+(?:sent|accepted)|window-not-detected-after-action|no-window-match|no\s+(?:focusable|matching|target)\s+window|not\s+(?:detected|verified|confirmed).*window|waiting\s+for\s+(?:the\s+)?target\s+window|target\s+window\s+still\s+not\s+(?:confirmed|verified|detected)|final\s+(?:visible\s+)?state\s+unverified)/iu.test(text)
  ) {
    return 'waiting_window';
  }

  if (
    !hasFailure
    && /(?:queue|waiting\s+in\s+queue|verifying|extracting|preparing|updating|downloading|installing|patching|queued|\b\d{1,3}\s*%|\b\d+(?:\.\d+)?\s*(?:kb|mb|gb|tb)\s*\/\s*\d+(?:\.\d+)?\s*(?:kb|mb|gb|tb))/iu.test(text)
  ) {
    return 'updating';
  }

  if (
    !hasFailure
    && /(?:waiting_target|waiting\s+for\s+(?:the\s+)?(?:target|game|app|application|window|client|server)|target\s+(?:process|window|client|app|game)\s+(?:not\s+)?(?:yet\s+)?(?:appeared|visible|running|detected)|start(?:ed)?\s+(?:request|action|button|command)\s+(?:sent|triggered|accepted)|launch\s+(?:request|action|button|command)\s+(?:sent|triggered|accepted)|\u7b49\u5f85.{0,16}(?:\u76ee\u6807|\u6e38\u620f|\u7a97\u53e3|\u8fdb\u7a0b)|(?:\u76ee\u6807|\u6e38\u620f).{0,16}(?:\u672a|\u8fd8\u6ca1).{0,16}(?:\u51fa\u73b0|\u542f\u52a8|\u8fd0\u884c))/iu.test(text)
  ) {
    return 'waiting_target';
  }

  if (
    !hasFailure
    && /(?:initializing|connecting|waiting\s+for\s+(?:the\s+)?(?:game|app|application|window|client|server|target)|loading|launching|starting|opening|spinner|still\s+launching|still\s+loading)/iu.test(text)
  ) {
    return 'loading';
  }

  if (/(?:login|required\s+login|sign\s*in|password|account|captcha|qr\s*code|administrator|admin|uac|\u767b\u5f55|\u8d26\u53f7|\u5bc6\u7801|\u9a8c\u8bc1|\u4e8c\u7ef4\u7801)/iu.test(text)) {
    return 'login_required';
  }

  if (/(?:blocked|permission|denied|modal|confirmation|confirm\s+before|gate|policy|administrator|admin|uac|\u963b\u6b62|\u62e6\u622a|\u6743\u9650|\u62d2\u7edd|\u5f39\u7a97|\u786e\u8ba4|\u7ba1\u7406\u5458)/iu.test(text)) {
    return 'blocked';
  }

  if (hasFailure) {
    return 'error';
  }

  if (/(?:unchanged|same\s+screen|no\s+visible\s+change|did\s+not\s+(?:change|advance)|(?:remained|stayed)\s+unchanged|launcher\s+(?:remained|stayed)\s+unchanged|\u672a\u53d8\u5316|\u6ca1\u6709\u53d8\u5316|\u65e0\u53d8\u5316|\u539f\u9875\u9762)/iu.test(text)) {
    return 'unchanged';
  }

  return '';
}

function shouldTreatAgentAsImplicitUnknownPostAction(options: {
  dependencies: AgentPostActionStateResolverDependencies;
  entry: AgentRuntimeToolResultEntry;
  sourceText: string;
  userGoal: string;
}) {
  const { dependencies, entry } = options;
  if (
    entry.result.ok === false
    || resolveAgentEvidencePostActionState(entry)
    || !dependencies.hasDirectActionIntent(options.sourceText, options.userGoal)
    || !hasAgentUnverifiedPostActionSignal({ dependencies, entry })
  ) {
    return false;
  }

  return dependencies.isPostApprovalVerificationCommand(entry.command)
    || dependencies.isAutoRecoveryCommand(entry.command)
    || (
      dependencies.isActionResultTool(entry.command)
      && dependencies.isRecoverableUnverifiedToolResult(entry)
    );
}

export function resolveAgentRecoveryPostActionState(options: {
  dependencies: AgentPostActionStateResolverDependencies;
  entry: AgentRuntimeToolResultEntry | null;
  sourceText: string;
  userGoal: string;
}) {
  const { dependencies } = options;
  if (!options.entry) {
    return '';
  }

  const structuredState = resolveAgentEvidencePostActionState(options.entry);
  if (structuredState) {
    return structuredState;
  }

  const desktopTargetPresence = resolveAgentDesktopTargetPresence(options.entry);
  const actionOrRecoveryEntry = dependencies.isActionResultTool(options.entry.command)
    || dependencies.isPostApprovalVerificationCommand(options.entry.command)
    || dependencies.isAutoRecoveryCommand(options.entry.command);
  if (
    actionOrRecoveryEntry
    && dependencies.hasDirectActionIntent(options.sourceText, options.userGoal)
    && (desktopTargetPresence === 'absent' || desktopTargetPresence === 'present_unreadable')
  ) {
    return 'waiting_window';
  }

  const structuredSelectionState = inferAgentSelectionPostActionStateFromStructuredEvidence(options.entry);
  if (
    structuredSelectionState
    && dependencies.hasDirectActionIntent(options.sourceText, options.userGoal)
    && (
      hasAgentUnverifiedPostActionSignal({ dependencies, entry: options.entry })
      || dependencies.isPostApprovalVerificationCommand(options.entry.command)
      || dependencies.isAutoRecoveryCommand(options.entry.command)
      || dependencies.isActionResultTool(options.entry.command)
    )
  ) {
    return structuredSelectionState;
  }

  const inferredState = inferAgentPostActionStateFromEvidence({
    dependencies,
    entry: options.entry,
  });
  if (
    inferredState
    && dependencies.hasDirectActionIntent(options.sourceText, options.userGoal)
    && !(desktopTargetPresence === 'present_interactable' && inferredState === 'waiting_window')
    && (
      hasAgentUnverifiedPostActionSignal({ dependencies, entry: options.entry })
      || dependencies.isPostApprovalVerificationCommand(options.entry.command)
      || dependencies.isAutoRecoveryCommand(options.entry.command)
    )
  ) {
    return inferredState;
  }

  return shouldTreatAgentAsImplicitUnknownPostAction({
    dependencies,
    entry: options.entry,
    sourceText: options.sourceText,
    userGoal: options.userGoal,
  })
    ? 'unknown'
    : '';
}
