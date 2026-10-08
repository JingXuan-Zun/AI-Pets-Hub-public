import type { AgentDesktopIconPlacementDirection } from '../agentChatCommand';
import type { DesktopIconArrangementRect, DesktopIconArrangementViewport, DesktopIconArrangementGrid } from '../desktopIconArrangementPlan';

export const DEFAULT_MARGIN = 32;

function normalizeOptionalPositiveInteger(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0
    ? Math.round(numericValue)
    : null;
}

export function deriveViewportFromIcons(icons: DesktopPetDesktopIconLike[]): DesktopIconArrangementViewport {
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

export function resolveColumnCount(options: {
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

export function createArrangementRect(
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

function clampCoordinate(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function clampArrangementOrigin(options: {
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

export function createDesktopIconGrid(
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

export function snapOriginToViewportGrid(options: {
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

export function resolveRelativePlacementPosition(options: {
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
