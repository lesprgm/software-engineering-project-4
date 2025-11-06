from sqlalchemy import Column, Integer, String, Float, Text
from app.database import Base  # correct import for your Base class

class Place(Base):
    __tablename__ = "places"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text)
    location = Column(String)  # e.g. "Campus Center", "Downtown"
    rating = Column(Float, default=0.0)
    tags = Column(String)  # comma-separated tags like "cafe, study, wifi"
    photo_url = Column(String, nullable=True)
