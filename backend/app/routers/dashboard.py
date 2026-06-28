import asyncio
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, Any, List
from app.storage import storage_manager
from app.proxmox import ProxmoxClient
from app.mock_handler import mock_handler
from app.routers.auth import require_role

router = APIRouter(prefix="/api/proxmox/dashboard", tags=["dashboard"])

async def fetch_single_server_dashboard(server: Dict[str, Any]) -> Dict[str, Any]:
    server_info = {
        "id": server["id"],
        "name": server["name"],
        "host": server["host"],
        "port": server.get("port", 8006),
        "status": "offline",
        "nodes": [],
        "guests": [],
        "storages": [],
        "cpu_overcommit_ratio": server.get("cpu_overcommit_ratio", 100),
        "cpu_virtualization": {
            "total_physical_cores": 0,
            "max_virtual_cores": 0.0,
            "allocated_cores": 0,
            "utilization_pct": 0.0
        },
        "resources": {
            "cpu_usage_pct": 0.0,
            "memory_used_gb": 0.0,
            "memory_total_gb": 0.0,
            "memory_usage_pct": 0.0,
            "memory_allocated_gb": 0.0,
            "memory_allocated_pct": 0.0,
            "storage_used_gb": 0.0,
            "storage_total_gb": 0.0,
            "storage_usage_pct": 0.0,
            "storage_allocated_gb": 0.0,
            "storage_allocated_pct": 0.0
        },
        "summary": {
            "total_nodes": 0,
            "online_nodes": 0,
            "total_guests": 0,
            "running_guests": 0,
            "stopped_guests": 0
        }
    }
    
    # Try-Catch for Proxmox API calls is mandatory per DESIGN.md
    try:
        # Check if the host is configured for "mock" testing
        if server["host"].lower() == "mock":
            resources = await mock_handler.get_mock_resources(server["id"])
        else:
            client = ProxmoxClient(
                host=server["host"],
                port=server["port"],
                username=server["username"],
                token_name=server["token_name"],
                token_value=server["token_value"],
                verify_ssl=server.get("verify_ssl", False)
            )
            resources = await client.get_cluster_resources()
            
        if resources is None:
            return server_info

        server_info["status"] = "online"
        
        total_mem = 0
        used_mem = 0
        total_cpu = 0.0
        used_cpu = 0.0
        total_disk = 0
        used_disk = 0
        allocated_cores = 0
        allocated_memory_bytes = 0
        allocated_disk_bytes = 0

        for res in resources:
            res_type = res.get("type")
            if res_type == "node":
                server_info["summary"]["total_nodes"] += 1
                if res.get("status") == "online":
                    server_info["summary"]["online_nodes"] += 1

                node_cpu_raw = res.get("cpu")
                node_cpu = node_cpu_raw if node_cpu_raw is not None else 0.0
                node_mem = res.get("mem") or 0
                node_maxmem = res.get("maxmem") or 1
                node_maxcpu = res.get("maxcpu") or 1

                server_info["nodes"].append({
                    "name": res.get("node") or res.get("name"),
                    "status": res.get("status"),
                    "cpu_usage_pct": round(node_cpu * 100.0, 2),
                    "memory_usage_pct": round((node_mem / max(node_maxmem, 1)) * 100.0, 2),
                    "uptime": res.get("uptime", 0)
                })
                
                # Sum node capacities
                total_mem += (res.get("maxmem") or 0)
                used_mem += (res.get("mem") or 0)
                total_cpu += node_maxcpu
                used_cpu += (node_cpu * node_maxcpu)

            elif res_type in ["qemu", "lxc"]:
                server_info["summary"]["total_guests"] += 1
                status = res.get("status", "stopped")
                if status == "running":
                    server_info["summary"]["running_guests"] += 1
                else:
                    server_info["summary"]["stopped_guests"] += 1

                # Sum guest cores
                allocated_cores += (res.get("maxcpu") or 1)
                allocated_memory_bytes += (res.get("maxmem") or 0)
                allocated_disk_bytes += (res.get("maxdisk") or 0)

                guest_cpu_raw = res.get("cpu")
                guest_cpu = guest_cpu_raw if guest_cpu_raw is not None else 0.0
                guest_mem = res.get("mem") or 0
                guest_maxmem = res.get("maxmem") or 1

                server_info["guests"].append({
                    "vmid": res.get("vmid"),
                    "name": res.get("name", "unknown"),
                    "node": res.get("node"),
                    "type": res_type,
                    "status": status,
                    "cpu_usage_pct": round(guest_cpu * 100.0, 2),
                    "memory_usage_pct": round((guest_mem / max(guest_maxmem, 1)) * 100.0, 2),
                    "mem_used_mb": round(guest_mem / (1024 * 1024), 1),
                    "mem_max_mb": round(guest_maxmem / (1024 * 1024), 1),
                    "uptime": res.get("uptime", 0),
                    "cloudinit": res.get("cloudinit")
                })

            elif res_type == "storage":
                total_disk += res.get("maxdisk", 0)
                used_disk += res.get("disk", 0)
                server_info["storages"].append({
                    "name": res.get("storage") or res.get("name") or "local",
                    "node": res.get("node"),
                    "total_gb": round(res.get("maxdisk", 0) / (1024**3), 2),
                    "used_gb": round(res.get("disk", 0) / (1024**3), 2),
                    "content": res.get("content", "images")
                })

        # Calculate metrics for this server
        server_info["resources"]["memory_used_gb"] = round(used_mem / (1024**3), 2)
        server_info["resources"]["memory_total_gb"] = round(total_mem / (1024**3), 2)
        server_info["resources"]["memory_usage_pct"] = round((used_mem / max(total_mem, 1)) * 100.0, 2)
        
        server_info["resources"]["memory_allocated_gb"] = round(allocated_memory_bytes / (1024**3), 2)
        server_info["resources"]["memory_allocated_pct"] = round((allocated_memory_bytes / max(total_mem, 1)) * 100.0, 2)
        
        server_info["resources"]["cpu_usage_pct"] = round((used_cpu / max(total_cpu, 1.0)) * 100.0, 2)
        
        server_info["resources"]["storage_used_gb"] = round(used_disk / (1024**3), 2)
        server_info["resources"]["storage_total_gb"] = round(total_disk / (1024**3), 2)
        server_info["resources"]["storage_usage_pct"] = round((used_disk / max(total_disk, 1)) * 100.0, 2)
        
        server_info["resources"]["storage_allocated_gb"] = round(allocated_disk_bytes / (1024**3), 2)
        server_info["resources"]["storage_allocated_pct"] = round((allocated_disk_bytes / max(total_disk, 1)) * 100.0, 2)

        # CPU virtualization stats
        cpu_overcommit_ratio = server.get("cpu_overcommit_ratio", 100)
        total_physical_cores = int(total_cpu)
        max_virtual_cores = total_physical_cores * (cpu_overcommit_ratio / 100.0)
        utilization_pct = round((allocated_cores / max(max_virtual_cores, 1.0)) * 100.0, 2)

        server_info["cpu_virtualization"] = {
            "total_physical_cores": total_physical_cores,
            "max_virtual_cores": round(max_virtual_cores, 1),
            "allocated_cores": allocated_cores,
            "utilization_pct": utilization_pct
        }

    except Exception as e:
        # Gracefully handle server failure
        server_info["status"] = "error"
        server_info["error_detail"] = str(e)

    return server_info

