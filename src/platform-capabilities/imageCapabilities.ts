import { pickSyncedComfyUiWorkflow, prepareComfyUiWorkflowRun, type ComfyUiWorkflowEntry } from '../comfyui/comfyUiWorkflow';
import { pushFrontendRuntimeLog } from '../frontendRuntimeLogger';
import type { PetConfig } from '../types';
import { booleanArg, stringArg } from './platformCapabilityArgs';
import type { PlatformCapability } from './platformCapabilityTypes';

// The character draws with the user's own ComfyUI (local or cloud): it turns what was said into a
// prompt, fills it into an imported workflow and shows the picture in the chat. Drawing only uses
// the user's ComfyUI and changes no setting, so it runs without a confirmation card (decided
// 2026-10-11).

const GROUP = '画图';

function resolveWorkflow(config: PetConfig, wanted: string): ComfyUiWorkflowEntry | null {
  const { defaultWorkflowId, workflows } = config.settings.comfyUi;
  const target = wanted.trim().toLowerCase();
  if (!target) return workflows.find((entry) => entry.id === defaultWorkflowId) ?? workflows[0] ?? null;
  return workflows.find((entry) => entry.name.toLowerCase() === target)
    ?? workflows.find((entry) => entry.name.toLowerCase().includes(target) || target.includes(entry.name.toLowerCase()))
    ?? null;
}

function comfyBridge() {
  return typeof window === 'undefined' ? null : window.desktopPetShell?.comfyUi ?? null;
}

const listWorkflows: PlatformCapability = {
  args: [],
  description: 'List the ComfyUI drawing workflows the user imported (name, what each is for, which is the default).',
  describe: () => '查看画图工作流',
  group: GROUP,
  id: 'images.list_workflows',
  risk: 'read',
  run: ({ configRef }) => {
    const { defaultWorkflowId, serverUrl, workflows } = configRef.current.settings.comfyUi;
    if (!workflows.length) return { ok: true, text: '还没有导入画图工作流。可以在设置的“ComfyUI 工作流”页连接 ComfyUI 并导入。' };
    return {
      ok: true,
      text: [`ComfyUI：${serverUrl || '未填写地址'}`, ...workflows.map((entry) => (
        `${entry.name}${entry.id === defaultWorkflowId ? '（默认）' : ''}${entry.description ? `：${entry.description}` : ''}${entry.positive ? '' : '（未设置提示词位置，不能用）'}`
      ))].join('\n'),
    };
  },
  title: '查看画图工作流',
};

const generateImage: PlatformCapability = {
  args: [
    {
      description: 'The image prompt, written from the conversation: subject, appearance, pose, clothing, scene, lighting, style. English comma-separated tags work best for most models. Not needed with as_set.',
      key: 'prompt',
      type: 'string',
    },
    {
      description: 'true when the user just wants a picture without saying what (“随便画一张”“随机来一张”): the workflow draws with its own settings in ComfyUI (random tags and so on) and no prompt from you. You do not know what it will show, so do not describe it before you see it.',
      key: 'as_set',
      type: 'boolean',
    },
    { description: 'Things to avoid (optional), e.g. "lowres, bad hands, text".', key: 'negative_prompt', type: 'string' },
    { description: 'Workflow name from images.list_workflows; omitted = the default one.', key: 'workflow', type: 'string' },
  ],
  description: 'Draw a picture with the user\'s ComfyUI (“画一张小桃穿和服的图”). Turn the key points of the conversation into the prompt yourself. Drawing takes one to several minutes and runs in the background: this returns at once, you keep chatting, and when the picture is ready it is shown and you are told, so you can say it. In the same reply, say one short line in your own voice that you are drawing it and it will take a little while. One drawing at a time; to change what is being drawn, cancel it first (background task tool).',
  describe: (args) => (booleanArg(args, 'as_set') && !stringArg(args, 'prompt') ? '画图：按 ComfyUI 里的设置随便画' : `画图：${stringArg(args, 'prompt').slice(0, 60)}`),
  group: GROUP,
  id: 'images.generate',
  risk: 'personal',
  run: async (context, args) => {
    const config = context.configRef.current;
    const bridge = comfyBridge();
    if (!bridge) return { ok: false, text: '画图只能在桌面版里用。' };
    const { serverUrl, timeoutSeconds, workflows } = config.settings.comfyUi;
    if (!serverUrl.trim()) return { ok: false, text: '还没有填 ComfyUI 地址，请在设置的“ComfyUI 工作流”页填写。' };
    if (!workflows.length) return { ok: false, text: '还没有导入画图工作流，请在设置的“ComfyUI 工作流”页导入（ComfyUI 里用 Save (API) 导出的 JSON）。' };
    const asSet = booleanArg(args, 'as_set') === true;
    const prompt = asSet ? '' : stringArg(args, 'prompt');
    if (!prompt && !asSet) return { ok: false, text: '要画什么？（只是随便画一张就用 as_set）' };
    const imported = resolveWorkflow(config, stringArg(args, 'workflow'));
    if (!imported) return { ok: false, text: `没有这个工作流。现有：${workflows.map((workflow) => workflow.name).join('、')}。` };
    // With our ComfyUI extension installed, what is on the ComfyUI canvas now (changed settings
    // included) is used instead of the copy imported earlier.
    const synced = await bridge.readSynced?.({ apiKey: config.settings.comfyUiApiKey, names: [imported.sourceName ?? '', imported.name], serverUrl })
      .catch(() => null);
    const entry = (synced?.ok && pickSyncedComfyUiWorkflow(imported, synced.copies)) || imported;
    pushFrontendRuntimeLog('comfyui', entry === imported ? 'drawing with the imported workflow' : 'drawing with the workflow synced from ComfyUI', { workflow: imported.name });
    let workflow;
    try {
      workflow = prepareComfyUiWorkflowRun(entry, { negativePrompt: asSet ? '' : stringArg(args, 'negative_prompt'), prompt });
    } catch (error) {
      return { ok: false, text: error instanceof Error ? error.message : String(error) };
    }
    const ready = workflow;
    const draw = async (signal?: AbortSignal) => {
      const runId = `draw-${Date.now().toString(36)}`;
      // Cancelling takes it out of ComfyUI's queue, or interrupts it if it is being drawn.
      signal?.addEventListener('abort', () => { void bridge.cancel?.(runId); }, { once: true });
      const result = await bridge.run({ apiKey: config.settings.comfyUiApiKey, runId, serverUrl, timeoutMs: timeoutSeconds * 1000, workflow: ready });
      if (!result.ok || !result.images?.length) return { ok: false, text: `没画成：${result.error ?? '没有拿到图片'}` };
      const seconds = Math.round((result.durationMs ?? 0) / 1000);
      return {
        images: result.images,
        ok: true,
        text: `画好了（工作流“${entry.name}”，${seconds} 秒，${result.images.length} 张），图片已经显示在聊天里。${prompt ? `用的提示词：${prompt}` : '按 ComfyUI 里的设置画的，画面是工作流自己定的，你还没看到。'}`,
      };
    };
    // In a chat it runs in the background: she keeps talking, the picture comes when it is ready.
    if (context.runInBackground) {
      return context.runInBackground({ kind: 'drawing', run: draw, title: `画图：${prompt ? prompt.slice(0, 40) : '按 ComfyUI 里的设置随便画'}` });
    }
    const drawn = await draw();
    if (drawn.images) context.presentImages?.(drawn.images, '');
    return { ok: drawn.ok, text: drawn.text };
  },
  title: '画图',
};

export const IMAGE_CAPABILITIES: PlatformCapability[] = [listWorkflows, generateImage];
