import { type AgentRuntimeToolResultEntry } from './agentRuntimeContract';

/**
 * Goals like "登录后启动里面的英雄联盟" treat login as an intermediate step. Seeing the
 * login complete (or the launcher window open) must not end the task while no window
 * of the follow-up target exists; a live run once reported "打开/启动成功" after only
 * logging in to WeGame.
 */
const POST_LOGIN_FOLLOW_UP = /(?:登录|登陆|log\s*in|sign\s*in)[^。！？!?\n]{0,8}?(?:后|之后|以后|完成后|完|就|再|然后|then|after)[^。！？!?\n]{0,6}?(?:启动|打开|运行|进入|开始|玩|launch|start|open|play)\s*(?:一下|下)?\s*(?:里面的|里的|里边的|其中的|中的|the)?\s*([^\s，。,！!？?；;、]{2,24})/iu;

// Window titles and process names of targets whose Chinese name differs from them.
const TARGET_WINDOW_ALIASES: Record<string, string[]> = {
  英雄联盟: ['leagueoflegends', 'leagueclient', 'league of legends'],
  无畏契约: ['valorant'],
  穿越火线: ['crossfire'],
};

function normalizeTargetText(value: string) {
  return value.normalize('NFKC').toLowerCase().replace(/[\s「」“”"'《》【】]+/gu, '');
}

/** The follow-up target named after login ("英雄联盟"), or null when the goal has none. */
export function resolveAgentPostLoginFollowUpTarget(goalText: string) {
  const match = POST_LOGIN_FOLLOW_UP.exec(goalText.normalize('NFKC'));
  const target = match?.[1] ? normalizeTargetText(match[1]).replace(/^(?:游戏|应用)/u, '') : '';
  return target.length >= 2 ? target : null;
}

/** Titles/process names of windows the run focused or opened; installed-app lists and launcher sidebars do not count. */
export function collectAgentRunWindowIdentities(entries: AgentRuntimeToolResultEntry[]) {
  return entries.flatMap((entry) => {
    const window = entry.result.stateSummary?.structuredEvidence?.finalWindow
      ?? entry.result.receipt?.stateSummary?.structuredEvidence?.finalWindow;
    return [window?.title, window?.processName].filter((value): value is string => Boolean(value?.trim()));
  });
}

/** True while the goal still has a post-login target that no observed window shows. */
export function hasAgentPendingPostLoginTarget(options: { goalText: string; windowIdentities: string[] }) {
  const target = resolveAgentPostLoginFollowUpTarget(options.goalText);
  if (!target) return false;
  const names = [target, ...(Object.entries(TARGET_WINDOW_ALIASES).find(([name]) => target.includes(normalizeTargetText(name)))?.[1] ?? [])]
    .map(normalizeTargetText);
  const windows = options.windowIdentities.map(normalizeTargetText);
  return !windows.some((window) => names.some((name) => window.includes(name)));
}
