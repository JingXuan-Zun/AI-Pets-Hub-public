export const QUICK_MENU_SCALE = 0.75;
export const QUICK_MENU_BASE_WIDTH = 156;
export const QUICK_MENU_BASE_HEIGHT = 360;
export const QUICK_MENU_BUTTON_WIDTH = 108;
export const QUICK_MENU_BUTTON_HEIGHT = 74;
export const QUICK_MENU_BUTTON_CENTER_GAP = 50 / QUICK_MENU_SCALE;
export const QUICK_MENU_LAYOUT_WIDTH = Math.round(QUICK_MENU_BASE_WIDTH * QUICK_MENU_SCALE);
export const QUICK_MENU_LAYOUT_HEIGHT = Math.round(QUICK_MENU_BASE_HEIGHT * QUICK_MENU_SCALE);
export const QUICK_MENU_CONTENT_SCALE_DELTA = 0.7;
export const QUICK_MENU_CONTENT_SCALE = 1 + QUICK_MENU_CONTENT_SCALE_DELTA;
export const QUICK_MENU_ICON_SIZE = Math.round(15 * QUICK_MENU_CONTENT_SCALE);
export const QUICK_MENU_LABEL_FONT_SIZE = Math.round(10 * QUICK_MENU_CONTENT_SCALE * 10) / 10;
export const QUICK_MENU_CONTENT_GAP = Math.max(4, Math.round(4 * QUICK_MENU_CONTENT_SCALE));
export const QUICK_SUB_PANEL_WIDTH = 188;
export const PET_QUICK_ACTION_PANEL_WIDTH = 424;
export const QUICK_MENU_NATIVE_SHAPE_PADDING = 48;

export const QUICK_MENU_ITEM_LAYOUTS = [
  {
    id: 'settings',
    rotation: -8,
    translateX: 0,
    translateY: -QUICK_MENU_BUTTON_CENTER_GAP * 2,
  },
  {
    id: 'chat',
    rotation: -4,
    translateX: 8,
    translateY: -QUICK_MENU_BUTTON_CENTER_GAP,
  },
  {
    id: 'agent',
    rotation: 0,
    translateX: 12,
    translateY: 0,
  },
  {
    id: 'controls',
    rotation: 4,
    translateX: 8,
    translateY: QUICK_MENU_BUTTON_CENTER_GAP,
  },
  {
    id: 'close',
    rotation: 8,
    translateX: 0,
    translateY: QUICK_MENU_BUTTON_CENTER_GAP * 2,
  },
] as const;

export type PetQuickActionMenuItemId = typeof QUICK_MENU_ITEM_LAYOUTS[number]['id'];

export const QUICK_MENU_BUTTON_STACK_WIDTH = Math.max(
  ...QUICK_MENU_ITEM_LAYOUTS.map((item) => item.translateX + QUICK_MENU_BUTTON_WIDTH),
);
export const QUICK_MENU_BUTTON_STACK_OFFSET_X = Math.round(
  (QUICK_MENU_BASE_WIDTH - QUICK_MENU_BUTTON_STACK_WIDTH) / 2,
);

const QUICK_MENU_VISUAL_BOUNDS_BASE = QUICK_MENU_ITEM_LAYOUTS.reduce((bounds, item) => {
  const rotationRadians = Math.abs(item.rotation) * (Math.PI / 180);
  const rotatedWidth = (
    QUICK_MENU_BUTTON_WIDTH * Math.cos(rotationRadians)
    + QUICK_MENU_BUTTON_HEIGHT * Math.sin(rotationRadians)
  );
  const rotatedHeight = (
    QUICK_MENU_BUTTON_WIDTH * Math.sin(rotationRadians)
    + QUICK_MENU_BUTTON_HEIGHT * Math.cos(rotationRadians)
  );
  const centerX = QUICK_MENU_BUTTON_STACK_OFFSET_X + item.translateX + QUICK_MENU_BUTTON_WIDTH / 2;
  const centerY = QUICK_MENU_BASE_HEIGHT / 2 + item.translateY;

  return {
    bottom: Math.max(bounds.bottom, centerY + rotatedHeight / 2),
    left: Math.min(bounds.left, centerX - rotatedWidth / 2),
    right: Math.max(bounds.right, centerX + rotatedWidth / 2),
    top: Math.min(bounds.top, centerY - rotatedHeight / 2),
  };
}, {
  bottom: Number.NEGATIVE_INFINITY,
  left: Number.POSITIVE_INFINITY,
  right: Number.NEGATIVE_INFINITY,
  top: Number.POSITIVE_INFINITY,
});

