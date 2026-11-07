"""
Trinity AI - Morpheus Social Media Autonomous Agent
Clean Architecture Entrypoint for aura.dev (and auru.dev)
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import domain_settings
from infrastructure.database import init_db
from application.scheduler import autopilot_engine

# Interfaces
from interfaces.oauth import router as oauth_router
from interfaces.webhooks import router as webhooks_router
from interfaces.links import router as links_router
from interfaces.dashboard import router as admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Initialize Database and Autopilot background scheduler
    await init_db()
    await autopilot_engine.start()
    yield
    # Shutdown: Stop Autopilot scheduler
    await autopilot_engine.stop()


app = FastAPI(
    title="Trinity Morpheus - Social Media AI Agent",
    description="Autonomous Social Media Commander with OAuth 2.0 Engine & Domain Integration for aura.dev",
    version="1.1.0",
    lifespan=lifespan
)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[domain_settings.base_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(admin_router)
app.include_router(oauth_router)
app.include_router(webhooks_router)
app.include_router(links_router)


@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "agent": "Morpheus",
        "version": "1.1.0",
        "domain": domain_settings.full_host,
        "base_url": domain_settings.base_url,
        "autopilot_running": autopilot_engine.is_running
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
