# Broadway Guesser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily Broadway show guessing game at broadway.darrigozik.com — 5 structured clues revealed one at a time, scored by how few clues you needed, no login required.

**Architecture:** FastAPI app + PostgreSQL in Docker Compose, exposed on localhost:8003. Caddy system service reverse-proxies the domain with auto-HTTPS. Static frontend (HTML/CSS/JS) bundled into the Docker image. Game state stored entirely in browser localStorage; server is stateless.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy 2 (async), asyncpg, PostgreSQL 16, aiosqlite (tests), httpx + pytest-asyncio (tests), vanilla JS, Caddy 2

---

## File Map

| File | Purpose |
|---|---|
| `docker-compose.yml` | PostgreSQL + FastAPI app services |
| `.env.example` | DB_PASSWORD template |
| `.gitignore` | Python + env ignores |
| `pytest.ini` | asyncio_mode=auto, pythonpath=. |
| `app/__init__.py` | Empty — makes `app` a Python package |
| `app/database.py` | Engine, session factory, `get_db` dependency |
| `app/models.py` | `Show` ORM model |
| `app/routers/__init__.py` | Empty |
| `app/routers/game.py` | `/api/today`, `/api/guess`, `/api/shows` |
| `app/main.py` | FastAPI app — includes router, serves static files |
| `app/Dockerfile` | Builds from repo root context |
| `app/requirements.txt` | All Python deps (prod + test) |
| `frontend/index.html` | Single-page game UI |
| `frontend/style.css` | Playbill theme + animations |
| `frontend/game.js` | API calls, localStorage, clue reveal, autocomplete, share |
| `seeds/seed.py` | Reads CSV, creates tables, upserts shows |
| `seeds/shows.csv` | Sample Broadway shows (8 entries) |
| `tests/__init__.py` | Empty |
| `tests/conftest.py` | SQLite in-memory test DB, async client fixture |
| `tests/test_game.py` | Tests for all three API endpoints |

---

## Task 1: Project Scaffold

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `pytest.ini`
- Create: `app/__init__.py`
- Create: `app/routers/__init__.py`
- Create: `tests/__init__.py`
- Create: `frontend/index.html` (placeholder)
- Create: `frontend/style.css` (placeholder)
- Create: `frontend/game.js` (placeholder)

- [ ] **Step 1: Create directory structure**

```bash
cd /home/davidg/broadway-guesser
mkdir -p app/routers frontend seeds tests
```

- [ ] **Step 2: Create empty package markers**

```bash
touch app/__init__.py app/routers/__init__.py tests/__init__.py
```

