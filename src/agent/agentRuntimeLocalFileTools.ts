import { desktopPetShellRuntime } from '../desktopShellRuntime';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatExecutionReceipt,
  type AgentToolCallCommand,
  type AgentToolCallName,
} from './agentChatCommand';

function getToolStringInput(toolCall: AgentToolCallCommand, keys: string[]) {
  const input = toolCall.input ?? {};
  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

function getToolBooleanInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  return typeof value === 'boolean' ? value : undefined;
}

function getToolNumberInput(toolCall: AgentToolCallCommand, key: string) {
  const value = toolCall.input?.[key];
  const numberValue = typeof value === 'number'
    ? value
    : typeof value === 'string'
      ? Number(value.trim())
      : NaN;

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function formatLocalFileKind(kind: unknown) {
  if (kind === 'directory') {
    return '目录';
  }

  if (kind === 'file') {
    return '文件';
  }

  if (kind === 'missing') {
    return '不存在';
  }

  if (kind === 'symlink') {
    return '符号链接';
  }

  if (kind === 'other') {
    return '其他';
  }

  return '未知';
}

function formatFileByteSize(bytes: unknown) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value < 0) {
    return '未知';
  }

  if (value < 1024) {
    return `${value} B`;
  }

  const kib = value / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(kib >= 10 ? 1 : 2)} KB`;
  }

  const mib = kib / 1024;
  if (mib < 1024) {
    return `${mib.toFixed(mib >= 10 ? 1 : 2)} MB`;
  }

  const gib = mib / 1024;
  return `${gib.toFixed(gib >= 10 ? 1 : 2)} GB`;
}

function formatLocalFileEntryLine(entry: DesktopPetLocalFileEntryLike, index: number) {
  const sizeText = entry.kind === 'file' ? `，${formatFileByteSize(entry.sizeBytes)}` : '';
  return `${index + 1}. [${formatLocalFileKind(entry.kind)}] ${entry.name}${sizeText} -> ${entry.path}`;
}

function compactTextFileSnippet(text: string, maxLength = 4000) {
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n...（内容过长，已截断显示）`;
}

function createLocalFileReceipt(options: {
  evidenceLines?: string[];
  status: AgentChatExecutionReceipt['status'];
  summaryLines: string[];
  toolName: AgentToolCallName;
  verification?: string | null;
}): AgentChatExecutionReceipt {
  return {
    evidenceLines: options.evidenceLines ?? [],
    status: options.status,
    summaryLines: options.summaryLines,
    title: '执行回执',
    toolName: options.toolName,
    verification: options.verification ?? null,
  };
}

function normalizeExecuteLocalFileAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'path_info':
    case 'inspect_path':
      return 'get_path_info';
    case 'list_dir':
    case 'list_folder':
      return 'list_directory';
    case 'search_file':
    case 'find_file':
    case 'find_files':
      return 'search_files';
    case 'read_file':
    case 'read_text':
      return 'read_text_file';
    case 'get_path_info':
    case 'list_directory':
    case 'search_files':
    case 'read_text_file':
      return normalizedValue;
    default:
      return '';
  }
}

function getLocalFileActionPathInput(toolCall: AgentToolCallCommand) {
  return getToolStringInput(toolCall, [
    'path',
    'target',
    'folderPath',
    'filePath',
    'rootPath',
    'queryRoot',
  ]);
}

function annotateLocalFileActionResult(
  action: string,
  result: AgentChatCommandResult,
): AgentChatCommandResult {
  return {
    ...result,
    observations: [
      `Local file action: ${action}`,
      ...(result.observations ?? []),
    ],
  };
}

export function normalizeExecuteFileManagementAction(value: string) {
  const normalizedValue = value.trim().toLowerCase().replace(/[-\s]+/gu, '_');
  switch (normalizedValue) {
    case 'plan':
    case 'preview':
    case 'dry_run':
      return 'preview';
    case 'move':
    case 'move_file':
    case 'move_folder':
    case 'move_path':
      return 'move_path';
    case 'organize_desktop':
    case 'organize_desktop_file':
    case 'organize_desktop_files':
    case 'organize_desktop_items':
    case 'desktop_file_organization':
      return 'organize_desktop_files';
    case 'copy':
    case 'copy_file':
    case 'copy_folder':
    case 'copy_path':
      return 'copy_path';
    case 'rename':
    case 'rename_file':
    case 'rename_folder':
    case 'rename_path':
      return 'rename_path';
    case 'mkdir':
    case 'new_folder':
    case 'create_folder':
    case 'create_directory':
      return 'create_directory';
    case 'trash':
    case 'trash_path':
    case 'recycle':
    case 'recycle_path':
      return 'trash_path';
    default:
      return '';
  }
}

