function stripStageDirectionBrackets(text: string) {
  return text.replace(/（[^）]*）|\([^)]*\)/g, '');
}

export function normalizeStoryCharacterResponse(text: string) {
  return stripStageDirectionBrackets(text)
    .replace(/^\s*(?:动作|旁白)\s*[:：]\s*/i, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