- [ ] **Step 3: Create placeholder frontend files (needed so StaticFiles mount doesn't error)**

`frontend/index.html`:
```html
<!DOCTYPE html><html><body>placeholder</body></html>
```

`frontend/style.css`:
```css
/* placeholder */
```

`frontend/game.js`:
```javascript
// placeholder
```

- [ ] **Step 4: Create `.gitignore`**

```
__pycache__/
*.pyc
.env
*.db
.pytest_cache/
```

- [ ] **Step 5: Create `.env.example`**

```
DB_PASSWORD=changeme
```

- [ ] **Step 6: Create `pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
pythonpath = .
```

- [ ] **Step 7: Create `docker-compose.yml`**

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
    build:
      context: .
      dockerfile: app/Dockerfile
    ports:
      - "127.0.0.1:8003:8000"
    environment:
      DATABASE_URL: postgresql+asyncpg://broadway:${DB_PASSWORD}@db:5432/broadway
    depends_on:
      db:
        condition: service_healthy
    volumes:
      - ./seeds:/broadway/seeds

volumes:
  pgdata:
```

- [ ] **Step 8: Commit**

```bash
cd /home/davidg/broadway-guesser
git add .
git commit -m "chore: project scaffold

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 2: Database Layer

**Files:**
- Create: `app/database.py`
- Create: `app/models.py`

- [ ] **Step 1: Create `app/database.py`**

```python
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, DeclarativeBase


class Base(DeclarativeBase):
    pass


_url = os.environ.get("DATABASE_URL", "")
engine = create_async_engine(_url) if _url else None
AsyncSessionLocal = (
    sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    if engine
    else None
)


async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

- [ ] **Step 2: Create `app/models.py`**

```python
from sqlalchemy import Column, Integer, Text, Date
from .database import Base


class Show(Base):
    __tablename__ = "shows"

    id = Column(Integer, primary_key=True)
    title = Column(Text, nullable=False)
    year = Column(Integer, nullable=False)
    genre = Column(Text, nullable=False)
    composer = Column(Text, nullable=False)
    notable_cast = Column(Text, nullable=False)
    plot_hint = Column(Text, nullable=False)
    play_date = Column(Date, unique=True, nullable=False)
```

- [ ] **Step 3: Create `tests/conftest.py`**

```python
import os

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

import pytest_asyncio
from datetime import date
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models import Show

_test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_TestSession = sessionmaker(_test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture(autouse=True)
async def reset_db():
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


async def _override_get_db():
    async with _TestSession() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    from app.main import app

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def today_show():
    async with _TestSession() as session:
        show = Show(
            title="West Side Story",
            year=1957,
            genre="Musical Drama",
            composer="Leonard Bernstein",
            notable_cast="Carol Lawrence, Larry Kert",
            plot_hint="Two rival gangs, one forbidden love",
            play_date=date.today(),
        )
        session.add(show)
        await session.commit()
    return show


@pytest_asyncio.fixture
async def other_show():
    async with _TestSession() as session:
        show = Show(
            title="Hamilton",
            year=2015,
            genre="Hip-Hop Musical",
            composer="Lin-Manuel Miranda",
            notable_cast="Lin-Manuel Miranda, Leslie Odom Jr.",
            plot_hint="The founding father who never threw away his shot",
            play_date=date(2099, 1, 1),
        )
        session.add(show)
        await session.commit()
    return show
```

- [ ] **Step 4: Install test dependencies locally**

```bash
pip install fastapi uvicorn sqlalchemy asyncpg aiosqlite httpx pytest pytest-asyncio
```

Expected: all packages install successfully.

- [ ] **Step 5: Verify conftest parses without error**

```bash
cd /home/davidg/broadway-guesser
python -c "import tests.conftest"
```

Expected: no output, no errors.

- [ ] **Step 6: Commit**

```bash
git add app/database.py app/models.py tests/conftest.py
git commit -m "feat: database layer and test fixtures

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 3: GET /api/today

**Files:**
- Create: `app/routers/game.py`
- Create: `app/main.py` (minimal — just enough to run tests)
- Create: `tests/test_game.py`

- [ ] **Step 1: Create minimal `app/main.py`** (full version comes in Task 6)

```python
from fastapi import FastAPI
from .routers.game import router

app = FastAPI()
app.include_router(router)
```

- [ ] **Step 2: Create `app/routers/game.py`** with only the today endpoint

```python
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import Show

router = APIRouter(prefix="/api")


@router.get("/today")
async def get_today(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Show).where(Show.play_date == date.today()))
    show = result.scalar_one_or_none()
    if show is None:
        raise HTTPException(status_code=404, detail="No show scheduled for today")
    return {
        "date": str(date.today()),
        "clues": [
            {"n": 1, "category": "Opening Year", "value": str(show.year)},
            {"n": 2, "category": "Genre", "value": show.genre},
            {"n": 3, "category": "Composer", "value": show.composer},
            {"n": 4, "category": "Notable Cast", "value": show.notable_cast},
            {"n": 5, "category": "Plot Hint", "value": show.plot_hint},
        ],
    }
```

- [ ] **Step 3: Create `tests/test_game.py`** with today endpoint tests

```python
import pytest
from datetime import date


async def test_today_returns_clues(client, today_show):
    response = await client.get("/api/today")
    assert response.status_code == 200
    data = response.json()
    assert data["date"] == str(date.today())
    assert len(data["clues"]) == 5
    assert data["clues"][0] == {"n": 1, "category": "Opening Year", "value": "1957"}
    assert data["clues"][1] == {"n": 2, "category": "Genre", "value": "Musical Drama"}
    assert data["clues"][2] == {"n": 3, "category": "Composer", "value": "Leonard Bernstein"}
    assert data["clues"][3] == {"n": 4, "category": "Notable Cast", "value": "Carol Lawrence, Larry Kert"}
    assert data["clues"][4] == {"n": 5, "category": "Plot Hint", "value": "Two rival gangs, one forbidden love"}


async def test_today_never_returns_title(client, today_show):
    response = await client.get("/api/today")
    body = response.text
    assert "West Side Story" not in body


async def test_today_returns_404_when_no_show(client):
    response = await client.get("/api/today")
    assert response.status_code == 404
    assert response.json()["detail"] == "No show scheduled for today"
```

- [ ] **Step 4: Run tests — verify they fail** (routers/game.py not yet created in full, but actually Step 2 created it — these should pass once conftest wires up correctly)

```bash
cd /home/davidg/broadway-guesser
pytest tests/test_game.py::test_today_returns_clues tests/test_game.py::test_today_never_returns_title tests/test_game.py::test_today_returns_404_when_no_show -v
```

Expected: all 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/main.py app/routers/game.py tests/test_game.py
git commit -m "feat: GET /api/today endpoint

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 4: POST /api/guess

**Files:**
- Modify: `app/routers/game.py` (add guess endpoint)
- Modify: `tests/test_game.py` (add guess tests)

- [ ] **Step 1: Write failing tests first**

Append to `tests/test_game.py`:

```python
async def test_guess_correct_on_first_try(client, today_show):
    response = await client.post("/api/guess", json={
        "date": str(date.today()),
        "guess": "West Side Story",
        "guesses_used": 1,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["correct"] is True
    assert data["score"] == 5
    assert data["answer"] == "West Side Story"


async def test_guess_correct_on_third_try(client, today_show):
    response = await client.post("/api/guess", json={
        "date": str(date.today()),
        "guess": "West Side Story",
        "guesses_used": 3,
    })
    data = response.json()
    assert data["correct"] is True
    assert data["score"] == 3
    assert data["answer"] == "West Side Story"


async def test_guess_incorrect_no_answer_returned(client, today_show):
    response = await client.post("/api/guess", json={
        "date": str(date.today()),
        "guess": "Hamilton",
        "guesses_used": 1,
    })
    data = response.json()
    assert data["correct"] is False
    assert "answer" not in data


async def test_guess_case_insensitive(client, today_show):
    response = await client.post("/api/guess", json={
        "date": str(date.today()),
        "guess": "west side story",
        "guesses_used": 1,
    })
    assert response.json()["correct"] is True


async def test_guess_strips_whitespace(client, today_show):
    response = await client.post("/api/guess", json={
        "date": str(date.today()),
        "guess": "  West Side Story  ",
        "guesses_used": 1,
    })
    assert response.json()["correct"] is True


async def test_guess_exhausted_returns_answer(client, today_show):
    response = await client.post("/api/guess", json={
        "date": str(date.today()),
        "guess": "Hamilton",
        "guesses_used": 5,
    })
    data = response.json()
    assert data["correct"] is False
    assert data["score"] == 0
    assert data["answer"] == "West Side Story"


async def test_guess_wrong_date_returns_404(client, today_show):
    response = await client.post("/api/guess", json={
        "date": "1900-01-01",
        "guess": "West Side Story",
        "guesses_used": 1,
    })
    assert response.status_code == 404
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_game.py -k "guess" -v
```

Expected: all 7 FAIL with `422 Unprocessable Entity` (endpoint doesn't exist yet).

- [ ] **Step 3: Add guess endpoint to `app/routers/game.py`**

Add after the `get_today` function:

```python
from pydantic import BaseModel


class GuessRequest(BaseModel):
    date: str
    guess: str
    guesses_used: int


@router.post("/guess")
async def post_guess(body: GuessRequest, db: AsyncSession = Depends(get_db)):
    try:
        play_date = date.fromisoformat(body.date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format")
    result = await db.execute(select(Show).where(Show.play_date == play_date))
    show = result.scalar_one_or_none()
    if show is None:
        raise HTTPException(status_code=404, detail="No show scheduled for that date")
    correct = body.guess.strip().lower() == show.title.strip().lower()
    score = max(6 - body.guesses_used, 0) if correct else 0
    response: dict = {"correct": correct, "score": score}
    if correct or body.guesses_used >= 5:
        response["answer"] = show.title
    return response
```

Note: `GuessRequest` and the `from pydantic import BaseModel` import go at the top of the file (after the existing imports).

- [ ] **Step 4: Run tests — verify they pass**

```bash
pytest tests/test_game.py -k "guess" -v
```

Expected: all 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routers/game.py tests/test_game.py
git commit -m "feat: POST /api/guess endpoint

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 5: GET /api/shows

**Files:**
- Modify: `app/routers/game.py` (add shows endpoint)
- Modify: `tests/test_game.py` (add shows tests)

- [ ] **Step 1: Write failing tests first**

Append to `tests/test_game.py`:

```python
async def test_shows_returns_sorted_titles(client, today_show, other_show):
    response = await client.get("/api/shows")
    assert response.status_code == 200
    titles = response.json()
    assert titles == ["Hamilton", "West Side Story"]


async def test_shows_returns_empty_list_when_no_shows(client):
    response = await client.get("/api/shows")
    assert response.status_code == 200
    assert response.json() == []
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pytest tests/test_game.py -k "shows" -v
```

Expected: both FAIL with `404 Not Found`.

- [ ] **Step 3: Add shows endpoint to `app/routers/game.py`**

Append after `post_guess`:

```python
@router.get("/shows")
async def get_shows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Show.title).order_by(Show.title))
    return [row[0] for row in result.all()]
```

- [ ] **Step 4: Run all tests — verify everything passes**

```bash
pytest tests/ -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add app/routers/game.py tests/test_game.py
git commit -m "feat: GET /api/shows endpoint

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 6: FastAPI Main App + Dockerfile + Requirements

**Files:**
- Modify: `app/main.py` (add static file serving)
- Create: `app/Dockerfile`
- Create: `app/requirements.txt`

- [ ] **Step 1: Update `app/main.py`** with static file serving

```python
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .routers.game import router

FRONTEND_DIR = Path(__file__).parent.parent / "frontend"

app = FastAPI()
app.include_router(router)

app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/", include_in_schema=False)
async def serve_index():
    return FileResponse(FRONTEND_DIR / "index.html")
```

- [ ] **Step 2: Verify existing tests still pass**

```bash
cd /home/davidg/broadway-guesser
pytest tests/ -v
```

Expected: all tests PASS (static mount doesn't affect API routes).

- [ ] **Step 3: Create `app/requirements.txt`**

```
fastapi>=0.115
uvicorn[standard]>=0.32
sqlalchemy>=2.0
asyncpg>=0.30
aiosqlite>=0.20
httpx>=0.27
pytest>=8.3
pytest-asyncio>=0.24
```

- [ ] **Step 4: Create `app/Dockerfile`**

Build context is the repo root (see `docker-compose.yml`), so paths are relative to `broadway-guesser/`.

```dockerfile
FROM python:3.12-slim
WORKDIR /broadway
COPY app/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
COPY frontend/ ./frontend/
COPY seeds/ ./seeds/
ENV PYTHONPATH=/broadway
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 5: Commit**

```bash
git add app/main.py app/Dockerfile app/requirements.txt
git commit -m "feat: main app with static file serving and Dockerfile

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 7: Seed Script + Sample Data

**Files:**
- Create: `seeds/seed.py`
- Create: `seeds/shows.csv`

- [ ] **Step 1: Create `seeds/shows.csv`** with 8 sample shows

```csv
title,year,genre,composer,notable_cast,plot_hint,play_date
West Side Story,1957,Musical Drama,Leonard Bernstein,"Carol Lawrence, Larry Kert",Two rival gangs and one forbidden love story set on the streets of New York,2026-05-23
Hamilton,2015,Hip-Hop Musical,Lin-Manuel Miranda,"Lin-Manuel Miranda, Leslie Odom Jr., Phillipa Soo",The founding father who never threw away his shot,2026-05-24
The Phantom of the Opera,1988,Musical Drama,Andrew Lloyd Webber,"Michael Crawford, Sarah Brightman",A masked musical genius haunts the Paris Opera House and falls obsessively in love,2026-05-25
Les Misérables,1987,Epic Musical Drama,Claude-Michel Schönberg,"Frances Ruffelle, Patti LuPone",A former convict's decades-long pursuit of redemption in post-revolutionary France,2026-05-26
Chicago,1975,Musical Comedy,John Kander,"Gwen Verdon, Chita Rivera",Murder celebrity and showbiz collide in 1920s Chicago,2026-05-27
Rent,1996,Rock Musical,Jonathan Larson,"Taye Diggs, Idina Menzel",Bohemian artists struggle with love loss and illness in New York's East Village,2026-05-28
Annie,1977,Musical Comedy,Charles Strouse,"Andrea McArdle, Dorothy Loudon",A spunky orphan girl searches for her parents during the Great Depression,2026-05-29
Cabaret,1966,Musical Drama,John Kander,"Jill Haworth, Joel Grey",An American writer discovers decadence and darkness in a Berlin nightclub as the Nazis rise,2026-05-30
```

- [ ] **Step 2: Create `seeds/seed.py`**

```python
import asyncio
import csv
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import insert

from app.models import Show
from app.database import Base


async def seed():
    url = os.environ["DATABASE_URL"]
    engine = create_async_engine(url)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    Session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    csv_path = Path(__file__).parent / "shows.csv"

    with open(csv_path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))

    async with Session() as session:
        for row in rows:
            stmt = (
                insert(Show)
                .values(
                    title=row["title"],
                    year=int(row["year"]),
                    genre=row["genre"],
                    composer=row["composer"],
                    notable_cast=row["notable_cast"],
                    plot_hint=row["plot_hint"],
                    play_date=row["play_date"],
                )
                .on_conflict_do_update(
                    index_elements=["play_date"],
                    set_={
                        "title": row["title"],
                        "year": int(row["year"]),
                        "genre": row["genre"],
                        "composer": row["composer"],
                        "notable_cast": row["notable_cast"],
                        "plot_hint": row["plot_hint"],
                    },
                )
            )
            await session.execute(stmt)
        await session.commit()

    print(f"Seeded {len(rows)} shows")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 3: Commit**

```bash
git add seeds/
git commit -m "feat: seed script and sample Broadway shows

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 8: Frontend HTML

**Files:**
- Modify: `frontend/index.html`

- [ ] **Step 1: Write `frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Broadway Guesser</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>Broadway Guesser</h1>
      <p id="date-display"></p>
      <div id="score-stars"></div>
    </header>

    <main>
      <div id="no-show-message" style="display:none">
        <p>No show scheduled for today. Check back tomorrow!</p>
      </div>

      <div id="game-area">
        <div id="clues-container"></div>

        <div id="feedback-message"></div>

        <div id="input-section">
          <div id="autocomplete-wrapper">
            <input
              id="guess-input"
              type="text"
              placeholder="Type a Broadway show..."
              autocomplete="off"
              aria-label="Guess a Broadway show"
            >
            <div id="autocomplete-dropdown"></div>
          </div>
          <button id="submit-btn">Guess</button>
          <p id="guesses-remaining"></p>
        </div>

        <div id="end-section" style="display:none">
          <p id="end-message"></p>
          <button id="share-btn">Share Result</button>
          <p id="share-confirm" style="display:none">Copied to clipboard!</p>
          <div id="countdown-timer"></div>
        </div>
      </div>
    </main>
  </div>

  <script src="/static/game.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add frontend/index.html
git commit -m "feat: frontend HTML structure

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 9: Frontend CSS

**Files:**
- Modify: `frontend/style.css`

- [ ] **Step 1: Write `frontend/style.css`**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg: #1a0a00;
  --surface: #2a1500;
  --border: #4a2e00;
  --text: #f5f0e8;
  --text-muted: #a89070;
  --gold: #c9a84c;
  --gold-dark: #9a7530;
  --red: #8b1a1a;
  --green: #2d6a2d;
  --radius: 8px;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: Georgia, 'Times New Roman', serif;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  padding: 2rem 1rem;
}

#app {
  width: 100%;
  max-width: 640px;
}

