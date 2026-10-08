/** Rough, local guess of what the user is doing from the foreground app; no screen content. */
export type LifeCompanionActivityKind = 'ai' | 'browser' | 'chat' | 'code' | 'design' | 'game' | 'music' | 'office' | 'video';

export interface LifeCompanionActivity {
  kind: LifeCompanionActivityKind;
  label: string;
  processName: string;
  title: string;
}

// Order matters: a video site opened in a browser counts as video, an IDE as code.
const RULES: Array<{ kind: LifeCompanionActivityKind; label: string; pattern: RegExp }> = [
  { kind: 'game', label: '玩游戏', pattern: /(steam|epicgames|genshin|yuanshen|starrail|minecraft|league of legends|valorant|wegame|游戏)/u },
  { kind: 'video', label: '看视频', pattern: /(vlc|potplayer|mpv|netflix|youtube|bilibili|哔哩哔哩|爱奇艺|腾讯视频|优酷|视频|电影|番剧)/u },
  { kind: 'music', label: '听音乐', pattern: /(spotify|cloudmusic|网易云|qqmusic|qq音乐|酷狗|kugou|foobar)/u },
  { kind: 'code', label: '写代码', pattern: /(code\.exe|visual studio|cursor|idea64|pycharm|webstorm|rider|unity|godot|terminal|powershell|windowsterminal)/u },
  { kind: 'design', label: '做设计', pattern: /(photoshop|illustrator|figma|blender|clip studio|krita|sai2?|premiere|after effects|davinci)/u },
  { kind: 'ai', label: '和 AI 一起忙', pattern: /(claude|chatgpt|openai|copilot|gemini|deepseek|kimi|豆包|通义|文心)/u },
  { kind: 'chat', label: '聊天', pattern: /(wechat|weixin|微信|qq\.exe|telegram|discord|slack|飞书|feishu|钉钉|dingtalk)/u },
  { kind: 'office', label: '处理工作', pattern: /(winword|excel|powerpnt|outlook|libreoffice|wps|notion|obsidian|onenote|写字板)/u },
  { kind: 'browser', label: '浏览网页', pattern: /(chrome|msedge|firefox|brave|opera|browser)/u },
];

export function classifyLifeCompanionActivity(processName: string, title: string): LifeCompanionActivity | null {
  const value = `${processName} ${title}`.toLowerCase();
  const rule = RULES.find((item) => item.pattern.test(value));
  return rule ? { kind: rule.kind, label: rule.label, processName, title } : null;
}

/** Same app and same window title: used to notice when the user switches to something else. */
export function lifeCompanionActivityKey(activity: Pick<LifeCompanionActivity, 'processName' | 'title'>) {
  return `${activity.processName}\u0000${activity.title}`;
}

export const LIFE_COMPANION_ACTIVITY_FALLBACK_LINES: Record<LifeCompanionActivityKind, string> = {
  ai: '又在和别的 AI 忙呀？有什么我也能帮上的吗～',
  browser: '在看什么好玩的东西呀？',
  chat: '在和谁聊天呢？',
  code: '又在写代码啦，辛苦了，记得歇一歇。',
  design: '在做设计吗？做好了给我看看嘛。',
  game: '在玩游戏呀，玩的什么？',
  music: '在听什么歌呀？',
  office: '在忙工作吗？记得喝口水。',
  video: '在看什么视频呀？',
};

/** The pet's own windows come to the front when clicked; they are not user activity. */
export function isDesktopPetForeground(processName: string, title: string) {
  const text = `${title} ${processName}`.toLowerCase();
  return text.includes('ai desktop pet') || text.includes('desktop pet') || text.includes('electron');
}
