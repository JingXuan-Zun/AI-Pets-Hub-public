import { type AgentChatCommand, type AgentChatCommandResult } from '../agentChatCommand';
import { assessAgentCommandResult } from '../agentResultAssessment';
import { buildAgentPermissionRoute, isAgentPermissionRouteSilentReadOnly } from '../agentPermissionRouter';
import {
  type AgentRuntimeToolExecutor as AgentProductionToolExecutor,
  type AgentRuntimeCoveredParallelToolCommand as AgentProductionCoveredParallelToolCommand,
  type AgentRuntimeParallelToolExecutionPlan as AgentProductionParallelToolExecutionPlan,
  type AgentRuntimeToolResultEntry as AgentProductionToolResultEntry,
} from '../runtime/agentRuntimeContract';
import { createAgentToolCallSignature } from '../runtime/agentPlanningSignalEvidence';
import { isAgentVisualContextToolCommand } from '../runtime/agentVisualPlanningSignals';
import { AGENT_TOOL_RESULT_CACHE_HIT_PREFIX } from '../runtime/agentToolResultCacheEvidence';

interface AgentProductionReadOnlyToolCacheEntry {
  createdAt: number;
  resultPromise: Promise<AgentChatCommandResult>;
}

export type AgentProductionReadOnlyToolCache = Map<string, AgentProductionReadOnlyToolCacheEntry>;

interface AgentProductionObservationReuseDependencies {
  getToolInputAction: (command: AgentChatCommand) => string;
  isCancellationRequested: (signal?: AbortSignal | null) => boolean;
  createCancelledToolResult: (command: AgentChatCommand) => AgentChatCommandResult;
  executeToolCommand: (
    command: AgentChatCommand,
    toolExecutor: AgentProductionToolExecutor,
    signal?: AbortSignal | null,
  ) => Promise<AgentChatCommandResult>;
}

const AGENT_PRODUCTION_READ_ONLY_CACHE_TTL_MS = 3500;

