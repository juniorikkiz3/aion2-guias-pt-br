"""Download a guide video from YouTube (picture only, up to Full HD) to read what it shows on screen.

  python tools/fetch_video.py <youtube url or id> [--height 1080]

Writes frames/<youtube id>/ (git-ignored):
  video.<ext>   the video without sound (the words come from the transcript)
  video.json    {id, title, channel, channel_url, uploaded, duration, height, file}
Skips the download when the file is already there. Needs yt-dlp.
"""
import json
import re
import sys
from pathlib import Path

import imageio_ffmpeg
import yt_dlp

ROOT = Path(__file__).resolve().parent.parent


def video_id(v):
    m = re.search(r"(?:v=|youtu\.be/|shorts/|live/|embed/)([\w-]{11})", v)
    return m.group(1) if m else v


def video_file(vid):
    """The downloaded video of this id, or None."""
    return next((f for f in sorted((ROOT / "frames" / vid).glob("video.*")) if f.suffix not in (".json", ".part")), None)


def fetch(v, height=1080):
    vid = video_id(v)
    out = ROOT / "frames" / vid
    out.mkdir(parents=True, exist_ok=True)
    opts = {"format": f"bv*[height<={height}][ext=mp4]/bv*[height<={height}]/b[height<={height}]", "outtmpl": str(out / "video.%(ext)s"),
            "ffmpeg_location": imageio_ffmpeg.get_ffmpeg_exe(), "noplaylist": True, "quiet": True, "noprogress": True,
            "js_runtimes": {"deno": {}, "node": {}}}     # YouTube needs a JS runtime; Node is what this machine has
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid}", download=video_file(vid) is None)
    f = video_file(vid)
    d = info.get("upload_date") or ""
    meta = {"id": vid, "title": info.get("title"), "channel": info.get("channel"), "channel_url": info.get("channel_url"),
            "uploaded": f"{d[:4]}-{d[4:6]}-{d[6:]}" if d else None, "duration": info.get("duration"), "height": info.get("height"),
            "file": f.name}
    (out / "video.json").write_text(json.dumps(meta, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f'{vid}: {meta["height"]}p, {(meta["duration"] or 0) // 60} min, {f.stat().st_size / 1e6:.0f} MB -> {f}')
    return meta


if __name__ == "__main__":
    args = sys.argv[1:]
    fetch(args[0], int(args[args.index("--height") + 1]) if "--height" in args else 1080)
