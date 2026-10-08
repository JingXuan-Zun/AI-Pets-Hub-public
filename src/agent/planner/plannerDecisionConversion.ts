import {
  type AgentChatCommand,
  type AgentToolCallName,
} from '../agentChatCommand';
import {
  getAgentLegacyPlannerRelevanceKeywords,
} from '../agentPlannerRelevance';
import {
  AGENT_TOOL_REGISTRY,
  type AgentToolDefinition,
} from '../agentToolRegistry';
import {
  resolveSafeDesktopOrganizationScope,
} from '../desktopOrganizationScopePolicy';
import {
  compactPlannerSourceText,
  extractAbsoluteLocalPathCandidate,
  normalizePlannerToolArgs,
  type AgentPlannerDecision,
  normalizePlannerIntent,
  resolvePrimaryPlannerToolStep,
  normalizeToolName,
  normalizePlannerCommandSteps,
  normalizePlannerDisplayMoveTarget,
  getStringArg,
  extractPlannerOpenAndMoveTargetFromText,
  withPlannerCommandSteps,
  createToolCallCommand,
  shouldComposePlannerStepsIntoDesktopSequence,
  createPlannerStepsDesktopSequenceInput,
  shouldPlannerToolOpenOrSearchTarget,
  PLANNER_OPEN_VERB_PATTERN,
  PLANNER_MOVE_VERB_PATTERN,
  createPlannerOpenAndMoveSequenceInput,
  getBooleanArg,
  isPlannerVideoSummaryIntentWithoutSearch,
  normalizeDirection,
  normalizeDesktopItemGroupBy,
  getNumberArg,
} from './plannerCommandNormalization';

const OBSERVATION_ONLY_PLANNER_FALLBACK_TOOLS = new Set<AgentToolCallName>([
  'get_display_info',
  'get_system_info',
  'get_voice_status',
  'observe_windows_and_apps',
  'inspect_local_project',
]);

function isObservationOnlyPlannerFallbackTool(toolName: AgentToolCallName) {
  return OBSERVATION_ONLY_PLANNER_FALLBACK_TOOLS.has(toolName);
}

function scorePlannerToolDefinition(text: string, definition: AgentToolDefinition) {
  if (!isObservationOnlyPlannerFallbackTool(definition.name)) {
    return 0;
  }

  const compactText = compactPlannerSourceText(text);
  const relevanceKeywords = getAgentLegacyPlannerRelevanceKeywords(definition.name);
  let score = relevanceKeywords.reduce((total, keyword) => (
    compactText.includes(keyword.toLowerCase()) ? total + 1 : total
  ), 0);

  if (definition.name === 'get_display_info' && /(?:屏幕|显示器|分辨率|缩放|主屏|副屏|第二屏|工作区)/u.test(compactText)) {
    score += 4;
  }
  if (definition.name === 'get_system_info' && /(?:电脑|本机|系统|硬件|配置|cpu|gpu|内存|处理器|显卡)/iu.test(compactText)) {
    score += 4;
  }
  if (definition.name === 'inspect_local_project' && extractAbsoluteLocalPathCandidate(text) && /(?:怎么运行|如何运行|运行方式|启动方式|入口|分析|项目|程序|文件夹|目录)/u.test(compactText)) {
    score += 5;
  }
  if (definition.name === 'get_voice_status' && /(?:语音|朗读|播报|说话|麦克风|听写|识别|tts|stt|voice|音色).{0,12}(?:状态|设置|能力|现在|当前|是不是|是什么|怎么样|能不能|可用|健康)/iu.test(compactText)) {
    score += 5;
  }

  return score;
}

