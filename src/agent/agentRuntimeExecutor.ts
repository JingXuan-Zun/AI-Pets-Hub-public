import { isAgentRuntimeCancellationRequested } from './agentRuntimeCancellation';
import { createDesktopObservationExecutor } from './executor/desktopObservationExecution';
import { desktopPetShellRuntime } from '../desktopShellRuntime';
import { type PetConfig, type PetConfigUpdateHandler } from '../types';
import {
  type AgentChatCommand,
  type AgentChatCommandResult,
  type AgentToolCallName,
  type AgentToolCallCommand,
} from './agentChatCommand';
import { buildAgentPermissionRoute } from './agentPermissionRouter';
import { listAgentToolNames } from './agentToolRegistry';
import {
  executeAnalyzeGameScreen,
  executeListCaptureSources,
  executeLocateScreenElements,
  executeManageGameCompanionLoop,
  executeSummarizeVisualSnapshot,
} from './agentRuntimeVisualTools';
import {
  executeDesktopAction,
  executeDesktopInput,
} from './agentRuntimeDesktopTools';
import {
  executeAppLaunch,
  executeOpenResource,
} from './agentRuntimeDesktopLaunchTools';
import {
  executeCloseWindow,
  executeFocusWindow,
} from './agentRuntimeWindowTools';
import {
  executeBrowserSearch,
  executeControlBrowser,
} from './agentRuntimeBrowserTools';
import {
  executeGetActiveWindowInfo,
  executeGetCursorPosition,
  executeGetDefaultAppForUri,
  executeListRunningApps,
  executeObserveWindowsAndApps,
} from './agentRuntimeDesktopObservationTools';
import { executeDesktopSequence } from './agentRuntimeDesktopSequenceTools';
import {
  executeDesktopIconPlacement,
  executeDesktopIconPlacementToolCall,
  executeDesktopOrganization,
  executeDesktopOrganizationToolCall,
  type AgentRuntimeDesktopOrganizationContext,
} from './agentRuntimeDesktopOrganizationTools';
import {
  executeFileManagementAction,
  executeGetPathInfo,
  executeListDirectory,
  executeLocalFileAction,
  executeReadTextFile,
  executeSearchFiles,
} from './agentRuntimeLocalFileTools';
import { executeMemoryAction } from './agentRuntimeMemoryTools';
import {
  createAgentRuntimeResult,
  enrichAgentRuntimeToolResult,
} from './agentRuntimeToolResult';
import {
  getToolBooleanInput,
  getToolNumberInput,
  getToolStringInput,
  prepareAgentRuntimeToolCall,
} from './agentRuntimeToolPreparation';
import {
  executeGetDisplayInfo,
  executeGetSystemInfo,
  executeInspectLocalProject,
  executeRunControlledCommand,
  executeRunLocalProjectAction,
} from './agentRuntimeSystemTools';
import {
  executeGetPetSettings,
  executeUpdatePetSettings,
} from './agentRuntimePetSettingsTools';
import {
  executeGetVoiceStatus,
  executeSetVoiceInput,
  executeStartVoiceInputSession,
  executeStopVoiceInputSession,
  executeSwitchTtsProvider,
  executeWarmupLocalVoice,
} from './agentRuntimeVoiceTools';
import {
  executeAgentSkill,
  executeCallMcpTool,
  executeListAgentSkills,
  executeListMcpTools,
} from './agentRuntimeSkillTools';
interface AgentRuntimeVoiceInputControllerResult {
  errorText?: string | null;
  followUp?: string | null;
  observations?: string[];
  ok?: boolean;
  responseText: string;
  verification?: string | null;
}

interface AgentRuntimeVoiceInputController {
  start: (options?: { agentPrefix?: boolean }) => (
    Promise<AgentRuntimeVoiceInputControllerResult> | AgentRuntimeVoiceInputControllerResult
  );
  stop: () => Promise<AgentRuntimeVoiceInputControllerResult> | AgentRuntimeVoiceInputControllerResult;
}

