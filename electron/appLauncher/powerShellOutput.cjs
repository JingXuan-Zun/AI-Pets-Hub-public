const { TextDecoder } = require('util');

function stripPowerShellCliXml(value) {
  return String(value || '')
    .replace(/^\uFEFF/u, '')
    .replace(/#<\s*CLIXML[\s\S]*$/u, '')
    .trim();
}

function countTextMatches(value, pattern) {
  return (String(value || '').match(pattern) || []).length;
}

function decodePowerShellOutput(value) {
  if (Buffer.isBuffer(value)) {
    if (value.length === 0) {
      return '';
    }

    const utf8 = value.toString('utf8');
    if (!utf8.includes('\uFFFD') && !utf8.includes('\u0000')) {
      return utf8;
    }

    const candidates = [
      utf8,
      value.length >= 2 && value[0] === 0xff && value[1] === 0xfe
        ? value.subarray(2).toString('utf16le')
        : value.toString('utf16le'),
    ];

    try {
      candidates.push(new TextDecoder('gb18030').decode(value));
    } catch {
      // Some runtimes may not expose gb18030; utf8/utf16le still cover most cases.
    }

    return candidates
      .map((text, index) => ({
        index,
        score:
          countTextMatches(text, /\uFFFD/g) * 100
          + countTextMatches(text, /\u0000/g) * 50
          + countTextMatches(text, /[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g) * 25,
        text,
      }))
      .sort((first, second) => first.score - second.score || first.index - second.index)[0]?.text || utf8;
  }

  return String(value || '');
}

function compactPowerShellErrorText(value, maxLength = 900) {
  const text = stripPowerShellCliXml(decodePowerShellOutput(value))
    .replace(/\s+/g, ' ')
    .replace(/-EncodedCommand\s+[A-Za-z0-9+/=]+/g, '-EncodedCommand <redacted>')
    .trim();
  if (!text) {
    return '';
  }

  return text.length > maxLength ? `${text.slice(0, maxLength - 3)}...` : text;
}

module.exports = { stripPowerShellCliXml, decodePowerShellOutput, compactPowerShellErrorText };
