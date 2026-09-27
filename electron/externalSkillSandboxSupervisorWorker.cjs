const { TextDecoder } = require('util');

const MAX_JSON_BYTES = 32 * 1024;
const MAX_JSON_DEPTH = 16;
const MAX_JSON_NODES = 2048;
const MAX_WASM_MEMORY_BYTES = 16 * 1024 * 1024;

function sendReceipt(request) {
  if (typeof process.send !== 'function') {
    process.exitCode = 1;
    return;
  }

  process.send({
    kind: 'external-skill-sandbox-supervisor-receipt.v1',
    requestId: request.requestId,
    packageCodeLoaded: false,
    permissionRequests: 0,
    status: 'ready',
  });
}

function normalizeDelay(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1000, Math.round(numeric))) : 0;
}

function assertBoundedWasmMemory(memory) {
  if (!(memory instanceof WebAssembly.Memory)) {
    throw new Error('wasm_memory_export_missing');
  }
  if (memory.buffer.byteLength > MAX_WASM_MEMORY_BYTES) {
    throw new Error('wasm_memory_limit_exceeded');
  }
  return memory;
}

function assertBoundedJsonOutput(output) {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw new Error('wasm_json_output_invalid');
  }
  let nodes = 0;
  const pending = [{ depth: 0, value: output }];
  while (pending.length) {
    const current = pending.pop();
    nodes += 1;
    if (nodes > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH) {
      throw new Error('wasm_json_output_structure_invalid');
    }
    if (!current.value || typeof current.value !== 'object') {
      continue;
    }
    const children = Array.isArray(current.value) ? current.value : Object.values(current.value);
    for (const child of children) {
      pending.push({ depth: current.depth + 1, value: child });
    }
  }
  return output;
}

function executePureJsonWasm(instance, request) {
  const memory = assertBoundedWasmMemory(instance.exports.memory);
  const inputBytes = Buffer.from(String(request.inputBase64 || ''), 'base64');
  if (!inputBytes.length || inputBytes.length > MAX_JSON_BYTES) {
    throw new Error('wasm_json_input_size_invalid');
  }
  if (inputBytes.length > memory.buffer.byteLength) {
    throw new Error('wasm_json_input_memory_exceeded');
  }
  inputBytes.copy(Buffer.from(memory.buffer), 0);
  const entrypoint = instance.exports[request.entrypoint];
  if (typeof entrypoint !== 'function') {
    throw new Error('wasm_entrypoint_missing');
  }
  const packedResult = entrypoint(0, inputBytes.length);
  if (typeof packedResult !== 'bigint') {
    throw new Error('wasm_json_result_pointer_invalid');
  }
  assertBoundedWasmMemory(memory);
  const unsignedResult = BigInt.asUintN(64, packedResult);
  const outputOffset = Number(unsignedResult >> 32n);
  const outputLength = Number(unsignedResult & 0xffffffffn);
  if (!outputLength || outputLength > MAX_JSON_BYTES) {
    throw new Error('wasm_json_output_size_invalid');
  }
  if (outputOffset + outputLength > memory.buffer.byteLength) {
    throw new Error('wasm_json_output_bounds_invalid');
  }
  const outputBytes = Buffer.from(memory.buffer, outputOffset, outputLength);
  let output;
  try {
    const outputJson = new TextDecoder('utf-8', { fatal: true }).decode(outputBytes);
    output = JSON.parse(outputJson);
  } catch {
    throw new Error('wasm_json_output_invalid');
  }
  return assertBoundedJsonOutput(output);
}

function executePureI32Wasm(instance, request) {
  const entrypoint = instance.exports[request.entrypoint];
  if (typeof entrypoint !== 'function') {
    throw new Error('wasm_entrypoint_missing');
  }
  const value = entrypoint(request.inputValue);
  if (!Number.isInteger(value)) {
    throw new Error('wasm_result_invalid');
  }
  return { value };
}

async function executePureWasm(request) {
  let packageCodeLoaded = false;
  try {
    const bytes = Buffer.from(String(request.moduleBase64 || ''), 'base64');
    const module = await WebAssembly.compile(bytes);
    if (WebAssembly.Module.imports(module).length > 0) {
      throw new Error('wasm_imports_not_allowed');
    }
    const instance = await WebAssembly.instantiate(module, {});
    packageCodeLoaded = true;
    if (!['wasm-pure-i32-v1', 'wasm-pure-json-v1'].includes(request.runtimeKind)) {
      throw new Error('wasm_runtime_kind_unsupported');
    }
    const output = request.runtimeKind === 'wasm-pure-json-v1'
      ? executePureJsonWasm(instance, request)
      : executePureI32Wasm(instance, request);
    process.send?.({
      capabilityScopes: [],
      executionKind: request.runtimeKind,
      kind: 'external-skill-sandbox-execution-receipt.v1',
      output,
      packageCodeLoaded: true,
      permissionRequests: 0,
      requestId: request.requestId,
      status: 'succeeded',
    });
  } catch (error) {
    process.send?.({
      capabilityScopes: [],
      error: error instanceof Error ? error.message : 'wasm_execution_failed',
      executionKind: request.runtimeKind,
      kind: 'external-skill-sandbox-execution-receipt.v1',
      packageCodeLoaded,
      permissionRequests: 0,
      requestId: request.requestId,
      status: 'failed',
    });
  }
}

process.on('message', (message) => {
  if (!message) {
    return;
  }
  if (message.kind === 'external-skill-sandbox-supervisor-probe.v1') {
    setTimeout(() => sendReceipt(message), normalizeDelay(message.testDelayMs));
    return;
  }
  if (message.kind === 'external-skill-sandbox-wasm-execution.v1') {
    void executePureWasm(message);
  }
});
