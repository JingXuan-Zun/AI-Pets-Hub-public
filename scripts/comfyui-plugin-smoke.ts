import assert from 'node:assert/strict';
import http from 'node:http';
import { createRequire } from 'node:module';
import { createComfyUiWorkflowEntry, pickSyncedComfyUiWorkflow, prepareComfyUiWorkflowRun } from '../src/comfyui/comfyUiWorkflow';
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

const syncedCanvas = (() => { const copy = JSON.parse(JSON.stringify(defaultWorkflow)); copy['5'].inputs.width = 768; return copy; })();
const entry = createComfyUiWorkflowEntry({ id: 'w1', name: '二次元', now: 1, text: JSON.stringify(defaultWorkflow) });
check([entry.positive, entry.negative, entry.seeds], [{ inputKey: 'text', nodeId: '6' }, { inputKey: 'text', nodeId: '7' }, [{ inputKey: 'seed', nodeId: '3' }]], 'prompt, negative and seed found from the sampler');
const prepared = prepareComfyUiWorkflowRun(entry, { negativePrompt: 'bad hands', prompt: '1girl, kimono, cherry blossoms', random: () => 0.5 });
check(prepared['6'].inputs.text, 'masterpiece, best quality, 1girl, kimono, cherry blossoms', '{prompt} placeholder keeps the quality tags');
check(prepared['7'].inputs.text, 'text, watermark, bad hands', 'her negative prompt goes after the user\'s own negative tags');
check(prepared['3'].inputs.seed, 2 ** 47, 'seed randomised');
check(entry.workflow['6'].inputs.text, 'masterpiece, best quality, {prompt}', 'the saved workflow is not changed');
// A prompt put together from several text boxes (quality + artist + character + subject), the
// subject behind a "random tags" switch that is on: the subject box is found and the switch turned.
const concatWorkflow = {
  8: { class_type: 'KSampler', inputs: { negative: ['11', 0], positive: ['9', 0], seed: 1 } },
  9: { _meta: { title: '正面' }, class_type: 'CLIPTextEncode', inputs: { clip: ['110', 0], text: ['43', 0] } },
  11: { _meta: { title: '负面' }, class_type: 'CLIPTextEncode', inputs: { clip: ['110', 0], text: ['44', 0] } },
  33: { class_type: 'StringConcatenate', inputs: { delimiter: ',', string_a: ['36', 0], string_b: ['42', 0] } },
  35: { class_type: 'StringConcatenate', inputs: { delimiter: ',', string_a: ['39', 0], string_b: ['141', 0] } },
  36: { _meta: { title: '质量' }, class_type: 'PrimitiveStringMultiline', inputs: { value: 'best quality' } },
  38: { _meta: { title: '内容' }, class_type: 'PrimitiveStringMultiline', inputs: { value: 'old subject' } },
  39: { _meta: { title: '人物' }, class_type: 'PrimitiveStringMultiline', inputs: { value: '1girl' } },
  42: { _meta: { title: '画师' }, class_type: 'PrimitiveStringMultiline', inputs: { value: 'some artist' } },
  43: { class_type: 'StringConcatenate', inputs: { delimiter: ',', string_a: ['33', 0], string_b: ['35', 0] } },
  44: { _meta: { title: '负面' }, class_type: 'PrimitiveStringMultiline', inputs: { value: 'bad hands' } },
  95: { class_type: 'PrimitiveBoolean', inputs: { value: true } },
  110: { class_type: 'CLIPLoader', inputs: { clip_name: 'clip.safetensors' } },
  117: { class_type: 'Raffle', inputs: { exclude_taglists_containing: ['133', 0], negative_prompt: ['44', 0], seed: 2 } },
  128: { _meta: { title: '随机提示词' }, class_type: 'ComfySwitchNode', inputs: { on_false: ['38', 0], on_true: ['117', 0], switch: true } },
  129: { class_type: 'ComfySwitchNode', inputs: { on_false: ['128', 0], on_true: ['117', 0], switch: ['95', 0] } },
  133: { _meta: { title: 'If ANY of these tags appear' }, class_type: 'PrimitiveStringMultiline', inputs: { value: 'x' } },
  141: { _meta: { title: '提示词优化' }, class_type: 'ComfySwitchNode', inputs: { on_false: ['129', 0], on_true: ['117', 0], switch: false } },
};
const concat = createComfyUiWorkflowEntry({ id: 'w2', name: '拼接', now: 1, text: JSON.stringify(concatWorkflow) });
check([concat.positive, concat.negative], [{ inputKey: 'value', nodeId: '38' }, { inputKey: 'value', nodeId: '44' }], 'the subject box among concatenated boxes, the negative box');
const concatRun = prepareComfyUiWorkflowRun(concat, { negativePrompt: 'lowres', prompt: 'cat on a desk', random: () => 0.5 });
check([concatRun['38'].inputs.value, concatRun['36'].inputs.value, concatRun['128'].inputs.switch, concatRun['95'].inputs.value, concatRun['141'].inputs.switch],
  ['cat on a desk', 'best quality', false, false, false], 'subject filled, quality kept, switches turned to the subject (also one set by a boolean node)');
