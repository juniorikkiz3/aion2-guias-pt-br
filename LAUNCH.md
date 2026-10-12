# Launch-day checklist (global launch — October 5, 2026)

Everything on the site that was set before launch and must be checked against the live global servers.
Work top to bottom, then rebuild (`.venv/Scripts/python tools/build.py`), check locally, add a changelog entry, push.

## 1. Timers (`data/site.json`)

- [x] **Weekly reset** — done Oct 1: Wednesday 10:00 Kyiv time (`anchor` + `tz`). Was: `weekly_reset.anchor`: set the real reset time (UTC, ISO) of any past or upcoming reset,
      then `weekly_reset.confirmed: true`. This drives the reset timer on /weekly/ and /week-1/ and the
      automatic clearing of the weekly checklist. When confirmed, the "not announced yet" note disappears.
- [ ] **Launch schedule** — `events`: the Early Access event has `celebrate: true` (the launch party); after
      the first day remove the flag or keep it for the "Servers are open" card.
      Also after the launch the home panel shows them as finished; remove events that
      are no longer useful or add new ones (next patch, season events).
- [ ] **`updated`** — site-wide date shown in the footer.
- [ ] Footer text "before the global launch" — `footer_before_launch` in `data/i18n.json` (EN + RU): drop or reword.

## 2. Odyle energy (`data/site.json → energy`)

- [ ] `regen` (per tick), `interval_min` (tick length), `cap`, `chest` (cost of one chest). Values come from the EU
      test client. Check them in game; the weekly tracker computes everything from these four numbers.

## 3. Weekly content (`data/weekly.json`, `data/week1.json`)

- [ ] Weekly entry limits (`max`) — taken from KR/TW and the EU test. Check each against the global client.
- [ ] After checking, reword or remove `wk_limits` in `data/i18n.json` (the "limits come from Korean servers" note).
- [ ] First-week goals — still valid for global? Remove or add goals.
- [ ] Items from Sanya Jacuzzi's datamine video (`src: sanya` in `data/week1.json`), check in game:
      enemy-side ? marks / sealed dungeons give 1,000 AP + 2–5k stones instead of Daevanion nodes (`rift`);
      feathers nerfed, 95 for Monolith level 11 (`feathers`); Nightmare charges start at 45 (`nightmare-45`);
      Daily Dungeon / trial pass boxes (`pass-boxes`).
- [ ] **Item level route** — page /progression/ (`data/progression.json`, from Sanya Jacuzzi's datamine video; every
      block has the video timestamp in `at`): the thresholds 1,279 / 1,400 / 1,900 / 2,100 / 2,500 / 2,800, sealed dungeon
      and stronghold rewards, Shugo shop steps, Nightmare shop prices, the Draupnir guarantee (14 chests, 7 with premium),
      Vakron guard (2 vouchers + 1.5M kina) and the transfer stones. When confirmed, reword `pg_note` in `data/i18n.json`
      (drop the "Datamine" tag). New items: add to `items` and run `tools/fetch_items.py`.
- [ ] **TitanTheF's parts** (`src: "titan"` in `data/progression.json`, `data/crafting.json`, `data/week1.json`) come from
      Taiwan: full Shugo rewards only at 45, ~420/570 Daevanion points after the map, 55k combat power from pets, Abyss
      scroll prices, crafting times and amounts (300 sapphire veins, 140 trees, 25% gold blank chance). Check on global.
- [ ] Counters seen in that video differ from `data/weekly.json` / `data/week1.json`: Daily Dungeon 14 entries a week
      (site: 7), Shugo Festival keys 7 + 1 a day, up to 30 stored (site: "keys stop at 14"). Check which is right.

## 4. World bosses (`data/bosses.json`)

- [ ] For each boss: `respawn_min` (minutes after a kill) **or** `schedule` (fixed times). With `respawn_min` set, the
      page shows the next spawn and sends browser notifications.
- [ ] Check the list: Verteron / Altgard (Lv 45) and Lower Reshanta. Add bosses that exist on global, remove those that don't.
- [ ] Remove the `kr` reference schedules once the global ones are known.
- [ ] Reword `bs_lead` / `bs_tba` / `bs_later` in `data/i18n.json`.

