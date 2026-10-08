import {
  type PetConfig,
} from '../types';
import {
  type AgentChatCommand,
  type AgentToolStateSummary,
} from './agentChatCommand';
import {
  resolveAgentCharacterAnimationSkillCommand,
} from './agentCharacterSkillIntent';
import {
  type AgentCoreRecoveryRequest,
  type AgentCoreReplanDecision,
  type AgentCoreReplanRequest,
} from './agentPlannerReplanContract';
import {
  type AgentWorkingMemorySnapshot,
} from './agentChatContext';
import {
  AGENT_UNTRUSTED_TOOL_CONTENT_RULE,
} from './agentUntrustedToolContentRule';
import {
  matchesAgentLegacyPlannerToolRelevance,
} from './agentPlannerRelevance';
import {
  createAgentPlannerAvailableToolLines,
  createAgentPlannerToolUnionText,
  formatAgentToolLifecycleMetadata,
} from './agentToolRegistry';
import {
  type AgentPlannerDecision,
} from './planner/plannerCommandNormalization';
import {
  createAgentCommandFromPlannerDecision,
  createAgentCommandFromPlannerFallback,
} from './planner/plannerDecisionConversion';
export {
  normalizePlannerDisplayMoveTarget,
  extractPlannerExistingWindowMoveTargetFromText,
  extractPlannerOpenAndMoveTargetFromText,
} from './planner/plannerCommandNormalization';
export {
  createAgentCommandFromPlannerDecision,
} from './planner/plannerDecisionConversion';

export interface AgentPlannerContextOptions {
  workingMemory?: AgentWorkingMemorySnapshot | null;
}

const PLANNER_SYSTEM_INSTRUCTION = [
  'You are a desktop Agent request planner inside a desktop pet app.',
  'Your job is to decide whether the user is asking for a local computer tool call.',
  'Return only one JSON object. No markdown, no commentary.',
  '',
  'JSON schema:',
  '{',
  '  "intent": "tool" | "chat" | "clarify" | "unsupported",',
  `  "tool": ${createAgentPlannerToolUnionText()},`,
  '  "args": {},',
  '  "goal": "short user-facing goal in Chinese",',
  '  "confidence": 0.0,',
  '  "steps": [{ "tool": "optional tool name", "args": {}, "reason": "why" }],',
  '  "message": "short Chinese clarification or unsupported reason"',
  '}',
  '',
  'Available tools:',
  ...createAgentPlannerAvailableToolLines(),
  '',
  'Rules:',
  '- If the request asks about this computer, desktop, apps, screen, local files/icons, or wants the pet to operate the computer, choose a tool.',
  '- Do not answer local computer facts from memory. If the user asks computer config or screen info, choose get_system_info or get_display_info.',
  '- If the user asks how a local folder/project/program runs and provides a path, choose inspect_local_project.',
  '- If the user asks to run/start one of the suggested project actions, choose run_local_project_action. This tool requires confirmation later; do not choose it for analysis-only questions.',
  '- If the user asks to search the web, open a search page, visit a website, or open the browser for a specific query/URL, choose browser_search with query. If they only ask to open the browser app, choose launch_local_app.',
  '- If the user asks to watch or summarize a video, do not turn that into browser_search unless they explicitly asked to search/find videos. If the video source is missing, clarify whether it is on the current screen or ask for the URL.',
  '- If the user asks about desktop pet settings, configuration, or a setting value, choose get_pet_settings. Use query for discovery or path for an exact field.',
  '- If the user asks to change, enable, or disable a desktop pet setting, first use get_pet_settings unless the exact path and correctly typed value are established; then choose update_pet_settings with changesJson. Desktop pet settings are in-process configuration: do not use screen-location or desktop-input tools to find a setting. If the intended value is missing, read the current setting and ask one short question for it.',
  '- If the user asks about voice settings/status, choose get_voice_status.',
  '- If the user asks to switch voice playback provider, choose switch_tts_provider with provider browser/api/local.',
  '- If the user asks to warm up/preload local voice, choose warmup_local_voice.',
  '- If the user asks to enable/disable microphone voice input, choose set_voice_input.',
  '- If the user asks to start listening now, start recording, or begin a microphone session, choose start_voice_input_session.',
  '- If the user asks to stop listening now or end recording, choose stop_voice_input_session.',
  '- If a required argument is missing, use intent "clarify" and ask for the missing detail.',
  '- You may include "steps" for multi-step reasoning, but "tool" must be the first concrete tool to call now. The app will verify and continue through its run loop.',
  '- If Agent working memory is provided, use it only to resolve references like "刚才那个", "第二个", "按刚才执行", or prior candidate actions. It may be stale; observe again for current computer facts.',
  '- Never invent tool names or arguments outside the listed schemas.',
  '- For desktop organization, default to mode "preview" unless the user is clearly confirming a previously shown plan.',
  '- For desktop organization custom placement, preserve the open-ended user request in placementIntent instead of turning it into rigid A/B choices. placementIntent is evidence for preview/verification, not a fixed tool chain.',
  '- Do not synthesize unsupported fixed corner/area execution arguments for desktop organization. If exact placement cannot be represented safely, still preview the closest supported plan with placementIntent and let the result expose capability gaps.',
  '- Do not ask "choose option 1 or 2" for desktop organization unless the available evidence proves there are exactly two safe supported actions. Prefer a tool preview/approval step or one open clarification question.',
  '- If the request is normal conversation that does not need local computer action/state, use intent "chat".',
  '- If the request asks for deletion, overwriting, arbitrary command execution, credential access, or unsupported control, use intent "unsupported".',
  '- Prefer existing/focused app windows for launch_local_app unless the user explicitly asks to open a new one.',
].join('\n');

