# Workflow Guide Decision Algorithm

> 2단계 결정 알고리즘 상세 및 시나리오 검증

## 알고리즘 변수 매핑

1단계 bash 변수 → 알고리즘 변수:

| Bash 변수 | 알고리즘 변수 | 설명 |
|-----------|--------------|------|
| `TASK_COUNT` | `TASK_COUNT` | 총 태스크 수 |
| `INCOMPLETE_COUNT` | `incomplete_tasks` | 미완료 태스크 ([ ] 체크박스) |
| `TASK_COUNT>0 AND INCOMPLETE_COUNT=0` | `all_tasks_completed` | 모든 태스크 완료 |
| `SOURCE_CODE(yes)` | `source_code EXISTS` | src/·app/·lib/에 코드 파일 있음 |
| `AGENT_COUNT` | `AGENT_COUNT` | .claude/agents/*.md 개수 |
| `GOVERNANCE_DONE` | `GOVERNANCE_DONE` | management/project-plan.md 존재 (yes/no) |
| `DOMAIN_COUNT` | `DOMAIN_COUNT` | TASKS.md domain: 필드 유니크 수 |
| `CONFLICT_FILES>0` | git merge conflicts exist | git diff --diff-filter=U 결과 |

---

## 결정 알고리즘 (단순 라우터)

> workflow-guide는 **현재 상태 → 1개 스킬 추천**만 한다.
> 선후 관계(거버넌스, 인프라 설치 등)는 추천된 스킬이 자체 "선행 조건 확인"으로 처리한다.
> **IF-THEN 순서대로 실행. 첫 번째 조건이 참이면 즉시 RETURN.**

```python
ALGORITHM get_recommendation():

  # ① 복구 (최우선)
  IF (state file EXISTS AND INCOMPLETE_IN_STATE > 0) OR git merge conflicts:
    RETURN "/recover"

  # ② 태스크 없음
  IF TASKS.md NOT EXISTS:
    IF docs/planning/06-tasks.md EXISTS:
      RETURN "/tasks-migrate"
    ELSE:
      RETURN "/tasks-init"
  IF TASK_COUNT == 0:
    RETURN "/tasks-init"

  # ③ 유지보수 (기존 코드 + 미완료 태스크)
  IF source_code EXISTS AND incomplete_tasks > 0:
    RETURN "/agile iterate"

  # ④ 소규모 구현
  IF TASK_COUNT < 30 AND incomplete_tasks > 0:
    RETURN "/agile auto"

  # ⑤ 대규모 구현
  IF incomplete_tasks >= 30:
    RETURN "/team-orchestrate"
    # team-orchestrate가 자체적으로 확인:
    #   - Agent Teams 미설치 → install.sh --mode=team 안내
    #   - TASKS.md 포맷 미달 → /tasks-migrate 안내
    #   - 거버넌스 미완료 → /governance-setup 안내

  # ⑥ 완료
  IF all_tasks_completed:
    RETURN "/audit"
    # audit가 자체적으로 확인:
    #   - 기획 문서 없으면 → /governance-setup 안내
```

---

## 시나리오별 추적 검증

| 시나리오 | 초기 상태 | 알고리즘 경로 | 추천 | 스킬이 자체 처리 |
|---------|-----------|--------------|------|-----------------|
| 새 프로젝트 | TASKS.md 없음 | ② | `/tasks-init` | — |
| 레거시 태스크 | 06-tasks.md만 있음 | ② | `/tasks-migrate` | — |
| 소규모 구현 | 20 tasks, incomplete>0 | ④ | `/agile auto` | TASKS 포맷 확인 |
| 대규모 구현 | 100 tasks, incomplete>0 | ⑤ | `/team-orchestrate` | Agent Teams 설치, 거버넌스 안내 |
| 유지보수 | source_code + incomplete>0 | ③ | `/agile iterate` | — |
| 배포 직전 | all_completed | ⑥ | `/audit` | 기획문서 확인 |
| 복구 | state file 미완료 | ① | `/recover` | — |
| merge conflict | git conflicts | ① | `/recover` | — |

---

## 부분 완료 상태 판단 기준

### 기획 완료 기준 (Socrates 기준 7개 문서)

- `01-prd.md`, `02-trd.md`, `03-uxd.md`, `04-database-design.md`, `05-resources.md`, `06-tasks.md`, `07-acceptance-criteria.md`
- 7개 미만 → "기획 진행 중"

### 거버넌스 완료 기준 (5개 산출물)

- `management/project-plan.md` (PM)
- `management/decisions/ADR-*.md` 4개 이상 (Architect)
- `design/system/*.md` 4개 이상 (Designer)
- `management/quality-gates.md` (QA)
- `database/standards.md` (DBA)
- 일부만 존재 → "거버넌스 진행 중"

---

## 알고리즘 적용 규칙

1. **절대 금지**: TASKS.md 내용(제목·목적·설명·주석), 사용자 발언, 프로젝트 이름, 이전 대화 내용은 알고리즘의 입력이 아님
2. **1단계에서 측정한 변수만 사용**
3. **3단계 AskUserQuestion에서 RETURN한 스킬을 반드시 ⭐으로 표시**