export function getFileManagementActionInput(toolCall: AgentToolCallCommand) {
  return getToolStringInput(toolCall, ['action', 'fileAction', 'operation']);
}

export function getFileManagementIntendedAction(toolCall: AgentToolCallCommand, action: string) {
  if (action !== 'preview') {
    return action;
  }

  return normalizeExecuteFileManagementAction(
    getToolStringInput(toolCall, ['intendedAction', 'previewAction', 'targetAction', 'operationType']),
  );
}

export function getFileManagementModeInput(toolCall: AgentToolCallCommand) {
  const mode = getToolStringInput(toolCall, ['mode']);
  return mode === 'preview' || mode === 'execute' ? mode : undefined;
}

function createFileManagementActionRequest(
  toolCall: AgentToolCallCommand,
  action: string,
  intendedAction: string,
) {
  const input = toolCall.input ?? {};
  const mode = getFileManagementModeInput(toolCall);
  const dryRun = getToolBooleanInput(toolCall, 'dryRun');
  const requestMode: 'execute' | 'preview' | undefined = mode ?? (action === 'preview' ? 'preview' : undefined);

  return {
    ...input,
    action,
    destinationDirectory: getToolStringInput(toolCall, [
      'destinationDirectory',
      'targetDirectory',
      'folderPath',
      'directoryPath',
      'parentPath',
    ]) || undefined,
    destinationPath: getToolStringInput(toolCall, [
      'destinationPath',
      'targetPath',
      'newPath',
      'destination',
      'dest',
      'to',
    ]) || undefined,
    dryRun: typeof dryRun === 'boolean'
      ? dryRun
      : action === 'preview' || mode === 'preview' || undefined,
    desktopPath: getToolStringInput(toolCall, [
      'desktopPath',
      'desktop',
      'desktopDirectory',
      'desktopFolder',
    ]) || undefined,
    groupBy: getToolStringInput(toolCall, ['groupBy', 'group', 'grouping', 'groupStrategy']) || undefined,
    includeDirectories: getToolBooleanInput(toolCall, 'includeDirectories'),
    includeHidden: getToolBooleanInput(toolCall, 'includeHidden'),
    includeShortcuts: getToolBooleanInput(toolCall, 'includeShortcuts'),
    intendedAction: intendedAction || undefined,
    limit: getToolNumberInput(toolCall, 'limit') ?? undefined,
    mode: requestMode,
    newName: getToolStringInput(toolCall, ['newName', 'name', 'fileName', 'folderName']) || undefined,
    sourcePath: getToolStringInput(toolCall, [
      'sourcePath',
      'path',
      'source',
      'from',
      'query',
    ]) || undefined,
  };
}

function formatFileManagementActionForUser(action?: string | null) {
  switch (action) {
    case 'move_path':
      return 'move';
    case 'copy_path':
      return 'copy';
    case 'rename_path':
      return 'rename';
    case 'create_directory':
      return 'create directory';
    case 'organize_desktop_files':
      return 'organize desktop files';
    case 'trash_path':
      return 'move to recycle bin';
    case 'preview':
      return 'preview';
    default:
      return action || 'file management';
  }
}

