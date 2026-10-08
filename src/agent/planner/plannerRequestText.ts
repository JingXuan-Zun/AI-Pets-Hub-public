import { type AgentToolCallName } from '../agentChatCommand';
import { createAgentRuntimeCoreOpenMoveSequenceInput, shouldAgentRuntimeCoreTargetOpenAsResource } from '../agentRuntimeCore';
import { resolveAgentExplicitDisplayRoleFromText } from '../runtime/agentDisplayTargetIntent';

function normalizePlannerSourceText(value: string) {
  return value.trim().replace(/\s+/gu, ' ');
}

export function compactPlannerSourceText(value: string) {
  return normalizePlannerSourceText(value).replace(/\s+/gu, '').toLowerCase();
}

export const PLANNER_OPEN_VERB_PATTERN = /(?:open|launch|start|run|visit|search|find|look\s+up|\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u8bbf\u95ee|\u5f00\u542f|\u641c\u7d22|\u67e5\u627e|\u67e5\u8be2|\u67e5\u4e00\u4e0b)/iu;

export const PLANNER_MOVE_VERB_PATTERN = /(?:move|put|place|send|\u653e(?:\u5230|\u5728)?|\u79fb(?:\u5230|\u52a8\u5230)?|\u79fb\u81f3|\u62d6(?:\u5230|\u8fc7\u53bb)?|\u663e\u793a(?:\u5230|\u5728)?)/iu;

export function normalizePlannerDisplayMoveTarget(text: string) {
  const explicitRole = resolveAgentExplicitDisplayRoleFromText(text);
  if (explicitRole) {
    return explicitRole;
  }

  const normalizedText = text.normalize('NFKC').toLowerCase();

  if (/(?:副屏|副显示器|第二屏|第二个屏|扩展屏|外接屏|2号屏|二号屏|secondary|second\s*(?:screen|display|monitor))/iu.test(normalizedText)) {
    return 'secondary';
  }

  if (/(?:主屏|主显示器|第一屏|第一个屏|1号屏|一号屏|primary|main\s*(?:screen|display|monitor))/iu.test(normalizedText)) {
    return 'primary';
  }

  return '';
}

