import argparse
import base64
import importlib.util
import io
import json
import os
import random
import subprocess
import sys
import tempfile
import traceback
import wave
from types import SimpleNamespace

import numpy as np


_CACHED_TTS_MODEL = None
_CACHED_TTS_MODEL_PATH = ""
_CACHED_TTS_RUNTIME_INFO = None
_CACHED_TTS_PROMPT = None
_CACHED_TTS_PROMPT_KEY = ""
_CACHED_STT_MODEL = None
_CACHED_STT_MODEL_PATH = ""
TRIM_SILENCE_WINDOW_MS = 10
TRIM_SILENCE_THRESHOLD = 0.0032
TRIM_SILENCE_MIN_EFFECTIVE_MS = 20
TRIM_SILENCE_HEAD_PAD_MS = 20
TRIM_SILENCE_TAIL_PAD_MS = 30
MOSS_GGUF_BACKEND = "moss_gguf"
MOSS_ZH_TOKENS_PER_CHAR = 3.098411951313033
MOSS_EN_TOKENS_PER_CHAR = 0.8673376262755219
MOSS_DURATION_TOKEN_SCALE = 0.9


def package_available(name: str) -> bool:
    return importlib.util.find_spec(name) is not None


def resolve_language_name(language_code: str | None) -> str | None:
    code = (language_code or "").strip().lower()
    if code.startswith("zh"):
        return "Chinese"
    if code.startswith("en"):
        return "English"
    if code.startswith("ja"):
        return "Japanese"
    if code.startswith("ko"):
        return "Korean"
    if code.startswith("de"):
        return "German"
    if code.startswith("fr"):
        return "French"
    if code.startswith("ru"):
        return "Russian"
    if code.startswith("pt"):
        return "Portuguese"
    if code.startswith("es"):
        return "Spanish"
    if code.startswith("it"):
        return "Italian"
    return None


def read_first_text_file(reference_path: str | None) -> str:
    if not reference_path or not os.path.exists(reference_path):
        return ""

    if os.path.isfile(reference_path):
        stem, _ext = os.path.splitext(reference_path)
        text_path = f"{stem}.txt"
        if os.path.exists(text_path):
            with open(text_path, "r", encoding="utf-8") as handle:
                return handle.read().strip()
        return ""

    for name in sorted(os.listdir(reference_path)):
        if not name.lower().endswith(".txt"):
            continue

        text_path = os.path.join(reference_path, name)
        try:
            with open(text_path, "r", encoding="utf-8") as handle:
                text = handle.read().strip()
        except OSError:
            text = ""

        if text:
            return text

    return ""


def reference_text_from_audio_filename(audio_path: str | None) -> str:
    if not audio_path:
        return ""

    stem, _ext = os.path.splitext(os.path.basename(audio_path))
    text = " ".join(stem.replace("_", " ").replace("-", " ").split()).strip()
    if not text:
        return ""

    compact = "".join(char for char in text.lower() if char.isalnum())
    generic_names = (
        "audio",
        "clone",
        "prompt",
        "recording",
        "ref",
        "reference",
        "sample",
        "speaker",
        "stt",
        "take",
        "tts",
        "voice",
        "wav",
    )
    if not compact or compact.isdigit():
        return ""
    if any(compact == name or (compact.startswith(name) and compact[len(name):].isdigit()) for name in generic_names):
        return ""

    has_cjk_text = any("\u3400" <= char <= "\u9fff" for char in text)
    latin_letter_count = sum(1 for char in text if "a" <= char.lower() <= "z")
    if not has_cjk_text and latin_letter_count < 2:
        return ""

    return text


