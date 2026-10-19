"""Build the static site into docs/.

  python tools/build.py

Inputs:
  data/site.json, data/i18n.json    classes, languages, UI strings
  data/skills/<class>.json          skill data (tools/fetch_skills.py)
  data/leveling/*.json              leveling checklist steps
  src/templates/*.html              page layouts + macros
  src/content/<class>/<lang>.html   guide text (Jinja, uses macros)
  src/assets/                       css, js, icons (copied as-is)
"""
import json
import sys
from pathlib import Path as _Path
if (_Path(__file__).resolve().parent.parent / "source-snapshot/provenance.json").exists():
    from build_snapshot import main
    main()
    sys.exit(0)
import re
import shutil
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, StrictUndefined, pass_context
from markupsafe import Markup, escape

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
SRC = ROOT / "src"
OUT = ROOT / "dist"


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


SITE = load(DATA / "site.json")
I18N = load(DATA / "i18n.json")
LANGS = SITE["langs"]
SOURCES = load(DATA / "sources.json")
WEEKLY = load(DATA / "weekly.json")
CHANGELOG = load(DATA / "changelog.json")["entries"]
WEEK1 = load(DATA / "week1.json")
BOSSES = load(DATA / "bosses.json")
PROGRESSION = load(DATA / "progression.json")
CRAFTING = load(DATA / "crafting.json")
SETTINGS = load(DATA / "settings.json")
DUNGEONS = load(DATA / "dungeons.json")          # dungeon guides: our text
DUNGEONS_DB = load(DATA / "dungeons_db.json")    # dungeon and boss names from questlog (tools/fetch_dungeons.py)
TIERS = load(DATA / "tierlist.json")
BOARDS = {p.stem: load(p) for p in (DATA / "boards").glob("*.json") if p.stem != "presets"}
BOARD_PRESETS = load(DATA / "boards" / "presets.json")
ITEMS = load(DATA / "items.json")
SKILLS = {p.stem: load(p) for p in (DATA / "skills").glob("*.json") if not p.stem.startswith("_")}
for _cls, _fixes in load(DATA / "skills" / "_overrides.json").items():
    for _slug, _langs in ([] if _cls.startswith("_") else _fixes.items()):
        for _lang, _fields in _langs.items():
            SKILLS[_cls][_slug][_lang].update(_fields)

# Game data (skills, items, Daevanion boards, world bosses) comes from questlog.gg, which has no Ukrainian:
# Ukrainian and Turkish pages show it in English. Only our own text (guides, UI) is translated.
DATA_LANG = {"uk": "en", "tr": "en"}


def _game_lang(x):
    """Copy the English game data under every language in DATA_LANG (nested dicts with an 'en' key)."""
    if isinstance(x, dict):
        for lang, src in DATA_LANG.items():
            if src in x and lang not in x:
                x[lang] = x[src]
            if "tip_" + src in x and "tip_" + lang not in x:
                x["tip_" + lang] = x["tip_" + src]
        for v in list(x.values()):
            _game_lang(v)
    elif isinstance(x, list):
        for v in x:
            _game_lang(v)


for _data in (SKILLS, ITEMS, BOARDS, BOSSES, DUNGEONS_DB):
    _game_lang(_data)

# Our own text: a string, UI key or class guide not translated to Turkish yet shows in English, so a guide edit
# made in EN / RU / UK only never breaks the build (the Turkish text catches up later).
TEXT_FALLBACK = {"tr": "en"}


def _text_fallback(x):
    if isinstance(x, dict):
        if "en" in x and "ru" in x:
            for lang, src in TEXT_FALLBACK.items():
                x.setdefault(lang, x[src])
        for v in list(x.values()):
            _text_fallback(v)
    elif isinstance(x, list):
        for v in x:
            _text_fallback(v)


for _data in (SITE, SOURCES, WEEKLY, CHANGELOG, WEEK1, PROGRESSION, CRAFTING, SETTINGS, DUNGEONS, TIERS):
    _text_fallback(_data)
for _lang, _src in TEXT_FALLBACK.items():
    I18N[_lang] = {**I18N[_src], **I18N.get(_lang, {})}


# ---- helpers exposed to templates -------------------------------------------------

