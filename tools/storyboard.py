"""Storyboard a guide video to read what it shows on screen (builds, stigmas, stats) next to its transcript.

  python tools/storyboard.py <youtube id> [--every 2]                frames + contact sheets
  python tools/storyboard.py <youtube id> --at 93 7:45               full-resolution frames at these moments
  python tools/storyboard.py <video file> <youtube id> ...           the same for a video file of your own

Without a file the video is frames/<youtube id>/video.* (tools/fetch_video.py). Without --every the step depends
on the length: a frame every second up to 8 minutes, every 2 s up to 16, every 3 s up to 30, every 4 s for longer.

Writes frames/<youtube id>/ (git-ignored, reusable later):
  f/<seconds>.jpg      small frames, only the ones that differ from the previous kept frame
  sheets/sheetNN.jpg   5x6 contact sheets with timestamps and the transcript line spoken at that moment
  hd/t<seconds>.jpg    full-resolution frames (--at)
  index.json           {video, file, every, duration, frames: [seconds]}
Transcript: frames/<youtube id>/transcript.json (tools/fetch_transcript.py).
"""
import json
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat

ROOT = Path(__file__).resolve().parent.parent
FF = imageio_ffmpeg.get_ffmpeg_exe()
COLS, ROWS, TW, TH = 5, 6, 384, 216


def secs(v):
    if ":" in v:
        m, s = v.split(":")
        return int(m) * 60 + int(s)
    return int(float(v))


def transcript_at(vid):
    p = ROOT / "frames" / vid / "transcript.json"
    rows = json.loads(p.read_text(encoding="utf-8"))["rows"] if p.exists() else []
    def line(t):
        cur = ""
        for r in rows:
            if r["t"] > t:
                break
            cur = r["text"]
        return cur.replace("\n", " ").replace("\xa0", " ")
    return line


def font(size):
    for n in ("segoeui.ttf", "arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(n, size)
        except OSError:
            pass
    return ImageFont.load_default()


def duration(video):
    """(seconds, 'hh:mm:ss.xx') of a video file."""
    err = subprocess.run([FF, "-i", str(video)], capture_output=True, text=True, encoding="utf-8", errors="replace").stderr
    if "Duration: " not in err:
        return 0, None
    txt = err.split("Duration: ")[1].split(",")[0]
    h, m, s = txt.split(":")
    return int(h) * 3600 + int(m) * 60 + float(s), txt


def auto_every(seconds):
    return 1 if seconds <= 8 * 60 else 2 if seconds <= 16 * 60 else 3 if seconds <= 30 * 60 else 4


def storyboard(video, vid, every=None):
    dur_s, dur = duration(video)
    every = every or auto_every(dur_s)
    out = ROOT / "frames" / vid
    raw = out / "raw"
    for d in (raw, out / "f", out / "sheets"):
        d.mkdir(parents=True, exist_ok=True)
    for f in [*raw.glob("*.jpg"), *(out / "f").glob("*.jpg"), *(out / "sheets").glob("*.jpg")]:
        f.unlink()
    subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-i", str(video), "-vf", f"fps=1/{every},scale=480:-1",
                    "-q:v", "4", str(raw / "r%05d.jpg")], check=True)
    kept, last = [], None
    for i, f in enumerate(sorted(raw.glob("r*.jpg"))):
        t = i * every
        im = Image.open(f).convert("RGB")
        key = im.convert("L").resize((96, 54))
        if last is not None and ImageStat.Stat(ImageChops.difference(key, last)).mean[0] < 4:
            continue                                  # nearly the same picture as the previous kept frame
        last = key
        im.save(out / "f" / f"{t:05d}.jpg", quality=80)
        kept.append(t)
    for f in raw.glob("*.jpg"):
        f.unlink()
    raw.rmdir()
    line = transcript_at(vid)
    fnt, small = font(15), font(12)
    per = COLS * ROWS
    for s in range(0, len(kept), per):
        sheet = Image.new("RGB", (COLS * TW, ROWS * (TH + 34)), (18, 18, 18))
        d = ImageDraw.Draw(sheet)
        for i, t in enumerate(kept[s:s + per]):
            x, y = (i % COLS) * TW, (i // COLS) * (TH + 34)
            sheet.paste(Image.open(out / "f" / f"{t:05d}.jpg").resize((TW, TH)), (x, y))
            d.text((x + 4, y + TH + 2), f"{t // 60}:{t % 60:02d}", font=fnt, fill=(255, 220, 90))
            d.text((x + 52, y + TH + 4), line(t)[:58], font=small, fill=(200, 200, 200))
        sheet.save(out / "sheets" / f"sheet{s // per:02d}.jpg", quality=80)
    (out / "index.json").write_text(json.dumps({"video": vid, "file": str(video), "every": every, "duration": dur,
                                                "frames": kept}, indent=1), encoding="utf-8")
    print(f"{vid}: a frame every {every} s, {len(kept)} frames kept, {(len(kept) + per - 1) // per} sheets -> {out}")


def hd(video, vid, moments):
    out = ROOT / "frames" / vid / "hd"
    out.mkdir(parents=True, exist_ok=True)
    for m in moments:
        t = secs(m)
        p = out / f"t{t:05d}.jpg"
        if not p.exists():
            subprocess.run([FF, "-hide_banner", "-loglevel", "error", "-ss", str(t), "-i", str(video), "-frames:v", "1", "-q:v", "2", str(p)], check=True)
        print(p)


if __name__ == "__main__":
    args = sys.argv[1:]
    if len(args) > 1 and not args[1].startswith("--"):
        video, vid = args[0], args[1]
    else:
        from fetch_video import video_file
        vid = args[0]
        video = video_file(vid)
        if not video:
            sys.exit(f"no video in frames/{vid}/ - run tools/fetch_video.py {vid} first")
    if "--at" in args:
        hd(video, vid, args[args.index("--at") + 1:])
    else:
        storyboard(video, vid, int(args[args.index("--every") + 1]) if "--every" in args else None)
