import httpx
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class ProxmoxClient:
    def __init__(self, host: str, port: int, username: str, token_name: str, token_value: str, verify_ssl: bool = False):
        self.base_url = f"https://{host}:{port}/api2/json"
        # Proxmox API Token header format: PVEAPIToken=USER@REALM!TOKENID=VALUE
        self.headers = {
            "Authorization": f"PVEAPIToken={username}!{token_name}={token_value}",
            "Accept": "application/json"
        }
        self.verify_ssl = verify_ssl

    async def _request(self, method: str, path: str, params: Optional[Dict[str, Any]] = None, data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        # All Proxmox API calls must have Try-Catch as per DESIGN.md
        try:
            url = f"{self.base_url}/{path.lstrip('/')}"
            async with httpx.AsyncClient(verify=self.verify_ssl, timeout=2.0) as client:
                if method.upper() == "GET":
                    response = await client.get(url, headers=self.headers, params=params)
                elif method.upper() == "POST":
                    response = await client.post(url, headers=self.headers, json=data)
                elif method.upper() == "PUT":
                    response = await client.put(url, headers=self.headers, json=data)
                elif method.upper() == "DELETE":
                    response = await client.delete(url, headers=self.headers)
                else:
                    logger.error(f"Unsupported HTTP method: {method}")
                    return None
                
                if response.status_code in [200, 201, 202]:
                    return response.json()
                else:
                    logger.error(f"Proxmox API error: URL={url}, Status={response.status_code}, Body={response.text}")
                    return None
        except Exception as e:
            logger.error(f"Exception during Proxmox API call to {path}: {str(e)}", exc_info=True)
            return None

    async def get_cluster_resources(self) -> Optional[List[Dict[str, Any]]]:
        # Fetch all resources in a single call (nodes, vms, lxc, storage)
        result = await self._request("GET", "cluster/resources")
        if result and "data" in result:
            return result["data"]
        return None

    async def get_nodes(self) -> Optional[List[Dict[str, Any]]]:
        result = await self._request("GET", "nodes")
        if result and "data" in result:
            return result["data"]
        return None

    async def get_node_status(self, node: str) -> Optional[Dict[str, Any]]:
        result = await self._request("GET", f"nodes/{node}/status")
        if result and "data" in result:
            return result["data"]
        return None

    async def get_node_qemu(self, node: str) -> Optional[List[Dict[str, Any]]]:
        result = await self._request("GET", f"nodes/{node}/qemu")
        if result and "data" in result:
            return result["data"]
        return None

    async def get_node_lxc(self, node: str) -> Optional[List[Dict[str, Any]]]:
        result = await self._request("GET", f"nodes/{node}/lxc")
        if result and "data" in result:
            return result["data"]
        return None

    async def set_vm_status(self, node: str, guest_type: str, vmid: int, action: str) -> bool:
        # guest_type is either 'qemu' or 'lxc'
        # action is 'start', 'stop', 'shutdown', 'reboot'
        path = f"nodes/{node}/{guest_type}/{vmid}/status/{action}"
        result = await self._request("POST", path)
        return result is not None

    async def delete_vm(self, node: str, guest_type: str, vmid: int) -> bool:
        # guest_type is 'qemu' or 'lxc'
        path = f"nodes/{node}/{guest_type}/{vmid}"
        result = await self._request("DELETE", path)
        return result is not None

    async def download_image_from_url(self, node: str, storage: str, content: str, filename: str, url: str) -> bool:
        # content can be 'iso' or 'vztmpl'
        path = f"nodes/{node}/storage/{storage}/download-url"
        data = {
            "content": content,
            "filename": filename,
            "url": url
        }
        result = await self._request("POST", path, data=data)
        return result is not None

    async def create_qemu_vm(self, node: str, vmid: int, name: str, cores: int, memory: int, storage: str, disk_size: int, iso_image: Optional[str] = None) -> bool:
        path = f"nodes/{node}/qemu"
        data = {
            "vmid": vmid,
            "name": name,
            "cores": cores,
            "memory": memory,
            "sockets": 1,
            "ostype": "l26",
            "scsihw": "virtio-scsi-pci",
            "scsi0": f"{storage}:{disk_size}",
        }
        if iso_image:
            if ":" in iso_image:
                data["ide2"] = f"{iso_image},media=cdrom"
            else:
                data["ide2"] = f"local:iso/{iso_image},media=cdrom"
        result = await self._request("POST", path, data=data)
        return result is not None

    async def create_lxc_container(self, node: str, vmid: int, name: str, cores: int, memory: int, storage: str, disk_size: int, template_image: str, password: Optional[str] = None) -> bool:
        path = f"nodes/{node}/lxc"
        ostemplate = template_image
        if ":" not in ostemplate:
            ostemplate = f"local:vztmpl/{template_image}"
        
        data = {
            "vmid": vmid,
            "hostname": name,
            "cores": cores,
            "memory": memory,
            "swap": 512,
            "ostemplate": ostemplate,
            "rootfs": f"{storage}:{disk_size}",
            "net0": "name=eth0,bridge=vmbr0,ip=dhcp"
        }
        if password:
            data["password"] = password
        else:
            data["password"] = "DefaultMockPass123!"
            
        result = await self._request("POST", path, data=data)
        return result is not None

    async def configure_cloudinit(self, node: str, vmid: int, ciuser: Optional[str], cipassword: Optional[str], sshkeys: Optional[str], ipconfig0: Optional[str], storage: str) -> bool:
        path = f"nodes/{node}/qemu/{vmid}/config"
        data = {
            "ide3": f"{storage}:cloudinit",
        }
        if ciuser:
            data["ciuser"] = ciuser
        if cipassword:
            data["cipassword"] = cipassword
        if sshkeys:
            data["sshkeys"] = sshkeys
        if ipconfig0:
            data["ipconfig0"] = ipconfig0
            
        result = await self._request("POST", path, data=data)
        return result is not None

    async def convert_to_template(self, node: str, vmid: int) -> bool:
        path = f"nodes/{node}/qemu/{vmid}/template"
        result = await self._request("POST", path)
        return result is not None

    async def get_ceph_status(self, node: str) -> Optional[Dict[str, Any]]:
        result = await self._request("GET", f"nodes/{node}/ceph/status")
        if result and "data" in result:
            return result["data"]
        return None

    async def get_ceph_pools(self, node: str) -> Optional[List[Dict[str, Any]]]:
        result = await self._request("GET", f"nodes/{node}/ceph/pools")
        if result and "data" in result:
            return result["data"]
        return None

    async def create_ceph_storage(self, storage_id: str, storage_type: str, monhosts: str, pool: str, username: str, content: str, nodes: Optional[str] = None) -> bool:
        data = {
            "storage": storage_id,
            "type": storage_type,
            "monhosts": monhosts,
            "content": content,
        }
        if storage_type == "rbd":
            data["pool"] = pool
            data["username"] = username
            data["krbd"] = 1
        if nodes:
            data["nodes"] = nodes
            
        result = await self._request("POST", "storage", data=data)
        return result is not None

    async def vncproxy(self, node: str, guest_type: str, vmid: int) -> Optional[Dict[str, Any]]:
        path = f"nodes/{node}/{guest_type}/{vmid}/vncproxy"
        data = {
            "websocket": 1,
            "generate-password": 1
        }
        result = await self._request("POST", path, data=data)
        if result and "data" in result:
            return result["data"]
        return None

