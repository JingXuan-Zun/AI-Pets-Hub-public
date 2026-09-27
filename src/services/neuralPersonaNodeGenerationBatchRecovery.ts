import {
  mapNeuralPersonaSourceBlockAnnotations,
  type NeuralPersonaNodeGenerationCandidate,
  type NeuralPersonaNodeGenerationProgress,
  type NeuralPersonaSourceBlock,
} from '../character-graph/neural-persona';

export type NeuralPersonaBlockBatchClassification = {
  candidates: NeuralPersonaNodeGenerationCandidate[];
  fallbackCandidateCount: number;
};

type Attempt =
  | { classification: NeuralPersonaBlockBatchClassification; status: 'ok' }
  | { reason: string; status: 'recoverable-failure' };

type Options = {
  batchSize: number;
  blocks: NeuralPersonaSourceBlock[];
  classifyBatch: (
    blocks: NeuralPersonaSourceBlock[],
    signal?: AbortSignal,
  ) => Promise<NeuralPersonaBlockBatchClassification | null>;
  concurrency?: number;
  onProgress?: (progress: NeuralPersonaNodeGenerationProgress) => void;
  overallTimeoutMs?: number;
  recoverableReason: (error: unknown) => string | null;
  retryBatchSize: number;
  retryRecoverable?: boolean;
  signal?: AbortSignal;
};

type TaskSignal = {
  dispose: () => void;
  signal: AbortSignal;
  timedOut: () => boolean;
};

function createTaskSignal(external?: AbortSignal, timeoutMs?: number): TaskSignal {
  const controller = new AbortController();
  let didTimeout = false;
  const abortFromExternal = () => controller.abort(external?.reason);
  if (external?.aborted) abortFromExternal();
  else external?.addEventListener('abort', abortFromExternal, { once: true });
  const timer = timeoutMs && timeoutMs > 0 ? setTimeout(() => {
    didTimeout = true;
    controller.abort(new DOMException('persona node generation overall timeout', 'TimeoutError'));
  }, timeoutMs) : undefined;
  return {
    dispose: () => {
      if (timer) clearTimeout(timer);
      external?.removeEventListener('abort', abortFromExternal);
    },
    signal: controller.signal,
    timedOut: () => didTimeout,
  };
}

function chunks(blocks: NeuralPersonaSourceBlock[], size: number) {
  const result: NeuralPersonaSourceBlock[][] = [];
  for (let index = 0; index < blocks.length; index += size) {
    result.push(blocks.slice(index, index + size));
  }
  return result;
}

async function attempt(
  options: Options, blocks: NeuralPersonaSourceBlock[], task: TaskSignal,
): Promise<Attempt> {
  if (options.signal?.aborted) throw new DOMException('cancelled', 'AbortError');
  if (task.timedOut()) {
    return { reason: 'persona-node-generation-overall-timeout', status: 'recoverable-failure' };
  }
  try {
    const classification = await options.classifyBatch(blocks, task.signal);
    return classification
      ? { classification, status: 'ok' }
      : { reason: 'persona-node-generation-json-invalid', status: 'recoverable-failure' };
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (task.timedOut()) {
      return { reason: 'persona-node-generation-overall-timeout', status: 'recoverable-failure' };
    }
    const reason = options.recoverableReason(error);
    if (!reason) throw error;
    return { reason, status: 'recoverable-failure' };
  }
}

function sourceFallback(blocks: NeuralPersonaSourceBlock[]) {
  return {
    candidates: mapNeuralPersonaSourceBlockAnnotations(blocks, []),
    fallbackCandidateCount: blocks.length,
  } satisfies NeuralPersonaBlockBatchClassification;
}

function appendReason(reasons: Record<string, number>, reason: string, count: number) {
  reasons[reason] = (reasons[reason] ?? 0) + count;
}

async function recoverBatch(options: Options, blocks: NeuralPersonaSourceBlock[], task: TaskSignal) {
  const initial = await attempt(options, blocks, task);
  if (initial.status === 'ok') return { ...initial.classification, fallbackReasons: {} };
  if (options.retryRecoverable === false
    || initial.reason === 'persona-node-generation-overall-timeout') {
    return {
      ...sourceFallback(blocks),
      fallbackReasons: { [initial.reason]: blocks.length },
    };
  }
  const retryGroups = blocks.length > options.retryBatchSize
    ? chunks(blocks, options.retryBatchSize) : [blocks];
  const candidates: NeuralPersonaNodeGenerationCandidate[] = [];
  const fallbackReasons: Record<string, number> = {};
  let fallbackCandidateCount = 0;
  for (const group of retryGroups) {
    const retried = await attempt(options, group, task);
    const classification = retried.status === 'ok' ? retried.classification : sourceFallback(group);
    candidates.push(...classification.candidates);
    fallbackCandidateCount += classification.fallbackCandidateCount;
    if (retried.status !== 'ok') appendReason(fallbackReasons, retried.reason, group.length);
  }
  return { candidates, fallbackCandidateCount, fallbackReasons };
}

function mergeResults(results: Awaited<ReturnType<typeof recoverBatch>>[]) {
  const candidates: NeuralPersonaNodeGenerationCandidate[] = [];
  const fallbackReasons: Record<string, number> = {};
  let fallbackCandidateCount = 0;
  results.forEach((result) => {
    candidates.push(...result.candidates);
    fallbackCandidateCount += result.fallbackCandidateCount;
    Object.entries(result.fallbackReasons).forEach(([reason, count]) => (
      appendReason(fallbackReasons, reason, count)
    ));
  });
  return { candidates, fallbackCandidateCount, fallbackReasons };
}

async function classifyBatches(
  options: Options, batches: NeuralPersonaSourceBlock[][], task: TaskSignal,
) {
  const results: Awaited<ReturnType<typeof recoverBatch>>[] = new Array(batches.length);
  let completedBatches = 0; let nextBatch = 0;
  options.onProgress?.({ completedBatches, totalBatches: batches.length });
  const worker = async () => {
    while (nextBatch < batches.length) {
      const index = nextBatch; nextBatch += 1;
      results[index] = await recoverBatch(options, batches[index], task);
      completedBatches += 1;
      options.onProgress?.({ completedBatches, totalBatches: batches.length });
    }
  };
  const concurrency = Math.max(1, Math.min(
    batches.length, Math.floor(options.concurrency ?? 1),
  ));
  await Promise.all(Array.from({ length: concurrency }, worker));
  return mergeResults(results);
}

export async function classifyNeuralPersonaBlockBatchesWithRecovery(options: Options) {
  const batches = chunks(options.blocks, options.batchSize);
  if (!batches.length) return {
    candidates: [], fallbackCandidateCount: 0, fallbackReasons: {},
  };
  const task = createTaskSignal(options.signal, options.overallTimeoutMs);
  try {
    return await classifyBatches(options, batches, task);
  } finally {
    task.dispose();
  }
}