header {
  text-align: center;
  margin-bottom: 2rem;
  border-bottom: 2px solid var(--gold);
  padding-bottom: 1.5rem;
}

h1 {
  font-size: 2.5rem;
  color: var(--gold);
  letter-spacing: 0.05em;
  text-transform: uppercase;
  margin-bottom: 0.25rem;
}

#date-display {
  color: var(--text-muted);
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.9rem;
  margin-bottom: 0.5rem;
}

#score-stars {
  font-size: 1.4rem;
  min-height: 1.6rem;
}

#clues-container {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.clue-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 4px solid var(--gold);
  border-radius: var(--radius);
  padding: 1rem 1.25rem;
  animation: none;
}

.clue-card.new {
  animation: slideIn 0.4s ease-out;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}

.clue-label {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--gold);
  margin-bottom: 0.3rem;
}

.clue-value {
  font-size: 1.15rem;
}

#feedback-message {
  min-height: 1.4rem;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.9rem;
  color: var(--text-muted);
  text-align: center;
  margin-bottom: 1rem;
  transition: color 0.2s;
}

#feedback-message.error { color: #e07070; }
#feedback-message.success { color: #70c070; }

#input-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

#autocomplete-wrapper {
  position: relative;
}

#guess-input {
  width: 100%;
  padding: 0.8rem 1rem;
  background: var(--surface);
  border: 2px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}

