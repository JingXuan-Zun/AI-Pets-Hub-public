import { useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import type { DesktopPetChatSendOptions } from '../chatState';
import { createChatImageAttachmentsFromFiles, MAX_CHAT_IMAGE_ATTACHMENTS } from '../components/chat/chatImageAttachmentUtils';
import { latestPendingAgentLoopApprovalId } from '../components/chat/runController/agentLoopApprovalRegistry';
import { judgeApprovalAnswerWithModel, resolvePendingApprovalBySpeech } from '../components/chat/voiceApproval';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import { collectQqRelayOutgoing, createQqRelayState, type QqRelayState } from '../qq-bridge/qqBridgeRelay';
import { wantsVoiceReply } from '../qq-bridge/qqBridgeSettings';
import { limitVoiceText } from '../qq-bridge/useQqBridge';
import { expressionLibraryBridge } from '../expression/expressionLibraryBridge';
import { getDesktopPetSlot } from '../multiPetRoster';
import { resolvePetVoiceSettings } from '../voice/petVoiceSettings';
import { prepareSpeechText } from '../voice/speechText';
import { synthesizeGptSovitsWav } from '../voice/ttsGptSovitsPlayback';
import type { PetConfig } from '../types';
import { normalizeWeixinBridgeSettings } from './weixinBridgeSettings';

// Phone WeChat ⇄ the character, the same way as QQ: a message from the WeChat user who scanned
// goes into the chat like typing in the chat window; her replies and approval questions go
// back. Voice arrives already turned into text by WeChat. Replies go as text, image stickers as
// pictures, and (by default always) in her own voice as a short video, for people who listen
// rather than read.

type SendMessage = (textOverride?: string, options?: DesktopPetChatSendOptions) => Promise<void>;

// After this long without a message from the phone, replies stop going to WeChat.
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
    let lastPhoneMessageAt = 0;
    let voiceReplies = false;
    let voiceQueue: Promise<void> = Promise.resolve();
    const reply = (text: string) => {
      void weixin.send(text).then((result) => {
        if (!result.ok) pushFrontendRuntimeLog('weixin-bridge', 'reply not delivered', { reason: result.error });
      });
    };

    const handleMessage = async (message: { images: string[]; text: string; voice: boolean }) => {
      lastPhoneMessageAt = Date.now();
      try {
        if (latestPendingAgentLoopApprovalId() && message.text) {
          const decision = await resolvePendingApprovalBySpeech(message.text, judgeApprovalAnswerWithModel(configRef.current.settings));
          reply(decision === 'deny' ? '好，这一步不做了。'
            : decision === 'approve-task' ? '好，这个任务后面的步骤都不再问你了。'
              : decision ? '好，这就去做。' : '还在等你确认上一步：回复“好”“都好”或“不要”就可以。');
          return;
        }
        relay = relay ?? createQqRelayState(Date.now());
        const mode = normalizeWeixinBridgeSettings(configRef.current.settings.weixinBridge).voiceReplyMode;
        voiceReplies = wantsVoiceReply(mode, message.voice, message.text);
        const attachments = message.images.length ? await dataUrlsToAttachments(message.images) : [];
        await sendMessageRef.current(message.text, attachments.length ? { attachments } : undefined);
      } catch (error) {
        pushFrontendRuntimeError('weixin-bridge', 'handling a phone message failed', error);
        reply('刚才没处理好这条消息，再发一次试试？');
      }
    };

    const flush = () => {
      if (!relay) return;
      if (Date.now() - lastPhoneMessageAt > RELAY_WINDOW_MS) {
        relay = null;
        return;
      }
      const { isTyping, messages } = desktopPetChatStore.getState();
      collectQqRelayOutgoing(messages, relay, isTyping).forEach((item) => {
        if (item.text) reply(item.text);
        item.stickerAssetIds.forEach((assetId) => { void sendSticker(assetId); });
        // Voice follows the text it says, in order (synthesis takes a few seconds per reply).
        if (voiceReplies && item.petId && item.speechText) voiceQueue = voiceQueue.then(() => sendVoice(item.petId!, item.speechText));
      });
    };
    // Her own voice (the character's voice pack), sent as a short video with her chat avatar:
    // bots can't send WeChat voice bubbles.
    const sendVoice = async (petId: string, speechText: string) => {
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
        const result = await weixin.sendVoice(await blobToBase64(wav), avatar || undefined);
        if (!result.ok) pushFrontendRuntimeLog('weixin-bridge', 'voice reply not delivered', { reason: result.error });
      } catch (error) {
        pushFrontendRuntimeError('weixin-bridge', 'voice reply failed', error);
      }
    };
    // Image stickers go as pictures, after the text they belong to.
    const sendSticker = async (assetId: string) => {
      const preview = await expressionLibraryBridge.getPreview(assetId).catch(() => null);
      const base64 = preview?.ok && preview.dataUrl ? preview.dataUrl.replace(/^data:[^,]*,/u, '') : '';
      const result = base64 ? await weixin.sendImage(base64) : { error: 'image unavailable', ok: false };
      if (!result.ok) pushFrontendRuntimeLog('weixin-bridge', 'sticker not sent', { assetId, reason: result.error });
    };

    const unsubscribeMessages = weixin.onMessage((message) => { if (message) void handleMessage(message); });
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
