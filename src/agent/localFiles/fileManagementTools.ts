import {
  desktopPetShellRuntime,
} from '../../desktopShellRuntime';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentChatExecutionReceipt,
  type AgentToolCallCommand,
  type AgentToolCallName,
} from '../agentChatCommand';
import {
  getToolStringInput,
  getToolBooleanInput,
  getToolNumberInput,
} from '../desktopTools/desktopToolInput';

export function createLocalFileReceipt(options: {
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