#guess-input:focus { border-color: var(--gold); }

#guess-input.shake {
  animation: shake 0.35s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%       { transform: translateX(-8px); }
  40%       { transform: translateX(8px); }
  60%       { transform: translateX(-5px); }
  80%       { transform: translateX(5px); }
}

#autocomplete-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  display: none;
}

#autocomplete-dropdown.open { display: block; }

.autocomplete-item {
  padding: 0.6rem 1rem;
  cursor: pointer;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.95rem;
  border-bottom: 1px solid var(--border);
}

.autocomplete-item:last-child { border-bottom: none; }
.autocomplete-item:hover, .autocomplete-item.active {
  background: var(--border);
  color: var(--gold);
}

#submit-btn {
  padding: 0.8rem 2rem;
  background: var(--gold);
  color: var(--bg);
  border: none;
  border-radius: var(--radius);
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 1rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  cursor: pointer;
  transition: background 0.2s;
}

#submit-btn:hover { background: var(--gold-dark); }
#submit-btn:disabled { background: var(--border); color: var(--text-muted); cursor: default; }

#guesses-remaining {
  text-align: center;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.85rem;
  color: var(--text-muted);
}

#end-section {
  text-align: center;
  padding: 1.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

#end-message {
  font-size: 1.25rem;
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

