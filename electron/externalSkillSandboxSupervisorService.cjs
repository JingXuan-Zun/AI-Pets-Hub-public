const { fork } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_TIMEOUT_MS = 15000;
const REQUEST_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,119}$/u;
const PACKAGE_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._:@-]{0,159}$/u;
const ENTRYPOINT_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/u;
const MAX_WASM_BYTES = 64 * 1024;
const MAX_JSON_BYTES = 32 * 1024;
const MAX_JSON_DEPTH = 16;
const MAX_JSON_NODES = 2048;

function normalizeId(value, name, pattern) {
  const normalized = typeof value === 'string' ? value.trim() : '';
  if (!pattern.test(normalized)) {
    throw new Error(`invalid_${name}`);
  }
  return normalized;
}

function normalizeTimeoutMs(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return DEFAULT_TIMEOUT_MS;
  }
  return Math.max(500, Math.min(MAX_TIMEOUT_MS, Math.round(numeric)));
}

function normalizeRequestedPermissionScopes(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
    : [];
}

function createSandboxEnvironment(source = process.env) {
  const keys = ['ComSpec', 'PATH', 'SystemRoot', 'TEMP', 'TMP', 'WINDIR'];
  return keys.reduce((environment, key) => {
    if (typeof source[key] === 'string' && source[key].trim()) {
      environment[key] = source[key];
    }
    return environment;
  }, {});
}

function redactError(error) {
  const message = error instanceof Error ? error.message : String(error || 'unknown_error');
  return message.replace(/[A-Za-z]:\\[^\s]+/gu, '<redacted-path>').slice(0, 240);
}

function removeTemporaryDirectory(directory) {
  if (!directory) {
    return;
  }
  try {
    fs.rmSync(directory, { force: true, recursive: true });
  } catch {
    // Best effort cleanup must not obscure the probe result.
  }
}

function createResult(request, status, startedAt, extras = {}) {
  return {
    durationMs: Date.now() - startedAt,
    kind: 'external-skill-sandbox-supervisor-probe-result.v1',
    packageCodeLoaded: false,
    packageId: request.packageId,
    permissionRequests: 0,
    requestId: request.requestId,
    status,
    ...extras,
  };
}

function normalizeBoundedJsonValue(value, state, depth) {
  state.nodes += 1;
  if (state.nodes > MAX_JSON_NODES || depth > MAX_JSON_DEPTH) {
    throw new Error('external_wasm_json_input_size_invalid');
  }
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    state.sourceBytes += Buffer.byteLength(value, 'utf8');
    if (state.sourceBytes > MAX_JSON_BYTES) {
      throw new Error('external_wasm_json_input_size_invalid');
    }
    return value;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('external_wasm_json_input_invalid');
    }
    return value;
  }
  if (!value || typeof value !== 'object' || state.seen.has(value)) {
    throw new Error('external_wasm_json_input_invalid');
  }
  state.seen.add(value);
  let normalized;
  if (Array.isArray(value)) {
    if (value.length > MAX_JSON_NODES) {
      throw new Error('external_wasm_json_input_size_invalid');
    }
    normalized = value.map((item) => normalizeBoundedJsonValue(item, state, depth + 1));
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error('external_wasm_json_input_invalid');
    }
    normalized = Object.create(null);
    for (const [key, item] of Object.entries(value)) {
      state.sourceBytes += Buffer.byteLength(key, 'utf8');
      if (state.sourceBytes > MAX_JSON_BYTES) {
        throw new Error('external_wasm_json_input_size_invalid');
      }
      normalized[key] = normalizeBoundedJsonValue(item, state, depth + 1);
    }
  }
  state.seen.delete(value);
  return normalized;
}

function normalizeJsonObjectInput(rawInput) {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    throw new Error('external_wasm_json_input_invalid');
  }
  const normalizedInput = normalizeBoundedJsonValue(rawInput, {
    nodes: 0,
    seen: new WeakSet(),
    sourceBytes: 0,
  }, 0);
  let inputJson;
  try {
    inputJson = JSON.stringify(normalizedInput);
  } catch {
    throw new Error('external_wasm_json_input_invalid');
  }
  if (!inputJson || Buffer.byteLength(inputJson, 'utf8') > MAX_JSON_BYTES) {
    throw new Error('external_wasm_json_input_size_invalid');
  }
  return Buffer.from(inputJson, 'utf8').toString('base64');
}

