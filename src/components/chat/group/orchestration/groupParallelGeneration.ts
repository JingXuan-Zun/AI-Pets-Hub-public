export type GroupParallelGenerationResult<T> = {
  failedRoleIds: string[];
  results: Array<{ roleId: string; value: T }>;
};

export async function runGroupParallelGeneration<T>(options: {
  abortSignal?: AbortSignal;
  jobs: Array<{ roleId: string; run: () => Promise<T> }>;
}): Promise<GroupParallelGenerationResult<T>> {
  const settled = await Promise.allSettled(options.jobs.map((job) => job.run()));
  const results: Array<{ roleId: string; value: T }> = [];
  const failedRoleIds: string[] = [];
  settled.forEach((item, index) => {
    const roleId = options.jobs[index].roleId;
    if (item.status === 'fulfilled') results.push({ roleId, value: item.value });
    else failedRoleIds.push(roleId);
  });
  if (options.abortSignal?.aborted) return { failedRoleIds, results: [] };
  return { failedRoleIds, results };
}
