# Proxmox Multi-Manager Project Rule
- Tech Stack: Next.js (Frontend), FastAPI (Backend), TailwindCSS
- Guardrails: 
  - 모든 Proxmox API 호출은 예외 처리(Try-Catch)를 필수 적용한다.
  - VM 삭제(`DELETE`) 포함한 모든 삭제 명령은 실행 전 프론트엔드에서 2차 확인(VM ID나 이름 입력 등) 절차를 거친다.
  - 구현 시 필요한 MCP 서버가 있으면 자동 연계한다.