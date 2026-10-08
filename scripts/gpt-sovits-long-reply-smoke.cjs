const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const script = String.raw`
import json, sys
import numpy as np
sys.path.insert(0, "electron")
from gpt_sovits_synthesis import split_synthesis_text
from gpt_sovits_server import VoiceEngine, judge_audio, build_handler

paragraphs = ["第一段完整的介绍，保留逗号内的内容。" * 8,
              "第二段继续介绍，仍然应该按完整句子合成。" * 8,
              "最后一段说明结果，不能丢掉最后的文字。" * 8]
text = "\n".join(paragraphs)
chunks = split_synthesis_text(text)
assert "".join(chunks) == "".join(paragraphs), "long reply loses no text"
assert all(len(part) <= 120 for part in chunks), "complete sentences grouped below target"
assert len(chunks) > len(paragraphs) and all(part.endswith("。") for part in chunks)
assert split_synthesis_text("一句话有逗号，但不要切成短碎片。") == ["一句话有逗号，但不要切成短碎片。"]
assert split_synthesis_text("第一段没有句号\n第二段完整。") == ["第一段没有句号", "第二段完整。"]
assert split_synthesis_text("版本是 1.2，应用是 WeGame，全部保留。") == ["版本是 1.2，应用是 WeGame，全部保留。"]

class Tts:
    stop_flag = False
class Engine(VoiceEngine):
    def __init__(self, failed_part=None, cancel=False):
        super().__init__("", "", "cpu")
        self.tts = Tts()
        self.calls, self.failed_part, self.cancel = [], failed_part, cancel
    def _ensure_model(self, model_id):
        return {"emotions": {"neutral": {"text": "neutral"}, "happy": {"text": "happy"}}}
    def _run_once(self, part, reference, seed):
        self.calls.append((part, reference["text"]))
        self.tts.stop_flag = self.cancel
        samples = 1 if part == self.failed_part else int(32000 * max(1, len(part) * 0.2))
        return 32000, np.ones(samples, dtype=np.int16)

engine = Engine()
rate, audio = engine.synthesize("voice", text, "happy")
assert [part for part, _ in engine.calls] == chunks
assert all(emotion == "happy" for _, emotion in engine.calls)
assert rate == 32000 and len(audio) == sum(int(rate * max(1, len(part) * 0.2)) for part in chunks)
assert judge_audio(len(audio), rate, text) == "ok"

failed = Engine(failed_part=chunks[1])
try:
    failed.synthesize("voice", text, "neutral")
    raise AssertionError("short audio must still fail")
except RuntimeError as error:
    assert str(error) == "synthesis_rejected:short"
assert [part for part, _ in failed.calls] == [chunks[0]] + [chunks[1]] * 3

cancelled = Engine(cancel=True)
try:
    cancelled.synthesize("voice", text, "neutral")
    raise AssertionError("cancel must stop the complete reply")
except InterruptedError:
    pass
assert len(cancelled.calls) == 1

class CancelBetweenChunks(Engine):
    def _synthesize_chunk(self, part, reference):
        result = super()._synthesize_chunk(part, reference)
        self.cancelled.set()
        return result
cancelled_between = CancelBetweenChunks()
try:
    cancelled_between.synthesize("voice", text, "happy")
    raise AssertionError("cancel between chunks must not start another run")
except InterruptedError:
    pass
assert len(cancelled_between.calls) == 1

# The HTTP boundary must pass the whole reply through, including text beyond 400 characters.
class Handler(build_handler(engine)):
    def _read_json(self): return {"text": text * 2, "model_id": "voice", "emotion": "happy"}
    def _send(self, status, body, *args): self.response = (status, body)
handler = object.__new__(Handler)
handler._handle_tts()
assert handler.response[0] == 200
assert "".join(part for part, _ in engine.calls[len(chunks):]) == "".join(paragraphs) * 2
print(json.dumps({"chunks": len(chunks), "cases": 13}))
`;
const result = spawnSync(path.resolve('python/python.exe'), ['-B', '-c', script], {
  encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
});
assert.equal(result.status, 0, result.stderr);
console.log(`GPT-SoVITS long reply passed: ${result.stdout.trim()}`);