function createFileManagementActionObservations(
  requestedAction: string,
  result: DesktopPetFileManagementActionResultLike | null,
) {
  return [
    `File management action requested: ${requestedAction}`,
    result?.action ? `File management action resolved: ${result.action}` : '',
    result?.actionLabel ? `Action label: ${result.actionLabel}` : '',
    typeof result?.dryRun === 'boolean' ? `Dry run: ${result.dryRun}` : '',
    result?.sourcePath ? `Source path: ${result.sourcePath}` : '',
    typeof result?.sourceExists === 'boolean' ? `Source exists: ${result.sourceExists}` : '',
    result?.destinationPath ? `Destination path: ${result.destinationPath}` : '',
    typeof result?.destinationExists === 'boolean' ? `Destination exists: ${result.destinationExists}` : '',
    result?.itemKind ? `Item kind: ${result.itemKind}` : '',
    Array.isArray(result?.changedPaths) && result.changedPaths.length
      ? `Changed paths: ${result.changedPaths.join(' | ')}`
      : '',
    result?.desktopPath ? `Desktop path: ${result.desktopPath}` : '',
    typeof result?.plannedItemCount === 'number' ? `Planned desktop file items: ${result.plannedItemCount}` : '',
    typeof result?.movedItemCount === 'number' ? `Moved desktop file items: ${result.movedItemCount}` : '',
    typeof result?.skippedItemCount === 'number' ? `Skipped desktop file items: ${result.skippedItemCount}` : '',
    typeof result?.conflictCount === 'number' ? `Desktop file conflicts: ${result.conflictCount}` : '',
    Array.isArray(result?.groups) && result.groups.length
      ? `Desktop file groups: ${result.groups.map((group) => `${group.label}:${group.count}`).join(' | ')}`
      : '',
    Array.isArray(result?.planItems) && result.planItems.length
      ? `Desktop file plan sample: ${result.planItems.slice(0, 8).map((item) => `${item.name} -> ${item.groupLabel}`).join(' | ')}`
      : '',
    typeof result?.verified === 'boolean' ? `Verified: ${result.verified}` : '',
    typeof result?.willOverwrite === 'boolean' ? `Will overwrite: ${result.willOverwrite}` : '',
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);
}

function createFileManagementActionResponseText(result: DesktopPetFileManagementActionResultLike | null) {
  if (!result) {
    return 'execute_file_management_action did not return a result.';
  }

  if (result.responseText) {
    return result.responseText;
  }

  const actionText = formatFileManagementActionForUser(result.action);
  const sourceText = result.sourcePath ? ` source=${result.sourcePath}` : '';
  const destinationText = result.destinationPath ? ` destination=${result.destinationPath}` : '';

  if (!result.ok) {
    return `File management action failed: ${result.error || 'unknown error'}.${sourceText}${destinationText}`;
  }

  if (result.dryRun) {
    return `Preview ready: ${actionText}.${sourceText}${destinationText}`;
  }

  return `File management action completed: ${actionText}.${sourceText}${destinationText}`;
}

function createFileManagementActionVerification(result: DesktopPetFileManagementActionResultLike | null) {
  if (!result) {
    return null;
  }

  if (!result.ok) {
    return result.error || null;
  }

  if (result.dryRun) {
    return 'Preview only; no local files were changed.';
  }

  if (typeof result.verified === 'boolean') {
    return result.verified
      ? 'The file management action was verified by the local filesystem service.'
      : 'The file management action was accepted, but verification was incomplete.';
  }

  return 'The local filesystem service returned success.';
}

export async function executeFileManagementAction(
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const rawAction = getFileManagementActionInput(toolCall);
  const action = normalizeExecuteFileManagementAction(rawAction);
  const intendedAction = getFileManagementIntendedAction(toolCall, action);

  if (!action || (action === 'preview' && !intendedAction)) {
    return {
      errorText: 'Unsupported execute_file_management_action action.',
      observations: [
        rawAction ? `Unsupported file management action: ${rawAction}` : 'Missing file management action.',
      ],
      ok: false,
      responseText: 'execute_file_management_action needs action preview/move_path/copy_path/rename_path/create_directory/trash_path. Preview also needs intendedAction.',
    };
  }

  const result = await desktopPetShellRuntime.executeFileManagementAction(
    createFileManagementActionRequest(toolCall, action, intendedAction),
  ) as DesktopPetFileManagementActionResultLike;
  const observations = createFileManagementActionObservations(action, result);
  const ok = Boolean(result?.ok);
  const verification = createFileManagementActionVerification(result);

  return {
    errorText: ok ? null : result?.error || 'File management action failed.',
    observations,
    ok,
    receipt: createLocalFileReceipt({
      evidenceLines: observations,
      status: ok ? result?.dryRun ? 'unverified' : 'success' : 'failed',
      summaryLines: [
        'Call: execute_file_management_action',
        `Action: ${result?.action || intendedAction || action}`,
        result?.sourcePath ? `Source: ${result.sourcePath}` : '',
        result?.destinationPath ? `Destination: ${result.destinationPath}` : '',
        result?.dryRun ? 'Mode: preview' : 'Mode: execute',
      ].filter(Boolean),
      toolName: 'execute_file_management_action',
      verification,
    }),
    responseText: createFileManagementActionResponseText(result),
    verification,
  };
}

