import { useCallback, useEffect, useRef, useState } from 'react';
import {
  classifyDesktopItem,
  createDesktopIconArrangementPlan,
  createDesktopIconRelativePlacementPlan,
  createDesktopItemClassificationGroups,
  createDesktopOrganizationIconPositionSourceSummary,
  createDesktopOrganizationObservationEvidence,
  findDesktopOrganizationTargetDisplay,
  formatDesktopOrganizationIconPositionSourceSummary,
  formatDisplayResolutionSummary,
  getDesktopOrganizationDisplayLabel,
  isDesktopIconInsideDesktopOrganizationViewport,
  normalizeDesktopOrganizationDisplayRect,
  selectMovableDesktopOrganizationFallbackIcons,
  type AgentDesktopIconPlacementCommand,
  type AgentDesktopOrganizationCommand,
  type AgentDesktopObservationStats,
  type DesktopIconArrangementPlan,
  type DesktopIconArrangementViewport,
  type DesktopItemClassificationGroup,
  summarizeDesktopItemClassificationGroups,
} from '../../agent';
import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import { pushFrontendRuntimeLog } from '../../frontendRuntimeLogger';
import { type PetAction } from '../../types';

type ViewportRect = {
  height: number;
  width: number;
  x: number;
  y: number;
};

export interface DesktopOrganizationShowcaseRun {
  plan: DesktopIconArrangementPlan;
  startedAt: number;
  status: 'running' | 'completed';
}

export interface DesktopOrganizationShowcaseStartResult {
  errorText?: string | null;
  followUp?: string | null;
  observations?: string[];
  ok?: boolean;
  observationStats?: AgentDesktopObservationStats | null;
  plan?: DesktopIconArrangementPlan | null;
  previewSummaryLines?: string[];
  previewWarning?: string | null;
  responseText: string;
  started: boolean;
  verification?: string | null;
}

interface UseDesktopOrganizationShowcaseOptions {
  addLog: (message: string) => void;
  onSetAction: (action: PetAction) => void;
  shellViewport: ViewportRect;
}

const RELATIVE_PLACEMENT_DIRECTION_LABELS: Record<AgentDesktopIconPlacementCommand['direction'], string> = {
  above: '上面',
  below: '下面',
  'left-of': '左边',
  'right-of': '右边',
};

const REAL_ICON_MOVE_BATCH_SIZE = 8;
const REAL_ICON_MOVE_BATCH_PAUSE_MS = 16;
const POST_MOVE_SETTLE_MS = 260;
const DESKTOP_ICON_VERIFY_TOLERANCE_PX = 12;
const MAX_POST_CHECK_ISSUES = 5;

interface DesktopIconPostMoveIssue {
  actual?: { x: number; y: number };
  distance?: number;
  iconName: string;
  planned: { x: number; y: number };
  reason: 'missing' | 'off-target';
}

interface DesktopIconPostMoveCheck {
  checkedCount: number;
  groupChecks: DesktopIconPostMoveGroupCheck[];
  insideTargetViewportCount: number;
  matchedCount: number;
  missingCount: number;
  offTargetCount: number;
  sampleIssues: DesktopIconPostMoveIssue[];
}

interface DesktopIconPostMoveGroupCheck {
  actualBounds?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  foundCount: number;
  groupKey: string;
  groupLabel: string;
  insideTargetViewportCount: number;
  plannedCount: number;
  plannedEndRow: number;
  plannedStartRow: number;
}

interface DesktopIconMovePlanSummary {
  acceptedCount: number;
  itemCount: number;
  postCheck: DesktopIconPostMoveCheck;
  verifiedCount: number;
}

type DesktopIconMoveVerificationMode = 'grid-arrangement' | 'precise-placement';

