from fastapi import APIRouter, HTTPException, Query, status, Depends, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Literal, Optional
import logging
import ssl
import asyncio
import websockets
from urllib.parse import quote
from app.storage import storage_manager
from app.proxmox import ProxmoxClient
from app.mock_handler import mock_handler
from app.routers.auth import require_role

class VNCProxyPayload(BaseModel):
    node: str
    type: Literal["qemu", "lxc"]


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

@router.post("/{vmid}/vncproxy", dependencies=[Depends(require_role(["admin", "operator", "reader"]))])
async def get_vnc_proxy_ticket(server_id: str, vmid: int, payload: VNCProxyPayload):
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
            return {
                "status": "success",
                "data": {
                    "ticket": f"MOCK_VNC_TICKET_{vmid}",
                    "port": 5900,
                    "cert": "mock-cert",
                    "user": "mock-user",
                    "PVEAuthCookie": f"MOCK_VNC_TICKET_{vmid}"
                }
            }

        # Real Proxmox connection
        client = ProxmoxClient(
            host=server["host"],
            port=server["port"],
            username=server["username"],
            token_name=server["token_name"],
            token_value=server["token_value"],
            verify_ssl=server.get("verify_ssl", False)
        )

        vnc_data = await client.vncproxy(payload.node, payload.type, vmid)
        if not vnc_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to generate vncproxy ticket for VMID {vmid}"
            )

        # Proxmox 8/9 vncwebsocket 연결을 위해 VNC ticket 값을 PVEAuthCookie로 복사
        vnc_data["PVEAuthCookie"] = vnc_data["ticket"]

        return {
            "status": "success",
            "data": vnc_data
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"VNC Proxy Ticket Generation Exception: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating VNC proxy: {str(e)}"
        )

@router.websocket("/{vmid}/vncwebsocket")
async def vnc_websocket_proxy(
    websocket: WebSocket,
    server_id: str,
    vmid: int,
    node: str = Query(...),
    type: str = Query(...),
    ticket: str = Query(...),
    port: int = Query(...)
):
    await websocket.accept()
    
    is_mock = False
    server = None
    
    if server_id.startswith("mock-server-"):
        is_mock = True
    else:
        server = await storage_manager.get_server(server_id)
        if server and server["host"].lower() == "mock":
            is_mock = True

    if is_mock:
        # Mock Websocket connection simulation loop to keep client connected
        try:
            while True:
                # 프론트엔드로부터 VNC 클라이언트 입력을 받음 (그냥 무시하고 가짜 응답을 보내거나 대기)
                data = await websocket.receive_bytes()
                # 간단히 Echo 또는 대기 루프 유지
                await asyncio.sleep(0.1)
        except WebSocketDisconnect:
            logger.info(f"Mock VNC websocket disconnected for VMID {vmid}")
        return

    # Real Proxmox Proxy logic
    try:
        # WebSocket 쿼리 스트림 파라미터 인코딩
        encoded_ticket = quote(ticket)
        # Proxmox vncwebsocket URL
        proxmox_ws_url = f"wss://{server['host']}:{server['port']}/api2/json/nodes/{node}/{type}/{vmid}/vncwebsocket?port={port}&vncticket={encoded_ticket}"
        
        # SSL Context 설정 (자체 서명 인증서 무시용)
        ssl_context = ssl.create_default_context()
        ssl_context.check_hostname = False
        ssl_context.verify_mode = ssl.CERT_NONE
        
        # PVEAuthCookie 헤더를 반드시 포함
        headers = {
            "Cookie": f"PVEAuthCookie={ticket}",
            "User-Agent": "FastAPI-PDM-VNC-Proxy"
        }
        
        # Proxmox 서버와 wss 연결
        async with websockets.connect(
            proxmox_ws_url,
            extra_headers=headers,
            ssl=ssl_context,
            subprotocols=["binary"]
        ) as proxmox_ws:
            
            # 양방향 포워딩 태스크 생성
            async def forward_pdm_to_proxmox():
                try:
                    while True:
                        # PDM UI -> PDM backend -> Proxmox VE
                        message = await websocket.receive_bytes()
                        await proxmox_ws.send(message)
                except Exception as e:
                    logger.debug(f"VNC Forward PDM to Proxmox stopped: {e}")

            async def forward_proxmox_to_pdm():
                try:
                    while True:
                        # Proxmox VE -> PDM backend -> PDM UI
                        message = await proxmox_ws.recv()
                        if isinstance(message, str):
                            await websocket.send_text(message)
                        else:
                            await websocket.send_bytes(message)
                except Exception as e:
                    logger.debug(f"VNC Forward Proxmox to PDM stopped: {e}")

            # 두 태스크를 동시 실행하며, 한쪽이 끝나면 양쪽 연결 정리
            await asyncio.gather(
                forward_pdm_to_proxmox(),
                forward_proxmox_to_pdm(),
                return_exceptions=True
            )
            
    except WebSocketDisconnect:
        logger.info(f"VNC Client disconnected for VMID {vmid}")
    except Exception as e:
        logger.error(f"Error in VNC WebSocket proxy for VMID {vmid}: {str(e)}", exc_info=True)
        try:
            await websocket.close(code=1011, reason=f"Proxmox proxy connection failed: {str(e)}")
        except Exception:
            pass

