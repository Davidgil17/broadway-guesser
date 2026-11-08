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

PLAYER = "123e4567-e89b-42d3-a456-426614174000"


async def test_guess_rejects_out_of_range_guess_count(client, today_show):
    for bad in (0, -100, 6):
        response = await client.post("/api/guess", json={
            "date": str(date.today()), "guess": "West Side Story", "guesses_used": bad,
        })
        assert response.status_code == 422, bad


async def test_guess_score_capped_at_five(client, today_show):
    response = await client.post("/api/guess", json={
        "date": str(date.today()), "guess": "West Side Story", "guesses_used": 1,
    })
    assert response.json()["score"] == 5


async def test_guess_rejects_huge_guess(client, today_show):
    response = await client.post("/api/guess", json={
        "date": str(date.today()), "guess": "x" * 5000, "guesses_used": 1,
    })
    assert response.status_code == 422


async def test_future_show_is_hidden(client, other_show):
    response = await client.get("/api/show/2099-01-01")
    assert response.status_code == 404


async def test_future_guess_is_refused(client, other_show):
    response = await client.post("/api/guess", json={
        "date": "2099-01-01", "guess": "Hamilton", "guesses_used": 5,
    })
    assert response.status_code == 404
    assert "answer" not in response.json()


async def test_tomorrow_allowed_for_clock_slack(client):
    tomorrow = str(date.today() + timedelta(days=1))
    response = await client.get(f"/api/show/{tomorrow}")
    assert response.status_code == 404  # no show, but not refused as future
    assert response.json()["detail"] == "No show scheduled for that date"


async def test_scores_rejects_impossible_results(client, today_show):
    base = {"uuid": PLAYER, "date": str(date.today()), "score": 0}
    for solved, used in ((True, 0), (True, 6), (False, 2), (True, -5)):
        response = await client.post("/api/scores", json={**base, "solved": solved, "guesses_used": used})
        assert response.status_code == 422, (solved, used)


async def test_scores_rejects_non_uuid_player(client, today_show):
    response = await client.post("/api/scores", json={
        "uuid": "not-a-uuid", "date": str(date.today()), "solved": True, "guesses_used": 1, "score": 5,
    })
    assert response.status_code == 422


async def test_scores_rejects_future_date(client, other_show):
    response = await client.post("/api/scores", json={
        "uuid": PLAYER, "date": "2099-01-01", "solved": True, "guesses_used": 1, "score": 5,
    })
    assert response.status_code == 404


async def test_register_rejects_blank_name_and_bad_uuid(client):
    assert (await client.post("/api/register", json={"uuid": PLAYER, "name": "   "})).status_code == 422
    assert (await client.post("/api/register", json={"uuid": "abc", "name": "Pat"})).status_code == 422


async def test_leaderboard_never_exposes_uuid(client, today_show):
    from app.routers.game import public_id
    from app.models import Player, Score
    from tests.conftest import _TestSession

    async with _TestSession() as session:
        session.add(Player(uuid=PLAYER, display_name="Pat"))
        session.add(Score(player_uuid=PLAYER, play_date=date.today(), solved=True, guesses_used=2, score=4))
        await session.commit()

    response = await client.get("/api/leaderboard")
    body = response.text
    assert PLAYER not in body
    row = response.json()[0]
    assert "uuid" not in row
    assert row["id"] == public_id(PLAYER)


async def test_api_docs_disabled(client):
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert (await client.get(path)).status_code == 404, path
