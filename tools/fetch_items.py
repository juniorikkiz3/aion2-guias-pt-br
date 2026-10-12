"""Download the items used on the progression page (EN + RU names, grade, icon) from questlog.gg.

  python tools/fetch_items.py            fetch everything listed in "items" of data/progression.json and data/crafting.json
                                         (a key is "Exact Name" or {"name": ..., "grade": ...})
  python tools/fetch_items.py --find X   print questlog search results for X (to pick the exact name)

Writes:
  data/items.json                         {key: {id, grade, cat, icon, en, ru, tip_en, tip_ru}} (tip = hover tooltip)
  src/assets/icons/items/<key>.webp       64x64 icons
"""
import io
import json
import re
import sys
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_skills import CDN, get, trpc  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
ICONS = ROOT / "src" / "assets" / "icons" / "items"
PAGES = ("progression.json", "crafting.json", "class_items.json")   # files whose "items" are fetched


def search(term):
    return trpc("getItems", {"language": "en", "page": 1, "searchTerm": term})["pageData"]


def main():
    if len(sys.argv) > 2 and sys.argv[1] == "--find":
        for it in search(" ".join(sys.argv[2:])):
            print(it["id"], it["grade"], it.get("mainCategory"), it.get("subCategory"), it["name"])
        return
    wanted = {}
    for page in PAGES:
        wanted.update(json.loads((DATA / page).read_text(encoding="utf-8"))["items"])
    ICONS.mkdir(parents=True, exist_ok=True)
    out = {}
    for key, spec in wanted.items():
        # "Exact Name" or {"name": "Exact Name", "grade": 21} when the same name exists in several grades (arcana)
        name, grade = (spec, None) if isinstance(spec, str) else (spec["name"], spec.get("grade"))
        hits = [it for it in search(name) if it["name"] == name and (grade is None or it["grade"] == grade)]
        if not hits:
            print(f"!! {key}: no exact match for {name!r}")
            continue
        it = hits[0]
        out[key] = {"id": it["id"], "grade": it["grade"], "cat": it.get("subCategory") or it.get("mainCategory") or "",
                    "icon": f"{key}.webp"}
        for lang in ("en", "ru"):
            d = trpc("getItem", {"id": it["id"], "language": lang})
            out[key][lang] = d.get("name") or it["name"]
            # tooltip: description, item level, base stats, arcana set bonuses
            stats = (d.get("itemStats") or {}).get("mainStats") or {}
            sets = d.get("itemIsPartOfItemSets") or []
            out[key]["tip_" + lang] = {
                "desc": re.sub(r"<[^>]+>", "", d.get("description") or "").strip(),
                "il": (d.get("equipmentInfo") or {}).get("itemLevel"),
                "stats": [[k, v["value"] if isinstance(v, dict) else v] for k, v in stats.items()],
                "set": {"name": sets[0]["name"], "bonus": [[b["setCount"], b.get("bonusPassive") or ""] for b in sets[0].get("itemSetBonus") or []]} if sets else None,
            }
        path = ICONS / f"{key}.webp"
        if not path.exists():
            raw = get(CDN + it["icon"].split(".")[0] + ".webp")
            Image.open(io.BytesIO(raw)).convert("RGBA").resize((64, 64), Image.LANCZOS).save(path, quality=90, method=6)
        print(f"ok {key}: {it['id']} {it['name']} / {out[key]['ru']}")
    (DATA / "items.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