function trimPlannerOpenAndMoveTargetCandidate(value: string) {
  return value
    .trim()
    .replace(/^[\s"'“”‘’「」『』]+/gu, '')
    .replace(/[\s"'“”‘’「」『』，。！？；:：,.!?;]+$/gu, '')
    .trim();
}

export function extractPlannerExistingWindowMoveTargetFromText(text: string) {
  const normalizedText = stripAgentCommandPrefix(text).normalize('NFKC').trim();
  const patterns = [
    /(?:\u628a|\u5c06)?\s*(?:(?:\u5f53\u524d|\u5df2\u7ecf|\u5df2|\u6b63\u5728)\s*(?:\u6253\u5f00|\u8fd0\u884c|\u542f\u52a8)(?:\u7740)?\s*\u7684?|(?:\u6253\u5f00|\u8fd0\u884c|\u542f\u52a8)(?:\u7740)?\s*\u7684)\s*["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]?(.+?)["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]?\s*(?:\u7a97\u53e3|\u5e94\u7528|\u8f6f\u4ef6|\u7a0b\u5e8f)?\s*(?:\u79fb\u52a8\u5230|\u79fb\u5230|\u79fb\u81f3|\u653e\u5230|\u653e\u5728|\u62d6\u5230|\u632a\u5230).{0,18}(?:\u526f\u5c4f|\u526f\u663e\u793a\u5668|\u7b2c\u4e8c(?:\u4e2a)?(?:\u5c4f|\u663e\u793a\u5668)|\u4e3b\u5c4f|\u4e3b\u663e\u793a\u5668|\u7b2c\u4e00(?:\u4e2a)?(?:\u5c4f|\u663e\u793a\u5668))/iu,
    /(?:move|put|place|send)\s+(?:the\s+)?(?:currently\s+|already\s+)?(?:open|running)\s+["']?(.+?)["']?(?:\s+(?:window|app|application|program))?\s+(?:to|on|onto)\s+(?:the\s+)?(?:secondary|primary|main|second)(?:\s+(?:screen|display|monitor))?/iu,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    const target = match?.[1]
      ? trimPlannerOpenAndMoveTargetCandidate(match[1])
        .replace(/^\u7684/gu, '')
        .replace(/(?:\u7a97\u53e3|\u5e94\u7528|\u8f6f\u4ef6|\u7a0b\u5e8f)$/gu, '')
        .trim()
      : '';
    if (target) {
      return target;
    }
  }

  return '';
}

export function extractPlannerOpenAndMoveTargetFromText(text: string) {
  const normalizedText = stripAgentCommandPrefix(text).normalize('NFKC').trim();
  const boundedOpenMovePatterns = [
    /(?:\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u8bbf\u95ee|\u5f00\u542f)\s*["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]?(.+?)["'\u201c\u201d\u2018\u2019\u300c\u300d\u300e\u300f]?(?=\s*(?:\uff0c|,)?\s*(?:\u5e76(?:\u5c06|\u628a)?|\u7136\u540e|\u518d)?\s*(?:\u5c06|\u628a)?(?:\u8be5|\u8fd9\u4e2a)?(?:\u6d4f\u89c8\u5668|\u5e94\u7528|\u8f6f\u4ef6|\u7a0b\u5e8f|\u7a97\u53e3|\u6d4f\u89c8\u5668\u7a97\u53e3)?\s*(?:\u7a97\u53e3)?\s*(?:\u79fb\u52a8\u5230|\u79fb\u5230|\u79fb\u81f3|\u653e\u5230|\u653e\u5728|\u62d6\u5230|\u632a\u5230))/iu,
    /(?:open|launch|start|run|visit)\s+["']?(.+?)["']?(?=\s*(?:,|and|then)?\s*(?:move|put|place|send)\s+(?:it|the\s+(?:browser|app|application|program|window))?\s*(?:to|on|onto))/iu,
  ];
  for (const pattern of boundedOpenMovePatterns) {
    const match = normalizedText.match(pattern);
    const target = match?.[1]
      ? trimPlannerOpenAndMoveTargetCandidate(match[1])
      : '';
    if (target) {
      return target;
    }
  }

  const directOpenMovePattern = new RegExp(
    '(?:open|launch|start|run|visit|\\u6253\\u5f00|\\u542f\\u52a8|\\u8fd0\\u884c|\\u8bbf\\u95ee|\\u5f00\\u542f)\\s*[\\u0022\\u0027\\u201c\\u201d\\u2018\\u2019\\u300c\\u300d\\u300e\\u300f]?(.+?)[\\u0022\\u0027\\u201c\\u201d\\u2018\\u2019\\u300c\\u300d\\u300e\\u300f]?\\s*(?:and|then|,|\\u002c|\\u003b|\\u7136\\u540e|\\u518d|\\u4e4b\\u540e)?.{0,24}(?:move|put|place|send|\\u653e(?:\\u5230|\\u5728)?|\\u79fb(?:\\u5230|\\u52a8\\u5230)?|\\u79fb\\u81f3|\\u62d6(?:\\u5230|\\u8fc7\\u53bb)?|\\u663e\\u793a(?:\\u5230|\\u5728)?).{0,18}(?:secondary|primary|main|second|\\u526f\\u5c4f|\\u526f\\u663e\\u793a\\u5668|\\u4e3b\\u5c4f|\\u4e3b\\u663e\\u793a\\u5668|\\u7b2c[\\u4e00\\u4e8c](?:\\u4e2a)?(?:\\u5c4f|\\u663e\\u793a\\u5668)|[12]\\s*(?:screen|display|monitor))',
    'iu',
  );
  const directOpenMoveMatch = normalizedText.match(directOpenMovePattern);
  const directOpenMoveTarget = directOpenMoveMatch?.[1]
    ? trimPlannerOpenAndMoveTargetCandidate(directOpenMoveMatch[1])
    : '';
  if (directOpenMoveTarget) {
    return directOpenMoveTarget;
  }

  const patterns = [
    /(?:open|launch|start|run|visit|\u6253\u5f00|\u542f\u52a8|\u8fd0\u884c|\u8bbf\u95ee|\u5f00\u542f)\s*["'“”‘’「」『』]?(.+?)["'“”‘’「」『』]?\s*(?:and|then|,|，|;|；|\u7136\u540e|\u518d|\u4e4b\u540e)?.{0,24}(?:move|put|place|send|\u653e(?:\u5230|\u5728)?|\u79fb(?:\u5230|\u52a8\u5230)?|\u79fb\u81f3|\u62d6(?:\u5230|\u8fc7\u53bb)?|\u663e\u793a(?:\u5230|\u5728)?).{0,18}(?:secondary|primary|main|second|\u526f\u5c4f|\u526f\u663e\u793a\u5668|\u4e3b\u5c4f|\u4e3b\u663e\u793a\u5668|\u7b2c[\u4e00\u4e8c](?:\u4e2a)?(?:\u5c4f|\u663e\u793a\u5668)|[12]\s*(?:screen|display|monitor))/iu,
    /(?:打开|启动|运行|访问|开启|帮我打开|帮我启动)\s*[「"“']?(.+?)[」"”']?\s*(?:并|然后|再|之后|,|，)?.{0,24}(?:放到|移到|移动到|挪到|拖到|显示到|放在|移至|move\s+(?:it\s+)?to|put\s+(?:it\s+)?on).{0,12}(?:副屏|副显示器|第二屏|第二个屏|扩展屏|外接屏|2号屏|二号屏|主屏|主显示器|第一屏|第一个屏|1号屏|一号屏|secondary|primary|main\s*(?:screen|display|monitor)|second\s*(?:screen|display|monitor))/iu,
    /(?:open|launch|start|run|visit)\s+(.+?)\s+(?:and\s+)?(?:move|put|place)\s+(?:it\s+)?(?:to|on|onto)\s+(?:the\s+)?(?:secondary|primary|main|second)\s*(?:screen|display|monitor)?/iu,
  ];

  for (const pattern of patterns) {
    const match = normalizedText.match(pattern);
    const target = match?.[1]?.trim().replace(/[，,。.!！?？;；]+$/u, '');
    if (target) {
      return target;
    }
  }

  return '';
}

function shouldPlannerTargetOpenAsResource(target: string) {
  return shouldAgentRuntimeCoreTargetOpenAsResource(target);
}

export function shouldPlannerToolOpenOrSearchTarget(toolName: AgentToolCallName) {
  return toolName === 'launch_local_app'
    || toolName === 'open_resource'
    || toolName === 'browser_search'
    || toolName === 'search_web'
    || toolName === 'execute_desktop_action'
    || toolName === 'execute_desktop_sequence';
}

export function createPlannerOpenAndMoveSequenceInput(options: {
  forceNew?: boolean;
  sourceText: string;
  target: string;
  targetDisplay: string;
  toolName?: AgentToolCallName;
}) {
  return createAgentRuntimeCoreOpenMoveSequenceInput(options);
}

export function extractAbsoluteLocalPathCandidate(text: string) {
  const quotedMatch = text.match(/["“]([a-zA-Z]:\\[^"”\r\n]+)["”]/u);
  if (quotedMatch?.[1]) {
    return quotedMatch[1].trim().replace(/[\s"'“”]+$/gu, '');
  }

  const rawMatch = text.match(/([a-zA-Z]:\\[^\r\n]+)/u);
  return rawMatch?.[1]
    ? rawMatch[1].trim().replace(/[\s"'“”，。.!！?？]+$/gu, '')
    : '';
}

function stripAgentCommandPrefix(value: string) {
  return value
    .trim()
    .replace(/^\/\s*(?:agent|助手|智能体|代理)\s*/iu, '')
    .trim();
}

const PLANNER_VIDEO_SOURCE_PATTERN = /(?:\b(?:video|clip|youtube|bilibili|bili|shorts?|stream|movie)\b|\u89c6\u9891|\u5f71\u7247|\u77ed\u7247|\u756a\u5267|\u5f71\u50cf)/iu;

const PLANNER_VIDEO_SUMMARY_PATTERN = /(?:\b(?:watch|summari[sz]e|summary|recap|describe|explain)\b|\u770b|\u89c2\u770b|\u603b\u7ed3|\u6982\u62ec|\u6982\u8981|\u5206\u6790|\u8bb2\u4e86\u4ec0\u4e48|\u5185\u5bb9)/iu;

const PLANNER_EXPLICIT_VIDEO_SEARCH_PATTERN = /(?:\b(?:search|find|lookup|look\s*up)\b|\u641c\u7d22|\u641c|\u67e5\u627e|\u627e\u4e00\u4e0b|\u627e\u51e0\u4e2a)/iu;

function normalizePlannerVideoIntentText(text: string) {
  return stripAgentCommandPrefix(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .trim();
}

export function isPlannerVideoSummaryIntentWithoutSearch(text: string) {
  const normalizedText = normalizePlannerVideoIntentText(text);
  return PLANNER_VIDEO_SOURCE_PATTERN.test(normalizedText)
    && PLANNER_VIDEO_SUMMARY_PATTERN.test(normalizedText)
    && !PLANNER_EXPLICIT_VIDEO_SEARCH_PATTERN.test(normalizedText);
}
