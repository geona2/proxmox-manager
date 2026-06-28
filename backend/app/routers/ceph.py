from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from typing import Optional, List, Literal
from app.routers.auth import require_role
from app.storage import storage_manager
from app.proxmox import ProxmoxClient

router = APIRouter(prefix="/api/servers/{server_id}/ceph", tags=["ceph"])

class CephStoragePayload(BaseModel):
    storage_id: str
    type: Literal["rbd", "cephfs"]
    monhosts: str
    pool: str = "rbd"
    username: str = "admin"
    content: str  # e.g., "images,rootdir" or "iso,vztmpl,backup"
    nodes: Optional[str] = None

@router.get("/status", dependencies=[Depends(require_role(["admin", "operator", "reader"]))])
async def get_ceph_status(server_id: str, node: str):
    try:
        is_mock = False
        server = None
        
        if server_id.startswith("mock-server-"):
            is_mock = True
        else:
            server = await storage_manager.get_server(server_id)
            if not server:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
            if server["host"].lower() == "mock":
                is_mock = True
                
        if is_mock:
            # Return dummy ceph status for mockup testing
            return {
                "status": "success",
                "data": {
                    "health": {"status": "HEALTH_OK"},
                    "osdmap": {"num_osds": 6, "num_up_osds": 6, "num_in_osds": 6},
                    "pgmap": {
                        "bytes_used": 1509715200000, 
                        "bytes_total": 6003741824000,
                        "num_pgs": 512,
                        "data_bytes": 1400000000000
                    }
                }
            }
            
        client = ProxmoxClient(
            host=server["host"],
            port=server["port"],
            username=server["username"],
            token_name=server["token_name"],
            token_value=server["token_value"],
            verify_ssl=server.get("verify_ssl", False)
        )
        
        data = await client.get_ceph_status(node)
        if data is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch Ceph status on node {node}. Ensure Ceph is configured on the node."
            )
        return {"status": "success", "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/pools", dependencies=[Depends(require_role(["admin", "operator", "reader"]))])
async def get_ceph_pools(server_id: str, node: str):
    try:
        is_mock = False
        server = None
        
        if server_id.startswith("mock-server-"):
            is_mock = True
        else:
            server = await storage_manager.get_server(server_id)
            if not server:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
            if server["host"].lower() == "mock":
                is_mock = True
                
        if is_mock:
            return {
                "status": "success",
                "data": [
                    {"pool_name": "device_image", "size": 3, "min_size": 2, "pg_num": 128, "type": "replicated"},
                    {"pool_name": "cephfs_data", "size": 3, "min_size": 2, "pg_num": 128, "type": "replicated"},
                    {"pool_name": "cephfs_metadata", "size": 3, "min_size": 2, "pg_num": 64, "type": "replicated"}
                ]
            }
            
        client = ProxmoxClient(
            host=server["host"],
            port=server["port"],
            username=server["username"],
            token_name=server["token_name"],
            token_value=server["token_value"],
            verify_ssl=server.get("verify_ssl", False)
        )
        
        data = await client.get_ceph_pools(node)
        if data is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to fetch Ceph pools on node {node}."
            )
        return {"status": "success", "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/storage", dependencies=[Depends(require_role(["admin", "operator"]))])
async def create_ceph_storage(server_id: str, payload: CephStoragePayload):
    try:
        is_mock = False
        server = None
        
        if server_id.startswith("mock-server-"):
            is_mock = True
        else:
            server = await storage_manager.get_server(server_id)
            if not server:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Server not found")
            if server["host"].lower() == "mock":
                is_mock = True
                
        if is_mock:
            return {"status": "success", "message": f"[Mock] Ceph {payload.type.upper()} storage '{payload.storage_id}' successfully added."}
            
        client = ProxmoxClient(
            host=server["host"],
            port=server["port"],
            username=server["username"],
            token_name=server["token_name"],
            token_value=server["token_value"],
            verify_ssl=server.get("verify_ssl", False)
        )
        
        success = await client.create_ceph_storage(
            storage_id=payload.storage_id,
            storage_type=payload.type,
            monhosts=payload.monhosts,
            pool=payload.pool,
            username=payload.username,
            content=payload.content,
            nodes=payload.nodes
        )
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to register Ceph storage on Proxmox cluster."
            )
            
        return {"status": "success", "message": f"Ceph {payload.type.upper()} storage '{payload.storage_id}' added successfully."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
