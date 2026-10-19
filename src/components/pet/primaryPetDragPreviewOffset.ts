import { type Position } from './petActivityRegionMath';

/**
 * 拖动主桌宠时，PetAvatarLayer 直接改 DOM transform 预览位置，React 里的正式位置要到松手才更新。
 * 跟随桌宠的浮层（头顶气泡等）订阅这里拿到「预览位置 - 正式位置」的偏移，
 * 自己平移同样的距离；松手后偏移为 null，浮层回到按正式位置定位。
 * 只改订阅者自己的 DOM，不触发 React 重新渲染。
 */
type OffsetListener = (offset: Position | null) => void;

const listeners = new Set<OffsetListener>();
let currentOffset: Position | null = null;

export function publishPrimaryPetDragPreviewOffset(offset: Position | null) {
  if (offset === currentOffset) return;
  if (offset && currentOffset && offset.x === currentOffset.x && offset.y === currentOffset.y) return;
  currentOffset = offset;
  listeners.forEach((listener) => listener(offset));
}

export function subscribePrimaryPetDragPreviewOffset(listener: OffsetListener) {
  listeners.add(listener);
  listener(currentOffset);
  return () => {
    listeners.delete(listener);
  };
}