export function createFileManagementExecuteCommand(
  sourceText: string,
  toolCall: AgentToolCallCommand,
): AgentChatCommand | null {
  const action = normalizeExecuteFileManagementAction(getFileManagementActionInput(toolCall));
  const intendedAction = getFileManagementIntendedAction(toolCall, action);
  const effectiveAction = action === 'preview' ? intendedAction : action;
  if (!effectiveAction || effectiveAction === 'preview') {
    return null;
  }

  const {
    dryRun: _dryRun,
    intendedAction: _intendedAction,
    mode: _mode,
    previewAction: _previewAction,
    targetAction: _targetAction,
    operationType: _operationType,
    ...restInput
  } = toolCall.input ?? {};

  return {
    capabilityId: 'local-file-system',
    instruction: '执行刚才预览的文件管理计划',
    kind: 'tool-call',
    sourceText,
    toolCall: {
      goal: '执行刚才预览的文件管理计划',
      input: {
        ...restInput,
        action: effectiveAction,
        dryRun: false,
        mode: 'execute',
      },
      name: 'execute_file_management_action',
    },
  };
}

export async function executeLocalFileAction(
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const rawAction = getToolStringInput(toolCall, ['action', 'fileAction', 'operation']);
  const action = normalizeExecuteLocalFileAction(rawAction);
  const localPath = getLocalFileActionPathInput(toolCall);
  const query = getToolStringInput(toolCall, ['query', 'nameQuery', 'fileName', 'pattern']);

  if (!action) {
    return {
      errorText: 'Unsupported execute_local_file_action action.',
      observations: [
        rawAction ? `Unsupported local file action: ${rawAction}` : 'Missing local file action.',
      ],
      ok: false,
      responseText: 'execute_local_file_action needs a supported action such as get_path_info, list_directory, search_files, or read_text_file.',
    };
  }

  switch (action) {
    case 'get_path_info':
      if (!localPath) {
        return {
          errorText: 'Missing local path.',
          observations: [`Local file action: ${action}`],
          ok: false,
          responseText: 'get_path_info needs a local absolute path.',
        };
      }

      return annotateLocalFileActionResult(action, await executeGetPathInfo(localPath));

    case 'list_directory':
      if (!localPath) {
        return {
          errorText: 'Missing directory path.',
          observations: [`Local file action: ${action}`],
          ok: false,
          responseText: 'list_directory needs a local absolute folder path.',
        };
      }

      return annotateLocalFileActionResult(action, await executeListDirectory(localPath, {
        includeHidden: getToolBooleanInput(toolCall, 'includeHidden'),
        limit: getToolNumberInput(toolCall, 'limit'),
      }));

    case 'search_files':
      if (!localPath || !query) {
        return {
          errorText: 'Missing search root path or filename query.',
          observations: [`Local file action: ${action}`],
          ok: false,
          responseText: 'search_files needs both a local absolute root path and a filename query.',
        };
      }

      return annotateLocalFileActionResult(action, await executeSearchFiles(localPath, query, {
        extensions: getToolStringInput(toolCall, ['extensions', 'extension']) || undefined,
        includeHidden: getToolBooleanInput(toolCall, 'includeHidden'),
        limit: getToolNumberInput(toolCall, 'limit'),
        maxDepth: getToolNumberInput(toolCall, 'maxDepth'),
      }));

    case 'read_text_file':
      if (!localPath) {
        return {
          errorText: 'Missing text file path.',
          observations: [`Local file action: ${action}`],
          ok: false,
          responseText: 'read_text_file needs a local absolute text file path.',
        };
      }

      return annotateLocalFileActionResult(
        action,
        await executeReadTextFile(localPath, getToolNumberInput(toolCall, 'maxBytes')),
      );

    default:
      return {
        errorText: 'Unsupported execute_local_file_action action.',
        observations: [`Unsupported local file action: ${rawAction}`],
        ok: false,
        responseText: `execute_local_file_action does not support action "${rawAction}".`,
      };
  }
}