function resolvePlannerFallbackToolName(text: string): AgentToolCallName | null {
  const scoredTools = AGENT_TOOL_REGISTRY
    .map((definition) => ({
      definition,
      score: scorePlannerToolDefinition(text, definition),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score);

  return scoredTools[0]?.definition.name ?? null;
}

function createUnsupportedPlannerCommand(sourceText: string, message?: string): AgentChatCommand {
  return {
    instruction: sourceText,
    kind: 'unsupported',
    plannerMessage: message?.trim() || undefined,
    sourceText,
  };
}

export function createAgentCommandFromPlannerFallback(
  sourceText: string,
  options: {
    goal?: string;
    message?: string;
  } = {},
): AgentChatCommand | null {
  const toolName = resolvePlannerFallbackToolName(sourceText);
  if (!toolName) {
    return createUnsupportedPlannerCommand(
      sourceText,
      options.message ?? '我没能从这句话里推断出可靠的 Agent 工具。',
    );
  }

  if (!isObservationOnlyPlannerFallbackTool(toolName)) {
    return createUnsupportedPlannerCommand(
      sourceText,
      options.message ?? 'Agent planner 没有明确选中可执行工具；为了避免把自然语言当固定指令执行，我先停下等待重新规划。',
    );
  }

  return createAgentCommandFromPlannerDecision(sourceText, {
    args: normalizePlannerToolArgs(sourceText, toolName, {}),
    confidence: 0.4,
    goal: options.goal,
    intent: 'tool',
    message: options.message,
    tool: toolName,
  });
}

export function createAgentCommandFromPlannerDecision(
  sourceText: string,
  decision: AgentPlannerDecision | null,
): AgentChatCommand | null {
  if (!decision) {
    return createAgentCommandFromPlannerFallback(sourceText, {
      message: '我没能把这句话规划成可靠的 Agent 工具调用。',
    });
  }

  const intent = normalizePlannerIntent(decision.intent);
  if (intent === 'chat') {
    return null;
  }

  if (intent === 'clarify') {
    return createUnsupportedPlannerCommand(sourceText, decision.message || '这里还缺少一个必要信息，我需要你再说具体一点。');
  }

  if (intent !== 'tool') {
    return createUnsupportedPlannerCommand(sourceText, decision.message || decision.reason || '这个请求暂时没有可用的安全工具。');
  }

  const primaryStep = resolvePrimaryPlannerToolStep(decision);
  const toolName = normalizeToolName(decision.tool)
    ?? primaryStep?.toolName;
  const rawArgs = decision.args && typeof decision.args === 'object' && !Array.isArray(decision.args)
    ? decision.args
    : primaryStep?.args ?? {};

  if (!toolName) {
    return createUnsupportedPlannerCommand(sourceText, 'Agent planner 没有选中已注册的本机工具，也没有从请求里推断出可靠工具。');
  }

  const args = normalizePlannerToolArgs(sourceText, toolName, rawArgs);
  const plannerSteps = normalizePlannerCommandSteps(sourceText, decision);
  const displayMoveTarget = normalizePlannerDisplayMoveTarget(sourceText);
  const openAndMoveTarget = getStringArg(args, ['target', 'query', 'appName', 'name', 'url', 'website', 'site'])
    || extractPlannerOpenAndMoveTargetFromText(sourceText);
  const createPlannedToolCallCommand = (
    selectedToolName: AgentToolCallName,
    input: Record<string, unknown>,
    goal?: string,
  ) => withPlannerCommandSteps(
    createToolCallCommand(sourceText, selectedToolName, input, goal),
    plannerSteps,
  );

  if (
    shouldComposePlannerStepsIntoDesktopSequence(plannerSteps)
    && toolName !== 'execute_desktop_sequence'
  ) {
    return createPlannedToolCallCommand(
      'execute_desktop_sequence',
      createPlannerStepsDesktopSequenceInput(plannerSteps, decision.goal),
      decision.goal,
    );
  }

  const shouldComposeOpenAndMoveDisplaySequence = Boolean(
    displayMoveTarget
      && openAndMoveTarget
      && shouldPlannerToolOpenOrSearchTarget(toolName)
      && PLANNER_OPEN_VERB_PATTERN.test(sourceText)
      && PLANNER_MOVE_VERB_PATTERN.test(sourceText),
  );

  if (shouldComposeOpenAndMoveDisplaySequence) {
    return createPlannedToolCallCommand('execute_desktop_sequence', createPlannerOpenAndMoveSequenceInput({
      forceNew: getBooleanArg(args, 'forceNew'),
      sourceText,
      target: openAndMoveTarget,
      targetDisplay: displayMoveTarget,
      toolName,
    }), decision.goal);
  }

  if (
    displayMoveTarget
    && openAndMoveTarget
    && shouldPlannerToolOpenOrSearchTarget(toolName)
    && /(?:打开|启动|运行|访问|开启|open|launch|start|run|visit)/iu.test(sourceText)
    && /(?:放到|移到|移动到|挪到|拖到|显示到|放在|移至|move|put|place)/iu.test(sourceText)
  ) {
    return createPlannedToolCallCommand('execute_desktop_sequence', createPlannerOpenAndMoveSequenceInput({
      forceNew: getBooleanArg(args, 'forceNew'),
      sourceText,
      target: openAndMoveTarget,
      targetDisplay: displayMoveTarget,
      toolName,
    }), decision.goal);
  }

  if (
    (toolName === 'browser_search' || toolName === 'search_web')
    && isPlannerVideoSummaryIntentWithoutSearch(sourceText)
  ) {
    return createUnsupportedPlannerCommand(
      sourceText,
      '我需要先知道视频来源：当前屏幕上的视频，还是你提供的视频链接；不能把“总结视频”自动当成搜索视频。',
    );
  }

  if (toolName === 'browser_search' || toolName === 'search_web') {
    const query = getStringArg(args, ['query', 'keyword', 'keywords', 'url', 'website', 'site', 'target']);
    if (!query) {
      return createUnsupportedPlannerCommand(sourceText, '要用浏览器搜索或访问网页的话，我还需要知道搜索内容或网址。');
    }

    return createPlannedToolCallCommand(toolName, {
      forceNewPage: getBooleanArg(args, 'forceNewPage'),
      query,
    }, decision.goal);
  }

  if (toolName === 'launch_local_app') {
    const query = getStringArg(args, ['query', 'appName', 'name']);
    if (!query) {
      return createUnsupportedPlannerCommand(sourceText, '要打开应用的话，我还需要知道应用名称。');
    }

    return createPlannedToolCallCommand(toolName, {
      forceNew: getBooleanArg(args, 'forceNew'),
      query,
    }, decision.goal);
  }

  if (toolName === 'remember_local_app') {
    const alias = getStringArg(args, ['alias', 'name']);
    const path = getStringArg(args, ['path', 'appPath']);
    if (!alias || !path) {
      return createUnsupportedPlannerCommand(sourceText, '要记住应用位置，需要同时给我应用别名和本机路径。');
    }

    return createPlannedToolCallCommand(toolName, { alias, path }, decision.goal);
  }

  if (toolName === 'place_desktop_icon') {
    const targetName = getStringArg(args, ['targetName', 'target']);
    const anchorName = getStringArg(args, ['anchorName', 'anchor']);
    const direction = normalizeDirection(args.direction);
    if (!targetName || !anchorName || !direction) {
      return createUnsupportedPlannerCommand(sourceText, '移动单个桌面图标时，需要目标图标、参照图标和上下左右方向。');
    }

    return createPlannedToolCallCommand(toolName, {
      anchorName,
      direction,
      targetName,
    }, decision.goal);
  }

  if (toolName === 'get_system_info') {
    return createPlannedToolCallCommand(toolName, {
      includeDisplays: args.includeDisplays !== false,
    }, decision.goal);
  }

  if (toolName === 'organize_desktop_icons') {
    const displayTarget = getStringArg(args, ['targetDisplay', 'displayTarget', 'display']);
    const sourceDisplay = getStringArg(args, ['sourceDisplay', 'sourceDisplayTarget']);
    const groupBy = getStringArg(args, ['groupBy', 'group', 'grouping', 'groupStrategy']);
    const mode = getStringArg(args, ['mode', 'actionMode']);
    const placementIntent = getStringArg(args, ['placementIntent', 'layoutIntent', 'placementGoal', 'arrangementIntent', 'intent']) || sourceText;
    const scope = getStringArg(args, ['sourceScope', 'scope', 'iconScope']);
    const normalizedDisplayTarget = displayTarget === 'primary' || displayTarget === 'secondary' || displayTarget === 'current' || displayTarget === 'all'
      ? displayTarget
      : undefined;
    const normalizedScope = scope === 'all-icons' || scope === 'display-icons'
      ? scope
      : undefined;
    const safeScope = resolveSafeDesktopOrganizationScope({
      displayTarget: normalizedDisplayTarget,
      requestedScope: normalizedScope,
      sourceText,
      structuredIntent: Boolean(args.targetDisplay || args.sourceDisplay || args.sourceScope),
    });
    return createPlannedToolCallCommand(toolName, {
      displayTarget: normalizedDisplayTarget,
      groupBy: normalizeDesktopItemGroupBy(groupBy),
      mode: mode === 'execute' || mode === 'preview'
        ? mode
        : 'preview',
      placementIntent,
      scope: safeScope,
      sourceDisplay,
      sourceScope: safeScope,
      targetDisplay: normalizedDisplayTarget,
    }, decision.goal);
  }

  if (toolName === 'get_pet_settings') {
    return createPlannedToolCallCommand(toolName, {
      path: getStringArg(args, ['path']),
      query: getStringArg(args, ['query']),
    }, decision.goal);
  }

  if (toolName === 'update_pet_settings') {
    const changes = args.changesJson ?? args.changes ?? args.updates;
    const changesJson = typeof changes === 'string'
      ? changes
      : changes && typeof changes === 'object' && !Array.isArray(changes)
        ? JSON.stringify(changes)
        : '';
    if (!changesJson) {
      return createUnsupportedPlannerCommand(sourceText, '修改桌宠设置需要提供一个以配置路径为键、JSON 值为值的变更对象。可以先读取设置确定路径。');
    }
    return createPlannedToolCallCommand(toolName, { changesJson }, decision.goal);
  }

  if (toolName === 'get_voice_status') {
    return createPlannedToolCallCommand(toolName, {
      includeLocalHealth: args.includeLocalHealth !== false,
    }, decision.goal);
  }

  if (toolName === 'switch_tts_provider') {
    const provider = getStringArg(args, ['provider', 'ttsProvider']);
    if (provider !== 'browser' && provider !== 'api' && provider !== 'local') {
      return createUnsupportedPlannerCommand(sourceText, '要切换语音播报来源，需要说明使用 Edge-TTS 本地、API 语音，还是本地语音。');
    }

    return createPlannedToolCallCommand(toolName, {
      autoSpeak: getBooleanArg(args, 'autoSpeak'),
      enableVoice: getBooleanArg(args, 'enableVoice'),
      provider,
    }, decision.goal);
  }

  if (toolName === 'warmup_local_voice') {
    return createPlannedToolCallCommand(toolName, {}, decision.goal);
  }

  if (toolName === 'set_voice_input') {
    const enabled = getBooleanArg(args, 'enabled');
    if (typeof enabled !== 'boolean') {
      return createUnsupportedPlannerCommand(sourceText, '要调整语音输入，需要明确是开启还是关闭。');
    }

    return createPlannedToolCallCommand(toolName, { enabled }, decision.goal);
  }

  if (toolName === 'start_voice_input_session') {
    return createPlannedToolCallCommand(toolName, {
      agentPrefix: getBooleanArg(args, 'agentPrefix') ?? false,
    }, decision.goal);
  }

  if (toolName === 'stop_voice_input_session') {
    return createPlannedToolCallCommand(toolName, {}, decision.goal);
  }

  if (toolName === 'inspect_local_project') {
    const localPath = getStringArg(args, ['path', 'projectPath', 'folderPath', 'filePath', 'query']);
    if (!localPath) {
      return createUnsupportedPlannerCommand(sourceText, '要分析文件夹或程序怎么运行，需要先给我一个本机绝对路径。');
    }

    return createPlannedToolCallCommand(toolName, {
      path: localPath,
      question: getStringArg(args, ['question']) || sourceText,
    }, decision.goal);
  }

  if (toolName === 'run_local_project_action') {
    const localPath = getStringArg(args, ['path', 'projectPath', 'folderPath', 'filePath', 'query']);
    return createPlannedToolCallCommand(toolName, {
      actionIndex: getNumberArg(args, 'actionIndex') ?? getNumberArg(args, 'index'),
      command: getStringArg(args, ['command']),
      label: getStringArg(args, ['label']),
      path: localPath || undefined,
      question: getStringArg(args, ['question']) || sourceText,
    }, decision.goal);
  }

  return createPlannedToolCallCommand(toolName, args, decision.goal);
}
