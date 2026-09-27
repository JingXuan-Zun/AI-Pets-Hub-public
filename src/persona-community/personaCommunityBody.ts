export async function readPersonaBody(response: Response, limit: number, timeoutMs = 20000): Promise<Uint8Array> {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel();
    throw new Error('response-size');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('response-empty');
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timeout: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('response-timeout')), timeoutMs); });
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline]);
      if (done) break;
      length += value.length;
      if (length > limit) throw new Error('response-size');
      chunks.push(value);
    }
  } catch (error) {
    // Cleanup failures must not replace the original transport error.
    void reader.cancel().catch(() => {});
    throw error;
  } finally { clearTimeout(timeout!); reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return bytes;
}
