export function parseRuntimeLogNumberField(line: string, key: string) {
  const match = new RegExp(`${key}:\\s*(-?\\d+(?:\\.\\d+)?)`, 'u').exec(line);
  return match ? Number(match[1]) : 0;
}

export function parseRuntimeLogStringField(line: string, key: string) {
  const match = new RegExp(`${key}:\\s*([^,}\\s]+)`, 'u').exec(line);
  return match?.[1] ?? '';
}
