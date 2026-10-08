
function readNativeResultList(stdout) {
  const parsed = JSON.parse(String(stdout || '[]').trim() || '[]');
  return Array.isArray(parsed) ? parsed : [parsed];
}

function parseNativeDisplayBounds(stdout) {
  return readNativeResultList(stdout)
    .map((display) => ({
      deviceName: String(display?.deviceName ?? ''),
      isPrimary: Boolean(display?.isPrimary),
      x: Math.round(Number(display?.x ?? 0)),
      y: Math.round(Number(display?.y ?? 0)),
      width: Math.max(1, Math.round(Number(display?.width ?? 1))),
      height: Math.max(1, Math.round(Number(display?.height ?? 1))),
    }))
    .filter((display) => display.width > 0 && display.height > 0);
}

function parseNativeScreenPreviews(stdout) {
  return new Map(
    readNativeResultList(stdout)
      .filter((entry) => entry?.displayId && entry?.thumbnail)
      .map((entry) => [String(entry.displayId), String(entry.thumbnail)]),
  );
}

module.exports = { readNativeResultList, parseNativeDisplayBounds, parseNativeScreenPreviews };
