"""Save the YouTube transcript of a guide video next to its video and frames (local, git-ignored).

  python tools/fetch_transcript.py JEWRiaOb9JY gwMMpH-OY9c

Writes frames/<video id>/transcript.json: {"video", "lang", "rows": [{"t": seconds, "text"}]}.
Prefers an English track (manual over auto-generated). Needs youtube-transcript-api.
"""
import json
import sys
from pathlib import Path

from youtube_transcript_api import YouTubeTranscriptApi

OUT = Path(__file__).resolve().parent.parent / "frames"


def transcript_file(vid):
    return OUT / vid / "transcript.json"


def main(ids):
    api = YouTubeTranscriptApi()
    for vid in ids:
        tracks = api.list(vid)
        try:
            track = tracks.find_transcript(["en", "en-US", "en-GB"])
        except Exception:
            track = next(iter(tracks))
        rows = [{"t": round(s.start), "text": s.text} for s in track.fetch()]
        transcript_file(vid).parent.mkdir(parents=True, exist_ok=True)
        transcript_file(vid).write_text(
            json.dumps({"video": vid, "lang": track.language_code, "rows": rows}, ensure_ascii=False), encoding="utf-8")
        print(f"{vid}: {len(rows)} lines ({track.language_code})")


if __name__ == "__main__":
    main(sys.argv[1:])
