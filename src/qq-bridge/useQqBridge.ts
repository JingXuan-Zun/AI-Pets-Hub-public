import { useEffect, useRef, type MutableRefObject } from 'react';
import { desktopPetChatStore } from '../chatStore';
import { pushFrontendRuntimeError, pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import type { PetConfig } from '../types';
import { judgeApprovalAnswerWithModel, resolvePendingApprovalBySpeech } from '../components/chat/voiceApproval';
import { latestPendingAgentLoopApprovalId } from '../components/chat/runController/agentLoopApprovalRegistry';
import { expressionLibraryBridge } from '../expression/expressionLibraryBridge';
import { createOneBotClient, type OneBotImage, type OneBotPrivateMessage } from './oneBotClient';
import type { DesktopPetChatSendOptions } from '../chatState';
import { createChatImageAttachmentsFromFiles, MAX_CHAT_IMAGE_ATTACHMENTS } from '../components/chat/chatImageAttachmentUtils';
import { collectQqRelayOutgoing, createQqRelayState, type QqRelayState } from './qqBridgeRelay';
import { normalizeQqBridgeSettings, resolveQqBridgeBlocker, wantsVoiceReply } from './qqBridgeSettings';
import { prepareSpeechText } from '../voice/speechText';
import { resolvePetVoiceSettings } from '../voice/petVoiceSettings';
import { synthesizeGptSovitsWav } from '../voice/ttsGptSovitsPlayback';
import { resolveConversationSttSettings } from '../voice/conversationSttModel';
import { transcribeLocalVoice } from '../voice/runtime';

// Phone QQ ⇄ the character: a private message from the owner's QQ goes into the chat exactly
// like typing in the chat window (current character and chat mode); her replies and any
// approval question go back to QQ. A clear yes/no while an approval waits answers the card,
// as a spoken one does. Messages from anyone else are ignored: she can operate this computer.

// After this long without a message from the phone, replies stop going to QQ.
const RELAY_WINDOW_MS = 10 * 60 * 1000;
const RELAY_POLL_MS = 1000;
// A voice message says at most this much (cut at a sentence end); the full reply is in the text.
const MAX_VOICE_CHARS = 300;

export function limitVoiceText(text: string, max = MAX_VOICE_CHARS) {
  const trimmed = text.trim();
  if (trimmed.length <= max) return trimmed;
  const head = trimmed.slice(0, max);
  const end = Math.max(...['。', '！', '？', '!', '?', '…', '\n'].map((mark) => head.lastIndexOf(mark)));
  return (end > max / 3 ? head.slice(0, end + 1) : head).trim();
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/u, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

type SendMessage = (textOverride?: string, options?: DesktopPetChatSendOptions) => Promise<void>;

export function useQqBridge({ config, configRef, sendMessage }: {
  config: PetConfig;
  configRef: MutableRefObject<PetConfig>;
  sendMessage: SendMessage;
}) {
  const settings = normalizeQqBridgeSettings(config.settings.qqBridge);
  const accessToken = config.settings.qqBridgeAccessToken ?? '';
  const sendMessageRef = useRef(sendMessage);
  sendMessageRef.current = sendMessage;

  // SnowLuma in the background: started when the switch is on (unless it already runs), the
  // copy the pet started is stopped when the switch goes off. Not tied to this component's
  // lifetime, so a page reload doesn't restart it.
  useEffect(() => {
    const snowLuma = window.desktopPetShell?.snowLuma;
    if (!snowLuma) return;
    if (settings.enabled && settings.autoStartSnowLuma && settings.snowLumaDir) {
      void snowLuma.ensureRunning({ dir: settings.snowLumaDir, wsUrl: settings.wsUrl }).then((result) => {
        pushFrontendRuntimeLog('qq-bridge', result.ok ? (result.started ? 'SnowLuma started in the background' : 'SnowLuma already running') : 'SnowLuma not started', result.error ? { error: result.error } : undefined);
      });
    } else if (!settings.enabled) {
      void snowLuma.stop();
    }
  }, [settings.enabled, settings.autoStartSnowLuma, settings.snowLumaDir, settings.wsUrl]);

  useEffect(() => {
    const blocker = resolveQqBridgeBlocker(settings);
    if (blocker) return undefined;
    const owner = settings.ownerQq;
    let relay: QqRelayState | null = null;
    let voiceReplies = false;
    let voiceQueue: Promise<void> = Promise.resolve();
    let lastPhoneMessageAt = 0;

    const client = createOneBotClient({
      accessToken,
      // A token typed in the settings wins; otherwise use the one SnowLuma made for its server.
      resolveAccessToken: accessToken.trim() || !settings.snowLumaDir ? undefined : async () => {
        const found = await window.desktopPetShell?.snowLuma?.wsToken?.({ dir: settings.snowLumaDir, ownerQq: owner, wsUrl: settings.wsUrl });
        return found?.found ? found.token ?? '' : '';
      },
      url: settings.wsUrl,
      onStatus: (status, detail) => {
        pushFrontendRuntimeLog('qq-bridge', `status ${status}`, detail ? { detail } : undefined);
        if (status === 'connected') void checkAccount();
      },
      onMessage: (message) => { void handleMessage(message); },
      onSendFailed: (text, reason) => pushFrontendRuntimeLog('qq-bridge', 'reply not delivered after retries', { reason, textLength: text.length }),
    });
    // The bot must be the small account. If SnowLuma is logged in as the owner's own QQ (e.g. it
    // hooked the main account's QQ), the bridge refuses to act through it.
    const checkAccount = async () => {
      const uin = await client.getLoginUin().catch(() => '');
      if (uin && uin === owner) {
        pushFrontendRuntimeError('qq-bridge', 'SnowLuma is logged in as your own QQ (the main account); the bridge stopped', new Error(uin));
        client.stop();
      }
    };
    const reply = (text: string) => {
      if (!client.sendPrivateText(owner, text)) pushFrontendRuntimeLog('qq-bridge', 'reply not sent: not connected');
    };

    const handleMessage = async (message: OneBotPrivateMessage) => {
      if (message.userId !== owner) {
        pushFrontendRuntimeLog('qq-bridge', 'ignored message from another QQ');
        return;
      }
      lastPhoneMessageAt = Date.now();
      try {
        // A voice message is heard like the microphone: SnowLuma gives the audio as WAV, the
        // local speech recognition turns it into text, and from there it is a normal message.
        if (message.voiceFile && !message.text) {
          const heard = await transcribePhoneVoice(message.voiceFile);
          if (!heard) {
            reply('没听清你的语音，再说一遍或者打字给我？');
            return;
          }
          message = { ...message, text: heard };
        }
        if (latestPendingAgentLoopApprovalId()) {
          const decision = await resolvePendingApprovalBySpeech(message.text, judgeApprovalAnswerWithModel(configRef.current.settings));
          if (decision) {
            reply(decision === 'deny' ? '好，这一步不做了。' : decision === 'approve-task' ? '好，这个任务后面的步骤都不再问你了。' : '好，这就去做。');
          } else {
            reply('还在等你确认上一步：回复“好”“都好”或“不要”就可以。');
          }
          return;
        }
        relay = relay ?? createQqRelayState(Date.now());
        const mode = normalizeQqBridgeSettings(configRef.current.settings.qqBridge).voiceReplyMode;
        voiceReplies = wantsVoiceReply(mode, Boolean(message.voiceFile), message.text);
        const attachments = await receivePhoneImages(message.images);
        await sendMessageRef.current(message.text, attachments.length ? { attachments } : undefined);
      } catch (error) {
        pushFrontendRuntimeError('qq-bridge', 'handling a phone message failed', error);
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
    // Pictures from the phone become image attachments, as if dropped into the chat window.
    const receivePhoneImages = async (images: OneBotImage[]) => {
      const bridge = window.desktopPetShell?.snowLuma;
      if (!images.length || !bridge?.fetchImage) return [];
      const files: File[] = [];
      for (const image of images.slice(0, MAX_CHAT_IMAGE_ATTACHMENTS)) {
        const url = image.url || await client.getImageUrl(image.file).catch(() => '');
        const result = url ? await bridge.fetchImage(url) : { error: '没有下载地址', ok: false };
        if (!result.ok || !result.dataUrl) {
          pushFrontendRuntimeLog('qq-bridge', 'phone image not received', { error: result.error });
          continue;
        }
        const blob = await (await fetch(result.dataUrl)).blob();
        files.push(new File([blob], `qq-${files.length + 1}.${(result.mimeType ?? 'image/jpeg').split('/')[1] ?? 'jpg'}`, { type: blob.type }));
      }
      return createChatImageAttachmentsFromFiles(files);
    };
    const transcribePhoneVoice = async (voiceFile: string) => {
      const wav = await client.getRecordWavBase64(voiceFile);
      const stt = await resolveConversationSttSettings(configRef.current.settings);
      if ('error' in stt) throw new Error(`本地语音识别不可用：${stt.error}`);
      const text = (await transcribeLocalVoice(wav, stt.settings)).trim();
      pushFrontendRuntimeLog('qq-bridge', 'phone voice transcribed', { textLength: text.length });
      return text;
    };
    // Her own voice (the character's voice pack), sent as a QQ voice message.
    const sendVoice = async (petId: string, speechText: string) => {
      const voiceSettings = resolvePetVoiceSettings(configRef.current, petId);
      if (voiceSettings.ttsProvider !== 'gpt-sovits') {
        pushFrontendRuntimeLog('qq-bridge', 'voice reply skipped: only character voices (GPT-SoVITS) can be sent');
        return;
      }
      const text = limitVoiceText(prepareSpeechText(speechText, voiceSettings));
      if (!text) return;
      try {
        const wav = await synthesizeGptSovitsWav(text, voiceSettings);
        if (!client.sendPrivateRecord(owner, await blobToBase64(wav))) pushFrontendRuntimeLog('qq-bridge', 'voice reply not sent: not connected');
      } catch (error) {
        pushFrontendRuntimeError('qq-bridge', 'voice reply failed', error);
      }
    };
    // Image stickers go as pictures, after the text they belong to.
    const sendSticker = async (assetId: string) => {
      const preview = await expressionLibraryBridge.getPreview(assetId).catch(() => null);
      const base64 = preview?.ok && preview.dataUrl ? preview.dataUrl.replace(/^data:[^,]*,/u, '') : '';
      if (!base64 || !client.sendPrivateImage(owner, base64)) {
        pushFrontendRuntimeLog('qq-bridge', 'sticker not sent', { assetId, reason: base64 ? 'not connected' : 'image unavailable' });
      }
    };
    const timer = setInterval(flush, RELAY_POLL_MS);
    const unsubscribe = desktopPetChatStore.subscribe(flush);
    // A reload or closing window ends the page without unmounting: close the socket properly
    // so the OneBot service sees a normal goodbye instead of a reset connection.
    const onPageHide = () => client.stop();
    window.addEventListener('pagehide', onPageHide);
    pushFrontendRuntimeLog('qq-bridge', 'bridge started', { url: settings.wsUrl });

    return () => {
      clearInterval(timer);
      unsubscribe();
      window.removeEventListener('pagehide', onPageHide);
      client.stop();
    };
    // Reconnect only when the connection settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.enabled, settings.ownerQq, settings.wsUrl, settings.snowLumaDir, accessToken]);
}
