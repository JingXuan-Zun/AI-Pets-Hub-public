const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const sessionSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeSessionAssembly.cjs'), 'utf8');
const ts = require('typescript');
const requests = require('../electron/localVoiceRuntimeRequestUtils.cjs');
const processes = require('../electron/localVoiceRuntimeProcessUtils.cjs');
const { createLocalVoiceTranscription } = require('../electron/localVoiceRuntimeTranscription.cjs');
const modulePath = path.join(__dirname, '../electron/localVoiceRuntimeTranscription.cjs');

function loadBaseline(file) {
  const source = fs.readFileSync(file, 'utf8');
  const start = source.indexOf('  async function transcribe('), end = source.indexOf('  function dispose()', start);
  assert.ok(start >= 0 && end > start);
  return context => new Function(...Object.keys(context),
    `let transcriptionSequence = 0; ${source.slice(start, end)}; return { transcribe };`,
  )(...Object.values(context));
}

async function run(config, baseline) {
  const trace = [], files = new Map(), error = new Error('controlled_transcription_error');
  let sequence = 0;
  const runtimeRoot = path.join(__dirname, 'controlled-stt-runtime');
  const settings = config.nullSettings ? null : { speechRecognitionLang: config.language, sentinel: 42 };
  const fail = stage => { if (config.fault === stage || config.secondaryFault === stage) throw error; };
  const context = { ...requests, ...processes, path, runtimeRoot,
    nextTranscriptionRequestId: () => `stt-${++sequence}`,
    writeRuntimeLog(message, details) { trace.push(['log', message, details]); fail(message); },
    resolveAssetSelection(input) {
      assert.deepEqual(input, settings ?? {}); trace.push(['assets', input]); fail('assets');
      if (config.missingModel) return {};
      const model = { get path() { trace.push(['model-path']); fail('model-path'); return 'stt-model'; } };
      return { sttModel: model };
    },
    ensureDir(target) { assert.equal(target, runtimeRoot); trace.push(['directory', target]); fail('directory'); },
    fs: {
      writeFileSync(target, data) {
        assert.equal(target, path.join(runtimeRoot, 'stt-input-stt-1.wav'));
        assert.ok(Buffer.isBuffer(data)); trace.push(['write', target, data.toString('hex')]);
        fail('write'); files.set(target, data.toString('hex'));
      },
      unlinkSync(target) { trace.push(['unlink', target]); fail('unlink'); files.delete(target); },
    },
    runRunnerCommand: async input => {
      assert.equal(input.mode, 'stt'); assert.equal(input.signal, undefined);
      assert.equal(input.settings, settings ?? input.settings);
      trace.push(['runner', input.settings, input.mode, input.extraArgs]); fail('runner');
      return { ok: config.result !== 'outer-fail', parsed: config.result === 'empty' ? null : {
        ok: config.result !== 'parsed-fail', error: config.result === 'parsed-fail' ? 'parsed failure' : '',
        get text() { trace.push(['text']); fail('text'); return config.text; },
      } };
    },
  };
  let result;
  try { result = await (baseline ? baseline(context) : createLocalVoiceTranscription(context))
    .transcribe({ audioBase64: config.audio, settings }); }
  catch (caught) { result = { rejected: true, message: caught.message, code: caught.code, sameError: caught === error }; }
  const beforeTry = ['Starting local voice transcription', 'assets', 'directory'].includes(config.fault) || config.missingModel;
  assert.equal(trace.some(item => item[0] === 'unlink'), !beforeTry);
  if (!config.fault && !config.secondaryFault && !config.missingModel && !config.result && typeof config.audio === 'string') {
    assert.deepEqual(result, { text: String(config.text || '').trim() });
  }
  return { result, trace, files: [...files] };
}

