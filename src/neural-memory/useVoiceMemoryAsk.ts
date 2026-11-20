import { useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { buildScopedChatHistory } from '../components/chat/chatScopedContextUtils';
import { createChatMessageId } from '../components/chat/multiPetChat';
import { judgeApprovalAnswerWithModel } from '../components/chat/voiceApproval';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { speakCompanionLine } from '../life-companion/companionLineSpeech';
import { getDesktopPetSlot } from '../multiPetRoster';
import type { PetConfig, PetConfigUpdateHandler } from '../types';
import { voiceMicStatusStore } from '../voice/voiceMicStatus';
import { approveNeuralMemoryProposal } from './neuralMemoryProposalApproval';
import { listNeuralMemoryProposals, removeNeuralMemoryProposal } from './neuralMemoryProposalConfig';
import type { NeuralMemoryProposal } from './neuralMemoryProposalTypes';
import {
  buildMemoryAskInstruction,
  classifyMemoryAnswer,
  readPendingMemoryAsk,
  registerMemoryAskAnswerer,
  setPendingMemoryAsk,
} from './voiceMemoryAsk';

// Pet window, voice conversation only: a new memory proposal → she asks out loud (briefly what
// it is), and the user's spoken answer approves or dismisses it (voiceMemoryAsk.ts).

const IDLE_WAIT_MS = 60_000;
const MODEL_TIMEOUT_MS = 30_000;
const MAX_JUDGED_ANSWER_CHARS = 20;

const idle = () => { const { isTyping, isSpeaking } = desktopPetChatStore.getState(); return !isTyping && !isSpeaking; };
const inConversation = () => voiceMicStatusStore.getState().conversationActive;

async function askAloud(config: PetConfig, proposal: NeuralMemoryProposal) {
  const slot = getDesktopPetSlot(config, proposal.roleId);
  if (!slot) return;
  const until = Date.now() + IDLE_WAIT_MS;
  while (!idle() && Date.now() < until) await new Promise((resolve) => { setTimeout(resolve, 500); });
  if (!idle() || !inConversation() || readPendingMemoryAsk()) return;
  const history = buildScopedChatHistory(desktopPetChatStore.getState().messages, 'single', slot.id).slice(-10);
  const { getPetResponseStrict } = await import('../services/geminiService');
  const question = (await getPetResponseStrict(history, buildMemoryAskInstruction(proposal), slot.personality, { ...config.settings, webSearchEnabled: false }, 'block', [], AbortSignal.timeout(MODEL_TIMEOUT_MS))).trim();
  if (!question || !idle()) return;
  desktopPetChatStore.addMessage({ chatMode: 'single', createdAt: Date.now(), id: createChatMessageId(`memory-ask-${slot.id}`), petId: slot.id, petName: slot.personality.name, role: 'model', text: question });
  speakCompanionLine(question, slot.id);
  setPendingMemoryAsk({ askedAt: Date.now(), proposalId: proposal.id, question, roleId: slot.id });
  pushFrontendRuntimeLog('角色记忆提议', '语音对话中开口问要不要记住', { petId: slot.id, proposalId: proposal.id });
}

export function useVoiceMemoryAsk(options: {
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  onUpdateConfig: PetConfigUpdateHandler;
  publishStatusMessage: (message: string) => void;
}) {
  const { config, configRef, onUpdateConfig, publishStatusMessage } = options;
  const seenRef = useRef<Set<string> | null>(null);
  const askingRef = useRef(false);

  // Proposals already waiting when the app started are not asked about; only new ones.
  useEffect(() => {
    const proposals = listNeuralMemoryProposals(config);
    if (!seenRef.current) { seenRef.current = new Set(proposals.map((proposal) => proposal.id)); return; }
    const seen = seenRef.current;
    const fresh = proposals.filter((proposal) => !seen.has(proposal.id));
    fresh.forEach((proposal) => seen.add(proposal.id));
    const target = fresh[fresh.length - 1];
    if (!target || askingRef.current || readPendingMemoryAsk() || !inConversation()) return;
    askingRef.current = true;
    void askAloud(configRef.current, target)
      .catch((error) => pushFrontendRuntimeLog('角色记忆提议', '开口问失败', { error: error instanceof Error ? error.message : String(error) }))
      .finally(() => { askingRef.current = false; });
  }, [config, configRef]);

  useEffect(() => registerMemoryAskAnswerer(async (text) => {
    const ask = readPendingMemoryAsk();
    const proposal = ask && listNeuralMemoryProposals(configRef.current).find((item) => item.id === ask.proposalId);
    if (!ask || !proposal) { setPendingMemoryAsk(null); return false; }
    let answer = classifyMemoryAnswer(text);
    if (!answer && text.trim().length <= MAX_JUDGED_ANSWER_CHARS) {
      const judged = await judgeApprovalAnswerWithModel(configRef.current.settings)(ask.question, text).catch(() => null);
      answer = judged === 'deny' ? 'deny' : judged ? 'approve' : null;
    }
    // Anything else: the user moved on; the proposal stays in the sidebar, her question is done.
    setPendingMemoryAsk(null);
    if (!answer) return false;
    const next = answer === 'deny'
      ? { config: removeNeuralMemoryProposal(configRef.current, proposal.id), message: '好，这条不记了。' }
      : await approveNeuralMemoryProposal(configRef.current, proposal, proposal.content);
    if (next.config) {
      configRef.current = next.config;
      onUpdateConfig(next.config, { persist: true });
    }
    publishStatusMessage(next.message);
    pushFrontendRuntimeLog('角色记忆提议', answer === 'deny' ? '用户用语音说不用记' : '用户用语音同意记住', { proposalId: proposal.id });
    return true;
  }), [configRef, onUpdateConfig, publishStatusMessage]);
}
