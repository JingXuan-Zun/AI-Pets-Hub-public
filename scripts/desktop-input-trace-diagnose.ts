import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

type DesktopInputTraceClassification =
  | 'no_input_diagnostics'
  | 'cursor_move_or_verify_failed'
  | 'sendinput_failed'
  | 'foreground_changed'
  | 'injected_no_effect_possible'
  | 'input_dispatched_unclassified';

interface DesktopInputAttempt {
  downLastError?: number | null;
  downOk?: boolean | null;
  downSent?: number | null;
  fallbackMouseEvent?: boolean | null;
  fgAfterUp?: string | null;
  fgBeforeDown?: string | null;
  index: string;
  raw: string;
  upLastError?: number | null;
  upOk?: boolean | null;
  upSent?: number | null;
}

interface DesktopInputTraceDiagnosis {
  attempts: DesktopInputAttempt[];
  classification: DesktopInputTraceClassification;
  cursorVerified?: boolean | null;
  forcedMouseEventFallback?: boolean | null;
  foregroundStable?: boolean | null;
  inputBackendClassification?: string | null;
  inputDispatched: boolean;
  matchedLines: string[];
  sendInputAllOk?: boolean | null;
  summary: string;
}

function parseBoolean(value: string | undefined) {
  if (value === undefined) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  return null;
}

function parseNumber(value: string | undefined) {
  if (value === undefined) {
    return null;
  }

  const numberValue = Number(value.trim());
  return Number.isFinite(numberValue) ? numberValue : null;
}

function parseLineValue(text: string, label: string) {
  const pattern = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}\\s*:?\\s*([^\\n\\r|]+)`, 'iu');
  return text.match(pattern)?.[1]?.trim() ?? null;
}

function parsePipeField(line: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return line.match(new RegExp(`(?:^|\\|)\\s*${escaped}=([^|]+)`, 'iu'))?.[1]?.trim() ?? null;
}

export function diagnoseDesktopInputTrace(text: string): DesktopInputTraceDiagnosis {
  const lines = text.split(/\r?\n/u);
  const matchedLines = lines
    .filter((line) => /(?:Desktop input action|Input backend|Input foreground stable|Input attempt|SendInput all attempts ok|Forced mouse_event fallback|Cursor verified|Foreground before|Foreground after|SendInput used)/iu.test(line))
    .map((line) => line.trim())
    .filter(Boolean);

  const attempts = matchedLines
    .filter((line) => /Input attempt/iu.test(line))
    .map((line): DesktopInputAttempt => {
      const index = line.match(/Input attempt\s+([^|]+)/iu)?.[1]?.trim() ?? '?';
      return {
        downLastError: parseNumber(parsePipeField(line, 'downLastError')),
        downOk: parseBoolean(parsePipeField(line, 'downOk') ?? undefined),
        downSent: parseNumber(parsePipeField(line, 'downSent')),
        fallbackMouseEvent: parseBoolean(parsePipeField(line, 'fallbackMouseEvent') ?? undefined),
        fgAfterUp: parsePipeField(line, 'fgAfterUp'),
        fgBeforeDown: parsePipeField(line, 'fgBeforeDown'),
        index,
        raw: line,
        upLastError: parseNumber(parsePipeField(line, 'upLastError')),
        upOk: parseBoolean(parsePipeField(line, 'upOk') ?? undefined),
        upSent: parseNumber(parsePipeField(line, 'upSent')),
      };
    });

  const inputBackendClassification = parseLineValue(text, 'Input backend classification');
  const cursorVerified = parseBoolean(parseLineValue(text, 'Cursor verified') ?? undefined);
  const foregroundStable = parseBoolean(parseLineValue(text, 'Input foreground stable') ?? undefined);
  const sendInputAllOk = parseBoolean(parseLineValue(text, 'SendInput all attempts ok') ?? undefined);
  const forcedMouseEventFallback = parseBoolean(parseLineValue(text, 'Forced mouse_event fallback') ?? undefined);
  const inputDispatched = /(?:Desktop input action|Call:\s*execute_desktop_input|Input backend|Input attempt|SendInput used)/iu.test(text);

  let classification: DesktopInputTraceClassification = 'input_dispatched_unclassified';
  if (!inputDispatched || matchedLines.length === 0) {
    classification = 'no_input_diagnostics';
  } else if (cursorVerified === false || inputBackendClassification === 'cursor_move_failed' || inputBackendClassification === 'cursor_not_verified') {
    classification = 'cursor_move_or_verify_failed';
  } else if (
    sendInputAllOk === false
    || inputBackendClassification === 'sendinput_failed'
    || attempts.some((attempt) => attempt.downOk === false || attempt.upOk === false || attempt.downSent === 0 || attempt.upSent === 0)
  ) {
    classification = 'sendinput_failed';
  } else if (foregroundStable === false || inputBackendClassification === 'foreground_changed') {
    classification = 'foreground_changed';
  } else if (
    sendInputAllOk === true
    && foregroundStable !== false
    && cursorVerified !== false
    || inputBackendClassification === 'injected_no_effect_possible'
  ) {
    classification = 'injected_no_effect_possible';
  }

  const summary = [
    `classification=${classification}`,
    `inputDispatched=${inputDispatched}`,
    inputBackendClassification ? `backend=${inputBackendClassification}` : '',
    typeof cursorVerified === 'boolean' ? `cursorVerified=${cursorVerified}` : '',
    typeof sendInputAllOk === 'boolean' ? `sendInputAllOk=${sendInputAllOk}` : '',
    typeof foregroundStable === 'boolean' ? `foregroundStable=${foregroundStable}` : '',
    typeof forcedMouseEventFallback === 'boolean' ? `forcedMouseEventFallback=${forcedMouseEventFallback}` : '',
    `attempts=${attempts.length}`,
  ].filter(Boolean).join(' | ');

  return {
    attempts,
    classification,
    cursorVerified,
    forcedMouseEventFallback,
    foregroundStable,
    inputBackendClassification,
    inputDispatched,
    matchedLines,
    sendInputAllOk,
    summary,
  };
}

function formatDiagnosis(diagnosis: DesktopInputTraceDiagnosis) {
  return [
    diagnosis.summary,
    '',
    diagnosis.attempts.length
      ? [
          'Attempts:',
          ...diagnosis.attempts.map((attempt) => [
            `- #${attempt.index}`,
            `downSent=${attempt.downSent ?? 'unknown'}`,
            `downOk=${attempt.downOk ?? 'unknown'}`,
            `downLastError=${attempt.downLastError ?? 'unknown'}`,
            `upSent=${attempt.upSent ?? 'unknown'}`,
            `upOk=${attempt.upOk ?? 'unknown'}`,
            `upLastError=${attempt.upLastError ?? 'unknown'}`,
            `fallbackMouseEvent=${attempt.fallbackMouseEvent ?? 'unknown'}`,
            `fgBeforeDown=${attempt.fgBeforeDown ?? 'unknown'}`,
            `fgAfterUp=${attempt.fgAfterUp ?? 'unknown'}`,
          ].join(' | ')),
        ].join('\n')
      : 'Attempts: none',
    '',
    diagnosis.matchedLines.length
      ? ['Matched input lines:', ...diagnosis.matchedLines.map((line) => `- ${line}`)].join('\n')
      : 'Matched input lines: none',
  ].join('\n');
}

