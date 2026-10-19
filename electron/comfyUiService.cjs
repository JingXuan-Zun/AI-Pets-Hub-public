// Runs ComfyUI workflows for the character (“画一张…”). Calls go from the main process: ComfyUI
// does not allow cross-origin requests from the page by default, and an optional access token
// (for a cloud or protected server) stays out of the page's network requests.
//
// ComfyUI API: POST /prompt { prompt, client_id } → { prompt_id }; GET /history/{id} until it has
// outputs; images from GET /view?filename=&subfolder=&type=.

const POLL_INTERVAL_MS = 1000;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

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
      return { device: device?.name || '', ok: true, version: stats?.system?.comfyui_version || '' };
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

  async function runWorkflow(request = {}, signal = null) {
    const startedAt = Date.now();
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
      const message = error instanceof Error ? error.message : String(error);
      log?.('comfyui run failed', { durationMs: Date.now() - startedAt, error: message });
      return { error: message, ok: false };
    }
  }

  return { runWorkflow, testConnection };
}

function registerComfyUiIpcHandlers({ ipcMain, service }) {
  ipcMain.handle('desktop-pet:comfyui-test', (_event, request) => service.testConnection(request ?? {}));
  ipcMain.handle('desktop-pet:comfyui-run', (_event, request) => service.runWorkflow(request ?? {}));
}

module.exports = { createComfyUiService, describePromptError, normalizeServerUrl, registerComfyUiIpcHandlers };
