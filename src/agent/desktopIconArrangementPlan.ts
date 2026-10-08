import {
  DEFAULT_MARGIN,
  deriveViewportFromIcons,
  resolveColumnCount,
  createArrangementRect,
  clampArrangementOrigin,
  createDesktopIconGrid,
  snapOriginToViewportGrid,
  resolveRelativePlacementPosition,
} from './iconArrangement/layoutGeometry';
import { type AgentDesktopIconPlacementDirection } from './agentChatCommand';
import {
  classifyDesktopItem,
  createDesktopItemClassificationGroups,
  getDesktopItemGroupKey,
  getDesktopItemGroupLabel,
  getDesktopItemGroupOrder,
  summarizeDesktopItemClassificationGroups,
  type DesktopItemClassification,
  type DesktopItemClassificationGroup,
  type DesktopItemGroupBy,
} from './desktopItemClassification';

const DEFAULT_CELL_HEIGHT = 92;
const DEFAULT_CELL_WIDTH = 112;
const DEFAULT_RELATIVE_GAP = 14;
const DEFAULT_MAX_COLUMNS = 8;

export interface DesktopIconArrangementRect {
  centerX: number;
  centerY: number;
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface DesktopIconArrangementViewport {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface DesktopIconArrangementGrid {
  cellHeight: number;
  cellWidth: number;
  originX: number;
  originY: number;
}

export interface DesktopIconArrangementItem {
  classification?: DesktopItemClassification;
  from: DesktopIconArrangementRect;
  groupKey?: string;
  groupLabel?: string;
  iconId: string;
  iconName: string;
  index: number;
  to: DesktopIconArrangementRect;
}

export interface DesktopIconArrangementGrouping {
  groupBy: DesktopItemGroupBy;
  groups: DesktopItemClassificationGroup[];
  layouts?: DesktopIconArrangementGroupLayout[];
  summary: string;
}

export interface DesktopIconArrangementGroupLayout {
  columns: number;
  count: number;
  endIndex: number;
  endRow: number;
  groupKey: string;
  groupLabel: string;
  rows: number;
  startIndex: number;
  startRow: number;
}

export interface DesktopIconArrangementPlan {
  cellHeight: number;
  cellWidth: number;
  columns: number;
  createdAt: number;
  displayLabel?: string;
  grid?: DesktopIconArrangementGrid;
  grouping?: DesktopIconArrangementGrouping;
  id: string;
  items: DesktopIconArrangementItem[];
  rows: number;
  viewport: DesktopIconArrangementViewport;
}

export interface CreateDesktopIconArrangementPlanOptions {
  cellHeight?: number;
  cellWidth?: number;
  groupBy?: DesktopItemGroupBy;
  icons: DesktopPetDesktopIconLike[];
  maxColumns?: number;
  targetOrigin?: { x: number; y: number };
  viewport?: DesktopIconArrangementViewport;
}

export interface CreateDesktopIconRelativePlacementPlanOptions {
  anchorName: string;
  cellHeight?: number;
  cellWidth?: number;
  direction: AgentDesktopIconPlacementDirection;
  gap?: number;
  icons: DesktopPetDesktopIconLike[];
  targetName: string;
  viewport?: DesktopIconArrangementViewport;
}

export interface DesktopIconRelativePlacementPlanResult {
  anchorIconName: string;
  missingName?: string;
  missingRole?: 'anchor' | 'target';
  plan: DesktopIconArrangementPlan | null;
  targetIconName: string;
}

function normalizePositiveInteger(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.round(value as number));
}

function normalizeIcon(icon: DesktopPetDesktopIconLike) {
  const x = Number(icon.x);
  const y = Number(icon.y);
  const width = Number(icon.width);
  const height = Number(icon.height);
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }

  return {
    ...icon,
    height: Math.max(1, Math.round(height)),
    width: Math.max(1, Math.round(width)),
    x: Math.round(x),
    y: Math.round(y),
  };
}

function compareIconsByDesktopPosition(
  firstIcon: DesktopPetDesktopIconLike,
  secondIcon: DesktopPetDesktopIconLike,
) {
  const yDelta = firstIcon.y - secondIcon.y;
  if (Math.abs(yDelta) > 12) {
    return yDelta;
  }

  return firstIcon.x - secondIcon.x;
}

