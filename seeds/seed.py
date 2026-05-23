import asyncio
import csv
import os
import sys
from datetime import date as date_type
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
                    play_date=date_type.fromisoformat(row["play_date"]),
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
