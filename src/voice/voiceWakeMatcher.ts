import { polyphonic } from 'pinyin-pro';

// Wake-phrase matching on recognized text. Recognizers write names with other characters of the
// same sound ("小桃子" → "小淘紫", "阿吉" → "阿机"), so characters compare by pronunciation (any
// shared toneless reading counts); phrases of 3+ characters also tolerate one different syllable.
// Readings are folded with the usual input-method fuzzy sounds, since accents and recognizers
// blur them ("高冷" → "高能"): z/zh c/ch s/sh, l/n, h/f, and front/back nasals (en/eng, in/ing, an/ang).

const IGNORED_CHARACTERS = /[\s\p{P}\p{S}]/gu;

export function normalizeWakeText(text: string) {
  return text.replace(IGNORED_CHARACTERS, '').toLowerCase();
}

export function parseWakePhrases(raw: string, fallbackPhrase = '') {
  const phrases = raw.split(/[,，、;；\n]+/u).map(normalizeWakeText).filter((phrase) => phrase.length >= 2);
  const fallback = normalizeWakeText(fallbackPhrase);
  return phrases.length > 0 ? [...new Set(phrases)] : (fallback.length >= 2 ? [fallback] : []);
}

const readingCache = new Map<string, string[]>();

function foldFuzzySound(reading: string) {
  const initial = reading.replace(/^([zcs])h/u, '$1').replace(/^n(?!g)/u, 'l').replace(/^f/u, 'h');
  return initial.length > 2 && initial.endsWith('ng') ? initial.slice(0, -1) : initial;
}

function readingsOf(char: string) {
  let readings = readingCache.get(char);
  if (!readings) {
    readings = (polyphonic(char, { toneType: 'none', type: 'array' })[0] ?? [char])
      .map((reading) => foldFuzzySound(reading.toLowerCase()));
    readingCache.set(char, readings);
  }
  return readings;
}

function soundsAlike(left: string, right: string) {
  if (left === right) return true;
  const rightReadings = readingsOf(right);
  return readingsOf(left).some((reading) => rightReadings.includes(reading));
}

function countMismatches(text: string[], start: number, phrase: string[]) {
  let mismatches = 0;
  for (let index = 0; index < phrase.length; index += 1) {
    if (!soundsAlike(text[start + index], phrase[index])) mismatches += 1;
  }
  return mismatches;
}

export interface WakeMatch {
  phrase: string;
  /** What the user said after the wake phrase, to be sent as the first message (may be empty). */
  remainder: string;
}

export function matchWakePhrase(transcript: string, phrases: string[]): WakeMatch | null {
  const chars = Array.from(transcript);
  const normalizedChars = chars.map((char) => normalizeWakeText(char));
  const compactIndexes: number[] = [];
  normalizedChars.forEach((char, index) => {
    if (char) compactIndexes.push(index);
  });
  const compact = compactIndexes.map((index) => normalizedChars[index]);

  for (const phrase of phrases) {
    const phraseChars = Array.from(phrase);
    const allowed = phraseChars.length >= 3 ? 1 : 0;
    for (let start = 0; start + phraseChars.length <= compact.length; start += 1) {
      if (countMismatches(compact, start, phraseChars) <= allowed) {
        const lastOriginalIndex = compactIndexes[start + phraseChars.length - 1];
        const remainder = chars.slice(lastOriginalIndex + 1).join('').replace(/^[\s\p{P}]+/u, '').trim();
        return { phrase, remainder };
      }
    }
  }
  return null;
}
