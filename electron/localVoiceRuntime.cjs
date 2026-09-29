const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const {
  resolveReferenceAudioPath,
} = require('./localVoiceRuntimeAudioUtils.cjs');
const {
  cancelActiveSynthesisRequests,
  createRuntimeLogger,
  createRuntimeRootHelpers,
} = require('./localVoiceRuntimeCoreUtils.cjs');
const {
  createLocalVoiceRuntimeCacheUtils,
} = require('./localVoiceRuntimeCacheUtils.cjs');
const {
  createLocalVoiceRuntimeGeneratedAudioUtils,
} = require('./localVoiceRuntimeGeneratedAudioUtils.cjs');
const {
  createLocalVoiceRuntimeGeneratedAudioResultUtils,
} = require('./localVoiceRuntimeGeneratedAudioResultUtils.cjs');
const {
  createLocalVoiceRuntimeCandidateUtils,
} = require('./localVoiceRuntimeCandidateUtils.cjs');
const {
  ensureModeModelPath,
  normalizeBaseRuntimeCandidateResult,
  normalizeProbeCommandResult,
  normalizeProbeRuntimeResult,
  runModeCandidateLoop,
} = require('./localVoiceRuntimeExecutionUtils.cjs');
const {
  createPythonEnv,
  removeDirectorySafe,
} = require('./localVoiceRuntimeHostUtils.cjs');
const {
  buildBaseRuntimeInstallFailureResult,
  buildInstallExecutionFailureResult,
  buildInstallHealthCheckSettings,
  buildInstallSuccessResult,
  buildMissingPackagesInstallFailureResult,
  getDefaultLocalVoiceMissingPackages,
  resolvePreferredTorchPackages,
} = require('./localVoiceRuntimeInstallUtils.cjs');
const {
  createLocalVoiceRuntimeReferenceTextUtils,
} = require('./localVoiceRuntimeReferenceTextUtils.cjs');
const {
  buildFailureLogDetails,
  buildPersistGeneratedAudioInput,
  buildPromptWarmupSuccessLogDetails,
  buildReferenceTextPreparedLogDetails,
  buildSkipReasonLogDetails,
  buildSynthesisCacheKeyInput,
  buildSynthesisCancelledLogDetails,
  buildSynthesisOutput,
  buildSynthesisRunnerArgs,
  buildSynthesisStartLogDetails,
  buildSynthesisSuccessLogDetails,
  buildTranscriptionOutput,
  buildTranscriptionRunnerArgs,
  buildTranscriptionStartLogDetails,
  buildTranscriptionSuccessLogDetails,
  buildTtsWarmupPayload,
  buildWarmupWorkerLogDetails,
  ensureSynthesisAssetSelection,
  ensureTranscriptionAssetSelection,
  getLocalVoiceLanguageCode,
  normalizeSynthesisSeed,
  resolveRunnerAudioFilePath,
} = require('./localVoiceRuntimeRequestUtils.cjs');
const {
  createLocalVoiceRuntimeSelectionUtils,
} = require('./localVoiceRuntimeSelectionUtils.cjs');
const {
  ensureSyncedTextFile,
  withTemporaryPythonScript,
} = require('./localVoiceRuntimeScriptUtils.cjs');
const {
  createLocalVoiceRuntimeStatusUtils,
} = require('./localVoiceRuntimeStatusUtils.cjs');
const {
  buildWarmupResult,
  buildWarmupStartLogDetails,
  resolveWarmupPlan,
  shouldWarmTtsInference,
} = require('./localVoiceRuntimeWarmupUtils.cjs');
const {
  createLocalVoiceRuntimeWorkerUtils,
} = require('./localVoiceRuntimeWorkerUtils.cjs');
const {
  DEFAULT_TORCHAUDIO_VERSION,
  DEFAULT_TORCH_VERSION,
  buildProbeScript,
  getInstallSteps,
  getModeCandidate,
  getModeEnvDirectory,
  getModeEnvPythonPath,
  getModeLabel,
  getModePackages,
} = require('./localVoiceRuntimeModeUtils.cjs');
const {
  buildJsonError,
  createLocalVoiceCancelledError,
  extractMissingModuleName,
  getWorkerForceTerminateDelayMs,
  isChildProcessRunning,
  isLocalVoiceCancelledError,
  terminateChildProcess,
} = require('./localVoiceRuntimeProcessUtils.cjs');
const {
  buildSpawnCommandSpec,
  buildSpawnCloseResult,
  buildSpawnErrorResult,
  buildPowerShellEncodedCommand,
  createInstallProgressReporter,
  createLineReporter,
  formatSpawnFailure,
  parseJsonFromCommandOutput,
  splitOutputLines,
  stripAnsiCodes,
  takeTail,
} = require('./localVoiceRuntimeCommandUtils.cjs');
const {
  describeRuntimeCandidate,
  ensureDir,
  getPythonCandidates,
  isPathInside,
  normalizeComparablePath,
  pathExists,
  readFirstExistingTextFile,
  resolveReferenceTextFromAudioFileName,
  resolveBundledPythonPath,
  resolvePortableExecutableDir,
  resolveRuntimeRoot,
  uniqueStrings,
} = require('./localVoiceRuntimePathUtils.cjs');

const GENERATED_AUDIO_CACHE_TTL_MS = 60 * 60 * 1000;
const GENERATED_AUDIO_CACHE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const GENERATED_AUDIO_SYNTHESIS_CLEANUP_MIN_INTERVAL_MS = 60 * 1000;
const GENERATED_AUDIO_CACHE_MANIFEST_FILE = 'manifest.jsonl';
const GENERATED_AUDIO_CACHE_PREVIEW_LIMIT = 120;
const LOCAL_TTS_WORKER_POOL_SIZE = 1;
const LOCAL_DEFAULT_WORKER_POOL_SIZE = 1;

