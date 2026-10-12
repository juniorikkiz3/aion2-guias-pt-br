"""What needs translating, and are the translations in step with English?

    .venv/Scripts/python tools/i18n_check.py              # changes since the last commit (working tree vs HEAD)
    .venv/Scripts/python tools/i18n_check.py --since REF  # changes since a commit / tag / branch
    .venv/Scripts/python tools/i18n_check.py --all        # only the full consistency check, no diff

Reports
  1. data strings whose "en" changed (or are new) since REF, and which other languages were not touched;
  2. guide lines (src/content/<class>/en.html) changed since REF, so the same lines get translated;
  3. missing languages: a {"en": ...} string without "ru"/"uk"/"tr", or "tr" not right after "uk";
     i18n.json keys missing from a language block;
  4. guide skeleton: every template tag ({% %} / {{ }}) in ru/uk/tr.html must match en.html line by line
     (string arguments may differ - they are the translated text).
Exit code 1 when 3 or 4 found a problem.
"""
import io
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LANGS = json.loads((ROOT / "data/site.json").read_text(encoding="utf-8"))["langs"]
OTHER = [l for l in LANGS if l != "en"]
# Game data from questlog (names come from the client, not from us) - never translated by hand.
GENERATED = {"items.json", "dungeons_db.json", "bosses.json"}
GENERATED_DIRS = {"skills"}


def data_files():
    for p in sorted((ROOT / "data").rglob("*.json")):
        rel = p.relative_to(ROOT / "data")
        if rel.name in GENERATED or rel.parts[0] in GENERATED_DIRS:
            continue
        if rel.parts[0] == "boards" and rel.name != "presets.json":
            continue
        yield p


def git_show(ref, rel):
    r = subprocess.run(["git", "show", f"{ref}:{rel}"], cwd=ROOT, capture_output=True)
    return r.stdout.decode("utf-8") if r.returncode == 0 else None


def texts(node, path=""):
    """{path: {lang: text}} for every dict that has a string "en"."""
    out = {}
    if isinstance(node, dict):
        if isinstance(node.get("en"), str):
            out[path] = node
        for k, v in node.items():
            if k not in LANGS:
                out.update(texts(v, f"{path}.{k}" if path else k))
    elif isinstance(node, list):
        for i, v in enumerate(node):
            out.update(texts(v, f"{path}[{i}]"))
    return out


def short(s, n=90):
    s = re.sub(r"\s+", " ", s)
    return s if len(s) <= n else s[: n - 1] + "…"


def diff_data(ref):
    found = 0
    for p in data_files():
        rel = p.relative_to(ROOT).as_posix()
        new = texts(json.loads(p.read_text(encoding="utf-8")))
        if rel == "data/i18n.json":
            continue  # handled below by key
        old_src = git_show(ref, rel)
        old = texts(json.loads(old_src)).values() if old_src else []
        # Match by text, not by path: a new list item shifts every index after it.
        was = {l: {d.get(l) for d in old} for l in LANGS}
        for path, d in new.items():
            if d["en"] in was["en"]:
                continue
            stale = [l for l in OTHER if d.get(l) and d.get(l) in was[l]]
            missing = [l for l in OTHER if not d.get(l)]
            same = [l for l in OTHER if d.get(l) == d["en"]]
            found += 1
            tag = "NEW/EN CHANGED"
            note = []
            if stale:
                note.append("not updated: " + ",".join(stale))
            if missing:
                note.append("missing: " + ",".join(missing))
            if same:
                note.append("same as en (placeholder?): " + ",".join(same))
            print(f"  {rel} {path} [{tag}] {'; '.join(note)}\n      en: {short(d['en'])}")
    # i18n.json: {lang: {key: text}}
    p = ROOT / "data/i18n.json"
    new = json.loads(p.read_text(encoding="utf-8"))
    old_src = git_show(ref, "data/i18n.json")
    old = json.loads(old_src) if old_src else {l: {} for l in LANGS}
    for k, v in new["en"].items():
        o = old.get("en", {}).get(k)
        if o == v:
            continue
        stale = [l for l in OTHER if o is not None and new.get(l, {}).get(k) == old.get(l, {}).get(k)]
        missing = [l for l in OTHER if k not in new.get(l, {})]
        found += 1
        note = ("not updated: " + ",".join(stale) + " " if stale else "") + ("missing: " + ",".join(missing) if missing else "")
        print(f"  data/i18n.json {k} [{'NEW' if o is None else 'EN CHANGED'}] {note}\n      en: {short(str(v))}")
    return found