const TOOL_LIFECYCLE_SYSTEM_INSTRUCTION = [
  'Tool lifecycle metadata:',
  '- observes = state the tool can inspect.',
  '- mutates = state the tool can change.',
  '- verifies = evidence the tool can prove after execution.',
  '- recoversWith = preferred tools after failed or uncertain results.',
  '- Choose observation/verification tools whose observes/verifies fields match the missing evidence before retrying mutating tools.',
  AGENT_UNTRUSTED_TOOL_CONTENT_RULE,
].join('\n');

const REPLAN_SYSTEM_INSTRUCTION = [
  PLANNER_SYSTEM_INSTRUCTION,
  TOOL_LIFECYCLE_SYSTEM_INSTRUCTION,
  '',
  'You are replanning after the Agent has already executed one or more observation tools.',
  'Use the observation summary as ground truth. Do not repeat completed observation unless the observation is failed or insufficient.',
  'When structured tool state is provided, treat observedState, verificationEvidence, missingEvidence, and recommendedRecovery as higher priority than free-form response text.',
  'If missingEvidence is present, choose a tool whose observes/verifies can produce that evidence before selecting a mutating tool.',
  'Choose the next single useful tool, or intent "chat" if no more local action is needed.',
  'If the next tool changes files, moves icons, launches apps, records audio, warms local runtime, or runs project actions, still return it as a tool; the app will request user approval before execution.',
].join('\n');

const RECOVERY_SYSTEM_INSTRUCTION = [
  PLANNER_SYSTEM_INSTRUCTION,
  TOOL_LIFECYCLE_SYSTEM_INSTRUCTION,
  '',
  'You are deciding recovery after an Agent tool result was failed, unverified, or needs user input.',
  'Use the result summary as ground truth. Do not claim success unless the result summary proves it.',
  'When structured tool state is provided, prioritize it over free-form result text.',
  'Use missingEvidence to decide what must be observed or verified next.',
  'Use recommendedRecovery as candidate tools, but still choose only one registered tool that matches the missing evidence and risk.',
  'Prefer a read-only verification/observation tool when it can clarify the state.',
  'If recovery would change files, move icons, launch apps, record audio, warm local runtime, or run project actions, still return it as a tool; the app will request user approval before execution.',
  'If no registered tool can help, return intent "chat" with a short message.',
].join('\n');

