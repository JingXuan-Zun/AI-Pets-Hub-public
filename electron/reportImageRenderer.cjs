// Turns a report page (src/reports/taskReportTemplate.ts) into a picture (2026-11-09). The page is
// loaded from a temporary file into a hidden, sandboxed window with JavaScript off, then captured.
// It holds only inline styles, inline SVG and data: images (its own CSP allows nothing else).

const fs = require('fs');
const os = require('os');
const path = require('path');

const MAX_SIDE = 2400;
const MAX_HTML_BYTES = 6 * 1024 * 1024;
const SETTLE_MS = 300;
const RENDER_TIMEOUT_MS = 20_000;

function reportWindowOptions(width, height) {
  return {
    backgroundColor: '#060a24',
    focusable: false,
    frame: false,
    height,
    paintWhenInitiallyHidden: true,
    roundedCorners: false,
    show: false,
    skipTaskbar: true,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      devTools: false,
      javascript: false,
      nodeIntegration: false,
      // Offscreen keeps painting while hidden; a plain hidden window never produces the frame the shot waits for.
      offscreen: true,
      sandbox: true,
      spellcheck: false,
    },
    width,
  };
}

function validate(request) {
  const width = Math.round(Number(request?.width));
  const height = Math.round(Number(request?.height));
  const html = typeof request?.html === 'string' ? request.html : '';
  if (!(width > 0 && width <= MAX_SIDE && height > 0 && height <= MAX_SIDE)) return { error: 'bad size' };
  if (!html || Buffer.byteLength(html, 'utf8') > MAX_HTML_BYTES) return { error: 'bad page' };
  return { height, html, width };
}

function createReportImageRenderer({ BrowserWindow, tempDir = os.tmpdir(), log }) {
  async function render(request) {
    const checked = validate(request);
    if (checked.error) return { error: checked.error, ok: false };
    const { height, html, width } = checked;
    const file = path.join(tempDir, `desktop-pet-report-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
    let win = null;
    let timer = null;
    try {
      fs.writeFileSync(file, html, 'utf8');
      win = new BrowserWindow(reportWindowOptions(width, height));
      win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      win.webContents.on('will-navigate', (event) => event.preventDefault());
      const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), RENDER_TIMEOUT_MS); });
      const shoot = async () => {
        await win.loadFile(file);
        // Windows clamps every window to the screen, so the page is laid out and shot through the
        // DevTools protocol at the exact size and 1x scale instead of capturing the window.
        const cdp = win.webContents.debugger;
        cdp.attach('1.3');
        await cdp.sendCommand('Emulation.setDeviceMetricsOverride', { deviceScaleFactor: 1, height, mobile: false, width });
        await new Promise((resolve) => { setTimeout(resolve, SETTLE_MS); });
        return cdp.sendCommand('Page.captureScreenshot', {
          captureBeyondViewport: true,
          clip: { height, scale: 1, width, x: 0, y: 0 },
          format: 'jpeg',
          quality: 90,
        });
      };
      const shot = await Promise.race([shoot(), timeout]);
      const jpeg = Buffer.from(String(shot?.data || ''), 'base64');
      if (!jpeg.length) return { error: 'empty capture', ok: false };
      return { dataUrl: `data:image/jpeg;base64,${jpeg.toString('base64')}`, height, ok: true, sizeBytes: jpeg.length, width };
    } catch (error) {
      log?.('report image render failed', { error: error instanceof Error ? error.message : String(error) });
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    } finally {
      if (timer) clearTimeout(timer);
      if (win && !win.isDestroyed()) {
        try { if (win.webContents.debugger.isAttached()) win.webContents.debugger.detach(); } catch { /* closing anyway */ }
        win.destroy();
      }
      fs.rm(file, { force: true }, () => {});
    }
  }

  return { render };
}

function registerReportImageIpc({ ipcMain, renderer }) {
  ipcMain.handle('desktop-pet:render-report-image', (_event, request) => renderer.render(request));
}

module.exports = { createReportImageRenderer, registerReportImageIpc, reportWindowOptions };
