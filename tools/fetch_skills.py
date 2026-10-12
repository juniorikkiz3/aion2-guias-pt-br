"""Download skill data (EN + RU) and icons for the given classes from questlog.gg.

questlog.gg's "en"/"ru" databases are built from the global client, which is what
the guides target. Output:
  data/skills/<class>.json            skill names, descriptions, specializations per language
  src/assets/icons/<class>/<slug>.webp  96x96 icons

Usage: python tools/fetch_skills.py gladiator ranger
Requires Pillow (icon resize).
"""
import io
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
API = "https://questlog.gg/aion-2/api/trpc/database."
CDN = "https://cdn.questlog.gg/aion-2"
LANGS = ["en", "ru"]
HEADERS = {"User-Agent": "aion2-guides-builder/1.0"}


def get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def trpc(proc, payload):
    url = API + proc + "?input=" + urllib.parse.quote(json.dumps(payload))
    return json.loads(get(url))["result"]["data"]


def strip_tags(s):
    return re.sub(r"<[^>]+>", "", s or "").strip()


def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower().replace("'", "")).strip("-")


def fetch_class(cls):
    listing = []
    page = 1
    while True:
        data = trpc("getSkills", {"language": "en", "page": page, "mainCategory": cls})
        if not data or not data["pageData"]:
            break
        listing += data["pageData"]
        page += 1

    icon_dir = ROOT / "src" / "assets" / "icons" / cls
    icon_dir.mkdir(parents=True, exist_ok=True)
    skills = {}
    for entry in listing:
        slug = slugify(entry["name"])
        skill = {"id": entry["id"], "category": entry["subCategory"], "icon": f"{slug}.webp"}
        for lang in LANGS:
            d = trpc("getSkill", {"id": entry["id"], "language": lang})
            skill["cooldown"] = d.get("cooldown")
            skill[lang] = {
                "name": d["name"],
                "desc": strip_tags(d.get("description")),
                "specs": [
                    {"level": s["parentSkillLvl"], "text": strip_tags(s["specialized"])}
                    for s in (d.get("specializations") or [])
                ],
            }
        icon_path = icon_dir / skill["icon"]
        if not icon_path.exists():
            raw = get(CDN + entry["icon"].split(".")[0] + ".webp")
            Image.open(io.BytesIO(raw)).convert("RGB").resize((96, 96), Image.LANCZOS).save(
                icon_path, quality=90, method=6
            )
        skills[slug] = skill
        print(f"  {cls}: {slug}")

    out = ROOT / "data" / "skills" / f"{cls}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(skills, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"wrote {out.relative_to(ROOT)} ({len(skills)} skills)")


if __name__ == "__main__":
    for c in sys.argv[1:] or ["gladiator", "ranger"]:
        fetch_class(c)