export async function executeGetPathInfo(localPath: string): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.getPathInfo({ path: localPath }) as DesktopPetPathInfoResultLike;
  const exists = Boolean(result?.exists);
  const kindText = formatLocalFileKind(result?.kind);
  const pathText = result?.path || localPath;
  const observations = [
    `Path: ${pathText}`,
    `Exists: ${exists}`,
    `Kind: ${result?.kind ?? 'unknown'}`,
    result?.dirname ? `Dirname: ${result.dirname}` : '',
    result?.basename ? `Basename: ${result.basename}` : '',
    typeof result?.sizeBytes === 'number' ? `Size: ${result.sizeBytes} bytes` : '',
    result?.error ? `Error: ${result.error}` : '',
  ].filter(Boolean);

  if (result && !result.error && (result.ok || result.exists === false || result.kind === 'missing')) {
    const verification = exists
      ? `已确认路径存在，类型为${kindText}。`
      : '已确认该路径当前不存在。';
    return {
      observations,
      ok: true,
      receipt: createLocalFileReceipt({
        evidenceLines: observations,
        status: 'success',
        summaryLines: [
          '调用：get_path_info',
          `路径：${pathText}`,
          `类型：${kindText}`,
        ],
        toolName: 'get_path_info',
        verification,
      }),
      responseText: exists
        ? `路径存在：${pathText}\n类型：${kindText}${result.kind === 'file' ? `\n大小：${formatFileByteSize(result.sizeBytes)}` : ''}`
        : `路径不存在：${pathText}`,
      verification,
    };
  }

  return {
    errorText: result?.error || '路径信息读取失败。',
    observations,
    ok: false,
    receipt: createLocalFileReceipt({
      evidenceLines: observations,
      status: 'failed',
      summaryLines: [
        '调用：get_path_info',
        `路径：${pathText}`,
        `结果：${result?.error || '失败'}`,
      ],
      toolName: 'get_path_info',
      verification: result?.error ?? null,
    }),
    responseText: `没有成功读取路径信息：${result?.error || pathText}。`,
    verification: result?.error ?? null,
  };
}

export async function executeListDirectory(
  localPath: string,
  options: { includeHidden?: boolean; limit?: number } = {},
): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.listDirectory({
    includeHidden: options.includeHidden,
    limit: options.limit,
    path: localPath,
  }) as DesktopPetDirectoryListResultLike;
  const entries = Array.isArray(result?.entries) ? result.entries : [];
  const visibleEntries = entries.slice(0, 30);
  const entryLines = visibleEntries.map(formatLocalFileEntryLine);
  const observations = [
    `Directory path: ${result?.path || localPath}`,
    `Entry count returned: ${entries.length}`,
    typeof result?.totalEntryCount === 'number' ? `Total entry count: ${result.totalEntryCount}` : '',
    result?.truncated ? 'Result was truncated by list limit.' : '',
    result?.error ? `Error: ${result.error}` : '',
    ...entryLines,
  ].filter(Boolean);

  if (result?.ok) {
    const totalText = typeof result.totalEntryCount === 'number'
      ? `${result.totalEntryCount} 项`
      : `${entries.length} 项`;
    const responseLines = entryLines.length
      ? entryLines
      : ['这个目录当前没有可显示的条目。'];
    const verification = `已只读列出目录：${result.path || localPath}，返回 ${entries.length} 项。`;

    return {
      observations,
      ok: true,
      receipt: createLocalFileReceipt({
        evidenceLines: observations.slice(0, 40),
        status: 'success',
        summaryLines: [
          '调用：list_directory',
          `目录：${result.path || localPath}`,
          `条目：${totalText}`,
        ],
        toolName: 'list_directory',
        verification,
      }),
      responseText: [
        `目录：${result.path || localPath}`,
        `共 ${totalText}${result.truncated ? `，本次显示前 ${entries.length} 项` : ''}：`,
        ...responseLines,
      ].join('\n'),
      verification,
    };
  }

  return {
    errorText: result?.error || '目录读取失败。',
    observations,
    ok: false,
    receipt: createLocalFileReceipt({
      evidenceLines: observations,
      status: 'failed',
      summaryLines: [
        '调用：list_directory',
        `目录：${result?.path || localPath}`,
        `结果：${result?.error || '失败'}`,
      ],
      toolName: 'list_directory',
      verification: result?.error ?? null,
    }),
    responseText: `没有成功列出目录：${result?.error || result?.path || localPath}。`,
    verification: result?.error ?? null,
  };
}