export const PET_QUICK_ACTION_MENU_SAFE_PADDING_X = 12;
export const PET_QUICK_ACTION_MENU_SAFE_PADDING_Y = 14;
export const QUICK_MENU_VISUAL_WIDTH = Math.ceil(
  (QUICK_MENU_VISUAL_BOUNDS_BASE.right - QUICK_MENU_VISUAL_BOUNDS_BASE.left) * QUICK_MENU_SCALE,
);
export const QUICK_MENU_VISUAL_HEIGHT = Math.ceil(
  (QUICK_MENU_VISUAL_BOUNDS_BASE.bottom - QUICK_MENU_VISUAL_BOUNDS_BASE.top) * QUICK_MENU_SCALE,
);
export const PET_QUICK_ACTION_MENU_INTERACTIVE_WIDTH = QUICK_MENU_VISUAL_WIDTH
  + PET_QUICK_ACTION_MENU_SAFE_PADDING_X * 2;
export const PET_QUICK_ACTION_MENU_INTERACTIVE_HEIGHT = QUICK_MENU_VISUAL_HEIGHT
  + PET_QUICK_ACTION_MENU_SAFE_PADDING_Y * 2;
export const QUICK_MENU_STAGE_OFFSET_X = PET_QUICK_ACTION_MENU_SAFE_PADDING_X
  - QUICK_MENU_VISUAL_BOUNDS_BASE.left * QUICK_MENU_SCALE;
export const QUICK_MENU_STAGE_OFFSET_Y = PET_QUICK_ACTION_MENU_SAFE_PADDING_Y
  - QUICK_MENU_VISUAL_BOUNDS_BASE.top * QUICK_MENU_SCALE;

export function resolvePetQuickActionMenuGeometry() {
  return {
    interactiveHeight: PET_QUICK_ACTION_MENU_INTERACTIVE_HEIGHT,
    interactiveWidth: PET_QUICK_ACTION_MENU_INTERACTIVE_WIDTH,
    safePaddingX: PET_QUICK_ACTION_MENU_SAFE_PADDING_X,
    safePaddingY: PET_QUICK_ACTION_MENU_SAFE_PADDING_Y,
    stageOffsetX: QUICK_MENU_STAGE_OFFSET_X,
    stageOffsetY: QUICK_MENU_STAGE_OFFSET_Y,
    visualBounds: {
      bottom: QUICK_MENU_VISUAL_BOUNDS_BASE.bottom * QUICK_MENU_SCALE,
      height: (QUICK_MENU_VISUAL_BOUNDS_BASE.bottom - QUICK_MENU_VISUAL_BOUNDS_BASE.top) * QUICK_MENU_SCALE,
      left: QUICK_MENU_VISUAL_BOUNDS_BASE.left * QUICK_MENU_SCALE,
      right: QUICK_MENU_VISUAL_BOUNDS_BASE.right * QUICK_MENU_SCALE,
      top: QUICK_MENU_VISUAL_BOUNDS_BASE.top * QUICK_MENU_SCALE,
      width: (QUICK_MENU_VISUAL_BOUNDS_BASE.right - QUICK_MENU_VISUAL_BOUNDS_BASE.left) * QUICK_MENU_SCALE,
    },
  };
}

export function resolvePetQuickActionMenuCenterY(
  petAnchorY: number,
  petVisualBounds: { bottom: number; top: number },
) {
  return Math.round(petAnchorY + (petVisualBounds.bottom - petVisualBounds.top) / 2);
}
