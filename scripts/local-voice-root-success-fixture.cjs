const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { createRequire } = require('node:module');
const rootFile = path.resolve(__dirname, '../electron/localVoiceRuntime.cjs');

function createFixture() {
  const files = new Map(), directories = new Set(), trace = [], timers = [], states = [], children = [];
  const modules = new Map(), runtimePaths = [];
  const put = (file, value) => files.set(path.resolve(file), Buffer.from(value));
  const exists = file => files.has(path.resolve(file)) || directories.has(path.resolve(file));
  const memoryFs = {
    existsSync: exists,
    mkdirSync: dir => { directories.add(path.resolve(dir)); trace.push(['mkdir', dir]); },
    readFileSync(file, encoding) {
      const value = files.get(path.resolve(file));
      if (!value) { const error = new Error('controlled missing file'); error.code = 'ENOENT'; throw error; }
      trace.push(['read', file]); return encoding ? value.toString(encoding) : Buffer.from(value);
    },
    writeFileSync(file, content) { trace.push(['write', file]); put(file, content); },
    unlinkSync(file) { trace.push(['unlink', file]); files.delete(path.resolve(file)); },
    rmSync(dir) {
      trace.push(['rm', dir]);
      const inside = value => value === path.resolve(dir) || value.startsWith(path.resolve(dir) + path.sep);
      for (const value of [...files.keys()]) if (inside(value)) files.delete(value);
      for (const value of [...directories]) if (inside(value)) directories.delete(value);
    },
    statSync(file) {
      const resolved = path.resolve(file); if (!exists(file)) throw new Error('controlled missing stat');
      return { size: files.get(resolved)?.length ?? 0, mtimeMs: 1,
        isFile: () => files.has(resolved), isDirectory: () => directories.has(resolved) };
    },
    readdirSync(dir, options) {
      const names = new Set([...files.keys(), ...directories].filter(value => path.dirname(value) === path.resolve(dir))
        .map(value => path.basename(value)));
      return [...names].map(name => options?.withFileTypes ? {
        name, isFile: () => files.has(path.resolve(dir, name)),
        isDirectory: () => directories.has(path.resolve(dir, name)),
      } : name);
    },
  };
  function spawn(command, args, options) {
    const child = new EventEmitter(); child.stdout = new EventEmitter(); child.stderr = new EventEmitter();
    child.exitCode = null; child.signalCode = null; child.destroyed = false;
    const mode = args[args.indexOf('--mode') + 1];
    trace.push(['spawn', command, args, options.cwd]); children.push(child);
    const emit = output => child.stdout.emit('data', Buffer.from(JSON.stringify(output) + '\n'));
    child.stdin = {
      destroyed: false,
      end() { this.destroyed = true; child.exitCode = 0; trace.push(['stdin-end']); },
      write(input, encoding, callback) {
        const payload = JSON.parse(input); trace.push(['request', mode, payload]);
        queueMicrotask(() => {
          callback?.(null);
          if (mode === 'stt') {
            const audio = files.get(path.resolve(payload.audio_path)).toString();
            emit({ id: payload.id, ok: true, text: ` transcript:${audio} ` });
          } else emit({ id: payload.id, ok: true, audio_base64: Buffer.from('voice:' + payload.text).toString('base64'),
            mime_type: 'audio/wav', prompt_cache_hit: false });
        });
        return true;
      },
    };
    queueMicrotask(() => {
      if (args.includes('--worker-mode')) { emit({ event: 'ready', mode, device: 'cpu' }); return; }
      let stdout = 'controlled install step\n';
      if (args.includes('venv')) {
        const dir = args[args.indexOf('venv') + 1];
        directories.add(path.resolve(dir)); put(path.join(dir, 'Scripts', 'python.exe'), 'controlled python');
      } else if (args[0] === '-c') stdout = command + '\n';
      else if (files.has(path.resolve(args[0] || ''))) {
        const script = files.get(path.resolve(args[0])).toString();
        stdout = JSON.stringify(script.includes('missing_packages') ? {
          missing_packages: [], detected_packages: [], executable: command, device: 'cpu',
          python_version: '3.11.0', import_error: null,
        } : { torch: '2.6.0', torchaudio: '2.6.0' }) + '\n';
      }
      child.stdout.emit('data', Buffer.from(stdout)); child.exitCode = 0; child.emit('close', 0);
    });
    return child;
  }
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const realRequire = createRequire(file);
    new Function('require', 'module', '__dirname', 'setInterval', 'clearInterval', fs.readFileSync(file, 'utf8'))(name => {
      if (name === 'fs' || name === 'node:fs') return memoryFs;
      if (name === 'child_process' || name === 'node:child_process') return { spawn };
      if (name.startsWith('./localVoiceRuntime')) return load(path.resolve(path.dirname(file), name));
      return realRequire(name);
    }, module, path.dirname(file), (callback, interval) => {
      const timer = { callback, interval, active: true, unref() {} }; timers.push(timer); return timer;
    }, timer => { timer.active = false; });
    if (module.exports.createLocalVoiceCommandRunner) {
      const create = module.exports.createLocalVoiceCommandRunner;
      module.exports.createLocalVoiceCommandRunner = () => create({ platform: 'linux' });
    }
    if (module.exports.createLocalVoiceRuntimeState) {
      const create = module.exports.createLocalVoiceRuntimeState;
      module.exports.createLocalVoiceRuntimeState = () => { const state = create(); states.push(state); return state; };
    }
    if (module.exports.createLocalVoiceRuntimePaths) {
      const create = module.exports.createLocalVoiceRuntimePaths;
      module.exports.createLocalVoiceRuntimePaths = input => {
        const paths = create(input); runtimePaths.push(paths); return paths;
      };
    }
    return module.exports;
  }
  put(path.join(path.dirname(rootFile), 'local_voice_runner.py'), 'controlled runner source');
  const create = load(rootFile).createLocalVoiceRuntime;
  function instance(tag, packaged) {
    const projectRoot = path.resolve('controlled-root-success', tag), logs = [];
    const assetsRoot = path.join(projectRoot, 'assets');
    const ttsPath = path.join(assetsRoot, 'tts'), sttPath = path.join(assetsRoot, 'stt'), referencePath = path.join(assetsRoot, 'reference.wav');
    put(ttsPath, 'tts-model'); put(sttPath, 'stt-model'); put(referencePath, 'reference-audio');
    const python = path.join(projectRoot, 'manual-python.exe'); put(python, 'controlled python');
    const catalog = { rootPath: assetsRoot, ttsModels: [{ id: 'tts', path: ttsPath }],
      sttModels: [{ id: 'stt', path: sttPath }], references: [{ id: 'reference', path: referencePath }] };
    const settings = { localTtsModelId: 'tts', localSttModelId: 'stt', localVoiceReferenceId: 'reference',
      localVoiceReferenceText: 'reference text', localVoiceRuntimePath: python, ttsProvider: 'local', sttProvider: 'local' };
    const runtime = create({ app: { isPackaged: packaged, getPath: () => path.join(projectRoot, 'userdata') },
      projectRoot, log: message => logs.push(message), localVoiceLibrary: { getCatalog: () => catalog } });
    const runtimeRoot = runtimePaths.at(-1).runtimeRoot;
    return { runtime, settings, runtimeRoot, logs, state: states.at(-1) };
  }
  return { instance, files, directories, trace, timers, states, children };
}
module.exports = { createFixture };
