import { type SkillTimelineEditorStripRow } from './settingsSkillTimelineStripModel';

export interface SkillTimelineStripCollisionSummary {
  collisionStepIds: string[];
  rowCollisionCounts: Record<string, number>;
}

function stepsOverlap(aStartMs: number, aEndMs: number, bStartMs: number, bEndMs: number) {
  if (aEndMs <= aStartMs && bEndMs <= bStartMs) {
    return aStartMs === bStartMs;
  }

  return aStartMs < bEndMs && bStartMs < aEndMs;
}

export function createSkillTimelineStripCollisionSummary(
  rows: SkillTimelineEditorStripRow[],
): SkillTimelineStripCollisionSummary {
  const collisionStepIds = new Set<string>();
  const rowCollisionCounts: Record<string, number> = {};

  rows.forEach((row) => {
    const rowCollisionIds = new Set<string>();
    for (let index = 0; index < row.items.length; index += 1) {
      for (let compareIndex = index + 1; compareIndex < row.items.length; compareIndex += 1) {
        const item = row.items[index];
        const compareItem = row.items[compareIndex];
        if (!item || !compareItem || !stepsOverlap(item.delayMs, item.endMs, compareItem.delayMs, compareItem.endMs)) {
          continue;
        }

        collisionStepIds.add(item.id);
        collisionStepIds.add(compareItem.id);
        rowCollisionIds.add(item.id);
        rowCollisionIds.add(compareItem.id);
      }
    }

    if (rowCollisionIds.size > 0) {
      rowCollisionCounts[row.id] = rowCollisionIds.size;
    }
  });

  return {
    collisionStepIds: Array.from(collisionStepIds),
    rowCollisionCounts,
  };
}
