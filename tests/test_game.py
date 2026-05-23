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
