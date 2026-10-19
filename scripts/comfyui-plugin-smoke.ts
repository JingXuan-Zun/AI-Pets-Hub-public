import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { createComfyUiWorkflowEntry, prepareComfyUiWorkflowRun } from '../src/comfyui/comfyUiWorkflow';
import { normalizeComfyUiSettings } from '../src/comfyui/comfyUiSettings';
import type { PetConfig } from '../src/types';

const require = createRequire(import.meta.url);
const { createComfyUiService } = require('../electron/comfyUiService.cjs') as {
  createComfyUiService: (options?: object) => {
    runWorkflow: (request: object) => Promise<{ durationMs?: number; error?: string; images?: Array<{ dataUrl: string; mimeType: string; name: string; sizeBytes: number }>; ok: boolean }>;
    testConnection: (request: object) => Promise<{ device?: string; error?: string; ok: boolean; version?: string }>;
  };
};

let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases += 1; };

// ComfyUI's default text-to-image workflow, as "Save (API)" exports it.
const defaultWorkflow = {
  3: { class_type: 'KSampler', inputs: { cfg: 8, denoise: 1, latent_image: ['5', 0], model: ['4', 0], negative: ['7', 0], positive: ['6', 0], sampler_name: 'euler', scheduler: 'normal', seed: 156680208700286, steps: 20 } },
  4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'v1-5-pruned-emaonly.safetensors' } },
  5: { class_type: 'EmptyLatentImage', inputs: { batch_size: 1, height: 512, width: 512 } },
  6: { _meta: { title: 'Positive' }, class_type: 'CLIPTextEncode', inputs: { clip: ['4', 1], text: 'masterpiece, best quality, {prompt}' } },
  7: { class_type: 'CLIPTextEncode', inputs: { clip: ['4', 1], text: 'text, watermark' } },
  8: { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
  9: { class_type: 'SaveImage', inputs: { filename_prefix: 'ComfyUI', images: ['8', 0] } },
};

const entry = createComfyUiWorkflowEntry({ id: 'w1', name: '二次元', now: 1, text: JSON.stringify(defaultWorkflow) });
check([entry.positive, entry.negative, entry.seeds], [{ inputKey: 'text', nodeId: '6' }, { inputKey: 'text', nodeId: '7' }, [{ inputKey: 'seed', nodeId: '3' }]], 'prompt, negative and seed found from the sampler');
const prepared = prepareComfyUiWorkflowRun(entry, { negativePrompt: 'bad hands', prompt: '1girl, kimono, cherry blossoms', random: () => 0.5 });
check(prepared['6'].inputs.text, 'masterpiece, best quality, 1girl, kimono, cherry blossoms', '{prompt} placeholder keeps the quality tags');
check(prepared['7'].inputs.text, 'bad hands', 'negative replaced');
check(prepared['3'].inputs.seed, 2 ** 47, 'seed randomised');
check(entry.workflow['6'].inputs.text, 'masterpiece, best quality, {prompt}', 'the saved workflow is not changed');
assert.throws(() => createComfyUiWorkflowEntry({ id: 'x', name: 'ui', text: JSON.stringify({ links: [], nodes: [] }) }), /Save \(API\)/u);
cases += 1;
check(normalizeComfyUiSettings({ defaultWorkflowId: 'gone', workflows: [entry] }).defaultWorkflowId, 'w1', 'a missing default falls back to the first workflow');

// A fake ComfyUI server: queue, one pending poll, then a finished history with an image.
const png = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
let polls = 0;
let queuedPrompt: Record<string, { inputs: Record<string, unknown> }> | null = null;
let seenAuth = '';
const server = http.createServer((request, response) => {
  seenAuth = String(request.headers.authorization || '');
  const url = new URL(request.url || '/', 'http://x');
  if (url.pathname === '/system_stats') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ devices: [{ name: 'cuda:0 Fake GPU' }], system: { comfyui_version: '0.3.0' } }));
    return;
  }
  if (url.pathname === '/prompt' && request.method === 'POST') {
    let body = '';
    request.on('data', (chunk) => { body += chunk; });
    request.on('end', () => {
      queuedPrompt = JSON.parse(body).prompt;
      if (queuedPrompt?.['4']?.inputs.ckpt_name === 'missing.safetensors') {
        response.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ node_errors: { 4: { errors: [{ details: 'ckpt_name: missing.safetensors not in list', message: 'Value not in list' }] } } }));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ prompt_id: 'p1' }));
    });
    return;
  }
  if (url.pathname === '/history/p1') {
    polls += 1;
    const done = polls >= 2;
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(done
      ? { p1: { outputs: { 9: { images: [{ filename: 'ComfyUI_00001_.png', subfolder: '', type: 'output' }] } }, status: { completed: true, status_str: 'success' } } }
      : {}));
    return;
  }
  if (url.pathname === '/view') {
    response.writeHead(200, { 'Content-Type': 'image/png' }).end(png);
    return;
  }
  response.writeHead(404).end();
});
await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
const serverUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
const service = createComfyUiService();

const tested = await service.testConnection({ apiKey: 'secret-token', serverUrl: `${serverUrl}/` });
check([tested.ok, tested.version, tested.device, seenAuth], [true, '0.3.0', 'cuda:0 Fake GPU', 'Bearer secret-token'], 'connection test with token');
const ran = await service.runWorkflow({ serverUrl, timeoutMs: 20_000, workflow: prepared });
check([ran.ok, ran.images?.length, ran.images?.[0].mimeType, ran.images?.[0].dataUrl.startsWith('data:image/png;base64,')], [true, 1, 'image/png', true], 'queued, polled until done, image fetched');
check(queuedPrompt?.['6'].inputs.text, 'masterpiece, best quality, 1girl, kimono, cherry blossoms', 'the filled workflow is what ComfyUI got');
const rejected = await service.runWorkflow({ serverUrl, workflow: { ...prepared, 4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'missing.safetensors' } } } });
check([rejected.ok, rejected.error], [false, 'ckpt_name: missing.safetensors not in list'], 'ComfyUI\'s node error is passed on readably');
check((await service.testConnection({ serverUrl: 'ftp://nope' })).ok, false, 'only http(s) addresses');

// The capability end to end, with the desktop bridge pointing at the same service.
const presented: unknown[] = [];
(globalThis as unknown as { window: unknown }).window = { desktopPetShell: { comfyUi: { run: (request: object) => service.runWorkflow(request), test: () => Promise.resolve({ ok: true }) } } };
const { runPlatformCapability } = await import('../src/platform-capabilities/platformCapabilityRegistry');
const config = { settings: { comfyUi: { defaultWorkflowId: 'w1', serverUrl, timeoutSeconds: 60, workflows: [entry] }, comfyUiApiKey: '' } } as unknown as PetConfig;
polls = 0;
const drawn = await runPlatformCapability(
  { configRef: { current: config }, onUpdateConfig: () => {}, petId: 'primary', presentImages: (images) => presented.push(...images) },
  { args: { prompt: 'cat on a desk' }, capability: 'images.generate' },
);
check([drawn.ok, presented.length], [true, 1], 'the character draws and the picture goes to the chat');
assert.match(drawn.text, /画好了（工作流“二次元”/u);
cases += 1;
const listed = await runPlatformCapability({ configRef: { current: config }, onUpdateConfig: () => {} }, { args: {}, capability: 'images.list_workflows' });
assert.match(listed.text, /二次元（默认）/u);
cases += 1;

server.close();
console.log(`comfyui plugin smoke ok: ${cases} checks`);