def read_json_file(json_path: str) -> dict:
    if not json_path or not os.path.exists(json_path):
        return {}

    try:
        with open(json_path, "r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}

    return payload if isinstance(payload, dict) else {}


def detect_moss_text_language(text: str) -> str:
    normalized = text or ""
    zh_chars = sum(1 for char in normalized if "\u4e00" <= char <= "\u9fff")
    en_chars = sum(1 for char in normalized if char.isascii() and char.isalpha())

    if zh_chars == 0 and en_chars == 0:
        return "en"

    return "zh" if zh_chars >= en_chars else "en"


def estimate_moss_duration_tokens(text: str) -> int:
    normalized = (text or "").strip()
    effective_len = max(len(normalized), 1)
    language = detect_moss_text_language(normalized)
    factor = MOSS_ZH_TOKENS_PER_CHAR if language == "zh" else MOSS_EN_TOKENS_PER_CHAR
    base_tokens = max(1, int(effective_len * factor))
    min_tokens = max(1, int(base_tokens * 0.5))
    max_tokens = max(min_tokens, int(base_tokens * 1.5))
    target_tokens = max(min_tokens, min(max_tokens, int(round(base_tokens * MOSS_DURATION_TOKEN_SCALE))))
    return max(1, target_tokens)


def has_cuda_torch_runtime() -> bool:
    if not package_available("torch"):
        return False

    try:
        import torch

        return bool(torch.cuda.is_available())
    except Exception:
        return False


def has_moss_gguf_layout(tts_model_path: str) -> bool:
    if not tts_model_path or not os.path.isdir(tts_model_path):
        return False

    gguf_path = resolve_moss_gguf_path(tts_model_path)
    return bool(
        gguf_path
        and os.path.isdir(os.path.join(tts_model_path, "embeddings"))
        and os.path.isdir(os.path.join(tts_model_path, "lm_heads"))
        and os.path.exists(os.path.join(tts_model_path, "tokenizer", "tokenizer.json"))
    )


def resolve_moss_gguf_path(tts_model_path: str) -> str:
    if not tts_model_path or not os.path.isdir(tts_model_path):
        return ""

    preferred_path = os.path.join(tts_model_path, "MOSS_TTS_Q4_K_M.gguf")
    if os.path.exists(preferred_path):
        return preferred_path

    try:
        names = sorted(os.listdir(tts_model_path))
    except OSError:
        return ""

    for name in names:
        if name.lower().endswith(".gguf"):
            return os.path.join(tts_model_path, name)
    return ""


def resolve_moss_audio_tokenizer_dir(tts_model_path: str) -> str:
    env_dir = (os.environ.get("MOSS_AUDIO_TOKENIZER_DIR") or "").strip()
    candidates = []
    if env_dir:
        candidates.append(env_dir)

    model_parent = os.path.dirname(tts_model_path)
    voice_root = os.path.dirname(model_parent)
    candidates.extend([
        os.path.join(tts_model_path, "audio-tokenizer"),
        os.path.join(tts_model_path, "MOSS-Audio-Tokenizer-ONNX"),
        os.path.join(model_parent, "MOSS-Audio-Tokenizer-ONNX"),
        os.path.join(voice_root, "MOSS-Audio-Tokenizer-ONNX"),
        os.path.join(voice_root, "audio-tokenizer"),
    ])

    for candidate in candidates:
        if not candidate:
            continue
        encoder_path = os.path.join(candidate, "encoder.onnx")
        decoder_path = os.path.join(candidate, "decoder.onnx")
        if os.path.exists(encoder_path) and os.path.exists(decoder_path):
            return candidate

    return ""


def resolve_moss_tts_code_dir(tts_model_path: str) -> str:
    env_dir = (os.environ.get("MOSS_TTS_DIR") or os.environ.get("MOSS_TTS_ROOT") or "").strip()
    candidates = []
    if env_dir:
        candidates.append(env_dir)

    model_parent = os.path.dirname(tts_model_path)
    voice_root = os.path.dirname(model_parent)
    candidates.extend([
        os.path.join(tts_model_path, "MOSS-TTS"),
        os.path.join(model_parent, "MOSS-TTS"),
        os.path.join(voice_root, "MOSS-TTS"),
    ])

    for candidate in candidates:
        if (
            candidate
            and os.path.isdir(candidate)
            and os.path.exists(os.path.join(candidate, "moss_tts_delay", "llama_cpp", "__main__.py"))
        ):
            return candidate

    return ""


def ensure_moss_tts_code_on_path(tts_model_path: str) -> str:
    code_dir = resolve_moss_tts_code_dir(tts_model_path)
    if code_dir and code_dir not in sys.path:
        sys.path.insert(0, code_dir)
    if code_dir:
        os.environ.setdefault("MOSS_TTS_DIR", code_dir)
        os.environ.setdefault("MOSS_TTS_ROOT", code_dir)
    return code_dir


def resolve_moss_gguf_assets(tts_model_path: str) -> dict:
    gguf_path = resolve_moss_gguf_path(tts_model_path)
    audio_tokenizer_dir = resolve_moss_audio_tokenizer_dir(tts_model_path)
    encoder_path = os.path.join(audio_tokenizer_dir, "encoder.onnx") if audio_tokenizer_dir else ""
    decoder_path = os.path.join(audio_tokenizer_dir, "decoder.onnx") if audio_tokenizer_dir else ""
    tokenizer_dir = os.path.join(tts_model_path, "tokenizer")
    embedding_dir = os.path.join(tts_model_path, "embeddings")
    lm_head_dir = os.path.join(tts_model_path, "lm_heads")
    missing = []

    if not gguf_path:
        missing.append("MOSS_TTS_Q4_K_M.gguf")
    if not os.path.isdir(embedding_dir):
        missing.append("embeddings/")
    if not os.path.isdir(lm_head_dir):
        missing.append("lm_heads/")
    if not os.path.exists(os.path.join(tokenizer_dir, "tokenizer.json")):
        missing.append("tokenizer/tokenizer.json")
    if not encoder_path or not os.path.exists(encoder_path):
        missing.append("MOSS-Audio-Tokenizer-ONNX/encoder.onnx")
    if not decoder_path or not os.path.exists(decoder_path):
        missing.append("MOSS-Audio-Tokenizer-ONNX/decoder.onnx")

    return {
        "gguf_path": gguf_path,
        "audio_tokenizer_dir": audio_tokenizer_dir,
        "audio_encoder_onnx": encoder_path,
        "audio_decoder_onnx": decoder_path,
        "tokenizer_dir": tokenizer_dir,
        "embedding_dir": embedding_dir,
        "lm_head_dir": lm_head_dir,
        "missing": missing,
    }


def resolve_moss_bridge_library() -> str:
    try:
        module_spec = importlib.util.find_spec("moss_tts_delay.llama_cpp.backbone")
    except (ImportError, ValueError):
        module_spec = None

    bridge_names = ["backbone_bridge.dll"] if os.name == "nt" else ["libbackbone_bridge.so"]
    candidates = []
    if module_spec and module_spec.origin:
        module_dir = os.path.dirname(module_spec.origin)
        for bridge_name in bridge_names:
            candidates.extend([
                os.path.join(module_dir, bridge_name),
                os.path.join(module_dir, "build", bridge_name),
            ])

    env_path = (os.environ.get("MOSS_TTS_BRIDGE_LIB") or "").strip()
    if env_path:
        candidates.insert(0, env_path)

    for candidate in candidates:
        if candidate and os.path.exists(candidate):
            return candidate

    return ""


def get_torch_runtime():
    import torch
    configure_torch_runtime(torch)

    if torch.cuda.is_available():
        return torch, "cuda:0", torch.float16, "cuda"
    return torch, "cpu", torch.float32, "cpu"


def get_torch_dtype_name(dtype) -> str:
    text = str(dtype)
    return text.split(".")[-1] if "." in text else text


def configure_torch_runtime(torch):
    try:
        if hasattr(torch, "set_float32_matmul_precision"):
            torch.set_float32_matmul_precision("high")
    except Exception:
        pass

    try:
        torch.backends.cudnn.benchmark = True
    except Exception:
        pass

    try:
        if hasattr(torch.backends, "cuda") and hasattr(torch.backends.cuda, "matmul"):
            torch.backends.cuda.matmul.allow_tf32 = True
    except Exception:
        pass

    try:
        if hasattr(torch.backends, "cudnn"):
            torch.backends.cudnn.allow_tf32 = True
    except Exception:
        pass


def get_tts_model_metadata(tts_model_path: str) -> dict:
    config = read_json_file(os.path.join(tts_model_path, "config.json"))
    model_size = str(config.get("tts_model_size") or "").strip().lower()
    transformers_version = str(config.get("transformers_version") or "").strip()
    model_type = str(config.get("model_type") or "").strip().lower()
    tts_model_type = str(config.get("tts_model_type") or "").strip().lower()
    model_name = os.path.basename(tts_model_path or "").strip().lower()
    family_hint = " ".join([model_type, tts_model_type, model_name])

    if has_moss_gguf_layout(tts_model_path):
        backend = MOSS_GGUF_BACKEND
    else:
        backend = "moss" if "moss" in family_hint else "qwen"

    return {
        "model_type": model_type,
        "tts_model_type": tts_model_type,
        "tts_model_size": model_size,
        "transformers_version": transformers_version,
        "backend": backend,
    }


def resolve_tts_load_attempts(tts_model_path: str) -> list[dict]:
    torch, device_map, default_dtype, device = get_torch_runtime()
    metadata = get_tts_model_metadata(tts_model_path)
    model_size = metadata.get("tts_model_size") or ""
    backend = metadata.get("backend") or "qwen"
    flash_attn_available = package_available("flash_attn")
    bf16_supported = bool(
        device == "cuda"
        and hasattr(torch.cuda, "is_bf16_supported")
        and torch.cuda.is_bf16_supported()
    )

    attempts: list[dict] = []
    seen_keys: set[tuple[str, str]] = set()

    def add_attempt(dtype, attn_implementation: str | None, reason: str):
        if dtype is None:
            return

        dtype_name = get_torch_dtype_name(dtype)
        attn_label = (attn_implementation or "eager").strip().lower()
        key = (dtype_name, attn_label)
        if key in seen_keys:
            return
        seen_keys.add(key)

        attempts.append({
            "device": device,
            "device_map": device_map,
            "dtype": dtype,
            "dtype_name": dtype_name,
            "attn_implementation": attn_implementation,
            "attn_label": attn_label,
            "model_size": model_size,
            "reason": reason,
        })

    if backend in {"moss", MOSS_GGUF_BACKEND}:
        if device == "cuda":
            if bf16_supported:
                add_attempt(torch.bfloat16, "sdpa", "moss bf16 sdpa")
                add_attempt(torch.bfloat16, None, "moss bf16 eager")
            add_attempt(torch.float16, "sdpa", "moss fp16 sdpa")
            add_attempt(torch.float16, None, "moss fp16 eager")
            if flash_attn_available:
                if bf16_supported:
                    add_attempt(torch.bfloat16, "flash_attention_2", "moss bf16 flash-attn")
                add_attempt(torch.float16, "flash_attention_2", "moss fp16 flash-attn")
        else:
            add_attempt(default_dtype, None, "moss cpu eager")
    else:
        if device == "cuda" and model_size == "0b6":
            if bf16_supported:
                add_attempt(torch.bfloat16, None, "0.6B prefer bf16 eager")
            add_attempt(torch.float16, None, "0.6B fallback fp16 eager")
            if flash_attn_available:
                if bf16_supported:
                    add_attempt(torch.bfloat16, "flash_attention_2", "0.6B bf16 flash-attn")
                add_attempt(torch.float16, "flash_attention_2", "0.6B fp16 flash-attn")
        else:
            add_attempt(default_dtype, None, "default eager")
            if device == "cuda" and flash_attn_available:
                add_attempt(default_dtype, "flash_attention_2", "default flash-attn")

    if not attempts:
        add_attempt(default_dtype, None, "final fallback")

    return attempts


def write_json(payload: dict, newline: bool = False):
    text = json.dumps(payload, ensure_ascii=False)
    sys.stdout.write(f"{text}\n" if newline else text)
    sys.stdout.flush()


def json_ok(payload: dict):
    payload.setdefault("ok", True)
    write_json(payload)


def json_error(message: str, extra: dict | None = None, exit_code: int = 1):
    payload = {"ok": False, "error": message}
    if extra:
        payload.update(extra)
    write_json(payload)
    raise SystemExit(exit_code)


def worker_ok(request_id: str | None, payload: dict):
    payload.setdefault("ok", True)
    payload["id"] = request_id
    write_json(payload, newline=True)


def worker_error(request_id: str | None, message: str, extra: dict | None = None):
    payload = {
        "id": request_id,
        "ok": False,
        "error": message,
    }
    if extra:
        payload.update(extra)
    write_json(payload, newline=True)


def validate_existing_path(target_path: str | None, error_message: str):
    if not target_path or not os.path.exists(target_path):
        raise RuntimeError(error_message)


def resolve_sensevoice_model_file(stt_model_path: str) -> str:
    """SenseVoice (sherpa-onnx) model folders hold model(.int8).onnx + tokens.txt instead of a HF checkpoint."""
    if not os.path.isfile(os.path.join(stt_model_path, "tokens.txt")):
        return ""
    for name in ("model.int8.onnx", "model.onnx"):
        candidate = os.path.join(stt_model_path, name)
        if os.path.isfile(candidate):
            return candidate
    return ""


def load_sensevoice_recognizer(stt_model_path: str):
    if not package_available("sherpa_onnx"):
        raise RuntimeError("Missing sherpa-onnx dependency for the SenseVoice speech model.")
    import sherpa_onnx

    return sherpa_onnx.OfflineRecognizer.from_sense_voice(
        model=resolve_sensevoice_model_file(stt_model_path),
        tokens=os.path.join(stt_model_path, "tokens.txt"),
        language="auto",
        use_itn=True,
        num_threads=4,
    )


def transcribe_sensevoice(recognizer, audio_path: str) -> tuple[str, str]:
    """Returns (text, emotion) where emotion is SenseVoice's tag such as "happy" or "neutral"."""
    import soundfile as sf

    samples, sample_rate = sf.read(audio_path, dtype="float32", always_2d=True)
    samples = samples.mean(axis=1)
    if sample_rate != 16000 and len(samples) > 1:
        target_length = max(1, int(round(len(samples) * 16000 / sample_rate)))
        samples = np.interp(
            np.linspace(0, len(samples) - 1, target_length), np.arange(len(samples)), samples,
        ).astype(np.float32)
    stream = recognizer.create_stream()
    stream.accept_waveform(16000, samples)
    recognizer.decode_stream(stream)
    emotion = str(getattr(stream.result, "emotion", "") or "").strip("<|>").lower()
    return (stream.result.text or "").strip(), emotion


def load_stt_model(stt_model_path: str):
    global _CACHED_STT_MODEL
    global _CACHED_STT_MODEL_PATH

    if _CACHED_STT_MODEL is not None and _CACHED_STT_MODEL_PATH == stt_model_path:
        return _CACHED_STT_MODEL

    if resolve_sensevoice_model_file(stt_model_path):
        _CACHED_STT_MODEL = load_sensevoice_recognizer(stt_model_path)
        _CACHED_STT_MODEL_PATH = stt_model_path
        return _CACHED_STT_MODEL

    if not package_available("qwen_asr"):
        raise RuntimeError("Missing qwen_asr dependency. Please install the local speech dependency first.")

    _torch, device_map, dtype, _device = get_torch_runtime()
    from qwen_asr import Qwen3ASRModel

    model = Qwen3ASRModel.from_pretrained(
        stt_model_path,
        dtype=dtype,
        device_map=device_map,
        max_new_tokens=256,
    )
    _CACHED_STT_MODEL = model
    _CACHED_STT_MODEL_PATH = stt_model_path
    return model


def resolve_tts_backend(tts_model_path: str) -> str:
    metadata = get_tts_model_metadata(tts_model_path)
    backend = str(metadata.get("backend") or "").strip().lower()
    return backend if backend in {"qwen", "moss", MOSS_GGUF_BACKEND} else "qwen"


def load_moss_tts_model(tts_model_path: str):
    global _CACHED_TTS_MODEL
    global _CACHED_TTS_MODEL_PATH
    global _CACHED_TTS_RUNTIME_INFO

    if _CACHED_TTS_MODEL is not None and _CACHED_TTS_MODEL_PATH == tts_model_path:
        return _CACHED_TTS_MODEL

    if not package_available("transformers"):
        raise RuntimeError("Missing transformers dependency. Please install the local speech dependency first.")

    import torch
    from transformers import AutoModel, AutoProcessor

    _torch, _device_map, default_dtype, device = get_torch_runtime()
    bf16_supported = bool(
        device == "cuda"
        and hasattr(torch.cuda, "is_bf16_supported")
        and torch.cuda.is_bf16_supported()
    )
    dtype = torch.bfloat16 if bf16_supported else (
        torch.float16 if device == "cuda" else default_dtype
    )
    attn_implementation = "sdpa" if device == "cuda" else "eager"
    metadata = get_tts_model_metadata(tts_model_path)

    processor = AutoProcessor.from_pretrained(
        tts_model_path,
        trust_remote_code=True,
    )
    if hasattr(processor, "audio_tokenizer") and processor.audio_tokenizer is not None and hasattr(processor.audio_tokenizer, "to"):
        processor.audio_tokenizer = processor.audio_tokenizer.to("cuda:0" if device == "cuda" else "cpu")
    model = AutoModel.from_pretrained(
        tts_model_path,
        trust_remote_code=True,
        torch_dtype=dtype,
        attn_implementation=attn_implementation,
    )
    if device == "cuda":
        model = model.to("cuda:0")

    model.eval()
    _CACHED_TTS_MODEL = {
        "backend": "moss",
        "model": model,
        "processor": processor,
    }
    _CACHED_TTS_MODEL_PATH = tts_model_path
    _CACHED_TTS_RUNTIME_INFO = {
        "runtime_device": "cuda" if device == "cuda" else "cpu",
        "runtime_dtype": get_torch_dtype_name(dtype),
        "attn_implementation": attn_implementation,
        "tts_model_size": metadata.get("tts_model_size") or "",
        "transformers_version": metadata.get("transformers_version") or "",
        "load_reason": "moss direct generation",
        "load_attempt_index": 1,
        "load_attempt_total": 1,
    }
    return _CACHED_TTS_MODEL


def load_moss_gguf_tts_model(tts_model_path: str):
    global _CACHED_TTS_MODEL
    global _CACHED_TTS_MODEL_PATH
    global _CACHED_TTS_RUNTIME_INFO

    if _CACHED_TTS_MODEL is not None and _CACHED_TTS_MODEL_PATH == tts_model_path:
        return _CACHED_TTS_MODEL

    code_dir = ensure_moss_tts_code_on_path(tts_model_path)
    assets = resolve_moss_gguf_assets(tts_model_path)
    missing = list(assets.get("missing") or [])
    if not code_dir:
        missing.append("local-models/voice/MOSS-TTS/")
    bridge_library = resolve_moss_bridge_library()
    if not bridge_library:
        missing.append("moss_tts_delay/llama_cpp/backbone_bridge.dll" if os.name == "nt" else "moss_tts_delay/llama_cpp/libbackbone_bridge.so")

    missing_packages = [
        name for name in ["moss_tts_delay", "moss_audio_tokenizer"]
        if not package_available(name)
    ]

    if missing or missing_packages:
        parts = []
        if missing:
            parts.append("缺少模型文件：" + ", ".join(missing))
        if missing_packages:
            parts.append("缺少 Python 包：" + ", ".join(missing_packages))
        parts.append(
            "请把 OpenMOSS-Team/MOSS-Audio-Tokenizer-ONNX 放到 local-models/voice/MOSS-Audio-Tokenizer-ONNX，"
            "并安装/放入 OpenMOSS/MOSS-TTS 的 moss_tts_delay 与 moss_audio_tokenizer 代码，"
            "再按官方说明编译 llama.cpp C bridge。"
        )
        raise RuntimeError("MOSS GGUF 本地播报还不能启动。" + " ".join(parts))

    _CACHED_TTS_MODEL = {
        "backend": MOSS_GGUF_BACKEND,
        "assets": assets,
    }
    _CACHED_TTS_MODEL_PATH = tts_model_path
    _CACHED_TTS_RUNTIME_INFO = {
        "runtime_device": "cuda",
        "runtime_dtype": "q4_k_m",
        "attn_implementation": "llama.cpp",
        "tts_model_size": "8b",
        "transformers_version": "",
        "load_reason": "moss gguf llama.cpp pipeline",
        "load_attempt_index": 1,
        "load_attempt_total": 1,
    }
    return _CACHED_TTS_MODEL


def load_tts_model(tts_model_path: str):
    global _CACHED_TTS_MODEL
    global _CACHED_TTS_MODEL_PATH
    global _CACHED_TTS_RUNTIME_INFO

    if _CACHED_TTS_MODEL is not None and _CACHED_TTS_MODEL_PATH == tts_model_path:
        return _CACHED_TTS_MODEL

    backend = resolve_tts_backend(tts_model_path)
    if backend == MOSS_GGUF_BACKEND:
        return load_moss_gguf_tts_model(tts_model_path)
    if backend == "moss":
        return load_moss_tts_model(tts_model_path)

    if not package_available("qwen_tts"):
        raise RuntimeError("Missing qwen_tts dependency. Please install the local speech dependency first.")

    from qwen_tts import Qwen3TTSModel

    attempts = resolve_tts_load_attempts(tts_model_path)
    metadata = get_tts_model_metadata(tts_model_path)
    failures: list[str] = []

    for index, attempt in enumerate(attempts, start=1):
        load_kwargs = {
            "device_map": attempt["device_map"],
            "dtype": attempt["dtype"],
        }
        if attempt["attn_implementation"]:
            load_kwargs["attn_implementation"] = attempt["attn_implementation"]

        try:
            model = Qwen3TTSModel.from_pretrained(tts_model_path, **load_kwargs)
        except Exception as error:
            failures.append(
                f"attempt {index}/{len(attempts)} "
                f"({attempt['dtype_name']}, {attempt['attn_label']}): {error}"
            )
            try:
                import gc

                gc.collect()
            except Exception:
                pass

            if attempt["device"] == "cuda":
                try:
                    import torch

                    torch.cuda.empty_cache()
                except Exception:
                    pass
            continue

        _CACHED_TTS_MODEL = model
        _CACHED_TTS_MODEL_PATH = tts_model_path
        _CACHED_TTS_RUNTIME_INFO = {
            "runtime_device": attempt["device"],
            "runtime_dtype": attempt["dtype_name"],
            "attn_implementation": attempt["attn_label"],
            "tts_model_size": attempt["model_size"] or metadata.get("tts_model_size") or "",
            "transformers_version": metadata.get("transformers_version") or "",
            "load_reason": attempt["reason"],
            "load_attempt_index": index,
            "load_attempt_total": len(attempts),
        }
        return model

    model_size = metadata.get("tts_model_size") or "unknown"
    attempted_modes = ", ".join(
        f"{attempt['dtype_name']}+{attempt['attn_label']}" for attempt in attempts
    ) or "none"
    last_error = failures[-1] if failures else "unknown error"
    raise RuntimeError(
        "Failed to load local TTS model. "
        f"model_size={model_size}; attempted={attempted_modes}; last_error={last_error}"
    )


def build_tts_prompt_cache_key(
    tts_model_path: str,
    reference_audio_path: str,
    reference_text: str,
    x_vector_only_mode: bool,
    language_code: str | None,
) -> str:
    return "\n".join([
        (tts_model_path or "").strip(),
        (reference_audio_path or "").strip(),
        (reference_text or "").strip(),
        "x_vector_only" if x_vector_only_mode else "voice_clone_text",
        (language_code or "").strip(),
    ])


def get_tts_voice_clone_prompt(args, reference_text: str):
    global _CACHED_TTS_PROMPT
    global _CACHED_TTS_PROMPT_KEY

    x_vector_only_mode = not bool((reference_text or "").strip())
    prompt_cache_key = build_tts_prompt_cache_key(
        args.tts_model_path,
        args.reference_audio_path,
        reference_text,
        x_vector_only_mode,
        args.language_code,
    )

    if _CACHED_TTS_PROMPT is not None and _CACHED_TTS_PROMPT_KEY == prompt_cache_key:
        return _CACHED_TTS_PROMPT, True, x_vector_only_mode

    model = load_tts_model(args.tts_model_path)
    prompt_items = model.create_voice_clone_prompt(
        ref_audio=args.reference_audio_path,
        ref_text=reference_text,
        x_vector_only_mode=x_vector_only_mode,
    )
    _CACHED_TTS_PROMPT = prompt_items
    _CACHED_TTS_PROMPT_KEY = prompt_cache_key
    return prompt_items, False, x_vector_only_mode


def run_health(_args):
    detected_packages = [
        name for name in ["numpy", "torch", "qwen_tts", "qwen_asr"]
        if package_available(name)
    ]
    missing_packages = [
        name for name in ["torch", "qwen_tts", "qwen_asr"]
        if not package_available(name)
    ]

    device = "unknown"
    messages = []

    if package_available("torch"):
        try:
            _torch, _device_map, _dtype, device = get_torch_runtime()
        except Exception as error:
            messages.append(f"PyTorch check failed: {error}")

    if missing_packages:
        messages.append("Local voice environment found, but some Python dependencies are missing.")
    else:
        messages.append("Local voice environment and required dependencies are available.")

    json_ok({
        "available": True,
        "status": "ready" if not missing_packages else "missing-dependencies",
        "runtime_label": "python",
        "executable": sys.executable,
        "python_version": sys.version.split()[0],
        "device": device,
        "detected_packages": detected_packages,
        "missing_packages": missing_packages,
        "messages": messages,
    })


def transcribe_audio(audio_path: str, stt_model_path: str, language_code: str | None):
    model = load_stt_model(stt_model_path)
    results = model.transcribe(
        audio=audio_path,
        language=resolve_language_name(language_code),
    )
    if not results:
        return ""

    first = results[0]
    return (getattr(first, "text", "") or "").strip()


def perform_stt(args):
    validate_existing_path(args.audio_path, "Audio file to transcribe was not found.")
    validate_existing_path(args.stt_model_path, "Selected local STT model path does not exist.")

    if resolve_sensevoice_model_file(args.stt_model_path):
        text, emotion = transcribe_sensevoice(load_stt_model(args.stt_model_path), args.audio_path)
        if not text:
            raise RuntimeError("Local transcription did not return valid text.")
        return {"text": text, "emotion": emotion}

    text = transcribe_audio(args.audio_path, args.stt_model_path, args.language_code)
    if not text:
        raise RuntimeError("Local transcription did not return valid text.")

    return {"text": text}


def build_wav_bytes(audio_samples: np.ndarray, sample_rate: int) -> bytes:
    clipped = np.clip(audio_samples, -1.0, 1.0)
    pcm16 = (clipped * 32767).astype(np.int16)
    buffer = io.BytesIO()
    with wave.open(buffer, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(pcm16.tobytes())

    return buffer.getvalue()


def encode_wav_base64_from_bytes(wav_bytes: bytes) -> str:
    return base64.b64encode(wav_bytes).decode("ascii")


def write_wav_file(output_audio_path: str, wav_bytes: bytes) -> str:
    normalized_output_path = os.path.abspath(output_audio_path)
    output_dir = os.path.dirname(normalized_output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(normalized_output_path, "wb") as handle:
        handle.write(wav_bytes)

    return normalized_output_path


def trim_generated_audio_silence(audio_samples: np.ndarray, sample_rate: int) -> tuple[np.ndarray, dict]:
    samples = np.asarray(audio_samples, dtype=np.float32).reshape(-1)
    total_samples = int(samples.shape[0])

    if total_samples <= 0 or sample_rate <= 0:
        return samples, {
            "trimmed_lead_ms": 0,
            "trimmed_tail_ms": 0,
            "trimmed": False,
        }

    window_size = max(1, int(sample_rate * TRIM_SILENCE_WINDOW_MS / 1000))
    rms_values: list[float] = []

    for start in range(0, total_samples, window_size):
        part = samples[start:start + window_size]
        if part.size == 0:
            continue

        rms_values.append(float(np.sqrt(np.mean(np.square(part, dtype=np.float32)))))

    first_index = next((index for index, value in enumerate(rms_values) if value > TRIM_SILENCE_THRESHOLD), None)
    last_index = next((index for index in range(len(rms_values) - 1, -1, -1) if rms_values[index] > TRIM_SILENCE_THRESHOLD), None)

    if first_index is None or last_index is None:
        return samples, {
            "trimmed_lead_ms": 0,
            "trimmed_tail_ms": 0,
            "trimmed": False,
        }

    head_pad_samples = int(sample_rate * TRIM_SILENCE_HEAD_PAD_MS / 1000)
    tail_pad_samples = int(sample_rate * TRIM_SILENCE_TAIL_PAD_MS / 1000)
    start_sample = max(0, first_index * window_size - head_pad_samples)
    end_sample = min(total_samples, (last_index + 1) * window_size + tail_pad_samples)

    if end_sample <= start_sample:
        return samples, {
            "trimmed_lead_ms": 0,
            "trimmed_tail_ms": 0,
            "trimmed": False,
        }

    trimmed_lead_ms = round(start_sample / sample_rate * 1000)
    trimmed_tail_ms = round(max(0, total_samples - end_sample) / sample_rate * 1000)
    if trimmed_lead_ms + trimmed_tail_ms < TRIM_SILENCE_MIN_EFFECTIVE_MS:
        return samples, {
            "trimmed_lead_ms": 0,
            "trimmed_tail_ms": 0,
            "trimmed": False,
        }

    return samples[start_sample:end_sample], {
        "trimmed_lead_ms": int(trimmed_lead_ms),
        "trimmed_tail_ms": int(trimmed_tail_ms),
        "trimmed": True,
    }


def resolve_reference_text(args) -> str:
    direct_text = (args.reference_text or "").strip()
    if direct_text:
        return direct_text

    file_text = read_first_text_file(args.reference_path)
    if file_text:
        return file_text

    file_name_text = reference_text_from_audio_filename(args.reference_audio_path)
    if file_name_text:
        return file_name_text

    stt_model_path = (args.reference_stt_model_path or "").strip()
    if stt_model_path and os.path.exists(stt_model_path):
        try:
            transcribed_text = transcribe_audio(args.reference_audio_path, stt_model_path, args.language_code)
        except Exception:
            transcribed_text = ""

        if transcribed_text:
            return transcribed_text

    return ""


def parse_seed_value(raw_seed) -> int | None:
    try:
        text = str(raw_seed or "").strip()
        if not text:
            return None
        seed = int(text)
    except (TypeError, ValueError):
        return None

    return seed if seed >= 0 else None


def extract_moss_audio_waveform(processor, decoded_messages):
    if not decoded_messages:
        raise RuntimeError("MOSS 本地播报没有生成有效音频。")

    first_message = decoded_messages[0]
    audio_segments = getattr(first_message, "audio_codes_list", None)
    if audio_segments is None and isinstance(first_message, dict):
        audio_segments = first_message.get("audio_codes_list")

    if not audio_segments:
        raise RuntimeError("MOSS 本地播报没有生成有效音频。")

    if not hasattr(processor, "decode_audio_codes"):
        raise RuntimeError("MOSS processor does not expose decode_audio_codes().")

    decoded_audio_list = processor.decode_audio_codes(audio_segments)
    if not decoded_audio_list:
        raise RuntimeError("MOSS audio tokenizer did not decode any waveform.")

    waveform = decoded_audio_list[0]
    if hasattr(waveform, "detach"):
        waveform = waveform.detach().cpu().numpy()

    return np.asarray(waveform, dtype=np.float32).reshape(-1)


def apply_tts_generation_seed(seed: int | None):
    if seed is None:
        return

    random.seed(seed)
    np.random.seed(seed % (2**32 - 1))

    if package_available("torch"):
        import torch

        torch.manual_seed(seed)
        if torch.cuda.is_available():
            torch.cuda.manual_seed_all(seed)


def synthesize_moss_tts(args):
    model_bundle = load_moss_tts_model(args.tts_model_path)
    model = model_bundle["model"]
    processor = model_bundle["processor"]
    text = (args.text or "").strip()
    reference_audio_path = (args.reference_audio_path or "").strip()
    duration_tokens = estimate_moss_duration_tokens(text)
    model_config = getattr(processor, "model_config", None)
    sample_rate = int(getattr(model_config, "sampling_rate", 24000) or 24000)

    if args.prime_only:
        return {
            "primed": True,
            "reference_text": "",
            "prompt_cache_hit": False,
            **(_CACHED_TTS_RUNTIME_INFO or {}),
        }

    prompt = processor.build_user_message(text=text, reference=[reference_audio_path], tokens=duration_tokens)
    batch = processor([prompt], mode="generation")

    import torch

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    input_ids = batch["input_ids"].to(device)
    attention_mask = batch["attention_mask"].to(device)

    with torch.inference_mode():
        generated = model.generate(
            input_ids=input_ids,
            attention_mask=attention_mask,
            max_new_tokens=min(max(duration_tokens * 6, 128), 2048),
        )

    decoded = processor.decode(generated)
    audio = extract_moss_audio_waveform(processor, decoded)
    trimmed_audio, trim_info = trim_generated_audio_silence(audio, sample_rate)
    wav_bytes = build_wav_bytes(trimmed_audio, sample_rate)
    output_audio_path = (args.output_audio_path or "").strip()
    audio_file_path = ""
    audio_base64 = ""

    if output_audio_path:
        audio_file_path = write_wav_file(output_audio_path, wav_bytes)
    else:
        audio_base64 = encode_wav_base64_from_bytes(wav_bytes)

    return {
        "audio_base64": audio_base64,
        "audio_file_path": audio_file_path,
        "mime_type": "audio/wav",
        "sample_rate": sample_rate,
        "seed": None,
        "reference_text": "",
        "prompt_cache_hit": False,
        "trimmed_lead_ms": trim_info["trimmed_lead_ms"],
        "trimmed_tail_ms": trim_info["trimmed_tail_ms"],
        "trimmed_silence": trim_info["trimmed"],
        **(_CACHED_TTS_RUNTIME_INFO or {}),
    }


def synthesize_moss_gguf_tts(args):
    model_bundle = load_moss_gguf_tts_model(args.tts_model_path)
    assets = model_bundle["assets"]
    code_dir = ensure_moss_tts_code_on_path(args.tts_model_path)
    text = (args.text or "").strip()
    duration_tokens = estimate_moss_duration_tokens(text)
    cuda_runtime = has_cuda_torch_runtime()
    output_audio_path = (args.output_audio_path or "").strip()

    if args.prime_only:
        return {
            "primed": True,
            "reference_text": "",
            "prompt_cache_hit": False,
            **(_CACHED_TTS_RUNTIME_INFO or {}),
        }

    if not output_audio_path:
        output_audio_path = os.path.join(tempfile.gettempdir(), f"moss-tts-{os.getpid()}-{random.randint(1000, 9999)}.wav")

    def yaml_quote(value: str) -> str:
        return "'" + str(value).replace("'", "''") + "'"

    config_text = "\n".join([
        f"backbone_gguf: {yaml_quote(assets['gguf_path'])}",
        f"embedding_dir: {yaml_quote(assets['embedding_dir'])}",
        f"lm_head_dir: {yaml_quote(assets['lm_head_dir'])}",
        f"tokenizer_dir: {yaml_quote(assets['tokenizer_dir'])}",
        "",
        "audio_backend: onnx",
        f"audio_encoder_onnx: {yaml_quote(assets['audio_encoder_onnx'])}",
        f"audio_decoder_onnx: {yaml_quote(assets['audio_decoder_onnx'])}",
        "",
        f"heads_backend: {'torch' if cuda_runtime else 'numpy'}",
        "n_ctx: 4096",
        f"n_batch: {512 if cuda_runtime else 256}",
        f"n_threads: {max(4, min((os.cpu_count() or 8), 8))}",
        "n_gpu_layers: -1",
        f"max_new_tokens: {min(max(duration_tokens * 6, 96), 1024)}",
        f"use_gpu_audio: {'true' if cuda_runtime else 'false'}",
        "",
        "text_temperature: 1.5",
        "text_top_p: 1.0",
        "text_top_k: 50",
        "audio_temperature: 1.7",
        "audio_top_p: 0.8",
        "audio_top_k: 25",
        "audio_repetition_penalty: 1.0",
        "",
    ])
    config_handle = tempfile.NamedTemporaryFile(
        mode="w",
        encoding="utf-8",
        suffix=".yaml",
        prefix="moss-tts-",
        delete=False,
    )
    try:
        config_handle.write(config_text)
        config_path = config_handle.name
    finally:
        config_handle.close()

    command = [
        sys.executable,
        "-m",
        "moss_tts_delay.llama_cpp",
        "--config",
        config_path,
        "--output",
        output_audio_path,
        "--text",
        f"${{token:{duration_tokens}}}{text}",
    ]

    reference_audio_path = (args.reference_audio_path or "").strip()
    if reference_audio_path and os.path.exists(reference_audio_path):
        command.extend(["--reference", reference_audio_path])

    seed = parse_seed_value(args.seed)
    apply_tts_generation_seed(seed)

    env = os.environ.copy()
    env.setdefault("MOSS_AUDIO_TOKENIZER_DIR", assets["audio_tokenizer_dir"])
    if code_dir:
        env.setdefault("MOSS_TTS_DIR", code_dir)
        env.setdefault("MOSS_TTS_ROOT", code_dir)
        env["PYTHONPATH"] = code_dir + (os.pathsep + env["PYTHONPATH"] if env.get("PYTHONPATH") else "")
    try:
        completed = subprocess.run(
            command,
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
        )
    finally:
        try:
            os.unlink(config_path)
        except OSError:
            pass

    if completed.returncode != 0 or not os.path.exists(output_audio_path):
        detail = (completed.stderr or completed.stdout or "").strip()
        raise RuntimeError(
            "MOSS GGUF 本地播报失败。"
            + (f" 运行输出：{detail[-1200:]}" if detail else "")
        )

    with open(output_audio_path, "rb") as handle:
        wav_bytes = handle.read()

    sample_rate = 24000
    try:
        with wave.open(output_audio_path, "rb") as wav_file:
            sample_rate = int(wav_file.getframerate())
    except Exception:
        pass

    return {
        "audio_base64": "" if args.output_audio_path else encode_wav_base64_from_bytes(wav_bytes),
        "audio_file_path": output_audio_path if args.output_audio_path else "",
        "mime_type": "audio/wav",
        "sample_rate": sample_rate,
        "seed": seed,
        "reference_text": "",
        "prompt_cache_hit": False,
        "trimmed_lead_ms": 0,
        "trimmed_tail_ms": 0,
        "trimmed_silence": False,
        **(_CACHED_TTS_RUNTIME_INFO or {}),
    }


def perform_tts(args):
    validate_existing_path(args.tts_model_path, "Selected local TTS model path does not exist.")
    validate_existing_path(args.reference_audio_path, "Reference audio file was not found.")
    if not args.prime_only and not (args.text or "").strip():
        raise RuntimeError("No text was provided for synthesis.")

    backend = resolve_tts_backend(args.tts_model_path)
    if backend == MOSS_GGUF_BACKEND:
        return synthesize_moss_gguf_tts(args)
    if backend == "moss":
        return synthesize_moss_tts(args)

    reference_text = resolve_reference_text(args)
    model = load_tts_model(args.tts_model_path)
    x_vector_only_mode = not bool((reference_text or "").strip())
    voice_clone_prompt = None
    prompt_cache_hit = False
    if not x_vector_only_mode:
        voice_clone_prompt, prompt_cache_hit, _prompt_x_vector_only_mode = get_tts_voice_clone_prompt(args, reference_text)
    runtime_info = {
        "runtime_device": (_CACHED_TTS_RUNTIME_INFO or {}).get("runtime_device", ""),
        "runtime_dtype": (_CACHED_TTS_RUNTIME_INFO or {}).get("runtime_dtype", ""),
        "attn_implementation": (_CACHED_TTS_RUNTIME_INFO or {}).get("attn_implementation", ""),
        "tts_model_size": (_CACHED_TTS_RUNTIME_INFO or {}).get("tts_model_size", ""),
        "load_reason": (_CACHED_TTS_RUNTIME_INFO or {}).get("load_reason", ""),
        "load_attempt_index": (_CACHED_TTS_RUNTIME_INFO or {}).get("load_attempt_index", 0),
        "load_attempt_total": (_CACHED_TTS_RUNTIME_INFO or {}).get("load_attempt_total", 0),
    }

    if args.prime_only:
        return {
            "primed": True,
            "reference_text": reference_text,
            "reference_text_mode": "speaker_embedding_only" if x_vector_only_mode else "transcript",
            "prompt_cache_hit": prompt_cache_hit,
            **runtime_info,
        }

    seed = parse_seed_value(args.seed)
    apply_tts_generation_seed(seed)
    generation_kwargs = {
        "text": args.text.strip(),
        "language": resolve_language_name(args.language_code) or "Chinese",
        "non_streaming_mode": False,
    }
    if x_vector_only_mode:
        generation_kwargs.update({
            "ref_audio": args.reference_audio_path,
            "ref_text": "",
            "x_vector_only_mode": True,
        })
    else:
        generation_kwargs["voice_clone_prompt"] = voice_clone_prompt

    if package_available("torch"):
        import torch

        with torch.inference_mode():
            wavs, sample_rate = model.generate_voice_clone(**generation_kwargs)
    else:
        wavs, sample_rate = model.generate_voice_clone(**generation_kwargs)

    if not wavs:
        raise RuntimeError("Local TTS did not generate valid audio.")

    trimmed_audio, trim_info = trim_generated_audio_silence(
        np.asarray(wavs[0], dtype=np.float32),
        int(sample_rate),
    )
    wav_bytes = build_wav_bytes(trimmed_audio, int(sample_rate))
    output_audio_path = (args.output_audio_path or "").strip()
    audio_file_path = ""
    audio_base64 = ""

    if output_audio_path:
        audio_file_path = write_wav_file(output_audio_path, wav_bytes)
    else:
        audio_base64 = encode_wav_base64_from_bytes(wav_bytes)

    return {
        "audio_base64": audio_base64,
        "audio_file_path": audio_file_path,
        "mime_type": "audio/wav",
        "sample_rate": int(sample_rate),
        "seed": seed,
        "reference_text": reference_text,
        "reference_text_mode": "speaker_embedding_only" if x_vector_only_mode else "transcript",
        "prompt_cache_hit": prompt_cache_hit,
        "trimmed_lead_ms": trim_info["trimmed_lead_ms"],
        "trimmed_tail_ms": trim_info["trimmed_tail_ms"],
        "trimmed_silence": trim_info["trimmed"],
        **runtime_info,
    }


def run_stt(args):
    try:
        json_ok(perform_stt(args))
    except Exception as error:
        json_error(str(error))


def run_tts(args):
    try:
        json_ok(perform_tts(args))
    except Exception as error:
        json_error(str(error))


def build_worker_args(base_args, payload: dict):
    def get_value(name: str, fallback: str = "") -> str:
        value = payload.get(name, getattr(base_args, name, fallback))
        return value if isinstance(value, str) else fallback

    def get_seed_value():
        return payload.get("seed", getattr(base_args, "seed", ""))

    def get_bool_value(name: str) -> bool:
        return bool(payload.get(name, getattr(base_args, name, False)))

    return SimpleNamespace(
        mode=base_args.mode,
        text=get_value("text"),
        tts_model_path=get_value("tts_model_path"),
        stt_model_path=get_value("stt_model_path"),
        reference_path=get_value("reference_path"),
        reference_audio_path=get_value("reference_audio_path"),
        reference_text=get_value("reference_text"),
        reference_stt_model_path=get_value("reference_stt_model_path"),
        audio_path=get_value("audio_path"),
        output_audio_path=get_value("output_audio_path"),
        language_code=get_value("language_code", "zh-CN"),
        seed=get_seed_value(),
        prime_only=get_bool_value("prime_only"),
        worker_mode=True,
    )


def preload_worker_model(args):
    global _CACHED_TTS_RUNTIME_INFO

    if args.mode == "tts":
        validate_existing_path(args.tts_model_path, "Selected local TTS model path does not exist.")
        if resolve_tts_backend(args.tts_model_path) == MOSS_GGUF_BACKEND:
            assets = resolve_moss_gguf_assets(args.tts_model_path)
            missing = list(assets.get("missing") or [])
            code_dir = ensure_moss_tts_code_on_path(args.tts_model_path)
            if not code_dir:
                missing.append("local-models/voice/MOSS-TTS/")
            if not resolve_moss_bridge_library():
                missing.append("moss_tts_delay/llama_cpp/backbone_bridge.dll" if os.name == "nt" else "moss_tts_delay/llama_cpp/libbackbone_bridge.so")
            if missing:
                _CACHED_TTS_RUNTIME_INFO = {
                    "runtime_device": "pending",
                    "runtime_dtype": "q4_k_m",
                    "attn_implementation": "llama.cpp",
                    "tts_model_size": "8b",
                    "load_reason": "moss gguf assets pending",
                    "load_attempt_index": 0,
                    "load_attempt_total": 1,
                    "moss_gguf_missing": missing,
                }
                return args.tts_model_path

        load_tts_model(args.tts_model_path)
        return args.tts_model_path

    if args.mode == "stt":
        validate_existing_path(args.stt_model_path, "Selected local STT model path does not exist.")
        load_stt_model(args.stt_model_path)
        return args.stt_model_path

    raise RuntimeError("Local voice mode is invalid.")


def run_worker(args):
    model_path = preload_worker_model(args)
    ready_payload = {
        "event": "ready",
        "mode": args.mode,
        "pid": os.getpid(),
        "model_path": model_path,
    }
    if args.mode == "tts" and _CACHED_TTS_RUNTIME_INFO:
        ready_payload.update(_CACHED_TTS_RUNTIME_INFO)

    write_json(ready_payload, newline=True)

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request_id = None
        try:
            payload = json.loads(line)
            request_id = payload.get("id")
            request_args = build_worker_args(args, payload)
            result = perform_tts(request_args) if args.mode == "tts" else perform_stt(request_args)
            worker_ok(request_id, result)
        except Exception as error:
            worker_error(
                request_id,
                str(error),
                extra={"traceback": traceback.format_exc(limit=6)},
            )


def build_parser():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", required=True, choices=["health", "tts", "stt"])
    parser.add_argument("--worker-mode", action="store_true")
    parser.add_argument("--text", default="")
    parser.add_argument("--tts-model-path", default="")
    parser.add_argument("--stt-model-path", default="")
    parser.add_argument("--reference-path", default="")
    parser.add_argument("--reference-audio-path", default="")
    parser.add_argument("--reference-text", default="")
    parser.add_argument("--reference-stt-model-path", default="")
    parser.add_argument("--audio-path", default="")
    parser.add_argument("--output-audio-path", default="")
    parser.add_argument("--language-code", default="zh-CN")
    parser.add_argument("--seed", default="")
    parser.add_argument("--prime-only", action="store_true")
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    if args.worker_mode:
        run_worker(args)
        return

    if args.mode == "health":
        run_health(args)
        return
    if args.mode == "tts":
        run_tts(args)
        return
    if args.mode == "stt":
        run_stt(args)
        return

    json_error("Local voice mode is invalid.")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as error:
        json_error(
            str(error),
            extra={"traceback": traceback.format_exc(limit=6)},
            exit_code=1,
        )