function normalizePlannerText(value: string) {
  return value.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
}

function createAgentPlannerInput(
  text: string,
  options: AgentPlannerContextOptions = {},
) {
  const sourceText = text.trim();
  const memoryText = options.workingMemory?.summaryText?.trim();
  if (!memoryText || memoryText === 'none') {
    return sourceText;
  }

  return [
    'Agent working memory from previous turns:',
    memoryText,
    '',
    'Current user request:',
    sourceText,
    '',
    'Use working memory to resolve references, but choose observation tools again for fresh computer facts.',
  ].join('\n');
}

function createAgentStructuredStateSummaryText(stateSummary?: AgentToolStateSummary | null) {
  if (!stateSummary) {
    return 'none';
  }

  const lines = [
    stateSummary.observedState?.length ? `observedState: ${stateSummary.observedState.join(' | ')}` : '',
    stateSummary.changedState?.length ? `changedState: ${stateSummary.changedState.join(' | ')}` : '',
    stateSummary.verificationEvidence?.length ? `verificationEvidence: ${stateSummary.verificationEvidence.join(' | ')}` : '',
    stateSummary.missingEvidence?.length ? `missingEvidence: ${stateSummary.missingEvidence.join(' | ')}` : '',
    stateSummary.recommendedRecovery?.length ? `recommendedRecovery: ${stateSummary.recommendedRecovery.join(' | ')}` : '',
    stateSummary.actionEvidence ? `actionEvidence: ${JSON.stringify(stateSummary.actionEvidence)}` : '',
    stateSummary.structuredEvidence ? `structuredEvidence: ${JSON.stringify(stateSummary.structuredEvidence)}` : '',
  ].filter(Boolean);

  return lines.length ? lines.join('\n') : 'none';
}

function extractPlannerJson(text: string): AgentPlannerDecision | null {
  const normalizedText = normalizePlannerText(text);
  const directParse = tryParsePlannerJson(normalizedText);
  if (directParse) {
    return directParse;
  }

  const startIndex = normalizedText.indexOf('{');
  const endIndex = normalizedText.lastIndexOf('}');
  if (startIndex < 0 || endIndex <= startIndex) {
    return null;
  }

  return tryParsePlannerJson(normalizedText.slice(startIndex, endIndex + 1));
}

function tryParsePlannerJson(text: string): AgentPlannerDecision | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as AgentPlannerDecision
      : null;
  } catch {
    return null;
  }
}

export function shouldUseAgentPlanner(text: string, deterministicCommand: AgentChatCommand | null) {
  const sourceText = text.trim();
  if (!sourceText) {
    return false;
  }

  if (deterministicCommand && deterministicCommand.kind !== 'unsupported') {
    return false;
  }

  if (sourceText.startsWith('/')) {
    return true;
  }

  return matchesAgentLegacyPlannerToolRelevance(sourceText);
}