def diff_content(ref):
    r = subprocess.run(["git", "diff", "-U0", ref, "--", "src/content/*/en.html", "src/content/*/*/en.html"],
                       cwd=ROOT, capture_output=True)
    out = r.stdout.decode("utf-8")
    new_files = subprocess.run(["git", "ls-files", "--others", "--exclude-standard", "src/content"],
                               cwd=ROOT, capture_output=True).stdout.decode("utf-8").split()
    found = 0
    cur = None
    for line in out.splitlines():
        if line.startswith("+++ b/"):
            cur = line[6:]
        elif line.startswith("@@") and cur:
            m = re.search(r"\+(\d+)(?:,(\d+))?", line)
            start, n = int(m.group(1)), int(m.group(2) or 1)
            if n:
                found += 1
                en = (ROOT / cur).read_text(encoding="utf-8").split("\n")[start - 1:start - 1 + n]
                old = {}
                for l in OTHER:
                    tr_rel = cur[: -len("en.html")] + f"{l}.html"
                    p = ROOT / tr_rel
                    tr = p.read_text(encoding="utf-8").split("\n")[start - 1:start - 1 + n] if p.exists() else []
                    prev = (git_show(ref, tr_rel) or "").split("\n")
                    if tr == en and any(x.strip() and re.sub(TAG, "", x).strip() for x in en):
                        old[l] = "same as en"
                    elif tr and all(x in prev for x in tr):
                        old[l] = "unchanged"
                note = "; ".join(f"{l}: {v}" for l, v in old.items())
                print(f"  {cur}:{start}" + (f"-{start + n - 1}" if n > 1 else "") + (f"  ({note})" if note else ""))
            else:
                found += 1
                print(f"  {cur}: lines removed after {start}")
    for f in new_files:
        if f.endswith("/en.html"):
            found += 1
            print(f"  {f}: new file")
    return found


def check_missing():
    bad = 0
    for p in data_files():
        rel = p.relative_to(ROOT).as_posix()
        data = json.loads(p.read_text(encoding="utf-8"))
        if rel == "data/i18n.json":
            for l in OTHER:
                miss = [k for k in data["en"] if k not in data.get(l, {})]
                if miss:
                    bad += 1
                    print(f"  {rel} [{l}] missing keys: {', '.join(miss)}")
            continue
        for path, d in texts(data).items():
            miss = [l for l in OTHER if l not in d]
            keys = list(d)
            order = "uk" in keys and "tr" in keys and keys.index("tr") != keys.index("uk") + 1
            if miss or order:
                bad += 1
                print(f"  {rel} {path}: " + (f"missing {','.join(miss)} " if miss else "") + ("'tr' not after 'uk'" if order else ""))
    return bad


TAG = re.compile(r"\{%.*?%\}|\{\{.*?\}\}")
STR = re.compile(r"""'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*\"""")
# Inline skill / item mentions: a translation may name a skill the English line only describes.
INLINE = re.compile(r"\{\{\s*(s|it)\(")


def skeleton(line):
    """(block tags, inline mentions) with every string argument replaced by S."""
    tags = [STR.sub("S", m) for m in TAG.findall(line)]
    return [t for t in tags if not INLINE.match(t)], sorted(t for t in tags if INLINE.match(t))


def check_skeleton():
    bad = 0
    for en_p in sorted((ROOT / "src/content").rglob("en.html")):
        en = en_p.read_text(encoding="utf-8").split("\n")
        for l in OTHER:
            p = en_p.with_name(f"{l}.html")
            rel = p.relative_to(ROOT).as_posix()
            if not p.exists():
                bad += 1
                print(f"  {rel}: missing")
                continue
            tr = p.read_text(encoding="utf-8").split("\n")
            if len(tr) != len(en):
                bad += 1
                print(f"  {rel}: {len(tr)} lines, en.html has {len(en)}")
            diff, soft = [], []
            for i, (a, b) in enumerate(zip(en, tr)):
                (ta, ia), (tb, ib) = skeleton(a), skeleton(b)
                if ta != tb:
                    diff.append(i + 1)
                elif ia != ib:
                    soft.append(i + 1)
            if diff:
                bad += 1
                more = f" (+{len(diff) - 10} more)" if len(diff) > 10 else ""
                print(f"  {rel}: template tags differ from en.html on lines {', '.join(map(str, diff[:10]))}{more}")
            if soft:
                print(f"  {rel}: (note) skill/item mentions differ on lines {', '.join(map(str, soft))}")
    return bad


def main():
    args = sys.argv[1:]
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    if "--all" not in args:
        ref = args[args.index("--since") + 1] if "--since" in args else "HEAD"
        print(f"Data strings to translate (since {ref}):")
        if not diff_data(ref):
            print("  none")
        print(f"Guide lines changed in en.html (since {ref}):")
        if not diff_content(ref):
            print("  none")
    print("Missing languages:")
    bad = check_missing()
    if not bad:
        print("  none")
    print("Guide skeleton (ru/uk/tr vs en):")
    sk = check_skeleton()
    if not sk:
        print("  ok")
    sys.exit(1 if bad or sk else 0)


if __name__ == "__main__":
    main()
