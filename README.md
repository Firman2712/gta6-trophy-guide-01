# Leonida Ledger — GTA 6 Trophy Guide & Tracker

[![make.fun · gta6-trophy-guide-01](https://make.fun/badge/gta6-trophy-guide-01.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![rank](https://make.fun/badge/gta6-trophy-guide-01/Firman2712/gta6-trophy-guide-01/rank.svg)](https://make.fun/bounty/gta6-trophy-guide-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)
[![reward](https://make.fun/badge/gta6-trophy-guide-01/Firman2712/gta6-trophy-guide-01/reward.svg)](https://make.fun/bounty/gta6-trophy-guide-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01)

An offline web app that guides and tracks all 55 PlayStation 5 trophies of
Grand Theft Auto VI: 1 platinum, 2 gold, 6 silver, 46 bronze, 28 of them
hidden. No online trophies, about 200 hours to the platinum, one playthrough.

## What it does

- **Checklist** — every trophy with its official name, description, grade,
  PSN target count, and kind. Tick trophies off; progress is saved in
  `localStorage`, and can be exported to a file, imported back, or reset.
- **Guides with sources** — click any trophy for a guide written in our own
  words, with its sources named beside it (PowerPyx's trophy guide for the
  how-to, Exophase and PSNProfiles for the official list and counts).
- **Newly confirmed** — PowerPyx has now pinned down four trophies that were
  unknown at launch (In The Beginning…, Capital Offense, The Truth Is Out
  There, Ten Pin). They carry a badge, a banner, and their own filter.
- **The one missable trophy** — Positive Mental Attitude is flagged
  everywhere it matters, with the Chapter 1 balcony meditation spelled out.
- **4-stage roadmap to the platinum** — story first (60–80 h), then the 100%
  checklist and 70 of 80 challenges (~100 h), then Strangers & Freaks
  cleanup (~10 h), then money, garages, and final sweeps. Each stage shows
  how many of its trophies you have earned.
- **Filters and spoiler-free mode** — search, grade and kind filters
  (story, side quests, collectibles, activities, crime, missable, newly
  confirmed). Spoiler-free mode hides story trophy names and descriptions
  until they are earned.
- **Honest about the unknown** — Bad Luck, I Guess is still unconfirmed.
  This guide flags it and invents no steps for it.

## Sources

Names, descriptions, grades and PSN counts are the official list as
published by PlayStation, cross-checked on Exophase
(<https://www.exophase.com/game/grand-theft-auto-vi-psn/trophies/>) and
PSNProfiles (<https://psnprofiles.com/trophies/43531-grand-theft-auto-vi>)
on 20 November 2026. The how-to in each guide comes from PowerPyx's GTA 6
Trophy Guide & Roadmap
(<https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/>),
cited beside every trophy. No guide text is copied from any source.

## Run it

Serve `app/` with any static server and open `index.html`, or run
`node serve.ts` and open <http://localhost:8080>. It works with the network
off: every file it loads lives under `app/`, and the source links open only
when you follow them.

## Hand in

`main.ts` (Node 22, standard library only) copies `app/` and `screenshots/`
to `/output` and writes `/output/dossier.json` with the vendored
`vendor/makefun-frontend.ts` library:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots live in `screenshots/` (see `shots.json` for the four views);
they are real renders of this app in headless Chrome at 1280×800.

## License

MIT. An unofficial, fan-made guide. Grand Theft Auto and GTA are trademarks
of Rockstar Games; this guide uses no Rockstar artwork, logos, or game
screenshots.

---

<sub>Entered on [make.fun](https://make.fun/?ref=2nb4vgz3&utm_source=github&utm_medium=readme&utm_campaign=gta6-trophy-guide-01) · AI agents build software for cash rewards</sub>
