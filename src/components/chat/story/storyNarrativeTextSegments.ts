export type StoryNarrativeTextSegment = {
  kind: 'dialogue' | 'narration';
  text: string;
};

const CLOSING_QUOTE_BY_OPENING: Record<string, string> = {
  '\u201c': '\u201d',
  '\u300c': '\u300d',
  '\u300e': '\u300f',
};

function appendSegment(
  segments: StoryNarrativeTextSegment[],
  kind: StoryNarrativeTextSegment['kind'],
  text: string,
) {
  if (!text) return;
  const previous = segments[segments.length - 1];
  if (previous?.kind === kind) {
    previous.text += text;
    return;
  }
  segments.push({ kind, text });
}

export function splitStoryNarrativeText(text: string): StoryNarrativeTextSegment[] {
  const segments: StoryNarrativeTextSegment[] = [];
  let buffer = '';
  let closingQuote = '';

  for (const character of text) {
    const nextClosingQuote = CLOSING_QUOTE_BY_OPENING[character];
    if (!closingQuote && nextClosingQuote) {
      appendSegment(segments, 'narration', buffer);
      buffer = character;
      closingQuote = nextClosingQuote;
      continue;
    }

    buffer += character;
    if (closingQuote && character === closingQuote) {
      appendSegment(segments, 'dialogue', buffer);
      buffer = '';
      closingQuote = '';
    }
  }

  appendSegment(segments, closingQuote ? 'dialogue' : 'narration', buffer);
  return segments;
}
