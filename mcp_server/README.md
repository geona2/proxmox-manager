# Proxmox Manager MCP Server

Antigravity IDE에서 Proxmox 데이터센터를 직접 조작할 수 있는 MCP 서버입니다.

## 연계 구조

```
Antigravity IDE (AI 에이전트)
        │  MCP Protocol (stdio)
        ▼
proxmox_mcp_server.py
        │  HTTP REST API
        ▼
FastAPI Backend (http://localhost:8000)
        │
        ▼
Mock Proxmox 데이터 / 실제 Proxmox API
```

## 환경 변수

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PROXMOX_MANAGER_URL` | `http://localhost:8000` | 백엔드 URL |
| `PROXMOX_MANAGER_USER` | `admin` | 로그인 계정 |
| `PROXMOX_MANAGER_PASS` | `admin123` | 로그인 비밀번호 |

## 제공 Tool 목록

| Tool | 설명 |
|------|------|
| `proxmox_login` | 인증 토큰 발급 |
| `proxmox_dashboard` | 전체 데이터센터 대시보드 조회 |
| `proxmox_list_clusters` | 등록된 클러스터 목록 |
| `proxmox_cluster_detail` | 특정 클러스터 상세 정보 |
| `proxmox_list_nodes` | 클러스터의 물리 노드 목록 |
| `proxmox_list_vms` | VM/LXC 목록 (노드·상태 필터 가능) |
| `proxmox_vm_detail` | 특정 VM 상세 정보 |
| `proxmox_vm_power_action` | VM 전원 제어 (start/stop/shutdown/reboot) |
| `proxmox_vm_console_url` | VM VNC 콘솔 URL 조회 |
| `proxmox_list_iso` | 사용 가능한 ISO 이미지 목록 |
| `proxmox_create_vm` | 새 VM 생성 |
| `proxmox_ceph_status` | Ceph 스토리지 상태 조회 |

## IDE 재시작 방법

`mcp_config.json` 변경 후 Antigravity IDE의 채팅 패널 **`...` 메뉴 → MCP Servers → Refresh** 를 클릭하거나 IDE를 재시작하세요.
