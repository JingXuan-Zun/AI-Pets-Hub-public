import { prepareComfyUiWorkflowRun, type ComfyUiWorkflowEntry } from '../comfyui/comfyUiWorkflow';
import type { PetConfig } from '../types';
import { stringArg } from './platformCapabilityArgs';
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
      description: 'The image prompt, written from the conversation: subject, appearance, pose, clothing, scene, lighting, style. English comma-separated tags work best for most models.',
      key: 'prompt',
      required: true,
      type: 'string',
    },
    { description: 'Things to avoid (optional), e.g. "lowres, bad hands, text".', key: 'negative_prompt', type: 'string' },
    { description: 'Workflow name from images.list_workflows; omitted = the default one.', key: 'workflow', type: 'string' },
  ],
  description: 'Draw a picture with the user\'s ComfyUI (“画一张小桃穿和服的图”). Turn the key points of the conversation into the prompt yourself. The picture is shown in the chat automatically; afterwards just talk about it.',
  describe: (args) => `画图：${stringArg(args, 'prompt').slice(0, 60)}`,
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
    const prompt = stringArg(args, 'prompt');
    if (!prompt) return { ok: false, text: '要画什么？' };
    const entry = resolveWorkflow(config, stringArg(args, 'workflow'));
    if (!entry) return { ok: false, text: `没有这个工作流。现有：${workflows.map((workflow) => workflow.name).join('、')}。` };
    let workflow;
    try {
      workflow = prepareComfyUiWorkflowRun(entry, { negativePrompt: stringArg(args, 'negative_prompt'), prompt });
    } catch (error) {
      return { ok: false, text: error instanceof Error ? error.message : String(error) };
    }
    const result = await bridge.run({ apiKey: config.settings.comfyUiApiKey, serverUrl, timeoutMs: timeoutSeconds * 1000, workflow });
    if (!result.ok || !result.images?.length) return { ok: false, text: `没画成：${result.error ?? '没有拿到图片'}` };
    context.presentImages?.(result.images, '');
    const seconds = Math.round((result.durationMs ?? 0) / 1000);
    return {
      ok: true,
      text: `画好了（工作流“${entry.name}”，${seconds} 秒，${result.images.length} 张），图片已经显示在聊天里。用的提示词：${prompt}`,
    };
  },
  title: '画图',
};

export const IMAGE_CAPABILITIES: PlatformCapability[] = [listWorkflows, generateImage];
