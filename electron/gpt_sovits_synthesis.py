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
    return chunks
