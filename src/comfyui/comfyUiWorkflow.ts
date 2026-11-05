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
  /** The exported file's name, which is the workflow's name in ComfyUI (for the synced copy). */
  sourceName?: string;
  workflow: Record<string, ComfyUiNode>;
};

type ComfyUiNode = { _meta?: { title?: string }; class_type: string; inputs: Record<string, unknown> };

// `value` is a text primitive (PrimitiveStringMultiline) feeding a concatenation.
const TEXT_INPUT_KEYS = ['text', 'text_g', 'prompt', 'positive', 'string', 'value'];
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

// A text box named like this is where the subject goes; boxes named like the second hold quality
// tags, artists, styles or tag filters, which the character's prompt must not replace.
const SUBJECT_TITLE = /^(?:内容|主体|描述|画面|提示词|正面|正面提示词|prompt|positive(?: prompt)?|content|subject|description)$/iu;
const SIDE_TITLE = /质量|画质|画师|风格|负面|反向|过滤|排除|quality|artist|style|lora|negative|exclude|filter/iu;
const MAX_LINK_DEPTH = 8;

function nodeTitle(node: ComfyUiNode) {
  return (node._meta?.title ?? '').trim();
}

/** Every text box reachable upstream of a node (through concatenations, switches…), nearest first. */
function upstreamTextInputs(workflow: Record<string, ComfyUiNode>, startId: string | null) {
  const found: ComfyUiInputTarget[] = [];
  const seen = new Set<string>();
  let layer = startId ? [startId] : [];
  for (let depth = 0; layer.length && depth <= MAX_LINK_DEPTH; depth += 1) {
    const next: string[] = [];
    for (const nodeId of layer) {
      const node = workflow[nodeId];
      if (!node || seen.has(nodeId)) continue;
      seen.add(nodeId);
      const key = TEXT_INPUT_KEYS.find((candidate) => typeof node.inputs[candidate] === 'string');
      if (key) found.push({ inputKey: key, nodeId });
      Object.values(node.inputs).forEach((value) => {
        const linked = linkedNodeId(value);
        if (linked) next.push(linked);
      });
    }
    layer = next;
  }
  return found;
}

/**
 * Where the prompt goes among the text boxes feeding a sampler input: one holding {prompt}, else
 * one titled like "内容"/"prompt", else the only one, else the nearest that is not quality tags.
 */
function textTarget(workflow: Record<string, ComfyUiNode>, nodeId: string | null): ComfyUiInputTarget | null {
  const candidates = upstreamTextInputs(workflow, nodeId);
  const text = (target: ComfyUiInputTarget) => String(workflow[target.nodeId].inputs[target.inputKey]);
  const title = (target: ComfyUiInputTarget) => nodeTitle(workflow[target.nodeId]);
  const marked = candidates.filter((target) => text(target).includes(COMFY_UI_PROMPT_PLACEHOLDER));
  return marked.find((target) => SUBJECT_TITLE.test(title(target)))
    ?? marked[0]
    ?? candidates.find((target) => SUBJECT_TITLE.test(title(target)))
    ?? (candidates.length === 1 ? candidates[0] : null)
    ?? candidates.find((target) => !SIDE_TITLE.test(title(target)))
    ?? candidates[0]
    ?? null;
}

/** All text boxes in the workflow, for choosing the prompt's place by hand. */
export function listComfyUiTextInputs(workflow: Record<string, ComfyUiNode>): ComfyUiInputTarget[] {
  return Object.entries(workflow).flatMap(([nodeId, node]) => TEXT_INPUT_KEYS
    .filter((key) => typeof node.inputs[key] === 'string')
    .map((inputKey) => ({ inputKey, nodeId })));
}

/** The link hops from a node up to the target node, as [nodeId, inputKey] pairs; null if unconnected. */
function linkPath(workflow: Record<string, ComfyUiNode>, fromId: string, targetId: string, depth = 0, seen = new Set<string>()): Array<[string, string]> | null {
  if (fromId === targetId) return [];
  const node = workflow[fromId];
  if (!node || depth > MAX_LINK_DEPTH || seen.has(fromId)) return null;
  seen.add(fromId);
  for (const [inputKey, value] of Object.entries(node.inputs)) {
    const linked = linkedNodeId(value);
    const rest = linked ? linkPath(workflow, linked, targetId, depth + 1, seen) : null;
    if (rest) return [[fromId, inputKey], ...rest];
  }
  return null;
}

/**
 * Turns the switches between the samplers and a text box so that box is used (e.g. a "随机提示词"
 * switch that would otherwise pick random tags). A switch set by a shared boolean node flips that node.
 */
