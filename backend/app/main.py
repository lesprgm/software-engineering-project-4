from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import Base, engine
from .routers import groups

settings = get_settings()

# Create database tables on startup for local development.
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Campus Connect API",
    version="0.1.0",
    description="Backend services for campus social scheduling.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(groups.router)


@app.get("/health", tags=["health"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
