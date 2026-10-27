# AssetHub — 유·무형 자산관리 시스템

---

## 프로그램 개요

AssetHub는 회사 내 유·무형 자산을 체계적으로 관리하기 위해 개발된 웹 기반 자산관리 시스템입니다. 노트북, 모니터, 차량 등 물리적 자산부터 소프트웨어 라이선스 같은 무형 자산까지 한 곳에서 등록, 추적, 관리할 수 있으며, 부서별 구성원과 자산 배정 현황을 실시간으로 파악할 수 있습니다.

별도 설치 없이 웹 브라우저에서 접속하며, 로컬 SQLite DB + 자체 FastAPI 백엔드와 연동되어 데이터가 저장·동기화됩니다. (2026-07-10 Supabase → SQLite/FastAPI 전환, 상세는 [DB / 아키텍처 전환 이력](#db--아키텍처-전환-이력) 참고)

**접속 주소는 사내망 고정 IP `192.168.0.189:8011` 하나뿐입니다.** 도메인 접속·외부 공개는 지원하지 않으며, `localhost`로도 접속되지 않습니다. 상세는 [외부 접속 정책](#외부-접속-정책--사내망-전용) 참고.

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
- **폐기 처리**: 자산 삭제 대신 소프트딜리트 (`isDisposed: true`). 폐기방법(폐기/매각/기증/분실처리) + 폐기사유 입력 필수. 폐기 후 자산목록·대시보드 집계·엑셀 리포트·실사 대상·배정요청 대상에서 모두 제외, 이력 영구 보존. `status`는 폐기 시점 상태(분실·수리중 등)를 감사용으로 보존하며 목록 제외는 `isDisposed`가 담당

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
- 시스템 권한 부여 (admin·manager·viewer) — 구성원 **수정** 모달에서, admin만 가능

**임시 비밀번호 발급** (admin 전용)
- 구성원 상세 하단 「로그인 계정」 섹션 → `🔑 임시 비밀번호 발급`
- `crypto.getRandomValues`로 10자 자동 생성. 혼동되는 글자(`0/O`, `1/l/I`) 제외
- `POST /api/members/{id}/reset_password` 호출, 기존 비밀번호는 즉시 무효화
- 발급된 비밀번호는 화면에 **1회만** 표시 (모달을 닫거나 다른 구성원을 선택하면 소거). 별도 저장·조회 경로 없음
- 구성원 등록만으로는 `password_hash`가 비어 있어 로그인 불가 — 이 발급을 거쳐야 admin 외 계정이 로그인할 수 있고, 그래야 요청 관리·부서장 승인·현장 QR 실사가 동작한다

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
| 폰트 | Pretendard 가변폰트 — `pretendard` npm 패키지를 로컬 번들 (외부 CDN 미사용, [외부 접속 정책](#외부-접속-정책--사내망-전용) 참고) |
| 라우팅 | hash-based 라우팅 (React Router 미사용, `main.jsx`에서 직접 처리. `hashchange` 리스너 있음) |
| 접속 방법 | 웹 브라우저 — **사내망 고정 IP `192.168.0.189:8011` 전용** |
| 렌더 스모크 | `npm run smoke` — SSR 렌더로 컴포넌트가 실제 DOM을 뱉는지 검증 (`smoke.jsx`) |

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
smoke.jsx                   # 렌더 스모크 테스트 (`npm run smoke`)

src/
├── App.jsx               # 메인 앱 (세션 관리, 전역 상태, 페이지 전환)
├── main.jsx              # 진입점 (hash URL 기반 라우팅: #/assets/{id} → AssetPublicDetail)
├── api.js                 # 백엔드 fetch 클라이언트 (토큰 저장/주입, 엔드포인트별 함수 모음)
├── index.css              # Tailwind + Pretendard 가변폰트 로컬 import
├── assets/               # 이미지·아이콘 등 정적 자원
├── components/
│   ├── SortableTable.jsx
│   ├── common/           # 공통 UI 컴포넌트
│   │   ├── Badge.jsx     # StatusBadge·HistoryBadge·RequestBadge·RequestStatusBadge 통합
│   │   ├── Btn.jsx
│   │   ├── Field.jsx
│   │   ├── Icon.jsx
│   │   ├── InputField.jsx
│   │   ├── Modal.jsx
│   │   ├── PageHeader.jsx
│   │   ├── Pagination.jsx
│   │   ├── SearchFilter.jsx
│   │   ├── SelectField.jsx
│   │   ├── SummaryCards.jsx
│   │   └── index.js      # 배럴 export
│   └── layout/
│       └── Sidebar.jsx
├── constants/
│   └── index.js          # 전역 상수 (DEPARTMENTS, STATUS_STYLES, C 디자인 토큰 등)
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
- `STATUS_OPTIONS`: 사용중 / 미사용 / 수리중 / 분실 (`ASSET_STATUS` 객체에서 파생, 내부 전용)
- `ASSET_TYPES`: 노트북, 데스크탑, 모니터, 키보드/마우스, 프린터/복합기, TV, 네트워크 장비, 비품, 차량, 기타
- `STATUS_COLORS`: 차트 점 색상 / `STATUS_STYLES`·`HISTORY_STYLES`·`REQUEST_STYLES`·`REQUEST_STATUS_STYLES`: `Badge.jsx`가 쓰는 배경·글자색 쌍
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
- `backend/main.py`가 `dist/`(프론트 빌드 결과물) 존재 시 `/`에 정적서빙 마운트 → 백엔드 API + 프론트 화면이 **단일 주소**(트레이 스크립트 상단 `HOST`/`PORT`, 현재 **`192.168.0.189:8011`** — 포트는 사내 PTO 프로젝트가 8001을 이미 쓰고 있어 충돌 방지용으로 변경됨)로 통합 서빙됨
- `tray_AssetHub.py` 실행 시: `dist/` 없으면 `npm run build` 1회 자동 실행 → `backend/`를 cwd로 uvicorn(`main:app`)을 무창(CREATE_NO_WINDOW) 백그라운드 프로세스로 기동 → 브라우저 자동 오픈 → 트레이 아이콘(초록/빨강, `/api/health` 10초 폴링) 표시
- 우클릭 메뉴: 브라우저 열기 / 접속주소 표시 / 종료(백엔드 프로세스까지 taskkill로 정리)
- 바탕화면 실행: `tray_AssetHub.bat` (PTO의 `tray.py`용 bat과 동일 패턴 — `start "" /b c:\python314\pythonw.exe "%~dp0tray_AssetHub.py"`, 콘솔창 없이 백그라운드 기동). 바탕화면 바로가기(`AssetHub.lnk`)가 이 bat을 가리킴
- 직접 실행 시: `c:\python314\python.exe tray_AssetHub.py` (전역 python314에 `pystray`, `Pillow` 설치되어 있어야 함, `backend/requirements.txt`에는 미포함 — 트레이 전용 의존성이라 별도)

**프론트 API_BASE 분기 (중요)**:
- 프로덕션 빌드(`npm run build`, 트레이가 서빙하는 `dist/`)는 `src/api.js`의 `API_BASE` 기본값이 빈 문자열(`""`) → 페이지를 서빙 중인 origin으로 **상대경로 fetch**. 트레이 스크립트의 `HOST`/`PORT`를 바꿔도 재빌드만 하면 자동으로 맞음
- 개발서버(`npm run dev`, 포트 5173)만 `.env.development`의 `VITE_API_BASE`로 백엔드 주소 고정
- **주의**: 트레이 `PORT`를 바꿨는데 `dist/`가 옛 설정으로 이미 빌드되어 있으면 `dist/` 폴더를 지우고(`rm -rf dist`) `npm run build` 재실행 필요 (트레이는 `dist/` 존재 시 재빌드 스킵하므로 자동으로 갱신되지 않음)

**겪은 이슈 (2026-07-10)**: 트레이 `PORT`를 8001→8011로 변경 후 로그인 시 `Failed to fetch` 발생. 원인은 `dist/`가 옛 `VITE_API_BASE=http://localhost:8001` 하드코딩 상태로 빌드되어 있었기 때문(Vite 환경변수는 빌드 시점에 번들에 고정됨, 런타임 변경 불가). 위 "API_BASE 분기" 방식으로 근본 수정.

**겪은 이슈 2 — 포트 점유 잔존 프로세스**: 개발/테스트 중 터미널에서 직접 띄운 `uvicorn main:app --port 8001` 프로세스가 정상 종료되지 않고 백그라운드에 잔존, PTO(포트 8001) 화면 대신 AssetHub 화면이 뜨는 혼선 발생. `netstat -ano | grep :8001`로 LISTENING PID 확인 → `wmic process where "ProcessId=<PID>" get CommandLine`으로 정체 확인 후 `taskkill /F /PID <PID>`로 정리. **교훈**: 터미널에서 백엔드 임시 기동 시 반드시 확실히 종료 확인할 것(bash 백그라운드 job의 `kill %1`이 실제 Windows 프로세스까지 못 죽이는 경우 있음).

**admin 로그인 계정**: 이메일 `admin` (기존 테스트 계정 `admin@test.com`에서 변경, 비밀번호는 별도 관리 — 문서에 평문 기재하지 않음). 계정정보 변경은 `backend/seed_admin.py` 로직 참고해 `backend/auth.py`의 `hash_password`로 직접 UPDATE. admin 외 구성원 계정은 [임시 비밀번호 발급](#3-구성원-관리)으로 처리.

---

## 외부 접속 정책 — 사내망 전용

**2026-09-03 결정**: 이 시스템은 사내망 고정 IP `192.168.0.189:8011`로만 접속한다. 도메인(DNS) 접속, 외부 공개, 인터넷 경유 접근은 지원하지 않는다.

**적용 지점**

| 위치 | 설정 |
|------|------|
| `tray_AssetHub.py` 상단 | `HOST = "192.168.0.189"`, `PORT = 8011`, `BASE_URL = f"http://{HOST}:{PORT}"` |
| uvicorn 바인딩 | `host="{HOST}"` — 이전 `0.0.0.0`(전체 인터페이스)에서 변경 |
| `backend/main.py` CORS | `ALLOWED_ORIGINS` 기본값이 해당 IP만 (`:8011`, 개발서버용 `:5173`) |
| `.env.development` | `VITE_API_BASE=http://192.168.0.189:8011` |
| QR 코드 (`AssetPage.jsx`) | `window.location.origin` 기반 — 접속한 주소를 그대로 따라감 |
| 폰트 | `pretendard` npm 패키지 로컬 번들 — 외부 CDN 요청 제거 |

**주의사항**

- **`localhost:8011`로는 접속되지 않는다.** 지정 IP에만 바인딩되므로 이 PC에서도 `192.168.0.189:8011`을 써야 한다
- **이 PC의 IP가 바뀌면 서버가 기동되지 않는다** (바인딩 실패). 2026-09-03 기준 **라우터에 MAC 기반 DHCP 예약이 설정되어 있어** 재부팅해도 `192.168.0.189`가 유지된다. 어댑터 자체는 정적 IP가 아니므로 `Get-NetIPAddress`의 `PrefixOrigin`은 `Dhcp`로 표시되는 것이 정상 — 이걸 미설정으로 오인하지 말 것
- 라우터 교체·초기화 등으로 예약이 풀려 IP가 바뀌었다면, `tray_AssetHub.py`의 `HOST` 한 줄을 새 IP로 고치고 트레이 재시작
- 설정 변경 후에는 **트레이를 반드시 재시작**해야 적용된다 (기존 프로세스는 옛 바인딩 유지)
- 프론트 자산(JS/CSS/폰트/이미지)과 API 요청 모두 자기 origin으로만 나간다. 외부 도메인 요청 0건 상태를 유지할 것 — 새 라이브러리를 CDN `<link>`/`<script>`로 넣지 말고 npm 의존성으로 번들할 것

**과거 흔적 (제거 완료)**: QR 코드가 Supabase/Vercel 시절 배포 주소(`assetmanagement-seven.vercel.app`)를 하드코딩하고 있어, 라벨을 출력해 스캔하면 접속이 불가능했다. 2026-09-03 `window.location.origin` 기반으로 교체.

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

#### 버그 수정 (2026-07-10 세션)
- **`assetService.js`**: `updated` 블록에 history insert 없음 → 자산 수정 시 이력 DB 미저장 (기존 버그). 수정 완료
- **이력 표시 레이아웃**: 긴 note(수리 메모)로 인한 from→to 컬럼 세로 쪼개짐 수정 (nowrap + ellipsis)

---

### 2026-09-03 — 방치 2개월 후 복구 + 생애주기 전수 검증

**렌더 크래시 3건** (미완성 상태로 커밋되어 있었음 — 빌드는 통과하나 런타임에 터짐)
- `SummaryCards.jsx`: `return` 누락 → 이걸 쓰는 6개 페이지 전부 렌더 실패. 로그인 직후 대시보드부터 터지던 상태
- `RequestBadge`/`RequestStatusBadge`: `REQUEST_STYLES`/`REQUEST_STATUS_STYLES` 미정의 (import는 `C`만) + `RequestPage`에 import 자체가 없었음
- `Dashboard.jsx`: `CustomTooltip`을 렌더 함수 내부에 정의 → 매 렌더 재생성

**생애주기 결함 3건** (등록→배정→수리→요청승인→실사→폐기→퇴직반납 실측으로 발견)
- **폐기 필터 누락**: `isDisposed` 필터가 `AssetPage.jsx` 한 곳에만 존재. 대시보드 집계·엑셀 리포트·실사 대상·구성원 배정현황에 폐기 자산이 계속 포함됐고, 폐기 시 `status`를 `"미사용"`으로 덮어써서 **배정요청 목록에까지 노출**됐음. 각 페이지에 `activeAssets`를 두어 표시·선택 지점만 필터
  - ⚠️ `App.jsx`에서 필터해 내리면 안 됨. `MemberPage`/`RequestPage`/`InspectionPage`가 `setAssets(assets.map(...))`로 전체 배열을 되돌려주는 구조라, 필터된 배열을 받으면 `assetService`의 diff가 폐기 자산을 `removed`로 판정해 **DB에서 실제 삭제**함
- **admin 외 로그인 불가**: 백엔드는 "관리자에게 임시 비밀번호 발급을 요청하세요"라 안내하는데 발급 UI가 없었음(`api.members.resetPassword` 호출처 0). → 임시 비밀번호 발급 기능 신설
- **QR 죽은 주소**: Vercel 시절 주소 하드코딩 → `window.location.origin` 기반으로 교체

**정리**: 배지 4개 파일 → `Badge.jsx` 1개 통합, 미사용 import/변수 20건 제거, `select_all()`·`components/index.js`·`structure.txt`·`start_Asset_mgmt.bat` 삭제, `file-saver` 의존성 제거(`XLSX.writeFile`로 대체). eslint 44건 → 7건(남은 건 전부 `set-state-in-effect` 계열)

**검증 수단 추가**: `npm run smoke` — `return` 누락 같은 렌더 실패는 빌드가 잡지 못하므로 SSR 렌더로 확인

---

### 2026-10-26 — 실운영 전환 설계 (진행중, 코드 미변경)

첫 실운영 시작. 기존 IT자산 약 230대 이관 → 11월 하순 QR 라벨·실사 → **2026-12-01 기준일 확정**. 아래 문서 기준으로 단계별 구현 예정이며, **이 섹션 위·아래의 설명(하드코딩 부서 7개, 상태 4개, 이메일 로그인 등)은 1단계 구현 후 대체된다.**

**설계 문서** (기획 담당 Claude와 주고받는 자기완결 문서, 코드 접근 없이 읽히도록 작성)
- `docs/운영전환_설계안_v2.1.md` — **최신 변경분 (2026-10-27).** 사번 삭제(식별=내부 id, 로그인=`loginId`), 부서는 법인과 분리된 공통 목록, 구성원 "파트" 추가. v2와 겹치면 이것이 우선
- `docs/운영전환_설계안_v2.md` — v2.1이 바꾸지 않은 나머지는 이것 기준으로 구현. 기획 측 결정 반영, 변경점은 🆕/✏️/💬 표시
- `docs/운영전환_설계안.md` — v1 (이력 보관용)

**합의된 핵심**
- 저장 로직을 서버로 이전: 브라우저는 의도만 전송, 서버가 한 트랜잭션에서 검증→자산 갱신→이력 생성(`recordedBy`=토큰 사용자, `recordedAt`=서버 시각). `assetService`/`memberService`의 배열 diff 방식 폐기
- 마스터 테이블(법인·부서·유형) + 자산·이력의 사용자/부서를 FK로 연결. 구성원 기준 키 = 사번(NOT NULL UNIQUE), email 선택, **로그인 ID = 사번**, permission NULL = 로그인 불가
- 자산번호 `{법인}-{유형}-{4자리}` (예: `DR-NB-0001`), `asset_seq` 카운터로 재사용 금지. 법인 DR/TC/SL, 유형 NB/PC/MN/PH/TV/PR/ET (hasSpecs = NB·PC)
- 상태: 사용중/공용/보관/수리중/분실/**미확인**(이관 시 사용자 모르는 약 60대, 12/1 목표 0건). `CHECK((status='사용중') = (memberId IS NOT NULL))`
- 스키마 변경은 `PRAGMA user_version` 마이그레이션으로 (실데이터 이후 DB 재생성 불가)

**확인된 현행 결함** (1단계에서 수정)
- 엑셀 자산 가져오기 동작 안 함: 파싱 결과에 `id` 없음 → 서버 TypeError 500, 0건 저장 (실측)
- `insert_rows` 실패 시 연결 미해제 → `database is locked` (실측)
- 🔴 JWT 비밀키 기본값(`auth.py`), viewer→admin 권한 승격 가능(`PATCH /api/members`), bootstrap 응답에 `password_hash` 포함, 권한 검사 없는 쓰기 API 다수
- `backup_db.py`가 WAL DB를 `shutil.copy2`로 복사 (→ `Connection.backup()`으로 교체, 2단계)
- QR이 출력 시점 `window.location.origin` 사용 → 서버 설정 `QR_BASE_URL` 하나로 고정 예정 (2단계)

**일정**
- 1단계 (11/10, 약 6~7일): 스키마·마스터·서버 쓰기 API·이력 서버부·구성원(사번 로그인, 일괄등록)·자산 가져오기(dry_run 미리보기, 단일 트랜잭션, 코드표 시트 양식)·권한/잠금/JWT
- 2단계 (11/20, 약 4.75일): **QR 라벨 일괄 출력 먼저**(자산번호 큰 글자 포함) → 실사 흐름(미확인은 [정정]만 허용, 종료 시 기초 자산대장 내보내기 + DB 백업) → 목록 내보내기 → 이력 화면 → 매일 백업 + 트레이 자동 시작
- 3단계 (12/1 이후): 요청 기능 정리, 인사 프로그램 사번 연동(별도 요청 예정), 아래 2순위 이후 로드맵

**미결정** (v2 문서 9장)
- 1단계 착수 전 (답 없으면 기본안): 이력일자 칸 삭제 여부(기본: 삭제), admin 계정 사번(기본: 시스템 계정 `admin`)
- 2단계 전: QR 라벨 용지 규격, 외부 백업 경로(NAS 등), QR 주소(IP 유지 / 사내 도메인 — 도메인이면 위 외부 접속 정책 개정 필요)

**작업 원칙**: 운영 DB(`db/assethub.db`)는 사용자 승인 전까지 건드리지 않음. 테스트는 복사본으로만.

### 2026-10-27 — 1단계 완료 + 운영 DB 교체·이관

- 1단계 전체 구현 완료(브랜치 `feat/phase1-ops-transition`). 설계 v2.1 반영: 사번 없음, 로그인 = `loginId`, 부서 10개(법인과 분리), 구성원 "파트"
- 운영 DB를 새 스키마(user_version 1)로 교체. 구버전 DB는 `db/assethub_legacy_20261027.db`로 보관
- 이관: 구성원 75명 + 시스템관리자, 자산 207대(사용중 114, 미확인 93). 원본은 사내 공유폴더의 `IT자산_대장대조_261027`·`기준정보_초안_261027` (실데이터라 저장소에 넣지 않음)
- 실사 체크용 비고 표시: "법인 확인 필요"(DR 추정 34대), "번호 확인 필요"(12대), "설문 사용자:"(명단에 없는 사용자 9대). 구자산번호 중복 5쌍은 실사에서 정리
- 바탕화면 `AssetHub.lnk`가 없어져 있어 재생성(→ `tray_AssetHub.bat`)
- 이 전환부터는 실데이터가 있으므로 **DB 재생성 금지**. 스키마 변경은 `MIGRATIONS`에 항목 추가로만

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
