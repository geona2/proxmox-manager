import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy import Column, String, Integer, Float, Boolean, BigInteger, JSON
from sqlalchemy.future import select
from app.config import settings

logger = logging.getLogger(__name__)

DATABASE_URL = settings.DATABASE_URL
if DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

class UserTable(Base):
    __tablename__ = "users"
    username = Column(String, primary_key=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, nullable=False)

class ServerTable(Base):
    __tablename__ = "servers"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    host = Column(String, nullable=False)
    port = Column(Integer, default=8006)
    username = Column(String, nullable=False)
    token_name = Column(String, nullable=False)
    token_value = Column(String, nullable=False)
    verify_ssl = Column(Boolean, default=False)
    cpu_overcommit_ratio = Column(Integer, default=100, nullable=False)

class ImageTable(Base):
    __tablename__ = "images"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    url = Column(String, nullable=False)
    size_gb = Column(Float, nullable=False)

class MockGuestTable(Base):
    __tablename__ = "mock_guests"
    vmid = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    node = Column(String, nullable=False)
    type = Column(String, nullable=False)  # qemu / lxc
    status = Column(String, nullable=False)
    maxmem = Column(BigInteger, nullable=False)
    maxcpu = Column(Integer, nullable=False)
    storage = Column(String, nullable=False)
    disk_size = Column(Integer, nullable=False)
    image = Column(String, nullable=False)
    template = Column(Integer, default=0)
    cloudinit = Column(JSON, nullable=True)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def populate_defaults():
    import hashlib
    def hash_password(password: str) -> str:
        return hashlib.sha256(password.encode("utf-8")).hexdigest()

    from app.mock_handler import DEFAULT_MOCK_GUESTS

    async with AsyncSessionLocal() as session:
        async with session.begin():
            # 1. Initialize Users (always, if none exist)
            user_count_result = await session.execute(select(UserTable))
            existing_users = user_count_result.scalars().all()
            if not existing_users:
                logger.info("Initializing default users...")
                default_users = [
                    UserTable(username="admin", password_hash=hash_password("admin123"), role="admin"),
                    UserTable(username="operator", password_hash=hash_password("operator123"), role="operator"),
                    UserTable(username="reader", password_hash=hash_password("reader123"), role="reader")
                ]
                session.add_all(default_users)
            
            # 2. Check APP_ENV
            if settings.APP_ENV == "development":
                mock_servers_to_seed = [
                    ("mock-server-datacenter-id", "Primary Enterprise Cluster (Mock A)", 120),
                    ("mock-server-backup-id", "Secondary Backup Cluster (Mock B)", 150),
                    ("mock-server-dev-lab-id", "Development Lab Cluster (Mock C)", 100),
                    ("mock-server-test-qa-id", "Testing QA Cluster (Mock D)", 110),
                    ("mock-server-staging-id", "Staging Operations Cluster (Mock E)", 130),
                    ("mock-server-prod-web-id", "Production Web Cluster (Mock F)", 140),
                    ("mock-server-prod-db-id", "Production Database Cluster (Mock G)", 160),
                    ("mock-server-prod-storage-id", "Production Storage Cluster (Mock H)", 180),
                    ("mock-server-ai-gpu-id", "AI/GPU Compute Cluster (Mock I)", 200),
                    ("mock-server-dr-id", "Disaster Recovery Cluster (Mock J)", 120)
                ]
                for s_id, s_name, overcommit in mock_servers_to_seed:
                    server_result = await session.execute(select(ServerTable).filter_by(id=s_id))
                    mock_server = server_result.scalar_one_or_none()
                    if not mock_server:
                        logger.info(f"Initializing mock server {s_name}...")
                        new_server = ServerTable(
                            id=s_id,
                            name=s_name,
                            host="mock",
                            port=8006,
                            username="demo@pam",
                            token_name="demo-token",
                            token_value="demo-value",
                            verify_ssl=False,
                            cpu_overcommit_ratio=overcommit
                        )
                        session.add(new_server)

                # Check Mock Guests
                guest_count_result = await session.execute(select(MockGuestTable))
                existing_guests = guest_count_result.scalars().all()
                if not existing_guests:
                    logger.info("Initializing mock guests (development environment)...")
                    mock_guests = []
                    for g in DEFAULT_MOCK_GUESTS:
                        mock_guests.append(MockGuestTable(
                            vmid=g["vmid"],
                            name=g["name"],
                            node=g["node"],
                            type=g["type"],
                            status=g["status"],
                            maxmem=g["maxmem"],
                            maxcpu=g["maxcpu"],
                            storage=g["storage"],
                            disk_size=g["disk_size"],
                            image=g["image"],
                            template=g.get("template", 0),
                            cloudinit=g.get("cloudinit")
                        ))
                    session.add_all(mock_guests)

                # Check Mock Images
                image_count_result = await session.execute(select(ImageTable))
                existing_images = image_count_result.scalars().all()
                if not existing_images:
                    logger.info("Initializing mock images (development environment)...")
                    default_images = [
                        ImageTable(id="ubuntu-22.04-iso", name="ubuntu-22.04.4-live-server-amd64.iso", type="iso", url="https://releases.ubuntu.com/22.04/ubuntu-22.04.4-live-server-amd64.iso", size_gb=2.1),
                        ImageTable(id="debian-12-iso", name="debian-12.5.0-amd64-netinst.iso", type="iso", url="https://cdimage.debian.org/debian-cd/current/amd64/iso-cd/debian-12.5.0-amd64-netinst.iso", size_gb=0.7),
                        ImageTable(id="alpine-3.19-lxc", name="alpine-3.19-default_20240207_amd64.tar.xz", type="vztmpl", url="http://download.proxmox.com/images/aplinfo/alpine-3.19-default_20240207_amd64.tar.xz", size_gb=0.05),
                        ImageTable(id="ubuntu-22.04-lxc", name="ubuntu-22.04-default_20221130_amd64.tar.zst", type="vztmpl", url="http://download.proxmox.com/images/aplinfo/ubuntu-22.04-default_20221130_amd64.tar.zst", size_gb=0.12)
                    ]
                    session.add_all(default_images)