export function createAgentProductionObservationReuse(dependencies: AgentProductionObservationReuseDependencies) {
  const {
    getToolInputAction: getAgentSessionV2ToolInputAction,
    isCancellationRequested: isAgentSessionV2CancellationRequested,
    createCancelledToolResult: createAgentSessionV2CancelledToolResult,
    executeToolCommand: executeAgentSessionV2ToolCommand,
  } = dependencies;

  function hasAgentProductionForceRefresh(args: Record<string, unknown> | undefined) {
    const forceRefresh = args?.forceRefresh;
    return forceRefresh === true || forceRefresh === 'true';
  }

  function getAgentProductionCacheableAction(command: AgentChatCommand) {
    const toolName = command.toolCall?.name;
    if (!toolName) {
      return '';
    }

    return getAgentSessionV2ToolInputAction(command) || toolName;
  }

  function isAgentProductionCacheableReadOnlyToolCommand(command: AgentChatCommand) {
    const toolName = command.toolCall?.name;
    const input = command.toolCall?.input ?? {};
    const action = getAgentProductionCacheableAction(command);
    if (!toolName || hasAgentProductionForceRefresh(input)) {
      return false;
    }

    if (isAgentVisualContextToolCommand(command)) {
      return false;
    }

    switch (toolName) {
      case 'observe_windows_and_apps':
        return true;
      case 'execute_desktop_observation':
        return [
          'diagnose_desktop_icons',
          'get_active_window_info',
          'get_cursor_position',
          'get_display_info',
          'get_system_info',
          'list_desktop_items',
          'list_running_apps',
        ].includes(action);
      case 'execute_desktop_action':
        return [
          'get_active_window_info',
          'get_default_app_for_uri',
          'list_running_apps',
        ].includes(action);
      case 'execute_local_file_action':
        return [
          'find_file',
          'get_path_info',
          'list_dir',
          'list_directory',
          'read_file',
          'read_text_file',
          'search_files',
        ].includes(action);
      case 'execute_memory_action':
        return [
          'list',
          'read',
          'recall',
          'search',
        ].includes(action);
      case 'get_voice_status':
      case 'inspect_local_project':
        return true;
      default:
        return false;
    }
  }

  function createAgentProductionReadOnlyToolCacheKey(command: AgentChatCommand) {
    if (!isAgentProductionCacheableReadOnlyToolCommand(command)) {
      return null;
    }

    const route = buildAgentPermissionRoute(command);
    if (!isAgentPermissionRouteSilentReadOnly(route)) {
      return null;
    }

    return createAgentToolCallSignature(
      command.toolCall?.name ?? command.kind,
      normalizeAgentProductionReadOnlyToolCacheInput(command.toolCall?.input ?? {}),
    );
  }

  const AGENT_PRODUCTION_READ_ONLY_CACHE_META_KEYS = new Set([
    'goal',
    'note',
    'notes',
    'reason',
  ]);

  function normalizeAgentProductionReadOnlyToolCacheInput(input: Record<string, unknown>) {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(input)) {
      if (AGENT_PRODUCTION_READ_ONLY_CACHE_META_KEYS.has(key)) {
        continue;
      }

      if (value === undefined || value === null || value === '') {
        continue;
      }

      if (Array.isArray(value)) {
        const nextArray = value.filter((item) => item !== undefined && item !== null && item !== '');
        if (nextArray.length) {
          normalized[key] = nextArray;
        }
        continue;
      }

      normalized[key] = value;
    }

    return normalized;
  }

  function createAgentProductionCachedStateSummary(
    result: AgentChatCommandResult,
    cacheLine: string,
  ) {
    return {
      ...result.stateSummary,
      observedState: [
        cacheLine,
        ...(result.stateSummary?.observedState ?? []),
      ],
    };
  }

  function createAgentProductionCachedReceipt(
    result: AgentChatCommandResult,
    cacheLine: string,
  ) {
    if (!result.receipt) {
      return result.receipt;
    }

    return {
      ...result.receipt,
      evidenceLines: [
        cacheLine,
        ...(result.receipt.evidenceLines ?? []),
      ],
      stateSummary: result.receipt.stateSummary
        ? {
            ...result.receipt.stateSummary,
            observedState: [
              cacheLine,
              ...(result.receipt.stateSummary.observedState ?? []),
            ],
          }
        : result.receipt.stateSummary,
    };
  }

  function createAgentProductionCachedToolResult(
    result: AgentChatCommandResult,
    createdAt: number,
  ) {
    const ageMs = Math.max(0, Date.now() - createdAt);
    const cacheLine = `${AGENT_TOOL_RESULT_CACHE_HIT_PREFIX}: reused silent read-only observation (${ageMs}ms old).`;
    return {
      ...result,
      observations: [
        cacheLine,
        ...(result.observations ?? []),
      ],
      receipt: createAgentProductionCachedReceipt(result, cacheLine),
      stateSummary: createAgentProductionCachedStateSummary(result, cacheLine),
    };
  }


  async function executeAgentProductionToolCommandWithCache(
    command: AgentChatCommand,
    toolExecutor: AgentProductionToolExecutor,
    cache: AgentProductionReadOnlyToolCache,
    signal?: AbortSignal | null,
  ) {
    if (isAgentSessionV2CancellationRequested(signal)) {
      return createAgentSessionV2CancelledToolResult(command);
    }

    const cacheKey = createAgentProductionReadOnlyToolCacheKey(command);
    if (!cacheKey) {
      return executeAgentSessionV2ToolCommand(command, toolExecutor, signal);
    }

    const now = Date.now();
    const cachedEntry = cache.get(cacheKey);
    if (cachedEntry && now - cachedEntry.createdAt <= AGENT_PRODUCTION_READ_ONLY_CACHE_TTL_MS) {
      const cachedResult = await cachedEntry.resultPromise;
      return createAgentProductionCachedToolResult(cachedResult, cachedEntry.createdAt);
    }

    if (cachedEntry) {
      cache.delete(cacheKey);
    }

    const resultPromise = executeAgentSessionV2ToolCommand(command, toolExecutor, signal);
    cache.set(cacheKey, {
      createdAt: now,
      resultPromise,
    });

    const result = await resultPromise;
    if (result.ok === false || isAgentSessionV2CancellationRequested(signal)) {
      cache.delete(cacheKey);
    }

    return result;
  }


  function getAgentProductionInputBooleanDefaultTrue(
    input: Record<string, unknown> | undefined,
    key: string,
  ) {
    const value = input?.[key];
    return value !== false && value !== 'false';
  }

  function getAgentProductionInputString(
    input: Record<string, unknown> | undefined,
    keys: string[],
  ) {
    for (const key of keys) {
      const value = input?.[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return '';
  }

  function normalizeAgentProductionParallelObservationQuery(value: string) {
    return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
  }

  function getAgentProductionParallelObservationQuery(command: AgentChatCommand) {
    return normalizeAgentProductionParallelObservationQuery(
      getAgentProductionInputString(command.toolCall?.input, [
        'query',
        'target',
        'name',
        'title',
        'processName',
      ]),
    );
  }

  function isAgentProductionObserveWindowsAndAppsCommand(command: AgentChatCommand) {
    return command.toolCall?.name === 'observe_windows_and_apps';
  }

  function isAgentProductionParallelObserveCoverageFreshEnough(
    command: AgentChatCommand,
    coveringCommand: AgentChatCommand,
  ) {
    return !hasAgentProductionForceRefresh(command.toolCall?.input)
      || hasAgentProductionForceRefresh(coveringCommand.toolCall?.input);
  }

  function isAgentProductionParallelObserveRunningQueryCovered(
    command: AgentChatCommand,
    coveringCommand: AgentChatCommand,
  ) {
    const commandQuery = getAgentProductionParallelObservationQuery(command);
    const coveringQuery = getAgentProductionParallelObservationQuery(coveringCommand);
    return commandQuery === coveringQuery;
  }

  function getAgentProductionParallelCoveredByObserveReason(
    command: AgentChatCommand,
    coveringCommand: AgentChatCommand,
  ) {
    if (!isAgentProductionObserveWindowsAndAppsCommand(coveringCommand)) {
      return null;
    }

    if (!isAgentProductionParallelObserveCoverageFreshEnough(command, coveringCommand)) {
      return null;
    }

    const action = getAgentSessionV2ToolInputAction(command);
    if (
      command.toolCall?.name === 'execute_desktop_observation'
      && action === 'get_display_info'
      && getAgentProductionInputBooleanDefaultTrue(coveringCommand.toolCall?.input, 'includeDisplays')
    ) {
      return 'display layout is already included in observe_windows_and_apps for this batch';
    }

    if (
      (
        command.toolCall?.name === 'execute_desktop_observation'
        || command.toolCall?.name === 'execute_desktop_action'
      )
      && action === 'get_active_window_info'
      && getAgentProductionInputBooleanDefaultTrue(coveringCommand.toolCall?.input, 'includeActiveWindow')
    ) {
      return 'active window is already included in observe_windows_and_apps for this batch';
    }

    if (
      (
        command.toolCall?.name === 'execute_desktop_observation'
        || command.toolCall?.name === 'execute_desktop_action'
      )
      && action === 'list_running_apps'
      && getAgentProductionInputBooleanDefaultTrue(coveringCommand.toolCall?.input, 'includeRunningApps')
      && isAgentProductionParallelObserveRunningQueryCovered(command, coveringCommand)
    ) {
      const query = getAgentProductionParallelObservationQuery(command);
      return query
        ? `running window/app list for query "${query}" is already included in observe_windows_and_apps for this batch`
        : 'running window/app list is already included in observe_windows_and_apps for this batch';
    }

    return null;
  }

  function findAgentProductionParallelCoveringCommand(
    command: AgentChatCommand,
    commands: AgentChatCommand[],
  ) {
    if (isAgentProductionObserveWindowsAndAppsCommand(command)) {
      return null;
    }

    for (const candidate of commands) {
      if (candidate === command) {
        continue;
      }

      const reason = getAgentProductionParallelCoveredByObserveReason(command, candidate);
      if (reason) {
        return {
          command: candidate,
          reason,
        };
      }
    }

    return null;
  }

  function createAgentProductionParallelToolExecutionPlan(
    commands: AgentChatCommand[],
  ): AgentProductionParallelToolExecutionPlan {
    const duplicateCoveredCommands: AgentProductionCoveredParallelToolCommand[] = [];
    const signatureToCommand = new Map<string, AgentChatCommand>();
    const uniqueCommands: AgentChatCommand[] = [];

    for (const command of commands) {
      const signature = createAgentProductionReadOnlyToolCacheKey(command);
      const existingCommand = signature ? signatureToCommand.get(signature) : null;
      if (existingCommand) {
        duplicateCoveredCommands.push({
          command,
          coveredByCommand: existingCommand,
          reason: 'same silent read-only observation was already requested in this batch',
        });
        continue;
      }

      uniqueCommands.push(command);
      if (signature) {
        signatureToCommand.set(signature, command);
      }
    }

    const coverageByCommand = new Map<AgentChatCommand, AgentProductionCoveredParallelToolCommand>();
    const runCommands = uniqueCommands.filter((command) => {
      const covering = findAgentProductionParallelCoveringCommand(command, uniqueCommands);
      if (!covering) {
        return true;
      }

      coverageByCommand.set(command, {
        command,
        coveredByCommand: covering.command,
        reason: covering.reason,
      });
      return false;
    });

    const coveredCommands = [
      ...coverageByCommand.values(),
      ...duplicateCoveredCommands.map((covered) => {
        const canonicalCoverage = coverageByCommand.get(covered.coveredByCommand);
        return canonicalCoverage
          ? {
              ...covered,
              coveredByCommand: canonicalCoverage.coveredByCommand,
              reason: `${covered.reason}; ${canonicalCoverage.reason}`,
            }
          : covered;
      }),
    ];

    return {
      coveredCommands,
      runCommands,
    };
  }

  const AGENT_PRODUCTION_PARALLEL_DEDUPE_RECEIPT_TITLE = 'Parallel read-only observation deduped';

  function createAgentProductionCoveredParallelToolResult(options: {
    command: AgentChatCommand;
    coveredByCommand: AgentChatCommand;
    coveringResult: AgentChatCommandResult;
    reason: string;
  }) {
    const requestedToolName = options.command.toolCall?.name ?? options.command.kind;
    const coveringToolName = options.coveredByCommand.toolCall?.name ?? options.coveredByCommand.kind;
    const coveredLine = `AgentSessionV2 parallel dedupe: ${requestedToolName} covered by ${coveringToolName}; ${options.reason}.`;
    return assessAgentCommandResult(options.command, {
      observations: [
        coveredLine,
        ...(options.coveringResult.observations ?? []).slice(0, 5),
      ],
      ok: true,
      receipt: {
        evidenceLines: [
          coveredLine,
          ...(options.coveringResult.receipt?.evidenceLines ?? []).slice(0, 8),
        ],
        status: 'success',
        summaryLines: [
          `Requested tool: ${requestedToolName}`,
          `Covered by: ${coveringToolName}`,
        ],
        title: AGENT_PRODUCTION_PARALLEL_DEDUPE_RECEIPT_TITLE,
        toolName: requestedToolName,
        verification: `The same batch already ran ${coveringToolName}, which covers this read-only fact.`,
      },
      responseText: `Skipped duplicate read-only observation; ${options.reason}. Use the same-batch ${coveringToolName} evidence above.`,
      verification: `Covered by same-batch ${coveringToolName} result.`,
    });
  }

  function isAgentProductionParallelDedupeResult(entry: AgentProductionToolResultEntry) {
    return entry.result.receipt?.title === AGENT_PRODUCTION_PARALLEL_DEDUPE_RECEIPT_TITLE;
  }

  return {
    isAgentProductionCacheableReadOnlyToolCommand,
    createAgentProductionReadOnlyToolCacheKey,
    executeAgentProductionToolCommandWithCache,
    createAgentProductionParallelToolExecutionPlan,
    createAgentProductionCoveredParallelToolResult,
    isAgentProductionParallelDedupeResult,
  };
}
