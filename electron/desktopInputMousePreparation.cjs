const { normalizeButton, normalizeNumber, normalizePositiveInteger, normalizeInputDelayMs } = require('./desktopInputRules.cjs');

function prepareMouseInput(options) {
  const x = normalizeNumber(options.nativeScreenX);
  const y = normalizeNumber(options.nativeScreenY);
  if (x === null || y === null) {
    return null;
  }

  const button = normalizeButton(options.button);
  const isRight = button === 'right';
  const isMiddle = button === 'middle';
  const downFlag = isMiddle ? '0x0020' : isRight ? '0x0008' : '0x0002';
  const upFlag = isMiddle ? '0x0040' : isRight ? '0x0010' : '0x0004';
  const clicks = options.action === 'double_click'
    ? 2
    : normalizePositiveInteger(options.repeat ?? options.clickCount, 1, 4);
  const preClickDelayMs = normalizeInputDelayMs(options.preClickDelayMs, 80, 1000);
  const holdMs = normalizeInputDelayMs(options.holdMs ?? options.clickHoldMs, 40, 1000);
  const intervalMs = normalizeInputDelayMs(options.intervalMs ?? options.clickIntervalMs, 80, 1000);
  const forceMouseEventFallback = Boolean(options.forceMouseEventFallback);
  const forceTouchInjectionFallback = !isRight && !isMiddle && Boolean(options.forceTouchInjectionFallback);
  const keyboardFallback = String(options.keyboardFallback || options.fallbackKey || '').trim();
  const shouldKeyboardFallback = Boolean(keyboardFallback);
  const expectedTargetHwnd = normalizeNumber(options.expectedForegroundHwnd ?? options.expectedHwnd ?? options.hwnd ?? options.windowHandle) ?? 0;

  return {
    x, y, button, isRight, isMiddle, downFlag, upFlag, clicks,
    preClickDelayMs, holdMs, intervalMs, forceMouseEventFallback, forceTouchInjectionFallback,
    keyboardFallback, shouldKeyboardFallback, expectedTargetHwnd,
  };
}

module.exports = { prepareMouseInput };