#share-btn {
  padding: 0.7rem 1.75rem;
  background: transparent;
  border: 2px solid var(--gold);
  color: var(--gold);
  border-radius: var(--radius);
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.95rem;
  font-weight: 700;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  margin-bottom: 0.5rem;
}

#share-btn:hover { background: var(--gold); color: var(--bg); }

#share-confirm {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.85rem;
  color: #70c070;
  margin-bottom: 1rem;
}

#countdown-timer {
  font-family: 'Helvetica Neue', Arial, sans-serif;
  font-size: 0.9rem;
  color: var(--text-muted);
  margin-top: 1rem;
}

#no-show-message {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
}

@media (max-width: 480px) {
  h1 { font-size: 1.8rem; }
  body { padding: 1rem 0.75rem; }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/style.css
git commit -m "feat: frontend CSS playbill theme

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 10: Frontend JavaScript

**Files:**
- Modify: `frontend/game.js`

- [ ] **Step 1: Write `frontend/game.js`**

```javascript
const TODAY = new Date().toISOString().slice(0, 10);
const STORAGE_KEY = `broadway_${TODAY}`;

let allShows = [];
let todayData = null;
let state = loadState();
let activeDropdownIndex = -1;

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);
  return { guessesUsed: 0, solved: false, score: 0, guesses: [], answer: null };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function init() {
  document.getElementById('date-display').textContent = new Date(TODAY + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const [showsRes, todayRes] = await Promise.all([
    fetch('/api/shows'),
    fetch('/api/today'),
  ]);

  if (!todayRes.ok) {
    document.getElementById('no-show-message').style.display = 'block';
    document.getElementById('game-area').style.display = 'none';
    return;
  }

  allShows = await showsRes.json();
  todayData = await todayRes.json();
  render();
}

function render() {
  renderClues();
  updateScoreDisplay();

  const gameOver = state.solved || state.guessesUsed >= 5;
  document.getElementById('input-section').style.display = gameOver ? 'none' : 'block';
  document.getElementById('end-section').style.display = gameOver ? 'block' : 'none';

  if (gameOver) {
    renderEndState();
    startCountdown();
  } else {
    const remaining = 5 - state.guessesUsed;
    document.getElementById('guesses-remaining').textContent =
      `${remaining} guess${remaining === 1 ? '' : 'es'} remaining`;
  }
}

function renderClues() {
  const container = document.getElementById('clues-container');
  const prevCount = container.children.length;
  const count = Math.min(state.guessesUsed + 1, 5);

  // Only re-render if count changed
  if (container.children.length === count) return;
  container.innerHTML = '';

  for (let i = 0; i < count; i++) {
    const clue = todayData.clues[i];
    const card = document.createElement('div');
    card.className = 'clue-card' + (i === count - 1 && count > prevCount ? ' new' : '');
    card.innerHTML = `<div class="clue-label">${clue.category}</div><div class="clue-value">${clue.value}</div>`;
    container.appendChild(card);
  }
}

function updateScoreDisplay() {
  const stars = document.getElementById('score-stars');
  if (!state.solved) { stars.textContent = ''; return; }
  stars.textContent = '★'.repeat(state.score) + '☆'.repeat(5 - state.score);
}

function renderEndState() {
  const msg = document.getElementById('end-message');
  if (state.solved) {
    msg.textContent = `You got it in ${state.guessesUsed} clue${state.guessesUsed === 1 ? '' : 's'} — ${state.score} point${state.score === 1 ? '' : 's'}! 🎭`;
  } else {
    msg.textContent = `The answer was "${state.answer}" — better luck tomorrow!`;
    // Show all 5 clues when the game is lost
    if (todayData) {
      const container = document.getElementById('clues-container');
      container.innerHTML = '';
      for (const clue of todayData.clues) {
        const card = document.createElement('div');
        card.className = 'clue-card';
        card.innerHTML = `<div class="clue-label">${clue.category}</div><div class="clue-value">${clue.value}</div>`;
        container.appendChild(card);
      }
    }
  }

  document.getElementById('share-btn').addEventListener('click', shareResult);
}

function shareResult() {
  const filled = state.solved ? state.score : 0;
  const grid = '⭐'.repeat(filled) + '⬛'.repeat(5 - filled);
  const text = `Broadway Guesser ${TODAY}\n${grid}`;
  navigator.clipboard.writeText(text).then(() => {
    const confirm = document.getElementById('share-confirm');
    confirm.style.display = 'block';
    setTimeout(() => { confirm.style.display = 'none'; }, 2000);
  });
}

function startCountdown() {
  const el = document.getElementById('countdown-timer');
  function update() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff = midnight - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    el.textContent = `Next show in ${h}h ${m}m ${s}s`;
  }
  update();
  setInterval(update, 1000);
}

// Autocomplete
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('guess-input');
  const dropdown = document.getElementById('autocomplete-dropdown');
  const submitBtn = document.getElementById('submit-btn');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { closeDropdown(); return; }
    const matches = allShows.filter(s => s.toLowerCase().includes(q)).slice(0, 8);
    if (!matches.length) { closeDropdown(); return; }
    dropdown.innerHTML = '';
    activeDropdownIndex = -1;
    matches.forEach((title, i) => {
      const item = document.createElement('div');
      item.className = 'autocomplete-item';
      item.textContent = title;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        input.value = title;
        closeDropdown();
      });
      dropdown.appendChild(item);
    });
    dropdown.classList.add('open');
  });

  input.addEventListener('keydown', (e) => {
    const items = dropdown.querySelectorAll('.autocomplete-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeDropdownIndex = Math.min(activeDropdownIndex + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('active', i === activeDropdownIndex));
      if (items[activeDropdownIndex]) input.value = items[activeDropdownIndex].textContent;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeDropdownIndex = Math.max(activeDropdownIndex - 1, -1);
      items.forEach((el, i) => el.classList.toggle('active', i === activeDropdownIndex));
      if (activeDropdownIndex >= 0 && items[activeDropdownIndex]) input.value = items[activeDropdownIndex].textContent;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      closeDropdown();
      submitGuess();
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  input.addEventListener('blur', () => setTimeout(closeDropdown, 150));
  submitBtn.addEventListener('click', submitGuess);

  function closeDropdown() {
    dropdown.classList.remove('open');
    dropdown.innerHTML = '';
    activeDropdownIndex = -1;
  }
});

async function submitGuess() {
  const input = document.getElementById('guess-input');
  const guess = input.value.trim();
  if (!guess) return;

  const guessesUsed = state.guessesUsed + 1;
  const feedback = document.getElementById('feedback-message');

  const res = await fetch('/api/guess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: TODAY, guess, guesses_used: guessesUsed }),
  });

  const result = await res.json();
  state.guessesUsed = guessesUsed;
  state.guesses.push(guess);

  if (result.correct) {
    state.solved = true;
    state.score = result.score;
    state.answer = result.answer;
    feedback.textContent = '';
    saveState();
    render();
  } else {
    if (result.answer) {
      state.answer = result.answer;
    }
    feedback.className = 'error';
    feedback.textContent = guessesUsed < 5
      ? `Not quite — here's your next clue.`
      : `Out of guesses!`;
    input.classList.add('shake');
    input.addEventListener('animationend', () => input.classList.remove('shake'), { once: true });
    input.value = '';
    saveState();
    render();
  }
}

