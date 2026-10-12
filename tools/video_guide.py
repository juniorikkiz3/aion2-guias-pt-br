"""Prepare a YouTube guide video for analysis in one go: video -> transcript -> storyboard.

  python tools/video_guide.py <youtube url or id> [more ...] [--every 2] [--height 1080]

Everything lands in frames/<youtube id>/ (git-ignored): video.*, video.json, transcript.json, f/, sheets/, hd/.
Runs tools/fetch_video.py, tools/fetch_transcript.py and tools/storyboard.py for each video and prints
what to read next. Steps that are already done (video downloaded, transcript saved) are not repeated.
The workflow around it (analysis, comparing with the guide, what to update) is in
.claude/skills/guide-from-video/SKILL.md.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import fetch_transcript  # noqa: E402
import storyboard  # noqa: E402
from fetch_video import fetch, video_file, video_id  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def prepare(v, every=None, height=1080):
    vid = video_id(v)
    meta = fetch(vid, height)
    tr = fetch_transcript.transcript_file(vid)
    if not tr.exists():
        try:
            fetch_transcript.main([vid])
        except Exception as e:                      # no captions, or YouTube refused: the storyboard still works
            print(f"{vid}: NO TRANSCRIPT ({type(e).__name__}) - make one with: python tools/transcribe.py {vid} --lang en")
    storyboard.storyboard(video_file(vid), vid, every)
    out = ROOT / "frames" / vid
    idx = json.loads((out / "index.json").read_text(encoding="utf-8"))
    rows = len(json.loads(tr.read_text(encoding="utf-8"))["rows"]) if tr.exists() else 0
    print(f'''
{meta["title"]}
  channel     {meta["channel"]}  {meta["channel_url"]}
  uploaded    {meta["uploaded"]}, {idx["duration"]}, {meta["height"]}p
  transcript  {tr.relative_to(ROOT) if rows else "none"} ({rows} lines)
  sheets      {out.relative_to(ROOT) / "sheets"} ({len(list((out / "sheets").glob("*.jpg")))} sheets, {len(idx["frames"])} frames, every {idx["every"]} s)
  full frame  python tools/storyboard.py {vid} --at 7:45 465
''')


if __name__ == "__main__":
    args = sys.argv[1:]
    opt = {k: int(args[args.index(k) + 1]) for k in ("--every", "--height") if k in args}
    skip = {i for k in opt for i in (args.index(k), args.index(k) + 1)}
    for v in (a for i, a in enumerate(args) if i not in skip):
        prepare(v, opt.get("--every"), opt.get("--height", 1080))
