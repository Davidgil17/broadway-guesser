from sqlalchemy import Column, Integer, Text, Date
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
