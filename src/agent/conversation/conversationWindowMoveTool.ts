import type { ConversationTool } from './conversationTools';
import { resolveIconMovePosition } from './conversationDesktopIconTool';

// "把记事本放到副屏右下角" moves an open window in one step. Without a tool for it the character
// dragged the title bar by guessed coordinates, a dozen slow rounds that rarely landed. The
// window keeps its size and lands in the screen's usable area (above the taskbar).

function str(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : '';
}

interface WindowMoveResult {
  error?: string;
  moved?: boolean;
  ok?: boolean;
  processName?: string | null;
  reason?: string;
}

export const conversationWindowMoveTool: ConversationTool = {
  // Rearranging windows changes no data, so it runs without asking (like focusing a window).
  confirmation: () => null,
  definition: {
    function: {
      description: [
        '把一个已经打开的软件窗口挪到某块屏幕上（主屏、副屏、第几块），可以指定放在那块屏幕的哪里（右下角、左上角、中间…）。一步完成，窗口大小不变。',
        '用户说“把记事本/浏览器/这个窗口放到副屏右下角”时用这个，不要用 drag 去拖标题栏。',
        '“它”“这个”指的是打开着的软件窗口时用这个；指的是一个文件、文件夹或桌面上的图标时用 move_desktop_icon。分不清就先问用户一句。',
      ].join(''),
      name: 'move_window',
      parameters: {
        properties: {
          position: { description: '可选：放在屏幕的哪里，如“右下角”“左上角”“右上角”“左下角”“中间”；不填就放中间', type: 'string' },
          screen: { description: '“主屏”“副屏”、1、2…（从左数）或屏幕名字', type: 'string' },
          window: { description: '窗口标题或程序名，例如“记事本”“Notepad”“今天也要加油啊.txt”', type: 'string' },
        },
        required: ['window', 'screen'],
        type: 'object',
      },
    },
    type: 'function',
  },
  sequential: true,
  run: async (_runtime, args) => {
    const shell = typeof window === 'undefined' ? null : window.desktopPetShell;
    if (!shell?.moveWindowToDisplay) return '失败：现在不能挪窗口。';
    const query = str(args, 'window');
    const screen = str(args, 'screen') || '副屏';
    const positionText = str(args, 'position');
    const position = resolveIconMovePosition(positionText) ?? 'center';
    const result = await shell.moveWindowToDisplay({
      // Never fall back to whatever window is in front (often the chat window itself).
      fallbackToActiveWindow: false,
      position,
      preserveSize: true,
      query,
      targetDisplay: screen,
    }) as WindowMoveResult;
    if (!result?.ok || result.moved === false) {
      return result?.reason === 'no-window-match'
        ? `没有挪：没找到叫“${query}”的打开窗口。可以先用 list_windows 看看窗口标题。`
        : `失败：${result?.error ?? result?.reason ?? '窗口没有挪动'}`;
    }
    return `已把「${query}」窗口挪到${screen}${positionText || '中间'}。`;
  },
};
