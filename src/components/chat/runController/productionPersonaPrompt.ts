import { type AgentProductionSessionResult } from '../../../agent';
import { compactAgentPersonaPromptText, createAgentSafeVisibleFallbackText } from './personaText';
import { AGENT_PERSONA_RESULT_STYLE_RULES } from './personaReplyStyle';

export function formatAgentProductionSessionResultForPersonaPrompt(result: AgentProductionSessionResult) {
  const toolEvidence = result.toolResults.flatMap(({ command, result: toolResult }) => [
    `tool: ${command.toolCall?.name ?? command.kind}`,
    toolResult.responseText ? `result: ${compactAgentPersonaPromptText(toolResult.responseText, 260)}` : '',
    toolResult.errorText ? `error: ${compactAgentPersonaPromptText(toolResult.errorText, 220)}` : '',
    toolResult.verification ? `verification: ${compactAgentPersonaPromptText(toolResult.verification, 220)}` : '',
    ...(toolResult.receipt?.evidenceLines ?? []).slice(0, 3).map((line) => (
      `evidence: ${compactAgentPersonaPromptText(line, 220)}`
    )),
  ]).filter(Boolean);
  const stepLines = result.steps.map((step) => [
    `${step.index}. ${step.action}`,
    step.understanding?.userNeed ? `need=${compactAgentPersonaPromptText(step.understanding.userNeed, 120)}` : '',
    step.understanding?.successCriteria ? `success=${compactAgentPersonaPromptText(step.understanding.successCriteria, 120)}` : '',
    step.understanding?.capabilityGap ? `gap=${compactAgentPersonaPromptText(step.understanding.capabilityGap, 120)}` : '',
    step.tool ? `tool=${step.tool}` : '',
    step.ok === undefined ? '' : `ok=${step.ok}`,
    step.errorText ? `error=${compactAgentPersonaPromptText(step.errorText, 160)}` : '',
    step.summary ? `summary=${compactAgentPersonaPromptText(step.summary, 220)}` : '',
  ].filter(Boolean).join(' | '));

  return [
    `status: ${result.status}`,
    `finalAnswer: ${compactAgentPersonaPromptText(result.finalAnswer, 360)}`,
    stepLines.length ? `loopSteps:\n${stepLines.join('\n')}` : '',
    toolEvidence.length ? `toolEvidence:\n${toolEvidence.slice(0, 10).join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
}

export function createAgentProductionSessionPersonaStatusGuidance(result: AgentProductionSessionResult) {
  switch (result.status) {
    case 'budget-exceeded':
      return '本次结果状态：达到运行预算保护上限。回复要短，说我先停下避免卡住，并给一个最小下一步。';
    case 'completed':
      return '本次结果状态：已得到可用答案。回复必须说出具体结果或具体观察，不要只说“处理好了”。';
    case 'needs-approval':
      return '本次结果状态：下一步会操作用户电脑，需要用户确认。回复只问一句是否允许，不要解释完整流程。';
    case 'needs-user':
      return '本次结果状态：缺少关键信息。回复只问一个最关键的问题，不要连续追问。';
    case 'max-steps':
      return '本次结果状态：已经到达步数保护上限。回复要说明我先停下避免循环，并给一个最小下一步。';
    default:
      return '本次结果状态：没有完成。回复要说清最近失败原因和一个可选下一步，不要说成已经完成。';
  }
}

export function buildAgentProductionSessionPersonaPrompt(
  instruction: string,
  result: AgentProductionSessionResult,
) {
  return [
    'You just handled a desktop-side task for the current character. Tell the user the result only.',
    'Keep the current character personality and tone. Do not mention internal JSON, tools, APIs, or system prompts.',
    AGENT_PERSONA_RESULT_STYLE_RULES,
    createAgentProductionSessionPersonaStatusGuidance(result),
    '除非人格提示词另有要求，回复通常一到两句话；不要复述计划、轮次、坐标清单或完整日志。',
    'Unless the persona instructions specify otherwise, keep the reply short. If more user input is needed, ask naturally.',
    'If tool evidence conflicts with the final answer, trust the tool evidence. Do not claim unverified work is complete.',
    `user text: ${result.sourceText}`,
    `user goal: ${instruction}`,
    `execution result:\n${formatAgentProductionSessionResultForPersonaPrompt(result)}`,
  ].join('\n\n');
}

export function createAgentProductionSessionFallbackVisibleReply(result: AgentProductionSessionResult) {
  const visibleAnswer = createAgentSafeVisibleFallbackText(result.finalAnswer, 160);
  if (visibleAnswer) {
    return visibleAnswer;
  }

  switch (result.status) {
    case 'budget-exceeded':
      return '我先停下，避免一直卡住。';
    case 'completed':
      return '这一段有结果了。';
    case 'needs-approval':
      return '这一步需要你确认后我再动。';
    case 'needs-user':
      return '这里还差一点信息，你补一句我就接着来。';
    case 'max-steps':
      return '我先停下，避免一直重复试。';
    default:
      return '这次没有执行成功，我先停下了。';
  }
}