export interface AgentRuntimeGameCompanionLoopStartOptions {
  focus?: string | null;
  gameHint?: string | null;
  intervalMs?: number | null;
  maxSamples?: number | null;
  minCommentIntervalMs?: number | null;
  query?: string | null;
  sourceId?: string | null;
  sourceType?: 'screen' | 'window' | 'all' | null;
}

export interface AgentRuntimeGameCompanionLoopController {
  start: (options?: AgentRuntimeGameCompanionLoopStartOptions) => (
    Promise<AgentChatCommandResult> | AgentChatCommandResult
  );
  status: () => Promise<AgentChatCommandResult> | AgentChatCommandResult;
  stop: () => Promise<AgentChatCommandResult> | AgentChatCommandResult;
}

export interface AgentRuntimeExecutorContext extends AgentRuntimeDesktopOrganizationContext {
  petId?: string | null;
  configRef: { current: PetConfig };
  gameCompanionLoopControllerRef?: { current: AgentRuntimeGameCompanionLoopController | null };
  lastLocalProjectInspectionRef: { current: DesktopPetLocalProjectInspectionLike | null };
  onUpdateConfig: PetConfigUpdateHandler;
  signal?: AbortSignal | null;
  voiceInputControllerRef?: { current: AgentRuntimeVoiceInputController | null };
}

interface AgentRuntimeToolHandlerContext {
  command: AgentChatCommand;
  runtime: AgentRuntimeExecutorContext;
  toolCall: AgentToolCallCommand;
}

type AgentRuntimeToolHandler = (
  context: AgentRuntimeToolHandlerContext,
) => AgentChatCommandResult | Promise<AgentChatCommandResult>;

const AGENT_RUNTIME_CANCELLED_TEXT = '已终止当前 Agent 执行。';

function resolveAgentRuntimeCancellationToolName(target: AgentChatCommand | AgentToolCallCommand | string) {
  return typeof target === 'string'
    ? target
    : 'kind' in target
      ? target.toolCall?.name ?? target.kind
      : target.name;
}

function createAgentRuntimeCancelledResult(target: AgentChatCommand | AgentToolCallCommand | string) {
  const toolName = resolveAgentRuntimeCancellationToolName(target);
  return createAgentRuntimeResult({
    errorText: AGENT_RUNTIME_CANCELLED_TEXT,
    ok: false,
    receipt: {
      evidenceLines: ['User cancelled the active Agent run before this tool could finish.'],
      status: 'blocked',
      summaryLines: [
        `tool: ${toolName}`,
        'result: cancelled by user',
      ],
      title: 'Agent run cancelled',
      toolName,
      verification: AGENT_RUNTIME_CANCELLED_TEXT,
    },
    responseText: AGENT_RUNTIME_CANCELLED_TEXT,
    verification: AGENT_RUNTIME_CANCELLED_TEXT,
  });
}

const AGENT_HELP_TEXT = 'Agent 会先理解请求，再按需要规划、申请确认、调用本机工具并回执结果。当前工具包括：读取电脑/屏幕信息、观察当前活动窗口/捕获源/鼠标位置、只读查看本机路径/目录/文件名/文本片段、预览或执行桌面图标整理、打开或唤出本机应用、浏览器搜索、记住用户提供的应用路径、只读分析本机项目，以及执行分析出的候选动作。';

function appendAgentAppMemoryKnowledge(config: PetConfig, alias: string, appPath: string) {
  const nextLine = `Agent app memory: ${alias} -> ${appPath}`;
  const existingLines = config.settings.globalKnowledgeBase
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith(`Agent app memory: ${alias} ->`));

  if (existingLines.includes(nextLine)) {
    return config;
  }

  return {
    ...config,
    settings: {
      ...config.settings,
      globalKnowledgeBase: [...existingLines, nextLine].join('\n'),
    },
  };
}