const sampleInjectedNoEffect = [
  'Desktop input action: click',
  'Cursor verified: true',
  'Input backend classification: injected_no_effect_possible',
  'Input foreground stable: true',
  'SendInput all attempts ok: true',
  'Forced mouse_event fallback: true',
  'Input attempt 1 | downSent=1 | downOk=true | downLastError=0 | upSent=1 | upOk=true | upLastError=0 | fallbackMouseEvent=true | fgBeforeDown=WeGame:123 | fgAfterUp=WeGame:123',
].join('\n');
const sampleSendInputFailed = [
  'Desktop input action: click',
  'Cursor verified: true',
  'Input backend classification: sendinput_failed',
  'Input foreground stable: true',
  'SendInput all attempts ok: false',
  'Input attempt 1 | downSent=0 | downOk=false | downLastError=5 | upSent=1 | upOk=true | upLastError=0 | fallbackMouseEvent=true',
].join('\n');

assert.equal(diagnoseDesktopInputTrace(sampleInjectedNoEffect).classification, 'injected_no_effect_possible');
assert.equal(diagnoseDesktopInputTrace(sampleSendInputFailed).classification, 'sendinput_failed');
assert.equal(diagnoseDesktopInputTrace('only locate_screen_elements happened').classification, 'no_input_diagnostics');

if (process.argv[1]?.replace(/\\/gu, '/').endsWith('desktop-input-trace-diagnose.ts')) {
  const filePath = process.argv[2];
  if (filePath) {
    const diagnosis = diagnoseDesktopInputTrace(readFileSync(filePath, 'utf8'));
    console.log(formatDiagnosis(diagnosis));
  } else {
    console.log('desktop input trace diagnose smoke ok');
    console.log('Usage: npx tsx scripts/desktop-input-trace-diagnose.ts <trace-text-file>');
  }
}
