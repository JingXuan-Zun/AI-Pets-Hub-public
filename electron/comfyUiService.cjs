// Runs ComfyUI workflows for the character (“画一张…”). Calls go from the main process: ComfyUI
// does not allow cross-origin requests from the page by default, and an optional access token
// (for a cloud or protected server) stays out of the page's network requests.
//
// ComfyUI API: POST /prompt { prompt, client_id } → { prompt_id }; GET /history/{id} until it has
// outputs; images from GET /view?filename=&subfolder=&type=.
//
// With our small ComfyUI extension (resources/comfyui-extension/ai-desktop-pet-sync) the canvas is
// kept in API format at user/default/desktop-pet-sync/<workflow name>.json and _current.json,
// read through GET /api/userdata/<path>; GET /extensions tells whether the extension is loaded.

const fs = require('node:fs');
const path = require('node:path');

const POLL_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const SYNC_FOLDER = 'desktop-pet-sync';
const SYNC_SCRIPT = 'desktopPetSync.js';

function normalizeServerUrl(value) {
  const text = String(value || '').trim().replace(/\/+$/u, '');
  let url;
  try {
    url = new URL(text);
  } catch {
    throw new Error('ComfyUI 地址不对，应该像 http://127.0.0.1:8188');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('ComfyUI 地址要以 http:// 或 https:// 开头');
  return text;
}

function authHeaders(apiKey) {
  const key = String(apiKey || '').trim();
  return key ? { Authorization: `Bearer ${key}` } : {};
}

async function readJson(response, what) {
  if (response.status === 401 || response.status === 403) throw new Error(`ComfyUI 拒绝了访问（${response.status}），检查访问令牌`);
  if (!response.ok) {
    const detail = (await response.text().catch(() => '')).slice(0, 300);
    throw new Error(`ComfyUI ${what}失败（HTTP ${response.status}）${detail ? `：${detail}` : ''}`);
  }
  return response.json();
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener?.('abort', () => { clearTimeout(timer); reject(new Error('已取消')); }, { once: true });
  });
}

/** ComfyUI rejects a workflow with per-node errors; turn them into one readable line. */
function describePromptError(body) {
  const nodeErrors = body?.node_errors && typeof body.node_errors === 'object' ? Object.values(body.node_errors) : [];
  const first = nodeErrors.flatMap((node) => node?.errors ?? []).find(Boolean);
  return first?.details || first?.message || body?.error?.message || '工作流没有通过 ComfyUI 的检查';
}

