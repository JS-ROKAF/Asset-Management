# AssetHub — 유·무형 자산관리 시스템

---

## 프로그램 개요

AssetHub는 회사 내 유·무형 자산을 체계적으로 관리하기 위해 개발된 웹 기반 자산관리 시스템입니다. 노트북, 모니터, 차량 등 물리적 자산부터 소프트웨어 라이선스 같은 무형 자산까지 한 곳에서 등록, 추적, 관리할 수 있으며, 부서별 구성원과 자산 배정 현황을 실시간으로 파악할 수 있습니다.

별도 설치 없이 웹 브라우저에서 접속하며, 로컬 SQLite DB + 자체 FastAPI 백엔드와 연동되어 데이터가 저장·동기화됩니다. (2026-07-10 Supabase → SQLite/FastAPI 전환, 상세는 [DB / 아키텍처 전환 이력](#db--아키텍처-전환-이력) 참고)

---

## 주요 기능

### 1. 대시보드

프로그램 첫 화면으로, 전체 자산 현황을 한눈에 확인할 수 있습니다.

- 전체 자산 수, 사용중·미사용·수리중·분실 자산 현황
- 총 자산 금액 및 부서별 자산 금액
- 자산 상태별 파이 차트, 부서별 자산 현황 바 차트
- 보증 만료 임박(30일 이내) 및 만료된 자산 알림
- 최근 배정·반납 이력 10건
- 백엔드 API 연결 상태 및 응답속도 모니터링 (30초 주기 폴링)
- 엑셀 내보내기 (자산·구성원·이력·종합 요약 4개 시트)

---

### 2. 자산 관리

등록된 자산의 전체 목록을 조회하고 관리하는 핵심 기능입니다.

**자산 등록**
- 자산명, 유형, 위치, 사용부서, 모델명, 시리얼 넘버, 취득일자, 취득금액, 구입처, 보증 만료일, 사용자, 비고 입력
- 수량 일괄 등록 (최대 100개, 개별 자산번호 자동 부여)
- 엑셀 파일로 대량 등록 (양식 다운로드 제공)
- 시리얼 넘버 중복 자동 감지

**자산 조회 및 검색**
- 상태(사용중·미사용·수리중·분실), 부서, 유형별 필터링
- 자산번호·자산명·사용자·위치·부서 통합 검색
- 컬럼별 정렬 기능
- 페이지당 15건 페이지네이션

**자산 수정 및 상세**
- 자산 클릭 시 상세 정보 및 해당 자산의 전체 이력 확인
- 사용자 변경, 상태 변경, 정보 수정
- 상태를 미사용·수리중·분실로 변경 시 사용자 자동 초기화 및 반납 이력 자동 생성
- QR 코드 출력: 자산번호 기반 `#/assets/{id}` 해시 URL을 QR로 생성. 스캔 시 `AssetPublicDetail` 페이지에서 자산 정보 카드 표시 (로그인 필요)
- **폐기 처리**: 자산 삭제 대신 소프트딜리트 (`isDisposed: true`). 폐기방법(폐기/매각/기증/분실처리) + 폐기사유 입력 필수. 폐기 후 목록 제외, 이력 영구 보존

**일괄 처리**
- 여러 자산 선택 후 일괄 배정, 일괄 반납, 일괄 상태 변경

**보증 관리**
- 보증 만료일 기준으로 만료·임박(30일 이내) 자동 표시

---

### 3. 구성원 관리

부서별 구성원 정보와 자산 배정 현황을 관리합니다.

- 구성원 등록·수정·퇴직 처리
- 카드뷰·테이블뷰 전환
- 이름·부서·보유 자산 수 기준 정렬
- 엑셀 파일로 대량 등록 (양식 다운로드 제공)
- 구성원 상세 화면에서 배정 자산 목록 및 자산 이력 확인
- 퇴직 처리 시 배정 자산 자동 반납 및 이력 생성
- 이름 변경 시 연관 자산의 사용자명 자동 업데이트
- 시스템 권한 부여 (admin·manager·viewer)

---

### 4. 배정/반납 이력

자산의 모든 변동 이력을 기록하고 조회합니다.

- 배정, 반납, 입고, 상태변경, 폐기 유형별 필터
- 자산명·자산번호·사용자·메모 통합 검색
- 날짜 범위 필터 (시작일~종료일)
- 컬럼별 정렬
- 관리자 권한으로 이력 삭제 가능

---

### 4-1. 수리 이력 상세화

수정 모달에서 상태를 "수리중"으로 변경(신규 전환 시)하면 수리 정보 입력 섹션 출현.

- 입력 항목: 수리업체, 수리비용, 수리내용, 완료예정일 (모두 선택)
- 이력 note 형식: `수리 접수 | 업체: X | 비용: Y원 | 내용: Z | 완료예정: D`
- 이미 수리중인 자산 수정 시에는 섹션 미출현 (재전환 시에만)

---

### 5. 요청 관리

일반 구성원이 자산 배정·반납을 요청하고, 담당자가 승인·거절하는 워크플로우입니다.

- 구성원: 미사용 자산 중 배정 요청, 현재 자산 반납 요청 접수
- 담당자/관리자: 요청 목록 확인 후 승인 또는 거절 처리
- 승인 시 자산 상태 및 사용자 자동 변경, 이력 자동 생성
- 요청 상태: 대기중·승인·거절
- 부서장은 자기 부서 관련 요청만 확인

---

### 6. 정기 실사

주기적인 자산 실물 확인(실사)을 체계적으로 진행합니다.

- 관리자가 실사 생성 시 전체 자산이 실사 항목으로 자동 등록
- 항목별 보유중·없음·분실 확인 처리
- 진행률 실시간 표시 (확인 건수/전체 건수)
- 실사 완료 처리 시 없음→미사용, 분실→분실 자동 반영 및 이력 생성
- 부서장·뷰어는 자기 부서 항목만 확인 가능

---

### 7. QR 코드 자산 공개 조회 + 실사 체크 (AssetPublicDetail)

QR 코드 스캔 시 표시되는 자산 정보 카드 페이지입니다.

- URL 패턴: `#/assets/{assetId}` (hash-based 라우팅, React Router 미사용)
- 로그인 세션 확인 후 미인증 시 `LoginRedirect` 컴포넌트로 로그인 유도
- 인증 후 백엔드 API에서 단일 자산 조회하여 카드 형태로 표시
- 표시 항목: 자산번호, 모델명, 시리얼, 유형, 부서, 위치, 사용자, 구매일, 구매금액, 공급업체, 보증만료, 비고
- 자산 미존재 시 안내 메시지 표시
- **실사 연동**: 로그인 후 진행중인 실사(`inspections.status = "진행중"`)가 있으면 해당 자산의 실사 항목 체크 버튼(보유중/없음/분실) 자동 노출. 스마트폰 QR 스캔만으로 현장 실사 처리 가능

---

## 권한 체계

| 권한 | 대상 | 가능한 작업 |
|------|------|------------|
| admin | 전체 관리자 | 모든 기능 사용, 전체 데이터 조회·수정·삭제 |
| manager | 부서장 | 자기 부서 자산·구성원 관리, 요청 승인·거절 |
| viewer | 일반 직원 | 자기 부서 데이터 조회, 자산 배정·반납 요청 |

---

## 자동화 기능

사용자가 별도로 처리하지 않아도 시스템이 자동으로 처리하는 항목입니다.

- 자산 상태를 미사용·수리중·분실로 변경 시 → 사용자 자동 초기화 + 반납 이력 자동 생성
- 구성원 퇴직 처리 시 → 배정 자산 전체 자동 반납 + 이력 자동 생성
- 요청 승인 시 → 자산 상태·사용자 자동 변경 + 이력 자동 생성
- 실사 완료 시 → 없음·분실 자산 상태 자동 변경 + 이력 자동 생성
- 자산 배정 시 이미 다른 사용자가 있으면 → 기존 반납 이력 + 새 배정 이력 자동 생성

---

## 기술 구성

| 항목 | 내용 |
|------|------|
| 프론트엔드 | React 19 (Vite 8) |
| 스타일링 | Tailwind CSS v4 |
| 백엔드 | FastAPI (Python), `backend/` 디렉토리, 기본 포트 8001 |
| 데이터베이스 | SQLite (`db/assethub.db`) — 2026-07-10 이전 Supabase(PostgreSQL)에서 전환 |
| 인증 | JWT (`python-jose`) + bcrypt (`passlib`) — 2026-07-10 이전 Supabase Auth에서 전환. 프론트는 `localStorage`(`assethub_token`)에 토큰 보관 |
| API 통신 | `src/api.js`의 fetch 기반 클라이언트. 프로덕션 빌드는 상대경로(같은 origin)로 호출, 개발서버(`npm run dev`)는 `.env.development`의 `VITE_API_BASE`로 백엔드 주소 지정 |
| 데스크탑 실행 | `tray_AssetHub.py` — 시스템 트레이 아이콘으로 백엔드+프론트(빌드본)를 단일 포트로 실행 |
| 차트 | Recharts |
| 엑셀 | SheetJS (xlsx) |
| QR 코드 | qrcode.react |
| 라우팅 | hash-based 라우팅 (React Router 미사용, `main.jsx`에서 직접 처리) |
| 접속 방법 | 웹 브라우저 |

---

## 파일 구조

```
backend/
├── main.py                # FastAPI 앱 진입점 (CORS, 라우터 등록, DB 초기화)
├── auth.py                # 비밀번호 해시(bcrypt), JWT 발급/검증
├── deps.py                # get_current_user / require_admin 등 인증 의존성
├── seed_admin.py          # admin 계정 생성/비밀번호 초기화 스크립트
├── backup_db.py           # SQLite 백업 스크립트 (db/backups/에 타임스탬프 복사, 30일 보관)
├── requirements.txt
├── db/
│   ├── database.py         # SQLite 연결 + init_db() 스키마 정의
│   └── helpers.py          # 컬럼 화이트리스트 + insert/update/delete 공통 헬퍼
└── routers/
    ├── auth_router.py       # /api/auth/login, /api/auth/me
    ├── bootstrap_router.py  # /api/bootstrap, /api/health, /api/table_counts
    ├── assets_router.py
    ├── members_router.py
    ├── history_router.py
    ├── requests_router.py
    └── inspections_router.py

db/
├── assethub.db            # SQLite DB 파일 (git 미추적)
└── backups/                # backup_db.py 결과물 (git 미추적)

tray_AssetHub.py            # 데스크탑 트레이 실행기 (PTO 프로젝트의 tray_PTO.py 패턴 이식)

src/
├── App.jsx               # 메인 앱 (세션 관리, 전역 상태, 페이지 전환)
├── main.jsx              # 진입점 (hash URL 기반 라우팅: #/assets/{id} → AssetPublicDetail)
├── api.js                 # 백엔드 fetch 클라이언트 (토큰 저장/주입, 엔드포인트별 함수 모음)
├── assets/               # 이미지·아이콘 등 정적 자원
├── components/
│   ├── SortableTable.jsx
│   ├── common/           # 공통 UI 컴포넌트
│   │   ├── Btn.jsx
│   │   ├── Field.jsx
│   │   ├── HistoryBadge.jsx
│   │   ├── Icon.jsx
│   │   ├── InputField.jsx
│   │   ├── Modal.jsx
│   │   ├── PageHeader.jsx
│   │   ├── Pagination.jsx
│   │   ├── RequestBadge.jsx
│   │   ├── RequestStatusBadge.jsx
│   │   ├── SearchFilter.jsx
│   │   ├── SelectField.jsx
│   │   ├── StatusBadge.jsx
│   │   └── SummaryCards.jsx
│   └── layout/
│       └── Sidebar.jsx
├── constants/
│   └── index.js          # 전역 상수 (DEPARTMENTS, ASSET_STATUS, C 디자인 토큰 등)
├── hooks/
│   └── useSort.js
├── pages/
│   ├── AssetPage.jsx
│   ├── AssetPublicDetail.jsx  # QR 스캔 시 표시되는 자산 공개 상세 카드
│   ├── Dashboard.jsx
│   ├── HistoryPage.jsx
│   ├── InspectionPage.jsx
│   ├── LoginPage.jsx
│   ├── MemberPage.jsx
│   └── RequestPage.jsx
├── services/
│   ├── assetService.js
│   ├── authService.js
│   └── memberService.js
└── utils/
    ├── date.js
    ├── exportExcel.js
    ├── history.js
    └── user.js
```

---

## 데이터 구조

시스템이 관리하는 주요 데이터 항목입니다.

**자산 (assets)**
자산번호(id), 자산명, 유형, 상태(사용중·미사용·수리중·분실), 사용자, 사용부서, 위치, 모델명, 시리얼 넘버, 취득일자, 취득금액, 구입처, 보증 만료일, 비고, 등록일
폐기 관련 컬럼: `isDisposed` (0/1), `disposalReason`, `disposalMethod`, `disposalDate` — `backend/db/database.py`의 `init_db()`에 반영됨

**구성원 (members)**
사번, 이름, 부서, 이메일, 직급, 시스템 권한(admin·manager·viewer), 재직 상태

**이력 (history)**
구분(배정·반납·입고·상태변경·폐기), 자산번호, 자산명, 이전 사용자, 변경 후 사용자, 메모, 날짜

**요청 (requests)**
요청 유형(배정요청·반납요청), 자산, 요청자, 상태(대기중·승인·거절), 요청 사유, 처리 사유, 처리일

**실사 (inspections / inspection_items)**
실사명, 기간, 생성자, 상태, 항목별 확인 결과(보유중·없음·분실)

---

## 주요 상수 (constants/index.js)

- `DEPARTMENTS`: 경영지원사업부, SCM사업부, 뉴비즈니스사업부, CIST, GIST, 셀럭스, 기술연구소
- `ASSET_STATUS`: 사용중 / 미사용 / 수리중 / 분실
- `ASSET_TYPES`: 노트북, 데스크탑, 모니터, 키보드/마우스, 프린터/복합기, TV, 네트워크 장비, 비품, 차량, 기타
- `C`: 전역 디자인 토큰 (primary `#3B82F6`, sidebar `#0F172A`, bg `#F1F5F9` 등)

---

## DB / 아키텍처 전환 이력

### 2026-07-10 — Supabase → SQLite + FastAPI 전환

**전환 사유**: Supabase 무료/저가 플랜이 일정 기간 미사용 시 자동으로 일시정지(pause)되어, 접속 불가 문제가 반복 발생. 로컬 SQLite + 자체 FastAPI 백엔드로 전환해 이 문제를 근본적으로 해결.

**전환 전 확인 사항**:
- 기존 Supabase RLS(Row Level Security)는 실질적인 행 단위 접근 제어가 없어 복제 불필요 확인
- 기존 Supabase DB에는 더미/테스트 데이터만 존재해 데이터 마이그레이션·백업 불필요 확인
- 기존 Supabase 프로젝트는 롤백 안전망으로 그대로 보존 (삭제하지 않음)

**아키텍처 변경**:
| 영역 | 이전 (Supabase) | 이후 (SQLite/FastAPI) |
|------|------------------|------------------------|
| DB | Supabase (PostgreSQL, 클라우드) | SQLite 파일 (`db/assethub.db`, 로컬) |
| 인증 | Supabase Auth (`supabase.auth.*`) | JWT(`python-jose`) + bcrypt(`passlib`), 토큰은 프론트 `localStorage`(`assethub_token`)에 저장 |
| API 통신 | `@supabase/supabase-js` 클라이언트 (`src/supabase.js`, 삭제됨) | `src/api.js`의 fetch 래퍼 → `backend/routers/*` REST 엔드포인트 |
| 행 단위 접근 제어 | Supabase RLS | FastAPI `Depends(get_current_user)` / `require_admin` 의존성 + 프론트단 부서 필터링 |
| 실시간 갱신 | Supabase Realtime 구독 (Dashboard 모니터링 위젯의 "실시간 구독" 표시) | 제거됨 — 백엔드에 realtime/websocket 계층 없음. Dashboard는 `api.health()`/`api.tableCounts()` 30초 폴링으로 대체 |
| 백업 | Supabase 자동 관리 | `backend/backup_db.py` 수동/스케줄 실행 (30일 보관, `db/backups/`) — Windows 작업 스케줄러 등록 권장 |

**참고**: 백엔드 재기동 시 `backend/db/database.py`의 `init_db()`가 `CREATE TABLE IF NOT EXISTS`로 스키마를 보장하지만, 이미 다른 컬럼 구성으로 생성된 테이블이 있으면 자동으로 마이그레이션되지 않는다 (실제로 `requests` 테이블에서 구버전 컬럼(`requester`, `reason` 등)이 남아있던 사례 발견·수정됨). 스키마 변경 시 기존 DB 파일 삭제 후 재생성하거나 수동 `ALTER TABLE` 필요.

---

## 데스크탑 트레이 실행 (tray_AssetHub.py)

**목적**: 서버(백엔드+프론트)를 매번 터미널 2개(`npm run dev` / `uvicorn`) 띄우지 않고, 바탕화면에서 더블클릭 한 번으로 실행. 사내 다른 프로젝트 "PTO"의 `tray_PTO.py` 패턴을 그대로 이식.

**동작 방식**:
- `backend/main.py`가 `dist/`(프론트 빌드 결과물) 존재 시 `/`에 정적서빙 마운트 → 백엔드 API + 프론트 화면이 **단일 포트**(트레이 스크립트 상단 `PORT`, 현재 **8011** — 사내 PTO 프로젝트가 8001을 이미 쓰고 있어 충돌 방지용으로 변경됨)로 통합 서빙됨
- `tray_AssetHub.py` 실행 시: `dist/` 없으면 `npm run build` 1회 자동 실행 → `backend/`를 cwd로 uvicorn(`main:app`)을 무창(CREATE_NO_WINDOW) 백그라운드 프로세스로 기동 → 브라우저 자동 오픈 → 트레이 아이콘(초록/빨강, `/api/health` 10초 폴링) 표시
- 우클릭 메뉴: 로컬 브라우저 열기 / 내부망 접속주소(LAN IP) 표시 / 종료(백엔드 프로세스까지 taskkill로 정리)
- 바탕화면 실행: `tray_AssetHub.bat` (PTO의 `tray.py`용 bat과 동일 패턴 — `start "" /b c:\python314\pythonw.exe "%~dp0tray_AssetHub.py"`, 콘솔창 없이 백그라운드 기동). 바탕화면 바로가기(`AssetHub.lnk`)가 이 bat을 가리킴
- 직접 실행 시: `c:\python314\python.exe tray_AssetHub.py` (전역 python314에 `pystray`, `Pillow` 설치되어 있어야 함, `backend/requirements.txt`에는 미포함 — 트레이 전용 의존성이라 별도)

**프론트 API_BASE 분기 (중요)**:
- 프로덕션 빌드(`npm run build`, 트레이가 서빙하는 `dist/`)는 `src/api.js`의 `API_BASE` 기본값이 빈 문자열(`""`) → 페이지를 서빙 중인 origin(트레이가 띄운 포트)으로 **상대경로 fetch**. 트레이 스크립트의 `PORT`를 바꿔도 재빌드만 하면 자동으로 맞음
- 개발서버(`npm run dev`, 포트 5173)만 `.env.development`의 `VITE_API_BASE=http://localhost:8001`로 백엔드 주소 고정
- **주의**: 트레이 `PORT`를 바꿨는데 `dist/`가 옛 설정으로 이미 빌드되어 있으면 `dist/` 폴더를 지우고(`rm -rf dist`) `npm run build` 재실행 필요 (트레이는 `dist/` 존재 시 재빌드 스킵하므로 자동으로 갱신되지 않음)

**겪은 이슈 (2026-07-10)**: 트레이 `PORT`를 8001→8011로 변경 후 로그인 시 `Failed to fetch` 발생. 원인은 `dist/`가 옛 `VITE_API_BASE=http://localhost:8001` 하드코딩 상태로 빌드되어 있었기 때문(Vite 환경변수는 빌드 시점에 번들에 고정됨, 런타임 변경 불가). 위 "API_BASE 분기" 방식으로 근본 수정.

**겪은 이슈 2 — 포트 점유 잔존 프로세스**: 개발/테스트 중 터미널에서 직접 띄운 `uvicorn main:app --port 8001` 프로세스가 정상 종료되지 않고 백그라운드에 잔존, PTO(포트 8001) 화면 대신 AssetHub 화면이 뜨는 혼선 발생. `netstat -ano | grep :8001`로 LISTENING PID 확인 → `wmic process where "ProcessId=<PID>" get CommandLine`으로 정체 확인 후 `taskkill /F /PID <PID>`로 정리. **교훈**: 터미널에서 백엔드 임시 기동 시 반드시 확실히 종료 확인할 것(bash 백그라운드 job의 `kill %1`이 실제 Windows 프로세스까지 못 죽이는 경우 있음).

**admin 로그인 계정**: 이메일 `admin` (기존 테스트 계정 `admin@test.com`에서 변경, 비밀번호는 별도 관리 — 문서에 평문 기재하지 않음). 계정정보 변경은 `backend/seed_admin.py` 로직 참고해 `backend/auth.py`의 `hash_password`로 직접 UPDATE.

---

## 개발 우선순위 (기능 개선 로드맵)

> 회계·세무(감가상각, 장부가치 등)는 범위 외. 운영 효율 중심으로 우선순위 선정.

---

### 1순위 — 즉시 (임팩트 높음 / 난이도 낮음) ✅ 완료

#### 1-A. 폐기 소프트 딜리트 ✅
- `isDisposed: true` 플래그 + `disposalReason`, `disposalMethod`, `disposalDate` 컬럼
- "삭제" 버튼 → "폐기" 버튼. 폐기 방법/사유 입력 모달
- 폐기 자산은 목록에서 제외 (`!a.isDisposed` 필터), 이력 영구 보존
- 컬럼은 `backend/db/database.py`의 `init_db()`에 반영됨 (SQLite 전환 후 완료)

#### 1-B. 수리 이력 상세화 ✅
- 수정 모달에서 상태 → "수리중" 전환 시 수리업체/비용/내용/완료예정일 입력 섹션 출현
- 이력 note에 `수리 접수 | 업체: X | 비용: Y원 | ...` 형식으로 저장
- **버그 수정 포함**: `saveEdit` repair 임시 필드 DB 전송 제거 (UPDATE 실패 방지)

#### 1-C. 실사 QR 체크 연동 ✅
- QR 스캔 → 로그인 → 진행중 실사 자동 감지 → 보유중/없음/분실 버튼 노출
- 확인 즉시 백엔드 API(`PATCH /api/inspections/items/{id}`)로 `inspection_items` 업데이트

#### 버그 수정 (이 세션에서 발견·수정)
- **`assetService.js`**: `updated` 블록에 history insert 없음 → 자산 수정 시 이력 DB 미저장 (기존 버그). 수정 완료
- **이력 표시 레이아웃**: 긴 note(수리 메모)로 인한 from→to 컬럼 세로 쪼개짐 수정 (nowrap + ellipsis)

---

### 2순위 — 단기 (임팩트 높음 / 난이도 중간)

#### 2-A. 보증만료 이메일 알림
- **현재 문제**: 대시보드에 만료 임박 표시만 있음. 담당자가 직접 확인해야 인지 가능
- **개선**: FastAPI 백엔드에 APScheduler(또는 OS 스케줄러 + 스크립트)로 만료 30일/7일 전 자동 이메일 발송
- **수신 대상**: admin 전원 + 해당 자산 사용자
- **구현 범위**: `backend/`에 스케줄 작업 신규 작성, SMTP 연동, 이메일 템플릿 (SQLite/FastAPI 전환로 Supabase Edge Function 방식은 폐기)

#### 2-B. 파일 첨부
- **현재 문제**: 구매영수증, 사진, 매뉴얼 등 관련 문서 보관 불가
- **개선**: 로컬 파일시스템 저장 + FastAPI 정적 파일 서빙(또는 별도 스토리지 연동)으로 자산별 파일 업로드/다운로드
- **구현 범위**: `backend/`에 업로드 라우터 + 저장 디렉토리 설정, 자산 상세 모달에 첨부파일 섹션 추가 (SQLite/FastAPI 전환로 Supabase Storage 방식은 폐기)

---

### 3순위 — 중기 (임팩트 중간 / 난이도 중간)

#### 3-A. 소프트웨어 라이선스 관리
- **현재 문제**: 프로그램 개요에 "무형 자산" 언급하지만 라이선스 관리 기능 없음
- **개선**: 별도 `licenses` 테이블 — 제품명, 총 수량, 사용 수량, 만료일, 계약번호
- **효과**: 라이선스 초과 사용 방지, 갱신 시점 알림

#### 3-B. 감사 로그 (Audit Log)
- **현재 문제**: 자산 이력은 있으나 "누가 이 변경을 했는지" 기록 없음 (변경자 정보 부재)
- **개선**: 모든 수정 작업에 `modifiedBy` 기록. 별도 audit_log 테이블 or history에 컬럼 추가
- **효과**: 부정 변경 추적, 관리 책임 명확화

#### 3-C. 실사 결과 보고서 출력
- **현재 문제**: 실사 완료 후 결과를 보고서로 출력할 방법 없음
- **개선**: 실사 결과 엑셀/PDF 내보내기 (기존 exportExcel.js 확장)
- **구현 범위**: InspectionPage에 내보내기 버튼 추가

---

### 보류 (현재 규모 대비 복잡도 과다)

| 기능 | 이유 |
|------|------|
| 구매 요청/조달 워크플로우 | 별도 ERP 수준의 설계 필요 |
| SSO/LDAP 연동 | 자체 JWT 인증(`backend/auth.py`) 대체 설계 필요 |
| 커스텀 필드 | 스키마 동적 관리 필요 |
| 배정 확인서 (서명) | 전자서명 외부 서비스 필요 |
| 모바일 네이티브 앱 | 별도 프로젝트 |

---

*본 문서는 AssetHub 내부 사용 안내를 위해 작성되었습니다.*
