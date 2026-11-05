import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// Drawing in the background: the tool returns at once, she can keep chatting, a second drawing
// is refused while one runs, “不画了” stops it (and ComfyUI drops it), and the picture plus her
// line come when it is done.

const require = createRequire(import.meta.url);
let cases = 0;
const check = (actual: unknown, expected: unknown, label: string) => { assert.deepEqual(actual, expected, label); cases += 1; };
const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

const { cancelBackgroundTasks, describeBackgroundTasksForPrompt, listBackgroundTasks, startBackgroundTask } = await import('../src/agent/background/backgroundTasks');
const { subscribeAppEvents } = await import('../src/events/appEvents');
const events: string[] = [];
subscribeAppEvents((event) => events.push(event.type === 'task.ended' ? `${event.type}:${event.status}` : event.type));

// The store: one job of a kind at a time, events, her prompt line.
let finishJob: (value: { ok: boolean; text: string }) => void = () => {};
const ended: string[] = [];
const first = startBackgroundTask({
  kind: 'drawing',
  onEnd: ({ status, text }) => { ended.push(`${status}:${text}`); },
  petId: 'primary',
  run: () => new Promise((resolve) => { finishJob = resolve; }),
  title: '画图：海边的小桃',
});
check([first.ok, listBackgroundTasks().length, events], [true, 1, ['task.started']], 'started, listed, announced');
assert.match(describeBackgroundTasksForPrompt(), /你正在后台做的事[\s\S]*画图：海边的小桃/u);
cases += 1;
const second = startBackgroundTask({ kind: 'drawing', onEnd: () => {}, petId: 'primary', run: async () => ({ ok: true, text: '' }), title: '画图：猫' });
check(['busy' in second && second.busy.title, listBackgroundTasks().length], ['画图：海边的小桃', 1], 'a second drawing is refused while one runs');
finishJob({ ok: true, text: '画好了' });
await tick();
check([ended, listBackgroundTasks().length, events.at(-1), describeBackgroundTasksForPrompt()], [['done:画好了'], 0, 'task.ended:done', ''], 'done: onEnd once, gone from the list and the prompt');

// Cancel ends it at once, even before the job notices.
const neverEnds = startBackgroundTask({ kind: 'drawing', onEnd: ({ status }) => { ended.push(status); }, petId: null, run: () => new Promise(() => {}), title: '画图：慢' });
check(neverEnds.ok, true, 'started again after the first ended');
check(cancelBackgroundTasks({ kind: 'drawing' }), ['画图：慢'], 'cancel returns what was stopped');
await tick();
check([ended.at(-1), listBackgroundTasks().length, events.at(-1)], ['cancelled', 0, 'task.ended:cancelled'], 'cancelled at once');

