# Multi-AI Review Overview

## 워크플로우

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Multi-AI Review Pipeline                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Stage 1: Initial Opinions (병렬 실행)                              │
│  ├── 💎 Gemini CLI → opinion.md (창의적 관점)                        │
│  └── 🤖 Codex CLI → opinion.md (기술적 관점)                         │
│                                                                      │
│  Stage 2: Response Collection                                        │
│  └── 각 응답 수집 및 포맷팅                                          │
│                                                                      │
│  Stage 3: Chairman Synthesis                                         │
│  └── 🧠 Claude가 모든 의견 종합 → 최종 리포트                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## 핵심 특징

### 1. CLI 기반 실행
- MCP 서버 불필요
- 추가 API 비용 없음 (구독 플랜만 사용)
- 간단한 설정 (YAML 파일)

### 2. 병렬 실행
- 모든 멤버가 동시에 실행
- 가장 느린 응답 시간에 의존
- 타임아웃 설정 가능

### 3. Job 기반 관리
- 백그라운드 실행 지원
- 진행 상황 폴링 가능
- 결과 파일로 저장

## 파일 구조

```
skills/multi-ai-review/
├── SKILL.md                    # 스킬 문서
├── council.config.yaml         # 멤버 설정
├── scripts/
│   ├── council.sh              # 메인 실행
│   ├── council-job.sh          # Job 러너
│   ├── council-job.js          # Job 구현
│   └── council-job-worker.js   # 워커
├── templates/
│   └── report.md               # 리포트 템플릿
└── references/
    ├── overview.md             # 이 파일
    ├── config.md               # 설정 가이드
    ├── examples.md             # 사용 예시
    └── requirements.md         # 요구사항
```

## 실행 모드

### One-shot (간단)

```bash
./scripts/council.sh "리뷰 요청 내용"
```

### Job Mode (세밀한 제어)

```bash
# 1. 잡 시작
JOB_DIR=$(./scripts/council.sh start "리뷰 요청")

# 2. 진행 상황 확인
./scripts/council.sh status "$JOB_DIR"

# 3. 결과 확인
./scripts/council.sh results "$JOB_DIR"

# 4. 정리
./scripts/council.sh clean "$JOB_DIR"
```

## 멤버 역할

| 멤버 | 역할 | 주요 검토 항목 |
|------|------|---------------|
| 💎 Gemini | Creative Reviewer | UX, 대안 아이디어, 혁신성 |
| 🤖 Codex | Technical Reviewer | 아키텍처, 패턴, 성능 |
| 🧠 Claude | Chairman | 종합 판정, 최종 리포트 |

## 에러 처리

- `missing_cli`: CLI가 설치되지 않음
- `timed_out`: 타임아웃 초과
- `error`: 실행 오류
- `canceled`: 사용자 취소