function createUnsupportedResult(message?: string): AgentChatCommandResult {
  const responseText = message || `这个指令暂时还没有接入。${AGENT_HELP_TEXT}`;
  return {
    errorText: responseText,
    followUp: AGENT_HELP_TEXT,
    observations: ['No registered runtime handler accepted this Agent request.'],
    ok: false,
    responseText,
  };
}

const executeDesktopObservation = createDesktopObservationExecutor({
  isAgentRuntimeCancellationRequested,
  createAgentRuntimeCancelledResult,
});

async function executeRememberLocalApp(
  context: AgentRuntimeExecutorContext,
  alias: string,
  appPath: string,
): Promise<AgentChatCommandResult> {
  const result = await desktopPetShellRuntime.rememberLocalApp({
    alias,
    aliases: [alias],
    name: alias,
    path: appPath,
  });

  if (result?.ok) {
    const nextConfig = appendAgentAppMemoryKnowledge(context.configRef.current, alias, appPath);
    if (nextConfig !== context.configRef.current) {
      context.onUpdateConfig(nextConfig);
    }

    return {
      responseText: `已经记住「${alias}」对应的应用位置：${result.app?.path ?? appPath}。之后你说打开「${alias}」时，会优先用这个位置。`,
    };
  }

  return {
    responseText: `没能记住「${alias}」的应用位置：${result?.error ?? '路径不可用'}。请确认它是现有的 exe/lnk/url/appref-ms 文件。`,
  };
}

