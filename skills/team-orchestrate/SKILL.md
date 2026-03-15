---
name: team-orchestrate
description: Claude Code 네이티브 Agent Teams를 활용한 계층적 에이전트 오케스트레이션. TASKS.md를 분석하여 PM Lead + Architecture/QA/Design 팀원으로 구성된 에이전트 팀을 자동 형성하고, Plan Approval + 거버넌스 hooks로 품질을 보장하며 병렬 실행합니다.
triggers:
  - /team-orchestrate
  - 에이전트 팀 실행
  - 팀 오케스트레이트
version: 1.0.0
updated: 2026-03-16
---

# Agent Teams Orchestration

> **목표**: Agent Teams 네이티브 기능으로 계층적 에이전트 팀 실행
>
> **핵심 차별점**: `orchestrate-standalone`이 `claude -p` 서브프로세스를 사용하는 반면,
> 이 스킬은 Claude Code 네이티브 Agent Teams (메일박스 통신, 공유 작업 목록, hooks)를 활용합니다.

---

## 아키텍처

```
Level 0 — Agent Team (네이티브)
  team-lead (PM 리더)
  ├── architecture-lead (Teammate) → Task(builder) / Task(reviewer)
  ├── qa-lead (Teammate)           → Task(reviewer) / Task(test-specialist)
  └── design-lead (Teammate)       → Task(designer) / Task(builder)

통신: Lead ↔ Teammates = 메일박스 (양방향)
위임: Teammate → Subagents = Task tool (단방향)
거버넌스: TeammateIdle hook + TaskCompleted hook
모니터링: whitebox dashboard + 사용자 직접 메시지
```

---

## 실행 흐름

### Step 1: 도메인 분석

스킬이 호출되면 `domain-analyzer.js`로 TASKS.md를 분석합니다:

```bash
node skills/team-orchestrate/scripts/domain-analyzer.js --tasks-file TASKS.md
```

출력: 도메인별 작업 배정 JSON

### Step 2: 팀 형성

domain-analyzer의 출력을 바탕으로 Agent Team을 구성합니다:

1. **team-lead** 에이전트를 리더로 지정
2. 도메인 분석 결과에 따라 필요한 팀원을 활성화:
   - 백엔드/API/아키텍처 작업 → `architecture-lead`
   - 테스트/품질/보안 작업 → `qa-lead`
   - UI/디자인/프론트엔드 작업 → `design-lead`
3. 불필요한 팀원은 비활성화 (예: 프론트엔드 없으면 design-lead 제외)

### Step 3: Plan Approval

모든 팀원은 구현 전 team-lead에게 계획을 제출합니다:

```
Teammate → Plan 제출 → team-lead 검토 → Approved/Rejected
```

승인 기준:
- 작업 범위가 배정된 도메인 내
- 다른 팀원 작업과 충돌 없음
- 기술 표준 준수
- 위험도 적절히 평가됨

### Step 4: 병렬 실행

승인된 계획에 따라 팀원이 병렬 실행합니다:
- 각 팀원은 자신의 도메인 작업을 Task tool로 서브에이전트에게 위임
- 서브에이전트 (builder, reviewer, designer, test-specialist)가 실제 구현
- 팀원 간 충돌 발생 시 team-lead가 중재

### Step 5: 거버넌스 검증

자동 hooks가 거버넌스를 강제합니다:
- **TeammateIdle hook**: 팀원 유휴 시 미완료 작업/에스컬레이션 체크
- **TaskCompleted hook**: 작업 완료 시 경량 품질 게이트

### Step 6: 완료

모든 작업 완료 후:
1. qa-lead가 최종 품질 게이트 실행
2. team-lead가 완료 보고서 작성
3. 사용자에게 결과 보고

---

## 필수 입력

### TASKS.md

`orchestrate-standalone`과 동일한 TASKS.md 포맷을 사용합니다:

```yaml
## T1 - User Resource

- [ ] T1.1: User API 설계
  - deps: []
  - domain: backend
  - risk: low
  - owner: architecture-lead

- [ ] T1.2: User API 구현
  - deps: [T1.1]
  - domain: backend
  - risk: medium
  - files: src/domains/user/*
  - owner: architecture-lead
```

### 도메인 매핑

| 도메인 | 팀원 | 서브에이전트 |
|--------|------|------------|
| backend | architecture-lead | builder, reviewer |
| frontend | design-lead | designer, builder |
| api | architecture-lead | builder, reviewer |
| design | design-lead | designer |
| test | qa-lead | test-specialist |
| security | qa-lead | reviewer |
| shared | architecture-lead | builder |

---

## 설정

### team-topology.json

`skills/team-orchestrate/config/team-topology.json`에서 도메인→팀원 매핑을 커스터마이즈할 수 있습니다.

### 거버넌스 hooks

`.claude/settings.local.json`에 자동 등록됩니다:
- `TeammateIdle` → `project-team/hooks/teammate-idle-gate.js`
- `TaskCompleted` → `project-team/hooks/task-completed-gate.js`

---

## orchestrate-standalone과의 비교

| 관점 | orchestrate-standalone | team-orchestrate |
|------|----------------------|-----------------|
| 실행 방식 | `claude -p` 서브프로세스 | 네이티브 Agent Teams |
| 팀원 통신 | 없음 (독립 실행) | 메일박스 (양방향) |
| hooks 적용 | 미적용 (`-p` 모드) | 완전 적용 |
| 실시간 모니터링 | 제한적 | whitebox + hooks |
| Plan Approval | 없음 | 필수 |
| 충돌 중재 | 없음 | team-lead 중재 |
| 최적 규모 | 30~200 태스크 | 10~80 태스크 |

---

## 사용 예시

### 기본 실행

```bash
/team-orchestrate
```

### TASKS.md 지정

```bash
/team-orchestrate --tasks-file path/to/TASKS.md
```

### 특정 팀원만 활성화

```bash
/team-orchestrate --teammates architecture-lead,qa-lead
```

---

## 관련 스킬

| 스킬 | 관계 |
|------|------|
| `/orchestrate-standalone` | 대규모 병렬 실행 (서브프로세스 방식) |
| `/whitebox` | 실행 모니터링 + 컨트롤 플레인 |
| `/evaluation` | Phase 완료 후 품질 게이트 |
| `/auto-revision` | 자율 개선 루프 |
