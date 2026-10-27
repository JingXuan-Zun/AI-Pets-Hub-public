// 互动对话的画面参数：角色多大、放在哪、对话面板占多大。设置 → 高级 → 互动对话 里调。
// 每个角色一套（Live2D 和 3D 模型的留白、比例差很多，共用一套来回切换就得反复调）；
// 没调过的角色用默认值。

/** 一个角色在互动对话画面里的摆放。 */
export interface InteractiveDialogueLayout {
  /** 角色整身高度是窗口高度的多少倍（3D 模型按这个算；2D/Live2D 跟着同一个画框缩放）。 */
  modelScale: number;
  /** 角色上下位置，窗口高度的百分比；负数往上移。 */
  modelOffsetYPercent: number;
  /** 角色左右位置，窗口宽度的百分比；负数往左移。 */
  modelOffsetXPercent: number;
  /** 对话面板高度，窗口高度的百分比。 */
  panelHeightPercent: number;
  /** 对话面板最大宽度（像素）。 */
  panelMaxWidth: number;
}

export interface InteractiveDialogueSettings {
  /** 互动对话时桌面上的角色全部先隐藏（关掉就只隐藏正在通话的那个）。 */
  hideDesktopPets: boolean;
  /** 按角色 id 存的摆放；没有的角色用 DEFAULT_INTERACTIVE_DIALOGUE_LAYOUT。 */
  layoutsByPetId: Record<string, InteractiveDialogueLayout>;
}

export type InteractiveDialogueLayoutKey = keyof InteractiveDialogueLayout;

export const INTERACTIVE_DIALOGUE_LIMITS: Record<InteractiveDialogueLayoutKey, { min: number; max: number; step: number }> = {
  modelScale: { min: 0.8, max: 4, step: 0.1 },
  modelOffsetYPercent: { min: -100, max: 50, step: 1 },
  modelOffsetXPercent: { min: -45, max: 45, step: 1 },
  panelHeightPercent: { min: 20, max: 60, step: 1 },
  panelMaxWidth: { min: 600, max: 2000, step: 20 },
};

export const DEFAULT_INTERACTIVE_DIALOGUE_LAYOUT: InteractiveDialogueLayout = {
  modelScale: 2.8,
  modelOffsetYPercent: -30,
  modelOffsetXPercent: 0,
  panelHeightPercent: 34,
  panelMaxWidth: 1100,
};

export const DEFAULT_INTERACTIVE_DIALOGUE_SETTINGS: InteractiveDialogueSettings = {
  hideDesktopPets: true,
  layoutsByPetId: {},
};

/** 3D 预览把整身放进画框的 84%（usePreviewSelfFraming 的 FILL），画框高度由此反推。 */
const MODEL_FILL_OF_FRAME = 0.84;
const MAX_STORED_LAYOUTS = 64;

function clampSetting(key: InteractiveDialogueLayoutKey, value: unknown) {
  const { min, max, step } = INTERACTIVE_DIALOGUE_LIMITS[key];
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_INTERACTIVE_DIALOGUE_LAYOUT[key];
  const stepped = Math.round(numeric / step) * step;
  return Math.min(max, Math.max(min, Number(stepped.toFixed(2))));
}

export function normalizeInteractiveDialogueLayout(raw: unknown): InteractiveDialogueLayout {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    modelScale: clampSetting('modelScale', source.modelScale),
    modelOffsetYPercent: clampSetting('modelOffsetYPercent', source.modelOffsetYPercent),
    modelOffsetXPercent: clampSetting('modelOffsetXPercent', source.modelOffsetXPercent),
    panelHeightPercent: clampSetting('panelHeightPercent', source.panelHeightPercent),
    panelMaxWidth: clampSetting('panelMaxWidth', source.panelMaxWidth),
  };
}

export function normalizeInteractiveDialogueSettings(raw: unknown): InteractiveDialogueSettings {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const rawLayouts = source.layoutsByPetId && typeof source.layoutsByPetId === 'object'
    ? Object.entries(source.layoutsByPetId as Record<string, unknown>)
    : [];
  return {
    hideDesktopPets: typeof source.hideDesktopPets === 'boolean'
      ? source.hideDesktopPets
      : DEFAULT_INTERACTIVE_DIALOGUE_SETTINGS.hideDesktopPets,
    layoutsByPetId: Object.fromEntries(rawLayouts
      .filter(([petId, layout]) => petId.trim() && layout && typeof layout === 'object')
      .slice(0, MAX_STORED_LAYOUTS)
      .map(([petId, layout]) => [petId, normalizeInteractiveDialogueLayout(layout)])),
  };
}

/** 这个角色的摆放：调过就用它自己的，没调过用默认值。 */
export function resolveInteractiveDialogueLayout(settings: InteractiveDialogueSettings, petId: string | null | undefined) {
  return (petId && settings.layoutsByPetId[petId]) || DEFAULT_INTERACTIVE_DIALOGUE_LAYOUT;
}

/** 角色画框：高度是窗口的多少百分比、上下左右偏移多少。 */
export function resolveInteractiveDialogueStageFrame(layout: InteractiveDialogueLayout) {
  return {
    heightPercent: Math.round((layout.modelScale / MODEL_FILL_OF_FRAME) * 1000) / 10,
    leftPercent: layout.modelOffsetXPercent,
    topPercent: layout.modelOffsetYPercent,
  };
}