## 5. Guides

- [ ] **Patch version** — `classes[].patch` in `data/site.json` (shown as "Patch: TBD" on every guide).
- [ ] **Ranger** (`src/content/ranger/*.html`, section "global"): fifth stigma slot at 45 — confirmed or not?
      Accuracy cap for Ludra on global.
- [ ] **All guides**, section "Global Season 1: what changes": replace "expected / not confirmed" statements with facts.
- [ ] **PvP** — Ranger, Assassin, Chanter, Sorcerer have PvP switched off (`modes_off` in `data/site.json`).
      Turn it back on only with a real global source; write the PvP text from that source.
- [ ] **Patch** — every class has `patch: "TW"` (Gladiator and Sorcerer `"TW/KR"` — Korean text guides are part of their base) in `data/site.json` (the builds come from Taiwan-server videos; the WIP marks were
      removed on Sep 30). When a guide is re-checked on the live global servers, set its `patch` to the global patch.
- [ ] **Sources** — after re-checking a mode, update its date in `classes[].src` (shown in the guide header)
      and `classes[].updated`.

- [ ] **Daevanion boards** — re-run `tools/fetch_boards.py` for every class with a board; the global data had no
      Ariel (PvE, lv 45) board before launch, only Azphel (PvP). If Ariel appears, update the Daevanion text in the guides.
- [ ] **Templar, Pummel specializations** — the guide follows SolAshur's video (Punishing Strike heal, +12% on fewer targets,
      extra Punishing Strike) instead of his older questlog build (−1s Punishment). Check what Templars run on live.
      Also unclear in his video: which four stigmas the PvX page keeps on global (the page says to drop Second Skin and Executing Blade).
- [ ] **Cleric (Kaeria, Taiwan client)** — Radiant Recovery: her client shows a "+1 consecutive use" specialization, the global
      data has "+20% Skill Speed" in its place; the guide follows the global data. Her macro was tuned for a high ping —
      check the step order on live. The Daevanion route is calculated on the global boards (hers are the Taiwan ones).
- [ ] **Chanter (Arthars Gaming, Taiwan client)** — check on live: Dark Crush opens for 2s after Spinning Strike / Impactful Crush
      and 3s after Marchutan's Wrath; the stigma four (Undefeated Mantra 20, Marchutan's Wrath 1, Focused Defense 5, Sprint Mantra 10);
      the arcana sets available in Season 1 (Primal Vigor, Magic Armor) and the skills each card can roll.
- [ ] **Assassin (Arthars Gaming, Taiwan client)** — check on live: Illusive Clone at 20 lasts 20s on a 1 min 30 s cooldown; the macro
      (damage line → Quick Slice) is our reading of his hotbar, the macro window is not in the video; arcana sets and card skills.
      The video has no captions — its text came from speech recognition, names and numbers were checked against the frames.
- [ ] **Sorcerer (aLuckyRO, Taiwan client, six stigmas)** — the hotbar lines were read from small icons and cut down to the four
      global stigmas; the 7th macro step (Flame Scattershot) is from his words, not the screen. Check the macro on live.
- [ ] **Game settings page** (`data/settings.json`, from Whelps' and Grobs' videos on pre-launch clients with the English interface) — the Russian
      names are in for Combat (Controls, Target Scanning, Auto-use) and Info Display (Common, Combat, Floater) from the user's screenshots;
      still in English: Controls → Skill Queue, Looting, Key Settings, the rest of Info Display → Common, Graphics.
- [ ] **Specialization slots** — the guide cards assume 2 slots from skill level 12 and the 3rd at 20 (from two creators' videos on
      the Taiwan client). Confirm on global; which pick the third slot takes on each card is our own choice where the source didn't say.
- [ ] **Board node values** — the node tooltips show the orange (4-point) stats as percents: the data stores 150, shown as
      +1.5% (`BOARD_PCT_STATS` in `tools/build.py`). Compare with a node in the game (e.g. Nezekan → Combat Speed).

## 6. Publish

- [ ] New entry at the top of `data/changelog.json` (new `id`, so everyone sees it once).
- [ ] Rebuild, check EN + RU locally, push.
