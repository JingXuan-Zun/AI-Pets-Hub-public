import { type AgentStructuredToolCandidateEvidence, type AgentStructuredToolEvidence } from '../agentChatCommand';
import { createVisualSnapshotQueryTokens, normalizeVisualSnapshotCompactMatchText } from './captureSourceMatching';
import { getVisualSnapshotCandidateLabel } from './visualSnapshotCandidates';

import { isVisualSnapshotPrimaryActionUseful, isVisualSnapshotTextUseful } from './visualSnapshotEvidenceFormatting';

function isVisualSnapshotLauncherTextMatch(first: string | null | undefined, second: string | null | undefined) {
  const firstCompact = normalizeVisualSnapshotCompactMatchText(first);
  const secondCompact = normalizeVisualSnapshotCompactMatchText(second);
  if (!firstCompact || !secondCompact) {
    return false;
  }

  if (firstCompact === secondCompact) {
    return true;
  }

  const shorterLength = Math.min(firstCompact.length, secondCompact.length);
  if (
    shorterLength >= 5
    && (firstCompact.includes(secondCompact) || secondCompact.includes(firstCompact))
  ) {
    return true;
  }

  const genericTokens = new Set([
    'app',
    'button',
    'client',
    'current',
    'detail',
    'game',
    'launch',
    'launcher',
    'open',
    'page',
    'panel',
    'play',
    'selected',
    'start',
    'target',
    'the',
    '启动',
    '开始',
    '打开',
    '游戏',
    '按钮',
    '详情',
    '当前',
  ]);
  const firstTokens = new Set(createVisualSnapshotQueryTokens(first ?? '').filter((token) => !genericTokens.has(token)));
  const secondTokens = createVisualSnapshotQueryTokens(second ?? '').filter((token) => !genericTokens.has(token));
  if (!firstTokens.size || !secondTokens.length) {
    return false;
  }

  const overlapCount = secondTokens.filter((token) => firstTokens.has(token)).length;
  return overlapCount > 0 && overlapCount === Math.min(firstTokens.size, secondTokens.length);
}

export function createVisualSnapshotLauncherVerificationLine(
  verification: AgentStructuredToolEvidence['launcherVerification'],
) {
  if (!verification?.status) {
    return '';
  }

  const formatBoolean = (value: boolean | null | undefined) => (
    typeof value === 'boolean' ? String(value) : 'unknown'
  );
  return [
    `Launcher verification: status=${verification.status}`,
    `targetVisible=${formatBoolean(verification.targetVisible)}`,
    `selected=${formatBoolean(verification.targetSelected)}`,
    `detailMatches=${formatBoolean(verification.detailMatchesTarget)}`,
    `actionMatches=${formatBoolean(verification.primaryActionMatchesTarget)}`,
  ].join(' ');
}

function relationMentionsAnotherKnownLauncherTarget(options: {
  relation: string;
  targetCandidates?: AgentStructuredToolCandidateEvidence[];
  targetMatched: string;
}) {
  const targetCandidates = options.targetCandidates ?? [];
  return targetCandidates.some((candidate) => {
    const label = getVisualSnapshotCandidateLabel(candidate);
    return label
      && !isVisualSnapshotLauncherTextMatch(label, options.targetMatched)
      && isVisualSnapshotLauncherTextMatch(options.relation, label)
      && !isVisualSnapshotLauncherTextMatch(options.relation, options.targetMatched);
  });
}

type VisualSnapshotLauncherVerification = NonNullable<AgentStructuredToolEvidence['launcherVerification']>;

const LOGIN_CONTINUATION_CONTROL = /(?:快捷安全登录|快速安全登录|安全登录|快速登录|一键登录|立即登录|^\s*(?:点击)?\s*(?:橙色)?.{0,6}登录|sign\s*in|log\s*in)/iu;
// Logout, account switching and "use password / QR instead" links are not login continuations.
const NOT_LOGIN_CONTINUATION = /(?:退出|注销|切换|密码登录|扫码|二维码|logout|log\s*out|sign\s*out|switch)/iu;
const LOGIN_CONTEXT = /(?:登录|登陆|账号|帐号|login|sign\s*in|log\s*in|account)/iu;

type VisualSnapshotLauncherVerificationStatus = NonNullable<VisualSnapshotLauncherVerification['status']>;

