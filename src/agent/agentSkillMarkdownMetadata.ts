/** Read scalar name/description fields from SKILL.md front matter. */
export function readAgentSkillMarkdownMetadata(text: string) {
  const normalized = text.replace(/^\uFEFF/u, '').replace(/\r\n/gu, '\n');
  const match = normalized.match(/^---[ \t]*\n([\s\S]*?)\n---[ \t]*(?:\n|$)/u);
  const body = match ? normalized.slice(match[0].length) : normalized;
  const fields: Record<string, string> = {};
  const lines = match?.[1].split('\n') ?? [];
  for (let index = 0; index < lines.length; index += 1) {
    const field = lines[index].match(/^(name|description):\s*(.*)$/u);
    if (!field) continue;
    let value = field[2].trim();
    if (/^[>|][-+]?$/u.test(value)) {
      const parts: string[] = [];
      while (index + 1 < lines.length && /^(?:\s+|$)/u.test(lines[index + 1])) {
        parts.push(lines[++index].trim());
      }
      value = parts.join(value.startsWith('|') ? '\n' : ' ').trim();
    } else if (value.startsWith('"') && value.endsWith('"')) {
      try { value = JSON.parse(value) as string; } catch { value = value.slice(1, -1); }
    } else if (value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1).replace(/''/gu, "'");
    } else {
      value = value.replace(/\s+#.*$/u, '').trim();
    }
    fields[field[1]] = value;
  }
  const bodyLines = body.split('\n').map((line) => line.trim());
  return {
    name: fields.name ?? '',
    description: fields.description || bodyLines.find((line) => line && !/^(?:#|```|---$)/u.test(line)) || '',
    title: bodyLines.find((line) => /^#\s+/u.test(line))?.replace(/^#\s+/u, '') ?? '',
  };
}
