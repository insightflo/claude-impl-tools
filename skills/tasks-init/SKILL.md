---
name: tasks-init
description: TASKS.md 스캐폴딩을 생성합니다. VibeLab 없이 독립 실행 가능.
triggers:
  - /tasks-init
  - 태스크 초기화
  - TASKS 만들어줘
  - 태스크 생성
version: 1.0.0
---

# Tasks Init (Standalone)

> TASKS.md 파일을 대화형으로 생성하는 경량 스킬입니다.
> VibeLab의 `/tasks-generator` 없이 독립 실행 가능합니다.

## 역할

- 프로젝트 정보를 대화형으로 수집
- 레이어 기반 TASKS.md 스캐폴딩 생성
- `/agile auto`와 바로 연동 가능

## 실행 흐름

```
/tasks-init 실행
     ↓
┌─────────────────────────────────────────────────────────────┐
│ 1단계: 프로젝트 정보 수집 (AskUserQuestion)                  │
│   • 프로젝트 이름                                            │
│   • 주요 기능 (3-5개)                                        │
│   • 기술 스택 (선택)                                         │
└─────────────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────────────┐
│ 2단계: 기존 코드 분석 (자동)                                 │
│   • package.json / pyproject.toml 파싱                      │
│   • 디렉토리 구조 스캔                                       │
│   • 기존 TODO 마커 수집                                      │
└─────────────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────────────┐
│ 3단계: TASKS.md 생성                                         │
│   • T0.* (Skeleton) 태스크                                   │
│   • T1.* (Muscles) 태스크                                    │
│   • T3.* (Skin) 태스크                                       │
└─────────────────────────────────────────────────────────────┘
     ↓
┌─────────────────────────────────────────────────────────────┐
│ 4단계: 사용자 확인 + 다음 단계 안내                          │
│   → /agile auto 또는 /multi-ai-run 실행 권장                 │
└─────────────────────────────────────────────────────────────┘
```

## 1단계: 프로젝트 정보 수집

```json
{
  "questions": [
    {
      "question": "프로젝트의 주요 기능을 알려주세요 (예: 사용자 인증, 상품 목록, 결제)",
      "header": "주요 기능",
      "options": [
        {"label": "직접 입력", "description": "기능 목록을 직접 작성"}
      ],
      "multiSelect": false
    }
  ]
}
```

## 2단계: 코드 분석

```bash
# 기술 스택 감지
ls package.json pyproject.toml requirements.txt Cargo.toml go.mod 2>/dev/null

# 디렉토리 구조
ls -d */ 2>/dev/null | head -10

# 기존 TODO 수집
grep -rn "TODO\|FIXME\|XXX" --include="*.ts" --include="*.tsx" --include="*.py" 2>/dev/null | head -20
```

## 3단계: TASKS.md 템플릿

```markdown
# TASKS.md

> 생성일: {date}
> 프로젝트: {project_name}

---

## T0 - Skeleton (구조)

- [ ] T0.1: 프로젝트 초기 설정
- [ ] T0.2: 디렉토리 구조 생성
- [ ] T0.3: 라우팅/네비게이션 설정
- [ ] T0.4: 더미 데이터 구조 정의

## T1 - Muscles (핵심 기능)

{기능별 태스크 자동 생성}

- [ ] T1.1: {기능1} 백엔드 구현
- [ ] T1.2: {기능1} 프론트엔드 구현
- [ ] T1.3: {기능2} 백엔드 구현
- [ ] T1.4: {기능2} 프론트엔드 구현

## T2 - Muscles Advanced (고급 기능)

- [ ] T2.1: 에러 핸들링
- [ ] T2.2: 로딩 상태 관리
- [ ] T2.3: 캐싱 레이어

## T3 - Skin (마무리)

- [ ] T3.1: 디자인 시스템 적용
- [ ] T3.2: 반응형 레이아웃
- [ ] T3.3: 애니메이션/전환 효과
- [ ] T3.4: 접근성 검토
```

## 4단계: 다음 단계 안내

```json
{
  "questions": [
    {
      "question": "TASKS.md가 생성되었습니다. 다음 단계를 선택하세요:",
      "header": "다음 단계",
      "options": [
        {"label": "구현 시작 (/agile auto)", "description": "레이어별 자동 구현"},
        {"label": "모델 분업 (/multi-ai-run)", "description": "Codex/Gemini로 분업"},
        {"label": "수동 진행", "description": "직접 태스크 수정 후 진행"}
      ],
      "multiSelect": false
    }
  ]
}
```

## vs /tasks-generator (VibeLab)

| 항목 | `/tasks-init` (이 스킬) | `/tasks-generator` (VibeLab) |
|------|------------------------|------------------------------|
| 의존성 | 없음 (standalone) | VibeLab 필요 |
| 입력 | 대화형 인터뷰 | 기획 문서 (PRD, TRD) |
| 출력 | 기본 레이어 구조 | Domain-Guarded 상세 구조 |
| 복잡도 | 간단 (10-30개 태스크) | 복잡 (30-200개 태스크) |
| 용도 | 빠른 시작 | 대규모 프로젝트 |

## 관련 스킬

| 스킬 | 관계 |
|------|------|
| `/tasks-migrate` | 기존 레거시 파일 통합 |
| `/agile auto` | 생성된 TASKS.md 실행 |
| `/governance-setup` | 대규모 프로젝트 기획 |

---

**Last Updated**: 2026-03-03 (v1.0.0)
