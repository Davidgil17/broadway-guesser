import hashlib
import re
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..database import get_db
from ..models import Show, Player, Score

router = APIRouter(prefix="/api")

MAX_GUESSES = 5
UUID_PATTERN = r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$"
# One day of slack so a client whose clock is slightly ahead is never locked out.
DATE_SLACK = timedelta(days=1)


def public_id(uuid: str) -> str:
    """One-way id for the leaderboard. The uuid itself acts as the player's
    password, so it must never be published."""
    return hashlib.sha256(uuid.encode()).hexdigest()[:16]


def points_for(solved: bool, guesses_used: int) -> int:
    return MAX_GUESSES + 1 - guesses_used if solved else 0


def parse_playable_date(value: str) -> date:
    """A date the game has reached: valid ISO format and not in the future."""
    try:
        d = date.fromisoformat(value)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format")
    if d > date.today() + DATE_SLACK:
        raise HTTPException(status_code=404, detail="No show scheduled for that date")
    return d


def clues_for(show: Show) -> list[dict]:
    return [
        {"n": 1, "category": "Opening Year", "value": str(show.year)},
        {"n": 2, "category": "Genre", "value": show.genre},
        {"n": 3, "category": "Composer", "value": show.composer},
        {"n": 4, "category": "Notable Cast", "value": show.notable_cast},
        {"n": 5, "category": "Plot Hint", "value": show.plot_hint},
    ]


@router.get("/today")
async def get_today(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Show).where(Show.play_date == date.today()))
    show = result.scalar_one_or_none()
    if show is None:
        raise HTTPException(status_code=404, detail="No show scheduled for today")
    return {"date": str(date.today()), "clues": clues_for(show)}


class GuessRequest(BaseModel):
    date: str = Field(max_length=10)
    guess: str = Field(max_length=200)
    guesses_used: int = Field(ge=1, le=MAX_GUESSES)


def normalize(s: str) -> str:
    return re.sub(r"[^\w\s]", "", s).strip().lower()


@router.post("/guess")
async def post_guess(body: GuessRequest, db: AsyncSession = Depends(get_db)):
    play_date = parse_playable_date(body.date)
    result = await db.execute(select(Show).where(Show.play_date == play_date))
    show = result.scalar_one_or_none()
    if show is None:
        raise HTTPException(status_code=404, detail="No show scheduled for that date")

    correct = normalize(body.guess) == normalize(show.title)
    response: dict = {"correct": correct, "score": points_for(correct, body.guesses_used)}
    if correct or body.guesses_used >= MAX_GUESSES:
        response["answer"] = show.title
    return response


@router.get("/shows")
async def get_shows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Show.title).order_by(Show.title))
    return [row[0] for row in result.all()]


@router.get("/archive")
async def get_archive(db: AsyncSession = Depends(get_db)):
    today = date.today()
    result = await db.execute(
        select(Show.play_date)
        .where(Show.play_date < today)
        .order_by(Show.play_date.desc())
    )
    return [str(row[0]) for row in result.all()]


class ScoreEntry(BaseModel):
    date: str = Field(max_length=10)
    solved: bool
    guesses_used: int
    score: int = 0  # ignored: the server works out points itself


class RegisterRequest(BaseModel):
    uuid: str = Field(pattern=UUID_PATTERN)
    name: str = Field(min_length=1, max_length=100)
    history: list[ScoreEntry] = Field(default=[], max_length=1000)


def valid_result(solved: bool, guesses_used: int) -> bool:
    # A solved game used 1-5 guesses; an unsolved one used all 5.
    return (1 <= guesses_used <= MAX_GUESSES) if solved else guesses_used == MAX_GUESSES


async def scheduled_dates(db: AsyncSession) -> set[date]:
    limit = date.today() + DATE_SLACK
    result = await db.execute(select(Show.play_date).where(Show.play_date <= limit))
    return {row[0] for row in result.all()}