function calculateIconDistanceFromTarget(
  icon: DesktopPetDesktopIconLike,
  target: { x: number; y: number },
) {
  const x = Number(icon.x);
  const y = Number(icon.y);
  if (![x, y, target.x, target.y].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.hypot(x - target.x, y - target.y);
}

function findDesktopIconForPlanItem(
  icons: DesktopPetDesktopIconLike[],
  item: DesktopIconArrangementPlan['items'][number],
) {
  return icons.find((icon) => icon.id === item.iconId)
    ?? icons.find((icon) => icon.name === item.iconName)
    ?? null;
}

function createEmptyPostMoveCheck(itemCount: number): DesktopIconPostMoveCheck {
  return {
    checkedCount: itemCount,
    groupChecks: [],
    insideTargetViewportCount: 0,
    matchedCount: 0,
    missingCount: itemCount,
    offTargetCount: 0,
    sampleIssues: [],
  };
}

function createDesktopIconPostMoveGroupChecks(
  plan: DesktopIconArrangementPlan,
  icons: DesktopPetDesktopIconLike[],
): DesktopIconPostMoveGroupCheck[] {
  const layouts = plan.grouping?.layouts ?? [];
  if (!layouts.length) {
    return [];
  }

  return layouts.map((layout) => {
    const plannedItems = plan.items.filter((item) => item.groupKey === layout.groupKey);
    const actualIcons = plannedItems
      .map((item) => findDesktopIconForPlanItem(icons, item))
      .filter((icon): icon is DesktopPetDesktopIconLike => icon !== null);
    const insideTargetViewportCount = actualIcons.filter((icon) => (
      isDesktopIconInsideDesktopOrganizationViewport(icon, plan.viewport)
    )).length;
    const left = actualIcons.length ? Math.min(...actualIcons.map((icon) => Number(icon.x))) : NaN;
    const top = actualIcons.length ? Math.min(...actualIcons.map((icon) => Number(icon.y))) : NaN;
    const right = actualIcons.length ? Math.max(...actualIcons.map((icon) => Number(icon.x) + Number(icon.width))) : NaN;
    const bottom = actualIcons.length ? Math.max(...actualIcons.map((icon) => Number(icon.y) + Number(icon.height))) : NaN;
    const actualBounds = [left, top, right, bottom].every(Number.isFinite)
      ? {
          height: Math.max(1, Math.round(bottom - top)),
          width: Math.max(1, Math.round(right - left)),
          x: Math.round(left),
          y: Math.round(top),
        }
      : undefined;

    return {
      actualBounds,
      foundCount: actualIcons.length,
      groupKey: layout.groupKey,
      groupLabel: layout.groupLabel,
      insideTargetViewportCount,
      plannedCount: plannedItems.length || layout.count,
      plannedEndRow: layout.endRow,
      plannedStartRow: layout.startRow,
    };
  });
}

async function verifyDesktopIconPlanAfterMove(
  plan: DesktopIconArrangementPlan,
): Promise<DesktopIconPostMoveCheck> {
  if (!plan.items.length) {
    return createEmptyPostMoveCheck(0);
  }

  const icons = await desktopPetShellRuntime.listDesktopIcons({
    coordinateSpace: 'native-screen',
    forceRefresh: true,
  });
  const normalizedIcons = Array.isArray(icons) ? icons : [];
  let insideTargetViewportCount = 0;
  let matchedCount = 0;
  let missingCount = 0;
  let offTargetCount = 0;
  const sampleIssues: DesktopIconPostMoveIssue[] = [];

  for (const item of plan.items) {
    const icon = findDesktopIconForPlanItem(normalizedIcons, item);
    if (!icon) {
      missingCount += 1;
      if (sampleIssues.length < MAX_POST_CHECK_ISSUES) {
        sampleIssues.push({
          iconName: item.iconName,
          planned: {
            x: item.to.x,
            y: item.to.y,
          },
          reason: 'missing',
        });
      }
      continue;
    }

    if (isDesktopIconInsideDesktopOrganizationViewport(icon, plan.viewport)) {
      insideTargetViewportCount += 1;
    }

    const distance = calculateIconDistanceFromTarget(icon, item.to);
    if (distance <= DESKTOP_ICON_VERIFY_TOLERANCE_PX) {
      matchedCount += 1;
      continue;
    }

    offTargetCount += 1;
    if (sampleIssues.length < MAX_POST_CHECK_ISSUES) {
      sampleIssues.push({
        actual: {
          x: Math.round(Number(icon.x)),
          y: Math.round(Number(icon.y)),
        },
        distance: Math.round(distance),
        iconName: item.iconName,
        planned: {
          x: item.to.x,
          y: item.to.y,
        },
        reason: 'off-target',
      });
    }
  }

  return {
    checkedCount: plan.items.length,
    groupChecks: createDesktopIconPostMoveGroupChecks(plan, normalizedIcons),
    insideTargetViewportCount,
    matchedCount,
    missingCount,
    offTargetCount,
    sampleIssues,
  };
}

function createDesktopOrganizationFailureResult(responseText: string): DesktopOrganizationShowcaseStartResult {
  return {
    errorText: responseText,
    ok: false,
    plan: null,
    responseText,
    started: false,
  };
}

function createDesktopOrganizationIconReadFallbackResult(
  icons: DesktopPetDesktopIconLike[],
): DesktopOrganizationShowcaseStartResult {
  const normalizedIcons = Array.isArray(icons) ? icons : [];
  const positionSummary = createDesktopOrganizationIconPositionSourceSummary(normalizedIcons);
  const classifications = normalizedIcons.map((icon) => classifyDesktopItem(icon));
  const categoryGroups = createDesktopItemClassificationGroups(classifications, 'category');
  const categorySummary = summarizeDesktopItemClassificationGroups(categoryGroups);
  const sampleNames = normalizedIcons
    .map((icon) => icon.name)
    .filter(Boolean)
    .slice(0, 10);
  const sourceLine = formatDesktopOrganizationIconPositionSourceSummary(positionSummary);
  const responseLines = [
    `Desktop icon coordinate read returned 0 movable icon(s), but fallback found ${normalizedIcons.length} desktop item(s).`,
    `Icon sources: ${sourceLine}.`,
    categorySummary ? `Detected categories: ${categorySummary}.` : '',
    sampleNames.length ? `Sample items: ${sampleNames.join(', ')}` : '',
    'Because only fallback/read-only data is available, I can classify and explain the desktop contents, but I cannot safely move icons until native-screen coordinates are available.',
  ].filter(Boolean);

  return {
    errorText: responseLines.join('\n'),
    observations: [
      `Desktop organization fallback item count: ${normalizedIcons.length}`,
      `Desktop organization fallback position sources: ${sourceLine}`,
      categorySummary ? `Desktop organization fallback categories: ${categorySummary}` : '',
      sampleNames.length ? `Desktop organization fallback sample items: ${sampleNames.join(' | ')}` : '',
      'Desktop organization cannot execute movement without movable native-screen coordinates.',
    ].filter(Boolean),
    observationStats: {
      classificationGroups: mapDesktopItemGroupsToStats(categoryGroups),
      fileFallbackIconCount: positionSummary.fileFallbackIconCount,
      movableIconCount: positionSummary.movableIconCount,
      positionSourceCounts: positionSummary.sources,
      readOnlyIconCount: positionSummary.readOnlyIconCount,
      selectedFileFallbackIconCount: positionSummary.fileFallbackIconCount,
      selectedIconCount: normalizedIcons.length,
      selectedMovableIconCount: positionSummary.movableIconCount,
      selectedReadOnlyIconCount: positionSummary.readOnlyIconCount,
      totalIconCount: normalizedIcons.length,
    },
    ok: false,
    plan: null,
    previewSummaryLines: responseLines,
    previewWarning: 'Desktop icon native-screen coordinates were not available; movement is blocked until the desktop icon reader can observe movable positions.',
    responseText: responseLines.join('\n'),
    started: false,
  };
}

function summarizePlanIconNames(plan: DesktopIconArrangementPlan, limit = 8) {
  const names = plan.items.map((item) => item.iconName).filter(Boolean);
  const visibleNames = names.slice(0, limit);
  return `${visibleNames.join('、')}${names.length > visibleNames.length ? ` 等 ${names.length} 个` : ''}`;
}

function createPlanCategoryGroups(plan: DesktopIconArrangementPlan) {
  const classifications = plan.items
    .map((item) => item.classification)
    .filter((classification): classification is NonNullable<typeof classification> => Boolean(classification));
  return createDesktopItemClassificationGroups(classifications, 'category');
}

function mapDesktopItemGroupsToStats(groups: DesktopItemClassificationGroup[]) {
  return groups.map((group) => ({
    category: group.category,
    count: group.count,
    key: group.key,
    kind: group.kind,
    label: group.label,
  }));
}

function formatDesktopDisplayOwnershipStats(
  displays: AgentDesktopObservationStats['displayIconCounts'],
) {
  if (!displays?.length) {
    return 'none';
  }

  return displays
    .map((display) => `${display.label} ${display.iconCount} icons, selected ${display.selectedIconCount ?? 0}`)
    .join('; ');
}

function summarizePlanGrouping(plan: DesktopIconArrangementPlan) {
  if (!plan.grouping?.groups.length) {
    return null;
  }

  const groupModeText = plan.grouping.groupBy === 'category'
    ? '按类别'
    : plan.grouping.groupBy === 'kind'
      ? '按项目类型'
      : plan.grouping.groupBy === 'extension'
        ? '按扩展名'
        : '不分组';
  return `${groupModeText}：${summarizeDesktopItemClassificationGroups(plan.grouping.groups)}`;
}

function mapDesktopItemGroupLayoutsToStats(plan: DesktopIconArrangementPlan) {
  return (plan.grouping?.layouts ?? []).map((layout) => ({
    columns: layout.columns,
    count: layout.count,
    endRow: layout.endRow,
    groupKey: layout.groupKey,
    groupLabel: layout.groupLabel,
    rows: layout.rows,
    startRow: layout.startRow,
  }));
}

function summarizePlanGroupLayout(plan: DesktopIconArrangementPlan) {
  const layouts = plan.grouping?.layouts ?? [];
  if (!layouts.length) {
    return null;
  }

  return layouts.map((layout) => (
    `${layout.groupLabel} (${layout.groupKey}) ${layout.count} icons, rows ${layout.startRow + 1}-${layout.endRow + 1}, ${layout.columns} column(s)`
  )).join('; ');
}

function createDesktopOrganizationViewportFromDisplays(displays: DesktopPetDisplayLike[]) {
  const displayRects = displays.map(normalizeDesktopOrganizationDisplayRect);
  if (!displayRects.length) {
    return null;
  }

  const left = Math.min(...displayRects.map((rect) => rect.x));
  const top = Math.min(...displayRects.map((rect) => rect.y));
  const right = Math.max(...displayRects.map((rect) => rect.x + rect.width));
  const bottom = Math.max(...displayRects.map((rect) => rect.y + rect.height));

  return {
    height: Math.max(1, bottom - top),
    width: Math.max(1, right - left),
    x: left,
    y: top,
  };
}

function waitForMs(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs);
  });
}