const AGENT_RUNTIME_TOOL_HANDLERS: Record<AgentToolCallName, AgentRuntimeToolHandler> = {
  get_display_info: () => executeGetDisplayInfo(),
  get_system_info: ({ toolCall }) => executeGetSystemInfo(
    getToolBooleanInput(toolCall, 'includeDisplays') !== false,
  ),
  get_pet_settings: ({ runtime, toolCall }) => executeGetPetSettings(runtime, toolCall),
  update_pet_settings: ({ runtime, toolCall }) => executeUpdatePetSettings(runtime, toolCall),
  get_voice_status: ({ runtime, toolCall }) => executeGetVoiceStatus(runtime, toolCall),
  inspect_local_project: ({ command, runtime, toolCall }) => (
    executeInspectLocalProject(runtime, toolCall, command.sourceText)
  ),
  run_local_project_action: ({ runtime, toolCall }) => executeRunLocalProjectAction(runtime, toolCall),
  browser_search: ({ runtime, toolCall }) => {
    const query = getToolStringInput(toolCall, ['query', 'keyword', 'keywords', 'url', 'website', 'site', 'target']);
    if (!query) {
      return {
        responseText: '我还需要知道要搜索什么，或者要打开哪个网址。',
      };
    }

    return executeBrowserSearch(runtime, query, getToolBooleanInput(toolCall, 'forceNewPage'));
  },
  observe_windows_and_apps: ({ toolCall }) => executeObserveWindowsAndApps(toolCall),
  search_web: ({ runtime, toolCall }) => {
    const query = getToolStringInput(toolCall, ['query', 'keyword', 'keywords', 'target']);
    if (!query) {
      return {
        responseText: '需要先知道要搜索什么。',
      };
    }

    return executeBrowserSearch(runtime, query, getToolBooleanInput(toolCall, 'forceNewPage'));
  },
  control_browser: ({ runtime, toolCall }) => executeControlBrowser(runtime, toolCall),
  execute_desktop_action: ({ runtime, toolCall }) => executeDesktopAction(runtime, toolCall),
  execute_desktop_input: ({ toolCall }) => executeDesktopInput(toolCall),
  execute_desktop_sequence: ({ runtime, toolCall }) => executeDesktopSequence(runtime, toolCall),
  execute_desktop_observation: ({ command, runtime, toolCall }) => (
    executeDesktopObservation(runtime, toolCall, command.sourceText)
  ),
  run_controlled_command: ({ runtime, toolCall }) => executeRunControlledCommand(runtime, toolCall),
  locate_screen_elements: ({ command, runtime, toolCall }) => (
    executeLocateScreenElements(runtime, toolCall, command.sourceText)
  ),
  execute_local_file_action: ({ toolCall }) => executeLocalFileAction(toolCall),
  execute_file_management_action: ({ toolCall }) => executeFileManagementAction(toolCall),
  execute_memory_action: ({ runtime, toolCall }) => executeMemoryAction(runtime, toolCall),
  get_default_app_for_uri: ({ toolCall }) => executeGetDefaultAppForUri(
    getToolStringInput(toolCall, ['uriScheme', 'scheme', 'protocol']) || 'https',
  ),
  list_running_apps: ({ toolCall }) => executeListRunningApps(
    getToolStringInput(toolCall, ['query', 'target', 'name']),
    getToolBooleanInput(toolCall, 'includeWindows'),
  ),
  get_active_window_info: () => executeGetActiveWindowInfo(),
  list_capture_sources: ({ runtime, toolCall }) => executeListCaptureSources(runtime, toolCall),
  summarize_visual_snapshot: ({ command, runtime, toolCall }) => (
    executeSummarizeVisualSnapshot(runtime, toolCall, command.sourceText)
  ),
  analyze_game_screen: ({ command, runtime, toolCall }) => (
    executeAnalyzeGameScreen(runtime, toolCall, command.sourceText)
  ),
  manage_game_companion_loop: ({ runtime, toolCall }) => (
    executeManageGameCompanionLoop(runtime, toolCall)
  ),
  get_cursor_position: () => executeGetCursorPosition(),
  focus_window: ({ toolCall }) => {
    const query = getToolStringInput(toolCall, ['query', 'target', 'title', 'processName', 'name']);
    if (!query) {
      return {
        responseText: '需要先知道要唤出哪个窗口。',
      };
    }

    return executeFocusWindow(query);
  },
  close_window: ({ toolCall }) => executeCloseWindow(toolCall),
  open_resource: ({ toolCall }) => {
    const target = getToolStringInput(toolCall, ['target', 'query', 'url', 'path', 'website', 'site', 'targetUrl']);
    if (!target) {
      return {
        responseText: '需要先知道要打开的网址、文件、文件夹或应用。',
      };
    }

    return executeOpenResource(
      target,
      getToolStringInput(toolCall, ['resourceType']),
      getToolBooleanInput(toolCall, 'forceNew'),
    );
  },
  launch_local_app: ({ toolCall }) => {
    const appName = getToolStringInput(toolCall, ['query', 'appName', 'name']);
    if (!appName) {
      return {
        responseText: '我还需要知道要打开哪个应用。',
      };
    }

    return executeAppLaunch(
      appName,
      getToolBooleanInput(toolCall, 'forceNew'),
      getToolBooleanInput(toolCall, 'forceRefresh'),
    );
  },
  remember_local_app: ({ runtime, toolCall }) => {
    const alias = getToolStringInput(toolCall, ['alias', 'name']);
    const appPath = getToolStringInput(toolCall, ['path', 'appPath']);
    if (!alias || !appPath) {
      return {
        responseText: '要记住应用位置，需要同时给我应用别名和本机路径。',
      };
    }

    return executeRememberLocalApp(runtime, alias, appPath);
  },
  get_path_info: ({ toolCall }) => {
    const localPath = getToolStringInput(toolCall, ['path', 'target', 'query']);
    if (!localPath) {
      return {
        errorText: '缺少本机绝对路径。',
        ok: false,
        responseText: '要读取路径信息，需要先提供本机绝对路径。',
      };
    }

    return executeGetPathInfo(localPath);
  },
  list_directory: ({ toolCall }) => {
    const localPath = getToolStringInput(toolCall, ['path', 'folderPath', 'query']);
    if (!localPath) {
      return {
        errorText: '缺少目录绝对路径。',
        ok: false,
        responseText: '要列出目录，需要先提供本机文件夹绝对路径。',
      };
    }

    return executeListDirectory(localPath, {
      includeHidden: getToolBooleanInput(toolCall, 'includeHidden'),
      limit: getToolNumberInput(toolCall, 'limit'),
    });
  },
  search_files: ({ toolCall }) => {
    const localPath = getToolStringInput(toolCall, ['path', 'folderPath', 'rootPath', 'queryRoot']);
    const query = getToolStringInput(toolCall, ['query', 'nameQuery', 'fileName', 'pattern']);
    if (!localPath || !query) {
      return {
        errorText: '缺少搜索目录或文件名关键词。',
        ok: false,
        responseText: '要搜索文件，需要同时提供搜索根目录的绝对路径和文件名关键词。',
      };
    }

    return executeSearchFiles(localPath, query, {
      extensions: getToolStringInput(toolCall, ['extensions', 'extension']) || undefined,
      includeHidden: getToolBooleanInput(toolCall, 'includeHidden'),
      limit: getToolNumberInput(toolCall, 'limit'),
      maxDepth: getToolNumberInput(toolCall, 'maxDepth'),
    });
  },
  read_text_file: ({ toolCall }) => {
    const localPath = getToolStringInput(toolCall, ['path', 'filePath', 'query']);
    if (!localPath) {
      return {
        errorText: '缺少文本文件绝对路径。',
        ok: false,
        responseText: '要读取文本文件，需要先提供文件的本机绝对路径。',
      };
    }

    return executeReadTextFile(localPath, getToolNumberInput(toolCall, 'maxBytes'));
  },
  set_voice_input: ({ runtime, toolCall }) => executeSetVoiceInput(runtime, toolCall),
  start_voice_input_session: ({ runtime, toolCall }) => executeStartVoiceInputSession(runtime, toolCall),
  stop_voice_input_session: ({ runtime }) => executeStopVoiceInputSession(runtime),
  switch_tts_provider: ({ runtime, toolCall }) => executeSwitchTtsProvider(runtime, toolCall),
  warmup_local_voice: ({ runtime }) => executeWarmupLocalVoice(runtime),
  list_agent_skills: ({ runtime, toolCall }) => executeListAgentSkills(toolCall, runtime),
  execute_agent_skill: ({ runtime, toolCall }) => executeAgentSkill(runtime, toolCall),
  list_mcp_tools: ({ toolCall }) => executeListMcpTools(toolCall),
  call_mcp_tool: ({ runtime, toolCall }) => executeCallMcpTool(runtime, toolCall),
  organize_desktop_icons: ({ command, runtime, toolCall }) => (
    executeDesktopOrganizationToolCall(runtime, toolCall, command.sourceText)
  ),
  place_desktop_icon: ({ runtime, toolCall }) => executeDesktopIconPlacementToolCall(runtime, toolCall),
};

