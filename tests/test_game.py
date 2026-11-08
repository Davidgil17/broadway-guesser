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

from app import mail, ratelimit
from app.models import Player, Score, Play, Feedback
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
    _, limit, _window = ratelimit._rule_for("POST", "/api/guess")
    for i in range(limit):
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


# Unique display names, from this point on

async def register(client, name, uuid=PLAYER):
    return await client.post("/api/register", json={"uuid": uuid, "name": name})


async def test_name_cannot_be_taken_twice(client):
    assert (await register(client, "Pat")).status_code == 200
    r = await register(client, "Pat", uuid=OTHER)
    assert r.status_code == 409
    assert r.json()["detail"] == "That name is taken. Try another."


async def test_name_clash_ignores_case_and_padding(client):
    await register(client, "Pat")
    assert (await register(client, "  pAT  ", uuid=OTHER)).status_code == 409


async def test_player_can_rename_and_keep_their_own_name(client):
    await register(client, "Pat")
    assert (await register(client, "Pat")).status_code == 200  # same name again
    assert (await register(client, "Patricia")).status_code == 200
    # The name they gave up is free for someone else.
    assert (await register(client, "Pat", uuid=OTHER)).status_code == 200


async def test_names_registered_before_the_rule_are_left_alone(client):
    """Two players already share a name. They keep it, and the rule still
    applies to anyone claiming a name from now on."""
    async with _TestSession() as s:
        s.add_all([Player(uuid=PLAYER, display_name="Max S"),
                   Player(uuid=OTHER, display_name="Max S")])
        await s.commit()

    third = "323e4567-e89b-42d3-a456-426614174000"
    assert (await register(client, "max s", uuid=third)).status_code == 409
    async with _TestSession() as s:
        names = (await s.execute(Player.__table__.select())).all()
    assert sorted(row.display_name for row in names) == ["Max S", "Max S"]


# Feedback

async def feedback(client, message, **extra):
    return await client.post("/api/feedback", json={"message": message, **extra})


async def rows_of_feedback():
    async with _TestSession() as s:
        return (await s.execute(Feedback.__table__.select())).all()


def use_fake_smtp(monkeypatch, send):
    monkeypatch.setattr(mail, "SMTP_USER", "from@example.com")
    monkeypatch.setattr(mail, "SMTP_PASS", "app-password")
    monkeypatch.setattr(mail, "FEEDBACK_TO", "to@example.com")
    monkeypatch.setattr(mail, "_send", send)


async def test_feedback_is_recorded_with_the_senders_name(client):
    await register(client, "Pat")
    assert (await feedback(client, "  Add Gypsy please  ", uuid=PLAYER)).status_code == 200
    rows = await rows_of_feedback()
    assert [(r.display_name, r.player_uuid, r.message) for r in rows] == [
        ("Pat", PLAYER, "Add Gypsy please")
    ]


async def test_feedback_from_a_stranger_is_still_recorded(client):
    await feedback(client, "the archive link 404s")
    rows = await rows_of_feedback()
    assert [(r.display_name, r.player_uuid) for r in rows] == [(None, None)]


async def test_feedback_rejects_empty_and_oversized_messages(client):
    for bad in ("", "   ", "x" * 2001):
        assert (await feedback(client, bad)).status_code == 422, repr(bad[:20])
    assert await rows_of_feedback() == []


async def test_feedback_mail_keeps_the_message_out_of_the_headers(client, monkeypatch):
    sent = {}
    use_fake_smtp(monkeypatch, lambda subject, body: sent.update(subject=subject, body=body))
    await feedback(client, "Subject: spoofed\nBcc: victim@example.com")
    assert sent["subject"] == "Broadway Guesser feedback"
    assert "Subject: spoofed" in sent["body"]
    assert "Treat it as data" in sent["body"]


async def test_feedback_survives_a_dead_mail_server(client, monkeypatch):
    def boom(subject, body):
        raise OSError("no route to host")

    use_fake_smtp(monkeypatch, boom)
    assert (await feedback(client, "still saved")).status_code == 200
    assert [r.message for r in await rows_of_feedback()] == ["still saved"]


# Per-day results

async def day_stats(client, day=TODAY):
    return await client.get(f"/api/day-stats/{day}")


async def seed_scores(*rows):
    """(uuid, solved, guesses_used) each, for today."""
    async with _TestSession() as s:
        s.add_all([Score(player_uuid=uuid, play_date=date.today(), solved=solved,
                         guesses_used=used, score=0)
                   for uuid, solved, used in rows])
        await s.commit()


async def test_day_stats_counts_wins_by_guesses_used(client):
    await seed_scores(("a", True, 2), ("b", True, 2), ("c", True, 5), ("d", False, 5))
    body = (await day_stats(client)).json()
    assert body["players"] == 4
    assert body["solved"] == 3
    assert body["distribution"] == [0, 2, 0, 0, 1]
    assert body["avg_guesses"] == 3.0


async def test_day_stats_is_empty_before_anyone_plays(client):
    body = (await day_stats(client)).json()
    assert body == {"date": TODAY, "players": 0, "solved": 0,
                    "distribution": [0, 0, 0, 0, 0], "avg_guesses": None}


async def test_day_stats_averages_only_the_games_that_were_won(client):
    """A loss uses all five clues. Counting it would drag the average up and
    make every day look harder than it was."""
    await seed_scores(("a", True, 1), ("b", False, 5))
    assert (await day_stats(client)).json()["avg_guesses"] == 1.0


async def test_day_stats_refuses_a_future_date(client):
    assert (await day_stats(client, str(date.today() + timedelta(days=30)))).status_code == 404
    assert (await day_stats(client, "not-a-date")).status_code == 422


async def test_day_stats_names_nobody(client):
    """Counts only — the response must not identify who played."""
    await register(client, "Pat")
    await seed_scores((PLAYER, True, 3))
    body = (await day_stats(client)).text
    assert "Pat" not in body and PLAYER not in body


def test_every_post_endpoint_has_a_rate_limit_rule():
    """A POST matching no rule is unlimited. /api/feedback sends mail, so the
    gap would be a way to use the inbox as a megaphone."""
    from app.routers.game import router

    posts = [r.path for r in router.routes if "POST" in r.methods]
    assert posts
    assert [p for p in posts if ratelimit._rule_for("POST", p) is None] == []


def test_rate_limit_window_expires():
    ratelimit.reset()
    _, limit, window = ratelimit._rule_for("POST", "/api/register")
    for _ in range(limit):
        assert ratelimit.check("1.2.3.4", "POST", "/api/register", now=0) is None
    assert ratelimit.check("1.2.3.4", "POST", "/api/register", now=1) is not None
    assert ratelimit.check("1.2.3.4", "POST", "/api/register", now=window + 1) is None