function spawnCommand(candidate, commandArgs, options = {}) {
  return new Promise((resolve) => {
    let child;
    try {
      const spawnSpec = buildSpawnCommandSpec({
        buildPowerShellEncodedCommand,
        candidate,
        commandArgs,
        options,
        platform: process.platform,
      });
      child = spawn(spawnSpec.command, spawnSpec.args, spawnSpec.options);
    } catch (error) {
      resolve(buildSpawnErrorResult({ error }));
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    const stdoutReporter = createLineReporter(options.onStdoutLine);
    const stderrReporter = createLineReporter(options.onStderrLine);
    const abortSignal = options.signal;
    let abortListener = null;

    const clearAbortListener = () => {
      if (abortSignal && abortListener) {
        abortSignal.removeEventListener('abort', abortListener);
        abortListener = null;
      }
    };

    const resolveCancelled = () => {
      if (settled) {
        return;
      }

      settled = true;
      clearAbortListener();
      terminateChildProcess(child);
      stdoutReporter.flush();
      stderrReporter.flush();
      resolve(buildSpawnErrorResult({
        canceled: true,
        error: createLocalVoiceCancelledError(),
        stderr,
        stdout,
      }));
    };

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      stdout += text;
      stdoutReporter.push(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      stderr += text;
      stderrReporter.push(text);
    });

    child.once('error', (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearAbortListener();
      stdoutReporter.flush();
      stderrReporter.flush();
      resolve(buildSpawnErrorResult({
        error,
        stderr,
        stdout,
      }));
    });

    child.once('close', (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearAbortListener();
      stdoutReporter.flush();
      stderrReporter.flush();
      resolve(buildSpawnCloseResult({
        exitCode,
        stderr,
        stdout,
      }));
    });

    if (abortSignal) {
      if (abortSignal.aborted) {
        resolveCancelled();
        return;
      }

      abortListener = () => {
        resolveCancelled();
      };
      abortSignal.addEventListener('abort', abortListener, { once: true });
    }
  });
}

async function runInlinePythonScript(candidate, scriptContent, options = {}) {
  return withTemporaryPythonScript({
    cwd: options.cwd,
    execute: (scriptPath) => spawnCommand(candidate, [scriptPath], options),
    scriptContent,
  });
}