init();
```

- [ ] **Step 2: Commit**

```bash
git add frontend/game.js
git commit -m "feat: frontend game logic

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 11: Docker Build + Smoke Test

**Files:**
- Create: `.env` (from `.env.example`)

- [ ] **Step 1: Create `.env`**

```bash
cd /home/davidg/broadway-guesser
cp .env.example .env
# Edit .env and set a real DB_PASSWORD
nano .env
```

Set `DB_PASSWORD` to a secure value (e.g. a random string).

- [ ] **Step 2: Build the Docker image**

```bash
cd /home/davidg/broadway-guesser
docker compose build
```

Expected: image builds successfully, no errors.

- [ ] **Step 3: Start services**

```bash
docker compose up -d
```

Expected: both `db` and `app` containers start. Check with:

```bash
docker compose ps
```

Expected: both show `running`.

- [ ] **Step 4: Run the seed script**

```bash
docker compose exec app python seeds/seed.py
```

Expected: `Seeded 8 shows`

- [ ] **Step 5: Smoke test the API**

```bash
curl -s http://localhost:8003/api/today | python3 -m json.tool
```

Expected: JSON with today's clues (or 404 if today is not in the sample dates — in that case, add today's date to shows.csv and re-seed).

```bash
curl -s http://localhost:8003/api/shows | python3 -m json.tool
```