@router.get("", dependencies=[Depends(require_role(["admin", "operator", "reader"]))])
async def get_dashboard_summary():
    try:
        servers = await storage_manager.get_all_servers()
        
        # If no servers registered, create default Mock Servers so the dashboard isn't blank (only in development)
        if not servers:
            from app.config import settings
            if settings.APP_ENV == "development":
                servers = [
                    {
                        "id": "mock-server-datacenter-id",
                        "name": "Primary Enterprise Cluster (Mock A)",
                        "host": "mock",
                        "port": 8006,
                        "username": "demo@pam",
                        "token_name": "demo-token",
                        "token_value": "demo-value",
                        "verify_ssl": False,
                        "cpu_overcommit_ratio": 120
                    },
                    {
                        "id": "mock-server-backup-id",
                        "name": "Secondary Backup Cluster (Mock B)",
                        "host": "mock",
                        "port": 8006,
                        "username": "demo@pam",
                        "token_name": "demo-token",
                        "token_value": "demo-value",
                        "verify_ssl": False,
                        "cpu_overcommit_ratio": 150
                    }
                ]

        # Fetch all servers asynchronously in parallel
        results = await asyncio.gather(*(fetch_single_server_dashboard(s) for s in servers)) if servers else []

        # Compile global stats
        total_servers = len(servers)
        online_servers = sum(1 for s in results if s["status"] in ["online", "success"])
        total_nodes = sum(s["summary"]["total_nodes"] for s in results)
        online_nodes = sum(s["summary"]["online_nodes"] for s in results)
        total_guests = sum(s["summary"]["total_guests"] for s in results)
        running_guests = sum(s["summary"]["running_guests"] for s in results)
        stopped_guests = sum(s["summary"]["stopped_guests"] for s in results)

        global_mem_used = sum(s["resources"]["memory_used_gb"] for s in results)
        global_mem_total = sum(s["resources"]["memory_total_gb"] for s in results)
        global_disk_used = sum(s["resources"]["storage_used_gb"] for s in results)
        global_disk_total = sum(s["resources"]["storage_total_gb"] for s in results)
        
        global_mem_allocated = sum(s["resources"].get("memory_allocated_gb", 0) for s in results)
        global_disk_allocated = sum(s["resources"].get("storage_allocated_gb", 0) for s in results)
        
        # Weighted CPU usage based on server sizes
        valid_cpu_servers = [s for s in results if s["status"] == "online"]
        if valid_cpu_servers:
            global_cpu_pct = round(sum(s["resources"]["cpu_usage_pct"] for s in valid_cpu_servers) / len(valid_cpu_servers), 2)
        elif results:
            # Fallback for mock server only
            global_cpu_pct = round(sum(s["resources"]["cpu_usage_pct"] for s in results) / len(results), 2)
        else:
            global_cpu_pct = 0.0

        global_mem_pct = round((global_mem_used / max(global_mem_total, 1.0)) * 100.0, 2)
        global_disk_pct = round((global_disk_used / max(global_disk_total, 1.0)) * 100.0, 2)

        # Compile global v-CPU overcommit stats
        global_allocated_cores = sum(s["cpu_virtualization"]["allocated_cores"] for s in results if "cpu_virtualization" in s)
        global_max_virtual_cores = sum(s["cpu_virtualization"]["max_virtual_cores"] for s in results if "cpu_virtualization" in s)
        global_physical_cores = sum(s["cpu_virtualization"]["total_physical_cores"] for s in results if "cpu_virtualization" in s)
        global_vcpu_pct = round((global_allocated_cores / max(global_max_virtual_cores, 1.0)) * 100.0, 2) if global_max_virtual_cores > 0 else 0.0

        return {
            "status": "success",
            "summary": {
                "total_servers": total_servers,
                "online_servers": online_servers,
                "total_nodes": total_nodes,
                "online_nodes": online_nodes,
                "total_guests": total_guests,
                "running_guests": running_guests,
                "stopped_guests": stopped_guests
            },
            "resources": {
                "cpu_usage_pct": global_cpu_pct,
                "memory_used_gb": round(global_mem_used, 2),
                "memory_total_gb": round(global_mem_total, 2),
                "memory_usage_pct": global_mem_pct,
                "memory_allocated_gb": round(global_mem_allocated, 2),
                "memory_allocated_pct": round((global_mem_allocated / max(global_mem_total, 1.0)) * 100.0, 2),
                "storage_used_gb": round(global_disk_used, 2),
                "storage_total_gb": round(global_disk_total, 2),
                "storage_usage_pct": global_disk_pct,
                "storage_allocated_gb": round(global_disk_allocated, 2),
                "storage_allocated_pct": round((global_disk_allocated / max(global_disk_total, 1.0)) * 100.0, 2),
                "vcpu_allocated_cores": global_allocated_cores,
                "vcpu_max_virtual_cores": round(global_max_virtual_cores, 1),
                "vcpu_physical_cores": global_physical_cores,
                "vcpu_usage_pct": global_vcpu_pct
            },
            "servers": results
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate dashboard summary: {str(e)}"
        )

