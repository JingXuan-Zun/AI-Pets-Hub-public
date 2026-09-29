export async function copySettingsTextToClipboard(text: string) {
  if (!text || !navigator.clipboard?.writeText) {
    return false;
  }

  await navigator.clipboard.writeText(text);
  return true;
}