function normalizePureWasmExecution(rawPackageJson, rawInput, executionPhase) {
  const packageValue = JSON.parse(rawPackageJson);
  const runtime = packageValue?.runtime;
  if (!runtime || !['wasm-pure-i32-v1', 'wasm-pure-json-v1'].includes(runtime.kind)) {
    throw new Error('external_runtime_kind_unsupported');
  }
  const primaryEntrypoint = typeof runtime.entrypoint === 'string' ? runtime.entrypoint.trim() : '';
  const capabilityEntrypoint = typeof runtime.capabilityEntrypoint === 'string'
    ? runtime.capabilityEntrypoint.trim()
    : '';
  if (!['primary', 'capability-response'].includes(executionPhase)) {
    throw new Error('external_wasm_execution_phase_invalid');
  }
  const entrypoint = executionPhase === 'capability-response' ? capabilityEntrypoint : primaryEntrypoint;
  const moduleBase64 = typeof runtime.moduleBase64 === 'string' ? runtime.moduleBase64.trim() : '';
  if (!ENTRYPOINT_PATTERN.test(entrypoint) || !moduleBase64) {
    throw new Error(executionPhase === 'capability-response'
      ? 'external_wasm_capability_entrypoint_missing'
      : 'external_wasm_runtime_invalid');
  }
  const moduleBytes = Buffer.from(moduleBase64, 'base64');
  if (!moduleBytes.length || moduleBytes.length > MAX_WASM_BYTES) {
    throw new Error('external_wasm_module_size_invalid');
  }
  if (runtime.kind === 'wasm-pure-json-v1') {
    return {
      entrypoint,
      inputBase64: normalizeJsonObjectInput(rawInput),
      moduleBase64,
      runtimeKind: runtime.kind,
    };
  }
  const inputValue = Number(rawInput?.value);
  if (!Number.isInteger(inputValue) || inputValue < -2147483648 || inputValue > 2147483647) {
    throw new Error('external_wasm_input_invalid');
  }
  return { entrypoint, inputValue, moduleBase64, runtimeKind: runtime.kind };
}