export function createVisualSnapshotLauncherVerification(options: {
  actionCandidates?: AgentStructuredToolCandidateEvidence[];
  currentSelection: string;
  primaryAction: string;
  readiness: VisualSnapshotLauncherVerificationStatus;
  relation: string;
  relationRequired: boolean;
  selectionVerificationStatus?: AgentStructuredToolEvidence['selectionVerificationStatus'];
  targetCandidates?: AgentStructuredToolCandidateEvidence[];
  targetMatched: string;
}): VisualSnapshotLauncherVerification | null {
  const targetUseful = isVisualSnapshotTextUseful(options.targetMatched);
  const primaryActionUseful = isVisualSnapshotPrimaryActionUseful(options.primaryAction);
  const hasLauncherSignal = Boolean(
    targetUseful
      || primaryActionUseful
      || options.currentSelection
      || options.relation
      || options.selectionVerificationStatus
      || options.targetCandidates?.length
      || options.actionCandidates?.length,
  );
  if (!hasLauncherSignal) {
    return null;
  }

  const currentSelectionMatchesTarget = isVisualSnapshotLauncherTextMatch(
    options.currentSelection,
    options.targetMatched,
  );
  const currentSelectionMismatchesTarget = Boolean(
    options.currentSelection
      && options.targetMatched
      && !currentSelectionMatchesTarget,
  );
  const targetVisible = targetUseful || Boolean(options.targetCandidates?.length);
  let targetSelected = options.selectionVerificationStatus === 'selected'
    ? true
    : options.selectionVerificationStatus === 'mismatch' || options.selectionVerificationStatus === 'visible-only'
      ? false
      : currentSelectionMatchesTarget
        ? true
        : currentSelectionMismatchesTarget
          ? false
          : targetVisible
            ? null
            : false;
  let detailMatchesTarget = currentSelectionMatchesTarget || options.selectionVerificationStatus === 'selected'
    ? true
    : options.selectionVerificationStatus === 'mismatch' || currentSelectionMismatchesTarget
      ? false
      : null;

  const relationText = options.relation.normalize('NFKC').trim().toLowerCase();
  const relationUseful = isVisualSnapshotTextUseful(options.relation);
  const relationNegative = /(?:does\s+not\s+belong|not\s+(?:associated|related|for|target|current)|unrelated|wrong|different|mismatch|another\s+game|other\s+game|\u4e0d\u5c5e\u4e8e|\u65e0\u5173|\u4e0d\u662f|\u4e0d\u5339\u914d|\u5176\u4ed6\u6e38\u620f|\u53e6\u4e00\u4e2a\u6e38\u620f)/iu
    .test(relationText);
  const relationMentionsCurrentMismatch = Boolean(
    options.currentSelection
      && currentSelectionMismatchesTarget
      && isVisualSnapshotLauncherTextMatch(options.relation, options.currentSelection)
      && !isVisualSnapshotLauncherTextMatch(options.relation, options.targetMatched),
  );
  const relationMentionsOtherTarget = relationMentionsAnotherKnownLauncherTarget({
    relation: options.relation,
    targetCandidates: options.targetCandidates,
    targetMatched: options.targetMatched,
  });
  const relationConflict = Boolean(
    primaryActionUseful
      && (
        detailMatchesTarget === false
        || relationMentionsCurrentMismatch
        || relationMentionsOtherTarget
        || relationNegative
      ),
  );
  const relationPositive = Boolean(
    relationUseful
      && !relationConflict
      && (
        isVisualSnapshotLauncherTextMatch(options.relation, options.targetMatched)
        || (
          currentSelectionMatchesTarget
          && /(?:belongs\s+to|associated\s+with|for\s+(?:the\s+)?(?:selected|current)|current\s+detail|detail\s+panel|detail\s+page|owned\s+by|\u5c5e\u4e8e|\u5173\u8054|\u5bf9\u5e94|\u5f53\u524d\u8be6\u60c5|\u8be6\u60c5\u9875|\u5df2\u9009\u4e2d)/iu.test(relationText)
        )
      ),
  );
  const relationConfirmsTargetDetail = Boolean(
    relationPositive
      && /(?:selected|current|detail\s+(?:panel|page|title)|current\s+detail|belongs\s+to|associated\s+with|\u5df2\u9009\u4e2d|\u5f53\u524d|\u8be6\u60c5|\u5c5e\u4e8e|\u5173\u8054|\u5bf9\u5e94)/iu.test(relationText),
  );
  if (detailMatchesTarget === null && relationConfirmsTargetDetail) {
    detailMatchesTarget = true;
  }
  if (targetSelected === null && relationConfirmsTargetDetail) {
    targetSelected = true;
  }

  const primaryActionMatchesTarget = !primaryActionUseful
    ? null
    : relationConflict
      ? false
      : !options.relationRequired
        ? targetVisible
        : relationPositive
          ? true
          : options.readiness === 'ready' && (targetSelected === true || detailMatchesTarget === true)
            ? true
            : null;

  // A login button on a login gate ("快捷安全登录" before "启动英雄联盟") is the step that
  // leads to the final target; it does not have to belong to that target. Live runs
  // stopped at the WeGame login page with "ownership is not confirmed" otherwise.
  const loginGate = options.readiness === 'ready'
    && LOGIN_CONTINUATION_CONTROL.test(options.primaryAction.normalize('NFKC'))
    && !NOT_LOGIN_CONTINUATION.test(options.primaryAction.normalize('NFKC'))
    && LOGIN_CONTEXT.test([options.targetMatched, options.relation, options.currentSelection, options.primaryAction].join(' ').normalize('NFKC'))
    && !relationNegative;
  if (loginGate) {
    return {
      currentSelection: options.currentSelection || null,
      detailMatchesTarget: true,
      evidence: [
        options.targetMatched ? `targetMatched=${options.targetMatched}` : '',
        options.primaryAction ? `primaryAction=${options.primaryAction}` : '',
        'loginGate=login continuation control',
      ].filter(Boolean),
      primaryAction: options.primaryAction || null,
      primaryActionMatchesTarget: true,
      reason: 'Login continuation control on a login gate; it leads to the requested target, so target ownership is not required.',
      status: 'ready',
      targetMatched: options.targetMatched || null,
      targetSelected: true,
      targetVisible: true,
    } satisfies NonNullable<AgentStructuredToolEvidence['launcherVerification']>;
  }

  let status: VisualSnapshotLauncherVerificationStatus = options.readiness;
  if (!targetVisible) {
    status = 'needs-target-selection';
  } else if (targetSelected === false || detailMatchesTarget === false) {
    status = 'needs-target-selection';
  } else if (primaryActionUseful && primaryActionMatchesTarget === false) {
    status = 'needs-relation';
  } else if (primaryActionUseful && options.relationRequired && primaryActionMatchesTarget !== true && status === 'ready') {
    status = 'needs-relation';
  }

  const reason = status === 'ready'
    ? 'Launcher verification has target, selected/detail ownership, primary action ownership, and coordinate readiness.'
    : status === 'needs-target-selection'
      ? targetVisible
        ? 'Launcher target is visible, but selected/detail ownership is not confirmed for the requested target.'
        : 'Launcher target is not clearly visible or matched yet.'
      : status === 'needs-primary-action'
        ? 'Launcher target evidence exists, but no single primary open/start/play action is confirmed.'
        : status === 'needs-relation'
          ? 'Launcher primary action ownership is not confirmed for the requested target.'
          : status === 'needs-coordinate'
            ? 'Launcher primary action is identified, but no safe native-screen coordinate is resolved.'
            : status === 'low-confidence'
              ? 'Launcher visual evidence confidence is too low for input.'
              : status === 'not-actionable'
                ? 'Launcher visual evidence is not actionable.'
                : 'Launcher target/action state is still unknown.';

  return {
    currentSelection: options.currentSelection || null,
    detailMatchesTarget,
    evidence: [
      options.targetMatched ? `targetMatched=${options.targetMatched}` : '',
      options.currentSelection ? `currentSelection=${options.currentSelection}` : '',
      options.selectionVerificationStatus ? `selectionVerificationStatus=${options.selectionVerificationStatus}` : '',
      options.primaryAction ? `primaryAction=${options.primaryAction}` : '',
      options.relation ? `relation=${options.relation}` : '',
    ].filter(Boolean),
    primaryAction: options.primaryAction || null,
    primaryActionMatchesTarget,
    reason,
    status,
    targetMatched: options.targetMatched || null,
    targetSelected,
    targetVisible,
  } satisfies NonNullable<AgentStructuredToolEvidence['launcherVerification']>;
}
