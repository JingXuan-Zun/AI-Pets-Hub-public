import { compactAgentPersonaPromptText } from './personaText';

export const AGENT_PERSONA_RESULT_STYLE_RULES = [
  '角色回复硬性规则：',
  '你就是当前角色本人，不是 Agent 系统播报员、客服或任务总结器。',
  '以下是 Agent 的默认回复建议；如果人格提示词明确要求其他口吻、长度、结构或格式，必须以人格提示词为准。',
  '除非人格提示词明确要求，不要说“帮用户分析”“提醒用户”“根据工具结果”“任务已完成”“我会继续观察”这类系统化、计划化句子。',
  '把工具证据消化成角色自然对白；需要用户确认时，只问一句短问题，除非人格提示词另有要求。',
  '默认成功回复应落到一条具体结果或可验证细节；人格提示词有其他输出结构时，保留其结构。',
  '默认失败、缺信息、需要确认时都要短；人格提示词明确要求的格式、字段和段落不得省略。',
  '优先遵守人格提示词里的称呼、口癖、括号动作、情绪描写和回复格式。',
].join('\n');

export const AGENT_PERSONA_SYSTEM_TONE_PATTERNS = [
  { label: '帮用户分析', pattern: /帮(?:你|用户)?分析/u },
  { label: '提醒用户', pattern: /提醒(?:你|用户)/u },
  { label: '根据工具结果', pattern: /根据(?:工具|执行|分析|以上).{0,8}(?:结果|信息|内容)/u },
  { label: '任务已完成', pattern: /(?:任务|操作|执行).{0,4}(?:已|已经)?完成/u },
  { label: '继续观察', pattern: /我会继续(?:观察|分析|关注)/u },
  { label: 'AI/Agent 身份', pattern: /作为(?:一个)?(?:AI|助手|Agent|智能体)/iu },
  { label: '工具播报', pattern: /工具(?:显示|返回|结果|证据)/u },
  { label: '内部流程名', pattern: /(?:AgentSessionV2|AgentProductionSession|Agent V2|JSON|工具调用|结构化决策|本机能力执行器)/iu },
  { label: '空泛完成句', pattern: /^(?:处理好了|完成了|搞定了|好了|已经处理好了)[。.!！]*$/u },
  { label: '整理结果套话', pattern: /(?:把|将).{0,6}结果.{0,8}整理给(?:你|用户)/u },
];

export function findAgentPersonaReplyStyleIssues(text: string) {
  const normalizedText = text.replace(/\s+/gu, ' ').trim();
  if (!normalizedText) {
    return [];
  }

  return AGENT_PERSONA_SYSTEM_TONE_PATTERNS
    .filter(({ pattern }) => pattern.test(normalizedText))
    .map(({ label }) => label);
}

export function shouldRetryAgentPersonaReply(text: string) {
  return findAgentPersonaReplyStyleIssues(text).length > 0;
}

export function buildAgentPersonaReplyRewritePrompt(options: {
  basePrompt: string;
  issues: string[];
  previousReply: string;
}) {
  const {
    basePrompt,
    issues,
    previousReply,
  } = options;

  return [
    basePrompt,
    '上一句回复仍然像系统播报，需要重写一次。',
    `命中的问题：${issues.join('、') || '系统化口吻'}`,
    `上一句回复：${compactAgentPersonaPromptText(previousReply, 520)}`,
    '请重写成当前角色本人对用户说的话，只输出重写后的角色对白。',
    '不要只说“处理好了”“搞定了”；成功要给一个具体结果，失败要给一个短原因，需要补充时只问一个问题。',
    '不要解释重写过程，不要提工具、系统、Agent、JSON、API，也不要使用上面命中的系统化话术。',
  ].join('\n\n');
}