function createComfyUiService({ fetchImpl = globalThis.fetch, log } = {}) {
  async function testConnection(request = {}) {
    try {
      const serverUrl = normalizeServerUrl(request.serverUrl);
      const stats = await readJson(await fetchImpl(`${serverUrl}/system_stats`, { headers: authHeaders(request.apiKey) }), '连接');
      const device = Array.isArray(stats?.devices) ? stats.devices[0] : null;
      const extensions = await fetchImpl(`${serverUrl}/extensions`, { headers: authHeaders(request.apiKey) })
        .then((response) => (response.ok ? response.json() : [])).catch(() => []);
      const syncExtension = Array.isArray(extensions) && extensions.some((path) => String(path).endsWith(SYNC_SCRIPT));
      return { device: device?.name || '', ok: true, syncExtension, version: stats?.system?.comfyui_version || '' };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  async function fetchImage(serverUrl, apiKey, image) {
    const query = new URLSearchParams({ filename: image.filename, subfolder: image.subfolder || '', type: image.type || 'output' });
    const response = await fetchImpl(`${serverUrl}/view?${query}`, { headers: authHeaders(apiKey) });
    if (!response.ok) throw new Error(`取图失败（HTTP ${response.status}）`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > MAX_IMAGE_BYTES) throw new Error('生成的图片太大');
    const mimeType = response.headers.get('content-type') || 'image/png';
    return { dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`, mimeType, name: image.filename, sizeBytes: bytes.length };
  }

  // Runs that can still be cancelled, by the id the page gave them.
  const activeRuns = new Map();

  async function runWorkflow(request = {}, outerSignal = null) {
    const startedAt = Date.now();
    const runId = typeof request.runId === 'string' ? request.runId : '';
    const controller = new AbortController();
    outerSignal?.addEventListener?.('abort', () => controller.abort(), { once: true });
    const signal = controller.signal;
    const run = { apiKey: request.apiKey, controller, promptId: '', serverUrl: '' };
    if (runId) activeRuns.set(runId, run);
    try {
      const serverUrl = normalizeServerUrl(request.serverUrl);
      if (!request.workflow || typeof request.workflow !== 'object') throw new Error('没有工作流');
      const headers = { 'Content-Type': 'application/json', ...authHeaders(request.apiKey) };
      const queued = await fetchImpl(`${serverUrl}/prompt`, {
        body: JSON.stringify({ client_id: 'ai-desktop-pet', prompt: request.workflow }),
        headers,
        method: 'POST',
        signal,
      });
      if (queued.status === 400) throw new Error(describePromptError(await queued.json().catch(() => null)));
      const { prompt_id: promptId } = await readJson(queued, '提交');
      if (!promptId) throw new Error('ComfyUI 没有返回任务编号');
      run.promptId = promptId;
      run.serverUrl = serverUrl;
      const timeoutMs = Math.max(10_000, Math.min(30 * 60 * 1000, Number(request.timeoutMs) || DEFAULT_TIMEOUT_MS));
      while (Date.now() - startedAt < timeoutMs) {
        await wait(POLL_INTERVAL_MS, signal);
        const history = await readJson(await fetchImpl(`${serverUrl}/history/${encodeURIComponent(promptId)}`, { headers: authHeaders(request.apiKey), signal }), '查询进度');
        const entry = history?.[promptId];
        if (!entry) continue;
        if (entry.status?.status_str === 'error') {
          const failed = (entry.status.messages || []).find((message) => message?.[0] === 'execution_error')?.[1];
          throw new Error(failed?.exception_message ? `生成出错：${String(failed.exception_message).slice(0, 300)}` : '生成出错');
        }
        if (!entry.status?.completed && !entry.outputs) continue;
        const images = Object.values(entry.outputs || {}).flatMap((output) => (Array.isArray(output?.images) ? output.images : []))
          .filter((image) => image?.filename && image.type !== 'temp')
          .slice(0, MAX_IMAGES);
        if (!images.length) {
          if (entry.status?.completed) throw new Error('工作流跑完了，但没有保存图片的节点（需要 SaveImage）');
          continue;
        }
        const results = [];
        for (const image of images) results.push(await fetchImage(serverUrl, request.apiKey, image));
        log?.('comfyui run complete', { durationMs: Date.now() - startedAt, imageCount: results.length });
        return { durationMs: Date.now() - startedAt, images: results, ok: true };
      }
      throw new Error(`等了 ${Math.round(timeoutMs / 1000)} 秒还没画完`);
    } catch (error) {
      const message = signal.aborted ? '已取消' : error instanceof Error ? error.message : String(error);
      log?.('comfyui run failed', { durationMs: Date.now() - startedAt, error: message });
      return { error: message, ok: false };
    } finally {
      if (runId) activeRuns.delete(runId);
    }
  }

  /**
   * Stops a run: no more waiting here, and ComfyUI drops it — taken out of the queue if it has
   * not started, interrupted if it is the one being drawn (an interrupt stops whatever is
   * running, so only when it is ours).
   */
  async function cancelRun(request = {}) {
    const run = activeRuns.get(String(request.runId || ''));
    if (!run) return { ok: false, error: '没有这个任务' };
    run.controller.abort();
    if (!run.promptId) return { ok: true };
    const headers = { 'Content-Type': 'application/json', ...authHeaders(run.apiKey) };
    try {
      const queue = await readJson(await fetchImpl(`${run.serverUrl}/queue`, { headers: authHeaders(run.apiKey) }), '查询队列');
      const isOurs = (entry) => Array.isArray(entry) && entry[1] === run.promptId;
      if ((queue?.queue_running || []).some(isOurs)) {
        await fetchImpl(`${run.serverUrl}/interrupt`, { body: '{}', headers, method: 'POST' });
      } else if ((queue?.queue_pending || []).some(isOurs)) {
        await fetchImpl(`${run.serverUrl}/queue`, { body: JSON.stringify({ delete: [run.promptId] }), headers, method: 'POST' });
      }
      log?.('comfyui run cancelled', { promptId: run.promptId });
      return { ok: true };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  /**
   * The canvas copies the extension keeps, for the given workflow names and the open one
   * (_current); none when the extension is missing or the page was never opened.
   */
  async function readSynced(request = {}) {
    try {
      const serverUrl = normalizeServerUrl(request.serverUrl);
      const names = [...new Set([...(Array.isArray(request.names) ? request.names : []), '_current']
        .map((name) => String(name || '').replace(/[\\/:*?"<>|]/gu, '_').trim()).filter(Boolean))];
      const copies = [];
      for (const name of names) {
        const response = await fetchImpl(`${serverUrl}/api/userdata/${encodeURIComponent(`${SYNC_FOLDER}/${name}.json`)}`, { headers: authHeaders(request.apiKey) });
        if (!response.ok) continue;
        const body = await response.json().catch(() => null);
        if (body?.prompt && typeof body.prompt === 'object') copies.push({ file: name, name: String(body.name || ''), prompt: body.prompt, savedAt: Number(body.savedAt) || 0 });
      }
      return { copies, ok: true };
    } catch (error) {
      return { copies: [], error: error instanceof Error ? error.message : String(error), ok: false };
    }
  }

  return { cancelRun, readSynced, runWorkflow, testConnection };
}

function registerComfyUiIpcHandlers({ ipcMain, service, shell = null, sourceDir = '', userDataPath = '' }) {
  ipcMain.handle('desktop-pet:comfyui-test', (_event, request) => service.testConnection(request ?? {}));
  ipcMain.handle('desktop-pet:comfyui-run', (_event, request) => service.runWorkflow(request ?? {}));
  ipcMain.handle('desktop-pet:comfyui-cancel', (_event, request) => service.cancelRun(request ?? {}));
  ipcMain.handle('desktop-pet:comfyui-read-synced', (_event, request) => service.readSynced(request ?? {}));
  if (shell && userDataPath && sourceDir) {
    ipcMain.handle('desktop-pet:comfyui-open-extension', async () => {
      try {
        // Copied out of the app (which may be packed) so it can be copied to ComfyUI's custom_nodes.
        const target = copyExtension(sourceDir, path.join(userDataPath, 'comfyui-extension', 'ai-desktop-pet-sync'));
        shell.showItemInFolder(target);
        return { ok: true, path: target };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error), ok: false };
      }
    });
  }
}

function copyExtension(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.isDirectory()) copyExtension(path.join(from, entry.name), path.join(to, entry.name));
    else fs.writeFileSync(path.join(to, entry.name), fs.readFileSync(path.join(from, entry.name)));
  }
  return to;
}

module.exports = { createComfyUiService, describePromptError, normalizeServerUrl, registerComfyUiIpcHandlers };
