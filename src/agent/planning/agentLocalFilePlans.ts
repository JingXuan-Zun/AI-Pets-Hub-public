import type { AgentChatCommand, AgentToolCallName } from '../agentChatCommand';
import { type AgentExecutionPlan, createPlanStep, getToolCallTargetDescription } from './agentPlanShared';

function getExecuteLocalFileActionInput(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const value = input.action ?? input.fileAction ?? input.operation;
  return typeof value === 'string' ? value.trim() : '';
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

function buildExecuteLocalFileActionPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const action = normalizeExecuteLocalFileAction(getExecuteLocalFileActionInput(command));
  if (!action) {
    return null;
  }

  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  const goal = explicitGoal || `Execute local file action: ${action}${targetDescription ? ` (${targetDescription})` : ''}`;

  switch (action) {
    case 'get_path_info':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-local-file-action:get-path-info',
            'get-path-info',
            `Read-only inspect local path metadata: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'list_directory':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-local-file-action:list-directory',
            'list-directory',
            `Read-only list local directory entries: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'search_files':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-local-file-action:search-files',
            'search-files',
            `Read-only search local file names: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'read_text_file':
      return {
        commandKind: command.kind,
        goal,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'execute-local-file-action:read-text-file',
            'read-text-file',
            `Read-only read a small local text file snippet: ${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    default:
      return null;
  }
}

function getExecuteFileManagementActionInput(command: AgentChatCommand) {
  const input = command.toolCall?.input ?? {};
  const value = input.action ?? input.fileAction ?? input.operation;
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeExecuteFileManagementAction(value: string) {
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

function getExecuteFileManagementIntendedAction(command: AgentChatCommand, action: string) {
  if (action !== 'preview') {
    return action;
  }

  const input = command.toolCall?.input ?? {};
  const value = input.intendedAction ?? input.previewAction ?? input.targetAction ?? input.operationType;
  return typeof value === 'string' ? normalizeExecuteFileManagementAction(value) : '';
}

function buildExecuteFileManagementActionPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const action = normalizeExecuteFileManagementAction(getExecuteFileManagementActionInput(command));
  const intendedAction = getExecuteFileManagementIntendedAction(command, action);
  if (!action || (action === 'preview' && !intendedAction)) {
    return null;
  }

  const effectiveAction = action === 'preview' ? intendedAction : action;
  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  const goal = explicitGoal || `Execute file management action: ${action}${targetDescription ? ` (${targetDescription})` : ''}`;

  if (action === 'preview' || command.toolCall?.input?.dryRun === true || command.toolCall?.input?.mode === 'preview') {
    const previewActionKind = effectiveAction === 'organize_desktop_files'
      ? 'propose-desktop-file-organization'
      : 'preview-file-management-action';
    return {
      commandKind: command.kind,
      goal,
      instruction: command.instruction,
      steps: [
        createPlanStep(
          'execute-file-management-action:preview',
          previewActionKind,
          targetDescription
            ? `Preview local file management action ${effectiveAction}: ${targetDescription}`
            : `Preview local file management action ${effectiveAction}`,
          {
            requiresDesktopMode: true,
            targetDescription: targetDescription || 'local file management preview',
          },
        ),
      ],
    };
  }

  const actionKind = (() => {
    switch (effectiveAction) {
      case 'move_path':
        return 'move-local-path' as const;
      case 'organize_desktop_files':
        return 'execute-desktop-file-organization' as const;
      case 'copy_path':
        return 'copy-local-path' as const;
      case 'rename_path':
        return 'rename-local-path' as const;
      case 'create_directory':
        return 'create-local-directory' as const;
      case 'trash_path':
        return 'trash-local-path' as const;
      default:
        return null;
    }
  })();
  if (!actionKind) {
    return null;
  }

  return {
    commandKind: command.kind,
    goal,
    instruction: command.instruction,
    steps: [
      createPlanStep(
        `execute-file-management-action:${effectiveAction}`,
        actionKind,
        targetDescription
          ? `Execute local file management action ${effectiveAction}: ${targetDescription}`
          : `Execute local file management action ${effectiveAction}`,
        {
          details: [
            'This tool does not overwrite existing paths and does not permanently delete files.',
            effectiveAction === 'trash_path' ? 'Trash uses the operating system recycle bin when available.' : '',
          ].filter(Boolean),
          requiresDesktopMode: true,
          reversible: true,
          targetDescription: targetDescription || 'local file management action',
        },
      ),
    ],
  };
}

export function buildLocalFileToolPlan(
  command: AgentChatCommand,
  toolName: AgentToolCallName,
  targetDescription: string,
  explicitGoal: string | undefined,
): AgentExecutionPlan | null {
  switch (toolName) {
    case 'execute_local_file_action':
      return buildExecuteLocalFileActionPlan(command);

    case 'execute_file_management_action':
      return buildExecuteFileManagementActionPlan(command);

    case 'get_path_info':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `读取本机路径信息：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'get-path-info',
            'get-path-info',
            `只读检查路径是否存在及类型：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'list_directory':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `列出本机目录：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'list-directory',
            'list-directory',
            `只读列出目录内容：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'search_files':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `搜索本机文件名：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'search-files',
            'search-files',
            `只读按文件名搜索：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };

    case 'read_text_file':
      return {
        commandKind: command.kind,
        goal: explicitGoal || `读取本机文本文件：${targetDescription}`,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'read-text-file',
            'read-text-file',
            `只读读取文本文件片段：${targetDescription}`,
            {
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };
    default: return null;
  }
}