@pass_context
def s(ctx, slug, icon=True):
    """Inline skill reference: small icon + localized name."""
    sk = SKILLS[ctx["cls"]["slug"]][slug]
    name = escape(sk[ctx["lang"]]["name"])
    if not icon:
        return Markup(f'<span class="sk" data-sk="{slug}">{name}</span>')
    src = f'{ctx["root"]}assets/icons/{ctx["cls"]["slug"]}/{sk["icon"]}'
    return Markup(f'<span class="sk" data-sk="{slug}"><img src="{src}" width="18" height="18" alt="" loading="lazy">{name}</span>')


@pass_context
def it(ctx, text):
    """Progression page text: replace {i:key} with an item chip (icon + localized name, colored by grade)."""
    import re
    lang, root = ctx["lang"], ctx["root"]

    def chip(m):
        item = ITEMS[m.group(1)]
        name = re.sub(r"\s*\((Bound|привяз\.)\)$", "", item[lang])
        return (f'<span class="it g{item["grade"]}" data-sk="i:{m.group(1)}"><img src="{root}assets/icons/items/{item["icon"]}"'
                f' width="20" height="20" alt="" loading="lazy">{escape(name)}</span>')
    return Markup(re.sub(r"\{i:(\w+)\}", chip, text))


# Stat ids used by the items on the progression page -> labels (questlog gives ids only).
STAT_LABELS = {
    "en": {"weaponfixingdamage": "Attack", "armordefense": "Defense", "hpmax": "HP", "critical": "Critical Hit",
           "weaponaccuracy": "Accuracy", "justice": "Justice [Nezekan]", "wisdom": "Wisdom [Lumiel]", "death": "Death [Triniel]",
           "space": "Space [Israphel]", "illusion": "Illusion [Kaisinel]", "destruction": "Destruction [Zikel]",
           "life": "Life [Yustiel]", "destiny": "Destiny [Marchutan]"},
    "ru": {"weaponfixingdamage": "Атака", "armordefense": "Защита", "hpmax": "ОЗ", "critical": "Крит. удар",
           "weaponaccuracy": "Точность", "justice": "Справедливость [Нэзакан]", "wisdom": "Мудрость [Люмиэль]",
           "death": "Смерть [Триниэль]", "space": "Пространство [Исфаэль]", "illusion": "Иллюзия [Кайсинель]",
           "destruction": "Разрушение [Зикель]", "life": "Жизнь [Юстиэль]", "destiny": "Судьба [Марчутан]"},
}
STAT_LABELS["pt-BR"] = {"weaponfixingdamage":"Ataque","armordefense":"Defesa","hpmax":"HP","critical":"Acerto crítico","weaponaccuracy":"Precisão","justice":"Justiça [Nezekan]","wisdom":"Sabedoria [Lumiel]","death":"Morte [Triniel]","space":"Espaço [Israphel]","illusion":"Ilusão [Kaisinel]","destruction":"Destruição [Zikel]","life":"Vida [Yustiel]","destiny":"Destino [Marchutan]"}
STAT_LABELS["uk"] = STAT_LABELS["tr"] = STAT_LABELS["en"]   # game stat names: English on Ukrainian and Turkish pages, like the rest of the game data


def items_tip_json(lang, extra=None):
    """Hover tooltips for the item chips on the guide pages (embedded as JSON); `extra` adds page-made tooltips
    in the same shape (the gathering skill tree on the crafting page)."""
    return Markup(json.dumps({**items_tip(lang), **(extra or {})}, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))


def items_tip(lang):
    """Item chip tooltips in the same shape as the skill tooltips (n name, m meta line, d description,
    sp list of [label, text]) so site.js shows them the same way. Used on guide pages and class guides."""
    t = I18N[lang]
    out = {}
    for key, item in ITEMS.items():
        tip = item["tip_" + lang]
        meta = [f'{t["pg_il"]} {tip["il"]}'] if tip.get("il") else []
        if tip.get("set"):
            meta.append(f'{t["pg_set"]}: {tip["set"]["name"]}')
        lines = [tip["desc"]] if tip["desc"] else []
        lines += [f'{STAT_LABELS[lang].get(k, k)}: {v}' for k, v in tip["stats"] if k in STAT_LABELS[lang]]
        out["i:" + key] = {"n": item[lang], "m": " · ".join(meta), "g": item["grade"], "d": "\n".join(lines),
                           "sp": [[f'{n}×', b] for n, b in (tip["set"]["bonus"] if tip.get("set") else [])]}
    return out