function compareIconsByDesktopName(
  firstIcon: DesktopPetDesktopIconLike,
  secondIcon: DesktopPetDesktopIconLike,
) {
  return firstIcon.name.localeCompare(secondIcon.name, 'zh-CN')
    || firstIcon.index - secondIcon.index;
}

function resolveDesktopIconGrouping(
  icons: DesktopPetDesktopIconLike[],
  groupBy: DesktopItemGroupBy | undefined,
) {
  const resolvedGroupBy = groupBy && groupBy !== 'none' ? groupBy : 'none';
  const classifiedIcons = icons.map((icon) => ({
    classification: classifyDesktopItem(icon),
    icon,
  }));

  if (resolvedGroupBy === 'none') {
    return {
      classifiedIcons: classifiedIcons.sort((first, second) => (
        compareIconsByDesktopPosition(first.icon, second.icon)
      )),
      grouping: undefined,
    };
  }

  const sortedClassifiedIcons = classifiedIcons.sort((first, second) => {
    const firstOrder = getDesktopItemGroupOrder(first.classification, resolvedGroupBy);
    const secondOrder = getDesktopItemGroupOrder(second.classification, resolvedGroupBy);
    return firstOrder - secondOrder
      || getDesktopItemGroupLabel(first.classification, resolvedGroupBy)
        .localeCompare(getDesktopItemGroupLabel(second.classification, resolvedGroupBy), 'zh-CN')
      || compareIconsByDesktopName(first.icon, second.icon)
      || compareIconsByDesktopPosition(first.icon, second.icon);
  });
  const groups = createDesktopItemClassificationGroups(
    sortedClassifiedIcons.map((item) => item.classification),
    resolvedGroupBy,
  );

  return {
    classifiedIcons: sortedClassifiedIcons,
    grouping: {
      groupBy: resolvedGroupBy,
      groups,
      summary: summarizeDesktopItemClassificationGroups(groups),
    } satisfies DesktopIconArrangementGrouping,
  };
}

