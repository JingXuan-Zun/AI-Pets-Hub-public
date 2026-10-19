import { desktopPetShellRuntime } from '../../desktopShellRuntime';
import type { ConversationTool } from './conversationTools';

// File operations through the local file service instead of clicking through Explorer:
// renaming in Explorer by mouse took 28 rounds in a live run, the service does it in one.
// Reading runs directly; every change asks the user, with a dry run first so the card can
// say whether the source exists and whether something would be overwritten.
// `places` gives the starting points (user folders, drives, the app's own folders) so the
// character looks things up itself instead of answering “I don't know where that is”.

type FileEntry = { kind?: string; modifiedAt?: number; name?: string; path?: string; sizeBytes?: number };
type FileResult = {
  destinationPath?: string;
  entries?: FileEntry[];
  error?: string;
  matches?: FileEntry[];
  ok?: boolean;
  sourceExists?: boolean;
  sourcePath?: string;
  text?: string;
  content?: string;
  totalEntryCount?: number;
  truncated?: boolean;
  willOverwrite?: boolean;
};

const CHANGE_ACTIONS: Record<string, { label: string; service: string }> = {
  copy: { label: '复制', service: 'copy_path' },
  create_folder: { label: '新建文件夹', service: 'create_directory' },
  move: { label: '移动', service: 'move_path' },
  rename: { label: '重命名', service: 'rename_path' },
  trash: { label: '移到回收站', service: 'trash_path' },
};
const LIST_LIMIT = 80;
const READ_MAX_BYTES = 12_000;

function str(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : '';
}

function formatEntry(entry: FileEntry) {
  const kind = entry.kind === 'directory' ? '📁' : '📄';
  const size = entry.kind === 'directory' || typeof entry.sizeBytes !== 'number' ? '' : ` ${entry.sizeBytes < 1024 ? `${entry.sizeBytes}B` : `${Math.round(entry.sizeBytes / 1024)}KB`}`;
  return `${kind} ${entry.path ?? entry.name ?? ''}${size}`;
}

async function call<T>(promise: Promise<unknown> | undefined): Promise<T> {
  return (await promise ?? {}) as T;
}

