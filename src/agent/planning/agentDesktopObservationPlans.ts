import { type AgentChatCommand } from '../agentChatCommand';
import { type AgentExecutionPlan, getToolCallTargetDescription, createPlanStep } from './agentPlanShared';
export function buildDesktopObservationToolPlan(command: AgentChatCommand): AgentExecutionPlan | null {
  const toolName = command.toolCall?.name;
  if (!toolName) return null;
  const targetDescription = getToolCallTargetDescription(command);
  const explicitGoal = command.toolCall?.goal?.trim();
  switch (toolName) {

    case 'manage_game_companion_loop': {
      const action = command.toolCall?.input?.action;
      const actionSummary = action === 'stop'
        ? 'Stop the low-frequency game companion loop'
        : action === 'status'
          ? 'Read the current game companion loop status'
          : 'Start the low-frequency game companion loop';
      return {
        commandKind: command.kind,
        goal: explicitGoal || actionSummary,
        instruction: command.instruction,
        steps: [
          createPlanStep(
            'manage-game-companion-loop',
            'manage-game-companion-loop',
            actionSummary,
            {
              details: [
                'The runtime may capture game screen/window thumbnails at a low frequency and send short companion comments.',
                'It does not read game memory, inject into the game process, or perform gameplay input.',
              ],
              requiresDesktopMode: true,
              targetDescription,
            },
          ),
        ],
      };
    }
    default: return null;
  }
}
