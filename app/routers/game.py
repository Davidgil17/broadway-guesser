from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..database import get_db
from ..models import Show, Player, Score

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
    date: str
    solved: bool
    guesses_used: int
    score: int


class RegisterRequest(BaseModel):
    uuid: str
    name: str
    history: list[ScoreEntry] = []


@router.post("/register")
async def register_player(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    stmt = pg_insert(Player).values(uuid=body.uuid, display_name=body.name.strip()[:30])
    stmt = stmt.on_conflict_do_update(index_elements=["uuid"], set_={"display_name": body.name.strip()[:30]})
    await db.execute(stmt)

    for entry in body.history:
        try:
            play_date = date.fromisoformat(entry.date)
        except ValueError:
            continue
        score_stmt = pg_insert(Score).values(
            player_uuid=body.uuid,
            play_date=play_date,
            solved=entry.solved,
            guesses_used=entry.guesses_used,
            score=entry.score,
        ).on_conflict_do_nothing()
        await db.execute(score_stmt)

    await db.commit()
    return {"ok": True}


class ScoreRequest(BaseModel):
    uuid: str
    date: str
    solved: bool
    guesses_used: int
    score: int


@router.post("/scores")
async def post_score(body: ScoreRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Player).where(Player.uuid == body.uuid))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Player not found")
    try:
        play_date = date.fromisoformat(body.date)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date")
    stmt = pg_insert(Score).values(
        player_uuid=body.uuid,
        play_date=play_date,
        solved=body.solved,
        guesses_used=body.guesses_used,
        score=body.score,
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
            "uuid": uuid,
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
    try:
        play_date = date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format")
    result = await db.execute(select(Show).where(Show.play_date == play_date))
    show = result.scalar_one_or_none()
    if show is None:
        raise HTTPException(status_code=404, detail="No show scheduled for that date")
    return {
        "date": date_str,
        "clues": [
            {"n": 1, "category": "Opening Year", "value": str(show.year)},
            {"n": 2, "category": "Genre", "value": show.genre},
            {"n": 3, "category": "Composer", "value": show.composer},
            {"n": 4, "category": "Notable Cast", "value": show.notable_cast},
            {"n": 5, "category": "Plot Hint", "value": show.plot_hint},
        ],
    }
