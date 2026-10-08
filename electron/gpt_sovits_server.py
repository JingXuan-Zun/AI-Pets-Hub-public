"""Loopback HTTP sidecar around GPT-SoVITS TTS_infer_pack for v2ProPlus voice packs (fine-tuned or lite).

Verified constraints (docs/voice-gpt-sovits-integration-plan-20261006.md):
- synthesize whole sentences only (cut0); short comma fragments drop words or leak the prompt text;
- empty or implausibly short/long output is retried with a new seed instead of being played.
"""
import argparse
import io
import json
import os
import random
import re
import sys
import threading
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from gpt_sovits_synthesis import split_synthesis_text

MODEL_ID_PATTERN = re.compile(r"^[A-Za-z0-9_-]{1,64}$")
EMOTION_PATTERN = re.compile(r"^[a-z][a-z0-9_-]{0,31}$")
MAX_ATTEMPTS = 3
KNOWN_REQUEST_ERRORS = {"invalid_model_id", "model_not_found", "invalid_manifest"}


def judge_audio(sample_count, sample_rate, text):
    """Classify output length against the text: 'ok', 'empty', 'short' or 'long'."""
    if sample_count <= 0 or sample_rate <= 0:
        return "empty"
    duration = sample_count / sample_rate
    cjk = len(re.findall(r"[一-鿿]", text))
    latin = len(re.findall(r"[A-Za-z0-9]", text))
    expected_min = 0.08 * cjk + 0.03 * latin
    expected_max = 0.6 * cjk + 0.25 * latin + 2.0
    if duration < max(0.25, expected_min):
        return "short"
    if duration > expected_max:
        return "long"
    return "ok"


def install_compat_shims(source_dir):
    """Windows/Python 3.12 shims: jieba_fast has no wheel, fast_langdetect needs its cache dir."""
    try:
        import jieba_fast  # noqa: F401
    except ImportError:
        import jieba
        import jieba.posseg
        sys.modules["jieba_fast"] = jieba
        sys.modules["jieba_fast.posseg"] = jieba.posseg
    os.makedirs(os.path.join(source_dir, "GPT_SoVITS", "pretrained_models", "fast_langdetect"), exist_ok=True)


def resolve_inside(base_dir, relative_path):
    if not isinstance(relative_path, str) or not relative_path.strip() or os.path.isabs(relative_path):
        return None
    resolved = os.path.realpath(os.path.join(base_dir, relative_path))
    base = os.path.realpath(base_dir)
    return resolved if os.path.commonpath([resolved, base]) == base else None


def base_weights(source_dir):
    """Shared pretrained v2ProPlus weights that lite voice packs (reference clips only) run on."""
    pretrained = os.path.join(source_dir, "GPT_SoVITS", "pretrained_models")
    return os.path.join(pretrained, "s1v3.ckpt"), os.path.join(pretrained, "v2Pro", "s2Gv2ProPlus.pth")


