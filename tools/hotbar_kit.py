"""Help read an author's hotbar from a video frame (for the hotbar() panel in a guide).

    .venv/Scripts/python tools/hotbar_kit.py icons <class>
        -> frames/_icons/<class>.jpg: every skill icon of the class with its slug, to match the bar against
    .venv/Scripts/python tools/hotbar_kit.py crop <youtube id> <time> <x0> <y0> <x1> <y1> [--scale 3]
        -> frames/<id>/hd/bar_<seconds, 5 digits>.jpg: the region of the full-size frame, enlarged
           (makes the full-size frame with tools/storyboard.py --at first if it is missing;
            coordinates are pixels of that frame, e.g. 1920x1080)

Everything goes to the git-ignored frames/ folder.
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FRAMES = ROOT / "frames"


def font(size):
    for name in ("arial.ttf", "DejaVuSans.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default()


def icons(cls):
    skills = json.loads((ROOT / "data/skills" / f"{cls}.json").read_text(encoding="utf-8"))
    order = {"active": 0, "stigma": 1, "passive": 2}
    items = sorted(skills.items(), key=lambda kv: (order.get(kv[1].get("category"), 3), kv[0]))
    items = [(slug, sk) for slug, sk in items if (ROOT / "src/assets/icons" / cls / f"{slug}.webp").exists()]
    cols, cell_w, cell_h, ic = 8, 170, 112, 64
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell_w, rows * cell_h), (24, 24, 28))
    d = ImageDraw.Draw(sheet)
    f = font(13)
    for i, (slug, sk) in enumerate(items):
        x, y = (i % cols) * cell_w, (i // cols) * cell_h
        im = Image.open(ROOT / "src/assets/icons" / cls / f"{slug}.webp").convert("RGB").resize((ic, ic))
        sheet.paste(im, (x + (cell_w - ic) // 2, y + 6))
        d.text((x + 6, y + ic + 10), slug[:24], fill=(255, 230, 120), font=f)
        d.text((x + 6, y + ic + 26), (sk.get("category") or "")[:10], fill=(150, 150, 160), font=f)
    out = FRAMES / "_icons" / f"{cls}.jpg"
    out.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out, quality=85)
    print(out.relative_to(ROOT).as_posix(), f"{len(items)} icons")


def seconds(t):
    parts = [float(p) for p in str(t).split(":")]
    s = 0
    for p in parts:
        s = s * 60 + p
    return int(s)


def crop(vid, t, box, scale):
    sec = seconds(t)
    frame = FRAMES / vid / "hd" / f"t{sec:05d}.jpg"
    if not frame.exists():
        subprocess.run([sys.executable, str(ROOT / "tools/storyboard.py"), vid, "--at", str(sec)], cwd=ROOT, check=True)
    im = Image.open(frame)
    region = im.crop(box)
    region = region.resize((region.width * scale, region.height * scale), Image.LANCZOS)
    out = frame.with_name(f"bar_{sec:05d}.jpg")
    region.save(out, quality=90)
    print(out.relative_to(ROOT).as_posix(), f"frame {im.width}x{im.height}")


def main():
    a = sys.argv[1:]
    scale = 3
    if "--scale" in a:
        i = a.index("--scale")
        scale = int(a[i + 1])
        del a[i:i + 2]
    if len(a) >= 2 and a[0] == "icons":
        icons(a[1])
    elif len(a) == 7 and a[0] == "crop":
        crop(a[1], a[2], tuple(int(v) for v in a[3:7]), scale)
    else:
        print(__doc__)


if __name__ == "__main__":
    main()
