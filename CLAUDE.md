# AION 2 Guides

Static multi-class guide site (EN/RU/UK/TR) for AION 2 global Season 1, built with Python + Jinja2 into `docs/` for GitHub Pages.

Read `CONTEXT.md` first — it has the user's requirements, verified game facts and the site architecture.

- Build: `.venv/Scripts/python tools/build.py` (create the venv with `python -m venv .venv` and `pip install -r requirements.txt` if missing)
- Preview: `python -m http.server 8000 --directory docs`
- Refresh skill data/icons: `.venv/Scripts/python tools/fetch_skills.py gladiator ranger templar assassin chanter sorcerer cleric elementalist`
- Refresh class art: `.venv/Scripts/python tools/fetch_art.py`
- Social previews (og images) after changing a title, lead or header art: `.venv/Scripts/python tools/make_og.py`, then build
- Daevanion boards (static route board on class pages; every class has the data, Elementalist has no route yet): `.venv/Scripts/python tools/fetch_boards.py <class>` → `data/boards/<class>.json` (takes a few minutes);
  presets (which skills each mode takes) are in `data/boards/presets.json`; show it in a guide with `{{ dv_board('pve') }}`.
- Find fresh popular guides: `find-guides` skill → `.venv/Scripts/python tools/find_guides.py <class> [--lang ru] [--period week|month|any]`
  (views, likes, date; marks videos already used on the site and known authors).
- Update a guide from a YouTube video: follow the `guide-from-video` skill (`.claude/skills/guide-from-video/SKILL.md`) —
  prepare, analyse, compare with the guide, propose, and edit only after the user agrees. Prepare in one command:
  `.venv/Scripts/python tools/video_guide.py <youtube url or id>` = `fetch_video.py` (Full HD, no sound → `frames/<id>/video.*`,
  git-ignored) + `fetch_transcript.py` (→ `frames/<id>/transcript.json`) + `storyboard.py <id>` (frames + contact sheets with the transcript line; a frame every
  1–4 s depending on the length, `--every N` to override). Full-size frames: `tools/storyboard.py <id> --at 7:45 465`.
  A video file of your own: `tools/storyboard.py <file.mp4> <youtube id>`. No captions on YouTube: `tools/transcribe.py <id> --lang en`
  (local speech recognition, needs `pip install faster-whisper`), then `tools/storyboard.py <id>` again.
- Raster site icons (Google wants a 48px-multiple PNG/ICO): `.venv/Scripts/python tools/make_icons.py`
- Dungeon / boss names and portraits for the Dungeons page: `.venv/Scripts/python tools/fetch_dungeons.py` → `data/dungeons_db.json`; our text is `data/dungeons.json`, arena diagrams `src/templates/diagrams/*.svg`
- Edit `data/*.json` by path without re-dumping the layout: `.venv/Scripts/python tools/jedit.py` (`find`, `get`, `set`, `add`, `insert`,
  `rep`, `dump --lang ru`, `numfix`); from Python: `from jedit import set_values, insert_after, insert_item, replace_strings`.
- Refresh item icons/names for the guide pages (progression, crafting): `.venv/Scripts/python tools/fetch_items.py` (search: `--find <name>`)
- **Source material stays local, never in git:** creators' guides, videos, transcripts, frames and screenshots live in
  `frames/<youtube id>/` (git-ignored). Do not save them under `data/`, `src/` or `docs/`, and do not publish them on the site —
  the repo holds only our own text, the data from questlog.gg and links to the sources.
  Transcript only: `.venv/Scripts/python tools/fetch_transcript.py <video id>` → `frames/<id>/transcript.json`.
- Launch day (Oct 5): work through `LAUNCH.md` — every value that must be checked against the live servers.
- Do not push without the user's explicit go-ahead; they check locally first. On "Коміт і пуш" follow the `ship` skill
  (`tools/preflight.py` checks dates, What's new, translations and secrets against `origin/main`).
- Translate approved English changes with the `translate-site` skill (`.claude/skills/translate-site/SKILL.md`, glossary next to it):
  only the changed strings / lines. `.venv/Scripts/python tools/i18n_check.py` lists what changed since the last commit
  (`--since <ref>`) and checks that every language is in step with English (`--all`: check only).
- Every guide text exists in `src/content/<class>/en.html`, `ru.html`, `uk.html` and `tr.html` — change all four; every `{"en", "ru"}` string in
  `data/` has a `"uk"` and a `"tr"` too, and `data/i18n.json` has `uk` and `tr` blocks. Turkish (Oct 4, from GitHub issue #1) follows the Ukrainian
  rules: game names in English, the rest in Turkish (AI translation; native speakers send fixes as PRs). A missing `"tr"` string, i18n key or
  `tr.html` falls back to English at build time (`TEXT_FALLBACK` in `tools/build.py`), so the build never breaks — but add the Turkish text.
  Put the `"tr"` key right after `"uk"` and keep the hand-formatted JSON layout (don't re-dump the data files with json.dumps). Ukrainian pages use **English** names for everything from the game data (classes, skills, items, sets, bosses, zones, boards, stats in tooltips) —
  questlog.gg has no Ukrainian; the build copies the English game data under `uk` (`DATA_LANG` in `tools/build.py`). In `uk.html` and in `"uk"` data
  strings write skill and game names in English (as the EN text does), the rest in Ukrainian.
- Skill cards (`{% call skill('slug', kind, 'level', [picks]) %}`): a skill has 1 specialization slot from level 8, 2 from 12 and 3 only
  at 20, and options 4 / 5 unlock at 12 / 16 — never list more picks than the level allows; for "16 → 20" list the two picks for 16
  and put the third slot's pick in `then=[i]` (shown as a dashed "20" chip) — or say in the text when the third pick is a free choice.
  `tools/build.py` checks these rules and the skill / item slugs (`tools/lint_guides.py`) — fix every "guide check" line it prints.
- Changed a class guide → set that class's `updated` in `data/site.json` to today (the "Updated" date in the guide header and on the
  home card), the date in `classes[].src.<mode>` for every mode whose source was re-checked, and the site-wide `updated` (footer, sitemap).
- New or updated guide source → also update its creator in `data/sources.json` (group `creators`): `name` exactly as it is written in
  `site.json → classes[].src`, `lang` (the language they make content in: `en` / `ru`), `plays` (the class they main — **one class per creator**, even if they make guides for several:
  TitanTheF writes about Ranger, Assassin and Chanter but is listed only for Ranger; more than one only for a known exception; `[]` for general
  guide channels like Grobs), channel links (`twitch` / `youtube`) and `used` classes. The "Who to watch" line on class pages is built from this (`watch_for` in `tools/build.py`): same-language guide authors who play the class,
  then streamers from the `watch` group (RU), then English authors on RU pages, max 3. New streamers go into the `watch` group with `lang`
  and one class in `used` — the same rule: a streamer is shown in "Who to watch" for one class only.
