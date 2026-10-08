import { getOrCreateAgentCanonicalEventJournal } from '../../../agent';
import { desktopPetChatStore } from '../../../chatStore';
import { pushFrontendRuntimeLog } from '../../../frontendRuntimeLogger';
import { publishAgentRuntimeWorldTaskStarted } from '../../../runtime-world/agentRuntimeWorldBridge';
import { createAgentProductionSessionRunMessage } from './sessionMessageProjection';
import type { RunPreparedAgentProductionSessionOptions } from './controllerOptions';

export function beginInitialAgentRunPresentation({ shouldAutoSpeakReply, warmLocalReplyVoice, instruction, preparedRequest }: {
  shouldAutoSpeakReply: boolean;
} & Pick<RunPreparedAgentProductionSessionOptions, 'warmLocalReplyVoice' | 'instruction' | 'preparedRequest'>) {
  if (shouldAutoSpeakReply) {
    warmLocalReplyVoice(preparedRequest.currentConfig.settings);
  }

  const runMessage = createAgentProductionSessionRunMessage({
    instruction,
    preparedRequest,
  });
  const runMessageId = runMessage.id ?? null;
  const canonicalEventJournal = getOrCreateAgentCanonicalEventJournal(
    runMessageId ?? `request-${preparedRequest.requestToken}`,
  );
  desktopPetChatStore.addMessage(runMessage);

  publishAgentRuntimeWorldTaskStarted();

  pushFrontendRuntimeLog('agent-session-v2', 'session started', {
    instruction,
    sourceText: preparedRequest.outgoingText,
    taskId: null,
    stateRevision: null,
  });
  return { runMessageId, canonicalEventJournal };
}
