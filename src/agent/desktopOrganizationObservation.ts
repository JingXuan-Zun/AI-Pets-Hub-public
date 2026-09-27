import { type AgentDesktopOrganizationCommand } from './agentChatCommand';
import { type DesktopIconArrangementViewport } from './desktopIconArrangementPlan';
import {
  formatDisplayResolutionSummary,
  formatDisplayRect,
  getDisplayDesktopIconCoordinateViewport,
  getDisplayPhysicalSize,
} from './displayMetrics';

export interface DesktopOrganizationDisplayObservation {
  coordinateSpace: 'native-screen';
  iconCount: number;
  id: string;
  isPrimary: boolean;
  label: string;
  physicalSize: {
    height: number;
    width: number;
  };
  selectedIconCount: number;
  viewport: DesktopIconArrangementViewport;
}

export interface DesktopOrganizationIconPositionSourceObservation {
  count: number;
  movableCount: number;
  readOnlyCount: number;
  source: string;
}

export interface DesktopOrganizationIconPositionSourceSummary {
  fileFallbackIconCount: number;
  movableIconCount: number;
  readOnlyIconCount: number;
  sources: DesktopOrganizationIconPositionSourceObservation[];
  totalIconCount: number;
}

export interface DesktopOrganizationMovableFallbackSelection {
  icons: DesktopPetDesktopIconLike[];
  positionSummary: DesktopOrganizationIconPositionSourceSummary;
}

export interface DesktopOrganizationObservationEvidence {
  coordinateSpace: 'native-screen';
  displayCount: number;
  displayLines: string[];
  displays: DesktopOrganizationDisplayObservation[];
  iconCountLine: string;
  observations: string[];
  processingLine: string;
  selectedIconCount: number;
  selectedIconCountLine: string;
  summaryLine: string;
  targetDisplayLabel: string;
  targetIconCount: number;
  totalIconCount: number;
  willMoveAcrossDisplays: boolean;
}

export function normalizeDesktopOrganizationDisplayRect(
  display: DesktopPetDisplayLike,
): DesktopIconArrangementViewport {
  return getDisplayDesktopIconCoordinateViewport(display);
}

export function getDesktopOrganizationDisplayLabel(display: DesktopPetDisplayLike, index: number) {
  if (display.label) {
    return display.label;
  }

  return display.isPrimary ? '主屏' : `屏幕 ${index + 1}`;
}

export function findDesktopOrganizationTargetDisplay(
  displays: DesktopPetDisplayLike[],
  target: AgentDesktopOrganizationCommand['displayTarget'],
) {
  if (!displays.length || !target || target === 'all') {
    return null;
  }

  if (target === 'primary') {
    return displays.find((display) => display.isPrimary) ?? displays[0] ?? null;
  }

  if (target === 'secondary') {
    return displays.find((display) => !display.isPrimary) ?? null;
  }

  return null;
}

function normalizeDesktopIconPositionSource(icon: DesktopPetDesktopIconLike) {
  const source = typeof icon.positionSource === 'string' ? icon.positionSource.trim() : '';
  return source || 'unknown';
}

export function canMoveDesktopOrganizationIcon(icon: DesktopPetDesktopIconLike) {
  if (icon.canMove === true) {
    return true;
  }

  if (icon.canMove === false) {
    return false;
  }

  const source = normalizeDesktopIconPositionSource(icon);
  return source === 'shell-list-view' || source === 'folder-view';
}

export function createDesktopOrganizationIconPositionSourceSummary(
  icons: DesktopPetDesktopIconLike[],
): DesktopOrganizationIconPositionSourceSummary {
  const sources = new Map<string, DesktopOrganizationIconPositionSourceObservation>();
  let movableIconCount = 0;
  let readOnlyIconCount = 0;
  let fileFallbackIconCount = 0;

  for (const icon of icons) {
    const source = normalizeDesktopIconPositionSource(icon);
    const canMove = canMoveDesktopOrganizationIcon(icon);
    const current = sources.get(source) ?? {
      count: 0,
      movableCount: 0,
      readOnlyCount: 0,
      source,
    };

    current.count += 1;

    if (canMove) {
      current.movableCount += 1;
      movableIconCount += 1;
    } else {
      current.readOnlyCount += 1;
      readOnlyIconCount += 1;
    }

    if (source === 'filesystem-fallback') {
      fileFallbackIconCount += 1;
    }

    sources.set(source, current);
  }

  return {
    fileFallbackIconCount,
    movableIconCount,
    readOnlyIconCount,
    sources: Array.from(sources.values()).sort((first, second) => (
      second.count - first.count || first.source.localeCompare(second.source)
    )),
    totalIconCount: icons.length,
  };
}

export function selectMovableDesktopOrganizationFallbackIcons(
  icons: DesktopPetDesktopIconLike[],
): DesktopOrganizationMovableFallbackSelection {
  const normalizedIcons = Array.isArray(icons) ? icons : [];
  return {
    icons: normalizedIcons.filter(canMoveDesktopOrganizationIcon),
    positionSummary: createDesktopOrganizationIconPositionSourceSummary(normalizedIcons),
  };
}

export function formatDesktopOrganizationIconPositionSourceSummary(
  summary: DesktopOrganizationIconPositionSourceSummary,
) {
  const sourceText = summary.sources.length
    ? summary.sources.map((source) => (
      `${source.source} ${source.count} (movable ${source.movableCount}, read-only ${source.readOnlyCount})`
    )).join('; ')
    : 'none';

  return [
    `sources=${sourceText}`,
    `movable=${summary.movableIconCount}/${summary.totalIconCount}`,
    `readOnly=${summary.readOnlyIconCount}`,
    `fileFallback=${summary.fileFallbackIconCount}`,
  ].join('; ');
}