function createLocalVoiceRuntime({ app, localVoiceLibrary, log, projectRoot }) {
  const runtimeRoot = resolveRuntimeRoot({ app, projectRoot });
  const embeddedRunnerPath = path.join(__dirname, 'local_voice_runner.py');
  const generatedAudioCacheRoot = path.join(runtimeRoot, 'generated-audio-cache');
  const generatedAudioManifestPath = path.join(generatedAudioCacheRoot, GENERATED_AUDIO_CACHE_MANIFEST_FILE);
  const referenceTextCachePath = path.join(runtimeRoot, 'reference-text-cache.json');
  const referenceTextCache = new Map();
  const modeWorkerPool = new Map();
  const brokenModeRuntimeCandidates = new Map();
  const activeSynthesisRequests = new Map();
  let synthesisSequence = 0;
  let transcriptionSequence = 0;
  let lastSynthesisCacheCleanupAt = 0;
  const writeRuntimeLog = createRuntimeLogger(log);
  const bundledPythonPath = resolveBundledPythonPath();
  const portableExecutableDir = resolvePortableExecutableDir();
  const generatedAudioCleanupTimer = setInterval(() => {
    try {
      cleanupGeneratedAudioCache('interval');
    } catch (error) {
      writeRuntimeLog('generated_audio_cache_cleanup_failed', {
        error: buildJsonError(error),
      });
    }
  }, GENERATED_AUDIO_CACHE_CLEANUP_INTERVAL_MS);

  if (typeof generatedAudioCleanupTimer.unref === 'function') {
    generatedAudioCleanupTimer.unref();
  }

  const { ensureRuntimeRoot, getSharedOptions } = createRuntimeRootHelpers({
    createPythonEnv,
    ensureDir,
    runtimeRoot,
  });

  const {
    buildReferenceTextCacheKey,
    clearBrokenModeRuntimeCandidate,
    ensureGeneratedAudioCacheRoot,
    getBrokenModeRuntimeCandidate,
    getGeneratedAudioCacheFilePath,
    markBrokenModeRuntimeCandidate,
    persistReferenceText,
    readPersistedReferenceText,
  } = createLocalVoiceRuntimeCacheUtils({
    buildJsonError,
    brokenModeRuntimeCandidates,
    describeRuntimeCandidate,
    ensureDir,
    ensureRuntimeRoot,
    fs,
    generatedAudioCacheRoot,
    path,
    pathExists,
    referenceTextCachePath,
    writeRuntimeLog,
  });

  const {
    buildGeneratedAudioCacheKey,
    buildGeneratedAudioTextPreview,
    cleanupGeneratedAudioCache,
    getGeneratedAudioFileUrl,
    updateGeneratedAudioManifestEntry,
  } = createLocalVoiceRuntimeGeneratedAudioUtils({
    buildJsonError,
    ensureGeneratedAudioCacheRoot,
    fs,
    generatedAudioCacheManifestFile: GENERATED_AUDIO_CACHE_MANIFEST_FILE,
    generatedAudioCachePreviewLimit: GENERATED_AUDIO_CACHE_PREVIEW_LIMIT,
    generatedAudioCacheRoot,
    generatedAudioCacheTtlMs: GENERATED_AUDIO_CACHE_TTL_MS,
    generatedAudioManifestPath,
    isPathInside,
    normalizeComparablePath,
    path,
    pathExists,
    writeRuntimeLog,
  });

  const {
    persistGeneratedAudioCache,
    resolveGeneratedAudioCacheHit,
  } = createLocalVoiceRuntimeGeneratedAudioResultUtils({
    buildGeneratedAudioTextPreview,
    buildJsonError,
    fs,
    generatedAudioCacheTtlMs: GENERATED_AUDIO_CACHE_TTL_MS,
    getGeneratedAudioCacheFilePath,
    getGeneratedAudioFileUrl,
    path,
    pathExists,
    updateGeneratedAudioManifestEntry,
    writeRuntimeLog,
  });
  const {
    getConfiguredReferenceText,
    resolveAssetSelection,
  } = createLocalVoiceRuntimeSelectionUtils({
    localVoiceLibrary,
    readFirstExistingTextFile,
    resolveReferenceTextFromAudioFileName,
    resolveReferenceAudioPath,
  });
  const {
    buildModeWorkerKey,
    buildWorkerExitReason,
    buildWorkerReadyLogDetails,
    buildWorkerRequestInput,
    buildWorkerRequestResult,
    createWorkerUnavailableError,
    describeRuntimeEnvironment,
    getWorkerModeModelPath,
    getWorkerResponseRequestId,
    parseRunnerPayload,
    summarizeWorkerPayload,
    summarizeWorkerResponse,
  } = createLocalVoiceRuntimeWorkerUtils({
    bundledPythonPath,
    describeRuntimeCandidate,
    getModeEnvDirectory,
    isPathInside,
    normalizeComparablePath,
    portableExecutableDir,
    projectRoot,
    runtimeRoot,
    splitOutputLines,
    takeTail,
  });
  const {
    getFallbackRuntimeCandidates,
    getModeRuntimeCandidates,
  } = createLocalVoiceRuntimeCandidateUtils({
    describeRuntimeCandidate,
    getBrokenModeRuntimeCandidate,
    getModeCandidate,
    getModeLabel,
    getPythonCandidates,
    projectRoot,
    runtimeRoot,
    writeRuntimeLog,
  });
  const {
    buildLocalVoiceHealth,
    buildUnavailableModeProbeResult,
    normalizeModeProbeRuntime,
  } = createLocalVoiceRuntimeStatusUtils({
    buildJsonError,
    buildReferenceTextCacheKey,
    describeRuntimeCandidate,
    extractMissingModuleName,
    getModeRuntimeCandidates,
    readPersistedReferenceText,
    runtimeRoot,
    uniqueStrings,
  });
  const {
    ensureReferenceTextPrepared,
  } = createLocalVoiceRuntimeReferenceTextUtils({
    buildReferenceTextCacheKey,
    getConfiguredReferenceText,
    persistReferenceText,
    readPersistedReferenceText,
    referenceTextCache,
    writeRuntimeLog,
  });

  cleanupGeneratedAudioCache('startup');

  function cleanupGeneratedAudioCacheBeforeSynthesize() {
    const now = Date.now();
    if (now - lastSynthesisCacheCleanupAt < GENERATED_AUDIO_SYNTHESIS_CLEANUP_MIN_INTERVAL_MS) {
      return;
    }

    lastSynthesisCacheCleanupAt = now;
    cleanupGeneratedAudioCache('before_synthesize');
  }

  function cancelSynthesis(reason = 'manual_cancel') {
    return cancelActiveSynthesisRequests({
      activeSynthesisRequests,
      reason,
      writeRuntimeLog,
    });
  }


  function ensureRunnerScriptPath() {
    return ensureSyncedTextFile({
      sourcePath: embeddedRunnerPath,
      targetPath: path.join(runtimeRoot, 'local_voice_runner.py'),
    });
  }

  function destroyModeWorker(worker, reason = 'dispose', customError = null) {
    if (!worker || worker.destroyed) {
      return;
    }

    worker.destroyed = true;
    worker.shutdownReason = reason;

    if (modeWorkerPool.get(worker.key) === worker) {
      modeWorkerPool.delete(worker.key);
    }

    const pendingEntries = [...worker.pending.entries()];
    worker.pending.clear();

    pendingEntries.forEach(([, pending]) => {
      if (typeof pending.abortCleanup === 'function') {
        pending.abortCleanup();
      }
      pending.reject(customError ?? createWorkerUnavailableError(getModeLabel, worker.mode, reason));
    });

    const forceTerminateDelayMs = getWorkerForceTerminateDelayMs(reason);

    try {
      if (worker.process.stdin && !worker.process.stdin.destroyed) {
        worker.process.stdin.end();
      }
    } catch {
      // Ignore stdin shutdown failures.
    }

    if (isChildProcessRunning(worker.process) && forceTerminateDelayMs > 0) {
      const fallbackTimer = setTimeout(() => {
        if (!isChildProcessRunning(worker.process)) {
          return;
        }

        writeRuntimeLog(`${getModeLabel(worker.mode)} worker force terminate fallback`, {
          reason,
          modelPath: worker.modelPath,
          delayMs: forceTerminateDelayMs,
        });
        terminateChildProcess(worker.process);
      }, forceTerminateDelayMs);

      if (typeof fallbackTimer.unref === 'function') {
        fallbackTimer.unref();
      }
    } else {
      terminateChildProcess(worker.process);
    }

    writeRuntimeLog(`${getModeLabel(worker.mode)} worker shutdown requested`, {
      reason,
      modelPath: worker.modelPath,
      forceTerminateDelayMs,
    });
  }

  function getModeWorkerPoolSize(mode) {
    return mode === 'tts'
      ? LOCAL_TTS_WORKER_POOL_SIZE
      : LOCAL_DEFAULT_WORKER_POOL_SIZE;
  }

  function buildModeWorkerSlotKey(baseWorkerKey, poolSize, slotIndex) {
    return poolSize > 1
      ? `${baseWorkerKey}::pool-${slotIndex + 1}`
      : baseWorkerKey;
  }

  function getModeWorkers(baseWorkerKey) {
    return [...modeWorkerPool.values()]
      .filter((worker) => worker.baseKey === baseWorkerKey && !worker.destroyed);
  }

  function getNextModeWorkerSlotIndex(baseWorkerKey, poolSize) {
    for (let slotIndex = 0; slotIndex < poolSize; slotIndex += 1) {
      const slotKey = buildModeWorkerSlotKey(baseWorkerKey, poolSize, slotIndex);
      const worker = modeWorkerPool.get(slotKey);
      if (!worker || worker.destroyed) {
        return slotIndex;
      }
    }

    return Math.max(0, poolSize - 1);
  }

  function getModeWorkerLoad(worker) {
    return (worker.activeRequestCount || 0) + worker.pending.size;
  }

  function selectLeastBusyModeWorker(workers) {
    return workers
      .slice()
      .sort((left, right) => (
        getModeWorkerLoad(left) - getModeWorkerLoad(right)
        || left.slotIndex - right.slotIndex
      ))[0];
  }

  function releaseModeWorkerReservation(worker) {
    if (!worker) {
      return;
    }

    worker.activeRequestCount = Math.max(0, (worker.activeRequestCount || 0) - 1);
  }

  function createModeWorker(candidate, mode, modelPath, scriptPath, slotIndex = 0) {
    const baseWorkerKey = buildModeWorkerKey(candidate, mode, modelPath);
    const poolSize = getModeWorkerPoolSize(mode);
    const workerKey = buildModeWorkerSlotKey(baseWorkerKey, poolSize, slotIndex);
    const workerArgs = [scriptPath, '--worker-mode', '--mode', mode];
    if (mode === 'tts') {
      workerArgs.push('--tts-model-path', modelPath);
    } else {
      workerArgs.push('--stt-model-path', modelPath);
    }

    const child = spawn(
      candidate.executable,
      [...candidate.args, ...workerArgs],
      {
        ...getSharedOptions(),
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    const worker = {
      key: workerKey,
      baseKey: baseWorkerKey,
      slotIndex,
      mode,
      modelPath,
      candidate,
      process: child,
      pending: new Map(),
      activeRequestCount: 0,
      nextRequestId: 0,
      destroyed: false,
      shutdownReason: 'running',
      ready: false,
      startError: null,
      readyPromise: null,
    };

    modeWorkerPool.set(workerKey, worker);

    const stdoutReporter = createLineReporter((line) => {
      let parsed = null;
      try {
        parsed = parseJsonFromCommandOutput(line);
      } catch {
        writeRuntimeLog(`${getModeLabel(mode)} worker output`, line);
        return;
      }

      if (parsed?.event === 'ready') {
        worker.ready = true;
        writeRuntimeLog(
          `${getModeLabel(mode)} worker ready`,
          {
            ...buildWorkerReadyLogDetails(parsed, modelPath),
            poolSlot: worker.slotIndex + 1,
            poolSize: getModeWorkerPoolSize(mode),
          },
        );
        worker._resolveReady?.(worker);
        return;
      }

      const requestId = getWorkerResponseRequestId(parsed);
      if (requestId && worker.pending.has(requestId)) {
        const pending = worker.pending.get(requestId);
        worker.pending.delete(requestId);
        pending.abortCleanup?.();
        writeRuntimeLog(
          `${getModeLabel(mode)} worker ${parsed?.ok ? 'request completed' : 'request failed'}`,
          {
            requestId,
            poolSlot: worker.slotIndex + 1,
            poolSize: getModeWorkerPoolSize(mode),
            ...summarizeWorkerResponse(parsed),
          },
        );
        pending.resolve(parsed);
        return;
      }

      writeRuntimeLog(`${getModeLabel(mode)} worker message`, parsed);
    });

    const stderrReporter = createLineReporter((line) => {
      writeRuntimeLog(`${getModeLabel(mode)} worker stderr`, line);
    });

    worker.readyPromise = new Promise((resolve, reject) => {
      worker._resolveReady = resolve;
      worker._rejectReady = reject;
    });

    child.stdout.on('data', (chunk) => {
      stdoutReporter.push(chunk.toString('utf8'));
    });

    child.stderr.on('data', (chunk) => {
      stderrReporter.push(chunk.toString('utf8'));
    });

    child.once('error', (error) => {
      stdoutReporter.flush();
      stderrReporter.flush();
      worker.startError = error;
      worker._rejectReady?.(error);
      destroyModeWorker(worker, 'spawn_error', error);
    });

    child.once('close', (exitCode, signal) => {
      stdoutReporter.flush();
      stderrReporter.flush();
      const exitError = worker.startError
        ?? createWorkerUnavailableError(getModeLabel, mode, buildWorkerExitReason(exitCode, signal));
      if (!worker.ready) {
        worker._rejectReady?.(exitError);
      }
      if (!worker.destroyed) {
        destroyModeWorker(worker, `closed_${exitCode ?? 'unknown'}`, exitError);
      }
    });

    writeRuntimeLog(`${getModeLabel(mode)} worker starting`, {
      runtime: describeRuntimeCandidate(candidate),
      modelPath,
      poolSlot: slotIndex + 1,
      poolSize,
    });

    return worker;
  }

  async function ensureModeWorkerReady(worker, signal) {
    if (!worker || worker.destroyed) {
      throw createWorkerUnavailableError(getModeLabel, worker?.mode || 'tts', 'destroyed');
    }

    const { mode } = worker;
    if (signal?.aborted) {
      destroyModeWorker(worker, 'aborted_before_ready', createLocalVoiceCancelledError());
      throw createLocalVoiceCancelledError();
    }

    if (!worker.ready) {
      await Promise.race([
        worker.readyPromise,
        ...(signal
          ? [
              new Promise((_, reject) => {
                const abortListener = () => {
                  destroyModeWorker(worker, 'aborted_during_startup', createLocalVoiceCancelledError());
                  reject(createLocalVoiceCancelledError());
                };
                signal.addEventListener('abort', abortListener, { once: true });
                worker.readyPromise.finally(() => {
                  signal.removeEventListener('abort', abortListener);
                });
              }),
            ]
          : []),
      ]);
    }

    return worker;
  }

  async function ensureModeWorker(candidate, mode, modelPath, signal) {
    const baseWorkerKey = buildModeWorkerKey(candidate, mode, modelPath);
    const poolSize = getModeWorkerPoolSize(mode);
    const workerKey = buildModeWorkerSlotKey(baseWorkerKey, poolSize, 0);
    let worker = modeWorkerPool.get(workerKey);

    if (!worker || worker.destroyed) {
      worker = createModeWorker(candidate, mode, modelPath, ensureRunnerScriptPath(), 0);
    }

    return ensureModeWorkerReady(worker, signal);
  }

  async function acquireModeWorker(candidate, mode, modelPath, signal) {
    const baseWorkerKey = buildModeWorkerKey(candidate, mode, modelPath);
    const poolSize = getModeWorkerPoolSize(mode);
    const workers = getModeWorkers(baseWorkerKey);
    const worker = workers.length < poolSize
      ? createModeWorker(
        candidate,
        mode,
        modelPath,
        ensureRunnerScriptPath(),
        getNextModeWorkerSlotIndex(baseWorkerKey, poolSize),
      )
      : selectLeastBusyModeWorker(workers);

    worker.activeRequestCount += 1;

    try {
      await ensureModeWorkerReady(worker, signal);
      return {
        release: () => releaseModeWorkerReservation(worker),
        worker,
      };
    } catch (error) {
      releaseModeWorkerReservation(worker);
      throw error;
    }
  }

  async function requestModeWorker(worker, payload, signal) {
    if (!worker || worker.destroyed || !worker.process.stdin || worker.process.stdin.destroyed) {
      throw createWorkerUnavailableError(getModeLabel, worker?.mode || 'tts', 'stdin_unavailable');
    }

    if (signal?.aborted) {
      destroyModeWorker(worker, 'request_aborted_before_send', createLocalVoiceCancelledError());
      throw createLocalVoiceCancelledError();
    }

    return await new Promise((resolve, reject) => {
      const requestId = `${worker.mode}-${++worker.nextRequestId}`;
      let settled = false;
      let abortListener = null;

      const abortCleanup = () => {
        if (signal && abortListener) {
          signal.removeEventListener('abort', abortListener);
          abortListener = null;
        }
      };

      const completeResolve = (parsed) => {
        if (settled) {
          return;
        }

        settled = true;
        resolve(buildWorkerRequestResult(worker, parsed));
      };

      const completeReject = (error) => {
        if (settled) {
          return;
        }

        settled = true;
        reject(error);
      };

      worker.pending.set(requestId, {
        resolve: completeResolve,
        reject: completeReject,
        abortCleanup,
      });

      if (signal) {
        abortListener = () => {
          destroyModeWorker(worker, 'request_aborted', createLocalVoiceCancelledError());
        };
        signal.addEventListener('abort', abortListener, { once: true });
      }

      writeRuntimeLog(`${getModeLabel(worker.mode)} worker request sent`, {
        requestId,
        runtime: describeRuntimeCandidate(worker.candidate),
        poolSlot: worker.slotIndex + 1,
        poolSize: getModeWorkerPoolSize(worker.mode),
        ...summarizeWorkerPayload(payload),
      });

      try {
        worker.process.stdin.write(buildWorkerRequestInput(requestId, payload), 'utf8', (error) => {
          if (!error) {
            return;
          }

          if (worker.pending.has(requestId)) {
            worker.pending.delete(requestId);
          }
          abortCleanup();
          writeRuntimeLog(`${getModeLabel(worker.mode)} worker request write failed`, {
            requestId,
            error: buildJsonError(error),
          });
          completeReject(error);
        });
      } catch (error) {
        if (worker.pending.has(requestId)) {
          worker.pending.delete(requestId);
        }
        abortCleanup();
        writeRuntimeLog(`${getModeLabel(worker.mode)} worker request send failed`, {
          requestId,
          error: buildJsonError(error),
        });
        completeReject(error);
      }
    });
  }

  async function warmupModeWorker(settings, mode, modelPath) {
    const candidates = getModeRuntimeCandidates(settings, mode);
    ensureModeModelPath({ getModeLabel, mode, modelPath });
    return runModeCandidateLoop({
      candidates,
      executeCandidate: async (candidate) => {
        const worker = await ensureModeWorker(candidate, mode, modelPath);
        clearBrokenModeRuntimeCandidate(mode, candidate);
        return worker;
      },
      fallbackErrorMessage: `${getModeLabel(mode)} worker warmup failed.`,
      markBrokenCandidate: (candidate, error) => {
        markBrokenModeRuntimeCandidate(mode, candidate, error);
      },
    });
  }

  async function resolveBasePythonRuntime(settings) {
    const candidates = getFallbackRuntimeCandidates(settings);
    return runModeCandidateLoop({
      candidates,
      executeCandidate: async (candidate) => {
        const result = await spawnCommand(candidate, ['-c', 'import sys; print(sys.executable)'], getSharedOptions());
        const normalizedResult = normalizeBaseRuntimeCandidateResult({
          candidate,
          formatSpawnFailure,
          result,
          splitOutputLines,
          takeTail,
        });

        if (normalizedResult.status !== 'resolved') {
          throw normalizedResult.error;
        }

        return normalizedResult.runtime;
      },
      fallbackErrorMessage: 'No usable Python runtime found.',
    });
  }

  async function probeModeRuntime(settings, mode) {
    const label = getModeLabel(mode);
    const packageNames = getModePackages(mode);
    const candidates = getModeRuntimeCandidates(settings, mode);
    const probeScript = buildProbeScript(mode, packageNames);
    return runModeCandidateLoop({
      candidates,
      executeCandidate: async (candidate) => {
        const result = await runInlinePythonScript(candidate, probeScript, getSharedOptions());
        const normalizedCommand = normalizeProbeCommandResult({
          formatSpawnFailure,
          label,
          result,
        });

        if (normalizedCommand.status !== 'parse') {
          throw normalizedCommand.error;
        }

        const normalizedProbe = normalizeProbeRuntimeResult({
          candidate,
          describeRuntimeEnvironment,
          label,
          normalizeModeProbeRuntime,
          packageNames,
          parseJsonFromCommandOutput,
          stdout: normalizedCommand.stdout,
        });

        if (normalizedProbe.status !== 'resolved') {
          throw normalizedProbe.error;
        }

        return normalizedProbe.result;
      },
      fallbackErrorMessage: `${label} runtime probe unavailable.`,
      markBrokenCandidate: (candidate, error) => {
        markBrokenModeRuntimeCandidate(mode, candidate, error);
      },
      resolveFinalFailure: (lastFailure) => buildUnavailableModeProbeResult({
        label,
        lastFailure,
        packageNames,
      }),
    });
  }

  async function runRunnerCommand({ settings, mode, extraArgs, signal }) {
    const candidates = getModeRuntimeCandidates(settings, mode);
    const requestPayload = parseRunnerPayload(extraArgs);
    const modelPath = getWorkerModeModelPath(mode, requestPayload);
    ensureModeModelPath({ getModeLabel, mode, modelPath });
    return runModeCandidateLoop({
      candidates,
      createLocalVoiceCancelledError,
      executeCandidate: async (candidate) => {
        const workerAssignment = await acquireModeWorker(candidate, mode, modelPath, signal);
        clearBrokenModeRuntimeCandidate(mode, candidate);
        try {
          return await requestModeWorker(workerAssignment.worker, requestPayload, signal);
        } finally {
          workerAssignment.release();
        }
      },
      fallbackErrorMessage: 'Local voice runner is unavailable.',
      isLocalVoiceCancelledError,
      markBrokenCandidate: (candidate, error) => {
        markBrokenModeRuntimeCandidate(mode, candidate, error);
      },
      signal,
    });
  }

  async function getHealth(settings) {
    const safeSettings = settings ?? {};
    writeRuntimeLog('Checking local voice runtime health');
    const assetSelection = resolveAssetSelection(safeSettings);
    const ttsRuntime = await probeModeRuntime(safeSettings, 'tts');
    const sttRuntime = await probeModeRuntime(safeSettings, 'stt');
    const health = buildLocalVoiceHealth({
      assetSelection,
      safeSettings,
      sttRuntime,
      ttsRuntime,
    });

    writeRuntimeLog('Local voice runtime health check completed', {
      status: health.status,
      executable: health.executable,
      missingPackages: health.missingPackages.length,
    });

    return health;
  }

  async function warmup(settings) {
    const safeSettings = settings ?? {};
    const requestId = `warmup-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    const assetSelection = resolveAssetSelection(safeSettings);
    const warmedModes = new Set();
    let warmedTtsWorker = null;
    let ok = false;
    let referenceTextInfo = getConfiguredReferenceText(safeSettings, assetSelection);
    const warmupPlan = resolveWarmupPlan({
      assetSelection,
      referenceTextInfo,
      safeSettings,
    });

    writeRuntimeLog('Starting local voice warmup', buildWarmupStartLogDetails({
      requestId,
      referenceTextInfo,
      safeSettings,
    }));

    if (warmupPlan.shouldSkipTtsWorker) {
      writeRuntimeLog('Local TTS warmup skipped', {
        requestId,
        reason: 'missing_tts_model',
      });
    }

    if (warmupPlan.shouldSkipSttWorker) {
      writeRuntimeLog('Local STT warmup skipped', {
        requestId,
        reason: 'missing_stt_model',
      });
    }

    const warmupTasks = [];

    if (warmupPlan.shouldWarmTtsWorker) {
      warmupTasks.push(
        warmupModeWorker(safeSettings, 'tts', assetSelection.ttsModel.path)
          .then((worker) => {
            warmedTtsWorker = worker;
            warmedModes.add('tts');
            ok = true;
            writeRuntimeLog(
              'Local TTS worker warmed',
              buildWarmupWorkerLogDetails({
                modelPath: assetSelection.ttsModel.path,
                requestId,
              }),
            );
          })
          .catch((error) => {
            writeRuntimeLog(
              'Local TTS warmup failed',
              buildFailureLogDetails({
                errorText: buildJsonError(error),
                requestId,
              }),
            );
          }),
      );
    }

    if (warmupPlan.shouldWarmSttWorker) {
      warmupTasks.push(
        warmupModeWorker(safeSettings, 'stt', assetSelection.sttModel.path)
          .then(() => {
            warmedModes.add('stt');
            ok = true;
            writeRuntimeLog(
              'Local STT worker warmed',
              buildWarmupWorkerLogDetails({
                modelPath: assetSelection.sttModel.path,
                requestId,
              }),
            );
          })
          .catch((error) => {
            writeRuntimeLog(
              'Local STT warmup failed',
              buildFailureLogDetails({
                errorText: buildJsonError(error),
                requestId,
              }),
            );
          }),
      );
    }

    if (warmupTasks.length > 0) {
      await Promise.all(warmupTasks);
    }

    if (warmupPlan.shouldPrepareReferenceText) {
      try {
        referenceTextInfo = await ensureReferenceTextPrepared({
          settings: safeSettings,
          assetSelection,
          requestId,
          purpose: 'warmup',
          runRunnerCommand,
        });
        ok = ok || Boolean(referenceTextInfo.referenceText);
        writeRuntimeLog(
          'Local voice reference text prepared',
          buildReferenceTextPreparedLogDetails({
            referenceTextInfo,
            requestId,
          }),
        );
      } catch (error) {
        writeRuntimeLog(
          'Local voice reference text warmup failed',
          buildFailureLogDetails({
            errorText: buildJsonError(error),
            requestId,
          }),
        );
      }
    } else if (warmupPlan.referenceTextWarmupSkipReason) {
      writeRuntimeLog(
        'Local voice reference text warmup skipped',
        buildSkipReasonLogDetails({
          reason: warmupPlan.referenceTextWarmupSkipReason,
          requestId,
        }),
      );
    }

    let ttsInferenceReady = false;
    if (shouldWarmTtsInference({
      assetSelection,
      referenceTextInfo,
      safeSettings,
      warmedTtsWorker,
    })) {
      try {
        const warmupResult = await requestModeWorker(
          warmedTtsWorker,
          buildTtsWarmupPayload({
            assetSelection,
            languageCode: getLocalVoiceLanguageCode(safeSettings),
            referenceText: referenceTextInfo.referenceText,
          }),
        );

        if (!warmupResult?.ok || !warmupResult?.parsed?.ok) {
          throw new Error(warmupResult?.parsed?.error || 'tts_prompt_warmup_failed');
        }

        ttsInferenceReady = true;
        ok = true;
        writeRuntimeLog(
          'Local TTS prompt warmed',
          buildPromptWarmupSuccessLogDetails({
            parsed: warmupResult.parsed,
            requestId,
          }),
        );
      } catch (error) {
        writeRuntimeLog(
          'Local TTS prompt warmup failed',
          buildFailureLogDetails({
            errorText: buildJsonError(error),
            requestId,
          }),
        );
      }
    }

    const result = buildWarmupResult({
      ok,
      referenceTextInfo,
      ttsInferenceReady,
      warmedModes,
    });

    writeRuntimeLog('Local voice warmup completed', {
      requestId,
      ...result,
    });
    return result;
  }

  async function ensureVenv(baseRuntime, mode, progress, options = {}) {
    const label = getModeLabel(mode);
    const envDir = getModeEnvDirectory(runtimeRoot, mode);
    const envPythonPath = getModeEnvPythonPath(runtimeRoot, mode);
    const recreate = Boolean(options.recreate);

    if (recreate && pathExists(envDir)) {
      progress.push(`Recreating ${label} isolated runtime. Cleaning old environment...`);
      removeDirectorySafe(envDir, runtimeRoot);
    }

    if (pathExists(envPythonPath)) {
      progress.push(`${label} isolated runtime already exists.`);
      return {
        candidate: {
          label: `venv-${mode}`,
          executable: envPythonPath,
          args: [],
        },
        executable: envPythonPath,
      };
    }

    ensureDir(runtimeRoot);
    progress.push(`Creating ${label} isolated runtime...`);

    const result = await spawnCommand(
      baseRuntime.candidate,
      ['-m', 'venv', envDir, '--without-pip'],
      {
        ...getSharedOptions(),
        onStdoutLine: (line) => progress.push(line),
        onStderrLine: (line) => progress.push(line),
      },
    );

    if (!result.ok || !pathExists(envPythonPath)) {
      throw new Error(`${label} isolated runtime creation failed: ${formatSpawnFailure(result)}`);
    }

    progress.push(`${label} isolated runtime created.`);
    return {
      candidate: {
        label: `venv-${mode}`,
        executable: envPythonPath,
        args: [],
      },
      executable: envPythonPath,
    };
  }

  async function installModeDependencies(baseRuntime, runtime, mode, progress, preferredTorchPackages) {
    const steps = getInstallSteps(mode, preferredTorchPackages);

    for (const step of steps) {
      progress.push(`${step.label}...`);
      const result = await spawnCommand(
        baseRuntime.candidate,
        ['-m', 'pip', '--python', runtime.executable, ...step.installArgs],
        {
          ...getSharedOptions(),
          onStdoutLine: (line) => progress.push(line),
          onStderrLine: (line) => progress.push(line),
        },
      );

      if (!result.ok) {
        throw new Error(`${step.label} failed: ${formatSpawnFailure(result)}`);
      }
    }
  }

  async function installDependencies(settings, options = {}) {
    const safeSettings = settings ?? {};
    const defaultMissingPackages = getDefaultLocalVoiceMissingPackages(getModePackages, uniqueStrings);
    const healthCheckSettings = buildInstallHealthCheckSettings(safeSettings);
    writeRuntimeLog('Starting local voice dependency installation');
    brokenModeRuntimeCandidates.clear();
    const progress = createInstallProgressReporter(
      options.onProgress,
      (message) => writeRuntimeLog(`Install progress: ${message}`),
    );

    progress.push('Preparing local voice dependency installation...');

    let baseRuntime = null;
    try {
      baseRuntime = await resolveBasePythonRuntime(safeSettings);
      progress.setExecutable(baseRuntime.executable);
      progress.push(`Base Python runtime: ${baseRuntime.executable}`);
      progress.setStage('running');
      progress.push('Checking or creating isolated runtimes. The first install may take several minutes.');
    } catch (error) {
      const failureResult = buildBaseRuntimeInstallFailureResult({
        error,
        missingPackages: defaultMissingPackages,
      });

      progress.setMissingPackages(failureResult.missingPackages);
      progress.setError(failureResult.error);
      failureResult.messages.forEach((message) => progress.push(message));
      progress.setStage('failed');
      return failureResult;
    }

    try {
      const preferredTorchPackages = await resolvePreferredTorchPackages({
        baseRuntime,
        defaultTorchaudioVersion: DEFAULT_TORCHAUDIO_VERSION,
        defaultTorchVersion: DEFAULT_TORCH_VERSION,
        getSharedOptions,
        parseJsonFromCommandOutput,
        runInlinePythonScript,
      });
      progress.push(`Isolated runtimes will use PyTorch ${preferredTorchPackages.torchVersion} / torchaudio ${preferredTorchPackages.torchaudioVersion}`);
      const ttsRuntime = await ensureVenv(baseRuntime, 'tts', progress, { recreate: true });
      await installModeDependencies(baseRuntime, ttsRuntime, 'tts', progress, preferredTorchPackages);

      const sttRuntime = await ensureVenv(baseRuntime, 'stt', progress, { recreate: true });
      await installModeDependencies(baseRuntime, sttRuntime, 'stt', progress, preferredTorchPackages);

      const health = await getHealth(healthCheckSettings);

      if (health.missingPackages.length > 0) {
        const failureResult = buildMissingPackagesInstallFailureResult({
          executable: health.executable,
          messages: progress.getMessages(),
          missingPackages: health.missingPackages,
        });

        progress.setExecutable(health.executable ?? baseRuntime.executable);
        progress.setMissingPackages(failureResult.missingPackages);
        progress.setError(failureResult.error);
        progress.push(`Installation completed but some packages are still missing: ${health.missingPackages.join(', ')}`);
        progress.setStage('failed');
        return failureResult;
      }

      progress.setExecutable(health.executable ?? baseRuntime.executable);
      progress.setMissingPackages([]);
      progress.setError(null);
      progress.push('Local voice isolated runtimes installed successfully.');
      progress.setStage('completed');
      return buildInstallSuccessResult({
        executable: health.executable,
        messages: progress.getMessages(),
      });
    } catch (error) {
      const health = await getHealth(healthCheckSettings);
      const failureResult = buildInstallExecutionFailureResult({
        error: buildJsonError(error),
        executable: health.executable ?? baseRuntime.executable,
        messages: progress.getMessages(),
        missingPackages: health.missingPackages.length > 0
          ? health.missingPackages
          : defaultMissingPackages,
      });

      progress.setExecutable(failureResult.executable);
      progress.setMissingPackages(failureResult.missingPackages);
      progress.setError(failureResult.error);
      progress.push(`Installation failed: ${failureResult.error}`);
      progress.setStage('failed');
      return failureResult;
    }
  }

  async function synthesize({ text, settings, seed }) {
    const synthesisRequest = {
      id: `tts-${++synthesisSequence}`,
      controller: new AbortController(),
      cancelReason: 'active',
      startedAt: Date.now(),
    };
    activeSynthesisRequests.set(synthesisRequest.id, synthesisRequest);
    const signal = synthesisRequest.controller.signal;
    const safeSettings = settings ?? {};
    const normalizedSeed = normalizeSynthesisSeed(seed);
    const languageCode = getLocalVoiceLanguageCode(safeSettings);
    writeRuntimeLog(
      'Starting local voice synthesis',
      buildSynthesisStartLogDetails({
        activeRequestCount: activeSynthesisRequests.size,
        normalizedSeed,
        requestId: synthesisRequest.id,
        text,
      }),
    );
    cleanupGeneratedAudioCacheBeforeSynthesize();

    try {
      const assetSelection = resolveAssetSelection(safeSettings);
      ensureSynthesisAssetSelection(assetSelection);

      const referenceTextInfo = await ensureReferenceTextPrepared({
        settings: safeSettings,
        assetSelection,
        signal,
        requestId: synthesisRequest.id,
        runRunnerCommand,
      });
      const referenceText = referenceTextInfo.referenceText;

      const cacheKey = buildGeneratedAudioCacheKey(buildSynthesisCacheKeyInput({
        assetSelection,
        languageCode,
        normalizedSeed,
        referenceText,
        text,
      }));
      const cachedOutput = resolveGeneratedAudioCacheHit(cacheKey, synthesisRequest.id);
      if (cachedOutput) {
        return cachedOutput;
      }
      const outputAudioPath = getGeneratedAudioCacheFilePath(cacheKey);

      const ttsExtraArgs = buildSynthesisRunnerArgs({
        assetSelection,
        languageCode,
        normalizedSeed,
        outputAudioPath,
        referenceText,
        text,
      });

      const result = await runRunnerCommand({
        settings: safeSettings,
        mode: 'tts',
        extraArgs: ttsExtraArgs,
        signal,
      });

      if (!result.ok || !result.parsed?.ok) {
        throw new Error(result.parsed?.error || 'Local TTS synthesis failed.');
      }

      const mimeType = result.parsed.mime_type || 'audio/wav';
      const runnerAudioFilePath = resolveRunnerAudioFilePath(
        result.parsed.audio_file_path,
        generatedAudioCacheRoot,
        isPathInside,
      );
      const persistedAudio = persistGeneratedAudioCache(buildPersistGeneratedAudioInput({
        assetSelection,
        audioBase64: result.parsed.audio_base64,
        cacheKey,
        languageCode,
        mimeType,
        normalizedSeed,
        referenceText,
        requestId: synthesisRequest.id,
        runnerAudioFilePath,
        text,
      }));
      const output = buildSynthesisOutput({
        cacheKey,
        mimeType,
        parsed: result.parsed,
        persistedAudio,
      });

      writeRuntimeLog(
        'Local voice synthesis completed',
        buildSynthesisSuccessLogDetails({
          activeRequestCount: activeSynthesisRequests.size,
          cacheKey,
          elapsedMs: Date.now() - synthesisRequest.startedAt,
          output,
          requestId: synthesisRequest.id,
        }),
      );
      return output;
    } catch (error) {
      if (isLocalVoiceCancelledError(error)) {
        writeRuntimeLog(
          'Local voice synthesis cancelled',
          buildSynthesisCancelledLogDetails({
            activeRequestCount: activeSynthesisRequests.size,
            elapsedMs: Date.now() - synthesisRequest.startedAt,
            reason: synthesisRequest.cancelReason,
            requestId: synthesisRequest.id,
          }),
        );
        throw createLocalVoiceCancelledError();
      }

      writeRuntimeLog(
        'Local voice synthesis failed',
        buildFailureLogDetails({
          activeRequestCount: activeSynthesisRequests.size,
          elapsedMs: Date.now() - synthesisRequest.startedAt,
          errorText: buildJsonError(error),
          requestId: synthesisRequest.id,
        }),
      );
      throw error;
    } finally {
      activeSynthesisRequests.delete(synthesisRequest.id);
    }
  }

  async function transcribe({ audioBase64, settings }) {
    const requestId = `stt-${++transcriptionSequence}`;
    const safeSettings = settings ?? {};
    const languageCode = getLocalVoiceLanguageCode(safeSettings);
    writeRuntimeLog(
      'Starting local voice transcription',
      buildTranscriptionStartLogDetails({ audioBase64, requestId }),
    );
    const assetSelection = resolveAssetSelection(safeSettings);
    ensureTranscriptionAssetSelection(assetSelection);

    ensureDir(runtimeRoot);
    const audioPath = path.join(runtimeRoot, `stt-input-${requestId}.wav`);

    try {
      fs.writeFileSync(audioPath, Buffer.from(audioBase64, 'base64'));

      const result = await runRunnerCommand({
        settings: safeSettings,
        mode: 'stt',
        extraArgs: buildTranscriptionRunnerArgs({
          audioPath,
          languageCode,
          sttModelPath: assetSelection.sttModel.path,
        }),
      });

      if (!result.ok || !result.parsed?.ok) {
        throw new Error(result.parsed?.error || 'Local STT transcription failed.');
      }

      const output = buildTranscriptionOutput(result.parsed);

      writeRuntimeLog(
        'Local voice transcription completed',
        buildTranscriptionSuccessLogDetails({ output, requestId }),
      );
      return output;
    } catch (error) {
      writeRuntimeLog(
        'Local voice transcription failed',
        buildFailureLogDetails({
          errorText: buildJsonError(error),
          requestId,
        }),
      );
      throw error;
    } finally {
      try {
        fs.unlinkSync(audioPath);
      } catch {
        // Ignore temp cleanup failures.
      }
    }
  }

  function dispose() {
    cancelSynthesis('runtime_dispose');
    clearInterval(generatedAudioCleanupTimer);

    for (const worker of [...modeWorkerPool.values()]) {
      destroyModeWorker(worker, 'runtime_dispose');
    }

    referenceTextCache.clear();
    writeRuntimeLog('Local voice runtime disposed');
  }

  return {
    cancelSynthesis,
    dispose,
    getHealth,
    installDependencies,
    warmup,
    synthesize,
    transcribe,
  };
}

module.exports = {
  createLocalVoiceRuntime,
};
