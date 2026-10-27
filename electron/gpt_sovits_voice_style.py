"""Optional per-pack voice style: extra voice clips blended into the timbre ("timbreBlend"), the
language of each reference clip ("lang"), lengthened phrase-final syllables ("tailStretch", a soft
trailing drawl) and a fixed sampling seed ("seed"). Packs without these sound exactly as before."""
MAX_BLEND_CLIPS = 4
REFERENCE_LANGS = {"zh", "ja", "en", "ko", "yue"}
TAIL_FRAMES = 22     # 10 ms frames: the last ~220 ms of a phrase is stretched
PHRASE_GAP = 12      # a pause of 120 ms or more ends a phrase


def reference_lang(entry):
    lang = (entry or {}).get("lang") or "zh"
    if lang not in REFERENCE_LANGS:
        raise ValueError("invalid_manifest")
    return lang


def parse_voice_style(manifest, resolve, exists):
    """resolve maps a pack-relative path to an absolute one inside the pack (or None)."""
    blend = []
    for relative in (manifest.get("timbreBlend") or [])[:MAX_BLEND_CLIPS]:
        path = resolve(relative)
        if not path or not exists(path):
            raise ValueError("invalid_manifest")
        blend.append(path)
    try:
        tail = float(manifest.get("tailStretch", 1.0))
        # A fixed seed keeps the delivery the same every time (the sampling is otherwise random).
        seed = None if manifest.get("seed") is None else int(manifest["seed"]) % 2**31
    except (TypeError, ValueError):
        raise ValueError("invalid_manifest") from None
    return {"blend": blend, "tail_stretch": min(max(tail, 1.0), 2.5), "seed": seed}


def _voiced_runs(voiced):
    runs, start = [], None
    for index, is_voiced in enumerate(list(voiced) + [False]):
        if is_voiced and start is None:
            start = index
        elif not is_voiced and start is not None:
            runs.append((start, index))
            start = None
    return runs


def stretch_phrase_tails(audio, sample_rate, factor):
    """Lengthen the last syllable before each pause by factor, pitch unchanged (int16 in and out)."""
    import librosa
    import numpy as np
    if factor <= 1.0 or len(audio) == 0:
        return audio
    y = audio.astype(np.float32) / 32768.0
    hop = int(sample_rate * 0.01)
    rms = librosa.feature.rms(y=y, frame_length=hop * 4, hop_length=hop)[0]
    db = 20 * np.log10(rms + 1e-9)
    runs = _voiced_runs(db > db.max() - 35)
    fade = int(sample_rate * 0.01)
    out, position = [], 0
    for index, (start, end) in enumerate(runs):
        gap = runs[index + 1][0] - end if index + 1 < len(runs) else PHRASE_GAP
        if gap < PHRASE_GAP or end - start < TAIL_FRAMES * 2:
            continue
        t0, t1 = (end - TAIL_FRAMES) * hop, min(end * hop, len(y))
        out.append(y[position:t0])
        tail = librosa.effects.time_stretch(y[t0:t1], rate=1 / factor)
        if len(out[-1]) >= fade and len(tail) >= fade:  # short crossfade into the stretched tail
            ramp = np.linspace(0, 1, fade, dtype=np.float32)
            tail[:fade] = out[-1][-fade:] * (1 - ramp) + tail[:fade] * ramp
            out[-1] = out[-1][:-fade]
        out.append(tail)
        position = t1
    out.append(y[position:])
    return (np.clip(np.concatenate(out), -1, 1) * 32767).astype(np.int16)
