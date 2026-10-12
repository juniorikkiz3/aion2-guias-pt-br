# AION 2 Guides

Class guides and trackers for **AION 2 global Season 1** in English, Russian and Ukrainian. Skill, item and Daevanion board data come from the global client (via questlog.gg); the builds come from creators' guides, which every page lists as its sources.

**Live site:** https://couga54.github.io/aion2-guides/

## What's on the site

| Class | PvE | PvP | Leveling | Daevanion boards |
|---|---|---|---|---|
| Gladiator | ✅ | ✅ | ✅ | PvE, PvP, leveling |
| Templar | ✅ | ✅ | ✅ | PvE, PvP |
| Ranger | ✅ | — | ✅ | PvE |
| Assassin | ✅ | — | ✅ | PvE |
| Chanter | ✅ | — | ✅ | PvE |
| Cleric | ✅ | — | ✅ | PvE |
| Sorcerer | ✅ | — | ✅ | PvE |
| Elementalist | — | — | ✅ | — |

A PvP mode is switched on only when there is a real source for it.

Besides the class guides:

- **After 45** (progression) and **Gathering and crafting** — what to do at the level cap, gear upgrade basics, professions.
- **Game settings** — controls, targeting, keys, on-screen info, FPS and mass PvP options worth changing on day one.
- **First week** — a day-by-day plan for the launch week.
- **Weekly tracker** and **Bosses** — checklists and respawn timers kept in the browser, with optional notifications.
- **Sources** — every creator and site the guides are built on, and who to watch for each class.
- **What's new** — a changelog, also shown once as a popup after each update.

On every class page: a "build at a glance" panel, skill cards with specializations, hover tooltips for skills and items, hotbar lines and the in-game macro, a leveling checklist, and the Daevanion boards with the route the guide takes. Search is on `Ctrl+K`.

## How it's built

A small Python static-site generator (Jinja2) renders everything into `docs/`, which GitHub Pages serves. No framework and no build step for CSS or JS.

```
data/
  site.json               classes (modes, sources and dates, status), languages, launch events
  i18n.json               UI strings (EN / RU / UK)
  skills/<class>.json     skill names, descriptions, specializations (generated)
  boards/<class>.json     Daevanion boards: nodes, costs, effects (generated)
  boards/presets.json     which nodes each guide mode takes; the route is calculated at build time
  items.json              item names, icons, tooltips (generated)
  class_items.json        item keys used inside class guides
  leveling/*.json         leveling checklist: shared route + per-class steps
  progression.json, crafting.json, settings.json, week1.json, weekly.json, bosses.json   the other pages
  sources.json            creators and sites, "who to watch"
  changelog.json          What's new
src/
  templates/              base, home, class page, guide pages, trackers, macros
  content/<class>/        en.html, ru.html and uk.html — the guide text
  assets/                 css, js, icons, class art, social preview images
tools/
  build.py                data + templates → docs/
  fetch_skills.py         skills and icons from questlog.gg
  fetch_boards.py         Daevanion boards from questlog.gg
  fetch_items.py          items and icons from questlog.gg
  fetch_art.py            class art
  make_og.py              social preview images
  video_guide.py          prepare a guide video for analysis: fetch_video.py + fetch_transcript.py + storyboard.py
docs/                     build output (committed, published)
frames/                   local working files per guide video (git-ignored, see below)
```

## Setup

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt
```

On macOS/Linux use `.venv/bin/python` instead of `.venv/Scripts/python`.

## Build and preview

```bash
.venv/Scripts/python tools/build.py
python -m http.server 8000 --directory docs
```

Then open http://localhost:8000.

## Updating a guide from a video

```bash
.venv/Scripts/python tools/video_guide.py <youtube url or id>
```

This downloads the video (Full HD, no sound), saves its transcript and cuts it into frames and contact sheets in `frames/<youtube id>/`. The rest of the workflow — reading the frames, comparing with the current guide, proposing changes, what to update afterwards — is described in `.claude/skills/guide-from-video/SKILL.md`.

**Source material stays local.** Creators' videos, transcripts, frames and screenshots live only in `frames/`, which is git-ignored; they are never committed or published. The repository holds our own text, the game data and links to the sources.

## Editing a class guide

- The text is in `src/content/<class>/en.html`, `ru.html` and `uk.html` — always change all three. Ukrainian pages show skill, item and other game names in English (there is no Ukrainian game data), so `uk.html` writes them in English too.
- `{{ s('skill-slug') }}` renders a skill with its icon and name in the page language; `{{ it('{i:item_key}') }}` does the same for an item.
- `{% call skill('slug', 'must', '16', [1, 3]) %}…{% endcall %}` is a skill card with the chosen specializations; `hotline(...)` and `macroseq(...)` draw hotbar lines and macro steps; `{{ dv_board('pve') }}` shows the Daevanion boards with that mode's route.
- Sections are tagged with the modes they belong to (`'pve'`, `'pvp'`, `'pve pvp'`, `'lvl'`). Each PvP block sits right after its PvE counterpart, so both modes read in the same order.
- After a change, set the class's `updated` date and the `src` date of every re-checked mode in `data/site.json`, update the creator in `data/sources.json`, and add an entry to `data/changelog.json`.
- In leveling steps, `[[skill-slug]]` gives the skill name and `[[skill-slug#N]]` its N-th specialization.

## Adding a class

1. Fetch its data: `tools/fetch_skills.py <class>` and `tools/fetch_boards.py <class>`.
2. Write `src/content/<class>/en.html`, `ru.html` and `uk.html` (copy an existing class as a template).
3. Add class steps to `data/leveling/<class>.json` and, for the boards, the class's presets to `data/boards/presets.json`.
4. Set `"status": "ready"` (plus `accent`, `weapon`, `difficulty`, `pitch`, `src`) for the class in `data/site.json`.
5. Run `tools/make_og.py`, then `tools/build.py`.

## Publishing

Push to `main`; GitHub Pages serves the `docs/` folder (**Settings → Pages → Deploy from a branch**, branch `main`, folder `/docs`).

Report form: the "Report a mistake" buttons open a form that is sent to the owner's Telegram through a small Cloudflare Worker — its code is in `tools/feedback-worker/worker.js` (secrets `BOT_TOKEN` and `CHAT_ID` are set in the Worker, never in the repo), its address is `feedback_url` in `data/site.json` (empty string = the buttons open a GitHub issue instead).

Google Analytics: the measurement ID is `ga` in `data/site.json` (empty string turns it off); the tag is not loaded on localhost.

`LAUNCH.md` lists every value that has to be re-checked against the live servers; `CONTEXT.md` holds the project requirements and verified game facts.

## Credits

Unofficial fan site, not affiliated with NCSOFT. AION 2, its art and its skill icons are © NCSOFT. Game data comes from [questlog.gg](https://questlog.gg/aion-2/). The builds are based on creators' guides — each guide page and the Sources page link to them.
