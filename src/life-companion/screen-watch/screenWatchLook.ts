import { summarizeAgentVisualSnapshot } from '../../services/agentVisualSnapshotService';
import type { PetConfig } from '../../types';
import type { LifeCompanionActivity } from './lifeCompanionActivity';
import { captureScreenWatchFrame, type ScreenWatchActiveWindow } from './screenWatchCapture';
import { postCompanionLine, requestWatchComment } from './screenWatchComment';

const LOOK_QUESTION = '用户正在电脑上做什么？用两三句话概括屏幕上的主要内容和用户可能在进行的事，便于桌宠自然地陪聊；不要逐字抄录隐私信息。';

/** The desktop recognizer answers in JSON; keep the readable parts for the tooltip and the comment prompt. */
export function readableScreenWatchSummary(raw: string) {
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
  try {
    const parsed = start >= 0 && end > start ? JSON.parse(raw.slice(start, end + 1)) as Record<string, unknown> : null;
    // Only the summary: other fields (e.g. primaryAction) are agent hints like "无需点击".
    if (typeof parsed?.summary === 'string' && parsed.summary.trim()) return parsed.summary.trim();
  } catch { /* plain text answer */ }
  return raw.trim();
}

export type ScreenWatchLookResult =
  | { status: 'commented' | 'quiet'; summary: string }
  | { status: 'no-frame' }
  | { status: 'vision-off'; message: string };

/** One look: capture the window in front, recognize it, and maybe say something about it. */
export async function runScreenWatchLook(options: {
  activity: LifeCompanionActivity | null;
  activeWindow: ScreenWatchActiveWindow;
  allowComment: boolean;
  config: PetConfig;
}): Promise<ScreenWatchLookResult> {
  const frame = await captureScreenWatchFrame(options.activeWindow);
  if (!frame) return { status: 'no-frame' };
  let summary: string;
  try {
    summary = readableScreenWatchSummary(await summarizeAgentVisualSnapshot({
      imageDataUrl: frame.imageDataUrl,
      promptMode: 'desktop',
      question: LOOK_QUESTION,
      settings: options.config.settings,
      sourceLabel: frame.sourceLabel,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/vision model is disabled/iu.test(message)) return { status: 'vision-off', message };
    throw error;
  }
  if (!options.allowComment) return { status: 'quiet', summary };
  const comment = await requestWatchComment(options.config, summary, options.activity);
  return comment && postCompanionLine(options.config, comment)
    ? { status: 'commented', summary }
    : { status: 'quiet', summary };
}
