

export function compactVisualSnapshotSummary(value: string, maxLength = 900) {
  const compactText = value.replace(/\s+/gu, ' ').trim();
  if (compactText.length <= maxLength) {
    return compactText;
  }

  return `${compactText.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function tryParseVisualSnapshotJson(value: string): Record<string, unknown> | null {
  const trimmedValue = value.trim().replace(/^```(?:json)?/iu, '').replace(/```$/u, '').trim();
  const parseCandidate = (candidate: string) => {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    } catch {
      return null;
    }
  };
  const directParse = parseCandidate(trimmedValue);
  if (directParse) {
    return directParse;
  }

  const startIndex = trimmedValue.indexOf('{');
  const endIndex = trimmedValue.lastIndexOf('}');
  if (startIndex < 0 || endIndex <= startIndex) {
    return null;
  }

  return parseCandidate(trimmedValue.slice(startIndex, endIndex + 1));
}

export function getVisualSnapshotStringField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) {
      return compactVisualSnapshotSummary(value, 260);
    }
  }

  return '';
}

export function getVisualSnapshotStringListField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value
        .map(normalizeVisualSnapshotStringListItem)
        .filter(Boolean)
        .slice(0, 6);
    }

    if (typeof value === 'string' && value.trim()) {
      return [compactVisualSnapshotSummary(value, 260)];
    }
  }

  return [];
}

export function getVisualSnapshotRawListField(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value;
    }

    if (value !== undefined && value !== null) {
      return [value];
    }
  }

  return [];
}

function normalizeVisualSnapshotStringListItem(item: unknown) {
  if (typeof item === 'string') {
    return compactVisualSnapshotSummary(item, 180);
  }

  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return '';
  }

  const record = item as Record<string, unknown>;
  const text = getVisualSnapshotStringField(record, ['text', 'label', 'name', 'title', 'value', 'snippet', 'content']);
  if (!text) {
    return '';
  }

  const details = [
    typeof record.confidence === 'string' || typeof record.confidence === 'number'
      ? `confidence=${String(record.confidence).trim()}`
      : '',
    getVisualSnapshotStringField(record, ['region', 'location', 'position']),
  ].filter(Boolean);

  return compactVisualSnapshotSummary(details.length ? `${text} (${details.join(', ')})` : text, 180);
}
