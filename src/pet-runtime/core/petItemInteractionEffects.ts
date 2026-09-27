import { type FolderItem, type PetItemInteractionType, type PetStats } from '../../types';
import { applyFoodConsumedStats } from '../../components/pet/petStatsMath';

export function resolvePetItemInteractionEffects(
  folders: FolderItem[],
  stats: PetStats,
  folder: FolderItem,
  interactionType: PetItemInteractionType,
  positionOverride?: { x: number; y: number },
  shouldRemoveItem = interactionType === 'eat',
) {
  const nextFolders = shouldRemoveItem
    ? folders.filter((item) => item.id !== folder.id)
    : folders.map((item) => (
        item.id === folder.id && positionOverride
          ? { ...item, position: positionOverride }
          : item
      ));
  const nextStats = interactionType === 'eat'
    ? applyFoodConsumedStats(stats)
    : interactionType === 'toy'
      ? { ...stats, affection: Math.min(100, stats.affection + 5) }
      : stats;
  return { folders: nextFolders, stats: nextStats };
}
