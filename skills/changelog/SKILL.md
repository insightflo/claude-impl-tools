---
name: changelog
description: 프로젝트 변경 이력을 조회하고 통계를 분석합니다. 코드 리뷰 전, 배포 준비 시, 특정 파일의 변경 이력 추적 시, 도메인별 활동량 분석 시 사용하세요. "최근 변경사항", "이번 달 변경 이력", "버그 수정 목록" 같은 질문에 응답합니다. /changelog 트리거.
version: 1.1.0
updated: 2026-02-11
---

# Changelog Viewer (변경 이력 조회)

> **`changelog-recorder.js` 훅이 자동 기록한 변경 이력을 조회, 필터링, 통계합니다.**

---

## 스킬 발동 조건

- `/changelog` - 현재 월 최근 이력
- `/changelog --since <날짜>` - 특정 날짜 이후
- `/changelog --domain <도메인>` - 특정 도메인
- `/changelog --type <유형>` - 특정 변경 유형
- `/changelog --stats` - 변경 통계
- `/changelog --file <경로>` - 특정 파일 이력
- "최근 변경 이력 보여줘"
- "order 도메인 변경 이력"

---

## 절대 금지 사항

1. **변경 이력을 수정하지 마세요** - 조회 전용입니다.
2. **YAML 파일을 직접 편집하지 마세요** - `changelog-recorder.js` 훅만 기록합니다.

---

## 명령어 옵션

| 옵션 | 설명 | 예시 |
|------|------|------|
| (없음) | 현재 월 최근 20건 | `/changelog` |
| `--since <날짜>` | 특정 날짜 이후 | `--since 2026-02-01` |
| `--until <날짜>` | 특정 날짜 이전 | `--until 2026-02-07` |
| `--last <기간>` | 최근 N일/주 | `--last 7d`, `--last 2w` |
| `--domain <이름>` | 도메인 필터 | `--domain order` |
| `--type <유형>` | 유형 필터 | `--type fix` |
| `--stats` | 통계 출력 | `--stats` |
| `--file <경로>` | 파일 이력 | `--file discount_service.py` |

**옵션 조합**: `/changelog --domain order --type fix --last 7d`

---

## 실행 단계

```
/changelog [옵션] 수신
    |
    v
[1] 옵션 파싱 (필터 조건 추출)
    |
    v
[2] 대상 YAML 파일 결정 (날짜 범위 기반)
    |
    v
[3] YAML 파일 읽기 및 파싱
    |
    v
[4] 필터 적용 (도메인, 유형, 파일, 날짜)
    |
    v
[5] 정렬 (최신순)
    |
    v
[6] 리포트 출력 (또는 통계 출력)
```

---

### 1단계: 옵션 파싱

| 입력 | 변환 결과 |
|------|-----------|
| `--since 2026-02-01` | `since = 2026-02-01T00:00:00` |
| `--last 7d` | `since = (오늘 - 7일)` |
| `--last 2w` | `since = (오늘 - 14일)` |
| `--domain order` | `domain = "order"` |
| `--type fix` | `type = "fix"` |

### 2단계: 대상 YAML 파일 결정

**저장 위치**: `.claude/changelog/{YYYY-MM}.yaml`

```bash
ls .claude/changelog/*.yaml
```

### 3단계: YAML 파싱

```yaml
entries:
  - date: 2026-02-07T14:30:00
    type: feature
    domain: order
    files:
      - order/services/discount_service.py
    description: "Create discount_service in order"
    impact:
      - "external dependency added: member-api"
```

### 4단계: 필터 적용

1. **날짜 필터**: `date` 필드와 비교
2. **도메인 필터**: `domain` 필드 (부분 일치)
3. **유형 필터**: `type` 필드 (정확 일치)
4. **파일 필터**: `files` 배열 (부분 문자열)

### 5단계: 정렬

필터링된 엔트리를 **최신순** (날짜 내림차순)으로 정렬합니다.

### 6단계: 출력

상세 출력 형식은 `references/output-formats.md`를 참조하세요.

---

## Hook 연동

| 구분 | Hook (`changelog-recorder.js`) | Skill (`/changelog`) |
|------|--------------------------------|----------------------|
| 시점 | Write/Edit 시 자동 실행 | 사용자 요청 시 |
| 동작 | YAML에 엔트리 추가 | YAML 읽기 + 필터 |
| 용도 | 변경 기록 (쓰기) | 변경 조회 (읽기) |

---

## 변경 유형

| 유형 | 판별 기준 |
|------|-----------|
| `test` | 파일 경로에 `tests/`, `test_`, `.test.` 포함 |
| `docs` | 확장자 `.md`, `.rst`, `.txt` |
| `feature` | 새 파일 생성 또는 새 함수 추가 |
| `fix` | 주석에 fix/bug 키워드 |
| `refactor` | 주석에 refactor 키워드 |

---

## 도메인 추출 규칙

| 경로 패턴 | 추출 도메인 |
|-----------|-------------|
| `src/domains/<domain>/...` | `<domain>` |
| `domains/<domain>/...` | `<domain>` |
| `app/services/<domain>_service.py` | `<domain>` |
| (해당 없음) | `root` |

---

## 관련 스킬 연동

| 스킬 | 연동 시점 | 용도 |
|------|-----------|------|
| `/impact <file>` | 변경이 많은 파일 발견 시 | 영향도 분석 |
| `/deps <domain>` | 교차 도메인 변경 발견 시 | 의존성 확인 |
| `/coverage <file>` | 변경이 잦은 파일 발견 시 | 커버리지 확인 |

---

## 참조 문서

- `references/output-formats.md` - 출력 형식 상세
- `references/examples.md` - 사용 예시
