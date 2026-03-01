---
name: security-review
description: OWASP TOP 10 기반 보안 취약점 점검. 시크릿 노출, 인젝션, 인증/인가, 의존성 취약점을 분석합니다. /security-review 트리거.
version: 1.0.0
updated: 2026-03-01
---

# 🔒 Security Review (OWASP TOP 10 보안 점검)

> **목적**: 코드베이스에서 배포 전 반드시 확인해야 할 보안 취약점을 체계적으로 점검합니다.
>
> **핵심 원칙**: 이 스킬은 **분석/리포트 전용**입니다. 자동 수정은 하지 않고, 재현 가능한 근거와 수정 가이드를 제공합니다.
>
> **연동 관계**: `/audit`의 5단계 보안 검증을 독립적으로 수행하는 전용 스킬입니다.

---

## 🔧 MCP 의존성

| MCP | 필수 여부 | 용도 |
|-----|-----------|------|
| 없음 | - | 기본 검색/정적 분석 도구로 점검 |

> 필요 시 외부 SAST/Dependency Scan 도구 결과를 함께 해석할 수 있습니다.

---

## ⛔ 절대 금지 사항

1. ❌ **취약점 악용 코드 작성 금지** - 재현은 안전한 PoC 수준으로만 설명
2. ❌ **근거 없는 단정 금지** - 파일 경로와 코드 라인 기반으로만 보고
3. ❌ **하드코딩된 시크릿을 출력으로 재노출 금지** - 마스킹 처리

---

## ✅ 스킬 발동 시 즉시 실행할 행동

```
1. 점검 범위 확인 (기본: src, app, server, api)
2. 시크릿/자격증명 노출 검사
3. 인젝션(SQL/NoSQL/Command/Template) 패턴 검사
4. 인증/인가 누락 지점 검사
5. 입력 검증/출력 인코딩/XSS 위험 검사
6. 의존성 취약점 검사(가능 시 lockfile 기준)
7. 보안 리포트 작성 + 우선순위 제시
```

---

## 🏗️ 실행 프로세스

### 1단계: 점검 범위 확인

우선 아래 경로를 기준으로 검사합니다:

- `src/`
- `app/`
- `server/`
- `api/`
- 설정 파일 (`.env*`, `docker-compose*.yml`, `*.tf`, `nginx*.conf`)

옵션 예시:

- `/security-review` → 기본 스캔
- `/security-review --path src` → 특정 경로만
- `/security-review --deep` → 정밀 스캔
- `/security-review --summary` → 요약 리포트 중심

### 2단계: 시크릿 노출 점검

점검 항목:

- API Key, Access Token, Private Key 하드코딩
- `.env`/credential 파일의 추적 가능 상태
- 로그에 민감정보 출력 여부

패턴 예시(개념):

- `AKIA...`, `sk-...`, `-----BEGIN PRIVATE KEY-----`
- `password=`, `client_secret`, `jwt_secret`

### 3단계: OWASP TOP 10 핵심 항목 점검

#### A01: Broken Access Control
- 관리자/소유자 검증 누락
- IDOR(객체 직접 참조) 가능 경로

#### A02: Cryptographic Failures
- 평문 저장/전송
- 약한 해시/암호화 알고리즘 사용

#### A03: Injection
- 문자열 결합 SQL/NoSQL 쿼리
- `exec`, `spawn`, `system` 계열 위험 호출
- 템플릿 인젝션 가능 패턴

#### A05: Security Misconfiguration
- 디버그 모드 상시 활성화
- CORS 과다 허용(`*`)
- 안전하지 않은 기본 설정

#### A07: Identification and Authentication Failures
- 토큰 만료/검증 누락
- 브루트포스 방어 부재(rate limit 없음)

#### A08: Software and Data Integrity Failures
- 검증되지 않은 외부 스크립트/패키지 실행
- 서명/무결성 확인 누락

#### A09: Security Logging and Monitoring Failures
- 인증 실패/권한 거부 로그 부재
- 침해 추적용 감사 로그 부재

### 4단계: 의존성 취약점 점검

가능한 경우 다음을 사용:

- Node.js: `npm audit`, `pnpm audit`, `yarn audit`
- Python: `pip-audit`, `poetry audit`
- 컨테이너: 이미지 스캔 결과(있으면 해석)

> 외부 도구 실행이 어려운 환경에서는 lockfile/버전 기반 정적 리스크로 대체 평가합니다.

### 5단계: 리포트 작성

이슈는 반드시 다음 형식으로 보고합니다:

- **심각도**: CRITICAL/HIGH/MEDIUM/LOW
- **카테고리**: OWASP 항목
- **위치**: `file_path:line`
- **근거**: 왜 취약한지 1~2문장
- **권장 수정**: 안전한 구현 방향(코드 전체 제공 대신 원칙)

---

## 📊 출력 형식 (Output Format)

### 1. 보안 점수 요약

```
┌─────────────────────────────────────────┐
│ 🔒 Security Review Summary              │
├─────────────────────────────────────────┤
│ 총점: 82/100                            │
│ 판정: ⚠️ NEEDS FIX                      │
│                                         │
│ 🔴 Critical: 0                          │
│ 🟠 High: 2                              │
│ 🟡 Medium: 3                            │
│ 🟢 Low: 4                               │
└─────────────────────────────────────────┘
```

### 2. 주요 취약점 목록

| 심각도 | OWASP | 내용 | 위치 |
|--------|-------|------|------|
| 🟠 High | A03 Injection | 사용자 입력이 SQL 문자열에 직접 결합됨 | `src/db/userRepo.ts:87` |
| 🟠 High | A01 Access Control | 리소스 소유자 검증 없이 수정 API 호출 가능 | `src/api/post.ts:44` |
| 🟡 Medium | A05 Misconfiguration | CORS `*` 허용 + credentials 활성화 | `server/main.ts:29` |

### 3. 우선순위 조치

1. 🔴/🟠 항목 즉시 수정 후 재검증
2. 인증/인가 공통 가드 및 입력 검증 레이어 보강
3. 시크릿 회수/재발급(노출 정황 존재 시)
4. CI에 보안 스캔 단계 추가

---

## 🛠️ 주요 명령어 대응

| 명령어 | 설명 |
|--------|------|
| `/security-review` | 기본 보안 스캔 실행 |
| `/security-review --deep` | OWASP 항목 정밀 스캔 |
| `/security-review --path <dir>` | 지정 경로만 스캔 |
| `/security-review --summary` | 요약 리포트 출력 |
| `/security-review --owasp` | OWASP 기준 매핑 리포트 |

---

## 🔗 다음 단계 제안

보안 점검 완료 후 상황별 권장:

| 상황 | 권장 스킬 | 설명 |
|------|-----------|------|
| 고위험 취약점 발견 | `/agile iterate` | 우선순위 수정 태스크 생성/수행 |
| 배포 전 종합 검증 | `/audit` | 보안 포함 통합 품질 감사 |
| 코드 품질 동시 개선 | `/code-review` | 2단계 리뷰로 품질 회귀 방지 |
| 반복 취약점 예방 | `/guardrails` | 생성 단계 보안 가드 강화 |

---

## 🪝 Hook 연동

| Hook | 효과 |
|------|------|
| `skill-router` | `/security-review` 키워드 자동 감지 |
| `post-edit-analyzer` | 수정 후 보안 패턴 자동 재검사 |
| `git-commit-checker` | 고위험 취약점 미해결 시 경고 |

---

**Last Updated**: 2026-03-01 (v1.0.0 - 신규 보안 전용 리뷰 스킬 추가)