function acceptsDesktopGridSnapping(summary: DesktopIconMovePlanSummary) {
  return summary.itemCount > 0
    && summary.acceptedCount === summary.itemCount
    && summary.postCheck.missingCount === 0
    && summary.postCheck.insideTargetViewportCount === summary.itemCount;
}

function summarizeDesktopIconPostMoveGroupChecks(
  groupChecks: DesktopIconPostMoveGroupCheck[],
) {
  if (!groupChecks.length) {
    return null;
  }

  return groupChecks.map((group) => {
    const bounds = group.actualBounds
      ? `, bounds (${group.actualBounds.x}, ${group.actualBounds.y}) ${group.actualBounds.width}x${group.actualBounds.height}`
      : '';
    return `${group.groupLabel} (${group.groupKey}) found ${group.foundCount}/${group.plannedCount}, in target ${group.insideTargetViewportCount}/${group.plannedCount}, planned rows ${group.plannedStartRow + 1}-${group.plannedEndRow + 1}${bounds}`;
  }).join('; ');
}

function summarizeDesktopIconMoveSummary(
  summary: DesktopIconMovePlanSummary,
  mode: DesktopIconMoveVerificationMode,
) {
  const gridSnapped = mode === 'grid-arrangement'
    && acceptsDesktopGridSnapping(summary)
    && summary.postCheck.matchedCount < summary.itemCount;
  const groupCheckSummary = summarizeDesktopIconPostMoveGroupChecks(summary.postCheck.groupChecks);
  const lines = [
    `移动请求：Windows 接收 ${summary.acceptedCount}/${summary.itemCount} 个；即时验证 ${summary.verifiedCount}/${summary.itemCount} 个。`,
    `执行后复查：命中计划坐标 ${summary.postCheck.matchedCount}/${summary.postCheck.checkedCount} 个；仍在目标屏幕区域 ${summary.postCheck.insideTargetViewportCount}/${summary.postCheck.checkedCount} 个。`,
  ];

  if (groupCheckSummary) {
    lines.push(`Group post-check: ${groupCheckSummary}.`);
  }

  if (gridSnapped) {
    lines.push('Windows 已接受移动，且图标都留在目标屏幕范围内；未逐点命中的坐标按桌面网格吸附处理。');
  } else if (summary.postCheck.missingCount > 0 || summary.postCheck.offTargetCount > 0) {
    lines.push(`异常：未找到 ${summary.postCheck.missingCount} 个，偏离目标 ${summary.postCheck.offTargetCount} 个。`);
  }

  const issueLines = gridSnapped ? [] : summary.postCheck.sampleIssues.map((issue) => {
    if (issue.reason === 'missing') {
      return `「${issue.iconName}」复查时没找到。`;
    }

    return `「${issue.iconName}」目标 (${issue.planned.x}, ${issue.planned.y})，实际 (${issue.actual?.x ?? '?'}, ${issue.actual?.y ?? '?'})，偏差约 ${issue.distance ?? '?'}px。`;
  });

  if (issueLines.length) {
    lines.push(`样例：${issueLines.join('；')}`);
  }

  if (gridSnapped) {
    lines.push('如果想更贴近计划坐标，可以关闭 Windows 的“将图标与网格对齐”后再整理。');
  } else if (summary.postCheck.offTargetCount > 0) {
    lines.push('如果 Windows 开启了“自动排列图标”或“将图标与网格对齐”，最终坐标可能会被系统改回或吸附。');
  }

  return lines.join('\n');
}

