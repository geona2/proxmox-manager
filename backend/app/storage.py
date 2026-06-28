from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from sqlalchemy.future import select
from app.database import AsyncSessionLocal, ServerTable
import uuid

class ProxmoxServerSchema(BaseModel):
    id: Optional[str] = None
    name: str
    host: str
    port: int = 8006
    username: str
    token_name: str
    token_value: str
    verify_ssl: bool = False
    cpu_overcommit_ratio: int = 100

class StorageManager:
    async def get_all_servers(self) -> List[Dict[str, Any]]:
        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(select(ServerTable))
                servers = result.scalars().all()
                return [
                    {
                        "id": s.id,
                        "name": s.name,
                        "host": s.host,
                        "port": s.port,
                        "username": s.username,
                        "token_name": s.token_name,
                        "token_value": s.token_value,
                        "verify_ssl": s.verify_ssl,
                        "cpu_overcommit_ratio": s.cpu_overcommit_ratio,
                    }
                    for s in servers
                ]
            except Exception as e:
                print(f"Error reading servers from DB: {e}")
                return []

    async def get_server(self, server_id: str) -> Optional[Dict[str, Any]]:
        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(select(ServerTable).filter_by(id=server_id))
                s = result.scalar_one_or_none()
                if s:
                    return {
                        "id": s.id,
                        "name": s.name,
                        "host": s.host,
                        "port": s.port,
                        "username": s.username,
                        "token_name": s.token_name,
                        "token_value": s.token_value,
                        "verify_ssl": s.verify_ssl,
                        "cpu_overcommit_ratio": s.cpu_overcommit_ratio,
                    }
                return None
            except Exception as e:
                print(f"Error reading server {server_id} from DB: {e}")
                return None

    async def add_server(self, server_data: ProxmoxServerSchema) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                new_id = str(uuid.uuid4())
                new_server = ServerTable(
                    id=new_id,
                    name=server_data.name,
                    host=server_data.host,
                    port=server_data.port,
                    username=server_data.username,
                    token_name=server_data.token_name,
                    token_value=server_data.token_value,
                    verify_ssl=server_data.verify_ssl,
                    cpu_overcommit_ratio=server_data.cpu_overcommit_ratio,
                )
                session.add(new_server)
                
            ret = server_data.model_dump()
            ret["id"] = new_id
            return ret

    async def update_server(self, server_id: str, server_data: ProxmoxServerSchema) -> Optional[Dict[str, Any]]:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                result = await session.execute(select(ServerTable).filter_by(id=server_id))
                s = result.scalar_one_or_none()
                if s:
                    s.name = server_data.name
                    s.host = server_data.host
                    s.port = server_data.port
                    s.username = server_data.username
                    s.token_name = server_data.token_name
                    s.token_value = server_data.token_value
                    s.verify_ssl = server_data.verify_ssl
                    s.cpu_overcommit_ratio = server_data.cpu_overcommit_ratio
                    
                    ret = server_data.model_dump()
                    ret["id"] = server_id
                    return ret
                return None

    async def delete_server(self, server_id: str) -> bool:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                result = await session.execute(select(ServerTable).filter_by(id=server_id))
                s = result.scalar_one_or_none()
                if s:
                    await session.delete(s)
                    return True
                return False

storage_manager = StorageManager()
