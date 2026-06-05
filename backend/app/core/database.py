"""
Cấu hình kết nối Database SQLite + SQLAlchemy ORM
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# SQLite cần thêm connect_args
engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
    echo=False,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """Dependency injection cho FastAPI - cung cấp session DB cho mỗi request"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