function isDesktopIconMoveSummaryVerified(
  summary: DesktopIconMovePlanSummary,
  mode: DesktopIconMoveVerificationMode,
) {
  const exactMatch = summary.itemCount > 0
    && summary.acceptedCount === summary.itemCount
    && summary.verifiedCount === summary.itemCount
    && summary.postCheck.matchedCount === summary.itemCount
    && summary.postCheck.missingCount === 0
    && summary.postCheck.offTargetCount === 0;

  if (exactMatch) {
    return true;
  }

  return mode === 'grid-arrangement' && acceptsDesktopGridSnapping(summary);
}

function createDesktopIconMoveVerification(
  summary: DesktopIconMovePlanSummary,
  mode: DesktopIconMoveVerificationMode,
) {
  const gridSnapped = mode === 'grid-arrangement'
    && acceptsDesktopGridSnapping(summary)
    && summary.postCheck.matchedCount < summary.itemCount;
  const groupCheckSummary = summarizeDesktopIconPostMoveGroupChecks(summary.postCheck.groupChecks);
  return [
    `Windows 接收 ${summary.acceptedCount}/${summary.itemCount} 个移动请求。`,
    `即时验证 ${summary.verifiedCount}/${summary.itemCount} 个。`,
    `执行后复查命中计划坐标 ${summary.postCheck.matchedCount}/${summary.postCheck.checkedCount} 个。`,
    `仍在目标屏幕区域 ${summary.postCheck.insideTargetViewportCount}/${summary.postCheck.checkedCount} 个。`,
    groupCheckSummary ? `Group post-check: ${groupCheckSummary}.` : '',
    gridSnapped
      ? '坐标被 Windows 桌面网格吸附，但批量整理目标已达成。'
      : (summary.postCheck.missingCount || summary.postCheck.offTargetCount)
        ? `异常：未找到 ${summary.postCheck.missingCount} 个，偏离目标 ${summary.postCheck.offTargetCount} 个。`
        : '未发现缺失或偏离目标的图标。',
  ].join(' ');
}

function createDesktopIconMoveFollowUp(
  summary: DesktopIconMovePlanSummary,
  mode: DesktopIconMoveVerificationMode,
) {
  if (isDesktopIconMoveSummaryVerified(summary, mode)) {
    return null;
  }

  if (summary.acceptedCount < summary.itemCount) {
    return '可以重新观察桌面后再生成一份新计划，或者检查 Windows 是否阻止了桌面图标移动。';
  }

  if (summary.postCheck.offTargetCount > 0 || summary.postCheck.missingCount > 0) {
    return '可以先关闭 Windows 的“自动排列图标”或检查“将图标与网格对齐”，然后让我重新观察并整理。';
  }

  return '可以让我重新观察桌面并生成一份新整理计划。';
}

