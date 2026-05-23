from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
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
