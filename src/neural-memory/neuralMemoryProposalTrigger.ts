/** Completed replies between background memory judgements for one role. */
export const NEURAL_MEMORY_JUDGEMENT_INTERVAL = 3;

const EXPLICIT_REMEMBER_PATTERN = /记住|记得|别忘|不要忘|记下|记一下|记好|remember|don'?t forget/iu;

export function isExplicitRememberRequest(userText: string) {
  return EXPLICIT_REMEMBER_PATTERN.test(userText);
}

/**
 * Tracks completed turns per role. A judgement runs right away when the user
 * explicitly asks to remember something, otherwise once every few turns.
 */
export function createNeuralMemoryJudgementTrigger(interval = NEURAL_MEMORY_JUDGEMENT_INTERVAL) {
  const turnsSinceJudgement = new Map<string, number>();
  return {
    recordTurn(roleId: string, userText: string) {
      const turns = (turnsSinceJudgement.get(roleId) ?? 0) + 1;
      if (isExplicitRememberRequest(userText) || turns >= interval) {
        turnsSinceJudgement.set(roleId, 0);
        return true;
      }
      turnsSinceJudgement.set(roleId, turns);
      return false;
    },
  };
}
