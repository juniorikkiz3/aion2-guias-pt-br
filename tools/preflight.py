"""Checks before "Коміт і пуш": everything the site's rules ask for, compared with what is already published.

    .venv/Scripts/python tools/preflight.py            # compare with origin/main (what is live)
    .venv/Scripts/python tools/preflight.py --base REF

Prints ERROR (must fix), WARN (look at it), NOTE (reminder). Exit code 1 if there is an ERROR.
It does not build, commit or push - the ship skill does that after this passes.
"""
import io
import json
import re
import subprocess
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
problems = {"ERROR": 0, "WARN": 0, "NOTE": 0}


def say(level, msg):
    problems[level] += 1
    print(f"  {level}: {msg}")


def git(*args):
    r = subprocess.run(["git", *args], cwd=ROOT, capture_output=True)
    return r.stdout.decode("utf-8", "replace"), r.returncode


def today():
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("Europe/Kyiv")).date().isoformat()
    except Exception:
        return datetime.now().date().isoformat()  # the user's machine runs on Kyiv time


def load(rel, text=None):
    return json.loads(text if text is not None else (ROOT / rel).read_text(encoding="utf-8"))


def main():
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    args = sys.argv[1:]
    base = args[args.index("--base") + 1] if "--base" in args else "origin/main"
    git("fetch", "--quiet", "origin")
    day = today()

    committed, _ = git("diff", "--name-only", f"{base}...HEAD")
    working, _ = git("diff", "--name-only", "HEAD")
    untracked, _ = git("ls-files", "--others", "--exclude-standard")
    changed = sorted({f for f in (committed + working + untracked).split("\n") if f})
    src = [f for f in changed if not f.startswith("docs/")]
    ahead, _ = git("rev-list", "--count", f"{base}..HEAD")
    print(f"Base {base}, today {day} (Kyiv). Changed outside docs/: {len(src)} files"
          + (f", {ahead.strip()} local commit(s) not pushed" if ahead.strip() not in ("", "0") else ""))
    if not src:
        print("Nothing to ship.")
        return

    print("Files:")
    for f in src:
        print(f"  {f}")

    # --- never in git
    print("Safety:")
    for f in changed:
        if f.startswith("frames/") or f.endswith((".mp4", ".webm", ".mkv")):
            say("ERROR", f"source material must stay local: {f}")
    diff, _ = git("diff", base, "--", ".", ":(exclude)docs")
    diff += "".join((ROOT / f).read_text(encoding="utf-8", errors="ignore") for f in untracked.split() if (ROOT / f).is_file()
                    and (ROOT / f).stat().st_size < 2_000_000)
    for pat, what in ((r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b", "Telegram bot token"), (r"\bghp_[A-Za-z0-9]{30,}", "GitHub token"),
                      (r"\bgithub_pat_[A-Za-z0-9_]{30,}", "GitHub token"), (r"\bsk-[A-Za-z0-9_-]{20,}", "API key")):
        if re.search(pat, diff):
            say("ERROR", f"looks like a {what} in the changes - remove it")
    if not problems["ERROR"]:
        print("  ok")

    # --- dates
    print("Dates:")
    errors_before = problems["ERROR"]
    site = load("data/site.json")
    content_changed = [f for f in src if f.startswith(("src/", "data/"))]
    if content_changed and site.get("updated") != day:
        say("ERROR", f'data/site.json "updated" is {site.get("updated")}, should be {day} (footer, sitemap)')
    classes = {c["slug"]: c for c in site["classes"]}
    touched = sorted({f.split("/")[2] for f in src if f.startswith("src/content/")}
                     | {Path(f).stem for f in src if f.startswith(("data/leveling/", "data/boards/")) and Path(f).stem in classes})
    def en_strings(text):
        out = []
        def walk(x):
            if isinstance(x, dict):
                for k, v in x.items():
                    if k not in ("ru", "uk", "tr"):
                        walk(v)
            elif isinstance(x, list):
                for v in x:
                    walk(v)
            else:
                out.append(x)
        walk(json.loads(text))
        return out

    def data_en_changed(f):
        old, rc = git("show", f"{base}:{f}")
        return rc != 0 or not (ROOT / f).exists() or en_strings(old) != en_strings((ROOT / f).read_text(encoding="utf-8"))

    # A class guide changed = its en.html or the English (or language-neutral) part of its leveling / board data;
    # a change only in ru / uk / tr is a translation.
    en_changed = {f.split("/")[2] for f in src if f.startswith("src/content/") and f.endswith("/en.html")}         | {Path(f).stem for f in src if f.startswith(("data/leveling/", "data/boards/")) and data_en_changed(f)}
    for slug in touched:
        c = classes.get(slug)
        if not c:
            continue
        if slug not in en_changed:
            if c.get("updated") != day:
                say("NOTE", f'{slug}: only translations changed - set classes[].updated to {day} if the guide itself changed')
            continue
        if c.get("updated") != day:
            say("ERROR", f'{slug}: guide changed, classes[].updated is {c.get("updated")} - set {day}')
        modes = {m: v[1] if isinstance(v, list) and len(v) > 1 else None for m, v in c.get("src", {}).items()}
        old = [m for m, d in modes.items() if d != day]
        if old:
            say("NOTE", f"{slug}: src dates not today for {', '.join(f'{m} ({modes[m]})' for m in old)} - "
                        "update a mode only if its source was re-checked")
    if problems["ERROR"] == errors_before:
        print("  ok")

    # --- What's new
    print("What's new:")
    errors_before = problems["ERROR"]
    pub_text, rc = git("show", f"{base}:data/changelog.json")
    pub = load("", pub_text)["entries"] if rc == 0 else []
    cur = load("data/changelog.json")["entries"]
    pub_ids = {e["id"] for e in pub}
    new = [e for e in cur if e["id"] not in pub_ids]
    guide_like = [f for f in src if f.startswith(("src/content/", "data/")) and not f.startswith("data/changelog.json")]
    if not new:
        if guide_like:
            say("WARN", "no new What's new entry - fine for small fixes; a real change needs one entry")
        else:
            print("  no new entry (no content changes)")
    else:
        if len(new) > 1:
            say("ERROR", f"{len(new)} new entries ({', '.join(e['id'] for e in new)}) - one entry per push")
        if cur[0]["id"] != new[0]["id"]:
            say("ERROR", "the new entry is not the first one in the list")
        for e in new:
            if e.get("date") != day:
                say("WARN", f"entry {e['id']} date is {e.get('date')}, today is {day}")
            old_texts = {it.get("en") for p in pub for it in p.get("items", [])}
            for it in e.get("items", []):
                if it.get("en") in old_texts:
                    say("ERROR", f"entry {e['id']} repeats an item that is already published: {it['en'][:70]}")
                miss = [l for l in ("ru", "uk", "tr") if not it.get(l)]
                if miss:
                    say("ERROR", f"entry {e['id']}: an item has no {', '.join(miss)}")
        if problems["ERROR"] == errors_before:
            print(f"  new entry {new[0]['id']}: {len(new[0].get('items', []))} item(s)")
    for e in pub:
        cur_e = next((c for c in cur if c["id"] == e["id"]), None)
        if cur_e and cur_e != e:
            added = len(cur_e.get("items", [])) > len(e.get("items", []))
            say("WARN", f"published entry {e['id']} " + ("got new items - visitors who closed it will not see them; "
                "put new items in a new entry" if added else "was edited - only fix typos in old entries"))

    # --- translations
    print("Translations:")
    out, rc = git("rev-parse", "--verify", "--quiet", base)
    r = subprocess.run([sys.executable, str(ROOT / "tools/i18n_check.py"), "--since", base], cwd=ROOT, capture_output=True)
    text = r.stdout.decode("utf-8", "replace")
    for line in text.split("\n"):
        if re.search(r"same as en|not updated|unchanged|missing", line):
            say("WARN", line.strip())
    if r.returncode:
        say("ERROR", "tools/i18n_check.py found missing languages or broken guide skeletons - run it for details")
    if "WARN" not in text and not r.returncode:
        print("  ok")

    # --- reminders
    print("Reminders:")
    if any(f.startswith("src/assets/art/") for f in src) or any(f == "data/i18n.json" for f in src):
        say("NOTE", "header art or i18n changed - if a page title, lead or header image changed, run tools/make_og.py")
    if any(f.startswith(("src/", "data/", "tools/build.py")) for f in src):
        say("NOTE", "build before committing so docs/ matches: .venv/Scripts/python tools/build.py")
    if any(f.startswith("src/content/") for f in src) and not any(f == "data/sources.json" for f in src):
        say("NOTE", "guide changed from a new source? its creator belongs in data/sources.json")

    print(f"\n{problems['ERROR']} error(s), {problems['WARN']} warning(s), {problems['NOTE']} note(s)")
    sys.exit(1 if problems["ERROR"] else 0)


if __name__ == "__main__":
    main()