export async function executeSearchFiles(
  localPath: string,
  query: string,
  options: {
    extensions?: string;
    includeHidden?: boolean;
    limit?: number;
    maxDepth?: number;
  } = {},
): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.searchFiles({
    extensions: options.extensions,
    includeHidden: options.includeHidden,
    limit: options.limit,
    maxDepth: options.maxDepth,
    path: localPath,
    query,
  }) as DesktopPetFileSearchResultLike;
  const matches = Array.isArray(result?.matches) ? result.matches : [];
  const visibleMatches = matches.slice(0, 30);
  const matchLines = visibleMatches.map(formatLocalFileEntryLine);
  const observations = [
    `Search root: ${result?.path || localPath}`,
    `Search query: ${result?.query || query}`,
    `Match count returned: ${matches.length}`,
    typeof result?.visitedDirectoryCount === 'number' ? `Visited directories: ${result.visitedDirectoryCount}` : '',
    typeof result?.visitedFileCount === 'number' ? `Visited files: ${result.visitedFileCount}` : '',
    result?.truncated ? 'Result was truncated by search limit.' : '',
    result?.error ? `Error: ${result.error}` : '',
    ...matchLines,
  ].filter(Boolean);

  if (result?.ok) {
    const verification = `已只读搜索文件名：${result.path || localPath}，匹配 ${matches.length} 项。`;
    return {
      observations,
      ok: true,
      receipt: createLocalFileReceipt({
        evidenceLines: observations.slice(0, 40),
        status: 'success',
        summaryLines: [
          '调用：search_files',
          `目录：${result.path || localPath}`,
          `关键词：${result.query || query}`,
          `匹配：${matches.length} 项`,
        ],
        toolName: 'search_files',
        verification,
      }),
      responseText: matches.length
        ? [
            `在 ${result.path || localPath} 中按文件名搜索「${result.query || query}」，找到 ${matches.length} 项${result.truncated ? '（结果已截断）' : ''}：`,
            ...matchLines,
          ].join('\n')
        : `在 ${result.path || localPath} 中没有找到文件名包含「${result.query || query}」的文件。`,
      verification,
    };
  }

  return {
    errorText: result?.error || '文件搜索失败。',
    observations,
    ok: false,
    receipt: createLocalFileReceipt({
      evidenceLines: observations,
      status: 'failed',
      summaryLines: [
        '调用：search_files',
        `目录：${result?.path || localPath}`,
        `关键词：${query}`,
        `结果：${result?.error || '失败'}`,
      ],
      toolName: 'search_files',
      verification: result?.error ?? null,
    }),
    responseText: `没有成功搜索文件：${result?.error || result?.path || localPath}。`,
    verification: result?.error ?? null,
  };
}

export async function executeReadTextFile(
  localPath: string,
  maxBytes?: number,
): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.readTextFile({
    maxBytes,
    path: localPath,
  }) as DesktopPetTextFileReadResultLike;
  const pathText = result?.path || localPath;
  const text = typeof result?.text === 'string' ? result.text : '';
  const snippet = compactTextFileSnippet(text);
  const observations = [
    `Text file path: ${pathText}`,
    typeof result?.sizeBytes === 'number' ? `Size: ${result.sizeBytes} bytes` : '',
    result?.encoding ? `Encoding: ${result.encoding}` : '',
    result?.extension ? `Extension: ${result.extension}` : '',
    result?.truncated ? 'Runtime read was truncated by byte cap.' : '',
    result?.error ? `Error: ${result.error}` : '',
    result?.ok ? `Text snippet: ${compactTextFileSnippet(text, 1200)}` : '',
  ].filter(Boolean);

  if (result?.ok) {
    const verification = `已只读读取文本文件：${pathText}，返回 ${text.length} 个字符。`;
    return {
      observations,
      ok: true,
      receipt: createLocalFileReceipt({
        evidenceLines: [
          `路径：${pathText}`,
          `大小：${formatFileByteSize(result.sizeBytes)}`,
          result.truncated ? '读取结果已按字节上限截断。' : '读取结果未按字节上限截断。',
        ],
        status: 'success',
        summaryLines: [
          '调用：read_text_file',
          `文件：${pathText}`,
          `字符：${text.length}`,
        ],
        toolName: 'read_text_file',
        verification,
      }),
      responseText: [
        `已读取文本文件：${pathText}`,
        `大小：${formatFileByteSize(result.sizeBytes)}${result.truncated ? '，内容已截断' : ''}`,
        '内容：',
        snippet,
      ].join('\n'),
      verification,
    };
  }

  return {
    errorText: result?.error || '文本文件读取失败。',
    observations,
    ok: false,
    receipt: createLocalFileReceipt({
      evidenceLines: observations,
      status: 'failed',
      summaryLines: [
        '调用：read_text_file',
        `文件：${pathText}`,
        `结果：${result?.error || '失败'}`,
      ],
      toolName: 'read_text_file',
      verification: result?.error ?? null,
    }),
    responseText: `没有成功读取文本文件：${result?.error || pathText}。`,
    verification: result?.error ?? null,
  };
}