WATCH_FILL = {"pt-BR": "en", "ru": "en", "uk": "en", "tr": "en"}   # RU / UK / TR pages fill free places with the English-speaking authors of the guide


def watch_for(cls, lang, limit=3):
    """'Who to watch' on a class page: players of this class among the guide's source authors (the names in
    site.json classes[].src whose sources.json 'plays' lists the class) who make content in the page language,
    then the streamers from the Sources page 'watch' group, then (RU pages only) the English-speaking ones."""
    src_text = " ".join(v[0] for v in (cls.get("src") or {}).values())
    authors, streamers, fill = [], [], []
    for g in SOURCES["groups"]:
        for item in g["items"]:
            langs = item.get("lang", [])
            if lang not in langs and WATCH_FILL.get(lang) not in langs:
                continue
            links = {l["type"]: l["url"] for l in item["links"]}
            channel = ("twitch", links["twitch"]) if "twitch" in links else ("youtube", links["youtube"]) if "youtube" in links else None
            if not channel:
                continue
            entry = {"name": item["name"], "type": channel[0], "url": channel[1], "title": item["what"][lang]}
            if g["id"] == "creators" and item["name"] in src_text and cls["slug"] in item.get("plays", []):
                (authors if lang in langs else fill).append(entry)
            elif g["id"] == "watch" and cls["slug"] in item["used"] and lang in langs:
                streamers.append(entry)
    return (authors + streamers + fill)[:limit]


# The board slider past the guide's route: paths to what the build uses come first - the glance core skills and key
# passives, then the other skills on the guide's cards, then the damage / speed orange nodes, then any other skill or
# passive; plain stats only on the way, then Attack / Critical Hit, defense (and the tolerance / resist orange nodes
# in PvE), MP last.
ATTACK_STATS = {"pve": {"fixingdamage", "critical"}, "pvp": {"pvpadddamage", "pvpcritical", "pvpaccuracy", "fixingdamage", "critical"}}
DEFENSE_STATS = {"hpmax", "defense", "criticalresist", "pvpdamagedefense", "pvpcriticalresist", "pvpevasion"}
ORANGE_GUARD = {"decreasedamage", "decreasecriticaldamage", "additionalhitresistrate"}


def board_order(board, targets, mode, prefer=(), used=()):
    """board_order_once with and without the preference for useful nodes on the way: the cheaper route wins, on a
    tie the one with more useful nodes (the route is built nearest target first, so a different tie can change its
    total by a crystal or two)."""
    cost = {n["id"]: n["cost"] or 0 for n in board["nodes"]}
    tries = [board_order_once(board, targets, mode, prefer, used, g) for g in (True, False)]
    return min(tries, key=lambda t: (sum(cost[x] for x in t[0][:t[1]]), -t[2]))[:2]


def board_order_once(board, targets, mode, prefer, used, use_gain):
    """Every node of the board in the order to take it: first the route to the guide's targets (the cheapest
    connected path from Start, nearest target first), then the tiers above (what the build uses first, plain stats last).
    Between paths of the same cost it takes the one that passes more useful nodes on the way (`prefer` = the
    guide's skills and key passives, then other skills and passives, then Attack / Critical Hit), so the result
    is the same on every build."""
    import heapq
    pos = {(n["row"], n["col"]): n for n in board["nodes"]}
    by_id = {n["id"]: n for n in board["nodes"]}
    start = next(n for n in board["nodes"] if n["auto"])
    taken, order = {start["id"]}, []
    stats = lambda n: {e.get("statName") for e in n["raw"] or [] if e["type"] == "stat"}
    gain = {n["id"]: 0 if not use_gain else 3 if n["skill"] in prefer else 1 if n["skill"] else
            0.5 if stats(n) & {"fixingdamage", "critical"} else 0 for n in board["nodes"]}

    def near(n):
        return [pos[k] for k in ((n["row"] + 1, n["col"]), (n["row"] - 1, n["col"]), (n["row"], n["col"] + 1), (n["row"], n["col"] - 1)) if k in pos]

    def route(tier):
        left = set(tier) - taken
        while left:
            # distance = (crystals, -useful nodes on the way): the cheapest path, and of those the most useful one
            dist, prev, pq = {i: (0, 0) for i in taken}, {}, [((0, 0), i) for i in taken]
            while pq:
                c, i = heapq.heappop(pq)
                if c > dist[i]:
                    continue
                for m in near(by_id[i]):
                    d = (c[0] + (m["cost"] or 0), c[1] - gain[m["id"]])
                    if d < dist.get(m["id"], (1e9, 0)):
                        dist[m["id"]], prev[m["id"]] = d, i
                        heapq.heappush(pq, (d, m["id"]))
            reach = [t for t in left if t in dist]
            if not reach:
                break
            t = min(reach, key=lambda x: (dist[x], x))
            path = []
            while t not in taken:
                path.append(t)
                t = prev[t]
            for i in reversed(path):
                taken.add(i)
                order.append(i)
            left -= taken

    route(targets)
    k = len(order)                    # the guide's route ends here
    useful = sum(gain[x] for x in order)
    guard = lambda n: n["grade"] == 41 and mode != "pvp" and stats(n) & ORANGE_GUARD
    for tier in (lambda n: n["skill"] in prefer, lambda n: n["skill"] in used,
                 lambda n: n["grade"] == 41 and not guard(n), lambda n: n["skill"],
                 lambda n: stats(n) & ATTACK_STATS["pvp" if mode == "pvp" else "pve"],
                 lambda n: stats(n) & DEFENSE_STATS or guard(n), lambda n: True):
        route([n["id"] for n in board["nodes"] if tier(n)])
    return order, k, useful