export function useDesktopOrganizationShowcase({
  addLog,
  onSetAction,
  shellViewport,
}: UseDesktopOrganizationShowcaseOptions) {
  const [run, setRun] = useState<DesktopOrganizationShowcaseRun | null>(null);
  const dismissTimerRef = useRef<number | null>(null);

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearDismissTimer(), [clearDismissTimer]);

  const moveDesktopIconPlanItems = useCallback(async (
    plan: DesktopIconArrangementPlan,
    options: { batchPauseMs?: number; batchSize?: number; staggerMs?: number } = {},
  ): Promise<DesktopIconMovePlanSummary> => {
    let acceptedCount = 0;
    let verifiedCount = 0;
    const batchSize = Math.max(1, Math.floor(options.batchSize ?? 0));
    const batchPauseMs = Math.max(0, options.batchPauseMs ?? 0);

    for (const [index, item] of plan.items.entries()) {
      if (index > 0 && options.staggerMs) {
        await waitForMs(options.staggerMs);
      } else if (index > 0 && batchSize > 0 && batchPauseMs > 0 && index % batchSize === 0) {
        await waitForMs(batchPauseMs);
      }

      const moveResult = await desktopPetShellRuntime.moveDesktopIcon({
        coordinateSpace: 'native-screen',
        iconId: item.iconId,
        iconName: item.iconName,
        x: item.to.x,
        y: item.to.y,
      });

      if (moveResult?.ok) {
        acceptedCount += 1;
      }

      if (moveResult?.ok && moveResult.verified) {
        verifiedCount += 1;
      } else if (!moveResult?.ok) {
        addLog(`真实移动「${item.iconName}」失败：${moveResult?.error ?? 'Windows 未接受移动请求'}`);
      }
    }

    if (plan.items.length > 0) {
      await waitForMs(POST_MOVE_SETTLE_MS);
    }

    const postCheck = await verifyDesktopIconPlanAfterMove(plan);

    pushFrontendRuntimeLog('agent-desktop-organization', 'real desktop icon movement completed', {
      acceptedCount,
      itemCount: plan.items.length,
      postCheck,
      verifiedCount,
    });

    return {
      acceptedCount,
      itemCount: plan.items.length,
      postCheck,
      verifiedCount,
    };
  }, [addLog]);

  const preview = useCallback(async (
    organization: AgentDesktopOrganizationCommand = {},
  ): Promise<DesktopOrganizationShowcaseStartResult> => {
    clearDismissTimer();

    if (!desktopPetShellRuntime.isDesktopMode()) {
      addLog('桌面整理演出需要在桌面版中运行。');
      return createDesktopOrganizationFailureResult('桌面整理需要在桌面版中运行。');
    }

    try {
      const [icons, displays] = await Promise.all([
        desktopPetShellRuntime.listDesktopIcons({
          coordinateSpace: 'native-screen',
          forceRefresh: true,
        }),
        desktopPetShellRuntime.listDisplays(),
      ]);
      let normalizedIcons = Array.isArray(icons) ? icons : [];
      if (normalizedIcons.length === 0) {
        const fallbackIcons = await desktopPetShellRuntime.listDesktopIcons({
          coordinateSpace: 'native-screen',
          forceRefresh: true,
          includeFileSystemFallback: true,
          includeReadOnlyPositionFallback: true,
        });
        const readOnlyPositionCount = Array.isArray(fallbackIcons)
          ? fallbackIcons.filter((icon) => icon.positionSource === 'ui-automation').length
          : 0;
        const fallbackCount = Array.isArray(fallbackIcons)
          ? fallbackIcons.filter((icon) => icon.positionSource === 'filesystem-fallback').length
          : 0;
        const normalizedFallbackIcons = Array.isArray(fallbackIcons) ? fallbackIcons : [];
        const fallbackSelection = selectMovableDesktopOrganizationFallbackIcons(normalizedFallbackIcons);
        if (fallbackSelection.icons.length > 0) {
          normalizedIcons = fallbackSelection.icons;
          addLog(
            `桌面图标首次读取为空，fallback 已恢复 ${fallbackSelection.icons.length} 个可移动图标，继续生成整理计划。`,
          );
        } else if (normalizedFallbackIcons.length > 0) {
          const fallbackResult = createDesktopOrganizationIconReadFallbackResult(normalizedFallbackIcons);
          addLog(fallbackResult.responseText);
          return fallbackResult;
        }
        const responseText = readOnlyPositionCount > 0
          ? `已读取到 ${readOnlyPositionCount} 个可见桌面图标坐标，但当前移动器没有拿到可移动的 Explorer 图标索引，所以暂时不能执行整理。`
          : fallbackCount > 0
          ? `读取到 ${fallbackCount} 个桌面文件，但没有读取到可移动的桌面图标坐标。请先确认 Windows 桌面图标处于显示状态，或重启 Explorer 后再试。`
          : '没有读取到可整理的桌面图标。';
        addLog(responseText);
        return createDesktopOrganizationFailureResult(responseText);
      }

      const normalizedDisplays = Array.isArray(displays) ? displays : [];
      const targetDisplay = findDesktopOrganizationTargetDisplay(normalizedDisplays, organization.displayTarget);
      if (organization.displayTarget === 'secondary' && !targetDisplay) {
        const responseText = '没有检测到可用的副屏，所以没有移动桌面图标。';
        addLog(responseText);
        return createDesktopOrganizationFailureResult(responseText);
      }

      const targetDisplayIndex = targetDisplay
        ? normalizedDisplays.findIndex((display) => String(display.id) === String(targetDisplay.id))
        : -1;
      const targetViewport = targetDisplay
        ? normalizeDesktopOrganizationDisplayRect(targetDisplay)
        : createDesktopOrganizationViewportFromDisplays(normalizedDisplays) ?? shellViewport;
      const targetDisplayLabel = targetDisplay
        ? getDesktopOrganizationDisplayLabel(targetDisplay, targetDisplayIndex)
        : '当前桌面区域';
      const effectiveScope = organization.scope ?? (targetDisplay ? 'display-icons' : 'all-icons');
      const shouldOnlyOrganizeTargetDisplayIcons = Boolean(
        targetDisplay && effectiveScope === 'display-icons',
      );
      const planIcons = shouldOnlyOrganizeTargetDisplayIcons
        ? normalizedIcons.filter((icon) => isDesktopIconInsideDesktopOrganizationViewport(icon, targetViewport))
        : normalizedIcons;
      const observationEvidence = createDesktopOrganizationObservationEvidence({
        displays: normalizedDisplays,
        effectiveScope,
        icons: normalizedIcons,
        selectedIcons: planIcons,
        selectedIconCount: planIcons.length,
        targetDisplay,
        targetDisplayLabel,
        targetViewport,
      });

      if (planIcons.length === 0) {
        const responseText = targetDisplay
          ? `${targetDisplayLabel}范围内没有读取到可整理的桌面图标。`
          : '没有读取到可整理的桌面图标。';
        addLog(responseText);
        return createDesktopOrganizationFailureResult(responseText);
      }

      const targetColumns = 7;
      const plan = createDesktopIconArrangementPlan({
        groupBy: organization.groupBy,
        icons: planIcons,
        maxColumns: targetColumns,
        viewport: targetViewport,
      });
      plan.displayLabel = targetDisplayLabel;
      const categoryGroups = createPlanCategoryGroups(plan);
      const categorySummary = summarizeDesktopItemClassificationGroups(categoryGroups);
      const groupingSummary = summarizePlanGrouping(plan);
      const groupLayoutSummary = summarizePlanGroupLayout(plan);
      const allIconPositionSummary = createDesktopOrganizationIconPositionSourceSummary(normalizedIcons);
      const selectedIconPositionSummary = createDesktopOrganizationIconPositionSourceSummary(planIcons);
      const displayIconCounts = observationEvidence.displays.map((display) => ({
        iconCount: display.iconCount,
        id: display.id,
        isPrimary: display.isPrimary,
        label: display.label,
        selectedIconCount: display.selectedIconCount,
        viewport: display.viewport,
      }));
      const arrangementGroups = plan.grouping?.groups.length
        ? mapDesktopItemGroupsToStats(plan.grouping.groups)
        : [];
      const arrangementGroupLayouts = mapDesktopItemGroupLayoutsToStats(plan);
      const classificationGroups = mapDesktopItemGroupsToStats(categoryGroups);

      const scopeText = targetDisplay
        ? effectiveScope === 'display-icons'
          ? `整理${targetDisplayLabel}上的 ${plan.items.length} 个图标`
          : `把 ${plan.items.length} 个桌面图标整理到${targetDisplayLabel}`
        : `整理 ${plan.items.length} 个桌面图标`;
      const displayLines = normalizedDisplays.length
        ? normalizedDisplays.map((display, index) => {
          const rect = normalizeDesktopOrganizationDisplayRect(display);
          return `${index + 1}. ${getDesktopOrganizationDisplayLabel(display, index)}${display.isPrimary ? '（主屏）' : '（副屏）'}：${formatDisplayResolutionSummary(display)}，桌面图标坐标范围 ${rect.width} x ${rect.height}，起点 (${rect.x}, ${rect.y})`;
        })
        : ['没有读取到显示器列表。'];
      const previewSummaryLines = [
        organization.placementIntent ? `Requested layout intent: ${organization.placementIntent}` : '',
        observationEvidence.summaryLine,
        observationEvidence.processingLine,
        `Icon position sources: ${formatDesktopOrganizationIconPositionSourceSummary(allIconPositionSummary)}`,
        `Selected icon move readiness: ${formatDesktopOrganizationIconPositionSourceSummary(selectedIconPositionSummary)}`,
        `Display ownership: ${formatDesktopDisplayOwnershipStats(displayIconCounts)}`,
        groupLayoutSummary ? `Group layout: ${groupLayoutSummary}` : '',
        categorySummary ? `识别：${categorySummary}` : '',
        groupingSummary ? `分组：${groupingSummary}` : '',
        `计划：${scopeText}。`,
        `将处理：${summarizePlanIconNames(plan) || '无'}`,
        `排列：${plan.columns} 列 x ${plan.rows} 行，桌面图标坐标范围 ${targetViewport.width} x ${targetViewport.height}，起点 (${plan.items[0]?.to.x ?? plan.viewport.x}, ${plan.items[0]?.to.y ?? plan.viewport.y})。`,
      ].filter(Boolean);

      return {
        observationStats: {
          arrangementGroupLayouts,
          arrangementGroups,
          classificationGroups,
          displayIconCounts,
          displayCount: observationEvidence.displayCount,
          fileFallbackIconCount: allIconPositionSummary.fileFallbackIconCount,
          movableIconCount: allIconPositionSummary.movableIconCount,
          positionSourceCounts: allIconPositionSummary.sources,
          readOnlyIconCount: allIconPositionSummary.readOnlyIconCount,
          selectedFileFallbackIconCount: selectedIconPositionSummary.fileFallbackIconCount,
          selectedIconCount: observationEvidence.selectedIconCount,
          selectedMovableIconCount: selectedIconPositionSummary.movableIconCount,
          selectedReadOnlyIconCount: selectedIconPositionSummary.readOnlyIconCount,
          targetDisplayLabel: observationEvidence.targetDisplayLabel,
          targetIconCount: observationEvidence.targetIconCount,
          totalIconCount: observationEvidence.totalIconCount,
          willMoveAcrossDisplays: observationEvidence.willMoveAcrossDisplays,
        },
        observations: [
          ...observationEvidence.observations,
          `Desktop icon position sources: ${formatDesktopOrganizationIconPositionSourceSummary(allIconPositionSummary)}`,
          `Desktop selected icon move readiness: ${formatDesktopOrganizationIconPositionSourceSummary(selectedIconPositionSummary)}`,
          `Desktop display ownership: ${formatDesktopDisplayOwnershipStats(displayIconCounts)}`,
          groupLayoutSummary ? `Desktop icon group layout: ${groupLayoutSummary}` : '',
          categorySummary ? `Desktop icon categories: ${categorySummary}` : '',
          groupingSummary ? `Desktop icon grouping: ${groupingSummary}` : '',
        ].filter(Boolean),
        plan,
        previewSummaryLines,
        previewWarning: observationEvidence.willMoveAcrossDisplays
          ? `注意：这份计划会把其他屏幕上的图标移动到${targetDisplayLabel}。`
          : null,
        responseText: [
          `我先只做了观察和整理计划，还没有移动图标。`,
          ...previewSummaryLines.slice(0, 3),
          `显示器：${observationEvidence.displayLines.length ? observationEvidence.displayLines.join('；') : displayLines.join('；')}`,
          ...previewSummaryLines.slice(3),
          `确认无误后，可以说“执行刚才的整理计划”。`,
        ].join('\n'),
        ok: true,
        started: false,
      };
    } catch (error) {
      const responseText = `桌面整理计划生成失败：${error instanceof Error ? error.message : String(error)}`;
      addLog(responseText);
      pushFrontendRuntimeLog('agent-desktop-organization', 'showcase preview failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return createDesktopOrganizationFailureResult(responseText);
    }
  }, [
    addLog,
    clearDismissTimer,
    shellViewport,
  ]);

  const start = useCallback(async (
    organization: AgentDesktopOrganizationCommand = {},
    existingPlan?: DesktopIconArrangementPlan | null,
  ): Promise<DesktopOrganizationShowcaseStartResult> => {
    clearDismissTimer();

    try {
      const previewResult = existingPlan
        ? {
            plan: existingPlan,
            responseText: '',
            started: false,
          }
        : await preview(organization);
      const plan = previewResult.plan ?? null;

      if (!plan?.items.length) {
        return createDesktopOrganizationFailureResult(previewResult.responseText || '没有可执行的桌面整理计划。');
      }

      setRun({
        plan,
        startedAt: Date.now(),
        status: 'running',
      });
      onSetAction('WALKING');
      const scopeText = plan.displayLabel
        ? `整理${plan.displayLabel}相关的 ${plan.items.length} 个图标`
        : `整理 ${plan.items.length} 个桌面图标`;
      addLog(`桌面整理演出开始：${scopeText}。`);
      pushFrontendRuntimeLog('agent-desktop-organization', 'showcase started', {
        columns: plan.columns,
        displayLabel: plan.displayLabel ?? null,
        itemCount: plan.items.length,
        rows: plan.rows,
      });
      const groupLayoutSummary = summarizePlanGroupLayout(plan);

      const summary = await moveDesktopIconPlanItems(plan, {
        batchPauseMs: REAL_ICON_MOVE_BATCH_PAUSE_MS,
        batchSize: REAL_ICON_MOVE_BATCH_SIZE,
      });
      const verificationMode: DesktopIconMoveVerificationMode = 'grid-arrangement';
      const verified = isDesktopIconMoveSummaryVerified(summary, verificationMode);
      const verification = createDesktopIconMoveVerification(summary, verificationMode);
      const followUp = createDesktopIconMoveFollowUp(summary, verificationMode);
      const postMoveGroupCheckSummary = summarizeDesktopIconPostMoveGroupChecks(summary.postCheck.groupChecks);
      addLog(`真实桌面整理完成：复查命中 ${summary.postCheck.matchedCount}/${summary.itemCount} 个图标。`);

      return {
        followUp,
        observations: [
          `Desktop organization post-check matched ${summary.postCheck.matchedCount}/${summary.itemCount}`,
          `Desktop organization target viewport count ${summary.postCheck.insideTargetViewportCount}/${summary.itemCount}`,
          groupLayoutSummary ? `Desktop organization executed group layout: ${groupLayoutSummary}` : '',
          postMoveGroupCheckSummary ? `Desktop organization post-check groups: ${postMoveGroupCheckSummary}` : '',
        ].filter(Boolean),
        ok: verified,
        plan,
        responseText: [
          verified
            ? summary.postCheck.matchedCount === summary.itemCount
              ? `已执行${scopeText}，并且复查结果与计划一致。`
              : `已执行${scopeText}；Windows 将部分图标吸附到桌面网格，但图标都留在目标屏幕范围内。`
            : `已尝试执行${scopeText}，但复查结果没有完全对上计划。`,
          summarizeDesktopIconMoveSummary(summary, verificationMode),
        ].join('\n'),
        started: true,
        verification,
      };
    } catch (error) {
      const responseText = `桌面整理演出启动失败：${error instanceof Error ? error.message : String(error)}`;
      addLog(responseText);
      pushFrontendRuntimeLog('agent-desktop-organization', 'showcase start failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return createDesktopOrganizationFailureResult(responseText);
    }
  }, [
    addLog,
    clearDismissTimer,
    moveDesktopIconPlanItems,
    onSetAction,
    preview,
  ]);

  const startRelativePlacement = useCallback(async (
    placement: AgentDesktopIconPlacementCommand,
  ): Promise<DesktopOrganizationShowcaseStartResult> => {
    clearDismissTimer();

    if (!desktopPetShellRuntime.isDesktopMode()) {
      const responseText = '桌面图标整理需要在桌面版中运行。';
      addLog(responseText);
      return {
        responseText,
        started: false,
      };
    }

    try {
      const icons = await desktopPetShellRuntime.listDesktopIcons({
        coordinateSpace: 'native-screen',
        forceRefresh: true,
      });
      const normalizedIcons = Array.isArray(icons) ? icons : [];

      if (normalizedIcons.length === 0) {
        const fallbackIcons = await desktopPetShellRuntime.listDesktopIcons({
          coordinateSpace: 'native-screen',
          forceRefresh: true,
          includeFileSystemFallback: true,
          includeReadOnlyPositionFallback: true,
        });
        const readOnlyPositionCount = Array.isArray(fallbackIcons)
          ? fallbackIcons.filter((icon) => icon.positionSource === 'ui-automation').length
          : 0;
        const fallbackCount = Array.isArray(fallbackIcons)
          ? fallbackIcons.filter((icon) => icon.positionSource === 'filesystem-fallback').length
          : 0;
        const responseText = readOnlyPositionCount > 0
          ? `已读取到 ${readOnlyPositionCount} 个可见桌面图标坐标，但当前移动器没有拿到可移动的 Explorer 图标索引，所以暂时不能执行整理。`
          : fallbackCount > 0
          ? `读取到 ${fallbackCount} 个桌面文件，但没有读取到可移动的桌面图标坐标。请先确认 Windows 桌面图标处于显示状态，或重启 Explorer 后再试。`
          : '没有读取到可整理的桌面图标。';
        addLog(responseText);
        return {
          responseText,
          started: false,
        };
      }

      const result = createDesktopIconRelativePlacementPlan({
        anchorName: placement.anchorName,
        direction: placement.direction,
        icons: normalizedIcons,
        targetName: placement.targetName,
        viewport: shellViewport,
      });

      if (!result.plan) {
        const roleText = result.missingRole === 'anchor' ? '参考图标' : '目标图标';
        const responseText = `没有找到${roleText}「${result.missingName ?? ''}」。`;
        addLog(responseText);
        return {
          responseText,
          started: false,
        };
      }

      setRun({
        plan: result.plan,
        startedAt: Date.now(),
        status: 'running',
      });
      onSetAction('WALKING');

      const directionLabel = RELATIVE_PLACEMENT_DIRECTION_LABELS[placement.direction];
      const responseText = `已开始把「${result.targetIconName}」整理到「${result.anchorIconName}」${directionLabel}。`;
      addLog(responseText);
      pushFrontendRuntimeLog('agent-desktop-organization', 'relative placement showcase started', {
        anchorName: result.anchorIconName,
        direction: placement.direction,
        targetName: result.targetIconName,
      });

      const item = result.plan.items[0] ?? null;
      if (!item) {
        return {
          responseText: '没有生成可执行的图标移动计划。',
          started: false,
        };
      }

      const summary = await moveDesktopIconPlanItems(result.plan);
      const verificationMode: DesktopIconMoveVerificationMode = 'precise-placement';
      const verified = isDesktopIconMoveSummaryVerified(summary, verificationMode);
      const verification = createDesktopIconMoveVerification(summary, verificationMode);
      const followUp = createDesktopIconMoveFollowUp(summary, verificationMode);
      addLog(`单个图标整理完成：复查命中 ${summary.postCheck.matchedCount}/${summary.itemCount} 个图标。`);

      const finalText = verified
        ? `已把「${result.targetIconName}」移动到「${result.anchorIconName}」${directionLabel}。`
        : `我已经尝试把「${result.targetIconName}」移动到「${result.anchorIconName}」${directionLabel}，但复查结果没有对上目标坐标。`;

      return {
        followUp,
        observations: [
          `Desktop icon placement post-check matched ${summary.postCheck.matchedCount}/${summary.itemCount}`,
          `Target icon: ${result.targetIconName}; anchor icon: ${result.anchorIconName}`,
        ],
        ok: verified,
        plan: result.plan,
        responseText: [
          finalText,
          summarizeDesktopIconMoveSummary(summary, verificationMode),
        ].join('\n'),
        started: true,
        verification,
      };
    } catch (error) {
      const responseText = `桌面图标整理启动失败：${error instanceof Error ? error.message : String(error)}`;
      addLog(responseText);
      pushFrontendRuntimeLog('agent-desktop-organization', 'relative placement showcase start failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        responseText,
        started: false,
      };
    }
  }, [
    addLog,
    clearDismissTimer,
    moveDesktopIconPlanItems,
    onSetAction,
    shellViewport,
  ]);

  const complete = useCallback(() => {
    setRun((currentRun) => {
      if (!currentRun || currentRun.status === 'completed') {
        return currentRun;
      }

      return {
        ...currentRun,
        status: 'completed',
      };
    });
    onSetAction('HAPPY');
    addLog('桌面整理演出完成。');
    pushFrontendRuntimeLog('agent-desktop-organization', 'showcase completed');
    clearDismissTimer();
    dismissTimerRef.current = window.setTimeout(() => {
      setRun(null);
      dismissTimerRef.current = null;
    }, 1800);
  }, [
    addLog,
    clearDismissTimer,
    onSetAction,
  ]);

  const cancel = useCallback(() => {
    clearDismissTimer();
    setRun(null);
    onSetAction('IDLE');
    addLog('桌面整理演出已取消。');
    pushFrontendRuntimeLog('agent-desktop-organization', 'showcase cancelled');
  }, [
    addLog,
    clearDismissTimer,
    onSetAction,
  ]);

  return {
    cancel,
    complete,
    isRunning: run?.status === 'running',
    preview,
    run,
    start,
    startRelativePlacement,
  };
}