function activatePathTo(workflow: Record<string, ComfyUiNode>, target: ComfyUiInputTarget, side: 'negative' | 'positive') {
  for (const sampler of Object.values(workflow)) {
    // Only along its own side: the negative box can also feed the positive side (a random-tag
    // node excluding negative tags), and following that would turn its switches back.
    const start = linkedNodeId(sampler.inputs[side]);
    const path = start ? linkPath(workflow, start, target.nodeId) : null;
    path?.forEach(([nodeId, inputKey]) => {
      const node = workflow[nodeId];
      if ((inputKey !== 'on_true' && inputKey !== 'on_false') || !('switch' in node.inputs)) return;
      const wanted = inputKey === 'on_true';
      const control = linkedNodeId(node.inputs.switch);
      if (typeof node.inputs.switch === 'boolean') node.inputs.switch = wanted;
      else if (control && typeof workflow[control]?.inputs.value === 'boolean') workflow[control].inputs.value = wanted;
    });
  }
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
  if (!positive) positive = listComfyUiTextInputs(workflow)[0] ?? null;
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

/**
 * A copy of the workflow with the prompt filled in and fresh seeds. Without a prompt (“随便画一张”)
 * the workflow runs as set in ComfyUI: its own text, its own switches (random tags…), new seeds.
 */
export function prepareComfyUiWorkflowRun(
  entry: ComfyUiWorkflowEntry,
  options: { negativePrompt?: string; prompt: string; random?: () => number },
) {
  const asSet = !options.prompt.trim();
  if (!entry.positive && !asSet) throw new Error(`工作流“${entry.name}”里找不到放提示词的位置，请在设置里指定。`);
  const workflow = JSON.parse(JSON.stringify(entry.workflow)) as Record<string, ComfyUiNode>;
  // The prompt replaces its box; a negative prompt is added after the user's own negative tags.
  const fill = (target: ComfyUiInputTarget | null, text: string, keep = false) => {
    const node = target ? workflow[target.nodeId] : undefined;
    if (!node || !target) return;
    const current = String(node.inputs[target.inputKey] ?? '');
    node.inputs[target.inputKey] = current.includes(COMFY_UI_PROMPT_PLACEHOLDER) ? current.split(COMFY_UI_PROMPT_PLACEHOLDER).join(text)
      : keep && current.trim() ? `${current.trim().replace(/,\s*$/u, '')}, ${text}` : text;
  };
  if (!asSet && entry.positive) {
    fill(entry.positive, options.prompt.trim());
    activatePathTo(workflow, entry.positive, 'positive');
  }
  if (!asSet && options.negativePrompt?.trim() && entry.negative) {
    fill(entry.negative, options.negativePrompt.trim(), true);
    activatePathTo(workflow, entry.negative, 'negative');
  }
  // A {prompt} left in another box would reach ComfyUI as those very letters.
  Object.values(workflow).forEach((node) => Object.entries(node.inputs).forEach(([key, value]) => {
    if (typeof value === 'string' && value.includes(COMFY_UI_PROMPT_PLACEHOLDER)) {
      node.inputs[key] = value.split(COMFY_UI_PROMPT_PLACEHOLDER).join('').replace(/\s*,\s*(?=,|$)/gu, '').replace(/^\s*,\s*/u, '').trim();
    }
  }));
  const random = options.random ?? Math.random;
  entry.seeds.forEach(({ inputKey, nodeId }) => {
    if (workflow[nodeId]) workflow[nodeId].inputs[inputKey] = Math.floor(random() * 2 ** 48);
  });
  return workflow;
}

/** A target picked earlier stays if the new workflow still has that text box. */
export function keepComfyUiTarget(old: ComfyUiInputTarget | null, workflow: Record<string, ComfyUiNode>, found: ComfyUiInputTarget | null) {
  return old && typeof workflow[old.nodeId]?.inputs[old.inputKey] === 'string' ? old : found;
}

/** Share of the saved workflow's nodes that are still there, as the same kind of node. */
function overlap(saved: Record<string, ComfyUiNode>, other: Record<string, ComfyUiNode>) {
  const ids = Object.keys(saved);
  return ids.length ? ids.filter((id) => other[id]?.class_type === saved[id].class_type).length / ids.length : 0;
}

export type ComfyUiSyncedCopy = { file: string; name: string; prompt: Record<string, unknown>; savedAt: number };

/**
 * The workflow as it is now on the ComfyUI canvas (kept by our ComfyUI extension), in place of
 * the imported copy: the copy saved under this workflow's name, or the open canvas when it is
 * clearly the same workflow. Prompt boxes picked by hand stay. Null = draw with the imported copy.
 */
export function pickSyncedComfyUiWorkflow(entry: ComfyUiWorkflowEntry, copies: ComfyUiSyncedCopy[]): ComfyUiWorkflowEntry | null {
  const names = new Set([entry.sourceName, entry.name].filter(Boolean).map((name) => name!.trim()));
  const usable = copies
    .map((copy) => ({ copy, workflow: Object.fromEntries(Object.entries(copy.prompt).filter(([, node]) => isNode(node))) as Record<string, ComfyUiNode> }))
    .filter(({ workflow }) => Object.keys(workflow).length);
  const byName = usable.find(({ copy }) => copy.file !== '_current' && names.has(copy.file));
  const current = usable.find(({ copy, workflow }) => copy.file === '_current' && (names.has(copy.name) || overlap(entry.workflow, workflow) >= 0.8));
  const chosen = [byName, current].filter(Boolean).sort((a, b) => b!.copy.savedAt - a!.copy.savedAt)[0];
  if (!chosen) return null;
  const found = analyzeComfyUiWorkflow(chosen.workflow);
  return {
    ...entry,
    negative: keepComfyUiTarget(entry.negative, chosen.workflow, found.negative),
    positive: keepComfyUiTarget(entry.positive, chosen.workflow, found.positive),
    seeds: found.seeds,
    workflow: chosen.workflow,
  };
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
    sourceName: options.name.trim(),
    workflow,
  };
}
