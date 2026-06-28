from fastapi import APIRouter, HTTPException, Query, status, Depends
from pydantic import BaseModel
from typing import Literal, Optional
import logging
from app.storage import storage_manager
from app.proxmox import ProxmoxClient
from app.mock_handler import mock_handler
from app.routers.auth import require_role

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/servers/{server_id}/vms", tags=["vms"])

class VMStatusPayload(BaseModel):
    node: str
    type: Literal["qemu", "lxc"]
    action: Literal["start", "stop", "shutdown", "reboot"]

class CloudInitConfig(BaseModel):
    enabled: bool = False
    ciuser: Optional[str] = None
    cipassword: Optional[str] = None
    sshkeys: Optional[str] = None
    ipconfig0: Optional[str] = None

class CreateVMPayload(BaseModel):
    node: str
    vmid: int
    name: str
    type: Literal["qemu", "lxc"]
    cores: int
    memory: int  # in MB
    storage: str
    disk_size: int  # in GB
    image: str
    cloudinit: Optional[CloudInitConfig] = None

@router.post("/{vmid}/status", dependencies=[Depends(require_role(["admin", "operator"]))])
async def change_vm_status(server_id: str, vmid: int, payload: VMStatusPayload):
    try:
        is_mock = False
        server = None
        
        # Intercept if it's a mock server (all mock server IDs start with 'mock-server-')
        if server_id.startswith("mock-server-"):
            is_mock = True
        else:
            server = await storage_manager.get_server(server_id)
            if not server:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Server with ID {server_id} not found"
                )
            if server["host"].lower() == "mock":
                is_mock = True

        if is_mock:
            # Handle stateful power toggle locally on mock data
            success = await mock_handler.update_guest_status(vmid, payload.action)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to find mock guest with VMID {vmid}"
                )
            return {"status": "success", "message": f"Mock action '{payload.action}' executed successfully"}

        # Real Proxmox connection
        client = ProxmoxClient(
            host=server["host"],
            port=server["port"],
            username=server["username"],
            token_name=server["token_name"],
            token_value=server["token_value"],
            verify_ssl=server.get("verify_ssl", False)
        )

        success = await client.set_vm_status(payload.node, payload.type, vmid, payload.action)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to initiate action '{payload.action}' on VM/CT {vmid}"
            )

        return {"status": "success", "message": f"Action '{payload.action}' requested successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error executing VM action: {str(e)}"
        )

@router.delete("/{vmid}", dependencies=[Depends(require_role(["admin"]))])
async def delete_vm(
    server_id: str,
    vmid: int,
    node: str = Query(..., description="Node name"),
    type: Literal["qemu", "lxc"] = Query(..., description="Guest type"),
    confirm_name: str = Query(..., description="VM name for double-confirmation")
):
    try:
        # Backend confirmation check as security defense in depth
        if not confirm_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Confirmation name is required for deletion"
            )

        is_mock = False
        server = None
        
        # Intercept if it's a mock server
        if server_id.startswith("mock-server-"):
            is_mock = True
        else:
            server = await storage_manager.get_server(server_id)
            if not server:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Server with ID {server_id} not found"
                )
            if server["host"].lower() == "mock":
                is_mock = True

        if is_mock:
            # Stateful delete locally on mock data
            success = await mock_handler.delete_guest(vmid)
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to delete mock guest with VMID {vmid}"
                )
            return {"status": "success", "message": f"Mock guest {vmid} deleted successfully"}

        # Real Proxmox connection
        client = ProxmoxClient(
            host=server["host"],
            port=server["port"],
            username=server["username"],
            token_name=server["token_name"],
            token_value=server["token_value"],
            verify_ssl=server.get("verify_ssl", False)
        )

        # Apply try-catch for all Proxmox calls
        success = await client.delete_vm(node, type, vmid)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to delete VM/CT {vmid} on node {node}. Ensure it is stopped first."
            )

        return {"status": "success", "message": f"VM/CT {vmid} deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting VM: {str(e)}"
        )

@router.post("", dependencies=[Depends(require_role(["admin", "operator"]))])
async def create_vm(server_id: str, payload: CreateVMPayload):
    try:
        is_mock = False
        server = None
        
        if server_id.startswith("mock-server-"):
            is_mock = True
        else:
            server = await storage_manager.get_server(server_id)
            if not server:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Server with ID {server_id} not found"
                )
            if server["host"].lower() == "mock":
                is_mock = True

        if is_mock:
            # Stateful create locally on mock data
            cloudinit_dict = None
            if payload.cloudinit:
                cloudinit_dict = payload.cloudinit.model_dump()
            try:
                new_guest = await mock_handler.create_guest(
                    node=payload.node,
                    vmid=payload.vmid,
                    name=payload.name,
                    guest_type=payload.type,
                    cores=payload.cores,
                    memory_mb=payload.memory,
                    storage=payload.storage,
                    disk_size_gb=payload.disk_size,
                    image=payload.image,
                    cloudinit=cloudinit_dict
                )
                return {"status": "success", "message": f"Mock guest {payload.name} (VMID {payload.vmid}) created successfully", "data": new_guest}
            except ValueError as ve:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(ve)
                )

        # Real Proxmox connection
        client = ProxmoxClient(
            host=server["host"],
            port=server["port"],
            username=server["username"],
            token_name=server["token_name"],
            token_value=server["token_value"],
            verify_ssl=server.get("verify_ssl", False)
        )

        if payload.type == "qemu":
            success = await client.create_qemu_vm(
                node=payload.node,
                vmid=payload.vmid,
                name=payload.name,
                cores=payload.cores,
                memory=payload.memory,
                storage=payload.storage,
                disk_size=payload.disk_size,
                iso_image=payload.image
            )
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to create VM {payload.name} (VMID {payload.vmid}) on Proxmox"
                )
                
            # If QEMU and Cloud-Init config is enabled, write config
            if payload.cloudinit and payload.cloudinit.enabled:
                ci_success = await client.configure_cloudinit(
                    node=payload.node,
                    vmid=payload.vmid,
                    ciuser=payload.cloudinit.ciuser,
                    cipassword=payload.cloudinit.cipassword,
                    sshkeys=payload.cloudinit.sshkeys,
                    ipconfig0=payload.cloudinit.ipconfig0,
                    storage=payload.storage
                )
                if not ci_success:
                    logger.warning(f"VM created, but Cloud-Init configuration failed for VMID {payload.vmid}")
                    
        elif payload.type == "lxc":
            success = await client.create_lxc_container(
                node=payload.node,
                vmid=payload.vmid,
                name=payload.name,
                cores=payload.cores,
                memory=payload.memory,
                storage=payload.storage,
                disk_size=payload.disk_size,
                template_image=payload.image,
                password=payload.cloudinit.cipassword if (payload.cloudinit and payload.cloudinit.cipassword) else None
            )
            if not success:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Failed to create Container {payload.name} (VMID {payload.vmid}) on Proxmox"
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown guest type '{payload.type}'"
            )

        return {"status": "success", "message": f"Guest {payload.name} (VMID {payload.vmid}) created successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating guest: {str(e)}"
        )
