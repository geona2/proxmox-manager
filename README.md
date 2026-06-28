# Proxmox Datacenter Multi-Cluster Manager

Proxmox Datacenter Manager는 여러 개의 분산된 Proxmox VE 클러스터를 한곳에서 모니터링하고 가상 머신(VM) 및 컨테이너(LXC)를 손쉽게 통합 제어할 수 있는 프리미엄 엔터프라이즈 대시보드 시스템입니다.

개발 및 테스트 편의를 위해 **10개의 Mock 클러스터 환경**이 내장되어 있어 실제 Proxmox 인프라 없이도 모든 관리 기능을 완벽하게 실감 테스트할 수 있습니다.

---

## ✨ 주요 기능

*   **통합 대시보드:** 모든 클러스터의 vCPU, 메모리, 스토리지 가용량 실시간 집계 및 오버커밋 현황 시각화
*   **가상 장비 전원 및 생명주기 관리:** VM/LXC의 시작(Start), 정상 종료(Shutdown), 강제 중지(Stop), 재부팅(Reboot), 그리고 영구 삭제(Delete)
*   **이미지 및 템플릿 배포:** 가상화 ISO 및 컨테이너 템플릿을 타겟 클러스터에 손쉽게 배포
*   **Ceph 스토리지 관리:** 클러스터별 Ceph 분산 파일시스템 풀 상태 모니터링 및 추가 스토리지 프로비저닝
*   **성능 지표 자동 수집:** InfluxDB 백그라운드 스케줄러가 탑재되어 클러스터 및 가상 장비의 세부 메트릭을 주기적으로 아카이빙

---

## 🛠 기술 스택

*   **Frontend:** Next.js (TypeScript), TailwindCSS (글래스모피즘 디자인 시스템 및 완벽한 다크 모드 제공)
*   **Backend:** FastAPI (Python 3.12), Async SQLAlchemy 2.0 (Uvicorn 구동)
*   **Database:** PostgreSQL 16 (기본 설정 저장 및 Mock 상태 제어 오버라이드)
*   **Time-series DB:** InfluxDB (성능 지표 수집용)

---

## 🚀 설치 및 시작 가이드

프로젝트 최신 버전은 완벽한 컨테이너 가상화가 준비되어 있습니다. 도커(Docker) 환경만 준비되어 있다면 단 한 줄로 전체 스택을 가동할 수 있습니다.

### 1. 개발 및 검증 환경 구동 (Mock 데이터 포함)
10개의 가상 데모 클러스터(Mock A ~ Mock J)가 탑재된 모드로 구동됩니다.

```bash
docker compose -f docker-compose.dev.yml up -d
```

*   **프론트엔드 주소:** `http://localhost:8116`
*   **백엔드 API 및 Swagger Docs:** `http://localhost:8000/docs`

### 2. 운영 및 실제 인프라 연동 환경 구동
```bash
docker compose -f docker-compose.yml up -d
```

*   **프론트엔드 주소:** `http://localhost:3000`
*   **백엔드 API 주소:** `http://localhost:8000`

---

## 🔐 기본 인증 계정
데이터베이스 가동 시 초기 데이터 시딩(`populate_defaults`)을 통해 세 가지 역할군 계정이 자동으로 생성됩니다.

*   **관리자 (Admin):** `admin` / `admin123` (모든 모니터링 및 VM 전원/삭제 제어 권한 소유)
*   **운영자 (Operator):** `operator` / `operator123` (모니터링 및 전원 제어 권한 소유, 자원 삭제 제한)
*   **조회자 (Reader):** `reader` / `reader123` (모니터링 전용, 제어 권한 없음)

---

## 💡 최근 업데이트 내역

*   **UI 가독성 대폭 향상:** 어두운 글래스모피즘 테마 하에서 시인성이 낮던 회색 텍스트들의 명도(Contrast Ratio)를 전면 상승 패치하고 폰트 구조를 일목요연하게 다듬었습니다.
*   **10개 Mock 클러스터 VM 제어 범위 확장:** 특정 데모 장비에만 국한되던 전원/삭제 처리 핸들러를 확장하여 데모용 B~J 클러스터에 속한 모든 VMID 제어가 데이터베이스 오버라이드 캐시를 통해 즉각 상태 갱신 및 삭제되도록 완벽히 처리했습니다.
*   **에러 디버깅 편의 고도화:** API 연동 에러 및 권한 에러 발생 시, 팝업창에서 시도 중이던 백엔드 전체 URL 정보를 제공하도록 프론트엔드 예외 처리 경고창을 개선했습니다.
