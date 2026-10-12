"""Transcribe a guide video locally when YouTube has no captions for it (fresh uploads, captions switched off).

  python tools/transcribe.py <youtube id> [--model small] [--lang en]

Downloads the audio track to frames/<id>/audio.* and writes frames/<id>/transcript.json in the same shape as
tools/fetch_transcript.py ({"video", "lang", "source": "whisper", "rows": [{"t": seconds, "text"}]}).
Speech recognition mishears game terms - check skill names against the frames. Needs faster-whisper
(not in requirements.txt: `pip install faster-whisper`); uses the GPU when CUDA works, else the CPU.
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np

import imageio_ffmpeg
import yt_dlp

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_transcript import transcript_file  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def audio_file(vid):
    return next((f for f in sorted((ROOT / "frames" / vid).glob("audio.*")) if f.suffix != ".part"), None)


def fetch_audio(vid):
    if not audio_file(vid):
        out = ROOT / "frames" / vid
        out.mkdir(parents=True, exist_ok=True)
        opts = {"format": "ba[ext=m4a]/ba", "outtmpl": str(out / "audio.%(ext)s"), "noplaylist": True, "quiet": True,
                "noprogress": True, "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(), "js_runtimes": {"deno": {}, "node": {}}}
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.extract_info(f"https://www.youtube.com/watch?v={vid}", download=True)
    return audio_file(vid)


def samples(path):
    """The audio as 16 kHz mono float32, decoded with our own ffmpeg (does not depend on the PyAV version)."""
    raw = subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-i", str(path),
                          "-f", "s16le", "-ac", "1", "-ar", "16000", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768.0


def transcribe(vid, model="small", lang=None):
    from faster_whisper import WhisperModel
    audio = samples(fetch_audio(vid))
    try:
        m = WhisperModel(model, device="cuda", compute_type="float16")
        segs, info = m.transcribe(audio, language=lang, vad_filter=True)
        segs = list(segs)
    except Exception as e:                       # no usable CUDA libraries: fall back to the CPU
        print(f"GPU failed ({type(e).__name__}: {str(e)[:80]}), using the CPU")
        m = WhisperModel(model, device="cpu", compute_type="int8")
        segs, info = m.transcribe(audio, language=lang, vad_filter=True)
        segs = list(segs)
    rows = [{"t": round(s.start), "text": s.text.strip()} for s in segs]
    transcript_file(vid).write_text(json.dumps({"video": vid, "lang": info.language, "source": "whisper", "rows": rows},
                                               ensure_ascii=False), encoding="utf-8")
    print(f"{vid}: {len(rows)} lines ({info.language}, whisper {model})")


if __name__ == "__main__":
    args = sys.argv[1:]
    opt = {k: args[args.index(k) + 1] for k in ("--model", "--lang") if k in args}
    transcribe(args[0], opt.get("--model", "small"), opt.get("--lang"))