# Board stats stored in 1/100 of a percent (150 -> 1.5%); the rest are flat values.
BOARD_PCT_STATS = {"combatspeed", "cooltimedecrease", "amplifyalldamage", "amplifycriticaldamage", "decreasedamage",
                   "decreasecriticaldamage", "additionalhitrate", "additionalhitresistrate", "pvpamplifydamage", "pvpdecreasedamage"}


def board_tip_key(n):
    """Tooltip key of a non-skill board node: the same stats at the same cost share one tooltip."""
    return "dv:" + "+".join(e["statName"] for e in n["raw"] or [] if e["type"] == "stat") + f':{n["cost"] or 0}:{n["id"] if n["auto"] else ""}'


def board_tips(cls_slug, lang):
    """Tooltips for the stat nodes of the Daevanion boards, in the skill tooltip shape (see items_tip)."""
    t, out, names = I18N[lang], {}, {}
    nodes = [n for b in BOARDS.get(cls_slug, {"boards": []})["boards"] for n in b["nodes"] if not n["skill"]]
    for n in nodes:                                   # stat id -> its name, from the one-stat nodes
        stats = [e for e in n["raw"] or [] if e["type"] == "stat"]
        if len(stats) == 1:
            names[stats[0]["statName"]] = n["name"][lang]
    for n in nodes:
        lines = []
        for e in n["raw"] or []:
            if e["type"] != "stat":
                continue
            v = e["statValue"]
            val = f"{v / 100:g}%".replace(".", "," if lang in ("ru", "uk", "tr", "pt-BR") else ".") if e["statName"] in BOARD_PCT_STATS else str(v)
            lines.append(f'{names.get(e["statName"], e["statName"])} +{val}')
        meta = "" if n["auto"] else f'{t["dv_k_special"] if n["grade"] == 41 else t["dv_k_stat"]} · {n["cost"] or 0} {t["dv_pts"]}'
        out[board_tip_key(n)] = {"n": n["name"][lang], "m": meta, "g": n["grade"], "d": "\n".join(lines), "sp": []}
    return out


def guide_skills(cls_slug, mode):
    """(core skills and key passives of the guide's 'Build at a glance', skills on its cards that are not 'skip')
    for one mode."""
    import ast
    import re
    text = (SRC / "content" / cls_slug / "en.html").read_text(encoding="utf-8")
    g = re.search(r"\{%\s*call glance\('" + mode + r"'\)\s*%\}(.*?)\{%\s*endcall", text, re.S)
    glance, cards = set(), set()
    for m in re.finditer(r"(core|passives)\((\[.*?\])\)", g.group(1) if g else "", re.S):
        glance.update(x[0] if isinstance(x, tuple) else x for x in ast.literal_eval(m.group(2)))
    for sec in re.finditer(r"\{%\s*call section\('[^']*',\s*[^,]+,\s*'([^']*)'\)\s*%\}(.*?)(?=\{%\s*call section\(|\Z)", text, re.S):
        if mode in sec.group(1).split():
            cards.update(m.group(1) for m in re.finditer(r"call skill\('([\w-]+)',\s*'(?!skip')", sec.group(2)))
    return glance, cards