function createExternalSkillSandboxSupervisorService({
  artifactStore,
  log,
  workerPath = path.join(__dirname, 'externalSkillSandboxSupervisorWorker.cjs'),
} = {}) {
  const activeRequests = new Map();

  function finishRequest(requestId, result) {
    const active = activeRequests.get(requestId);
    if (!active || active.finished) {
      return;
    }
    active.finished = true;
    clearTimeout(active.timeout);
    activeRequests.delete(requestId);
    removeTemporaryDirectory(active.cwd);
    active.resolve(result);
  }

  function cancelProbe(requestId) {
    const active = activeRequests.get(String(requestId || '').trim());
    if (!active) {
      return { cancelled: false, requestId: String(requestId || '').trim() };
    }
    active.child.kill();
    finishRequest(active.requestId, createResult(active.request, 'cancelled', active.startedAt));
    return { cancelled: true, requestId: active.requestId };
  }

  function createChild(request, cwd, testDelayMs) {
    return fork(workerPath, [], {
      cwd,
      env: createSandboxEnvironment(),
      execArgv: ['--max-old-space-size=64', '--wasm-max-mem-pages=256'],
      silent: true,
      serialization: 'json',
      windowsHide: true,
    });
  }

  function runBootstrapProbe(rawRequest = {}) {
    const request = {
      bootstrapPlanId: normalizeId(rawRequest.bootstrapPlanId, 'bootstrap_plan_id', REQUEST_ID_PATTERN),
      packageId: normalizeId(rawRequest.packageId, 'package_id', PACKAGE_ID_PATTERN),
      requestId: normalizeId(rawRequest.requestId, 'request_id', REQUEST_ID_PATTERN),
    };
    if (activeRequests.has(request.requestId)) {
      return Promise.resolve(createResult(request, 'rejected', Date.now(), { error: 'duplicate_request_id' }));
    }
    const requestedPermissionScopes = normalizeRequestedPermissionScopes(rawRequest.permissionScopes);
    if (requestedPermissionScopes.length) {
      return Promise.resolve(createResult(request, 'rejected', Date.now(), {
        error: 'external_permission_not_granted',
        requestedPermissionScopes,
      }));
    }

    const startedAt = Date.now();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-skill-sandbox-'));
    const timeoutMs = normalizeTimeoutMs(rawRequest.timeoutMs);
    const testDelayMs = Number.isFinite(Number(rawRequest.testDelayMs)) ? Number(rawRequest.testDelayMs) : 0;
    log?.('external Skill sandbox supervisor probe started', { packageId: request.packageId, requestId: request.requestId });

    return new Promise((resolve) => {
      let child;
      try {
        child = createChild(request, cwd, testDelayMs);
      } catch (error) {
        removeTemporaryDirectory(cwd);
        resolve(createResult(request, 'failed', startedAt, { error: redactError(error) }));
        return;
      }

      const active = { child, cwd, finished: false, request, requestId: request.requestId, resolve, startedAt, timeout: null };
      activeRequests.set(request.requestId, active);
      active.timeout = setTimeout(() => {
        child.kill();
        finishRequest(request.requestId, createResult(request, 'timed-out', startedAt));
      }, timeoutMs);
      child.once('error', (error) => finishRequest(request.requestId, createResult(request, 'failed', startedAt, { error: redactError(error) })));
      child.on('message', (message) => {
        if (message?.kind !== 'external-skill-sandbox-supervisor-receipt.v1' || message.requestId !== request.requestId) {
          return;
        }
        child.kill();
        finishRequest(request.requestId, createResult(request, 'succeeded', startedAt, { workerReceipt: message }));
      });
      child.once('exit', (code) => {
        if (activeRequests.has(request.requestId)) {
          finishRequest(request.requestId, createResult(request, 'failed', startedAt, { error: `worker_exit_${code ?? 'unknown'}` }));
        }
      });
      child.send({ kind: 'external-skill-sandbox-supervisor-probe.v1', requestId: request.requestId, testDelayMs });
    });
  }

  function runPackageExecution(rawRequest = {}) {
    const request = {
      packageId: normalizeId(rawRequest.packageId, 'package_id', PACKAGE_ID_PATTERN),
      requestId: normalizeId(rawRequest.requestId, 'request_id', REQUEST_ID_PATTERN),
    };
    if (activeRequests.has(request.requestId)) {
      return Promise.resolve(createResult(request, 'rejected', Date.now(), { error: 'duplicate_request_id' }));
    }
    const requestedPermissionScopes = normalizeRequestedPermissionScopes(rawRequest.permissionScopes);
    if (requestedPermissionScopes.length) {
      return Promise.resolve(createResult(request, 'rejected', Date.now(), {
        error: 'external_permission_not_granted',
        requestedPermissionScopes,
      }));
    }
    if (!artifactStore || typeof artifactStore.readPackageArtifact !== 'function') {
      return Promise.resolve(createResult(request, 'rejected', Date.now(), { error: 'artifact_store_unavailable' }));
    }
    const artifactResult = artifactStore.readPackageArtifact(request.packageId);
    if (!artifactResult.ok) {
      return Promise.resolve(createResult(request, 'rejected', Date.now(), { error: artifactResult.error }));
    }

    let execution;
    try {
      execution = normalizePureWasmExecution(
        artifactResult.rawPackageJson,
        rawRequest.input,
        rawRequest.executionPhase === 'capability-response' ? 'capability-response' : 'primary',
      );
    } catch (error) {
      return Promise.resolve(createResult(request, 'rejected', Date.now(), { error: redactError(error) }));
    }

    const startedAt = Date.now();
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-pet-skill-sandbox-'));
    const timeoutMs = normalizeTimeoutMs(rawRequest.timeoutMs);
    return new Promise((resolve) => {
      let child;
      try {
        child = createChild(request, cwd, 0);
      } catch (error) {
        removeTemporaryDirectory(cwd);
        resolve(createResult(request, 'failed', startedAt, { error: redactError(error) }));
        return;
      }
      const active = { child, cwd, finished: false, request, requestId: request.requestId, resolve, startedAt, timeout: null };
      activeRequests.set(request.requestId, active);
      active.timeout = setTimeout(() => {
        child.kill();
        finishRequest(request.requestId, createResult(request, 'timed-out', startedAt));
      }, timeoutMs);
      child.once('error', (error) => finishRequest(request.requestId, createResult(request, 'failed', startedAt, { error: redactError(error) })));
      child.on('message', (message) => {
        if (message?.kind !== 'external-skill-sandbox-execution-receipt.v1' || message.requestId !== request.requestId) {
          return;
        }
        child.kill();
        finishRequest(request.requestId, createResult(request, message.status, startedAt, {
          capabilityScopes: [],
          error: message.error,
          executionKind: message.executionKind,
          executionPhase: rawRequest.executionPhase === 'capability-response' ? 'capability-response' : 'primary',
          output: message.output,
          packageCodeLoaded: Boolean(message.packageCodeLoaded),
          workerReceipt: message,
        }));
      });
      child.once('exit', (code) => {
        if (activeRequests.has(request.requestId)) {
          finishRequest(request.requestId, createResult(request, 'failed', startedAt, { error: `worker_exit_${code ?? 'unknown'}` }));
        }
      });
      child.send({
        entrypoint: execution.entrypoint,
        inputBase64: execution.inputBase64,
        inputValue: execution.inputValue,
        kind: 'external-skill-sandbox-wasm-execution.v1',
        moduleBase64: execution.moduleBase64,
        requestId: request.requestId,
        runtimeKind: execution.runtimeKind,
      });
    });
  }

  function dispose() {
    [...activeRequests.keys()].forEach(cancelProbe);
  }

  return { cancelProbe, createSandboxEnvironment, dispose, runBootstrapProbe, runPackageExecution };
}

module.exports = { createExternalSkillSandboxSupervisorService, createSandboxEnvironment };