function normalizeIconSearchText(value: string) {
  return value
    .trim()
    .replace(/\.[a-z0-9]+$/iu, '')
    .replace(/\s+/g, '')
    .replace(/[()[\]{}【】（）「」『』"'“”‘’·._\-—:：，。,、]/gu, '')
    .toLowerCase();
}

function scoreIconNameMatch(iconName: string, query: string) {
  const normalizedIconName = normalizeIconSearchText(iconName);
  const normalizedQuery = normalizeIconSearchText(query);

  if (!normalizedIconName || !normalizedQuery) {
    return 0;
  }

  if (normalizedIconName === normalizedQuery) {
    return 100;
  }

  if (normalizedIconName.startsWith(normalizedQuery)) {
    return 82;
  }

  if (normalizedIconName.includes(normalizedQuery)) {
    return 68;
  }

  if (normalizedQuery.includes(normalizedIconName)) {
    return 48;
  }

  return 0;
}

function findBestDesktopIconByName(
  icons: DesktopPetDesktopIconLike[],
  query: string,
  excludedIconId?: string,
) {
  return icons
    .map((icon) => ({
      icon,
      score: icon.id === excludedIconId ? 0 : scoreIconNameMatch(icon.name, query),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((first, second) => (
      second.score - first.score
      || first.icon.name.length - second.icon.name.length
      || first.icon.index - second.icon.index
    ))[0]?.icon ?? null;
}

function createDesktopIconArrangementSlots(
  arrangedIcons: Array<{
    classification: DesktopItemClassification;
    icon: DesktopPetDesktopIconLike;
  }>,
  groupBy: DesktopItemGroupBy | undefined,
  columns: number,
) {
  const resolvedGroupBy = groupBy && groupBy !== 'none' ? groupBy : undefined;
  if (!resolvedGroupBy) {
    return {
      groupLayouts: undefined,
      slots: arrangedIcons.map((item, index) => ({
        ...item,
        column: index % columns,
        index,
        row: Math.floor(index / columns),
      })),
      totalRows: Math.max(1, Math.ceil(arrangedIcons.length / columns)),
    };
  }

  const slots: Array<{
    classification: DesktopItemClassification;
    column: number;
    icon: DesktopPetDesktopIconLike;
    index: number;
    row: number;
  }> = [];
  const groupLayouts: DesktopIconArrangementGroupLayout[] = [];
  let cursorIndex = 0;
  let cursorRow = 0;

  for (let index = 0; index < arrangedIcons.length;) {
    const firstItem = arrangedIcons[index];
    if (!firstItem) {
      break;
    }

    const groupKey = getDesktopItemGroupKey(firstItem.classification, resolvedGroupBy);
    const groupLabel = getDesktopItemGroupLabel(firstItem.classification, resolvedGroupBy);
    const groupItems = [];
    while (index < arrangedIcons.length) {
      const candidate = arrangedIcons[index];
      if (!candidate || getDesktopItemGroupKey(candidate.classification, resolvedGroupBy) !== groupKey) {
        break;
      }

      groupItems.push(candidate);
      index += 1;
    }

    const groupRows = Math.max(1, Math.ceil(groupItems.length / columns));
    const startIndex = cursorIndex;
    const startRow = cursorRow;
    groupItems.forEach((item, groupIndex) => {
      slots.push({
        ...item,
        column: groupIndex % columns,
        index: cursorIndex,
        row: cursorRow + Math.floor(groupIndex / columns),
      });
      cursorIndex += 1;
    });

    groupLayouts.push({
      columns: Math.min(columns, groupItems.length || 1),
      count: groupItems.length,
      endIndex: cursorIndex - 1,
      endRow: cursorRow + groupRows - 1,
      groupKey,
      groupLabel,
      rows: groupRows,
      startIndex,
      startRow,
    });
    cursorRow += groupRows;
  }

  return {
    groupLayouts,
    slots,
    totalRows: Math.max(1, cursorRow),
  };
}

export function createDesktopIconArrangementPlan({
  cellHeight,
  cellWidth,
  groupBy,
  icons,
  maxColumns,
  targetOrigin,
  viewport,
}: CreateDesktopIconArrangementPlanOptions): DesktopIconArrangementPlan {
  const normalizedIcons = icons
    .map(normalizeIcon)
    .filter((icon): icon is DesktopPetDesktopIconLike => icon !== null);
  const groupingResult = resolveDesktopIconGrouping(normalizedIcons, groupBy);
  const arrangedIcons = groupingResult.classifiedIcons;
  const resolvedViewport = viewport ?? deriveViewportFromIcons(normalizedIcons);
  const fallbackCellWidth = normalizePositiveInteger(cellWidth, DEFAULT_CELL_WIDTH);
  const fallbackCellHeight = normalizePositiveInteger(cellHeight, DEFAULT_CELL_HEIGHT);
  const grid = createDesktopIconGrid(
    normalizedIcons,
    resolvedViewport,
    fallbackCellWidth,
    fallbackCellHeight,
  );
  const resolvedCellWidth = grid?.cellWidth ?? fallbackCellWidth;
  const resolvedCellHeight = grid?.cellHeight ?? fallbackCellHeight;
  const resolvedMaxColumns = normalizePositiveInteger(maxColumns, DEFAULT_MAX_COLUMNS);
  const gridMargin = grid ? 0 : DEFAULT_MARGIN;
  const columns = resolveColumnCount({
    cellWidth: resolvedCellWidth,
    itemCount: normalizedIcons.length,
    margin: gridMargin,
    maxColumns: resolvedMaxColumns,
    viewportWidth: resolvedViewport.width,
  });
  const arrangementSlots = createDesktopIconArrangementSlots(
    arrangedIcons,
    groupBy,
    columns,
  );
  const origin = targetOrigin ?? {
    x: grid?.originX ?? resolvedViewport.x + DEFAULT_MARGIN,
    y: grid?.originY ?? resolvedViewport.y + DEFAULT_MARGIN,
  };
  const clampedOriginCandidate = clampArrangementOrigin({
    cellHeight: resolvedCellHeight,
    cellWidth: resolvedCellWidth,
    columns,
    itemCount: arrangementSlots.totalRows * columns,
    margin: gridMargin,
    origin,
    viewport: resolvedViewport,
  });
  const clampedOrigin = grid
    ? snapOriginToViewportGrid({
        grid,
        origin: clampedOriginCandidate,
        viewport: resolvedViewport,
      })
    : clampedOriginCandidate;

  const items = arrangementSlots.slots.map(({ classification, column, icon, index, row }) => {
    const resolvedGroupBy = groupBy && groupBy !== 'none' ? groupBy : undefined;
    return {
      classification,
      from: createArrangementRect(icon.x, icon.y, icon.width, icon.height),
      groupKey: resolvedGroupBy ? getDesktopItemGroupKey(classification, resolvedGroupBy) : undefined,
      groupLabel: resolvedGroupBy ? getDesktopItemGroupLabel(classification, resolvedGroupBy) : undefined,
      iconId: icon.id || `desktop-icon-${icon.index}`,
      iconName: icon.name || `Desktop item ${icon.index + 1}`,
      index,
      to: createArrangementRect(
        clampedOrigin.x + column * resolvedCellWidth,
        clampedOrigin.y + row * resolvedCellHeight,
        icon.width,
        icon.height,
      ),
    };
  });

  return {
    cellHeight: resolvedCellHeight,
    cellWidth: resolvedCellWidth,
    columns,
    createdAt: Date.now(),
    grid: grid ?? undefined,
    grouping: groupingResult.grouping
      ? {
          ...groupingResult.grouping,
          layouts: arrangementSlots.groupLayouts,
        }
      : undefined,
    id: `desktop-icon-arrangement-${Date.now()}-${items.length}`,
    items,
    rows: arrangementSlots.totalRows,
    viewport: resolvedViewport,
  };
}

export function createDesktopIconRelativePlacementPlan({
  anchorName,
  cellHeight,
  cellWidth,
  direction,
  gap,
  icons,
  targetName,
  viewport,
}: CreateDesktopIconRelativePlacementPlanOptions): DesktopIconRelativePlacementPlanResult {
  const normalizedIcons = icons
    .map(normalizeIcon)
    .filter((icon): icon is DesktopPetDesktopIconLike => icon !== null);
  const targetIcon = findBestDesktopIconByName(normalizedIcons, targetName);

  if (!targetIcon) {
    return {
      anchorIconName: anchorName,
      missingName: targetName,
      missingRole: 'target',
      plan: null,
      targetIconName: targetName,
    };
  }

  const anchorIcon = findBestDesktopIconByName(normalizedIcons, anchorName, targetIcon.id);

  if (!anchorIcon) {
    return {
      anchorIconName: anchorName,
      missingName: anchorName,
      missingRole: 'anchor',
      plan: null,
      targetIconName: targetIcon.name,
    };
  }

  const resolvedViewport = viewport ?? deriveViewportFromIcons(normalizedIcons);
  const resolvedCellWidth = normalizePositiveInteger(cellWidth, DEFAULT_CELL_WIDTH);
  const resolvedCellHeight = normalizePositiveInteger(cellHeight, DEFAULT_CELL_HEIGHT);
  const resolvedGap = normalizePositiveInteger(gap, DEFAULT_RELATIVE_GAP);
  const nextPosition = resolveRelativePlacementPosition({
    anchorIcon,
    direction,
    gap: resolvedGap,
    targetIcon,
    viewport: resolvedViewport,
  });
  const item: DesktopIconArrangementItem = {
    from: createArrangementRect(targetIcon.x, targetIcon.y, targetIcon.width, targetIcon.height),
    iconId: targetIcon.id || `desktop-icon-${targetIcon.index}`,
    iconName: targetIcon.name || targetName,
    index: 0,
    to: createArrangementRect(nextPosition.x, nextPosition.y, targetIcon.width, targetIcon.height),
  };

  return {
    anchorIconName: anchorIcon.name || anchorName,
    plan: {
      cellHeight: resolvedCellHeight,
      cellWidth: resolvedCellWidth,
      columns: 1,
      createdAt: Date.now(),
      id: `desktop-icon-placement-${Date.now()}-${item.iconId}`,
      items: [item],
      rows: 1,
      viewport: resolvedViewport,
    },
    targetIconName: targetIcon.name || targetName,
  };
}

export function summarizeDesktopIconArrangementPlan(plan: DesktopIconArrangementPlan) {
  return {
    columns: plan.columns,
    itemCount: plan.items.length,
    rows: plan.rows,
  };
}
