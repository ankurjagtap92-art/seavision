from sqlalchemy import Column, Integer, String, Text
from database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)


class Vessel(Base):
    __tablename__ = "vessels"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    name = Column(String)
    imo_number = Column(String)
    vessel_type = Column(String)
    image_url = Column(Text, default="")   # ← CHANGED: String → Text