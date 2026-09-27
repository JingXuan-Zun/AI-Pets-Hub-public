export function resolveAgentProductionSessionInstruction(text: string) {
  const sourceText = text.trim();
  if (!sourceText.startsWith('/')) {
    return null;
  }

  const body = sourceText.slice(1).trim();
  if (!body) {
    return null;
  }

  const withoutAgentPrefix = body.replace(
    /^(?:agent|\u52a9\u624b|\u667a\u80fd\u4f53|\u4ee3\u7406)\b/iu,
    '',
  ).trim();

  return withoutAgentPrefix || body;
}
