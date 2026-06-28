import random
from typing import Dict, Any, List, Optional
from sqlalchemy.future import select
from app.database import AsyncSessionLocal, MockGuestTable

DEFAULT_MOCK_GUESTS = [
    {"vmid": 100, "name": "ubuntu-web-server", "node": "pve-node-01", "type": "qemu", "status": "running", "maxmem": 4194304000, "maxcpu": 4, "storage": "local-lvm", "disk_size": 32, "image": "ubuntu-22.04.4-live-server-amd64.iso"},
    {"vmid": 101, "name": "postgres-db-primary", "node": "pve-node-02", "type": "qemu", "status": "running", "maxmem": 8388608000, "maxcpu": 8, "storage": "local-lvm", "disk_size": 100, "image": "ubuntu-22.04.4-live-server-amd64.iso"},
    {"vmid": 102, "name": "nginx-ingress-lxc", "node": "pve-node-01", "type": "lxc", "status": "running", "maxmem": 1073741824, "maxcpu": 2, "storage": "local", "disk_size": 10, "image": "ubuntu-22.04-default_20221130_amd64.tar.zst"},
    {"vmid": 103, "name": "jenkins-ci-agent", "node": "pve-node-03", "type": "qemu", "status": "stopped", "maxmem": 8388608000, "maxcpu": 4, "storage": "shared-nfs", "disk_size": 50, "image": "debian-12.5.0-amd64-netinst.iso"},
    {"vmid": 104, "name": "redis-cache-cluster", "node": "pve-node-02", "type": "lxc", "status": "running", "maxmem": 2147483648, "maxcpu": 2, "storage": "local", "disk_size": 15, "image": "alpine-3.19-default_20240207_amd64.tar.xz"},
    {"vmid": 105, "name": "developer-sandbox", "node": "pve-node-03", "type": "qemu", "status": "stopped", "maxmem": 2097152000, "maxcpu": 2, "storage": "local-lvm", "disk_size": 20, "image": "debian-12.5.0-amd64-netinst.iso"}
]