@pass_context
def board_view(ctx, cls_slug, mode):
    """One Daevanion route (data/boards/presets.json -> mode) on every board of the class, for the static board macro."""
    lang = ctx["lang"]
    skills = SKILLS[cls_slug]
    preset = BOARD_PRESETS[cls_slug][mode]
    out, total, levels, focus = [], 0, {}, set()
    glance, cards = guide_skills(cls_slug, mode)
    prefer = glance | {sk for r in preset.values() if isinstance(r, dict) for sk in r.get("skills", [])}
    for i, b in enumerate(BOARDS[cls_slug]["boards"]):
        rule = preset[str(i)] if str(i) in preset else preset.get("*")
        targets = []
        if rule:
            focus.update(rule.get("skills", []))
            sp = rule.get("special")          # true = every orange node, or a list of stat ids
            targets = [n["id"] for n in b["nodes"] if n["skill"] in rule.get("skills", []) or (
                sp and n["grade"] == 41 and (sp is True or any(e.get("statName") in sp for e in n["raw"] or [])))]
        if not rule and preset.get("_hide_empty"):
            continue
        order, k = board_order(b, targets, "pvp" if mode == "pvp" else "pve", prefer, cards)
        taken = {n["id"] for n in b["nodes"] if n["auto"]} | set(order[:k])   # the guide's route = the first k nodes
        cum, run = {}, 0                  # running crystal total in the order -> the slider lights nodes up to it
        for i in order:
            run += next(n["cost"] or 0 for n in b["nodes"] if n["id"] == i)
            cum[i] = run
        r0, c0 = min(n["row"] for n in b["nodes"]), min(n["col"] for n in b["nodes"])      # crop empty rows / columns
        rows, cols = max(n["row"] for n in b["nodes"]) - r0 + 1, max(n["col"] for n in b["nodes"]) - c0 + 1
        pos = {(n["row"], n["col"]): n for n in b["nodes"]}
        nodes, lines, cost = [], [], 0
        for n in b["nodes"]:
            on = n["id"] in taken
            cost += (n["cost"] or 0) if on else 0
            sk = n["skill"] if n["skill"] in skills else None
            if on and sk:
                levels[sk] = levels.get(sk, 0) + 1
            nodes.append({"x": (n["col"] - c0 + 0.5) / cols * 100, "y": (n["row"] - r0 + 0.5) / rows * 100, "g": n["grade"], "on": on,
                          "start": n["auto"], "skill": sk, "tip": sk or board_tip_key(n), "icon": f'assets/icons/{cls_slug}/{skills[sk]["icon"]}' if sk else None,
                          "name": skills[sk][lang]["name"] if sk else n["name"][lang], "cost": n["cost"] or 0, "cum": cum.get(n["id"], 0)})
            for d in ((0, 1), (1, 0)):
                m = pos.get((n["row"] + d[0], n["col"] + d[1]))
                if m:
                    lines.append({"x1": n["col"] - c0 + 0.5, "y1": n["row"] - r0 + 0.5, "x2": m["col"] - c0 + 0.5, "y2": m["row"] - r0 + 0.5,
                                  "on": on and m["id"] in taken, "a": cum.get(n["id"], 0), "b": cum.get(m["id"], 0)})
        total += cost
        out.append({"id": b["id"], "name": b["name"][lang], "lv": b["needLevel"], "rows": rows, "cols": cols, "cost": cost,
                    "max": sum(n["cost"] or 0 for n in b["nodes"]), "nodes": nodes, "lines": lines})
    key = sorted((s for s in levels if s in focus), key=lambda s: -levels[s])
    other = sorted((s for s in levels if s not in focus), key=lambda s: -levels[s])
    name = lambda s: skills[s][lang]["name"]
    big = any(n["g"] in (21, 31) and not n["icon"] for b in out for n in b["nodes"])   # green / blue stat nodes (Azphel)
    return {"boards": out, "total": total, "big_stats": big, "key": [(s, name(s), levels[s]) for s in key], "other": [(s, name(s), levels[s]) for s in other]}


def asset_version():
    """Short hash of the CSS/JS files and preview images: added to their URLs so browsers and chat apps
    pick up a new build instead of a cached one."""
    import hashlib
    h = hashlib.sha1()
    for f in sorted([*(SRC / "assets").glob("*/*.css"), *(SRC / "assets").glob("*/*.js"), *(SRC / "assets" / "og").glob("*.jpg")]):
        h.update(f.read_bytes())
    return h.hexdigest()[:8]


