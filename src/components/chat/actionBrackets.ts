// Brackets that mark an action or aside in a character's line ("（笑了笑）", "【回头看你】"). Text
// inside them is drawn dark, spoken text in the character colour.
//
// Models mix brackets up ("【嘴角压不住地弯}"); with "}" unknown that bracket never closed and
// every later line lost its colour. Curly brackets count too, and a line break always ends
// whatever bracket is still open, so a stray one costs at most its own line.

export const OPENING_ACTION_BRACKETS = new Set(['(', '（', '[', '【', '{', '｛', '〔', '［']);
export const CLOSING_ACTION_BRACKETS = new Set([')', '）', ']', '】', '}', '｝', '〕', '］']);

export function endsActionBracketLine(character: string) {
  return character === '\n';
}
