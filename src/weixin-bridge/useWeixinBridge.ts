import { useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import type { DesktopPetChatSendOptions } from '../chatState';
import { createChatImageAttachmentsFromFiles, MAX_CHAT_IMAGE_ATTACHMENTS } from '../components/chat/chatImageAttachmentUtils';
import { latestPendingAgentLoopApprovalId } from '../components/chat/runController/agentLoopApprovalRegistry';
import { judgeApprovalAnswerWithModel, resolvePendingApprovalBySpeech } from '../components/chat/voiceApproval';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { collectQqRelayOutgoing, createQqRelayState, formatQqReplyText, type QqRelayState } from '../qq-bridge/qqBridgeRelay';
import { wantsVoiceReply } from '../qq-bridge/qqBridgeSettings';
import { limitVoiceText } from '../qq-bridge/useQqBridge';
import { expressionLibraryBridge } from '../expression/expressionLibraryBridge';
import { getDesktopPetSlot } from '../multiPetRoster';
import { resolvePetVoiceSettings } from '../voice/petVoiceSettings';
import { prepareSpeechText } from '../voice/speechText';
import { synthesizeGptSovitsWav } from '../voice/ttsGptSovitsPlayback';
import type { PetConfig } from '../types';
import { replyToFamilyMember } from './weixinFamilyChat';
import { normalizeWeixinBridgeSettings, type WeixinInboundMessage } from './weixinBridgeSettings';

// Phone WeChat ⇄ the character. Each family member scans their own login. The owner's messages
// go into the chat like typing in the chat window (tools, approvals, everything); her replies and
// approval questions go back. Everyone else talks with her in their own private conversation
// (weixinFamilyChat.ts), apart from the chat window. Voice arrives already turned into text by
// WeChat. Replies go as text, image stickers as pictures, and (by default always) in her own
// voice as a short video.

type SendMessage = (textOverride?: string, options?: DesktopPetChatSendOptions) => Promise<void>;

// After this long without a message from the owner's phone, replies stop going to WeChat.
const RELAY_WINDOW_MS = 10 * 60 * 1000;
const RELAY_POLL_MS = 1000;

async function dataUrlsToAttachments(dataUrls: string[]) {
  const files: File[] = [];
  for (const dataUrl of dataUrls.slice(0, MAX_CHAT_IMAGE_ATTACHMENTS)) {
    const blob = await (await fetch(dataUrl)).blob();
    files.push(new File([blob], `weixin-${files.length + 1}.${blob.type.split('/')[1] ?? 'jpg'}`, { type: blob.type }));
  }
  return createChatImageAttachmentsFromFiles(files);
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/u, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export function useWeixinBridge({ config, configRef, sendMessage }: {
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  sendMessage: SendMessage;
}) {
  const settings = normalizeWeixinBridgeSettings(config.settings.weixinBridge);
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  useEffect(() => {
    const weixin = window.desktopPetShell?.weixin;
    if (!weixin) return undefined;
    if (!settings.enabled) {
      void weixin.stop();
      return undefined;
    }
    let relay: QqRelayState | null = null;
    let ownerAccountId = '';
    let lastOwnerMessageAt = 0;
    let ownerVoiceReplies = false;
    let voiceQueue: Promise<void> = Promise.resolve();
    // One family message at a time per person, so replies keep their order.
    const familyQueues = new Map<string, Promise<void>>();
    const reply = (accountId: string, text: string) => {
      void weixin.send(accountId, text).then((result) => {
        if (!result.ok) pushFrontendRuntimeLog('weixin-bridge', 'reply not delivered', { reason: result.error });
      });
    };
    const voiceMode = () => normalizeWeixinBridgeSettings(configRef.current.settings.weixinBridge).voiceReplyMode;

    // Her own voice (the character's voice pack), sent as a short video with her chat avatar:
    // bots can't send WeChat voice bubbles.
    const sendVoice = async (accountId: string, petId: string, speechText: string) => {
      const voiceSettings = resolvePetVoiceSettings(configRef.current, petId);
      if (voiceSettings.ttsProvider !== 'gpt-sovits') {
        pushFrontendRuntimeLog('weixin-bridge', 'voice reply skipped: only character voices (GPT-SoVITS) can be sent');
        return;
      }
      const text = limitVoiceText(prepareSpeechText(speechText, voiceSettings));
      if (!text) return;
      try {
        const wav = await synthesizeGptSovitsWav(text, voiceSettings);
        const avatarUrl = getDesktopPetSlot(configRef.current, petId)?.personality.chatAvatarUrl;
        const avatar = avatarUrl ? await fetch(avatarUrl).then((response) => response.blob()).then(blobToBase64).catch(() => '') : '';
        const result = await weixin.sendVoice(accountId, await blobToBase64(wav), avatar || undefined);
        if (!result.ok) pushFrontendRuntimeLog('weixin-bridge', 'voice reply not delivered', { reason: result.error });
      } catch (error) {
        pushFrontendRuntimeError('weixin-bridge', 'voice reply failed', error);
      }
    };
    // Image stickers go as pictures, after the text they belong to.
    const sendSticker = async (accountId: string, assetId: string) => {
      const preview = await expressionLibraryBridge.getPreview(assetId).catch(() => null);
      const base64 = preview?.ok && preview.dataUrl ? preview.dataUrl.replace(/^data:[^,]*,/u, '') : '';
      const result = base64 ? await weixin.sendImage(accountId, base64) : { error: 'image unavailable', ok: false };
      if (!result.ok) pushFrontendRuntimeLog('weixin-bridge', 'sticker not sent', { assetId, reason: result.error });
    };

    const handleOwnerMessage = async (message: WeixinInboundMessage) => {
      ownerAccountId = message.accountId;
      lastOwnerMessageAt = Date.now();
      if (latestPendingAgentLoopApprovalId() && message.text) {
        // Typed on the phone, so never her own voice: answered even while she is still asking out loud.
        const decision = await resolvePendingApprovalBySpeech(message.text, judgeApprovalAnswerWithModel(configRef.current.settings), () => false);
        reply(message.accountId, decision === 'deny' ? '好，这一步不做了。'
          : decision === 'approve-day' ? '好，今天的操作都不再问你了（发送、删除、付款这类还会问）。'
            : decision === 'approve-task' ? '好，这个任务后面的步骤都不再问你了。'
            : decision ? '好，这就去做。' : '还在等你确认上一步：回复“好”“都好”或“不要”就可以。');
        return;
      }
      relay = relay ?? createQqRelayState(Date.now());
      ownerVoiceReplies = wantsVoiceReply(voiceMode(), message.voice, message.text);
      const attachments = message.images.length ? await dataUrlsToAttachments(message.images) : [];
      await sendMessageRef.current(message.text, attachments.length ? { attachments } : undefined);
    };

    const handleFamilyMessage = async (message: WeixinInboundMessage) => {
      const current = configRef.current;
      const petId = desktopPetChatStore.getState().activePetId;
      const slot = getDesktopPetSlot(current, petId);
      if (!slot) return;
      const attachments = message.images.length ? await dataUrlsToAttachments(message.images) : [];
      const text = await replyToFamilyMember({
        accountId: message.accountId, attachments, config: current, label: message.label, petId: slot.id, personality: slot.personality, text: message.text,
      });
      const visible = formatQqReplyText(text);
      if (!visible) return;
      reply(message.accountId, visible);
      if (wantsVoiceReply(voiceMode(), message.voice, message.text)) await sendVoice(message.accountId, slot.id, visible);
    };

    const handleMessage = (message: WeixinInboundMessage) => {
      if (message.owner) {
        void handleOwnerMessage(message).catch((error) => {
          pushFrontendRuntimeError('weixin-bridge', 'handling a phone message failed', error);
          reply(message.accountId, '刚才没处理好这条消息，再发一次试试？');
        });
        return;
      }
      const previous = familyQueues.get(message.accountId) ?? Promise.resolve();
      familyQueues.set(message.accountId, previous.then(() => handleFamilyMessage(message)).catch((error) => {
        pushFrontendRuntimeError('weixin-bridge', 'family message failed', error);
        reply(message.accountId, '刚才没处理好这条消息，再发一次试试？');
      }));
    };

    // The owner's conversation: replies posted in the chat window go back to the owner's WeChat.
    const flush = () => {
      if (!relay) return;
      if (Date.now() - lastOwnerMessageAt > RELAY_WINDOW_MS) {
        relay = null;
        return;
      }
      const { isTyping, messages } = desktopPetChatStore.getState();
      const accountId = ownerAccountId;
      collectQqRelayOutgoing(messages, relay, isTyping).forEach((item) => {
        if (item.text) reply(accountId, item.text);
        item.stickerAssetIds.forEach((assetId) => { void sendSticker(accountId, assetId); });
        // Voice follows the text it says, in order (synthesis takes a few seconds per reply).
        if (ownerVoiceReplies && item.petId && item.speechText) voiceQueue = voiceQueue.then(() => sendVoice(accountId, item.petId!, item.speechText));
        // A question waiting for a yes/no is read out too (unless voice is off), in the voice of
        // the character doing the task, so someone who does not read knows what to answer.
        if (!item.petId && item.speechText && voiceMode() !== 'off') {
          const petId = desktopPetChatStore.getState().activePetId;
          voiceQueue = voiceQueue.then(() => sendVoice(accountId, petId, item.speechText));
        }
      });
    };

    const unsubscribeMessages = weixin.onMessage((message) => { if (message) handleMessage(message); });
    const timer = setInterval(flush, RELAY_POLL_MS);
    const unsubscribeChat = desktopPetChatStore.subscribe(flush);
    void weixin.start().then((result) => pushFrontendRuntimeLog('weixin-bridge', result.ok ? 'bridge started' : 'bridge waiting for a QR login', result.error ? { reason: result.error } : undefined));

    return () => {
      clearInterval(timer);
      unsubscribeChat();
      unsubscribeMessages();
    };
    // Restart only when the switch changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabled]);
}
