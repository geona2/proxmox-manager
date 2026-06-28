"""
Proxmox MCP Server
==================
Model Context Protocol server that wraps the local Proxmox Manager
FastAPI backend (http://localhost:8000).

Tools exposed:
  - proxmox_login            : Authenticate and get a session token
  - proxmox_dashboard        : Get full datacenter dashboard summary
  - proxmox_list_clusters    : List all connected Proxmox clusters
  - proxmox_cluster_detail   : Get detail of a single cluster
  - proxmox_list_nodes       : List nodes in a cluster
  - proxmox_list_vms         : List all VMs/LXC containers in a cluster
  - proxmox_vm_detail        : Get detail of a specific VM
  - proxmox_vm_power_action  : Start / Stop / Shutdown / Reboot a VM
  - proxmox_vm_console_url   : Get the VNC console URL for a VM
  - proxmox_create_vm        : Create a new VM (ISO-based)
  - proxmox_list_iso         : List available ISO images
  - proxmox_ceph_status      : Get Ceph storage cluster status
"""

import asyncio
import json
import os
from typing import Any

import httpx
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

# ── Configuration ────────────────────────────────────────────────────────────
BASE_URL = os.environ.get("PROXMOX_MANAGER_URL", "http://localhost:8000")
DEFAULT_USER = os.environ.get("PROXMOX_MANAGER_USER", "admin")
DEFAULT_PASS = os.environ.get("PROXMOX_MANAGER_PASS", "admin123")

# ── Session state (in-memory for the lifetime of this process) ───────────────
_session_token: str | None = None

# ── Helpers ──────────────────────────────────────────────────────────────────

async def _api(
    method: str,
    path: str,
    *,
    json_body: dict | None = None,
    params: dict | None = None,
    token: str | None = None,
) -> Any:
    """Generic async HTTP call to the backend."""
    headers = {}
    tok = token or _session_token
    if tok:
        headers["Authorization"] = f"Bearer {tok}"

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.request(
            method,
            f"{BASE_URL}{path}",
            json=json_body,
            params=params,
            headers=headers,
        )
        resp.raise_for_status()
        return resp.json()


async def _ensure_logged_in() -> str:
    """Auto-login if no session token is stored yet."""
    global _session_token
    if _session_token:
        return _session_token
    data = await _api(
        "POST",
        "/api/auth/login",
        json_body={"username": DEFAULT_USER, "password": DEFAULT_PASS},
    )
    _session_token = data["token"]
    return _session_token


def _ok(data: Any) -> list[TextContent]:
    return [TextContent(type="text", text=json.dumps(data, ensure_ascii=False, indent=2))]


def _err(msg: str) -> list[TextContent]:
    return [TextContent(type="text", text=f"ERROR: {msg}")]


# ── MCP Server setup ─────────────────────────────────────────────────────────
server = Server("proxmox-manager")

