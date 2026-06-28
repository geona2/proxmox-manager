import os
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    INFLUXDB_URL: str = "http://localhost:8086"
    INFLUXDB_TOKEN: str = "dummy_token"
    INFLUXDB_ORG: str = "my_org"
    INFLUXDB_BUCKET: str = "proxmox_metrics"
    
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/geona"
    APP_ENV: str = "production"
    
    METRICS_INTERVAL: int = 10  # Seconds
    SERVERS_FILE_PATH: str = "data/servers.json"
    UPLOAD_DIR: str = "data/uploaded_images"
    
    # Allow loading from environment and .env file
    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"),
        env_file_encoding="utf-8",
        extra="ignore"
    )

settings = Settings()