function assertAgentRuntimeToolCoverage() {
  const missingHandlers = listAgentToolNames().filter((toolName) => !getAgentRuntimeToolHandler(toolName));
  if (missingHandlers.length > 0) {
    throw new Error(`Agent runtime missing handlers for: ${missingHandlers.join(', ')}`);
  }
}

assertAgentRuntimeToolCoverage();

function getAgentRuntimeToolHandler(name: AgentToolCallName) {
  return AGENT_RUNTIME_TOOL_HANDLERS[name] ?? null;
}

async function executePreparedRegisteredToolCall(
  runtime: AgentRuntimeExecutorContext,
  command: AgentChatCommand,
  toolCall: AgentToolCallCommand,
): Promise<AgentChatCommandResult> {
  const preparedCall = prepareAgentRuntimeToolCall(toolCall);
  if (preparedCall.ok === false) {
    return createUnsupportedResult(preparedCall.error);
  }

  const preparedToolCall = preparedCall.prepared.toolCall;
  const handler = getAgentRuntimeToolHandler(preparedToolCall.name);
  if (!handler) {
    return createUnsupportedResult(`Agent 工具 "${preparedToolCall.name}" 还没有接入 runtime handler。`);
  }

  const result = await handler({
    command,
    runtime,
    toolCall: preparedToolCall,
  });

  return enrichAgentRuntimeToolResult(preparedToolCall, result);
}

