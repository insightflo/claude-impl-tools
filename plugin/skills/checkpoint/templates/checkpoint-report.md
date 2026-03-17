# Checkpoint Report Template

> 체크포인트 리포트 출력 형식

---

## Checkpoint Report

### 개요 (Overview)

| 항목 | 값 |
|------|-----|
| **Task** | {{TASK_ID}} - {{TASK_DESCRIPTION}} |
| **Date** | {{TIMESTAMP}} |
| **Commit** | {{COMMIT_HASH}} |
| **Branch** | {{BRANCH_NAME}} |
| **Reviewer** | Claude Checkpoint v{{VERSION}} |

---

### 변경 범위 (Changes)

```diff
**변경 파일**: {{FILE_COUNT}}개
{{FILE_LIST}}
```

| 파일 | 추가 | 삭제 | 수정 타입 |
|------|------|------|-----------|
| {{FILE_PATH}} | +{{ADDED}} | -{{DELETED}} | {{CHANGE_TYPE}} |

---

### 1단계: Spec Compliance (명세 준수)

#### 1.1 요구사항 일치

{{REQUIREMENT_CHECK}}

| 요구사항 | 상태 | 비고 |
|----------|------|------|
| {{REQ_1}} | {{STATUS}} | {{NOTE}} |
| {{REQ_2}} | {{STATUS}} | {{NOTE}} |

#### 1.2 누락 기능 확인

{{MISSING_FEATURES_CHECK}}

| 명세된 기능 | 구현 여부 | 위치 |
|-------------|-----------|------|
| {{SPEC_FEATURE}} | {{IMPLEMENTED}} | {{LOCATION}} |

#### 1.3 YAGNI 위반 검사

{{YAGNI_CHECK}}

- ✅ 명세되지 않은 불필요한 기능: 없음
- ⚠️ 발견: {{YAGNI_VIOLATIONS}}

---

### 2단계: Code Quality (코드 품질)

#### 2.1 아키텍처

{{ARCHITECTURE_REVIEW}}

| 원칙 | 상태 | 이슈 |
|------|------|------|
| SOLID | {{STATUS}} | {{ISSUES}} |
| 관심사 분리 | {{STATUS}} | {{ISSUES}} |
| 의존성 주입 | {{STATUS}} | {{ISSUES}} |

#### 2.2 코드 품질

{{CODE_QUALITY_REVIEW}}

| 항목 | 상태 | 세부 |
|------|------|------|
| 네이밍 | {{STATUS}} | {{DETAILS}} |
| 복잡도 | {{STATUS}} | Cyclomatic: {{CYCLO}}, Cognitive: {{COGNITIVE}} |
| 코드 중복 | {{STATUS}} | DRY 위반: {{VIOLATIONS}}개 |
| 매직 넘버/스트링 | {{STATUS}} | {{VIOLATIONS}} |

#### 2.3 에러 처리

{{ERROR_HANDLING_REVIEW}}

| 항목 | 상태 | 비고 |
|------|------|------|
| 에러 케이스 처리 | {{STATUS}} | {{NOTES}} |
| 에러 메시지 | {{STATUS}} | {{NOTES}} |
| 로깅 | {{STATUS}} | {{NOTES}} |

#### 2.4 테스트

{{TEST_REVIEW}}

| 항목 | 커버리지 | 상태 |
|------|----------|------|
| 단위 테스트 | {{UNIT_COVERAGE}}% | {{STATUS}} |
| 엣지 케이스 | {{EDGE_CASES}} | {{STATUS}} |
| 통합 테스트 | {{INT_COVERAGE}}% | {{STATUS}} |

---

### 3. 연동 분석 (Integration Analysis)

#### 3.1 영향도 (/impact)

{{IMPACT_ANALYSIS}}

- **위험도**: {{RISK_LEVEL}}
- **영향 범위**: {{IMPACT_SCOPE}}
- **영향받는 모듈**: {{AFFECTED_MODULES}}

#### 3.2 의존성 (/deps)

{{DEPS_ANALYSIS}}

- **순환 의존성**: {{CIRCULAR_DEPS}}
- **의존성 변경**: {{DEP_CHANGES}}

#### 3.3 보안 검증 (/security-review)

{{SECURITY_REVIEW}}

| 항목 | 상태 | 세부 |
|------|------|------|
| Injection 공격 | {{STATUS}} | {{DETAILS}} |
| 인증 & 인가 | {{STATUS}} | {{DETAILS}} |
| 데이터 노출 | {{STATUS}} | {{DETAILS}} |
| 암호화 | {{STATUS}} | {{DETAILS}} |

---

### 4. AI 멀티 리뷰 (선택적)

#### 4.1 Gemini 의견

{{GEMINI_OPINION}}

> **요약**: {{GEMINI_SUMMARY}}

#### 4.2 Codex 의견

{{CODEX_OPINION}}

> **요약**: {{CODEX_SUMMARY}}

#### 4.3 종합

{{AI_CONSENSUS}}

---

### 최종 판정 (Verdict)

```markdown
┌─────────────────────────────────────────┐
│  결과: {{VERDICT_EMOJI}} {{VERDICT}}     │
│                                         │
│  점수: {{SCORE}}/100                    │
│  조치: {{ACTION}}                       │
└─────────────────────────────────────────┘
```

| 판정 기준 | 값 | 상태 |
|-----------|-----|------|
| Critical 이슈 | {{CRITICAL_COUNT}}개 | {{STATUS}} |
| Important 이슈 | {{IMPORTANT_COUNT}}개 | {{STATUS}} |
| Minor 이슈 | {{MINOR_COUNT}}개 | {{STATUS}} |

---

### 수정 가이드 (Action Items)

| 우선순위 | 항목 | 파일 | 설명 | 담당 |
|----------|------|------|------|------|
| {{PRIORITY}} | {{ITEM}} | {{FILE}} | {{DESCRIPTION}} | {{OWNER}} |

---

### 다음 단계 (Next Steps)

{{NEXT_STEPS}}

- [ ] {{ACTION_ITEM_1}}
- [ ] {{ACTION_ITEM_2}}
- [ ] {{ACTION_ITEM_3}}

---

**Report Generated**: {{GENERATED_AT}}
**Checkpoint Version**: {{VERSION}}