@router.post("/register")
async def register_player(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    name = body.name.strip()[:30]
    if not name:
        raise HTTPException(status_code=422, detail="Name is required")
    stmt = pg_insert(Player).values(uuid=body.uuid, display_name=name)
    stmt = stmt.on_conflict_do_update(index_elements=["uuid"], set_={"display_name": name})
    await db.execute(stmt)

    playable = await scheduled_dates(db)
    for entry in body.history:
        try:
            play_date = date.fromisoformat(entry.date)
        except ValueError:
            continue
        if play_date not in playable or not valid_result(entry.solved, entry.guesses_used):
            continue
        score_stmt = pg_insert(Score).values(
            player_uuid=body.uuid,
            play_date=play_date,
            solved=entry.solved,
            guesses_used=entry.guesses_used,
            score=points_for(entry.solved, entry.guesses_used),
        ).on_conflict_do_nothing()
        await db.execute(score_stmt)

    await db.commit()
    return {"ok": True}


class ScoreRequest(BaseModel):
    uuid: str = Field(pattern=UUID_PATTERN)
    date: str = Field(max_length=10)
    solved: bool
    guesses_used: int
    score: int = 0  # ignored: the server works out points itself


@router.post("/scores")
async def post_score(body: ScoreRequest, db: AsyncSession = Depends(get_db)):
    if not valid_result(body.solved, body.guesses_used):
        raise HTTPException(status_code=422, detail="Impossible result")
    play_date = parse_playable_date(body.date)
    result = await db.execute(select(Player).where(Player.uuid == body.uuid))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Player not found")
    if play_date not in await scheduled_dates(db):
        raise HTTPException(status_code=404, detail="No show scheduled for that date")
    stmt = pg_insert(Score).values(
        player_uuid=body.uuid,
        play_date=play_date,
        solved=body.solved,
        guesses_used=body.guesses_used,
        score=points_for(body.solved, body.guesses_used),
    ).on_conflict_do_nothing()
    await db.execute(stmt)
    await db.commit()
    return {"ok": True}


@router.get("/leaderboard")
async def get_leaderboard(db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(Player.uuid, Player.display_name, Score.play_date, Score.solved, Score.guesses_used, Score.score)
        .join(Score, Score.player_uuid == Player.uuid)
        .order_by(Player.uuid, Score.play_date)
    )).all()

    players: dict = {}
    for uuid, name, play_date, solved, guesses_used, pts in rows:
        if uuid not in players:
            players[uuid] = {"name": name, "scores": []}
        players[uuid]["scores"].append({"date": str(play_date), "solved": solved, "guesses_used": guesses_used, "score": pts})

    leaderboard = []
    for uuid, data in players.items():
        scores = data["scores"]
        played = len(scores)
        won_list = [s for s in scores if s["solved"]]
        won = len(won_list)
        total_score = sum(s["score"] for s in scores)
        avg_guesses = round(sum(s["guesses_used"] for s in won_list) / won, 1) if won else None
        streak = 0
        for s in reversed(scores):
            if s["solved"]:
                streak += 1
            else:
                break
        leaderboard.append({
            "id": public_id(uuid),
            "name": data["name"],
            "played": played,
            "won": won,
            "win_pct": round(won / played * 100) if played else 0,
            "avg_guesses": avg_guesses,
            "streak": streak,
            "total_score": total_score,
        })

    leaderboard.sort(key=lambda x: (-x["total_score"], -x["won"]))
    return leaderboard


@router.get("/show/{date_str}")
async def get_show(date_str: str, db: AsyncSession = Depends(get_db)):
    play_date = parse_playable_date(date_str)
    result = await db.execute(select(Show).where(Show.play_date == play_date))
    show = result.scalar_one_or_none()
    if show is None:
        raise HTTPException(status_code=404, detail="No show scheduled for that date")
    return {"date": date_str, "clues": clues_for(show)}
