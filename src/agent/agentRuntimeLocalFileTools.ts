import {
  desktopPetShellRuntime,
} from '../desktopShellRuntime';
import {
  type AgentChatCommandResult,
  type AgentToolCallCommand,
} from './agentChatCommand';
import {
  getToolStringInput,
  getToolBooleanInput,
  getToolNumberInput,
} from './desktopTools/desktopToolInput';
import {
  createLocalPathInfoResult,
  createLocalDirectoryListResult,
  createLocalFileSearchResult,
  createLocalTextReadResult,
} from './localFiles/readOnlyFileResults';

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
  return createLocalPathInfoResult(localPath, result);
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
  return createLocalDirectoryListResult(localPath, result);
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
  return createLocalFileSearchResult(localPath, query, result);
}

export async function executeReadTextFile(
  localPath: string,
  maxBytes?: number,
): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.readTextFile({
    maxBytes,
    path: localPath,
  }) as DesktopPetTextFileReadResultLike;
  return createLocalTextReadResult(localPath, result);
}

export {
  normalizeExecuteFileManagementAction,
  getFileManagementActionInput,
  getFileManagementIntendedAction,
  getFileManagementModeInput,
  executeFileManagementAction,
  createFileManagementExecuteCommand,
} from './localFiles/fileManagementTools';