def clean_desc(text):
    """Skill descriptions carry damage placeholders like {se_dmg:...}-{se_dmg:...}; show them as X."""
    import re
    text = re.sub(r"\{se_[^}]*\}\s*-\s*\{se_[^}]*\}", "X", text)
    return re.sub(r"\{se_[^}]*\}", "X", text).strip()


def tooltip_json(cls_slug, lang):
    """Compact skill data for the hover tooltips on a class page (embedded as JSON)."""
    out = {}
    for slug, sk in SKILLS[cls_slug].items():
        L = sk[lang]
        out[slug] = {"n": L["name"], "c": sk.get("category"), "cd": round((sk.get("cooldown") or 0) / 1000),
                     "d": clean_desc(L.get("desc", "")), "sp": [[x["level"], x["text"]] for x in L.get("specs", [])]}
    out.update(items_tip(lang))   # item chips inside the guide text: {{ it('{i:key}') }}
    out.update(board_tips(cls_slug, lang))   # stat nodes of the Daevanion boards
    return Markup(json.dumps(out, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/"))


@pass_context
def skill_data(ctx, slug):
    return SKILLS[ctx["cls"]["slug"]][slug]


@pass_context
def icon_url(ctx, slug):
    sk = SKILLS[ctx["cls"]["slug"]][slug]
    return f'{ctx["root"]}assets/icons/{ctx["cls"]["slug"]}/{sk["icon"]}'


@pass_context
def sp(ctx, slug, index):
    """A specialization's text in the page language, e.g. sp('rending-blow', 2)."""
    return SKILLS[ctx["cls"]["slug"]][slug][ctx["lang"]]["specs"][index]["text"]


def expand(text, cls_slug, lang):
    """Replace [[slug]] with the localized skill name and [[slug#N]] with a specialization."""
    import re
    skills = SKILLS[cls_slug]

    def rep(m):
        slug, idx = m.group(1), m.group(2)
        if idx is not None:
            return "<em>" + str(escape(skills[slug][lang]["specs"][int(idx)]["text"])) + "</em>"
        return "<strong>" + str(escape(skills[slug][lang]["name"])) + "</strong>"
    return re.sub(r"\[\[([a-z0-9-]+)(?:#(\d+))?\]\]", rep, text)


MONTHS = {
    "pt-BR": ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"],
    "en": ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    "ru": ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа",
           "сентября", "октября", "ноября", "декабря"],
    "uk": ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня",
           "вересня", "жовтня", "листопада", "грудня"],
    "tr": ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"],
}


def fmt_utc(iso, lang):
    """'2026-09-28T13:00:00Z' -> 'Sep 28 · 13:00 UTC' / '28 сентября · 13:00 UTC'."""
    from datetime import datetime
    d = datetime.strptime(iso, "%Y-%m-%dT%H:%M:%SZ")
    day = f"{MONTHS[lang][d.month - 1]} {d.day}" if lang == "en" else f"{d.day} {MONTHS[lang][d.month - 1]}"
    return f"{day} · {d:%H:%M} UTC"


def fmt_day(iso, lang):
    """'2026-09-27' -> 'Sep 27, 2026' / '27 сентября 2026'."""
    y, m, d = (int(x) for x in iso.split("-"))
    mon = MONTHS[lang][m - 1]
    return f"{mon} {d}, {y}" if lang == "en" else f"{d} {mon} {y}"


def leveling_steps(cls_slug, lang):
    """Merge the shared route with class-specific steps, ordered by level."""
    steps = load(DATA / "leveling" / "common.json")["steps"]
    _text_fallback(steps)
    cls_file = DATA / "leveling" / f"{cls_slug}.json"
    if cls_file.exists():
        steps = steps + load(cls_file)["steps"]
        _text_fallback(steps)
    out = []
    for st in steps:
        out.append({
            "id": st["id"],
            "order": st["order"],
            "when": st["when"][lang],
            "text": expand(st["text"][lang], cls_slug, lang),
            "kind": "class" if st["id"].startswith(cls_slug) else "route",
            "skills": st.get("skills", []),
        })
    return sorted(out, key=lambda x: x["order"])


