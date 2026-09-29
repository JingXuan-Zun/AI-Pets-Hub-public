import {
  createFallbackStoryPublicAnalysis,
  normalizeStoryPublicAnalysis,
} from './storyPublicAnalysis';
import type { StorySessionState } from './storyTypes';

export interface StoryTurnReviewItem {
  label: string;
  text: string;
}

export function buildStoryTurnReview(session: StorySessionState): StoryTurnReviewItem[] {
  const plan = session.lastTurnPlan;
  if (!plan) return [];
  const analysis = normalizeStoryPublicAnalysis(
    plan.publicAnalysis,
    createFallbackStoryPublicAnalysis(session),
  );
  return [
    { label: '本轮要求理解', text: analysis.requestUnderstanding },
    { label: '角色与关系安排', text: analysis.characterPlan },
    { label: '剧情、场景与时间', text: analysis.plotPlan },
    { label: '正文输出方式', text: analysis.outputPlan },
  ];
}