export function isDesktopIconInsideDesktopOrganizationViewport(
  icon: DesktopPetDesktopIconLike,
  viewport: DesktopIconArrangementViewport,
) {
  const centerX = Number(icon.centerX ?? icon.x + icon.width / 2);
  const centerY = Number(icon.centerY ?? icon.y + icon.height / 2);
  return centerX >= viewport.x
    && centerX <= viewport.x + viewport.width
    && centerY >= viewport.y
    && centerY <= viewport.y + viewport.height;
}

function countDesktopIconsInsideViewport(
  icons: DesktopPetDesktopIconLike[],
  viewport: DesktopIconArrangementViewport,
) {
  return icons.filter((icon) => isDesktopIconInsideDesktopOrganizationViewport(icon, viewport)).length;
}

function formatDisplayRole(display: DesktopOrganizationDisplayObservation) {
  return display.isPrimary ? '主屏' : '副屏';
}

export function createDesktopOrganizationObservationEvidence(options: {
  displays: DesktopPetDisplayLike[];
  effectiveScope: AgentDesktopOrganizationCommand['scope'];
  icons: DesktopPetDesktopIconLike[];
  selectedIcons?: DesktopPetDesktopIconLike[];
  selectedIconCount: number;
  targetDisplay: DesktopPetDisplayLike | null;
  targetDisplayLabel: string;
  targetViewport: DesktopIconArrangementViewport;
}): DesktopOrganizationObservationEvidence {
  const {
    displays,
    effectiveScope,
    icons,
    selectedIcons,
    selectedIconCount,
    targetDisplay,
    targetDisplayLabel,
    targetViewport,
  } = options;
  const resolvedSelectedIcons = selectedIcons ?? (
    selectedIconCount === icons.length ? icons : []
  );
  const displayObservations = displays.map((display, index) => {
    const viewport = normalizeDesktopOrganizationDisplayRect(display);
    return {
      coordinateSpace: 'native-screen' as const,
      iconCount: countDesktopIconsInsideViewport(icons, viewport),
      id: String(display.id),
      isPrimary: Boolean(display.isPrimary),
      label: getDesktopOrganizationDisplayLabel(display, index),
      physicalSize: getDisplayPhysicalSize(display),
      selectedIconCount: countDesktopIconsInsideViewport(resolvedSelectedIcons, viewport),
      viewport,
    };
  });
  const targetIconCount = targetDisplay
    ? countDesktopIconsInsideViewport(icons, targetViewport)
    : icons.length;
  const displayCount = displays.length;
  const totalIconCount = icons.length;
  const iconCountLine = displayObservations.length
    ? displayObservations
      .map((display) => `${display.label}（${formatDisplayRole(display)}） ${display.iconCount} 个`)
      .join('；')
    : `当前桌面区域 ${totalIconCount} 个`;
  const selectedIconCountLine = displayObservations.length
    ? displayObservations
      .map((display) => `${display.label}(${formatDisplayRole(display)}) ${display.selectedIconCount}`)
      .join('; ')
    : `current desktop area ${selectedIconCount}`;
  const displayLines = displayObservations.length
    ? displayObservations.map((display, index) => (
      `${index + 1}. ${display.label}（${formatDisplayRole(display)}）：物理分辨率 ${display.physicalSize.width} x ${display.physicalSize.height}，桌面图标坐标 ${formatDisplayRect(display.viewport)}，图标 ${display.iconCount} 个`
    ))
    : ['没有读取到显示器列表。'];
  const willMoveAcrossDisplays = Boolean(targetDisplay && effectiveScope === 'all-icons');
  const processingLine = targetDisplay
    ? willMoveAcrossDisplays
      ? `本次会把读取到的 ${selectedIconCount}/${totalIconCount} 个桌面图标整理到${targetDisplayLabel}。`
      : `本次只处理${targetDisplayLabel}范围内的 ${selectedIconCount}/${targetIconCount} 个图标，不移动其他屏幕图标。`
    : `本次会整理当前读取到的 ${selectedIconCount}/${totalIconCount} 个桌面图标。`;

  return {
    coordinateSpace: 'native-screen',
    displayCount,
    displayLines,
    displays: displayObservations,
    iconCountLine,
    observations: [
      'Desktop organization coordinate space: native-screen',
      `Desktop displays observed: ${displayCount}`,
      `Desktop icons observed: ${totalIconCount}`,
      `Desktop icons by display: ${iconCountLine}`,
      `Desktop selected icons by display: ${selectedIconCountLine}`,
      `Desktop organization target: ${targetDisplayLabel}`,
      `Desktop organization selected icons: ${selectedIconCount}`,
      `Desktop organization target viewport icons: ${targetIconCount}`,
      `Desktop organization target viewport: ${formatDisplayRect(targetViewport)}`,
      `Desktop organization cross-display move: ${willMoveAcrossDisplays ? 'yes' : 'no'}`,
      ...displays.map((display, index) => `Desktop display ${index + 1} metrics: ${formatDisplayResolutionSummary(display)}`),
    ],
    processingLine,
    selectedIconCount,
    selectedIconCountLine,
    summaryLine: `观察证据：检测到 ${displayCount || 0} 个显示器、${totalIconCount} 个桌面图标；${iconCountLine}。`,
    targetDisplayLabel,
    targetIconCount,
    totalIconCount,
    willMoveAcrossDisplays,
  };
}
