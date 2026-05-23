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
