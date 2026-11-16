# broadway-guesser

A daily guess-the-musical game. One show per date in `shows`, six clues,
five guesses. See `~/CLAUDE.md` for how it is deployed — the frontend is on
GitHub Pages at `broadwayguesser.com` and the API runs on the VM at
`broadway.dg.darrigozik.com:8003`, which is why the JS calls the API by
absolute URL.

## Every answer must have played Broadway

Off-Broadway does not count, however famous. The whole list was audited on
2026-11-16 after a player caught *tick, tick... BOOM!* — 215 performances at
the Jane Street Theatre in 2001 and never a Broadway house. Check the premiere
before adding a show, and use the Broadway opening year, not an earlier
off-Broadway one: Godspell is 1976, not 1971; Little Shop of Horrors is 2003,
not 1982. Both of those are still legitimate answers, since they did transfer —
only the year is wrong.

A mistake does not age out. `/api/archive` serves every past `play_date`, so an
old wrong answer stays playable.

## Changing the show list takes three edits

Doing only the first leaves the game playable but visibly broken:

1. `seeds/shows.csv` — one row per day, keyed on `play_date`. Apply with
   `docker compose exec app python seeds/seed.py`. It upserts on `play_date`,
   so correcting a row swaps the show **in place**: the row id and every
   `scores` / `plays` row for that date survive.
2. `frontend/game.js` — `ALL_BROADWAY_SHOWS`, a hardcoded array. `/api/shows`
   returns this same data from the database but no frontend code fetches it, so
   the list drifts every time shows are added. On 2026-11-08, 93 of 258 answers
   were missing from it. It is deliberately a *superset* — it carries plausible
   decoys that are not answers — so it cannot just be replaced with the answer
   set.
3. `frontend/index.html` — bump `game.js?v=N`, or returning players keep the
   cached old list.

Guessing is not gated by the list (`submitGuess` sends the raw input), so a
missing title is a discoverability bug rather than a block. The exception is
accented titles: `normalize()` in `app/routers/game.py` strips punctuation but
not accents, so *Les Misérables* and *Amélie* are only winnable by clicking the
suggestion. Watch for near-duplicates that shadow a real answer — the list once
held "Matilda the Musical" while the answer was "Matilda", so picking the
suggestion scored wrong.

## Rebuilding is not a safe no-op

The frontend is baked into the image, so a frontend change needs
`docker compose up -d --build`. Requirements are unpinned floors, so a rebuild
re-resolves every dependency to current latest, and the running container's
working version set exists only inside its image. On 2026-11-08 a cosmetic
change rebuilt a three-month-old image against a newer SQLAlchemy that no
longer pulled `greenlet` transitively, and the site crash-looped until
`sqlalchemy[asyncio]>=2.0` was committed. After any `--build`, check
`docker compose ps` for `Restarting` and curl a real endpoint — a successful
build says nothing about a successful start, and compose reports "Started"
either way.
