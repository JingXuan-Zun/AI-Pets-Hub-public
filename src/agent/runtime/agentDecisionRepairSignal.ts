import { compactAgentPlanningSignalText } from './agentPlanningSignalEvidence';

export function createAgentInvalidModelOutputRepairText(modelResponse: string) {
  return [
    'The model produced rejected invalid model output.',
    'outputRepairPolicy=This repair is decision-contract-driven. Correct the JSON/action contract without changing the user intent or prescribing a fixed recovery tool chain.',
    'Return exactly one JSON object using one of the allowed Agent actions.',
    'Allowed actions: tool_call, tool_calls, ask_user, final_answer.',
    'If the task is still incomplete, choose a valid next tool or ask one short necessary question.',
    `Rejected output: ${compactAgentPlanningSignalText(modelResponse, 520)}`,
  ].join('\n');
}

export function createAgentUnavailableToolRepairText(options: {
  allowedPrimaryToolNames: readonly string[];
  toolName: string | null | undefined;
}) {
  return [
    'The model produced a rejected unavailable tool selection.',
    'outputRepairPolicy=This repair is decision-contract-driven. Choose from the allowed primary tools without inventing compatibility-only tool names or a fixed recovery tool chain.',
    `Rejected tool: ${options.toolName ?? 'unknown'}`,
    `Allowed primary tools: ${options.allowedPrimaryToolNames.join(', ')}`,
    'Choose one allowed primary tool and express the operation through its args, or ask_user/final_answer only when evidence truly supports that.',
  ].join('\n');
}

export function createAgentInvalidToolInputRepairText(options: {
  args?: Record<string, unknown> | null;
  error: string;
  toolName: string | null | undefined;
}) {
  return [
    'The model produced a rejected invalid tool input.',
    'outputRepairPolicy=This repair is decision-contract-driven. Correct the selected tool args against the schema without changing the user intent or adding fixed fallback steps.',
    `Rejected tool: ${options.toolName ?? 'unknown'}`,
    `Schema error: ${options.error}`,
    options.args ? `Rejected args: ${compactAgentPlanningSignalText(options.args, 520)}` : '',
    'Return one corrected JSON decision. Keep the same user intent, but provide args that match the selected tool schema, including required parameters and correct primitive types.',
  ].filter(Boolean).join('\n');
}
