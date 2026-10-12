"""Raster site icons from the same star as src/assets/favicon.svg (Google Search wants a square icon of 48px or a multiple,
and some crawlers only read /favicon.ico or PNG).

  python tools/make_icons.py   -> src/assets/favicon-48.png, favicon-96.png, favicon-192.png, apple-touch-icon.png, favicon.ico
"""
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "src" / "assets"
BG, GOLD = (11, 14, 20, 255), (217, 179, 108, 255)


def cubic(p0, p1, p2, p3, n=24):
    return [tuple((1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d
                  for a, b, c, d in zip(p0, p1, p2, p3)) for t in (i / n for i in range(1, n + 1))]


# The star path of favicon.svg (64x64 viewBox), absolute coordinates.
STAR = [(32, 7)]
STAR += cubic((32, 7), (35.6, 16.2), (43.2, 21.4), (56, 23))
STAR += cubic((56, 23), (47.2, 27.4), (42.4, 34.2), (41.2, 44.2))
STAR += [(32, 58), (22.8, 44.2)]
STAR += cubic((22.8, 44.2), (21.6, 34.2), (16.8, 27.4), (8, 23))
STAR += cubic((8, 23), (20.8, 21.4), (28.4, 16.2), (32, 7))


def render(size, radius=14):
    big = size * 8                      # draw large, then downsample for smooth edges
    k = big / 64
    im = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle((0, 0, big - 1, big - 1), radius=radius * k, fill=BG)
    d.polygon([(x * k, y * k) for x, y in STAR], fill=GOLD)
    return im.resize((size, size), Image.LANCZOS)


def main():
    for s in (48, 96, 192):
        render(s).save(OUT / f"favicon-{s}.png")
    render(180, radius=0).save(OUT / "apple-touch-icon.png")   # iOS rounds the corners itself
    render(48).save(OUT / "favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("icons written")


if __name__ == "__main__":
    main()
