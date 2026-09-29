import argparse
import asyncio
import json
import logging
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import edge_tts


DEFAULT_SPEAKERS = {
    "xiaoxiao": "zh-CN-XiaoxiaoNeural",
    "xiaoyi": "zh-CN-XiaoyiNeural",
    "yunjian": "zh-CN-YunjianNeural",
    "yunxi": "zh-CN-YunxiNeural",
    "yunxia": "zh-CN-YunxiaNeural",
    "yunyang": "zh-CN-YunyangNeural",
    "jenny": "en-US-JennyNeural",
    "aria": "en-US-AriaNeural",
    "guy": "en-US-GuyNeural",
    "nanami": "ja-JP-NanamiNeural",
    "keita": "ja-JP-KeitaNeural",
}

LANG_DEFAULT_VOICE = {
    "zh": "zh-CN-XiaoxiaoNeural",
    "en": "en-US-JennyNeural",
    "ja": "ja-JP-NanamiNeural",
}


def detect_language(text):
    for char in text:
        if "\u4e00" <= char <= "\u9fff":
            return "zh"
        if "\u3040" <= char <= "\u30ff" or "\u31f0" <= char <= "\u31ff":
            return "ja"
    return "en"


def resolve_voice(text, speaker="", language="Auto"):
    normalized_speaker = (speaker or "").strip()
    speaker_key = normalized_speaker.lower()
    if speaker_key in DEFAULT_SPEAKERS:
        return DEFAULT_SPEAKERS[speaker_key]
    if normalized_speaker and "Neural" in normalized_speaker:
        return normalized_speaker

    normalized_language = (language or "Auto").strip()
    if not normalized_language or normalized_language.lower() == "auto":
        language_key = detect_language(text)
    else:
        language_key = normalized_language[:2].lower()
    return LANG_DEFAULT_VOICE.get(language_key, "zh-CN-XiaoxiaoNeural")


async def synthesize_audio(text, speaker="", language="Auto"):
    voice = resolve_voice(text, speaker, language)
    communicate = edge_tts.Communicate(text=text, voice=voice)
    audio_chunks = []
    async for chunk in communicate.stream():
        if chunk.get("type") == "audio":
            audio_chunks.append(chunk.get("data", b""))
    audio_data = b"".join(audio_chunks)
    if not audio_data:
        raise RuntimeError("edge-tts returned no audio data")
    return audio_data, voice


async def list_speakers():
    voices = await edge_tts.list_voices()
    return [
        {
            "name": voice.get("ShortName", ""),
            "display_name": voice.get("FriendlyName") or voice.get("ShortName", ""),
            "language": voice.get("Locale", ""),
            "gender": voice.get("Gender", ""),
        }
        for voice in voices
    ]


class BrowserTtsHandler(BaseHTTPRequestHandler):
    server_version = "DesktopPetBrowserTTS/1.0"

    def log_message(self, format, *args):
        logging.getLogger("browser-tts").info("%s - %s", self.address_string(), format % args)

    def send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def send_json(self, status_code, payload):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        if path == "/health":
            try:
                voices = asyncio.run(edge_tts.list_voices())
                self.send_json(200, {
                    "engine": "edge-tts",
                    "status": "ok",
                    "voices_count": len(voices),
                })
            except Exception as error:
                self.send_json(500, {
                    "engine": "edge-tts",
                    "status": "error",
                    "error": str(error),
                })
            return

        if path == "/speakers":
            try:
                self.send_json(200, {
                    "engine": "edge-tts",
                    "speakers": asyncio.run(list_speakers()),
                })
            except Exception as error:
                self.send_json(500, {
                    "detail": str(error),
                })
            return

        self.send_json(200, {
            "service": "Desktop Pet Browser TTS",
            "engine": "edge-tts",
            "endpoints": ["/tts/generate", "/speakers", "/health"],
        })

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        if path != "/tts/generate":
            self.send_json(404, {"detail": "not_found"})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0") or "0")
            raw_body = self.rfile.read(content_length).decode("utf-8")
            payload = json.loads(raw_body or "{}")
        except Exception:
            self.send_json(400, {"detail": "invalid_json"})
            return

        text = str(payload.get("text") or "").strip()
        speaker = str(payload.get("speaker") or "").strip()
        language = str(payload.get("language") or "Auto").strip() or "Auto"

        if not text:
            self.send_json(400, {"detail": "Text is empty"})
            return
        if len(text) > 5000:
            self.send_json(400, {"detail": "Text too long (max 5000 chars)"})
            return

        try:
            audio_data, voice = asyncio.run(synthesize_audio(text, speaker, language))
            self.send_response(200)
            self.send_cors_headers()
            self.send_header("Content-Type", "audio/mpeg")
            self.send_header("Content-Length", str(len(audio_data)))
            self.send_header("X-TTS-Voice", voice)
            self.end_headers()
            self.wfile.write(audio_data)
        except Exception as error:
            logging.getLogger("browser-tts").exception("tts synthesis failed")
            self.send_json(500, {"detail": str(error)})


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9880)
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    server = ThreadingHTTPServer((args.host, args.port), BrowserTtsHandler)
    logging.getLogger("browser-tts").info("listening on http://%s:%s", args.host, args.port)
    server.serve_forever()


if __name__ == "__main__":
    main()
