function normalizeDesktopInputAction(value) {
  const normalizedValue = String(value || '').trim().toLowerCase().replace(/[-\s]+/g, '_');
  switch (normalizedValue) {
    case 'move_mouse':
    case 'move_pointer':
    case 'set_cursor':
      return 'move_mouse';
    case 'double_click':
    case 'doubleclick':
      return 'double_click';
    case 'right_click':
    case 'context_click':
      return 'right_click';
    case 'click':
    case 'left_click':
      return 'click';
    case 'type':
    case 'type_text':
    case 'text':
      return 'type_text';
    case 'send_keys':
    case 'keys':
    case 'press_keys':
      return 'send_keys';
    case 'hotkey':
    case 'shortcut':
      return 'hotkey';
    case 'drag':
    case 'drag_mouse':
      return 'drag';
    default:
      return '';
  }
}

function normalizeButton(value) {
  const normalizedValue = String(value || '').trim().toLowerCase();
  return normalizedValue === 'right' || normalizedValue === 'middle' ? normalizedValue : 'left';
}

function normalizeNumber(value, fallback = null) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? Math.round(numberValue) : fallback;
}

function normalizeDesktopInputCoordinateSpace(value) {
  return String(value || '').trim().toLowerCase() === 'native-screen'
    ? 'native-screen'
    : 'dip';
}

function normalizePositiveInteger(value, fallback, max) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(1, Math.min(max, Math.round(numberValue)));
}

function normalizeInputDelayMs(value, fallback, max) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(max, Math.round(numberValue)));
}

function escapeSendKeysText(value) {
  return String(value || '').replace(/[+^%~(){}\[\]]/g, '{$&}');
}

function splitHotkey(value) {
  return String(value || '')
    .split(/[+\s,]+/g)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

const VIRTUAL_KEY_BY_NAME = {
  alt: 0x12,
  backspace: 0x08,
  ctrl: 0x11,
  control: 0x11,
  delete: 0x2e,
  down: 0x28,
  end: 0x23,
  enter: 0x0d,
  esc: 0x1b,
  escape: 0x1b,
  home: 0x24,
  left: 0x25,
  pagedown: 0x22,
  pageup: 0x21,
  pgdn: 0x22,
  pgup: 0x21,
  right: 0x27,
  shift: 0x10,
  space: 0x20,
  tab: 0x09,
  up: 0x26,
  win: 0x5b,
  windows: 0x5b,
};

for (let index = 1; index <= 12; index += 1) {
  VIRTUAL_KEY_BY_NAME[`f${index}`] = 0x70 + index - 1;
}

function virtualKeyFromToken(token) {
  if (VIRTUAL_KEY_BY_NAME[token]) {
    return VIRTUAL_KEY_BY_NAME[token];
  }

  if (/^[a-z]$/i.test(token)) {
    return token.toUpperCase().charCodeAt(0);
  }

  if (/^[0-9]$/u.test(token)) {
    return token.charCodeAt(0);
  }

  return null;
}

module.exports = {
  normalizeDesktopInputAction,
  normalizeButton,
  normalizeNumber,
  normalizeDesktopInputCoordinateSpace,
  normalizePositiveInteger,
  normalizeInputDelayMs,
  escapeSendKeysText,
  splitHotkey,
  virtualKeyFromToken,
};