@router.get("/widget", dependencies=[Depends(require_role(["admin", "operator", "reader"]))])
async def get_widget_summary():
    try:
        data = await get_dashboard_summary()
        return {
            "status": data.get("status"),
            "total_servers": data["summary"]["total_servers"],
            "online_servers": data["summary"]["online_servers"],
            "total_nodes": data["summary"]["total_nodes"],
            "online_nodes": data["summary"]["online_nodes"],
            "total_guests": data["summary"]["total_guests"],
            "running_guests": data["summary"]["running_guests"],
            "stopped_guests": data["summary"]["stopped_guests"],
            "cpu_usage_pct": data["resources"]["cpu_usage_pct"],
            "memory_used_gb": data["resources"]["memory_used_gb"],
            "memory_total_gb": data["resources"]["memory_total_gb"],
            "memory_usage_pct": data["resources"]["memory_usage_pct"],
            "storage_used_gb": data["resources"]["storage_used_gb"],
            "storage_total_gb": data["resources"]["storage_total_gb"],
            "storage_usage_pct": data["resources"]["storage_usage_pct"]
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate widget summary: {str(e)}"
        )

@router.get("/homarr", dependencies=[Depends(require_role(["admin", "operator", "reader"]))])
async def get_homarr_summary():
    return await get_widget_summary()

