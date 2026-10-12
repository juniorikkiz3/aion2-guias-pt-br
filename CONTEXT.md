# AION 2 Guides — session context

Working notes carried over from the chat that created this repo, so work can continue
from the repo root on any machine (paths below are relative to it).

## Goal

A multi-class guide site for **AION 2 global Season 1** (launch: **Oct 5, 2026, 13:00 UTC**,
Founder's early access from Sep 30), published on GitHub Pages:
`https://couga54.github.io/aion2-guides/` (repo `https://github.com/Couga54/aion2-guides.git`).

Requirements from the user (in their words, translated):
- Guides for several classes; start with **Gladiator** and **Ranger** (Стрелок).
- It should look like a **site, not a document**.
- **EN / RU / UK / TR** versions (Ukrainian since Oct 1: our text in Ukrainian, game names — skills, items, sets, bosses, boards — in English, questlog has no Ukrainian;
  Turkish since Oct 4, same rules, AI-translated after a request in GitHub issue #1 — corrections come as separate PRs).
- A **PvE / PvP / Leveling** switch at the top; the whole page shows only the chosen mode.
- Switching modes must **not jump the page** (keep scroll position).
- **Leveling** mode: short, second-monitor friendly, an **interactive checklist with progress**
  (like https://nemobek.github.io/aion2-guide/), class-specific: general route steps +
  when to put points into which skill / specialization / stigma.
- **Never push** until the user has checked locally and says so.

## History

1. Started in a separate repo `Couga54/aion2-gladiator-guide`:
   a single-page Gladiator guide built from Arthars Gaming's video
   ("The ULTIMATE AION 2 Gladiator Starter Guide!", https://www.youtube.com/watch?v=tYTZ8VucMXw),
   transcript in that repo's `data/chapters.json`. Local commits only, never pushed.
   That repo's `docs/index.html` holds the final single-page EN version (PvE/PvP/Leveling)
   and is the source the Gladiator content here was ported from.
2. The user then created this repo to hold all classes in one place.

## Verified facts (checked Sep 27, 2026)

- questlog.gg has **global client data** (`language: en` / `ru`) and KR/TW data (`en-nc`).
  API: `https://questlog.gg/aion-2/api/trpc/database.getSkills?input={"language":"en","page":1,"mainCategory":"ranger"}`
  and `database.getSkill?input={"id":"...","language":"en"}`; icons at
  `https://cdn.questlog.gg/aion-2/assets/Game/UI/Resource/Texture/Skill/ICON_XX_SKILL_NNN.webp`
  (send a User-Agent header). `tools/fetch_skills.py` pulls both languages + icons.
- Global vs KR/TW: active skills and passives identical; **stigmas cap at level 20 in global**
  (no L25 tier); **4 stigma slots** in Season 1 (KR has 6); **no Heroic gear** in Season 1;
  expeditions 5 players, sanctuaries 10; cross-faction dungeons; Daevanion bonuses weaker.
  Level cap for global not announced (KR/TW went 45 → 50 in July 2026).
- Skill levels: 10 from skill points, +4 Daevanion (→14), +1 per ring, +arcana (→20).
  Specialization options unlock at skill levels 8 / 8 / 8 / 12 / 16. Slots: 1 from level 8, 2 from 12, the 3rd only
  at 20 (seen in Arthars' and Kaeria's videos: a skill at 14–16 shows two slots and a locked third). A skill card must
  not show more picks than its level has slots, nor a pick that unlocks later — for "16 → 20" show the two picks for 16
  and name the third in the text.
  Stigmas unlock around character Lv 22–23 (after Ascension). Daevanion boards:
  Nezekan 12 (Combat Speed, Cooldown Reduction), Zikel 20 (Damage Boost / Tolerance), Vaizel 30 (Critical Damage
  Boost / Tolerance), Triniel 40 (Multi-Hit Chance / Resist), Azphel 45 (PvP Damage Boost / Tolerance). Global has
  these five only — no Ariel (the PvE board of KR/TW).
- Launch schedule (checked Sep 27, 2026; stored in `data/site.json` → `events`):
  Founder's pre-download **Sep 28, 13:00 UTC** (NC on the official YouTube channel: "9/28 at 6:00AM PDT");
  Early Access **Sep 30, 14:00 UTC** (moved by NC on the day from 13:00 UTC, first to 16:30 and then to 17:00 Kyiv time, from the user);
  pre-download for free players — **not announced** (shown as "date not announced");
  global launch **Oct 5, 13:00 UTC**. Update `events` when NC announces more.
- Class emblems (src/assets/classes/): the real silver class insignias, 150px, from the Fextralife wiki
  (fetch_art.py). Earlier files there were skill icons by mistake. Topbar uses a class picker dropdown
  (4×2 grid of all 8 classes, "soon" greyed out) instead of a row of links.
- Class art: official renders from the global teaser page's class carousel
  (`tools/fetch_art.py` → `src/assets/art/<slug>.webp`; NC's "spiritmaster" = our Elementalist).
- Macros (Sep 27): two tools. A **hotbar line** = several skills on one hotbar button; pressing it casts the
  highest-priority ready skill, and the BOTTOM slot has the highest priority (Grobs, Arthars' Rage Burst).
  `hotline()` takes skills in priority order and draws them in in-game order. The **in-game macro** (Skill window → Macro; one per preset, up to
  20 slots; key in Settings → Key Settings → General → Gameplay → Macro) is held and presses hotbar
  lines in a loop; 10 ms delay; cooldowns skipped. Hold the basic attack (LMB) next to the macro key,
  don't put it in the macro (Grobs). Season 1: buffs are worth pressing by hand. Keep charged
  skills, toggles/auras and gap closers out. Guides render lines with `hotline()` and slots with `macroseq()`.
  Gladiator lines come from Arthars' video (RMB: Overhead Slam → Rending Blow → Rage Burst; E: Ruinous Blow;
  buffs: Lunge Stance + Zikel's); the macro slot order is our inference. Ranger lines from 7MMO.
- Templar (Sep 27): from NoBS Game Guides' video (transcript in frames/JEWRiaOb9JY/transcript.json, local)
  + Korean posts (Inven, Vortex, FM Korea) + MMO Codex. Korean tanks run 5–6 stigmas; the global set of 4
  is our pick: Doom Shield, Battlefield Banner, Taunt, Shield of Protection (PvP: Empyrean Lord's
  Punishment, Shield of Protection, Doom Shield, Noble Armor). The macro lines are adapted from KR, untested.
  RU client names Shield Rush and Shield Smite both "Удар щитом" — data/skills/_overrides.json fixes the display.
- Weekly reset: **Wednesday 10:00 Kyiv time** (from the user, Oct 1) — `site.json → weekly_reset` (anchor 2026-09-30T07:00Z, tz Europe/Kyiv). Before that it was a guess:
  `weekly_reset.anchor` = Early Access start (Wed Sep 30 13:00 UTC),
  repeating every 7 days; the user will give the real time at launch. Odyle energy (EU test client):
  +15 every 3 h, base cap 840, chest 40, 7 weekly crafts × 40 — in `site.json → energy`.
  Weekly entry limits in data/weekly.json come from KR/TW/EU-test sites and need checking at launch.
- TitanTheF's AION 2 progression sheet (Google Sheets, RU; tabs Ranger / Assassin / Chanter + progression,
  farming, crafting) is the main source for Ranger (global rework), Assassin and Chanter. His builds live on
  aion2t.com: `https://aion2t.com/api/builds/<id>` returns JSON with skill codes (= questlog ids), levels,
  specialization indices (same order as our data), stigmas, passives. Ranger goal 8QbCF0 / start fV6T2F,
  Assassin MeyRht / iUjpcy, Chanter yDzsiQ / S5RCtE. Hotbar/macro layouts are images in the sheet.
  Global Ranger: six skills at 16 (not four at 20), stigmas Supporting Fire 20, Vaizel's Authority 20,
  Bow of Blessing 10, Explosive Arrow 10 (no Griffon Arrow). PvP for Assassin/Chanter is our own starting
  point from skill data — the sheet covers PvE only.
- The old single-page guide had **Zikel's Blessing and Lunge Stance icons swapped** —
  icons here come fresh from questlog, keyed by skill name.
- Gladiator: Overhead Slam & Aerial Snare only hit Knocked-down targets (bosses are an
  exception); Rage Burst enables Overhead Slam for 10s. Lunge Stance L20 = 50% on crit to
  cut all cooldowns by 1s (core of the build).
- Ranger sources: game8, 7mmo (KR endgame build), Vortex Gaming KR stigma posts, dcinside.
  Current meta: Deadshot / Gale Arrow / Drill Dart / Snare Shot to 20; stigmas
  Vaizel's Authority, Bow of Blessing, Griffon Arrow, Supporting Fire.

## Architecture

- `data/site.json` — classes (status ready/soon, names/roles in EN+RU+UK), base URL, launch date.
- `data/i18n.json` — UI strings EN/RU/UK/TR. Ukrainian (added Oct 1): our own text in Ukrainian, game data (skills, items, boards, bosses) in English.
- `data/weekly.json`, `data/week1.json` — tracker items and first-week goals (EN+RU+UK).
- `data/changelog.json` — "What's new" modal (base.html). Shown once per new top entry id
  (localStorage `whatsnew-seen`) and only that entry, with a link to the full changelog page
  (/<lang>/changelog/, templates/changelog.html). The "?" button and the footer link to that page; visiting it
  marks the latest entry as seen.
  Add an entry with a new id for every release.
- `frames/<youtube id>/` — local, git-ignored working files per guide video: `video.*`, `transcript.json`
  (`tools/fetch_transcript.py`), frames and contact sheets (`tools/video_guide.py`).
- `data/sources.json` — Sources & credits page (`/<lang>/sources/`): creators with YouTube/Twitch links,
  guides/databases, launch info. Add a source here whenever a guide starts relying on it —
  and credit the author by name even when there is no link to give (`"links": []`).
- `data/dungeons.json` (our text) + `data/dungeons_db.json` (dungeon / boss names and portraits from questlog,
  `tools/fetch_dungeons.py`) — Dungeons page (/<lang>/dungeons/, templates/dungeons.html, Oct 6). Mechanics from
  BIGSKALA's launch-dungeon video; arena diagrams are our own SVGs in `src/templates/diagrams/<name>.svg`
  (colours from `.dz-*` classes in site.css). Zikel (Nightmare) has no questlog entry: name from the RU client frame.
- `data/tierlist.json` — Tier list page (/<lang>/tier-list/, Oct 6, "not final and subjective"): per kind of content,
  each creator's letters (read from the video frames); the page averages S=4…D=0 and places a class by the rounded average.
- `data/skills/<class>.json` — generated by `tools/fetch_skills.py`.
- `data/leveling/common.json` + `data/leveling/<class>.json` — checklist steps (EN+RU+UK), sorted by `order`.
- `src/templates/` — `base.html`, `home.html`, `class.html`, `macros.html`, `root.html`, `404.html`.
- `src/content/<class>/<lang>.html` — guide text using macros (`section`, `skill`, `core`,
  `loadout`, `passives`, `glance`, inline `s('slug')`).
- `src/assets/` — `css/site.css`, `js/site.js`, icons, class emblems, favicon (SVG + PNG 48/96/192, `favicon.ico`, apple-touch-icon from `tools/make_icons.py`; the build copies `favicon.ico` to the site root), OG images.
- `tools/build.py` → `docs/` (committed; GitHub Pages serves `main` / `docs`).
- Python venv in `.venv` (Jinja2, Pillow). Build: `.venv/Scripts/python tools/build.py`.
  Preview: `python -m http.server 8000 --directory docs`.

## Status (end of the first session, Sep 27, 2026)

- Built: home page (class cards, launch countdown), Gladiator and Ranger pages in EN + RU,
  PvE / PvP / Leveling switch (keeps scroll position, remembered per browser, `?mode=pvp|lvl`),
  leveling checklist with progress saved per class (`localStorage` key `lvl-progress:<class>`),
  sticky side TOC (desktop) / chip TOC (mobile), dark + light themes, OG images, sitemap with hreflang.
- Root `index.html` redirects to `/en/`, `/ru/`, `/uk/` or `/tr/` (remembered choice, else browser language: uk → uk, tr → tr, ru/be → ru, else en).
- RU class names are the global client's (checked Oct 3 against item names on questlog, e.g. «Лук Стрелка», and class names in skill
  descriptions): Гладиатор, Стрелок (not Лучник), Страж, Убийца, Волшебник, Заклинатель (Elementalist), Целитель, Чародей (Chanter);
  RU skill names come from the global client via questlog. UK pages use the English class names (Gladiator, Ranger, …) —
  the game has no Ukrainian, so class names are treated like skill names (user's decision, Oct 3). TR pages do the same.
- Session 2 (Sep 27): pushed to GitHub, Pages live. Added class art (class cards,
  class hero + faint fixed backdrop on class pages), a landscape behind the home hero; a Sources & credits page (topbar button, footer, link under each guide's sources) and a launch schedule panel with timers on the home page.
- Session 3 (Sep 27): Templar guide (EN/RU, PvE/PvP/leveling), "Updated / Patch: TBD" stamp on every
  class page (site.json → classes[].updated / patch), First week page (/<lang>/week-1/, data/week1.json,
  from Spid's and LittleFattyGG's videos) and Weekly tracker (/<lang>/weekly/, data/weekly.json,
  assets/js/tracker.js): characters, weekly counters that clear themselves at each reset, Odyle energy that
  regenerates per character, all in localStorage key `aion2-tracker-v1`.
- Session 4 (Sep 27): Chanter and Assassin guides, Ranger reworked for global, macros corrected (bottom
  slot = highest priority) with leveling macros (Grobs), class cards show "Updated <date>" instead of "Guide ready".
- Session 5 (Sep 28): Sorcerer guide marked WIP (`"wip": true` in site.json → WIP tag on card, class
  menu, hero stamp and a "Work in progress" callout above the guide). No trusted global source: built from
  Vortex Gaming's KR post-balance PvE guide + MMO Codex, KR names mapped to global: Flame Burst = Blaze,
  Prayer of Focus = Wish of Concentration, Flame Harpoon = Firestorm, Infernal Flame = Hellfire,
  Winter's Grasp = Winter's Shackles, Blizzard ≈ Bittercold Wind (uncertain), Elemental Boost = Element
  Enhancement, Flame Barrier = Fire Wall, Frost Storm = Cold Storm. Accent "frost" (cyan). Remove `wip`
  once a real global build (e.g. TitanTheF) exists.
- Session 6 (Sep 28): Ranger PvE rebuilt on Whelps (video wKOm6yKuu_I, transcript saved; questlog character
  build 8655 → skill build 9025 via `skillBuilder.getSkillBuilderBySlug`): Deadshot & Gale Arrow 20, Drill/Snipe/
  Tempest 16, stigmas Vaizel's (20 first), Bow of Blessing, Supporting Fire, Griffon Arrow (+Explosive if a 5th
  slot at 45); in-game macro Griffon line → Gale line on RMB, Snipe LMB, Deadshot on a side button. questlog
  spec ids: <skill><N>0 → specialization index N-1; slot "9.0" = highest priority of hotbar line 9.
  World bosses page (/<lang>/bosses/, data/bosses.json, assets/js/bosses.js, localStorage `aion2-bosses-v1`):
  global list per aion2hub, verified in questlog (`database.getNpcs` with `searchTerm`, `database.getNpc` →
  level, subDescription). Respawn/schedule null until launch. Free-player pre-download event removed.
  UI: mode switch fades the guide (site.js setMode → applyMode after 160 ms), hero collapses via CSS
  transitions (enabled by `html.anim`), class menu open/close animation, theme button sun/moon.
- Mode policy (Sep 28, user decision): a mode without a real source is switched off, not written "from thin air".
  site.json `modes_off: ["pvp"]` (Ranger, Assassin, Chanter, Sorcerer) → PvP button just disabled (no label), PvP chip hidden on home cards,
  PvP text removed from content, head script/site.js skip the mode. `wip_modes` (Gladiator pvp, Templar pve+pvp)
  → WIP callout at the top of that mode. Re-enable PvP when a global source appears.
  Home cards: class figure rises out of the card on hover (`.pop-art`, mouse + ≥521px only).
- Ambient motion (Sep 28): assets/js/fx.js — canvas particles in any hero with `data-fx` (home: aether; class
  pages: the class slug; presets for all 8 classes incl. cleric/elementalist), one rAF loop per hero, paused when
  hidden/off screen; guide blocks below the fold fade in (.rv). CSS: home landscape drift 38s, class portrait
  "breathes" 11s, .hero-glow pulse. All off with prefers-reduced-motion. A looping video portrait was tried for
  the Gladiator (Gemini clips don't loop cleanly; a forward+reverse "palindrome" mp4 via imageio-ffmpeg works) —
  parked until the user generates one locally (SwarmUI, Wan 2.1 FLF2V 14B GGUF with the same start/end frame).
- Session 7 (Sep 28): all 8 classes have pages. Cleric and Elementalist are WIP, Leveling only
  (`modes_off: ["pve","pvp"]`; accents `sunlight` / `spirit`), from Grobs' early-macro slide
  (frames/HMod6Z4GrE0/grobs-early-game-macros.webp, local — decoded: Cleric line Chain of Torment ← Debilitating Mark ←
  Condemnation ← Judgment Thunder, LMB Earth's Retribution; Elementalist lines Water Spirit ← Jointstrike: Corrode ←
  Earth ← Fire Spirit and Elemental Fusion ← Dimensional Control ← Jointstrike: Curse ← Combustion, LMB Cold Shock)
  and MMO Codex leveling order. New site features: skill tooltips (`data-sk` on every skill mention, JSON in
  class pages from build.py `tooltip_json`), search (Ctrl+K / "/", docs/<lang>/search.json from build.py
  `search_entries`/`page_entries`; `?sk=<slug>` jumps to a skill card), notifications (assets/js/notify.js,
  energy full + boss respawn, only while the tab is open), per-mode source + date (`classes[].src`), "Report a
  mistake" → GitHub issue (`SITE.repo`), launch checklist in LAUNCH.md.
- Session 8 (Sep 29): Templar PvE+PvP rebuilt on SolAshur (solashur.com/builds/templar-global-build.html, video
  ayyzLdGOaNc; specializations from his questlog character QuickCobraLifeBanish → skill build 5276, marked for the
  NC client, Sep 12) — trinity Judgment/Punishment/Pummel 20, stigma profiles PvE/PvX/PvP, RMB Pummel line + side-
  button Judgment line; WIP removed. Cleric PvE enabled (WIP) from Kaeria's Russian video 7LjTwlZ4v_s (TW client).
  Grobs' Gladiator PvE video xRPr30JetyY confirms our Gladiator guide — user chose to change nothing, only listed it
  in sources. questlog character API: `characterBuilder.getCharacter` with {"slug": <character url>}.
- Founder's launch easter egg (Sep 29): `events[].celebrate` (Early Access) → assets/js/celebrate.js: at the event
  time (or within 24 h after it) once per visitor (localStorage `celebrated-early`): banner, confetti, fireworks,
  falling feathers; on home also wings of light behind the title and a gold ribbon; the Early Access card in the launch
  panel turns into "Servers are open" for good. Reduced motion → banner only. Preview any page with `?celebrate=1`.
  What's new doesn't pop up while it runs. CSS/JS URLs carry `?v=<hash>` (build.py `asset_version`) against stale caches.
- Done (was planned from the other PC): task — **Cleric and Elementalist as WIP guides, Leveling mode only**
  for now (no PvE/PvP content yet) — use `modes_off: ["pve", "pvp"]` + `wip: true` in site.json
  (the head script and site.js then open the Leveling mode). Plan: fetch skills (`fetch_skills.py cleric elementalist` — questlog
  categories are `cleric` and `elementalist`, 35 skills each; `spiritmaster` returns nothing), mark both
  `ready` + `wip` in site.json, write `data/leveling/<class>.json`, a leveling section with the macro in
  `src/content/<class>/en.html` + `ru.html` + `uk.html` + `tr.html`, changelog entry. Skill-point order: search the web if there is
  no solid data.
  Macro source: Grobs' "early game macros" slide from his macro video (HMod6Z4GrE0, transcript in
  frames/<id>/transcript.json) — saved locally as `frames/HMod6Z4GrE0/grobs-early-game-macros.webp` (all 8 classes; the transcript
  itself has no per-class layouts). Read from the slide: Cleric macro = 1 slot (≈ "Chain of Torment");
  Elementalist ("Spiritmaster") macro = 2 slots: "Summon: Water Spirit", "Elemental Fusion". The hotbar
  lines are icons only — identify them against the fetched icons.
  Network note: on the work PC questlog fails SSL verification (corporate proxy); `pip install truststore`
  + `truststore.inject_into_ssl()` works around it. At home the plain fetch should work.
- Open ideas: more classes, Daevanion board visual per class, checklist export/import,
  verify global level cap and Daevanion values after launch (Oct 5).
- Oct 3: class guides re-checked against the first global videos (aLuckyRO "Latest PVE Build for Global" series, Sen, LordRobson,
  trueeevil, notXeon, WallyJTV, EUTOPIA); Sorcerer priority rebuilt on EUTOPIA (Hellfire/Firestorm core, no Ice Chain/Frost).
  `patch: "S1"` in site.json shows "Season 1" for guides checked against global sources. Elementalist got PvE + PvP (no WIP)
  from Evripides' written global guide https://aion2sm.com/global/ (snapshot rule: buff before summoning), checked against
  DankRNG (KlmstIyukX8) and aLuckyRO (v9MYphrcvic). YouTube rate-limits transcripts after many requests (429) —
  `tools/transcribe.py` works as the fallback.
