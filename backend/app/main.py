import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Ensure static directory exists at import time before StaticFiles mounting
from app.config import settings
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

from app.routers import servers, dashboard, vms, images, auth, ceph
from app.scheduler import metrics_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger(__name__)

from app.database import init_db, populate_defaults

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start InfluxDB metrics collector in the background
    logger.info("Initializing Proxmox Dashboard Backend...")
    try:
        await init_db()
        await populate_defaults()
    except Exception as e:
        logger.error(f"Error during database initialization: {e}", exc_info=True)
    metrics_scheduler.start()
    yield
    # Shutdown: Stop InfluxDB metrics collector
    logger.info("Shutting down Proxmox Dashboard Backend...")
    await metrics_scheduler.stop()

app = FastAPI(
    title="Proxmox Dashboard API",
    description="Backend API for Proxmox Multi-Server Dashboard and InfluxDB export.",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(servers.router)
app.include_router(dashboard.router)
app.include_router(vms.router)
app.include_router(images.router)
app.include_router(auth.router)
app.include_router(ceph.router)

# Mount static files folder for uploaded images
app.mount("/static/images", StaticFiles(directory=settings.UPLOAD_DIR), name="images")

@app.get("/")
async def root():
    return {
        "status": "healthy",
        "service": "Proxmox Multi-Server Dashboard API",
        "documentation": "/docs"
    }
