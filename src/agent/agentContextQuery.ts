import { type ChatMessage } from '../types';
import {
  createAgentContextQueryCommand,
  type AgentChatCommand,
} from './agentChatCommand';
import {
  findLatestDesktopObservationContext,
  formatDesktopObservationContextAnswer,
} from './agentChatContext';

function compactQueryText(value: string) {
  return value.trim().replace(/\s+/gu, '').toLowerCase();
}

function isDesktopObservationContextQueryIntent(text: string) {
  const compactText = compactQueryText(text);
  const asksAboutRecentContext = /(?:刚才|刚刚|上次|之前|前面|你刚才|你刚刚)/u.test(compactText);
  const asksAboutObservation = /(?:看到|观察|检测|读取|识别|发现|有几个|多少|几个|哪些|什么|结果|范围|副屏|主屏|桌面|图标|显示器)/u.test(compactText);
  const mentionsDesktopObservation = /(?:桌面|图标|显示器|屏幕|副屏|主屏)/u.test(compactText);

  return asksAboutRecentContext && asksAboutObservation && mentionsDesktopObservation;
}

export function resolveAgentContextQueryCommand(
  text: string,
  messages: ChatMessage[],
): AgentChatCommand | null {
  if (!isDesktopObservationContextQueryIntent(text)) {
    return null;
  }

  const command = createAgentContextQueryCommand(text);
  const latestObservation = findLatestDesktopObservationContext(messages);
  if (!latestObservation) {
    return {
      ...command,
      contextQuery: {
        ...command.contextQuery,
        answerText: '我这里还没有上一轮桌面观察记录。你可以先让我观察或整理桌面，再问我刚才看到了什么。',
      },
    };
  }

  return {
    ...command,
    contextQuery: {
      ...command.contextQuery,
      answerText: formatDesktopObservationContextAnswer(latestObservation.context),
    },
  };
}
