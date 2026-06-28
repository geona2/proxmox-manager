"""
Proxmox MCP Server - 전원 제어 테스트
=====================================
stop / start / reboot / shutdown 전체 사이클을 MCP 프로토콜로 검증합니다.

사용법:
    python test_mcp.py
"""
import asyncio
import json
import os
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

os.environ.setdefault("PROXMOX_MANAGER_URL", "http://localhost:8000")
os.environ.setdefault("PROXMOX_MANAGER_USER", "admin")
os.environ.setdefault("PROXMOX_MANAGER_PASS", "admin123")

ACTIONS_TO_TEST = [
    # (vmid, node, vm_type, action, expected_status_after)
    (1110, "mock-a-node-01", "qemu", "stop",     "stopped"),
    (1110, "mock-a-node-01", "qemu", "start",    "running"),
    (1112, "mock-a-node-01", "lxc",  "stop",     "stopped"),
    (1112, "mock-a-node-01", "lxc",  "start",    "running"),
    (1113, "mock-a-node-01", "qemu", "reboot",   "running"),
    (1115, "mock-a-node-01", "qemu", "shutdown",  "stopped"),
]

SERVER_ID = "mock-server-datacenter-id"

COLORS = {
    "green": "\033[92m",
    "red":   "\033[91m",
    "yellow":"\033[93m",
    "cyan":  "\033[96m",
    "reset": "\033[0m",
    "bold":  "\033[1m",
}

def c(color: str, text: str) -> str:
    return f"{COLORS.get(color,'')}{text}{COLORS['reset']}"


async def send_recv(proc, msg: dict, timeout: float = 10.0) -> dict:
    proc.stdin.write((json.dumps(msg) + "\n").encode())
    await proc.stdin.drain()
    line = await asyncio.wait_for(proc.stdout.readline(), timeout=timeout)
    return json.loads(line.decode().strip())


async def main():
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "proxmox_mcp_server.py",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=os.environ.copy(),
    )

    # ── Initialize ────────────────────────────────────────────────────────────
    await send_recv(proc, {
        "jsonrpc": "2.0", "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": "test-runner", "version": "1.0"},
        },
    })

    # Notification (no response expected)
    proc.stdin.write((json.dumps({
        "jsonrpc": "2.0",
        "method": "notifications/initialized",
        "params": {},
    }) + "\n").encode())
    await proc.stdin.drain()

    print(c("bold", "\n=== Proxmox MCP 서버 - VM 전원 제어 테스트 ===\n"))
    print(f"  대상 클러스터: {c('cyan', SERVER_ID)}")
    print(f"  테스트 케이스: {len(ACTIONS_TO_TEST)}개\n")

    pass_count = fail_count = 0
    msg_id = 10

    for vmid, node, vm_type, action, expected in ACTIONS_TO_TEST:
        # ── 전원 액션 호출 ────────────────────────────────────────────────
        power_msg = {
            "jsonrpc": "2.0", "id": msg_id,
            "method": "tools/call",
            "params": {
                "name": "proxmox_vm_power_action",
                "arguments": {
                    "server_id": SERVER_ID,
                    "vmid": vmid,
                    "node": node,
                    "vm_type": vm_type,
                    "action": action,
                },
            },
        }
        resp = await send_recv(proc, power_msg)
        msg_id += 1

        content = resp.get("result", {}).get("content", [{}])
        result_text = content[0].get("text", "{}") if content else "{}"
        result_obj = json.loads(result_text)
        api_status = result_obj.get("status", "?")

        # ── 상태 확인 ─────────────────────────────────────────────────────
        detail_msg = {
            "jsonrpc": "2.0", "id": msg_id,
            "method": "tools/call",
            "params": {
                "name": "proxmox_vm_detail",
                "arguments": {"server_id": SERVER_ID, "vmid": vmid},
            },
        }
        detail_resp = await send_recv(proc, detail_msg)
        msg_id += 1

        detail_content = detail_resp.get("result", {}).get("content", [{}])
        detail_text = detail_content[0].get("text", "{}") if detail_content else "{}"
        detail_obj = json.loads(detail_text)
        actual_status = detail_obj.get("status", "unknown")

        ok = actual_status == expected
        icon = c("green", "[PASS]") if ok else c("red", "[FAIL]")
        if ok:
            pass_count += 1
        else:
            fail_count += 1

        print(
            f"  {icon}  vmid={c('cyan', str(vmid))}  [{c('yellow', vm_type)}]  "
            f"action={c('bold', action):<12}  "
            f"기대={c('green', expected):<10}  "
            f"실제={c('green' if ok else 'red', actual_status)}"
        )

    proc.kill()

    print(f"\n{'─'*60}")
    total = pass_count + fail_count
    print(f"  결과: {c('green', str(pass_count))} / {total} 통과  "
          + (c("red", f"({fail_count} failed)") if fail_count else c("green", "All passed!")))
    print()


if __name__ == "__main__":
    asyncio.run(main())
