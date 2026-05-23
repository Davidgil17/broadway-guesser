# Broadway Guesser — Design Spec

**Date:** 2026-05-23  
**Domain:** broadway.darrigozik.com  
**Port:** 8003

---

## Overview

A daily Broadway show guessing game. Each day a new show is the answer. Players are shown up to 5 structured clues, revealed one at a time. Fewer clues used = more points. No login required — state lives in browser localStorage.

---

## Architecture

- **Backend:** FastAPI (Python 3.12), async SQLAlchemy, PostgreSQL 16
- **Frontend:** Vanilla JS + HTML + CSS, served as static files mounted on the FastAPI app
- **Infrastructure:** Docker Compose (app + db), Caddy system service as HTTPS reverse proxy
- **Repo:** `~/broadway-guesser`, git-initialized

### Directory Layout

```
broadway-guesser/
├── docker-compose.yml
├── .env                        # DB_PASSWORD
├── app/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                 # FastAPI app, mounts /static at /
│   ├── database.py             # Async SQLAlchemy engine + session
│   ├── models.py               # Show ORM model
│   └── routers/
│       └── game.py             # /api/* routes
├── frontend/                   # Copied into container, served as static
│   ├── index.html
│   ├── style.css
│   └── game.js
└── seeds/
    ├── seed.py                 # CSV → DB upsert script
    └── shows.csv               # Populated by user
```

---

## Database

Single table, no user/session tables.

```sql
CREATE TABLE shows (
    id            SERIAL PRIMARY KEY,
    title         TEXT NOT NULL,
    year          INTEGER NOT NULL,
    genre         TEXT NOT NULL,
    composer      TEXT NOT NULL,
    notable_cast  TEXT NOT NULL,
    plot_hint     TEXT NOT NULL,
    play_date     DATE UNIQUE NOT NULL
);
```

- `play_date` is the calendar date this show is the daily puzzle.
- `UNIQUE` constraint prevents scheduling two shows on the same day.
- Daily puzzle: `SELECT * FROM shows WHERE play_date = CURRENT_DATE`.

---

## API

Base path: `/api`

### `GET /api/today`

Returns today's 5 clues in order. Never returns the title.

**Response (200):**
```json
{
  "date": "2026-05-23",
  "clues": [
    {"n": 1, "category": "Opening Year", "value": "1957"},
    {"n": 2, "category": "Genre",        "value": "Musical Drama"},
    {"n": 3, "category": "Composer",     "value": "Leonard Bernstein"},
    {"n": 4, "category": "Notable Cast", "value": "Carol Lawrence, Larry Kert"},
    {"n": 5, "category": "Plot Hint",    "value": "Two rival gangs, one forbidden love"}
  ]
}
```

**Response (404):** `{"detail": "No show scheduled for today"}` if no matching `play_date`.

### `POST /api/guess`

**Body:**
```json
{"date": "2026-05-23", "guess": "West Side Story"}
```

**Response:**
```json
{"correct": true, "answer": "West Side Story", "score": 3}
```

- Comparison: case-insensitive, stripped of leading/trailing whitespace.
- `answer` is only included when `correct: true`. Client is responsible for revealing the answer on exhaustion.
- `score` = `max(5 - guesses_used + 1, 0)` where `guesses_used` is derived from the clue number the client is on (passed implicitly — server just validates the guess against today's show).
- Server is stateless: it does not track how many guesses a player has made. The client sends `guesses_used` in the body so the server can compute the score.

**Revised body:**
```json
{"date": "2026-05-23", "guess": "West Side Story", "guesses_used": 2}
```

**Score table:**
| guesses_used | score |
|---|---|
| 1 | 5 |
| 2 | 4 |
| 3 | 3 |
| 4 | 2 |
| 5 | 1 |
| exhausted | 0 |

### `GET /api/shows`

Returns all show titles sorted alphabetically, for autocomplete.

**Response:**
```json
["Annie", "Cats", "Hamilton", "West Side Story"]
```

---

## Game State (Client)

Stored in `localStorage` under key `broadway_YYYY-MM-DD`:

```json
{
  "guessesUsed": 2,
  "solved": false,
  "score": 0,
  "guesses": ["Cats", "Hamilton"]
}
```

On page load: fetch `/api/today`, read localStorage. If already played today, render result immediately without prompting input. If mid-game, show clues up to `guessesUsed` and resume.

---

## Frontend

### Visual Theme

Playbill aesthetic:
- Background: `#1a0a00` (near-black brown)
- Text: `#f5f0e8` (ivory)
- Accent: `#c9a84c` (gold)
- Font: serif for headings (Georgia or similar), sans-serif for body

### UX Flow

1. **Header:** "Broadway Guesser" + today's date + star score display (e.g. ★★★☆☆)
2. **Clue cards:** Revealed one at a time. Each card shows category label + value. New cards animate in (fade + slide down).
3. **Guess input:** Text input with autocomplete dropdown filtered from `/api/shows`. Submit on Enter or button click.
4. **Wrong guess feedback:** Input shakes, "Incorrect — here's your next clue" message, next clue animates in.
5. **Correct guess:** Confetti burst animation, score banner ("You got it in 2 clues — 4 points!").
6. **Exhausted (6th wrong/skip):** Answer revealed with "The answer was X — better luck tomorrow!"
7. **Share button:** Appears after game ends. Copies emoji result grid to clipboard:
   ```
   Broadway Guesser 2026-05-23
   ⭐⭐⭐⬛⬛
   ```
8. **Countdown timer:** Shows time until midnight (next puzzle) after game ends.

### Files

- `index.html` — single page, minimal markup, links style.css + game.js
- `style.css` — all visual styles, animations, responsive layout
- `game.js` — all logic: API calls, localStorage, clue reveal, autocomplete, share

No framework, no build step.

---

## Seed Script

`seeds/seed.py`:
- Reads `seeds/shows.csv` with columns: `title, year, genre, composer, notable_cast, plot_hint, play_date`
- Connects to DB via `DATABASE_URL` env var
- Upserts on `play_date` (INSERT ... ON CONFLICT(play_date) DO UPDATE)
- Safe to re-run

`seeds/shows.csv` — sample row:
```
title,year,genre,composer,notable_cast,plot_hint,play_date
West Side Story,1957,Musical Drama,Leonard Bernstein,"Carol Lawrence, Larry Kert",Two rival gangs and one forbidden love story set in New York City,2026-05-23
```

---

## Caddy Configuration

Add to `/etc/caddy/Caddyfile`:

```caddy
broadway.darrigozik.com {
    reverse_proxy localhost:8003
}
```

Caddy handles HTTPS automatically via Let's Encrypt (same as movie-poll pattern).

---

## Docker Compose

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: broadway
      POSTGRES_USER: broadway
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U broadway"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    build: ./app
    ports:
      - "127.0.0.1:8003:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://broadway:${DB_PASSWORD}@db:5432/broadway
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ../frontend:/app/frontend

volumes:
  pgdata:
```

---

## Out of Scope

- User accounts / leaderboards
- Admin UI (shows managed via seed script)
- Mobile app
- Historical score tracking across days (only today's state is stored)