export const conversationFileTool: ConversationTool = {
  confirmation: () => null,
  definition: {
    function: {
      description: [
        '直接操作电脑上的文件和文件夹（比在资源管理器里点鼠标快且准）：',
        'places 列出常用位置（桌面、下载、文档、各个盘、桌宠程序文件夹、语音包和语音识别模型的文件夹），不需要 path；',
        'open 在资源管理器里打开文件夹（文件则打开所在文件夹并选中它），只在用户想看里面的内容或位置时用；把桌面上的东西挪到别的屏幕要用 move_desktop_icon，不要用 open；',
        'list 列出文件夹内容；search 在文件夹里按名字找（会找子文件夹）；read 读文本文件；',
        'rename 重命名（new_name 只写新名字）；move / copy 到 to 文件夹；create_folder 新建文件夹（path 是新文件夹的完整路径）；trash 移到回收站。',
        '路径用完整的绝对路径。不知道路径时：先 places，再用 search / list 在相关位置里找；资源管理器窗口的地址栏也能用 read_window 读到。',
        '查看类操作（places、list、search、read、open）直接做；会改动文件的操作每次都会请用户确认。',
      ].join(''),
      name: 'files',
      parameters: {
        properties: {
          action: { enum: ['places', 'list', 'search', 'read', 'open', 'rename', 'move', 'copy', 'create_folder', 'trash'], type: 'string' },
          new_name: { description: 'rename 的新名字（含扩展名），例如 “报告.docx”', type: 'string' },
          path: { description: '文件或文件夹的完整路径；search 时是在哪个文件夹里找；places 不需要', type: 'string' },
          query: { description: 'search 的关键词（文件名的一部分）', type: 'string' },
          to: { description: 'move / copy 的目标文件夹完整路径', type: 'string' },
        },
        required: ['action'],
        type: 'object',
      },
    },
    type: 'function',
  },
  sequential: true,
  run: async (runtime, args) => {
    const action = str(args, 'action');
    const path = str(args, 'path');
    const knownFolders = typeof window === 'undefined' ? null : window.desktopPetShell?.knownFolders ?? null;
    if (action === 'places') {
      const result = await knownFolders?.list();
      if (!result?.ok) return `失败：${result?.error ?? '读不到常用位置'}`;
      return [
        ...(result.folders ?? []).map((folder) => `📁 ${folder.label}：${folder.path}`),
        `💽 盘：${(result.drives ?? []).join('  ')}`,
      ].join('\n');
    }
    if (!path) return '需要 path（完整路径）；不知道路径时先用 places。';
    if (action === 'open') {
      const result = await knownFolders?.reveal(path);
      if (!result?.ok) return `失败：${result?.error ?? '打不开'}`;
      return result.kind === 'file' ? `已打开所在文件夹并选中：${result.path ?? path}` : `已在资源管理器里打开：${result.path ?? path}`;
    }
    if (action === 'list') {
      const result = await call<FileResult>(desktopPetShellRuntime.listDirectory({ limit: LIST_LIMIT, path }));
      if (!result.ok) return `失败：${result.error ?? '读不了这个文件夹'}`;
      const entries = result.entries ?? [];
      return [`${path}（${result.totalEntryCount ?? entries.length} 项${result.truncated ? `，只列出前 ${entries.length} 项` : ''}）：`, ...entries.map(formatEntry)].join('\n') || '（空文件夹）';
    }
    if (action === 'search') {
      const query = str(args, 'query');
      if (!query) return 'search 需要 query。';
      const result = await call<FileResult>(desktopPetShellRuntime.searchFiles({ limit: 40, maxDepth: 5, path, query }));
      if (!result.ok) return `失败：${result.error ?? '搜索失败'}`;
      const matches = result.matches ?? [];
      return matches.length ? [`找到 ${matches.length} 个${result.truncated ? '（还有更多）' : ''}：`, ...matches.map(formatEntry)].join('\n') : `在 ${path} 里没有找到名字包含“${query}”的文件。`;
    }
    if (action === 'read') {
      const result = await call<FileResult>(desktopPetShellRuntime.readTextFile({ maxBytes: READ_MAX_BYTES, path }));
      if (!result.ok) return `失败：${result.error ?? '读不了这个文件'}`;
      return result.text ?? result.content ?? '（文件是空的）';
    }
    const change = CHANGE_ACTIONS[action];
    if (!change) return `不支持的 action “${action}”。`;
    const newName = str(args, 'new_name');
    const to = str(args, 'to');
    if (action === 'rename' && !newName) return 'rename 需要 new_name。';
    if ((action === 'move' || action === 'copy') && !to) return `${action} 需要 to（目标文件夹）。`;
    const request = {
      action: change.service,
      ...(action === 'create_folder' ? { destinationPath: path } : { sourcePath: path }),
      ...(newName ? { newName } : {}),
      ...(to ? { destinationDirectory: to } : {}),
    };
    const preview = await call<FileResult>(desktopPetShellRuntime.executeFileManagementAction({ ...request, dryRun: true }));
    if (!preview.ok) return `失败：${preview.error ?? '无法执行'}`;
    if (action !== 'create_folder' && preview.sourceExists === false) return `失败：找不到 ${path}。`;
    const target = preview.destinationPath ? ` → ${preview.destinationPath}` : '';
    const title = `${change.label}：${action === 'create_folder' ? path : `${path}${target}`}`;
    const approved = await runtime.requestApproval({
      detail: [title, preview.willOverwrite ? '注意：目标位置已有同名文件，会被覆盖。' : ''].filter(Boolean).join('\n'),
      title,
    });
    if (!approved) return '用户没有同意，这一步没有执行。不要再重复请求，直接告诉用户。';
    const result = await call<FileResult>(desktopPetShellRuntime.executeFileManagementAction(request));
    return result.ok
      ? `已${change.label}：${result.sourcePath ?? path}${result.destinationPath ? ` → ${result.destinationPath}` : ''}`
      : `失败：${result.error ?? '执行失败'}`;
  },
};
