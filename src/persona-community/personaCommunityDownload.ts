export function savePersonaDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  try { link.click(); }
  finally {
    link.remove();
    // Allow the browser/Electron download handler to consume the Blob URL.
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
