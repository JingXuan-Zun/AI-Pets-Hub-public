// ComfyUI workflows in API format (ComfyUI “Save (API)”): an object of nodes keyed by id, each
// { class_type, inputs }. From one the character needs to know where its prompt goes (the text of
// the node feeding a sampler's `positive`), where a negative prompt goes, and which seeds to
// randomise so the same prompt does not give the same picture.

export type ComfyUiInputTarget = { inputKey: string; nodeId: string };

export type ComfyUiWorkflowEntry = {
  description: string;
  id: string;
  importedAt: number;
  name: string;
  negative: ComfyUiInputTarget | null;
  positive: ComfyUiInputTarget | null;
  seeds: ComfyUiInputTarget[];
  workflow: Record<string, ComfyUiNode>;
};

type ComfyUiNode = { _meta?: { title?: string }; class_type: string; inputs: Record<string, unknown> };

const TEXT_INPUT_KEYS = ['text', 'text_g', 'prompt', 'positive', 'string'];
const SEED_INPUT_KEYS = ['seed', 'noise_seed'];
/** Written in a workflow's prompt text, the character's prompt goes there and the rest is kept. */
export const COMFY_UI_PROMPT_PLACEHOLDER = '{prompt}';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isNode(value: unknown): value is ComfyUiNode {
  return isRecord(value) && typeof value.class_type === 'string' && isRecord(value.inputs);
}

/** The node a link input ([nodeId, outputIndex]) points at. */
function linkedNodeId(value: unknown) {
  return Array.isArray(value) && (typeof value[0] === 'string' || typeof value[0] === 'number') ? String(value[0]) : null;
}

function textTarget(workflow: Record<string, ComfyUiNode>, nodeId: string | null, depth = 0): ComfyUiInputTarget | null {
  const node = nodeId ? workflow[nodeId] : undefined;
  if (!node || depth > 4) return null;
  const key = TEXT_INPUT_KEYS.find((candidate) => typeof node.inputs[candidate] === 'string');
  if (key) return { inputKey: key, nodeId: nodeId! };
  // Conditioning combiners and the like: follow their first linked input.
  for (const value of Object.values(node.inputs)) {
    const found = textTarget(workflow, linkedNodeId(value), depth + 1);
    if (found) return found;
  }
  return null;
}

export function parseComfyUiWorkflow(text: string): Record<string, ComfyUiNode> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new Error('不是有效的 JSON 文件。');
  }
  if (isRecord(value) && Array.isArray(value.nodes) && Array.isArray(value.links)) {
    throw new Error('这是 ComfyUI 的界面格式。请在 ComfyUI 里用“导出 (API)”/“Save (API)”另存一份再导入。');
  }
  if (!isRecord(value)) throw new Error('工作流应该是一个 JSON 对象。');
  const nodes = Object.entries(value).filter(([, node]) => isNode(node));
  if (!nodes.length) throw new Error('文件里没有 ComfyUI 节点（每个节点要有 class_type 和 inputs）。');
  return Object.fromEntries(nodes) as Record<string, ComfyUiNode>;
}

/** Where prompt, negative prompt and seeds are, read from the samplers. */
export function analyzeComfyUiWorkflow(workflow: Record<string, ComfyUiNode>) {
  const samplers = Object.values(workflow).filter((node) => 'positive' in node.inputs || 'negative' in node.inputs);
  let positive: ComfyUiInputTarget | null = null;
  let negative: ComfyUiInputTarget | null = null;
  for (const sampler of samplers) {
    positive ??= textTarget(workflow, linkedNodeId(sampler.inputs.positive));
    negative ??= textTarget(workflow, linkedNodeId(sampler.inputs.negative));
  }
  // No sampler wiring found (e.g. a single text-to-image node): the first text input.
  if (!positive) {
    const nodeId = Object.keys(workflow).find((id) => TEXT_INPUT_KEYS.some((key) => typeof workflow[id].inputs[key] === 'string'));
    positive = nodeId ? textTarget(workflow, nodeId) : null;
  }
  if (negative && positive && negative.nodeId === positive.nodeId) negative = null;
  const seeds = Object.entries(workflow).flatMap(([nodeId, node]) => SEED_INPUT_KEYS
    .filter((key) => typeof node.inputs[key] === 'number')
    .map((inputKey) => ({ inputKey, nodeId })));
  return { negative, positive, seeds };
}

export function describeComfyUiTarget(workflow: Record<string, ComfyUiNode>, target: ComfyUiInputTarget | null) {
  if (!target) return '未找到';
  const node = workflow[target.nodeId];
  return `${node?._meta?.title || node?.class_type || '节点'} #${target.nodeId}.${target.inputKey}`;
}

/** A copy of the workflow with the prompt filled in and fresh seeds. */
export function prepareComfyUiWorkflowRun(
  entry: ComfyUiWorkflowEntry,
  options: { negativePrompt?: string; prompt: string; random?: () => number },
) {
  if (!entry.positive) throw new Error(`工作流“${entry.name}”里找不到放提示词的位置，请在设置里指定。`);
  const workflow = JSON.parse(JSON.stringify(entry.workflow)) as Record<string, ComfyUiNode>;
  const fill = (target: ComfyUiInputTarget | null, text: string) => {
    const node = target ? workflow[target.nodeId] : undefined;
    if (!node || !target) return;
    const current = String(node.inputs[target.inputKey] ?? '');
    node.inputs[target.inputKey] = current.includes(COMFY_UI_PROMPT_PLACEHOLDER) ? current.split(COMFY_UI_PROMPT_PLACEHOLDER).join(text) : text;
  };
  fill(entry.positive, options.prompt.trim());
  if (options.negativePrompt?.trim()) fill(entry.negative, options.negativePrompt.trim());
  const random = options.random ?? Math.random;
  entry.seeds.forEach(({ inputKey, nodeId }) => {
    if (workflow[nodeId]) workflow[nodeId].inputs[inputKey] = Math.floor(random() * 2 ** 48);
  });
  return workflow;
}

export function createComfyUiWorkflowEntry(options: { description?: string; id: string; name: string; now?: number; text: string }): ComfyUiWorkflowEntry {
  const workflow = parseComfyUiWorkflow(options.text);
  const { negative, positive, seeds } = analyzeComfyUiWorkflow(workflow);
  return {
    description: options.description?.trim() ?? '',
    id: options.id,
    importedAt: options.now ?? Date.now(),
    name: options.name.trim() || '未命名工作流',
    negative,
    positive,
    seeds,
    workflow,
  };
}