// The drawing tool with a chat that runs it in the background.
const runs: Array<{ resolve: (value: unknown) => void; runId: string }> = [];
const cancelledRuns: string[] = [];
(globalThis as unknown as { window: unknown }).window = {
  desktopPetShell: {
    comfyUi: {
      cancel: async (runId: string) => { cancelledRuns.push(runId); return { ok: true }; },
      run: (request: { runId: string }) => new Promise((resolve) => { runs.push({ resolve, runId: request.runId }); }),
    },
  },
};
const { runPlatformCapability } = await import('../src/platform-capabilities/platformCapabilityRegistry');
const workflow = { 3: { class_type: 'KSampler', inputs: { positive: ['6', 0], seed: 1 } }, 6: { class_type: 'CLIPTextEncode', inputs: { text: 'x' } }, 9: { class_type: 'SaveImage', inputs: {} } };
const config = {
  settings: {
    comfyUi: { defaultWorkflowId: 'w', serverUrl: 'http://127.0.0.1:1', timeoutSeconds: 60, workflows: [{ description: '', id: 'w', importedAt: 0, name: '二次元', negative: null, positive: { inputKey: 'text', nodeId: '6' }, seeds: [], workflow }] },
    comfyUiApiKey: '',
  },
};
const shown: unknown[] = [];
const herLines: string[] = [];
const context = {
  configRef: { current: config },
  onUpdateConfig: () => {},
  // What the chat does (conversationChatRuntime): start it, show pictures and speak when it ends.
  runInBackground: (job: { kind: string; run: (signal: AbortSignal) => Promise<{ images?: unknown[]; ok: boolean; text: string }>; title: string }) => {
    let images: unknown[] | undefined;
    const started = startBackgroundTask({
      kind: job.kind,
      onEnd: ({ ok, status, text }) => { if (status === 'cancelled') return; if (ok && images) shown.push(...images); herLines.push(text); },
      petId: 'primary',
      run: async (signal) => { const result = await job.run(signal); images = result.images; return result; },
      title: job.title,
    });
    return 'busy' in started ? { ok: false, text: `还在做上一件：${started.busy.title}` } : { ok: true, text: `已经在后台开始了：${job.title}` };
  },
};
const call = (prompt: string) => runPlatformCapability(context as never, { args: { prompt }, capability: 'images.generate' });
const started = await call('cat on a desk');
check([started.ok, started.text, runs.length, shown.length], [true, '已经在后台开始了：画图：cat on a desk', 1, 0], 'the tool returns at once while ComfyUI draws');
check((await call('dog')).text, '还在做上一件：画图：cat on a desk', 'a second drawing is refused');
runs[0].resolve({ durationMs: 90_000, images: [{ dataUrl: 'data:image/png;base64,AA', mimeType: 'image/png', name: 'a.png', sizeBytes: 1 }], ok: true });
await tick(10);
check([shown.length, herLines.length, /画好了/u.test(herLines[0] ?? '')], [1, 1, true], 'when ComfyUI is done the picture is shown and she is told');
await call('slow one');
check((await runPlatformCapability(context as never, { args: { which: '画' }, capability: 'tasks.background_cancel' })).text, '已经停掉：画图：slow one。', '“不画了” stops the drawing');
await tick();
check([cancelledRuns, herLines.length], [[runs[1].runId], 1], 'ComfyUI is told to drop it; she says nothing more about it');
check((await runPlatformCapability(context as never, { args: {}, capability: 'tasks.background_status' })).text, '后台没有在做的事。', 'nothing left running');

// ComfyUI side: a cancelled run is taken out of the queue if waiting, interrupted if drawing.
const { createComfyUiService } = require('../electron/comfyUiService.cjs') as { createComfyUiService: (options: object) => { cancelRun: (request: object) => Promise<{ ok: boolean }>; runWorkflow: (request: object) => Promise<{ error?: string; ok: boolean }> } };
const posted: string[] = [];
let queueState: 'pending' | 'running' = 'pending';
const fakeFetch = async (url: string, init: { body?: string; method?: string; signal?: AbortSignal } = {}) => {
  const path = new URL(url).pathname;
  const json = (body: unknown) => ({ json: async () => body, ok: true, status: 200, text: async () => '' });
  if (path === '/prompt') return json({ prompt_id: 'p9' });
  if (path === '/queue' && init.method === 'POST') { posted.push(`queue ${init.body}`); return json({}); }
  if (path === '/queue') return json(queueState === 'pending' ? { queue_pending: [[0, 'p9', {}]], queue_running: [] } : { queue_pending: [], queue_running: [[0, 'p9', {}]] });
  if (path === '/interrupt') { posted.push('interrupt'); return json({}); }
  if (init.signal?.aborted) throw new Error('aborted');
  return json({});
};
const service = createComfyUiService({ fetchImpl: fakeFetch });
for (const state of ['pending', 'running'] as const) {
  queueState = state;
  const waiting = service.runWorkflow({ runId: `r-${state}`, serverUrl: 'http://127.0.0.1:1', timeoutMs: 60_000, workflow: { 1: {} } });
  await tick(50);
  check((await service.cancelRun({ runId: `r-${state}` })).ok, true, `cancel while ${state}`);
  check((await waiting).error, '已取消', `the waiting run ends as cancelled (${state})`);
}
check(posted, ['queue {"delete":["p9"]}', 'interrupt'], 'waiting: deleted from the queue; drawing: interrupted');

console.log(`background task smoke ok: ${cases} checks`);
process.exit(0);