export async function executeAgentChatCommand(
  command: AgentChatCommand,
  context: AgentRuntimeExecutorContext,
): Promise<AgentChatCommandResult> {
  if (isAgentRuntimeCancellationRequested(context)) {
    return createAgentRuntimeCancelledResult(command);
  }

  const permissionRoute = buildAgentPermissionRoute(command);
  const blockedStep = permissionRoute.blockedStep;

  if (blockedStep) {
    return createAgentRuntimeResult({
      errorText: blockedStep.decision.reason,
      followUp: '可以调整请求范围，或在权限策略允许的范围内重新发起 Agent 操作。',
      observations: [`Blocked by agent action policy: ${blockedStep.summary}`],
      ok: false,
      responseText: `我先停下。这次操作里的「${blockedStep.summary}」没有通过权限策略：${blockedStep.decision.reason}`,
    });
  }

  if (command.kind === 'tool-call' && command.toolCall) {
    const result = await executePreparedRegisteredToolCall(context, command, command.toolCall);
    return isAgentRuntimeCancellationRequested(context)
      ? createAgentRuntimeCancelledResult(command)
      : result;
  }

  if (command.kind === 'app-alias-save' && command.appAliasSave) {
    const result = await executeRememberLocalApp(
      context,
      command.appAliasSave.alias,
      command.appAliasSave.appPath,
    );
    return createAgentRuntimeResult({
      ...result,
      observations: [
        `Remember local app alias: ${command.appAliasSave.alias}`,
        ...(result.observations ?? []),
      ],
    });
  }

  if (command.kind === 'app-launch' && command.appLaunch) {
    const result = await executeAppLaunch(command.appLaunch.appName, command.appLaunch.forceNew);
    return createAgentRuntimeResult({
      ...result,
      observations: [
        `Launch local app request: ${command.appLaunch.appName}`,
        ...(result.observations ?? []),
      ],
    });
  }

  if (command.kind === 'context-query' && command.contextQuery) {
    const responseText = command.contextQuery.answerText?.trim()
      || '我这里还没有可用的上一轮 Agent 观察记录。';
    return createAgentRuntimeResult({
      observations: [
        `Answered Agent context query: ${command.contextQuery.topic}`,
      ],
      ok: true,
      responseText,
      verification: '回答来自聊天中保存的上一轮 Agent 观察上下文，没有重新读取电脑状态。',
    });
  }

  if (command.kind === 'desktop-icon-placement' && command.desktopIconPlacement) {
    const result = await executeDesktopIconPlacement(context, command.desktopIconPlacement);
    return createAgentRuntimeResult({
      ...result,
      observations: [
        `Place desktop icon: ${command.desktopIconPlacement.targetName}`,
        ...(result.observations ?? []),
      ],
    });
  }

  if (command.kind === 'desktop-organization') {
    const result = await executeDesktopOrganization(context, command.desktopOrganization ?? {}, command.sourceText);
    return createAgentRuntimeResult({
      ...result,
      observations: [
        `Organize desktop icons mode: ${command.desktopOrganization?.mode ?? 'preview'}`,
        ...(result.observations ?? []),
      ],
    });
  }

  if (command.kind === 'unsupported' && command.plannerMessage) {
    return createAgentRuntimeResult({
      errorText: command.plannerMessage,
      ok: false,
      responseText: command.plannerMessage,
    });
  }

  if (command.kind === 'help') {
    return createAgentRuntimeResult({
      observations: ['Returned Agent capability help text.'],
      ok: true,
      responseText: AGENT_HELP_TEXT,
    });
  }

  return createUnsupportedResult();
}


