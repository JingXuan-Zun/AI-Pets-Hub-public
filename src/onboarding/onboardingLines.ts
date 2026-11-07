import type { ChatQuickReply } from '../types';

// The fixed lines of the first-run guide (docs/starter/xiaoling-onboarding-script.md). Each has a
// pre-recorded voice clip in public/starter/voice/<id>.ogg, so a brand-new install can speak
// before any model or voice engine is set up. The clips say "深度求索" / "钥匙" where the text
// shows "DeepSeek" / "Key" (the voice model reads English poorly).

export type OnboardingLineId =
  | 'L01' | 'L02' | 'L03' | 'L04' | 'L05' | 'L06' | 'L07' | 'L08' | 'L09' | 'L10' | 'L11' | 'L12' | 'L20';

export const DEEPSEEK_PLATFORM_URL = 'https://platform.deepseek.com';
export const DEEPSEEK_API_KEYS_URL = 'https://platform.deepseek.com/api_keys';
export const DEEPSEEK_TOP_UP_URL = 'https://platform.deepseek.com/top_up';

/** What a quick reply sends back: the guide recognises these exact phrases. */
export const ONBOARDING_REPLIES = {
  howToGetKey: '怎么拿 Key？',
  haveKey: '我已经有 Key 了',
  gotKey: '我拿到了',
  retry: '再试一次',
  toppedUp: '充好了',
  skip: '先跳过',
  intro: '简单介绍一下你能做什么吧',
  askQuestion: '我想问问题',
  notNow: '先不用',
} as const;

const send = (label: string, value = label): ChatQuickReply => ({ kind: 'send', label, value });
const link = (label: string, value: string): ChatQuickReply => ({ kind: 'link', label, value });
const OPEN_MODEL_SETTINGS: ChatQuickReply = { kind: 'settings', label: '打开设置填写', value: 'ai-model' };

export interface OnboardingLine {
  id: OnboardingLineId;
  text: string;
  quickReplies?: ChatQuickReply[];
}

export const ONBOARDING_LINES: Record<OnboardingLineId, OnboardingLine> = {
  L01: { id: 'L01', text: '你好呀，我是小玲。以后我就住在你的桌面上啦。' },
  L02: { id: 'L02', text: '不过……我现在还不太会说话。要先帮我接上“大脑”，我才能好好陪你聊天、帮你做事。' },
  L03: {
    id: 'L03',
    text: '我用的大脑叫 DeepSeek。你去它的网站拿一把“钥匙”，就是 API Key，交给我就好啦。',
    quickReplies: [send('怎么拿 Key', ONBOARDING_REPLIES.howToGetKey), send(ONBOARDING_REPLIES.haveKey), send('先跳过', ONBOARDING_REPLIES.skip)],
  },
  L04: {
    id: 'L04',
    text: [
      '很简单的，跟着我来：',
      `1. 打开 DeepSeek 开放平台（${DEEPSEEK_PLATFORM_URL}），注册 / 登录。`,
      '2. 左边菜单点“API Keys” → “创建 API Key”，起个名字，复制下来。Key 只显示这一次，先存好哦。',
      '3. 在“充值”里充一点点钱（按用量付费，平时聊天花得很少）。',
    ].join('\n'),
    quickReplies: [link('打开 DeepSeek 开放平台', DEEPSEEK_API_KEYS_URL), send(ONBOARDING_REPLIES.gotKey)],
  },
  L05: {
    id: 'L05',
    text: '拿到啦？直接把 Key 粘贴发给我就行，我帮你存好。也可以点下面的按钮，自己填进设置里（设置 → AI → 模型）。放心，Key 只存在你的电脑上。',
    quickReplies: [OPEN_MODEL_SETTINGS],
  },
  L06: { id: 'L06', text: '收到啦，我试一下……' },
  L07: { id: 'L07', text: '嗯……这把钥匙好像打不开。可以再复制一次发给我吗？注意前后别多了空格哦。' },
  L08: {
    id: 'L08',
    text: '钥匙是对的，可是……账户里好像没有余额了。去充一点点，再告诉我一声就好。',
    quickReplies: [link('打开充值页面', DEEPSEEK_TOP_UP_URL), send(ONBOARDING_REPLIES.toppedUp)],
  },
  L09: {
    id: 'L09',
    text: '我连不上 DeepSeek……看看网络是不是断了？好了以后点一下“再试一次”。',
    quickReplies: [send(ONBOARDING_REPLIES.retry)],
  },
  L10: {
    id: 'L10',
    text: '我现在还听不太懂你说的话……先帮我接上大脑吧，接好了我们慢慢聊。',
    quickReplies: [send('怎么拿 Key', ONBOARDING_REPLIES.howToGetKey), OPEN_MODEL_SETTINGS],
  },
  L11: { id: 'L11', text: '好呀，那你先随便看看。想好了随时点我，或者打开 设置 → AI → 模型 填 Key 就行。', quickReplies: [OPEN_MODEL_SETTINGS] },
  L12: {
    id: 'L12',
    text: '你回来啦。还差一步哦，帮我接上大脑我就能陪你聊天了。',
    quickReplies: [send('怎么拿 Key', ONBOARDING_REPLIES.howToGetKey), OPEN_MODEL_SETTINGS],
  },
  L20: { id: 'L20', text: '接上啦！……嗯，我能想事情了。谢谢你～' },
};

export const WELCOME_QUICK_REPLIES: ChatQuickReply[] = [
  send('听介绍', ONBOARDING_REPLIES.intro),
  send(ONBOARDING_REPLIES.askQuestion),
  send(ONBOARDING_REPLIES.notNow),
];

export function onboardingVoiceUrl(id: OnboardingLineId) {
  return `${import.meta.env.BASE_URL ?? './'}starter/voice/${id}.ogg`;
}