check(concat.workflow['128'].inputs.switch, true, 'the saved workflow keeps its switches');
// “随便画一张”: no prompt, the workflow runs as set in ComfyUI (random tags stay on), new seeds.
const asSetRun = prepareComfyUiWorkflowRun(concat, { prompt: '', random: () => 0.5 });
check([asSetRun['128'].inputs.switch, asSetRun['38'].inputs.value, asSetRun['8'].inputs.seed], [true, 'old subject', 2 ** 47], 'as set: switches and text untouched, seed renewed');
// {prompt} written in two boxes: the subject box wins, the other loses the marker.
const marked = JSON.parse(JSON.stringify(concatWorkflow));
marked['38'].inputs.value = '{prompt}';
marked['39'].inputs.value = '1girl, {prompt}';
const markedEntry = createComfyUiWorkflowEntry({ id: 'w3', name: '两处', now: 1, text: JSON.stringify(marked) });
const markedRun = prepareComfyUiWorkflowRun(markedEntry, { prompt: 'cat', random: () => 0.5 });
check([markedEntry.positive?.nodeId, markedRun['38'].inputs.value, markedRun['39'].inputs.value], ['38', 'cat', '1girl'], 'subject box preferred among {prompt} boxes, the leftover marker removed');
check(normalizeComfyUiSettings({ workflows: [{ ...concat, negative: null, positive: null }] }).workflows[0].positive, { inputKey: 'value', nodeId: '38' }, 'a workflow imported before is looked at again');
// The canvas as the extension keeps it: the size changed in ComfyUI is what gets drawn.
const canvas = JSON.parse(JSON.stringify(defaultWorkflow));
canvas['5'].inputs.width = 1024;
const fromName = pickSyncedComfyUiWorkflow(entry, [{ file: '二次元', name: '二次元', prompt: canvas, savedAt: 2 }]);
check([fromName?.workflow['5'].inputs.width, fromName?.positive, fromName?.id], [1024, entry.positive, 'w1'], 'the copy under its name replaces the imported one, prompt box kept');
check(pickSyncedComfyUiWorkflow(entry, [{ file: '_current', name: '别的', prompt: concatWorkflow, savedAt: 3 }]), null, 'another workflow open on the canvas is not used');
check(pickSyncedComfyUiWorkflow({ ...entry, name: '改过名' }, [{ file: '_current', name: '未保存', prompt: canvas, savedAt: 3 }])?.workflow['5'].inputs.width, 1024, 'the open canvas is used when it is clearly the same workflow');
check(pickSyncedComfyUiWorkflow(entry, []), null, 'nothing synced: draw with the imported copy');
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
  if (url.pathname === '/extensions') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(['/extensions/core/x.js', '/extensions/ai-desktop-pet-sync/desktopPetSync.js']));
    return;
  }
  if (url.pathname === `/api/userdata/${encodeURIComponent('desktop-pet-sync/二次元.json')}` || url.pathname === '/api/userdata/desktop-pet-sync/二次元.json' || decodeURIComponent(url.pathname) === '/api/userdata/desktop-pet-sync/二次元.json') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ name: '二次元', prompt: syncedCanvas, savedAt: 5 }));
    return;
  }
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
check(tested.syncExtension, true, 'the sync extension is seen as loaded');
const read = await service.readSynced({ apiKey: 'secret-token', names: ['二次元', ''], serverUrl });
check([read.ok, read.copies.map((copy) => copy.file)], [true, ['二次元']], 'the copy kept under the workflow name is read; a missing _current is skipped');
check([tested.ok, tested.version, tested.device, seenAuth], [true, '0.3.0', 'cuda:0 Fake GPU', 'Bearer secret-token'], 'connection test with token');
const ran = await service.runWorkflow({ serverUrl, timeoutMs: 20_000, workflow: prepared });
check([ran.ok, ran.images?.length, ran.images?.[0].mimeType, ran.images?.[0].dataUrl.startsWith('data:image/png;base64,')], [true, 1, 'image/png', true], 'queued, polled until done, image fetched');
check(queuedPrompt?.['6'].inputs.text, 'masterpiece, best quality, 1girl, kimono, cherry blossoms', 'the filled workflow is what ComfyUI got');
const rejected = await service.runWorkflow({ serverUrl, workflow: { ...prepared, 4: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: 'missing.safetensors' } } } });
check([rejected.ok, rejected.error], [false, 'ckpt_name: missing.safetensors not in list'], 'ComfyUI\'s node error is passed on readably');
check((await service.testConnection({ serverUrl: 'ftp://nope' })).ok, false, 'only http(s) addresses');

// The capability end to end, with the desktop bridge pointing at the same service.
const presented: unknown[] = [];
(globalThis as unknown as { window: unknown }).window = { desktopPetShell: { comfyUi: { readSynced: (request: object) => service.readSynced(request), run: (request: object) => service.runWorkflow(request), test: () => Promise.resolve({ ok: true }) } } };
const { runPlatformCapability } = await import('../src/platform-capabilities/platformCapabilityRegistry');
const config = { settings: { comfyUi: { defaultWorkflowId: 'w1', serverUrl, timeoutSeconds: 60, workflows: [entry] }, comfyUiApiKey: '' } } as unknown as PetConfig;
polls = 0;
const drawn = await runPlatformCapability(
  { configRef: { current: config }, onUpdateConfig: () => {}, petId: 'primary', presentImages: (images) => presented.push(...images) },
  { args: { prompt: 'cat on a desk' }, capability: 'images.generate' },
);
check([drawn.ok, presented.length], [true, 1], 'the character draws and the picture goes to the chat');
check(queuedPrompt?.['5'].inputs.width, 768, 'what was changed on the ComfyUI canvas is what gets drawn');
assert.match(drawn.text, /画好了（工作流“二次元”/u);
cases += 1;
const listed = await runPlatformCapability({ configRef: { current: config }, onUpdateConfig: () => {} }, { args: {}, capability: 'images.list_workflows' });
assert.match(listed.text, /二次元（默认）/u);
cases += 1;

server.close();
console.log(`comfyui plugin smoke ok: ${cases} checks`);
