import type { ConversationTool } from './conversationTools';

// "把桌面上的 XX 放到副屏上" means moving the desktop icon onto the other monitor. Without a tool
// for that the character opened the folder and tried to drag its window across instead. The
// icon goes into the first free desktop grid cell of the chosen screen; nothing is opened.
// "放到副屏右下角" also names a spot: the free cell nearest that corner (or the middle), and the
// icon may then move within the screen it is already on.

export interface IconMoveDisplay {
  id: string;
  isPrimary: boolean;
  label: string;
  nativeHeight?: number;
  nativeWidth?: number;
  nativeX?: number;
  nativeY?: number;
  /** Usable area in logical pixels (screen minus a docked taskbar), as Electron reports it. */
  scaleFactor?: number;
  workAreaHeight?: number;
  workAreaY?: number;
  y?: number;
}

export type IconMovePosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';

export interface IconMoveIcon {
  desktopGridCellHeight?: number;
  desktopGridCellWidth?: number;
  id: string;
  name: string;
  nativeScreenCenterX?: number;
  nativeScreenCenterY?: number;
  nativeScreenWidth?: number;
}

export type IconMovePlan =
  | { error: string }
  | { display: IconMoveDisplay; icon: IconMoveIcon; screenLabel: string; x: number; y: number };

const DEFAULT_CELL_WIDTH = 94;
const DEFAULT_CELL_HEIGHT = 126;
const TOP_MARGIN = 2;

function bounds(display: IconMoveDisplay) {
  return { height: display.nativeHeight ?? 0, width: display.nativeWidth ?? 0, x: display.nativeX ?? 0, y: display.nativeY ?? 0 };
}

// A spot at the bottom must stay above the taskbar, so it is measured in the usable area.
function usableHeight(display: IconMoveDisplay) {
  const full = display.nativeHeight ?? 0;
  if (!display.workAreaHeight || !display.scaleFactor) return full;
  const top = ((display.workAreaY ?? 0) - (display.y ?? 0)) * display.scaleFactor;
  return Math.max(0, Math.min(full, top + display.workAreaHeight * display.scaleFactor));
}

/** “右下角”“左上”“中间”… → a spot; anything else means the usual first free cell. */
export function resolveIconMovePosition(text: string): IconMovePosition | null {
  const value = text.trim().toLowerCase();
  if (!value) return null;
  if (/中间|中央|正中|center|middle/u.test(value)) return 'center';
  const bottom = /下|bottom/u.test(value);
  const top = /上|top/u.test(value);
  const right = /右|right/u.test(value);
  const left = /左|left/u.test(value);
  if (!bottom && !top && !right && !left) return null;
  return `${bottom ? 'bottom' : 'top'}-${right ? 'right' : 'left'}` as IconMovePosition;
}

function contains(display: IconMoveDisplay, x: number, y: number) {
  const box = bounds(display);
  return x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;
}

/** “主屏”“副屏”“第2块”“2”, or part of the monitor's name. */
export function resolveIconMoveDisplay(displays: IconMoveDisplay[], screen: string) {
  const ordered = [...displays].sort((left, right) => (left.nativeX ?? 0) - (right.nativeX ?? 0));
  const text = screen.trim();
  const number = Number(/(\d+)/u.exec(text)?.[1] ?? NaN);
  if (Number.isInteger(number) && number >= 1 && number <= ordered.length) return ordered[number - 1];
  if (/主|primary|main/iu.test(text)) return displays.find((display) => display.isPrimary) ?? null;
  if (/副|另一|第二|其他|secondary|other/iu.test(text)) return displays.find((display) => !display.isPrimary) ?? null;
  if (/左/u.test(text)) return ordered[0] ?? null;
  if (/右/u.test(text)) return ordered.at(-1) ?? null;
  return displays.find((display) => display.label && text && display.label.toLowerCase().includes(text.toLowerCase())) ?? null;
}