def load_manifest(models_root, model_id, source_dir):
    if not MODEL_ID_PATTERN.match(model_id or ""):
        raise ValueError("invalid_model_id")
    model_dir = os.path.join(models_root, model_id)
    try:
        with open(os.path.join(model_dir, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
    except (OSError, ValueError):
        raise ValueError("model_not_found") from None
    emotions = {}
    for key, entry in (manifest.get("emotions") or {}).items():
        wav = resolve_inside(model_dir, (entry or {}).get("wav"))
        text = str((entry or {}).get("text") or "").strip()
        if EMOTION_PATTERN.match(key) and wav and text and os.path.exists(wav):
            emotions[key] = {"wav": wav, "text": text}
    if manifest.get("gpt") is None and manifest.get("sovits") is None:
        gpt, sovits = base_weights(source_dir)  # lite pack
    else:
        gpt = resolve_inside(model_dir, manifest.get("gpt"))
        sovits = resolve_inside(model_dir, manifest.get("sovits"))
    if manifest.get("version") != "v2ProPlus" or not gpt or not sovits or "neutral" not in emotions:
        raise ValueError("invalid_manifest")
    return {"gpt": gpt, "sovits": sovits, "emotions": emotions}


class VoiceEngine:
    def __init__(self, source_dir, models_root, device):
        self.source_dir = source_dir
        self.models_root = models_root
        self.device = device
        self.lock = threading.Lock()
        self.cancelled = threading.Event()
        self.tts = None
        self.model_id = None
        self.weights = None  # (gpt, sovits) currently loaded; lite packs share the base pair

    def _ensure_model(self, model_id):
        manifest = load_manifest(self.models_root, model_id, self.source_dir)
        weights = (manifest["gpt"], manifest["sovits"])
        if self.tts is None:
            from TTS_infer_pack.TTS import TTS, TTS_Config
            pretrained = os.path.join(self.source_dir, "GPT_SoVITS", "pretrained_models")
            self.tts = TTS(TTS_Config({"custom": {
                "bert_base_path": os.path.join(pretrained, "chinese-roberta-wwm-ext-large"),
                "cnhuhbert_base_path": os.path.join(pretrained, "chinese-hubert-base"),
                "device": self.device, "is_half": self.device == "cuda", "version": "v2ProPlus",
                "t2s_weights_path": manifest["gpt"], "vits_weights_path": manifest["sovits"],
            }}))
        elif self.weights != weights:
            self.tts.init_t2s_weights(manifest["gpt"])
            self.tts.init_vits_weights(manifest["sovits"])
        self.weights = weights
        self.model_id = model_id
        return manifest

    def _run_once(self, text, reference, seed):
        import numpy as np
        request = {
            "text": text, "text_lang": "zh", "ref_audio_path": reference["wav"],
            "prompt_text": reference["text"], "prompt_lang": "zh", "top_k": 15, "top_p": 1,
            "temperature": 1, "text_split_method": "cut0", "batch_size": 1, "seed": seed,
            "parallel_infer": False, "repetition_penalty": 1.35, "return_fragment": False,
        }
        sample_rate, chunks = 0, []
        for sample_rate, audio in self.tts.run(request):
            chunks.append(audio)
        return sample_rate, (np.concatenate(chunks) if chunks else np.zeros(0, dtype=np.int16))

    def _synthesize_chunk(self, text, reference):
        verdict = "empty"
        for _ in range(MAX_ATTEMPTS):
            if self.cancelled.is_set():
                raise InterruptedError("cancelled")
            sample_rate, audio = self._run_once(text, reference, random.randint(1, 2**31 - 1))
            if self.cancelled.is_set() or self.tts.stop_flag:
                raise InterruptedError("cancelled")
            verdict = judge_audio(len(audio), sample_rate, text)
            if verdict == "ok":
                return sample_rate, audio
            sys.stderr.write(f"[gpt-sovits] retrying rejected output: {verdict}\n")
        raise RuntimeError(f"synthesis_rejected:{verdict}")

    def synthesize(self, model_id, text, emotion):
        import numpy as np
        with self.lock:
            self.cancelled.clear()
            manifest = self._ensure_model(model_id)
            reference = manifest["emotions"].get(emotion) or manifest["emotions"]["neutral"]
            sample_rate, chunks = 0, []
            for part in split_synthesis_text(text):
                rate, audio = self._synthesize_chunk(part, reference)
                if sample_rate and rate != sample_rate:
                    raise RuntimeError("inconsistent_sample_rate")
                sample_rate = rate
                chunks.append(audio)
            if not chunks:
                raise ValueError("empty_text")
            return sample_rate, np.concatenate(chunks)

    def warmup(self, model_id):
        """Load weights and run one short sentence so the first real reply skips CUDA/kernel init."""
        with self.lock:
            manifest = self._ensure_model(model_id)
            self._run_once("你好。", manifest["emotions"]["neutral"], 1)

    def cancel(self):
        self.cancelled.set()
        if self.tts is not None:
            self.tts.stop()


def encode_wav(sample_rate, audio):
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(sample_rate)
        handle.writeframes(audio.astype("int16").tobytes())
    return buffer.getvalue()


def build_handler(engine):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            sys.stderr.write("[gpt-sovits] " + (fmt % args) + "\n")

        def _send(self, status, body, content_type="application/json; charset=utf-8"):
            data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode("utf-8")
            try:
                self.send_response(status)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Allow-Headers", "Content-Type")
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            except ConnectionError:
                pass  # the renderer aborted (e.g. playback was interrupted); nothing left to deliver

        def do_OPTIONS(self):
            self._send(204, b"")

        def do_GET(self):
            if self.path.split("?")[0] == "/health":
                self._send(200, {"status": "ok", "device": engine.device, "model_id": engine.model_id})
            else:
                self._send(404, {"error": "not_found"})

        def do_POST(self):
            route = self.path.split("?")[0]
            if route == "/cancel":
                engine.cancel()
                self._send(200, {"cancelled": True})
                return
            if route == "/warmup":
                self._handle_warmup()
                return
            if route != "/tts":
                self._send(404, {"error": "not_found"})
                return
            self._handle_tts()

        def _read_json(self):
            length = int(self.headers.get("Content-Length") or 0)
            return json.loads(self.rfile.read(min(length, 65536)).decode("utf-8") or "{}")

        def _handle_warmup(self):
            try:
                engine.warmup(str(self._read_json().get("model_id") or ""))
                self._send(200, {"ok": True, "model_id": engine.model_id})
            except ValueError as error:
                code = str(error)
                self._send(400, {"error": code if code in KNOWN_REQUEST_ERRORS else "invalid_request"})
            except Exception as error:
                sys.stderr.write(f"[gpt-sovits] warmup failed: {error!r}\n")
                self._send(500, {"error": "synthesis_failed"})

        def _handle_tts(self):
            try:
                payload = self._read_json()
                text = str(payload.get("text") or "").strip()
                emotion = str(payload.get("emotion") or "neutral")
                if not text:
                    self._send(400, {"error": "empty_text"})
                    return
                sample_rate, audio = engine.synthesize(str(payload.get("model_id") or ""), text, emotion)
                self._send(200, encode_wav(sample_rate, audio), "audio/wav")
            except InterruptedError:
                self._send(409, {"error": "cancelled"})
            except ValueError as error:
                code = str(error)
                self._send(400, {"error": code if code in KNOWN_REQUEST_ERRORS else "invalid_request"})
            except Exception as error:  # report a code, never a stack trace, to the renderer
                sys.stderr.write(f"[gpt-sovits] synthesis failed: {error!r}\n")
                self._send(500, {"error": "synthesis_failed"})

    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9881)
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--models-root", required=True)
    parser.add_argument("--device", choices=["auto", "cuda", "cpu"], default="auto")
    args = parser.parse_args()
    if args.host not in ("127.0.0.1", "::1"):
        raise SystemExit("loopback only")
    source_dir = os.path.abspath(args.source_dir)
    models_root = os.path.abspath(args.models_root)  # resolve before chdir changes the base
    os.chdir(source_dir)
    sys.path[:0] = [source_dir, os.path.join(source_dir, "GPT_SoVITS")]
    install_compat_shims(source_dir)
    import torch
    device = "cuda" if args.device in ("auto", "cuda") and torch.cuda.is_available() else "cpu"
    engine = VoiceEngine(source_dir, models_root, device)
    server = ThreadingHTTPServer((args.host, args.port), build_handler(engine))
    sys.stderr.write(f"[gpt-sovits] listening on {args.host}:{args.port} device={device}\n")
    server.serve_forever()


if __name__ == "__main__":
    main()