class MockHandler:
    async def _get_guests(self) -> List[Dict[str, Any]]:
        async with AsyncSessionLocal() as session:
            try:
                result = await session.execute(select(MockGuestTable))
                guests = result.scalars().all()
                return [
                    {
                        "vmid": g.vmid,
                        "name": g.name,
                        "node": g.node,
                        "type": g.type,
                        "status": g.status,
                        "maxmem": g.maxmem,
                        "maxcpu": g.maxcpu,
                        "storage": g.storage,
                        "disk_size": g.disk_size,
                        "image": g.image,
                        "template": g.template,
                        "cloudinit": g.cloudinit
                    }
                    for g in guests
                ]
            except Exception as e:
                print(f"Error loading mock guests from DB: {e}")
                return []

    async def get_mock_resources(self, server_id: str = "") -> List[Dict[str, Any]]:
        # Load any status overrides from the DB
        db_guests_list = await self._get_guests()
        db_overrides = {g["vmid"]: g["status"] for g in db_guests_list}

        resources = []
        
        # Server mapping for Mock A to J
        server_map = {
            "mock-server-datacenter-id": ("mock-a", "Mock A", 0),
            "mock-server-backup-id": ("mock-b", "Mock B", 1),
            "mock-server-dev-lab-id": ("mock-c", "Mock C", 2),
            "mock-server-test-qa-id": ("mock-d", "Mock D", 3),
            "mock-server-staging-id": ("mock-e", "Mock E", 4),
            "mock-server-prod-web-id": ("mock-f", "Mock F", 5),
            "mock-server-prod-db-id": ("mock-g", "Mock G", 6),
            "mock-server-prod-storage-id": ("mock-h", "Mock H", 7),
            "mock-server-ai-gpu-id": ("mock-i", "Mock I", 8),
            "mock-server-dr-id": ("mock-j", "Mock J", 9)
        }
        
        prefix, name_label, s_index = server_map.get(server_id, ("mock-a", "Mock A", 0))

        # 1. Add Mock Nodes (3 nodes per server)
        for n_index in range(1, 4):
            node_name = f"{prefix}-node-0{n_index}"
            maxcpu = 32 if n_index == 2 else 16
            maxmem_gb = 128 if n_index == 2 else 64
            maxdisk_gb = 1024 if n_index == 2 else 512
            
            cpu_usage = random.uniform(0.1, 0.5)
            mem_used_gb = maxmem_gb * random.uniform(0.3, 0.7)
            disk_used_gb = maxdisk_gb * random.uniform(0.2, 0.6)
            
            resources.append({
                "type": "node",
                "node": node_name,
                "status": "online",
                "cpu": round(cpu_usage, 4),
                "maxcpu": maxcpu,
                "mem": int(mem_used_gb * (1024**3)),
                "maxmem": int(maxmem_gb * (1024**3)),
                "disk": int(disk_used_gb * (1024**3)),
                "maxdisk": int(maxdisk_gb * (1024**3)),
                "uptime": random.randint(86400, 2592000)
            })

        # 2. Add Guests (20 VMs per node * 3 nodes = 60 guests per server)
        for n_index in range(1, 4):
            node_name = f"{prefix}-node-0{n_index}"
            for g_index in range(1, 21):
                # Unique VMID
                vmid = (s_index + 1) * 1000 + n_index * 100 + g_index
                
                # Check DB override
                db_status = db_overrides.get(vmid)
                if db_status == "deleted":
                    # Filter out deleted guest
                    continue
                
                guest_type = "qemu" if g_index % 2 != 0 else "lxc"
                status = db_status if db_status else ("running" if g_index % 4 != 0 else "stopped")
                
                name_prefix = "ubuntu-web" if guest_type == "qemu" else "alpine-lxc"
                guest_name = f"{prefix}-{name_prefix}-{vmid}"
                
                maxcpu = 2 if guest_type == "lxc" else 4
                maxmem_mb = 1024 if guest_type == "lxc" else 4096
                disk_size_gb = 10 if guest_type == "lxc" else 40
                
                guest_res = {
                    "vmid": vmid,
                    "name": guest_name,
                    "node": node_name,
                    "type": guest_type,
                    "status": status,
                    "maxcpu": maxcpu,
                    "maxmem": maxmem_mb * 1024 * 1024,
                    "disk_size": disk_size_gb,
                    "image": "ubuntu-22.04.4-live-server-amd64.iso" if guest_type == "qemu" else "alpine-3.19-default_20240207_amd64.tar.xz",
                    "template": 0
                }
                
                if status == "running":
                    guest_res["cpu"] = round(random.uniform(0.01, 0.12), 4)
                    guest_res["mem"] = int(guest_res["maxmem"] * random.uniform(0.3, 0.8))
                    guest_res["disk"] = int(guest_res["disk_size"] * (1024**3) * random.uniform(0.4, 0.7))
                    guest_res["maxdisk"] = int(guest_res["disk_size"] * (1024**3))
                    guest_res["uptime"] = random.randint(10000, 600000)
                else:
                    guest_res["cpu"] = 0.0
                    guest_res["mem"] = 0
                    guest_res["disk"] = 0
                    guest_res["maxdisk"] = int(guest_res["disk_size"] * (1024**3))
                    guest_res["uptime"] = 0
                
                resources.append(guest_res)

        # 3. Add Storage
        for n_index in range(1, 4):
            node_name = f"{prefix}-node-0{n_index}"
            resources.extend([
                {"type": "storage", "storage": f"{prefix}-local", "node": node_name, "disk": int(20 * (1024**3)), "maxdisk": int(100 * (1024**3)), "content": "iso,vztmpl,backup"},
                {"type": "storage", "storage": f"{prefix}-local-lvm", "node": node_name, "disk": int(120 * (1024**3)), "maxdisk": int(400 * (1024**3)), "content": "images,rootdir"},
                {"type": "storage", "storage": f"{prefix}-ceph-rbd", "node": node_name, "disk": int(450 * (1024**3)), "maxdisk": int(2000 * (1024**3)), "content": "images,rootdir"}
            ])
        
        return resources

    async def create_guest(self, node: str, vmid: int, name: str, guest_type: str, cores: int, memory_mb: int, storage: str, disk_size_gb: int, image: str, cloudinit: Optional[Dict[str, Any]] = None, template: int = 0) -> Dict[str, Any]:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                result = await session.execute(select(MockGuestTable).filter_by(vmid=vmid))
                existing = result.scalar_one_or_none()
                if existing:
                    raise ValueError(f"VMID {vmid} already exists in the cluster.")

                new_guest = MockGuestTable(
                    vmid=vmid,
                    name=name,
                    node=node,
                    type=guest_type,
                    status="stopped",
                    maxmem=memory_mb * 1024 * 1024,
                    maxcpu=cores,
                    storage=storage,
                    disk_size=disk_size_gb,
                    image=image,
                    template=template,
                    cloudinit=cloudinit
                )
                session.add(new_guest)
                
        return {
            "vmid": vmid,
            "name": name,
            "node": node,
            "type": guest_type,
            "status": "stopped",
            "maxmem": memory_mb * 1024 * 1024,
            "maxcpu": cores,
            "storage": storage,
            "disk_size": disk_size_gb,
            "image": image,
            "template": template,
            "cloudinit": cloudinit
        }

    async def update_guest_status(self, vmid: int, action: str) -> bool:
        print(f"[MOCK_DEBUG] update_guest_status: vmid={vmid}, action={action}", flush=True)
        async with AsyncSessionLocal() as session:
            async with session.begin():
                result = await session.execute(select(MockGuestTable).filter_by(vmid=vmid))
                guest = result.scalar_one_or_none()
                
                target_status = "running"
                if action in ["stop", "shutdown"]:
                    target_status = "stopped"
                elif action == "reboot":
                    target_status = "running"
                
                print(f"[MOCK_DEBUG] target_status={target_status}, guest_exists={guest is not None}", flush=True)
                if guest:
                    print(f"[MOCK_DEBUG] Existing status was: {guest.status}", flush=True)
                    guest.status = target_status
                else:
                    new_guest = MockGuestTable(
                        vmid=vmid,
                        name=f"guest-{vmid}",
                        node="unknown",
                        type="qemu",
                        status=target_status,
                        maxmem=4096 * 1024 * 1024,
                        maxcpu=4,
                        storage="local",
                        disk_size=40,
                        image=""
                    )
                    session.add(new_guest)
                print(f"[MOCK_DEBUG] Saved successfully to DB.", flush=True)
                return True

    async def delete_guest(self, vmid: int) -> bool:
        print(f"[MOCK_DEBUG] delete_guest: vmid={vmid}", flush=True)
        async with AsyncSessionLocal() as session:
            async with session.begin():
                result = await session.execute(select(MockGuestTable).filter_by(vmid=vmid))
                guest = result.scalar_one_or_none()
                print(f"[MOCK_DEBUG] guest_exists={guest is not None}", flush=True)
                if guest:
                    print(f"[MOCK_DEBUG] Existing status was: {guest.status}", flush=True)
                    guest.status = "deleted"
                else:
                    new_guest = MockGuestTable(
                        vmid=vmid,
                        name=f"guest-{vmid}",
                        node="unknown",
                        type="qemu",
                        status="deleted",
                        maxmem=0,
                        maxcpu=0,
                        storage="local",
                        disk_size=0,
                        image=""
                    )
                    session.add(new_guest)
                print(f"[MOCK_DEBUG] Saved successfully as deleted to DB.", flush=True)
                return True

mock_handler = MockHandler()