export function planDesktopIconMove(displays: IconMoveDisplay[], icons: IconMoveIcon[], name: string, screen: string, position: IconMovePosition | null = null): IconMovePlan {
  if (displays.length < 2 && !position) return { error: '现在只接了一块屏幕，没有副屏可以放。' };
  const display = displays.length < 2 ? displays[0] ?? null : resolveIconMoveDisplay(displays, screen);
  if (!display) return { error: `不知道“${screen}”是哪块屏幕。现在有：${displays.map((item, index) => `${index + 1}.${item.label}${item.isPrimary ? '（主屏）' : ''}`).join('、')}。` };
  const wanted = name.trim();
  const exact = icons.filter((icon) => icon.name === wanted);
  const partial = exact.length ? exact : icons.filter((icon) => wanted && icon.name.includes(wanted));
  if (!partial.length) return { error: `桌面上没找到叫“${wanted}”的图标。` };
  if (partial.length > 1) return { error: `桌面上有好几个名字带“${wanted}”的图标：${partial.slice(0, 6).map((icon) => icon.name).join('、')}，要挪哪一个？` };
  const icon = partial[0];
  const screenLabel = `${display.isPrimary ? '主屏' : '副屏'}（${display.label}）`;
  if (!position && contains(display, icon.nativeScreenCenterX ?? -1, icon.nativeScreenCenterY ?? -1)) return { error: `「${icon.name}」已经在${screenLabel}上了。` };

  const box = bounds(display);
  const cellWidth = icon.desktopGridCellWidth || DEFAULT_CELL_WIDTH;
  const cellHeight = icon.desktopGridCellHeight || DEFAULT_CELL_HEIGHT;
  const columns = Math.max(1, Math.floor(box.width / cellWidth));
  const rows = Math.max(1, Math.floor(usableHeight(display) / cellHeight));
  const taken = new Set(icons
    .filter((other) => other.id !== icon.id && contains(display, other.nativeScreenCenterX ?? -1, other.nativeScreenCenterY ?? -1))
    .map((other) => `${Math.floor(((other.nativeScreenCenterX ?? 0) - box.x) / cellWidth)}:${Math.floor(((other.nativeScreenCenterY ?? 0) - box.y) / cellHeight)}`));
  // Free cells are tried nearest the wanted spot first (column by column from the top-left by default).
  const cells: Array<[number, number]> = [];
  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) cells.push([column, row]);
  }
  if (position) {
    const target: [number, number] = position === 'center'
      ? [(columns - 1) / 2, (rows - 1) / 2]
      : [position.endsWith('right') ? columns - 1 : 0, position.startsWith('bottom') ? rows - 1 : 0];
    const distance = ([column, row]: [number, number]) => Math.hypot(column - target[0], row - target[1]);
    cells.sort((left, right) => distance(left) - distance(right));
  }
  const free = cells.find(([column, row]) => !taken.has(`${column}:${row}`));
  if (!free) return { error: `${screenLabel}的桌面已经摆满了。` };
  const iconWidth = icon.nativeScreenWidth ?? cellWidth;
  return {
    display,
    icon,
    screenLabel,
    x: Math.round(box.x + free[0] * cellWidth + Math.max(0, (cellWidth - iconWidth) / 2)),
    y: Math.round(box.y + free[1] * cellHeight + TOP_MARGIN),
  };
}

function str(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

export const conversationDesktopIconTool: ConversationTool = {
  confirmation: (args) => `把桌面图标「${str(args, 'name')}」挪到${str(args, 'screen') || '副屏'}${str(args, 'position')}`,
  definition: {
    function: {
      description: [
        '用户说“把XX放到/挪到/移到副屏（另一个屏幕、右边那块屏幕）上”时用这个：把桌面上的这个图标（文件、文件夹、快捷方式）挪到那块屏幕的桌面上。',
        '一步就完成，不会打开它；不要用 files 的 open 打开文件夹再去拖窗口，那是错的做法。',
        'screen 写“主屏”“副屏”、第几块屏幕（从左数，1、2…）或屏幕名字；name 写桌面上显示的图标名字。',
        '用户说了位置（“右下角”“左上角”“中间”）就填 position，图标会放到那块屏幕最靠近这个位置的空位；已经在那块屏幕上也能这样挪位置。不要自己看画面去拖。',
        '“它”“这个文件”指的是刚保存、刚提到的文件，或桌面上的文件、文件夹、快捷方式时用这个（文件在桌面上才有图标）；指的是打开着的软件窗口时用 move_window。分不清就先问用户一句。',
      ].join(''),
      name: 'move_desktop_icon',
      parameters: {
        properties: {
          name: { description: '桌面图标的名字（桌面上显示的那个）', type: 'string' },
          screen: { description: '“主屏”“副屏”、1、2… 或屏幕名字', type: 'string' },
          position: { description: '可选：放在屏幕的哪里，如“右下角”“左上角”“右上角”“左下角”“中间”；不填就放第一个空位', type: 'string' },
        },
        required: ['name', 'screen'],
        type: 'object',
      },
    },
    type: 'function',
  },
  sequential: true,
  run: async (_runtime, args) => {
    const shell = typeof window === 'undefined' ? null : window.desktopPetShell;
    if (!shell?.listDisplays || !shell.listDesktopIcons || !shell.moveDesktopIcon) return '失败：现在不能挪桌面图标。';
    const [displays, icons] = await Promise.all([
      shell.listDisplays(),
      shell.listDesktopIcons({ coordinateSpace: 'native-screen', forceRefresh: true }),
    ]);
    const position = resolveIconMovePosition(str(args, 'position'));
    const plan = planDesktopIconMove(displays as IconMoveDisplay[], icons as unknown as IconMoveIcon[], str(args, 'name'), str(args, 'screen') || '副屏', position);
    if ('error' in plan) return `没有挪：${plan.error}`;
    const result = await shell.moveDesktopIcon({ coordinateSpace: 'native-screen', iconId: plan.icon.id, iconName: plan.icon.name, x: plan.x, y: plan.y }) as { error?: string; ok?: boolean };
    return result?.ok === false
      ? `失败：${result.error ?? '桌面没有接受这次移动'}`
      : `已把「${plan.icon.name}」挪到${plan.screenLabel}的桌面${position ? str(args, 'position') : '上'}。`;
  },
};