Expected: JSON array of 8 show titles.

```bash
curl -s -X POST http://localhost:8003/api/guess \
  -H "Content-Type: application/json" \
  -d '{"date":"'$(date +%Y-%m-%d)'","guess":"West Side Story","guesses_used":1}' | python3 -m json.tool
```

Expected: `{"correct": true, "score": 5, "answer": "West Side Story"}` (if today's show is West Side Story).

- [ ] **Step 6: Verify frontend loads**

```bash
curl -s http://localhost:8003/ | grep -o '<title>.*</title>'
```

Expected: `<title>Broadway Guesser</title>`

- [ ] **Step 7: Commit**

```bash
git add .env.example
git commit -m "chore: verify Docker build and smoke tests pass

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Task 12: Caddy Configuration + Deploy

**Files:**
- Modify: `/etc/caddy/Caddyfile`

- [ ] **Step 1: Add Broadway block to Caddyfile**

Open `/etc/caddy/Caddyfile` and append:

```caddy
broadway.darrigozik.com {
    reverse_proxy localhost:8003
}
```

The full file should look like:

```caddy
http://receipts.dg.darrigozik.com {
    reverse_proxy localhost:8000
}

http://split.dg.darrigozik.com {
    reverse_proxy localhost:8001
}

movie-poll.dg.darrigozik.com {
    handle /api/* {
        reverse_proxy localhost:8002
    }
    handle /ws/* {
        reverse_proxy localhost:8002
    }
    handle {
        root * /home/davidg/movie-poll-vm/frontend/out
        file_server
        try_files {path} {path}/ /index.html
    }
}

broadway.darrigozik.com {
    reverse_proxy localhost:8003
}
```

- [ ] **Step 2: Validate and reload Caddy**

```bash
caddy validate --config /etc/caddy/Caddyfile
```

Expected: `Valid configuration`

```bash
sudo systemctl reload caddy
```

Expected: no errors. Verify:

```bash
sudo systemctl status caddy
```

Expected: `active (running)`

- [ ] **Step 3: Verify HTTPS is live**

```bash
curl -si https://broadway.darrigozik.com/api/shows | head -5
```

Expected: `HTTP/2 200` and a JSON array of show titles. (DNS for `broadway.darrigozik.com` must point to this VM's IP — verify this is set up before running this step.)

- [ ] **Step 4: Configure Docker Compose to restart on boot**

```bash
cd /home/davidg/broadway-guesser
docker compose down
docker compose up -d --restart-policy always
```

Or update `docker-compose.yml` to add `restart: unless-stopped` to each service:

```yaml
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    ...

  app:
    build:
      context: .
      dockerfile: app/Dockerfile
    restart: unless-stopped
    ...
```

Then:

```bash
docker compose up -d
```

- [ ] **Step 5: Final commit**

```bash
cd /home/davidg/broadway-guesser
git add docker-compose.yml
git commit -m "chore: add restart policy and deploy to broadway.darrigozik.com

Generated with [Claude Code](https://claude.ai/code)
via [Happy](https://happy.engineering)

Co-Authored-By: Claude <noreply@anthropic.com>
Co-Authored-By: Happy <yesreply@happy.engineering>"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ GET /api/today — Task 3
- ✅ POST /api/guess with score and case-insensitive match — Task 4
- ✅ GET /api/shows for autocomplete — Task 5
- ✅ Answer returned on exhaustion (guesses_used >= 5) — Task 4 (deviation from original spec: server returns answer on exhaustion, not just on correct)
- ✅ localStorage game state — Task 10
- ✅ 5 clue cards revealed progressively — Task 10
- ✅ Autocomplete dropdown — Task 10
- ✅ Share button with emoji grid — Task 10
- ✅ Countdown timer — Task 10
- ✅ Playbill visual theme — Task 9
- ✅ Seed script + CSV — Task 7
- ✅ Docker Compose — Tasks 6, 11
- ✅ Caddy HTTPS reverse proxy on port 8003 — Task 12
- ✅ Git repo — Task 1
