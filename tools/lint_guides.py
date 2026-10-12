"""Check the class guides against the game rules and the data (run by tools/build.py, or on its own).

    .venv/Scripts/python tools/lint_guides.py [class ...]

Skill cards ({% call skill(slug, kind, badge, picks, then=...) %}):
  - a skill has 1 specialization slot from level 8, 2 from 12, 3 at 20; options 4 / 5 unlock at 12 / 16;
  - the level is the last number in the badge ("16", "12–16", "Lv 12"); with then= the first ("16 → 20");
  - then=[i] (the level-20 pick) needs two picks for 16 and must not repeat one of them;
  - pick indexes must exist in the skill's specializations.
Slugs in skill(), s(), sp(), core(), loadout(), passives(), hotline(), hotbar() must exist in data/skills/<class>.json,
items in it('{i:key}') in data/items.json.
"""
import ast
import io
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CALL = re.compile(r"\{[{%]-?\s*(?:call\s+)?(skill|s|sp|core|loadout|passives|hotline|hotbar)\((.*?)\)\s*-?[%}]\}", re.S)
ITEM = re.compile(r"\{i:(\w+)\}")


def parse_args(text):
    """Jinja call arguments -> (positional list, keyword dict), or None if they are not plain literals."""
    try:
        call = ast.parse(f"f({text})", mode="eval").body
        lit = lambda n: ast.literal_eval(n) if not (isinstance(n, ast.Name) and n.id in ("true", "false")) else n.id == "true"
        return [lit(a) for a in call.args], {k.arg: lit(k.value) for k in call.keywords}
    except (SyntaxError, ValueError):
        return None


def slots(level):
    return 0 if level < 8 else 1 if level < 12 else 2 if level < 20 else 3


def check_skill_card(slug, sk, a, kw, where, out):
    badge = a[2] if len(a) > 2 else ""
    picks = list(a[3]) if len(a) > 3 else list(kw.get("picks", []))
    then = list(kw.get("then", []))
    if not picks and not then:
        return
    nums = [int(x) for x in re.findall(r"\d+", str(badge))]
    specs = sk["en"]["specs"]
    for i in picks + then:
        if not 0 <= i < len(specs):
            out.append(f"{where}: {slug}: pick {i} does not exist (the skill has {len(specs)} options)")
    if not nums:
        if len(picks) > 3:
            out.append(f"{where}: {slug}: {len(picks)} picks - a skill has at most 3 slots")
        return
    # A range badge ("12–16", "8 → 12") is the level the picks are for at its end; with then= the picks are for
    # the level before 20 ("16 → 20").
    level = nums[0] if then else nums[-1]
    if len(picks) > slots(level):
        out.append(f"{where}: {slug}: {len(picks)} picks at level {level} - only {slots(level)} slot(s) "
                   "(1 from 8, 2 from 12, 3 at 20); put the third in then=[i]")
    for i in picks:
        if i == 3 and level < 12 or i == 4 and level < 16:
            out.append(f"{where}: {slug}: option {i + 1} unlocks at {12 if i == 3 else 16}, badge says {level}")
    if then:
        if len(picks) != 2:
            out.append(f"{where}: {slug}: then={then} needs exactly two picks before it, has {len(picks)}")
        if set(then) & set(picks):
            out.append(f"{where}: {slug}: then={then} repeats a pick")
        if len(then) > 1:
            out.append(f"{where}: {slug}: then= takes one option (the third slot)")


def slugs_in(name, a, kw):
    if name in ("skill", "s", "sp"):
        return a[:1]
    if name in ("core", "loadout"):
        return [x[0] for x in a[0]] if a else []
    if name == "passives":
        return list(a[0]) if a else []
    if name == "hotline":
        return list(a[2]) + list(kw.get("opt", [])) if len(a) > 2 else []
    if name == "hotbar":
        return [s for col in (a[0] if a else []) if col for s in col[1]]
    return []


def lint(classes=None):
    out = []
    items = json.loads((ROOT / "data/items.json").read_text(encoding="utf-8"))
    for d in sorted((ROOT / "src/content").iterdir()):
        if not d.is_dir() or (classes and d.name not in classes):
            continue
        skills_p = ROOT / "data/skills" / f"{d.name}.json"
        if not skills_p.exists():
            continue
        skills = json.loads(skills_p.read_text(encoding="utf-8"))
        for f in sorted(d.glob("*.html")):
            text = f.read_text(encoding="utf-8")
            rel = f.relative_to(ROOT).as_posix()
            check_cards = f.stem == "en"  # the other languages repeat the same tags (i18n_check.py compares them)
            for m in CALL.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                where = f"{rel}:{line}"
                parsed = parse_args(m.group(2))
                if parsed is None:
                    continue
                a, kw = parsed
                for slug in slugs_in(m.group(1), a, kw):
                    if isinstance(slug, str) and slug not in skills:
                        out.append(f"{where}: unknown skill '{slug}' in {m.group(1)}()")
                if m.group(1) == "skill" and check_cards and a and a[0] in skills:
                    check_skill_card(a[0], skills[a[0]], a, kw, where, out)
                if m.group(1) == "sp" and len(a) > 1 and a[0] in skills and not 0 <= a[1] < len(skills[a[0]]["en"]["specs"]):
                    out.append(f"{where}: sp('{a[0]}', {a[1]}) - no such option")
            for m in ITEM.finditer(text):
                if m.group(1) not in items:
                    out.append(f"{rel}:{text.count(chr(10), 0, m.start()) + 1}: unknown item '{m.group(1)}' - add it to "
                               "data/class_items.json and run tools/fetch_items.py")
    return out


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    out = lint(sys.argv[1:] or None)
    for line in out:
        print(line)
    print(f"{len(out)} problem(s)" if out else "guides ok")
    sys.exit(1 if out else 0)


if __name__ == "__main__":
    main()