def chips(html):
    """Setting values on the settings page: <strong> becomes a chip, ON / OFF get their own colour."""
    h = str(html)
    for on in ("ON", "Вкл"):
        h = h.replace(f"<strong>{on}</strong>", f'<b class="sv sv-on">{on}</b>')
    for off in ("OFF", "Выкл"):
        h = h.replace(f"<strong>{off}</strong>", f'<b class="sv sv-off">{off}</b>')
    return Markup(h.replace("<strong>", '<b class="sv">').replace("</strong>", "</b>"))


def env():
    e = Environment(
        loader=FileSystemLoader([SRC / "templates", SRC / "content"]),
        autoescape=True,
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
        extensions=["jinja2.ext.do"],
    )
    e.globals.update(chips=chips, ASSET_V=asset_version(), tooltip_json=tooltip_json, CHANGELOG=CHANGELOG, fmt_utc=fmt_utc, fmt_day=fmt_day, s=s, sp=sp, skill_data=skill_data, icon_url=icon_url, it=it, items_tip_json=items_tip_json, board_view=board_view, BOARDS=BOARDS, SITE=SITE, watch_for=watch_for, DG_DB=DUNGEONS_DB)
    return e


# ---- pages ------------------------------------------------------------------------

def page_ctx(lang, path, root, cls=None):
    return {
        "lang": lang,
        "langs": LANGS,
        "t": I18N[lang],
        "root": root,
        "path": path,                       # path under /<lang>/, e.g. "gladiator/"
        "canonical": f'{SITE["base_url"]}{lang}/{path}',
        "alt_urls": {l: f'{SITE["base_url"]}{l}/{path}' for l in LANGS},
        "classes": SITE["classes"],
        "cls": cls,
        "updated": SITE["updated"],
    }


# Typography for Russian and Ukrainian pages, applied to the built HTML only (sources stay plain so grep/replace keep
# working): a no-break space after one-letter words and before an em dash, so they never end or start a line.
_NBSP_WORDS = {"ru": "вксоуиаяВКСОУИАЯ", "uk": "вузійоаяВУЗІЙОАЯ"}
_SKIP = re.compile(r"(<script\b.*?</script>|<style\b.*?</style>|<[^>]*>)", re.S | re.I)


def typograph(html, lang):
    one = re.compile(r"(?<![\w\-])([" + _NBSP_WORDS[lang] + r"]) (?=\S)")
    parts = _SKIP.split(html)
    for i in range(0, len(parts), 2):          # even items are text between tags
        t = parts[i]
        if t.strip():
            t = one.sub("\\1\u00a0", t)
            t = t.replace(" \u2014", "\u00a0\u2014")
            parts[i] = t
    return "".join(parts)


def write(rel, html):
    p = OUT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    lang = rel.split("/", 1)[0]
    if rel.endswith(".html") and lang in _NBSP_WORDS:
        html = typograph(html, lang)
    p.write_text(html, encoding="utf-8")


MODES = ("pve", "pvp", "lvl")


def search_entries(cls, lang, html):
    """Search entries for one class page: the class, its guide sections and the skills it mentions."""
    import re
    t = I18N[lang]
    slug, name = cls["slug"], cls["name"][lang]
    off = cls.get("modes_off", [])
    out = [{"k": "class", "t": name, "s": cls["role"][lang], "u": f"{slug}/", "i": f"assets/classes/{slug}.webp"}]
    for sid, only, title in re.findall(
            r'<section id="([^"]+)" class="g-section[^"]*" data-only="([^"]+)"[^>]*>.*?<h2 id="h-[^"]+">(.*?)</h2>', html, re.S):
        modes = [m for m in only.split() if m in MODES and m not in off]
        if not modes:
            continue
        label = t["mode_" + modes[0]]
        out.append({"k": "section", "t": re.sub(r"<[^>]+>", "", title), "s": f"{name} · {label}",
                    "u": f"{slug}/?mode={modes[0]}#{sid}"})
    used = set(re.findall(r'data-sk="([^"]+)"', html))
    for sk_slug in sorted(used):
        sk = SKILLS[slug].get(sk_slug)
        if sk:
            out.append({"k": "skill", "t": sk[lang]["name"], "s": name, "u": f"{slug}/?sk={sk_slug}",
                        "i": f"assets/icons/{slug}/{sk['icon']}"})
    return out