export async function resolveAgentChatCommandWithPlanner(
  text: string,
  settings: PetConfig['settings'],
  options: AgentPlannerContextOptions = {},
) {
  const characterSkillCommand = resolveAgentCharacterAnimationSkillCommand(text);
  if (characterSkillCommand) {
    return characterSkillCommand;
  }

  try {
    const { getAgentPlannerResponse } = await import('../services/geminiService');
    const plannerInput = createAgentPlannerInput(text, options);
    const plannerResponse = await getAgentPlannerResponse(
      plannerInput,
      [
        PLANNER_SYSTEM_INSTRUCTION,
        TOOL_LIFECYCLE_SYSTEM_INSTRUCTION,
      ].join('\n\n'),
      settings,
    );

    return createAgentCommandFromPlannerDecision(text.trim(), extractPlannerJson(plannerResponse));
  } catch (error) {
    return createAgentCommandFromPlannerFallback(text.trim(), {
      message: `Agent planner 调用失败：${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

function createAgentReplanPlannerInput(
  request: AgentCoreReplanRequest,
  options: AgentPlannerContextOptions = {},
) {
  const remainingStepsText = request.remainingPlannerSteps.length
    ? request.remainingPlannerSteps.map((step) => (
        `${step.index}. ${step.tool} args=${JSON.stringify(step.args)} reason=${step.reason ?? ''}`
      )).join('\n')
    : 'none';
  const workingMemoryText = options.workingMemory?.summaryText?.trim();

  return [
    workingMemoryText && workingMemoryText !== 'none'
      ? [
          'Agent working memory from previous turns:',
          workingMemoryText,
          '',
        ].join('\n')
      : '',
    `Original user request: ${request.originalCommand.sourceText}`,
    `Current goal: ${request.corePlan.goal ?? request.originalCommand.instruction}`,
    `Completed tool: ${request.currentCommand.toolCall?.name ?? request.currentCommand.kind}`,
    'Structured tool state:',
    createAgentStructuredStateSummaryText(request.stateSummary),
    '',
    'Observation summary:',
    request.observationSummary,
    '',
    'Remaining planner steps from the previous plan:',
    remainingStepsText,
    '',
    'Return the next tool JSON now. If the observation already answers the user and no further local action is needed, return {"intent":"chat","message":"done"}.',
  ].join('\n');
}

export async function resolveAgentReplanCommandWithPlanner(
  request: AgentCoreReplanRequest,
  settings: PetConfig['settings'],
  options: AgentPlannerContextOptions = {},
): Promise<AgentCoreReplanDecision | null> {
  try {
    const { getAgentPlannerResponse } = await import('../services/geminiService');
    const plannerInput = createAgentReplanPlannerInput(request, options);
    const plannerResponse = await getAgentPlannerResponse(
      plannerInput,
      REPLAN_SYSTEM_INSTRUCTION,
      settings,
    );
    const command = createAgentCommandFromPlannerDecision(
      request.originalCommand.sourceText,
      extractPlannerJson(plannerResponse),
    );

    return command
      ? {
          command,
          reason: 'Planner replanned after observing current computer state.',
        }
      : null;
  } catch {
    return null;
  }
}

function createAgentRecoveryPlannerInput(
  request: AgentCoreRecoveryRequest,
  options: AgentPlannerContextOptions = {},
) {
  const workingMemoryText = options.workingMemory?.summaryText?.trim();

  return [
    workingMemoryText && workingMemoryText !== 'none'
      ? [
          'Agent working memory from previous turns:',
          workingMemoryText,
          '',
        ].join('\n')
      : '',
    `Original user request: ${request.originalCommand.sourceText}`,
    `Current goal: ${request.corePlan.goal ?? request.originalCommand.instruction}`,
    `Completed tool: ${request.currentCommand.toolCall?.name ?? request.currentCommand.kind}`,
    request.currentCommand.toolCall?.name
      ? `Completed tool lifecycle: ${formatAgentToolLifecycleMetadata(request.currentCommand.toolCall.name)}`
      : '',
    'Structured tool state:',
    createAgentStructuredStateSummaryText(request.stateSummary),
    '',
    'Result summary:',
    request.resultSummary,
    '',
    'Return the next recovery tool JSON now. If no local tool should run, return {"intent":"chat","message":"done"}.',
  ].join('\n');
}

export async function resolveAgentRecoveryCommandWithPlanner(
  request: AgentCoreRecoveryRequest,
  settings: PetConfig['settings'],
  options: AgentPlannerContextOptions = {},
): Promise<AgentCoreReplanDecision | null> {
  try {
    const { getAgentPlannerResponse } = await import('../services/geminiService');
    const plannerInput = createAgentRecoveryPlannerInput(request, options);
    const plannerResponse = await getAgentPlannerResponse(
      plannerInput,
      RECOVERY_SYSTEM_INSTRUCTION,
      settings,
    );
    const command = createAgentCommandFromPlannerDecision(
      request.originalCommand.sourceText,
      extractPlannerJson(plannerResponse),
    );

    return command
      ? {
          command,
          reason: 'Planner selected a recovery action after assessing the tool result.',
        }
      : null;
  } catch {
    return null;
  }
}
