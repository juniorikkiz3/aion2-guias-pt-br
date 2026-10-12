"""Find popular fresh AION 2 guide videos on YouTube for a class (or a topic) - views, likes, date, author.

    .venv/Scripts/python tools/find_guides.py ranger                 # this week, English, sorted by views
    .venv/Scripts/python tools/find_guides.py cleric --lang ru --period month
    .venv/Scripts/python tools/find_guides.py "gear after 45" --period any --top 15

    --period week | month | any   upload date filter (default week)
    --lang en | ru                search words and class names in that language (default en)
    --top N                       fetch likes and the upload date for the N most viewed matches (default 10)
    --all                         keep videos whose title does not name the class

Marks: USED = the video is already linked on the site, AUTHOR = the channel is in data/sources.json,
KR/TW? = the title mentions the Korean / Taiwanese client (global guides are preferred), STREAM = longer than 2 h.
Uses yt-dlp only to read public metadata; nothing is downloaded.
"""
import io
import json
import re
import sys
from pathlib import Path

import yt_dlp

ROOT = Path(__file__).resolve().parent.parent
SORT = {"week": "CAMSAggD", "month": "CAMSAggE", "any": "CAM%3D"}  # sorted by view count + upload date filter
ALIASES = {
    "gladiator": ["gladiator", "glad", "гладиатор", "глад"],
    "templar": ["templar", "temp", "страж", "темплар"],
    "ranger": ["ranger", "стрелок", "лучник", "рейнджер"],
    "assassin": ["assassin", "sin", "убийца", "ассасин", "асасин", "син"],
    "sorcerer": ["sorcerer", "sorc", "волшебник", "сорк", "сорсерер"],
    "elementalist": ["elementalist", "spiritmaster", "заклинатель", "элементалист", "спиритмастер", "спир"],
    "cleric": ["cleric", "priest", "healer", "целитель", "клерик", "хил"],
    "chanter": ["chanter", "чародей", "чантер"],
}
GUIDE_WORD = {"en": "guide", "ru": "гайд"}
KR = re.compile(r"\b(KR|TW|Korea|Korean|Taiwan|корея|корейск|тайвань)\w*", re.I)


def known():
    """Video ids already linked on the site, and the creators' names / channel handles."""
    ids, names = set(), set()
    for p in list((ROOT / "data").glob("*.json")) + list((ROOT / "src/content").rglob("en.html")):
        t = p.read_text(encoding="utf-8")
        ids |= set(re.findall(r"(?:watch\?v=|youtu\.be/)([\w-]{11})", t))
    for g in json.loads((ROOT / "data/sources.json").read_text(encoding="utf-8"))["groups"]:
        for it in g.get("items", []):
            if isinstance(it.get("name"), str):  # sites and channels groups have per-language names
                names.add(it["name"].lower())
            for ln in it.get("links", []):
                m = re.search(r"youtube\.com/@([\w.-]+)", ln.get("url", ""))
                if m:
                    names.add(m.group(1).lower())
    for d in (ROOT / "frames").glob("*") if (ROOT / "frames").exists() else []:
        ids.add(d.name)
    return ids, names


def opt(args, name, default):
    if name in args:
        i = args.index(name)
        v = args[i + 1]
        del args[i:i + 2]
        return v
    return default


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    args = sys.argv[1:]
    period = opt(args, "--period", "week")
    lang = opt(args, "--lang", "en")
    top = int(opt(args, "--top", "10"))
    keep_all = "--all" in args
    args = [a for a in args if a != "--all"]
    if not args:
        print(__doc__)
        return
    what = " ".join(args)
    cls = what.lower() if what.lower() in ALIASES else None
    if cls:
        site = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))
        name = next((c["name"].get(lang, c["name"]["en"]) for c in site["classes"] if c["slug"] == cls), cls)
        query = f"aion 2 {name} {GUIDE_WORD.get(lang, 'guide')}"
    else:
        query = f"aion 2 {what}"
    url = f"https://www.youtube.com/results?search_query={query.replace(' ', '+')}&sp={SORT[period]}"
    print(f"Search: {query} ({period}, by views)")

    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "extract_flat": True, "skip_download": True}) as y:
        found = y.extract_info(url, download=False).get("entries") or []
    found = [e for e in found if e.get("id") and e.get("view_count") is not None]
    if cls and not keep_all:
        words = re.compile(r"(?<!\w)(" + "|".join(map(re.escape, ALIASES[cls])) + r")(?!\w)", re.I)
        found = [e for e in found if words.search(e.get("title", ""))]
    found.sort(key=lambda e: -e["view_count"])
    found = found[:top]
    if not found:
        print("nothing found - try --period month, --lang ru or --all")
        return

    ids, names = known()
    rows = []
    with yt_dlp.YoutubeDL({"quiet": True, "no_warnings": True, "skip_download": True}) as y:
        for e in found:
            try:
                x = y.extract_info(f"https://www.youtube.com/watch?v={e['id']}", download=False, process=False)
            except Exception:
                x = {}
            likes = x.get("like_count")
            views = x.get("view_count") or e["view_count"]
            date = x.get("upload_date") or ""
            ch = x.get("channel") or e.get("channel") or ""
            handle = (x.get("uploader_id") or "").lstrip("@").lower()
            marks = []
            if e["id"] in ids:
                marks.append("USED")
            if ch.lower() in names or handle in names:
                marks.append("AUTHOR")
            if KR.search(e.get("title", "")):
                marks.append("KR/TW?")
            if (e.get("duration") or 0) > 2 * 3600:
                marks.append("STREAM")
            rows.append((views, likes, date, e.get("duration") or 0, ch, e.get("title", ""), e["id"], marks))

    for views, likes, date, dur, ch, title, vid, marks in rows:
        ratio = f"{likes / views * 100:.1f}%" if likes and views else "-"
        d = f"{date[:4]}-{date[4:6]}-{date[6:]}" if date else "?"
        print(f"\n{views:>9,} views  {likes or '?':>6} likes ({ratio})  {d}  {dur // 60}:{dur % 60:02d}  {' '.join(marks)}")
        print(f"  {ch} — {title}")
        print(f"  https://www.youtube.com/watch?v={vid}")


if __name__ == "__main__":
    main()
