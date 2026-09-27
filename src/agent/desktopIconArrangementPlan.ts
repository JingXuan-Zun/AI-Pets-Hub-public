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
const DEFAULT_MARGIN = 32;
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

function normalizeOptionalPositiveInteger(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.round(numericValue)
    : null;
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

function deriveViewportFromIcons(icons: DesktopPetDesktopIconLike[]): DesktopIconArrangementViewport {
  if (!icons.length) {
    return {
      height: 1,
      width: 1,
      x: 0,
      y: 0,
    };
  }

  const left = Math.min(...icons.map((icon) => icon.x));
  const top = Math.min(...icons.map((icon) => icon.y));
  const right = Math.max(...icons.map((icon) => icon.x + icon.width));
  const bottom = Math.max(...icons.map((icon) => icon.y + icon.height));

  return {
    height: Math.max(1, bottom - top + DEFAULT_MARGIN * 2),
    width: Math.max(1, right - left + DEFAULT_MARGIN * 2),
    x: Math.max(0, left - DEFAULT_MARGIN),
    y: Math.max(0, top - DEFAULT_MARGIN),
  };
}

function resolveColumnCount(options: {
  cellWidth: number;
  itemCount: number;
  margin?: number;
  maxColumns: number;
  viewportWidth: number;
}) {
  const margin = Math.max(0, Math.round(options.margin ?? DEFAULT_MARGIN));
  const availableColumns = Math.max(1, Math.floor((options.viewportWidth - margin * 2) / options.cellWidth));
  return Math.max(1, Math.min(options.itemCount || 1, options.maxColumns, availableColumns));
}

function createArrangementRect(
  x: number,
  y: number,
  width: number,
  height: number,
): DesktopIconArrangementRect {
  return {
    centerX: Math.round(x + width / 2),
    centerY: Math.round(y + height / 2),
    height,
    width,
    x: Math.round(x),
    y: Math.round(y),
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

function clampCoordinate(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function clampArrangementOrigin(options: {
  cellHeight: number;
  cellWidth: number;
  columns: number;
  itemCount: number;
  margin?: number;
  origin: { x: number; y: number };
  viewport: DesktopIconArrangementViewport;
}) {
  const margin = Math.max(0, Math.round(options.margin ?? DEFAULT_MARGIN));
  const rows = Math.max(1, Math.ceil(options.itemCount / Math.max(1, options.columns)));
  const planWidth = options.columns * options.cellWidth;
  const planHeight = rows * options.cellHeight;
  const minX = options.viewport.x + margin;
  const minY = options.viewport.y + margin;
  const maxX = options.viewport.x + Math.max(margin, options.viewport.width - planWidth - margin);
  const maxY = options.viewport.y + Math.max(margin, options.viewport.height - planHeight - margin);

  return {
    x: clampCoordinate(options.origin.x, minX, maxX),
    y: clampCoordinate(options.origin.y, minY, maxY),
  };
}

function getMostCommonPositiveInteger(values: Array<number | null>) {
  const counts = new Map<number, number>();
  for (const value of values) {
    if (!value || value <= 0) {
      continue;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((first, second) => second[1] - first[1] || second[0] - first[0])[0]?.[0] ?? null;
}

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor;
}

function inferGridOriginCoordinate(options: {
  cellSize: number;
  fallback: number;
  positions: number[];
  viewportStart: number;
}) {
  const residues = new Map<number, number>();
  for (const position of options.positions) {
    const residue = positiveModulo(position - options.viewportStart, options.cellSize);
    residues.set(residue, (residues.get(residue) ?? 0) + 1);
  }

  const bestResidue = Array.from(residues.entries())
    .sort((first, second) => second[1] - first[1] || first[0] - second[0])[0]?.[0];

  if (typeof bestResidue === 'number') {
    return Math.round(options.viewportStart + bestResidue);
  }

  return options.fallback;
}

function createDesktopIconGrid(
  icons: DesktopPetDesktopIconLike[],
  viewport: DesktopIconArrangementViewport,
  fallbackCellWidth: number,
  fallbackCellHeight: number,
): DesktopIconArrangementGrid | null {
  const cellWidth = getMostCommonPositiveInteger(
    icons.map((icon) => normalizeOptionalPositiveInteger(icon.desktopGridCellWidth)),
  );
  const cellHeight = getMostCommonPositiveInteger(
    icons.map((icon) => normalizeOptionalPositiveInteger(icon.desktopGridCellHeight)),
  );

  if (!cellWidth || !cellHeight) {
    return null;
  }

  return {
    cellHeight,
    cellWidth,
    originX: inferGridOriginCoordinate({
      cellSize: cellWidth,
      fallback: viewport.x + DEFAULT_MARGIN,
      positions: icons.map((icon) => icon.x),
      viewportStart: viewport.x,
    }),
    originY: inferGridOriginCoordinate({
      cellSize: cellHeight,
      fallback: viewport.y + DEFAULT_MARGIN,
      positions: icons.map((icon) => icon.y),
      viewportStart: viewport.y,
    }),
  };
}

function snapCoordinateToGrid(value: number, origin: number, cellSize: number) {
  if (!Number.isFinite(value) || !Number.isFinite(origin) || !Number.isFinite(cellSize) || cellSize <= 0) {
    return Math.round(value);
  }

  return Math.round(origin + Math.round((value - origin) / cellSize) * cellSize);
}

function snapOriginToViewportGrid(options: {
  grid: DesktopIconArrangementGrid;
  origin: { x: number; y: number };
  viewport: DesktopIconArrangementViewport;
}) {
  const x = snapCoordinateToGrid(options.origin.x, options.grid.originX, options.grid.cellWidth);
  const y = snapCoordinateToGrid(options.origin.y, options.grid.originY, options.grid.cellHeight);

  return {
    x: clampCoordinate(x, options.viewport.x, options.viewport.x + options.viewport.width - options.grid.cellWidth),
    y: clampCoordinate(y, options.viewport.y, options.viewport.y + options.viewport.height - options.grid.cellHeight),
  };
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

function resolveRelativePlacementPosition(options: {
  anchorIcon: DesktopPetDesktopIconLike;
  direction: AgentDesktopIconPlacementDirection;
  gap: number;
  targetIcon: DesktopPetDesktopIconLike;
  viewport: DesktopIconArrangementViewport;
}) {
  const {
    anchorIcon,
    direction,
    gap,
    targetIcon,
    viewport,
  } = options;
  let x = anchorIcon.x;
  let y = anchorIcon.y;

  if (direction === 'below') {
    x = anchorIcon.x;
    y = anchorIcon.y + anchorIcon.height + gap;
  } else if (direction === 'above') {
    x = anchorIcon.x;
    y = anchorIcon.y - targetIcon.height - gap;
  } else if (direction === 'left-of') {
    x = anchorIcon.x - targetIcon.width - gap;
    y = anchorIcon.y;
  } else if (direction === 'right-of') {
    x = anchorIcon.x + anchorIcon.width + gap;
    y = anchorIcon.y;
  }

  return {
    x: clampCoordinate(
      x,
      viewport.x + DEFAULT_MARGIN / 2,
      viewport.x + viewport.width - targetIcon.width - DEFAULT_MARGIN / 2,
    ),
    y: clampCoordinate(
      y,
      viewport.y + DEFAULT_MARGIN / 2,
      viewport.y + viewport.height - targetIcon.height - DEFAULT_MARGIN / 2,
    ),
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