TOOLS: list[Tool] = [
    Tool(
        name="proxmox_login",
        description=(
            "Authenticate to the Proxmox Manager backend and store the session token. "
            "Call this first if other tools return authentication errors. "
            "Uses environment variables PROXMOX_MANAGER_USER / PROXMOX_MANAGER_PASS "
            "or defaults to admin / admin123."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "username": {"type": "string", "description": "Username (optional, defaults to env var)"},
                "password": {"type": "string", "description": "Password (optional, defaults to env var)"},
            },
        },
    ),
    Tool(
        name="proxmox_dashboard",
        description=(
            "Return a full datacenter dashboard summary: global CPU / memory / storage stats, "
            "list of all clusters with their status, nodes, and running guest counts."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    Tool(
        name="proxmox_list_clusters",
        description="List all registered Proxmox clusters (servers) with their status and resource summary.",
        inputSchema={"type": "object", "properties": {}},
    ),
    Tool(
        name="proxmox_cluster_detail",
        description="Get detailed information for a specific cluster including nodes, guests and storage.",
        inputSchema={
            "type": "object",
            "required": ["server_id"],
            "properties": {
                "server_id": {"type": "string", "description": "Cluster/server ID (e.g. mock-server-datacenter-id)"},
            },
        },
    ),
    Tool(
        name="proxmox_list_nodes",
        description="List all physical nodes in a specific Proxmox cluster.",
        inputSchema={
            "type": "object",
            "required": ["server_id"],
            "properties": {
                "server_id": {"type": "string", "description": "Cluster/server ID"},
            },
        },
    ),
    Tool(
        name="proxmox_list_vms",
        description=(
            "List all VMs and LXC containers in a cluster. "
            "Optionally filter by node name or status (running / stopped)."
        ),
        inputSchema={
            "type": "object",
            "required": ["server_id"],
            "properties": {
                "server_id": {"type": "string", "description": "Cluster/server ID"},
                "node": {"type": "string", "description": "Filter by node name (optional)"},
                "status": {
                    "type": "string",
                    "enum": ["running", "stopped"],
                    "description": "Filter by VM status (optional)",
                },
            },
        },
    ),
    Tool(
        name="proxmox_vm_detail",
        description="Get detailed information about a specific VM or LXC container.",
        inputSchema={
            "type": "object",
            "required": ["server_id", "vmid"],
            "properties": {
                "server_id": {"type": "string", "description": "Cluster/server ID"},
                "vmid": {"type": "integer", "description": "VM ID number"},
            },
        },
    ),
    Tool(
        name="proxmox_vm_power_action",
        description=(
            "Perform a power action on a VM or LXC container: start, stop, shutdown, or reboot. "
            "'shutdown' performs a graceful OS shutdown; 'stop' is a hard power-off."
        ),
        inputSchema={
            "type": "object",
            "required": ["server_id", "vmid", "node", "vm_type", "action"],
            "properties": {
                "server_id": {"type": "string", "description": "Cluster/server ID"},
                "vmid": {"type": "integer", "description": "VM ID number"},
                "node": {"type": "string", "description": "Node name where the VM resides"},
                "vm_type": {
                    "type": "string",
                    "enum": ["qemu", "lxc"],
                    "description": "VM type: qemu (KVM) or lxc (container)",
                },
                "action": {
                    "type": "string",
                    "enum": ["start", "stop", "shutdown", "reboot"],
                    "description": "Power action to perform",
                },
            },
        },
    ),
    Tool(
        name="proxmox_vm_console_url",
        description=(
            "Get the VNC/noVNC console URL for a running VM. "
            "Returns a URL that can be opened in a browser to access the VM console."
        ),
        inputSchema={
            "type": "object",
            "required": ["server_id", "vmid", "node", "vm_type"],
            "properties": {
                "server_id": {"type": "string", "description": "Cluster/server ID"},
                "vmid": {"type": "integer", "description": "VM ID number"},
                "node": {"type": "string", "description": "Node name where the VM resides"},
                "vm_type": {
                    "type": "string",
                    "enum": ["qemu", "lxc"],
                    "description": "VM type: qemu (KVM) or lxc (container)",
                },
            },
        },
    ),
    Tool(
        name="proxmox_list_iso",
        description="List available ISO images and templates that can be used to create new VMs.",
        inputSchema={
            "type": "object",
            "required": ["server_id"],
            "properties": {
                "server_id": {"type": "string", "description": "Cluster/server ID"},
            },
        },
    ),
    Tool(
        name="proxmox_create_vm",
        description=(
            "Create a new QEMU/KVM virtual machine on a specific node. "
            "Returns the task ID for the creation job."
        ),
        inputSchema={
            "type": "object",
            "required": ["server_id", "node", "vmid", "name", "cores", "memory_mb", "disk_gb"],
            "properties": {
                "server_id": {"type": "string", "description": "Cluster/server ID"},
                "node": {"type": "string", "description": "Target node name"},
                "vmid": {"type": "integer", "description": "New VM ID (must be unique)"},
                "name": {"type": "string", "description": "VM name"},
                "cores": {"type": "integer", "description": "Number of CPU cores"},
                "memory_mb": {"type": "integer", "description": "RAM in MB"},
                "disk_gb": {"type": "integer", "description": "Disk size in GB"},
                "iso": {"type": "string", "description": "ISO image filename (optional)"},
                "storage": {"type": "string", "description": "Storage pool name (default: local-lvm)"},
            },
        },
    ),
    Tool(
        name="proxmox_ceph_status",
        description="Get the Ceph distributed storage cluster status for a specific node.",
        inputSchema={
            "type": "object",
            "required": ["server_id", "node"],
            "properties": {
                "server_id": {"type": "string", "description": "Cluster/server ID"},
                "node": {"type": "string", "description": "Node name to query Ceph status from"},
            },
        },
    ),
]


@server.list_tools()
async def list_tools() -> list[Tool]:
    return TOOLS


@server.call_tool()
async def call_tool(name: str, arguments: dict) -> list[TextContent]:
    global _session_token

    try:
        # ── proxmox_login ────────────────────────────────────────────────────
        if name == "proxmox_login":
            username = arguments.get("username", DEFAULT_USER)
            password = arguments.get("password", DEFAULT_PASS)
            data = await _api(
                "POST",
                "/api/auth/login",
                json_body={"username": username, "password": password},
            )
            _session_token = data["token"]
            return _ok({"status": "logged_in", "username": data["username"], "role": data["role"]})

        # All other tools require authentication
        await _ensure_logged_in()

        # ── proxmox_dashboard ────────────────────────────────────────────────
        if name == "proxmox_dashboard":
            data = await _api("GET", "/api/proxmox/dashboard")
            return _ok(data)

        # ── proxmox_list_clusters ────────────────────────────────────────────
        elif name == "proxmox_list_clusters":
            data = await _api("GET", "/api/proxmox/dashboard")
            clusters = [
                {
                    "id": s["id"],
                    "name": s["name"],
                    "host": s["host"],
                    "status": s["status"],
                    "nodes": f"{s['summary']['online_nodes']}/{s['summary']['total_nodes']}",
                    "guests_running": s["summary"]["running_guests"],
                    "guests_total": s["summary"]["total_guests"],
                    "cpu_usage_pct": s["resources"]["cpu_usage_pct"],
                    "memory_used_gb": s["resources"]["memory_used_gb"],
                    "memory_total_gb": s["resources"]["memory_total_gb"],
                }
                for s in data.get("servers", [])
            ]
            return _ok({"clusters": clusters, "total": len(clusters)})

        # ── proxmox_cluster_detail ───────────────────────────────────────────
        elif name == "proxmox_cluster_detail":
            server_id = arguments["server_id"]
            data = await _api("GET", "/api/proxmox/dashboard")
            server = next((s for s in data.get("servers", []) if s["id"] == server_id), None)
            if not server:
                return _err(f"Cluster '{server_id}' not found. Available IDs: "
                            + ", ".join(s["id"] for s in data.get("servers", [])))
            return _ok(server)

        # ── proxmox_list_nodes ───────────────────────────────────────────────
        elif name == "proxmox_list_nodes":
            server_id = arguments["server_id"]
            data = await _api("GET", "/api/proxmox/dashboard")
            server = next((s for s in data.get("servers", []) if s["id"] == server_id), None)
            if not server:
                return _err(f"Cluster '{server_id}' not found.")
            return _ok({"server_id": server_id, "nodes": server.get("nodes", [])})

        # ── proxmox_list_vms ─────────────────────────────────────────────────
        elif name == "proxmox_list_vms":
            server_id = arguments["server_id"]
            data = await _api("GET", "/api/proxmox/dashboard")
            server = next((s for s in data.get("servers", []) if s["id"] == server_id), None)
            if not server:
                return _err(f"Cluster '{server_id}' not found.")
            guests = server.get("guests", [])
            if node_filter := arguments.get("node"):
                guests = [g for g in guests if g.get("node") == node_filter]
            if status_filter := arguments.get("status"):
                guests = [g for g in guests if g.get("status") == status_filter]
            return _ok({"server_id": server_id, "vms": guests, "total": len(guests)})

        # ── proxmox_vm_detail ────────────────────────────────────────────────
        elif name == "proxmox_vm_detail":
            server_id = arguments["server_id"]
            vmid = int(arguments["vmid"])
            data = await _api("GET", "/api/proxmox/dashboard")
            server = next((s for s in data.get("servers", []) if s["id"] == server_id), None)
            if not server:
                return _err(f"Cluster '{server_id}' not found.")
            vm = next((g for g in server.get("guests", []) if g.get("vmid") == vmid), None)
            if not vm:
                return _err(f"VM {vmid} not found in cluster '{server_id}'.")
            return _ok(vm)

        # ── proxmox_vm_power_action ──────────────────────────────────────────
        elif name == "proxmox_vm_power_action":
            server_id = arguments["server_id"]
            vmid = int(arguments["vmid"])
            node = arguments["node"]
            vm_type = arguments["vm_type"]
            action = arguments["action"]
            result = await _api(
                "POST",
                f"/api/servers/{server_id}/vms/{vmid}/status",
                json_body={"node": node, "type": vm_type, "action": action},
            )
            return _ok(result)

        # ── proxmox_vm_console_url ───────────────────────────────────────
        elif name == "proxmox_vm_console_url":
            server_id = arguments["server_id"]
            vmid = int(arguments["vmid"])
            node = arguments["node"]
            vm_type = arguments["vm_type"]
            # The backend does not expose a dedicated /console endpoint.
            # For mock servers, return a placeholder noVNC URL.
            # For real servers, the console URL is constructed directly from the Proxmox host.
            # First, look up the server to get its host/port.
            data = await _api("GET", "/api/proxmox/dashboard")
            srv = next((s for s in data.get("servers", []) if s["id"] == server_id), None)
            if not srv:
                return _err(f"Cluster '{server_id}' not found.")
            host = srv["host"]
            port = srv.get("port", 8006)
            if host.lower() == "mock":
                console_url = f"https://proxmox-demo.local:8006/?console=kvm&novnc=1&node={node}&vmid={vmid}&vmtype={vm_type}"
            else:
                console_url = f"https://{host}:{port}/?console=kvm&novnc=1&node={node}&vmid={vmid}&vmtype={vm_type}"
            return _ok({"console_url": console_url, "vmid": vmid, "node": node, "type": vm_type})

        # ── proxmox_list_iso ─────────────────────────────────────────────
        elif name == "proxmox_list_iso":
            # ISO/template images are managed globally at /api/images
            result = await _api("GET", "/api/images")
            return _ok({"server_id": arguments["server_id"], "images": result})

        # ── proxmox_create_vm ────────────────────────────────────────────
        elif name == "proxmox_create_vm":
            server_id = arguments["server_id"]
            # Matches CreateVMPayload schema in vms.py
            payload = {
                "node": arguments["node"],
                "vmid": int(arguments["vmid"]),
                "name": arguments["name"],
                "type": "qemu",
                "cores": int(arguments["cores"]),
                "memory": int(arguments["memory_mb"]),
                "disk_size": int(arguments["disk_gb"]),
                "image": arguments.get("iso", ""),
                "storage": arguments.get("storage", "local-lvm"),
            }
            result = await _api("POST", f"/api/servers/{server_id}/vms", json_body=payload)
            return _ok(result)

        # ── proxmox_ceph_status ──────────────────────────────────────────────
        elif name == "proxmox_ceph_status":
            server_id = arguments["server_id"]
            node = arguments["node"]
            result = await _api(
                "GET",
                f"/api/servers/{server_id}/ceph/status",
                params={"node": node},
            )
            return _ok(result)

        else:
            return _err(f"Unknown tool: {name}")

    except httpx.HTTPStatusError as e:
        # Try re-login once on 401
        if e.response.status_code == 401 and name != "proxmox_login":
            _session_token = None
            try:
                await _ensure_logged_in()
                return await call_tool(name, arguments)
            except Exception:
                pass
        return _err(f"HTTP {e.response.status_code}: {e.response.text}")
    except httpx.ConnectError:
        return _err(
            f"Cannot connect to Proxmox Manager backend at {BASE_URL}. "
            "Make sure Docker services are running: docker compose -f docker-compose.dev.yml up -d"
        )
    except Exception as exc:
        return _err(str(exc))


# ── Entry point ───────────────────────────────────────────────────────────────
async def main():
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())


if __name__ == "__main__":
    asyncio.run(main())
