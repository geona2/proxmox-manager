from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from app.storage import storage_manager, ProxmoxServerSchema
from app.routers.auth import require_role

router = APIRouter(prefix="/api/servers", tags=["servers"])

@router.get("", response_model=List[ProxmoxServerSchema], dependencies=[Depends(require_role(["admin", "operator", "reader"]))])
async def list_servers():
    try:
        return await storage_manager.get_all_servers()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list servers: {str(e)}"
        )

@router.post("", response_model=ProxmoxServerSchema, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_role(["admin"]))])
async def create_server(server: ProxmoxServerSchema):
    try:
        # Create server entry in JSON database
        return await storage_manager.add_server(server)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add server: {str(e)}"
        )

@router.put("/{server_id}", response_model=ProxmoxServerSchema, dependencies=[Depends(require_role(["admin"]))])
async def update_server(server_id: str, server: ProxmoxServerSchema):
    try:
        updated = await storage_manager.update_server(server_id, server)
        if not updated:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Server with ID {server_id} not found"
            )
        return updated
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update server: {str(e)}"
        )

@router.delete("/{server_id}", dependencies=[Depends(require_role(["admin"]))])
async def delete_server(server_id: str):
    try:
        deleted = await storage_manager.delete_server(server_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Server with ID {server_id} not found"
            )
        return {"status": "success", "message": "Server deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete server: {str(e)}"
        )
