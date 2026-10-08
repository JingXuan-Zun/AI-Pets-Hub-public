// Maps the chat layer's per-sentence expression action onto GPT-SoVITS manifest emotion keys.
// Keys a model lacks fall back to its "neutral" reference on the sidecar side.
const EXPRESSION_TO_EMOTION: Record<string, string> = {
  HAPPY: 'happy',
  EATING: 'happy',
  SAD: 'sad',
  SLEEPING: 'sleepy',
};

export function resolveGptSovitsEmotion(expressionAction: string | null | undefined) {
  return (expressionAction && EXPRESSION_TO_EMOTION[expressionAction]) || 'neutral';
}