async function concurrent(failingSecond) {
  const files = new Map(), pending = [], removed = [];
  let sequence = 0;
  const root = path.join(__dirname, 'controlled-stt-runtime');
  const context = { runtimeRoot: root, nextTranscriptionRequestId: () => `stt-${++sequence}`,
    writeRuntimeLog() {}, ensureDir() {}, resolveAssetSelection: () => ({ sttModel: { path: 'model' } }),
    fs: { writeFileSync: (target, data) => files.set(target, data.toString()),
      unlinkSync: target => { removed.push(target); files.delete(target); } },
    runRunnerCommand: input => new Promise((resolve, reject) => pending.push({ input, resolve, reject })),
  };
  const service = createLocalVoiceTranscription(context);
  const observed = ['first', 'second'].map(text => service.transcribe({ audioBase64: Buffer.from(text).toString('base64') })
    .then(value => ({ value }), error => ({ error })));
  assert.equal(pending.length, 2);
  const paths = pending.map(item => item.input.extraArgs[1]);
  assert.notEqual(paths[0], paths[1]); assert.deepEqual(paths.map(target => files.get(target)), ['first', 'second']);
  const error = new Error('second failed');
  if (failingSecond) pending[1].reject(error);
  else pending[1].resolve({ ok: true, parsed: { ok: true, text: 'second' } });
  const second = await observed[1];
  assert.equal(files.size, 1); assert.equal(files.get(paths[0]), 'first');
  if (failingSecond) assert.equal(second.error, error); else assert.deepEqual(second.value, { text: 'second' });
  pending[0].resolve({ ok: true, parsed: { ok: true, text: 'first' } });
  assert.deepEqual((await observed[0]).value, { text: 'first' });
  assert.deepEqual(removed, [paths[1], paths[0]]); assert.equal(files.size, 0);
}

function structure() {
  const source = fs.readFileSync(modulePath, 'utf8');
  assert.ok(source.split('\n').length <= 300);
  const ast = ts.createSourceFile(modulePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  function visit(node) {
    if ((ts.isFunctionDeclaration(node) || ts.isArrowFunction(node)) && node.body) {
      assert.ok(ast.getLineAndCharacterOfPosition(node.end).line - ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 <= 50);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const assemblySource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeServiceAssembly.cjs'), 'utf8');
  const stateSource = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntimeState.cjs'), 'utf8');
  const root = fs.readFileSync(path.join(__dirname, '../electron/localVoiceRuntime.cjs'), 'utf8');
  assert.doesNotMatch(root, /async function transcribe\(/);
  assert.match(root, /createLocalVoiceSessionAssembly\(\{/u);
  assert.match(sessionSource, /createLocalVoiceRuntimeState\(\)/u);
  assert.match(stateSource, /nextTranscriptionRequestId: \(\) => `stt-\$\{\+\+transcriptionSequence\}`/);
  assert.match(root, /createLocalVoiceServiceAssembly\(\{/u);
  assert.match(assemblySource, /createLocalVoiceTranscription\(\{/);
}

async function main() {
  structure(); const baseline = process.argv[2] ? loadBaseline(process.argv[2]) : null;
  let count = 0;
  async function check(config) {
    const actual = await run(config);
    if (baseline) assert.deepEqual(actual, await run(config, baseline));
    count++;
  }
  for (const audio of ['YXVkaW8=', '', 'not base64!', undefined, null, 42]) {
    for (const text of ['  转录文本  ', '', null, 12]) for (const language of [undefined, '', ' en-US ']) {
      for (const nullSettings of [false, true]) await check({ audio, text, language, nullSettings });
    }
  }
  for (const fault of ['Starting local voice transcription', 'assets', 'directory', 'write', 'model-path', 'runner', 'text',
    'Local voice transcription completed', 'unlink']) await check({ audio: 'YQ==', text: 'text', fault });
  for (const result of ['outer-fail', 'parsed-fail', 'empty']) for (const secondaryFault of [undefined,
    'Local voice transcription failed', 'unlink']) await check({ audio: 'YQ==', result, secondaryFault });
  await check({ audio: 'YQ==', missingModel: true });
  await check({ audio: 'YQ==', fault: 'write', secondaryFault: 'Local voice transcription failed' });
  await concurrent(false); await concurrent(true);
  console.log(`local voice transcription: ${count} input/result/order/error scenarios and 2 concurrent file-isolation scenarios passed${baseline ? ' against baseline' : ''}`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
