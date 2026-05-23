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
