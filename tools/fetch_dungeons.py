"""Dungeon names, boss names and boss portraits from questlog.gg (EN + RU) for the dungeon guides page.

  python tools/fetch_dungeons.py   -> data/dungeons_db.json, src/assets/icons/bosses/<npc id>.webp

Our own text (mechanics, tips) lives in data/dungeons.json and refers to these ids; this file is game data only.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_skills import CDN, get, trpc  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "dungeons_db.json"
ICONS = ROOT / "src" / "assets" / "icons" / "bosses"

# questlog dungeon ids (the normal / easy variant that lists the bosses) — the dungeons the guides page covers.
DUNGEONS = ["600001", "600031", "600011", "600071", "600021", "600091", "600053", "600063"]


def main():
    ICONS.mkdir(parents=True, exist_ok=True)
    out = {}
    for did in DUNGEONS:
        d = {lang: trpc("getDungeon", {"language": lang, "id": did}) for lang in ("en", "ru")}
        bosses = []
        for b_en, b_ru in zip(d["en"].get("dungeonHasBossNpcs") or [], d["ru"].get("dungeonHasBossNpcs") or []):
            icon = ICONS / f'{b_en["id"]}.webp'
            if b_en.get("icon") and not icon.exists():
                try:
                    icon.write_bytes(get(CDN + b_en["icon"].split(".")[0] + ".webp"))
                except Exception as e:  # a missing portrait is not fatal
                    print("no portrait", b_en["name"], e)
            bosses.append({"id": b_en["id"], "en": b_en["name"], "ru": b_ru["name"], "icon": icon.exists()})
        out[did] = {"en": d["en"]["name"], "ru": d["ru"]["name"], "players": d["en"].get("recommendMaxMembers"),
                    "energy": d["en"].get("odyleEnergyCost"), "bosses": bosses}
        print(did, d["en"]["name"], [b["en"] for b in bosses])
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
