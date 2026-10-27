"""Group complete sentences for stable GPT-SoVITS inference, preserving paragraphs."""
import re


def split_synthesis_text(text, target_chars=120):
    """A soft size target: never split commas or truncate an oversized sentence."""
    chunks = []
    for paragraph in text.splitlines():
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        # Keep terminal punctuation and closing quotes with the preceding sentence.
        sentences = re.findall(r'.+?(?:[。！？!?]+[”’"\u300d\u300f]*|$)', paragraph)
        chunk = ""
        for sentence in sentences:
            if chunk and len(chunk) + len(sentence) > target_chars:
                chunks.append(chunk.strip())
                chunk = ""
            chunk += sentence
        if chunk.strip():
            chunks.append(chunk.strip())
    return merge_short_chunks(chunks)


# GPT-SoVITS often swallows a very short line spoken on its own ("一认一个准。" came back as a
# blip three times and the line was dropped). A short paragraph rides along with its neighbour.
MIN_CHUNK_CHARS = 8


def _spoken_length(text):
    return len(re.findall(r"[\w一-鿿]", text))


def merge_short_chunks(chunks):
    merged = []
    for chunk in chunks:
        if merged and (_spoken_length(chunk) < MIN_CHUNK_CHARS or _spoken_length(merged[-1]) < MIN_CHUNK_CHARS):
            previous = merged[-1]
            joiner = "" if re.search(r"[。！？!?，,；;：:…~～”’\"」』）)]$", previous) else "，"
            merged[-1] = previous + joiner + chunk
        else:
            merged.append(chunk)
    return merged
