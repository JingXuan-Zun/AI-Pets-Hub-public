export const INITIAL_LOGS = [
  '\u5f15\u64ce\u5c31\u7eea...',
  '\u6a21\u578b\u52a0\u8f7d\u6210\u529f',
  '\u4eba\u683c\u6a21\u5757\uff1a\u6b63\u5728\u68c0\u7d22\u8bb0\u5fc6\u5e93...',
  '\u6b63\u5728\u76d1\u542c\u684c\u9762\u4e8b\u4ef6...',
];

export const LOW_ENERGY_LOG = '\u7cfb\u7edf\u8b66\u544a\uff1a\u80fd\u91cf\u6c34\u5e73\u8fc7\u4f4e\u3002';
export const RESET_FOOD_LOG = '\u684c\u9762\u98df\u7269\u70b9\u4f4d\u5df2\u91cd\u7f6e\u3002';
export const MAX_LOG_ENTRIES = 240;
export const PRIMARY_PET_EAT_CONFIRM_RADIUS = 220;

export function measureDistance(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  return Math.sqrt(dx * dx + dy * dy);
}
