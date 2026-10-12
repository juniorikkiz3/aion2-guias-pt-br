"""Download official class character art and prepare it for the site.

  python tools/fetch_art.py

Source: the class carousel on the official global teaser page
(https://aion2.plaync.com/en-us/conts/teaser, section "Classes"). Each render is a
1350x959 transparent PNG-in-WebP with the figure in the middle; we crop to the
figure, scale it down and write:

  src/assets/art/<slug>.webp     one figure per class (class hero, cards)
  src/assets/classes/<slug>.webp class emblem, 150x150 (from the Fextralife wiki — the official
                                 site only has them as ~65px parts of its class nameplates)

src/assets/art/home-bg.webp (home hero landscape) is added by hand, not by this script.
"""
import io
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "src" / "assets" / "art"
CDN = "https://assets.playnccdn.com/res/aion2/update/2026/global/260421_teaser/7th/pc/img/sec6/"

# NC's CSS class names -> ours (their "spiritmaster" is our Elementalist).
ART = {
    "gladiator": "eb8322b90761388ab590db3b5aa9c42c0ab14ed3",
    "templar": "e171c504d074d8fbc5be192b976d1c19f8c09fd1",
    "assassin": "05bb120051062586a171ed44b2eda389a0a21c92",
    "ranger": "3e479b86584ed533510ee1b49d4cb1cc1e4fcf29",
    "sorcerer": "d958f67479dc8794ed5372f65e43cded3e03e6ba",
    "elementalist": "23fe14c4d42879d0ca245fe6d9aa11c24625c2bb",
    "cleric": "c182442be1a047ca29d798ede411af98aa30afa2",
    "chanter": "359c79548a9cc3db03731feb0bbfbafe42c9dee8",
}
HEIGHT = 720        # single figure

EMBLEM_CDN = "https://static0.fextralifeimages.com/file/aion2/"
EMBLEMS = {
    "gladiator": "b/b2/Gladiator", "templar": "d/da/Templar", "assassin": "7/7e/Assassin",
    "ranger": "c/c5/Ranger", "sorcerer": "e/ef/Sorcerer", "elementalist": "b/b2/Elementalist",
    "cleric": "4/4e/Cleric", "chanter": "a/ac/Chanter",
}


def get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (aion2-guides)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def crop(im):
    """Trim transparent margins, keep a little air on top and the sides."""
    alpha = im.getchannel("A").point(lambda a: 255 if a > 12 else 0)
    l, t, r, b = alpha.getbbox()
    pad = 12
    return im.crop((max(l - pad, 0), max(t - pad, 0), min(r + pad, im.width), b))


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for slug, h in ART.items():
        im = crop(Image.open(io.BytesIO(get(CDN + h + ".webp"))).convert("RGBA"))
        w = round(im.width * HEIGHT / im.height)
        im.resize((w, HEIGHT), Image.LANCZOS).save(OUT / f"{slug}.webp", "WEBP", quality=82, method=6)
        print(f"{slug}: {w}x{HEIGHT}")

    emblems = ROOT / "src" / "assets" / "classes"
    for slug, path in EMBLEMS.items():
        im = Image.open(io.BytesIO(get(EMBLEM_CDN + path + "-icon-aion2-wiki-guide.webp"))).convert("RGBA")
        im.save(emblems / f"{slug}.webp", "WEBP", quality=90, method=6)
        print(f"emblem {slug}: {im.width}x{im.height}")


if __name__ == "__main__":
    main()