def page_entries(lang):
    """Search entries for the standalone pages and the world bosses."""
    t = I18N[lang]
    out = [{"k": "page", "t": t[key], "s": "", "u": path} for path, key in (
        ("week-1/", "w1_title"), ("progression/", "pg_title"), ("crafting/", "cr_title"), ("settings/", "st_title"), ("weekly/", "wk_title"), ("bosses/", "bs_title"), ("dungeons/", "dg_title"), ("tier-list/", "tl_title"),
        ("sources/", "src_title"), ("changelog/", "wn_history"))]
    for g in BOSSES["groups"]:
        for b in g["bosses"]:
            out.append({"k": "boss", "t": b["name"][lang], "s": f'{g["zone"][lang]} · {g["faction"][lang]}',
                        "u": f'bosses/#b-{b["id"]}'})
    return out


def build():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    shutil.copytree(SRC / "assets", OUT / "assets")
    (OUT / ".nojekyll").write_text("")
    shutil.copy(SRC / "assets" / "favicon.ico", OUT / "favicon.ico")   # crawlers also look for /favicon.ico next to the home page

    e = env()
    urls = []
    for lang in LANGS:
        index = []   # search index for this language (docs/<lang>/search.json)
        ctx = page_ctx(lang, "", "../")
        write(f"{lang}/index.html", e.get_template("home.html").render(ctx))
        urls.append("")
        for cls in SITE["classes"]:
            if cls["status"] != "ready":
                continue
            path = f'{cls["slug"]}/'
            ctx = page_ctx(lang, path, "../../", cls)
            ctx["steps"] = leveling_steps(cls["slug"], lang)
            tpl_lang = lang if (SRC / "content" / cls["slug"] / f"{lang}.html").exists() else TEXT_FALLBACK.get(lang, lang)
            ctx["content_tpl"] = f'{cls["slug"]}/{tpl_lang}.html'
            html = e.get_template("class.html").render(ctx)
            write(f'{lang}/{path}index.html', html)
            urls.append(path)
            index += search_entries(cls, lang, html)
        for path, tpl, key, data in (("week-1/", "week1.html", "week1", WEEK1), ("progression/", "guide_page.html", "prog", PROGRESSION), ("crafting/", "guide_page.html", "prog", CRAFTING), ("settings/", "guide_page.html", "prog", SETTINGS), ("weekly/", "weekly.html", "weekly", WEEKLY), ("bosses/", "bosses.html", "bosses", BOSSES), ("dungeons/", "dungeons.html", "dg", DUNGEONS), ("tier-list/", "tierlist.html", "tl", TIERS), ("changelog/", "changelog.html", "changelog", CHANGELOG)):
            ctx = page_ctx(lang, path, "../../")
            ctx[key] = data
            write(f"{lang}/{path}index.html", e.get_template(tpl).render(ctx))
            urls.append(path)
        ctx = page_ctx(lang, "sources/", "../../")
        ctx["sources"] = SOURCES["groups"]
        write(f"{lang}/sources/index.html", e.get_template("sources.html").render(ctx))
        urls.append("sources/")
        index += page_entries(lang)
        write(f"{lang}/search.json", json.dumps(index, ensure_ascii=False, separators=(",", ":")))

    # Root: language chooser that redirects by browser language.
    write("index.html", e.get_template("root.html").render(page_ctx("pt-BR", "", "")))
    write("404.html", e.get_template("404.html").render(page_ctx("pt-BR", "", "/")))

    base = SITE["base_url"]
    sm = ['<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for path in dict.fromkeys(urls):
        for lang in LANGS:
            sm.append(f"  <url><loc>{base}{lang}/{path}</loc><lastmod>{SITE['updated']}</lastmod>")
            for alt in LANGS:
                sm.append(f'    <xhtml:link rel="alternate" hreflang="{alt}" href="{base}{alt}/{path}"/>')
            sm.append("  </url>")
    sm.append("</urlset>")
    write("sitemap.xml", "\n".join(sm) + "\n")
    write("robots.txt", f"User-agent: *\nAllow: /\n\nSitemap: {base}sitemap.xml\n")
    print(f"built {len(urls)} pages -> dist/")
    from lint_guides import lint
    problems = lint()
    for p in problems:
        print(f"  guide check: {p}")
    if problems:
        print(f"{len(problems)} guide problem(s) - see tools/lint_guides.py for the rules")


if __name__ == "__main__":
    build()
