import { type VoiceSettings } from './types';

const SPEECH_BRACKET_PAIRS = new Map<string, string>([
  ['(', ')'],
  ['（', '）'],
  ['[', ']'],
  ['【', '】'],
  ['{', '}'],
  ['｛', '｝'],
]);
const SPEECH_BRACKET_CLOSERS = new Set(SPEECH_BRACKET_PAIRS.values());
const SPEECH_PUNCTUATION = '，。！？!?；;：:,';
const SPEECH_ELONGATION_TARGET_PATTERN = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}A-Za-z]/u;
const SPEECH_ELONGATION_MARKS = new Set(['~', '～']);
const SPEECH_PUNCTUATION_PAUSE_MS = 50;
const SPEECH_PAUSE_PUNCTUATION = new Set(['。', '！', '!', '？', '?', '…']);
const SPEECH_SILENT_MARK_PATTERN = /[*＊]+/gu;

export type SpeechBracketFilterState = {
  closingBrackets: string[];
};

export function createSpeechBracketFilterState(): SpeechBracketFilterState {
  return {
    closingBrackets: [],
  };
}

export function filterSpeechBracketContentChunk(text: string, state: SpeechBracketFilterState) {
  let output = '';

  for (const currentChar of Array.from(String(text ?? ''))) {
    const expectedClosingBracket = state.closingBrackets[state.closingBrackets.length - 1];
    if (expectedClosingBracket) {
      const nestedClosingBracket = SPEECH_BRACKET_PAIRS.get(currentChar);
      if (nestedClosingBracket) {
        state.closingBrackets.push(nestedClosingBracket);
        continue;
      }

      if (currentChar === expectedClosingBracket) {
        state.closingBrackets.pop();
      }
      continue;
    }

    const closingBracket = SPEECH_BRACKET_PAIRS.get(currentChar);
    if (closingBracket) {
      state.closingBrackets.push(closingBracket);
      continue;
    }

    if (SPEECH_BRACKET_CLOSERS.has(currentChar)) {
      continue;
    }

    output += currentChar;
  }

  return output;
}

export function removeSpeechBracketContent(text: string) {
  return filterSpeechBracketContentChunk(text, createSpeechBracketFilterState());
}

export function normalizeSpeechText(text: string) {
  return String(text ?? '')
    .replace(SPEECH_SILENT_MARK_PATTERN, '')
    .replace(/\s*\n+\s*/gu, ' ')
    .replace(/\s{2,}/gu, ' ')
    .replace(new RegExp(`\\s+([${SPEECH_PUNCTUATION}])`, 'gu'), '$1')
    .replace(new RegExp(`([${SPEECH_PUNCTUATION}])\\s+([\\u3400-\\u9fff])`, 'gu'), '$1$2')
    .replace(/([\u3400-\u9fff])\s+([\u3400-\u9fff])/gu, '$1$2')
    .trim();
}

export function applySpeechExpressivePunctuation(text: string) {
  const chars = Array.from(String(text ?? ''));
  let output = '';

  for (let index = 0; index < chars.length; index += 1) {
    const currentChar = chars[index] ?? '';
    if (!SPEECH_ELONGATION_MARKS.has(currentChar)) {
      output += currentChar;
      continue;
    }

    let markCount = 1;
    while (SPEECH_ELONGATION_MARKS.has(chars[index + markCount] ?? '')) {
      markCount += 1;
    }

    const previousChar = Array.from(output).at(-1) ?? '';
    if (previousChar && SPEECH_ELONGATION_TARGET_PATTERN.test(previousChar)) {
      output += '～';
    } else {
      output += currentChar.repeat(markCount);
    }
    index += markCount - 1;
  }

  return output
    .replace(/[—─－-]{2,}/gu, '，')
    .replace(/\.{3,}/gu, '……')
    .replace(/…{2,}/gu, '……')
    .replace(/[!！]{2,}/gu, '！')
    .replace(/[?？]{2,}/gu, '？')
    .replace(/(?:[!！][?？]|[?？][!！])+/gu, '！？');
}

function isSpeechPausePunctuation(chars: string[], index: number) {
  const currentChar = chars[index] ?? '';
  if (currentChar === '.') {
    const previousChar = chars[index - 1] ?? '';
    const nextChar = chars[index + 1] ?? '';
    return !/\d/u.test(previousChar) && (!nextChar || /\s/u.test(nextChar));
  }

  return SPEECH_PAUSE_PUNCTUATION.has(currentChar);
}

export function splitSpeechTextForPlaybackPauses(text: string, settings: VoiceSettings) {
  const normalizedText = String(text ?? '').trim();
  if (!normalizedText) {
    return [] as Array<{ text: string; pauseAfterMs: number }>;
  }

  if (!settings.speechExpressivePunctuationEnabled) {
    return [{ text: normalizedText, pauseAfterMs: 0 }];
  }

  const chars = Array.from(normalizedText);
  const parts: Array<{ text: string; pauseAfterMs: number }> = [];
  let segment = '';

  for (let index = 0; index < chars.length; index += 1) {
    const currentChar = chars[index] ?? '';
    segment += currentChar;

    if (!isSpeechPausePunctuation(chars, index)) {
      continue;
    }

    while (currentChar === '…' && chars[index + 1] === '…') {
      index += 1;
      segment += chars[index] ?? '';
    }

    const trimmedSegment = segment.trim();
    if (trimmedSegment) {
      parts.push({
        text: trimmedSegment,
        pauseAfterMs: SPEECH_PUNCTUATION_PAUSE_MS,
      });
    }
    segment = '';
  }

  const trailingSegment = segment.trim();
  if (trailingSegment) {
    parts.push({
      text: trailingSegment,
      pauseAfterMs: 0,
    });
  }

  return parts.length > 0 ? parts : [{ text: normalizedText, pauseAfterMs: 0 }];
}

export function prepareSpeechText(text: string, settings: VoiceSettings, preserveParagraphs = false) {
  const rawText = String(text ?? '');
  const normalizedText = settings.speechSkipBracketContent
    ? removeSpeechBracketContent(rawText)
    : rawText;

  const expressiveText = settings.speechExpressivePunctuationEnabled
    ? applySpeechExpressivePunctuation(normalizedText)
    : normalizedText;

  return preserveParagraphs
    ? expressiveText.split(/\r?\n/u).map(normalizeSpeechText).filter(Boolean).join('\n')
    : normalizeSpeechText(expressiveText);
}
