"""Fetches GPT-SoVITS inference source and pretrained assets for the desktop pet sidecar.

Usage: gpt_sovits_install.py source --source-dir DIR --commit SHA
       gpt_sovits_install.py models --source-dir DIR --venv-dir DIR
Progress lines go to stdout; the exit code reports success.
"""
import argparse
import os
import shutil
import sys
import tempfile
import time
import urllib.request
import zipfile

SOURCE_URL = "https://codeload.github.com/RVC-Boss/GPT-SoVITS/zip/{commit}"
HF_ENDPOINTS = ["https://huggingface.co", "https://hf-mirror.com"]
PRETRAINED_PATTERNS = [
    "chinese-hubert-base/*", "chinese-roberta-wwm-ext-large/*", "s1v3.ckpt", "sv/*",
    "v2Pro/s2Gv2ProPlus.pth", "v2Pro/s2Dv2ProPlus.pth",
]
ASSET_REPO = "XXXXRT/GPT-SoVITS-Pretrained"


def say(message):
    print(message, flush=True)


def download(url, target, attempts=3):
    for attempt in range(1, attempts + 1):
        try:
            with urllib.request.urlopen(url, timeout=60) as response, open(target, "wb") as handle:
                shutil.copyfileobj(response, handle, 1024 * 1024)
            return
        except OSError as error:
            say(f"下载失败（第 {attempt} 次）：{error}")
            if attempt == attempts:
                raise
            time.sleep(3 * attempt)


def install_source(source_dir, commit):
    """Extracts the pinned commit next to the target and swaps it in, so a failure never leaves half a tree."""
    if os.path.exists(os.path.join(source_dir, "GPT_SoVITS", "TTS_infer_pack", "TTS.py")):
        say("GPT-SoVITS 推理代码已存在，跳过下载。")
        return
    parent = os.path.dirname(os.path.abspath(source_dir))
    os.makedirs(parent, exist_ok=True)
    with tempfile.TemporaryDirectory(dir=parent) as work:
        archive = os.path.join(work, "source.zip")
        say(f"正在下载 GPT-SoVITS 推理代码（{commit[:7]}）...")
        download(SOURCE_URL.format(commit=commit), archive)
        say("正在解压推理代码...")
        with zipfile.ZipFile(archive) as bundle:
            bundle.extractall(work)
        extracted = os.path.join(work, f"GPT-SoVITS-{commit}")
        if not os.path.isdir(extracted):
            raise RuntimeError("source archive layout changed")
        if os.path.exists(source_dir):
            shutil.rmtree(source_dir)
        shutil.move(extracted, source_dir)
    say("推理代码就绪。")


def with_hf_endpoint(action):
    """Tries the official hub first, then the mainland-China mirror."""
    last_error = None
    for endpoint in HF_ENDPOINTS:
        try:
            return action(endpoint)
        except Exception as error:  # network/mirror failures fall through to the next endpoint
            last_error = error
            say(f"从 {endpoint} 下载失败，尝试下一个下载源：{error}")
    raise last_error


def install_models(source_dir, venv_dir):
    from huggingface_hub import hf_hub_download, snapshot_download
    pretrained = os.path.join(source_dir, "GPT_SoVITS", "pretrained_models")
    say("正在下载预训练模型（约 1.4GB）...")
    with_hf_endpoint(lambda endpoint: snapshot_download(
        "lj1995/GPT-SoVITS", local_dir=pretrained, allow_patterns=PRETRAINED_PATTERNS, endpoint=endpoint))
    os.makedirs(os.path.join(pretrained, "fast_langdetect"), exist_ok=True)
    # Archives land next to the runtime (same drive as the install), never in the system temp folder.
    download_dir = os.path.join(os.path.dirname(os.path.abspath(source_dir)), "downloads")
    os.makedirs(download_dir, exist_ok=True)
    text_dir = os.path.join(source_dir, "GPT_SoVITS", "text")
    if not os.path.isdir(os.path.join(text_dir, "G2PWModel")):
        say("正在下载中文多音字模型 G2PW（约 590MB）...")
        archive = with_hf_endpoint(lambda endpoint: hf_hub_download(
            ASSET_REPO, "G2PWModel.zip", local_dir=download_dir, endpoint=endpoint))
        with zipfile.ZipFile(archive) as bundle:
            bundle.extractall(text_dir)
        os.remove(archive)
    if not os.path.isdir(os.path.join(venv_dir, "nltk_data")):
        say("正在下载英文分词数据...")
        archive = with_hf_endpoint(lambda endpoint: hf_hub_download(
            ASSET_REPO, "nltk_data.zip", local_dir=download_dir, endpoint=endpoint))
        with zipfile.ZipFile(archive) as bundle:
            bundle.extractall(venv_dir)
        os.remove(archive)
    say("预训练模型就绪。")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("step", choices=["source", "models"])
    parser.add_argument("--source-dir", required=True)
    parser.add_argument("--commit")
    parser.add_argument("--venv-dir")
    args = parser.parse_args()
    try:
        if args.step == "source":
            install_source(args.source_dir, args.commit)
        else:
            install_models(args.source_dir, args.venv_dir)
    except Exception as error:
        say(f"安装步骤失败：{error}")
        sys.exit(1)


if __name__ == "__main__":
    main()
