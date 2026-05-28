from sqlalchemy import Column, Integer, Text, Date, Boolean, UniqueConstraint
from .database import Base


class Show(Base):
    __tablename__ = "shows"

    id = Column(Integer, primary_key=True)
    title = Column(Text, nullable=False)
    year = Column(Integer, nullable=False)
    genre = Column(Text, nullable=False)
    composer = Column(Text, nullable=False)
    notable_cast = Column(Text, nullable=False)
    plot_hint = Column(Text, nullable=False)
    play_date = Column(Date, unique=True, nullable=False)


class Player(Base):
    __tablename__ = "players"

    uuid = Column(Text, primary_key=True)
    display_name = Column(Text, nullable=False)


class Score(Base):
    __tablename__ = "scores"

    id = Column(Integer, primary_key=True, autoincrement=True)
    player_uuid = Column(Text, nullable=False)
    play_date = Column(Date, nullable=False)
    solved = Column(Boolean, nullable=False)
    guesses_used = Column(Integer, nullable=False)
    score = Column(Integer, nullable=False, default=0)

    __table_args__ = (UniqueConstraint("player_uuid", "play_date", name="uq_player_date"),)
