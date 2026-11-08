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


async def test_shows_returns_sorted_titles(client, today_show, other_show):
    response = await client.get("/api/shows")
    assert response.status_code == 200
    titles = response.json()
    assert titles == ["Hamilton", "West Side Story"]


async def test_shows_returns_empty_list_when_no_shows(client):
    response = await client.get("/api/shows")
    assert response.status_code == 200
    assert response.json() == []


# --- API hardening ---------------------------------------------------------

from datetime import timedelta

import pytest_asyncio

from app import ratelimit
from app.models import Player, Score, Play
from app.routers.game import public_id
from tests.conftest import _TestSession

PLAYER = "123e4567-e89b-42d3-a456-426614174000"
OTHER = "223e4567-e89b-42d3-a456-426614174000"
TODAY = str(date.today())


@pytest_asyncio.fixture(autouse=True)
async def clear_rate_limits():
    ratelimit.reset()
    yield
    ratelimit.reset()


async def guess(client, text, uuid=PLAYER, day=TODAY, **extra):
    return await client.post("/api/guess", json={"date": day, "guess": text, "uuid": uuid, **extra})


async def scores_for(uuid):
    async with _TestSession() as s:
        return (await s.execute(Score.__table__.select().where(Score.player_uuid == uuid))).all()


# Untracked guesses (no uuid, e.g. an old cached page)

async def test_guess_rejects_out_of_range_guess_count(client, today_show):
    for bad in (0, -100, 6):
        response = await client.post("/api/guess", json={"date": TODAY, "guess": "x", "guesses_used": bad})
        assert response.status_code == 422, bad


async def test_guess_rejects_huge_guess(client, today_show):
    response = await client.post("/api/guess", json={"date": TODAY, "guess": "x" * 5000, "guesses_used": 1})
    assert response.status_code == 422


async def test_untracked_guess_records_nothing(client, today_show):
    await client.post("/api/guess", json={"date": TODAY, "guess": "West Side Story", "guesses_used": 1})
    async with _TestSession() as s:
        assert (await s.execute(Score.__table__.select())).all() == []


# Server-counted guesses

async def test_server_counts_guesses_and_ignores_client_count(client, today_show):
    r1 = await guess(client, "Cats", guesses_used=5)
    assert r1.json()["guesses_used"] == 1
    assert "answer" not in r1.json()  # claiming guess 5 no longer reveals the answer
    r2 = await guess(client, "Rent")
    assert r2.json()["guesses_used"] == 2
    r3 = await guess(client, "west side story!", guesses_used=1)
    assert r3.json() == {"correct": True, "score": 3, "guesses_used": 3, "answer": "West Side Story"}
    rows = await scores_for(PLAYER)
    assert [(r.solved, r.guesses_used, r.score) for r in rows] == [(True, 3, 3)]


async def test_five_misses_record_a_loss(client, today_show):
    for i in range(5):
        r = await guess(client, f"Wrong {i}")
    assert r.json()["answer"] == "West Side Story"
    assert [(r.solved, r.score) for r in await scores_for(PLAYER)] == [(False, 0)]


async def test_finished_game_refuses_more_guesses(client, today_show):
    await guess(client, "West Side Story")
    r = await guess(client, "West Side Story")
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert detail["solved"] is True and detail["guesses_used"] == 1 and detail["score"] == 5
    assert len(await scores_for(PLAYER)) == 1


async def test_players_are_counted_separately(client, today_show):
    await guess(client, "Cats", uuid=PLAYER)
    r = await guess(client, "Cats", uuid=OTHER)
    assert r.json()["guesses_used"] == 1


async def test_guess_rejects_non_uuid(client, today_show):
    assert (await guess(client, "Cats", uuid="not-a-uuid")).status_code == 422


async def test_scores_endpoint_ignores_claims(client, today_show):
    r = await client.post("/api/scores", json={"uuid": PLAYER, "date": TODAY, "solved": True, "guesses_used": 1, "score": 999})
    assert r.status_code == 200
    assert await scores_for(PLAYER) == []


async def test_register_ignores_history_but_keeps_played_games(client, today_show):
    await guess(client, "West Side Story")  # played before choosing a name
    history = [{"date": "2020-01-01", "solved": True, "guesses_used": 1, "score": 5}]
    r = await client.post("/api/register", json={"uuid": PLAYER, "name": "  Pat ", "history": history})
    assert r.status_code == 200
    board = (await client.get("/api/leaderboard")).json()
    assert board == [{"id": public_id(PLAYER), "name": "Pat", "played": 1, "won": 1, "win_pct": 100,
                      "avg_guesses": 1.0, "streak": 1, "total_score": 5}]


async def test_register_rejects_blank_name_and_bad_uuid(client):
    assert (await client.post("/api/register", json={"uuid": PLAYER, "name": "   "})).status_code == 422
    assert (await client.post("/api/register", json={"uuid": "abc", "name": "Pat"})).status_code == 422


async def test_leaderboard_never_exposes_uuid(client, today_show):
    await guess(client, "West Side Story")
    await client.post("/api/register", json={"uuid": PLAYER, "name": "Pat"})
    response = await client.get("/api/leaderboard")
    assert PLAYER not in response.text
    assert "uuid" not in response.json()[0]


# Dates

async def test_future_show_is_hidden(client, other_show):
    assert (await client.get("/api/show/2099-01-01")).status_code == 404


async def test_future_guess_is_refused(client, other_show):
    r = await guess(client, "Hamilton", day="2099-01-01")
    assert r.status_code == 404
    assert "answer" not in r.json()


async def test_tomorrow_allowed_for_clock_slack(client):
    tomorrow = str(date.today() + timedelta(days=1))
    response = await client.get(f"/api/show/{tomorrow}")
    assert response.json()["detail"] == "No show scheduled for that date"


# Rate limiting and misc

async def test_api_docs_disabled(client):
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert (await client.get(path)).status_code == 404, path


async def test_whoami_uses_trusted_hop(client, monkeypatch):
    monkeypatch.setattr(ratelimit, "TRUSTED_PROXY_HOPS", 2)
    # forged entry, real visitor (added by outer proxy), outer proxy (added by inner proxy)
    r = await client.get("/api/whoami", headers={"X-Forwarded-For": "6.6.6.6, 203.0.113.9, 10.0.0.2"})
    assert r.json() == {"ip": "203.0.113.9"}


async def test_rate_limit_returns_429_with_retry_after(client, today_show):
    for i in range(60):
        r = await client.post("/api/guess", json={"date": TODAY, "guess": "x", "guesses_used": 1},
                              headers={"X-Forwarded-For": "198.51.100.1, 10.0.0.2"})
        assert r.status_code == 200, i
    r = await client.post("/api/guess", json={"date": TODAY, "guess": "x", "guesses_used": 1},
                          headers={"X-Forwarded-For": "198.51.100.1, 10.0.0.2"})
    assert r.status_code == 429
    assert int(r.headers["retry-after"]) > 0
    # a different visitor is unaffected
    r = await client.post("/api/guess", json={"date": TODAY, "guess": "x", "guesses_used": 1},
                          headers={"X-Forwarded-For": "198.51.100.2, 10.0.0.2"})
    assert r.status_code == 200


def test_rate_limit_window_expires():
    ratelimit.reset()
    for _ in range(10):
        assert ratelimit.check("1.2.3.4", "POST", "/api/register", now=0) is None
    assert ratelimit.check("1.2.3.4", "POST", "/api/register", now=1) is not None
    assert ratelimit.check("1.2.3.4", "POST", "/api/register", now=3601) is None
