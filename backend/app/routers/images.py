import os
import logging
from typing import Literal, List
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Request, status, Depends
from pydantic import BaseModel
from sqlalchemy.future import select
from app.routers.auth import require_role
from app.storage import storage_manager
from app.proxmox import ProxmoxClient
from app.database import AsyncSessionLocal, ImageTable
from app.config import settings

router = APIRouter(prefix="/api/images", tags=["images"])
logger = logging.getLogger(__name__)

UPLOAD_DIR = settings.UPLOAD_DIR

class ImageModel(BaseModel):
    id: str
    name: str
    type: Literal["iso", "vztmpl"]
    url: str
    size_gb: float

class DownloadImagePayload(BaseModel):
    image_id: str

@router.get("", response_model=List[ImageModel], dependencies=[Depends(require_role(["admin", "operator", "reader"]))])
async def list_images():
    async with AsyncSessionLocal() as session:
        try:
            result = await session.execute(select(ImageTable))
            images = result.scalars().all()
            return [
                {
                    "id": img.id,
                    "name": img.name,
                    "type": img.type,
                    "url": img.url,
                    "size_gb": img.size_gb
                }
                for img in images
            ]
        except Exception as e:
            logger.error(f"Error listing images from DB: {e}")
            return []

@router.post("/upload", response_model=ImageModel, dependencies=[Depends(require_role(["admin", "operator"]))])
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    image_type: Literal["iso", "vztmpl"] = Form(...)
):
    try:
        # Create upload directory if not exists
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        
        filename = file.filename
        if not filename:
            raise HTTPException(status_code=400, detail="Invalid filename")
            
        file_path = os.path.join(UPLOAD_DIR, filename)
        
        # Save file to disk
        contents = await file.read()
        with open(file_path, "wb") as f:
            f.write(contents)
            
        size_bytes = len(contents)
        size_gb = round(size_bytes / (1024**3), 3)
        if size_gb == 0.0:
            size_gb = 0.001  # minimum display size
            
        # Register in database
        image_id = filename.lower().replace(".", "-").replace(" ", "-")
        
        # Build URL dynamically
        base_url = str(request.base_url)
        url = f"{base_url}static/images/{filename}"
        
        async with AsyncSessionLocal() as session:
            async with session.begin():
                result = await session.execute(select(ImageTable).filter_by(id=image_id))
                existing = result.scalar_one_or_none()
                if existing:
                    await session.delete(existing)
                    
                new_image = ImageTable(
                    id=image_id,
                    name=filename,
                    type=image_type,
                    url=url,
                    size_gb=size_gb
                )
                session.add(new_image)
        
        return {
            "id": image_id,
            "name": filename,
            "type": image_type,
            "url": url,
            "size_gb": size_gb
        }
    except Exception as e:
        logger.error(f"Error uploading file: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload image: {str(e)}"
        )

@router.post("/distribute/{server_id}/{node}/{storage_id}", dependencies=[Depends(require_role(["admin", "operator"]))])
async def distribute_image(
    server_id: str,
    node: str,
    storage_id: str,
    payload: DownloadImagePayload
):
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(ImageTable).filter_by(id=payload.image_id))
            image = result.scalar_one_or_none()
            
        if not image:
            raise HTTPException(status_code=404, detail="Image not found in local catalog")
            
        is_mock = False
        server = None
        
        if server_id.startswith("mock-server-"):
            is_mock = True
        else:
            server = await storage_manager.get_server(server_id)
            if not server:
                raise HTTPException(status_code=404, detail=f"Server with ID {server_id} not found")
            if server["host"].lower() == "mock":
                is_mock = True
                
        if is_mock:
            return {"status": "success", "message": f"[Mock] Triggered Proxmox download for image '{image.name}' to storage '{storage_id}' on node '{node}'"}
            
        client = ProxmoxClient(
            host=server["host"],
            port=server["port"],
            username=server["username"],
            token_name=server["token_name"],
            token_value=server["token_value"],
            verify_ssl=server.get("verify_ssl", False)
        )
        
        # Trigger Proxmox download
        success = await client.download_image_from_url(
            node=node,
            storage=storage_id,
            content=image.type,
            filename=image.name,
            url=image.url
        )
        
        if not success:
            raise HTTPException(
                status_code=400,
                detail=f"Proxmox server failed to start download for image {image.name}"
            )
            
        return {"status": "success", "message": f"Proxmox started downloading image {image.name}"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error distributing image: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to trigger image download on Proxmox: {str(e)}"
        )

class CreateTemplatePayload(BaseModel):
    server_id: str
    node: str
    vmid: int
    name: str
    storage: str
    template_os: Literal["ubuntu22.04", "ubuntu24.04", "rhel8", "rhel9"]
    iso_image: str

@router.post("/create-template", dependencies=[Depends(require_role(["admin", "operator"]))])
async def create_template(payload: CreateTemplatePayload):
    try:
        is_mock = False
        server = None
        
        if payload.server_id.startswith("mock-server-"):
            is_mock = True
        else:
            server = await storage_manager.get_server(payload.server_id)
            if not server:
                raise HTTPException(status_code=404, detail=f"Server with ID {payload.server_id} not found")
            if server["host"].lower() == "mock":
                is_mock = True
                
        if is_mock:
            from app.mock_handler import mock_handler
            await mock_handler.create_guest(
                node=payload.node,
                vmid=payload.vmid,
                name=payload.name,
                guest_type="qemu",
                cores=2,
                memory_mb=2048,
                storage=payload.storage,
                disk_size_gb=20,
                image=payload.iso_image,
                cloudinit={"enabled": True, "ciuser": "root", "sshkeys": "", "ipconfig0": "ip=dhcp"},
                template=1
            )
            return {"status": "success", "message": f"[Mock] Template VM '{payload.name}' created and converted to template."}
            
        client = ProxmoxClient(
            host=server["host"],
            port=server["port"],
            username=server["username"],
            token_name=server["token_name"],
            token_value=server["token_value"],
            verify_ssl=server.get("verify_ssl", False)
        )
        
        iso_path = payload.iso_image
        if ":" not in iso_path:
            iso_path = f"local:iso/{iso_path}"
            
        create_success = await client.create_qemu_vm(
            node=payload.node,
            vmid=payload.vmid,
            name=payload.name,
            cores=2,
            memory=2048,
            storage=payload.storage,
            disk_size=20,
            iso_image=iso_path
        )
        if not create_success:
            raise HTTPException(status_code=400, detail="Failed to create VM on Proxmox")
            
        config_success = await client.configure_cloudinit(
            node=payload.node,
            vmid=payload.vmid,
            ciuser="root",
            cipassword="Password123!",
            sshkeys=None,
            ipconfig0="ip=dhcp",
            storage=payload.storage
        )
        if not config_success:
            logger.warning(f"VM template shell created, but cloudinit configuration failed for VMID {payload.vmid}")
            
        template_success = await client.convert_to_template(payload.node, payload.vmid)
        if not template_success:
            raise HTTPException(status_code=400, detail="Failed to convert VM to template on Proxmox")
            
        return {"status": "success", "message": f"Successfully created cloud-init template '{payload.name}' (VMID {payload.vmid}) on Proxmox."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating template: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create template: {str(e)}"
        )
