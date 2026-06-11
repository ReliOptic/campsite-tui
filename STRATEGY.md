# Campsite TUI — 구축 전략방안 (v1)

> PRD: `Campsite TUI — Implementation PRD.pdf` (2026-06-11) 기반.
> 목표: 오픈소스를 최대 활용해 "Block, context, action. No drag selection." 제품 테제를
> 가장 빠른 dogfood loop으로 검증한다.

---

## 0. 제품의 실제 목적 (소유자 컨텍스트 — 2026-06-11 확정)

이 제품은 **영리 목적이 아니다.** 실제 목적과 플라이휠:

```
헤르메스 에이전트 교육 (GCP 프리티어 가이드 배포, 비개발자 대상)
  → 비개발자들이 터미널/SSH에서 막히는 페인포인트 발생
  → Campsite TUI가 "실패 블록 복사 → Telegram 공유"로 원격 지원 마찰 제거
  → 어려움을 Campsite TUI GitHub 이슈로 수집 + 오픈소스 유지보수
  → 에이전트 리텐션 상승 (포기 지점 제거)
  → 학습된 고객 니즈가 Campsite Messenger 본체의 가치로 환류
```

따라서 1차 사용자는 PRD의 "agent-heavy developer"가 아니라
**가이드를 따라 GCP VM에 SSH 접속해 명령을 실행하는 비개발자**다.
이들의 환경: Ubuntu 22.04, e2-micro(RAM 1GB + swap 4GB), 지원 채널은 Telegram.
이 재정의가 아래 모든 우선순위를 지배한다 (§10 참조).

## 1. 전략 요약 (TL;DR)

| 결정 항목 | 선택 | PRD 근거 |
|---|---|---|
| 첫 모드 | **Mode B — Run/Workspace (PTY runner)** | §9 "PTY runner가 캡처를 소유하므로 더 신뢰성 높음" |
| 언어/스택 | **TypeScript + Node.js** | §13 Option B + agent 생태계 친화 |
| 캡처 전략 | **node-pty 기반 PTY runner** | §11 Feature 2 허용 경로 중 최고 신뢰성 |
| TUI 프레임워크 | **Ink** (CLI 우선, TUI는 그 위에) | §9 "CLI + minimal TUI browser first" |
| 저장소 | **JSONL (세션별 디렉토리)** → v0.2 SQLite 검토 | §11 Feature 7 권장 구조 그대로 |
| 클립보드 | **clipboardy + 파일 폴백** | §11 Feature 6 |
| LLM/원격 | **없음 (local-first, zero API key)** | §8 Non-negotiable |
| 빌드 순서 | **CLI 코어 먼저 → TUI 브라우저 → Observe 모드(v0.2)** | §9 결정 로직, §19 결정 룰 |

결정 룰(§19): "가장 빠른 실제 dogfood loop을 만드는 경로" — 위 조합이 그 경로다.

---

## 2. 모드 전략: 왜 Run/Workspace 먼저인가

PRD §9의 결정 로직을 그대로 따른다:

```
If reliable observe mode is hard, implement run/workspace mode first.
```

- **Observe 모드(쉘 훅/tmux capture)는 환경 의존성이 크다.** zsh/bash/fish, tmux 유무,
  프롬프트 마커 충돌 등으로 v0.1에서 "캡처 신뢰성" 리스크(§18 Risk 1)가 가장 크다.
- **PTY runner는 명령 실행을 직접 소유**하므로 command/stdout/exit code/duration을
  100% 결정적으로 캡처한다. 색상(ANSI) 보존도 PTY가 유일하게 보장한다.
- Observe 모드는 v0.2에서 **shell preexec/precmd 훅 → tmux capture-pane** 순으로 추가한다.
  (Excellent v0.1 기준 §16의 "tmux integration"은 의도적으로 후순위.)

## 3. 스택 결정: TypeScript + Node.js

§13의 세 옵션 중 Option B를 선택한다. 근거:

1. **Agent 생태계 정합성**: ICP(§6)가 쓰는 도구(Claude Code, Codex CLI, Gemini CLI)가
   전부 Node/Ink 기반. 동일 런타임이면 통합·기여·신뢰가 쉽다. `npx cstui`로 설치 마찰 zero.
2. **검증된 오픈소스 PTY**: node-pty는 VS Code 통합 터미널이 쓰는 라이브러리.
   §13이 우려한 "node-pty complexity"는 run-mode(단일 명령 실행)에선 최소화된다 —
   인터랙티브 셸 전체가 아니라 명령 1개의 lifecycle만 다루기 때문.
3. **Rust(Option C)**: single binary 배포는 매력적이나 초기 iteration이 느려
   "working prototype > stack purity"(§13 Recommendation)에 어긋난다. v1.0 재작성 후보로 보존.
4. **Python(Option A)**: Textual은 빠르지만 배포(pipx)와 npm 중심 ICP 워크플로와 거리가 있다.

### 핵심 오픈소스 활용 맵

| 역할 | 라이브러리 | 선택 이유 |
|---|---|---|
| PTY 캡처 | `node-pty` | VS Code 검증, exit code/duration 정확 |
| TUI 렌더링 | `ink` (+ `ink-text-input`) | Claude Code/Codex CLI와 동일 — agent 시대 실전 검증 |
| 클립보드 | `clipboardy` | pbcopy/xclip/wl-copy/PowerShell 폴백 내장 (§11 F6 그대로) |
| git 컨텍스트 | `git` CLI 직접 호출 (`execa`) | repo/branch/dirty/PR 감지, 의존성 최소 |
| GitHub 컨텍스트 | `gh` CLI (있을 때만) | PR/issue 번호 감지 — optional context (§10.3) |
| ANSI 처리 | `strip-ansi` | Markdown export 시 정제, 원본은 보존 저장 |
| 스키마 검증 | `zod` | config/블록 스키마 런타임 검증 |
| 저장 | Node `fs` + JSONL | 사람이 읽을 수 있는 append-only, 의존성 zero |

참고 오픈소스 제품(코드/패턴 차용 대상):
- **Atuin** (shell history): observe 모드의 shell hook 설계 참고 (v0.2)
- **Warp Blocks**: 블록 경계 UX의 선행 사례 — 단, Campsite는 "터미널 교체가 아닌 레이어"(§5)
- **tmux capture-pane**: v0.2 observe 모드의 재구성 경로

## 4. 아키텍처

```
src/
  index.ts                  # 엔트리 (CLI 디스패치만)
  config/                   # ~/.campsite-tui/config.json 로딩·검증 (zod)
  services/
    context.ts              # cwd/repo/branch/dirty/PR 자동감지 + 수동 설정
    capture.ts              # node-pty 명령 실행 → 블록 생성
    block-store.ts          # JSONL append/read, 세션 디렉토리 관리
    session.ts              # 세션 lifecycle, motif, 요약(결정적, no-LLM)
    export.ts               # Markdown 포맷터 (성공/실패 템플릿, §11 F5)
    clipboard.ts            # clipboardy + exports/ 파일 폴백
  ui/                       # Ink 컴포넌트 (block list, viewer, context bar)
  types/                    # Session, CommandBlock, Context 등 (§10 스키마)
  utils/                    # 순수 함수 (duration 포맷, ANSI 정제 등)
tests/
  unit/                     # services 미러
  integration/              # dogfood 시나리오 자동화 (§17)
```

데이터 저장(§11 F7 권장 구조 그대로):

```
~/.campsite-tui/
├── config.json
└── sessions/sess_<id>/
    ├── context.json
    ├── blocks.jsonl
    └── exports/
```

**설계 원칙: CLI가 진실의 원천, TUI는 그 위의 브라우저.**
모든 기능은 비대화형 CLI로 먼저 노출한다(`cstui run`, `cstui block copy-last`).
TUI는 같은 서비스 레이어를 호출하는 표시 계층일 뿐이다. 이것이 Agent 시대
사용편의성의 핵심이다 — **사람은 TUI를, 에이전트는 동일 CLI를 쓴다.**

## 5. Agent 시대 사용편의성 극대화 (차별화 레이어)

PRD 필수 범위를 지키면서(§12 "Product behavior that must not change"),
구현 주도 확장(§18 Risk 4 응답)으로 다음을 넣는다:

1. **`--json` 출력 모드**: 모든 CLI 명령이 구조화 JSON을 출력 가능.
   에이전트가 블록을 파싱 없이 소비한다. (예: `cstui block last --json`)
2. **에이전트 핸드오프 원라이너**: `cstui block last --format markdown | pbcopy`가 아니라
   `cstui block copy-last` 한 번. 에이전트 프롬프트에 넣기 좋은 결정적 인터페이스.
3. **stdin 파이프 캡처**: `some-command | cstui capture --command "some-command"` —
   PTY 없이도 에이전트가 실행 결과를 블록화 가능 (wrapper 경로, §9 Mode A의 최소 형태).
4. **컨텍스트 자동감지 우선, 수동 오버라이드 허용** (§11 F1): unknown은 `unknown`으로
   정직하게 표기 — 캡처 한계의 정직한 노출(§8)과 일치.
5. **MCP 서버 (v0.3 후보)**: block store를 MCP resource로 노출 → Claude Code 등이
   "최근 실패 블록 보여줘"를 직접 질의. PRD 범위 밖이므로 dogfood 검증 후에만.

## 6. 로드맵 — dogfood loop 최단 경로

각 마일스톤은 사용자 컨벤션대로 **구현 + 타입 + 테스트** 동시 완결, 모듈 단위 진행.

| 단계 | 산출물 | 검증 (Acceptance §16 매핑) |
|---|---|---|
| **M1. 스캐폴드 + 타입** | 프로젝트 구조, §10 스키마(`Session`, `CommandBlock`, `Context`) | strict 빌드 통과 |
| **M2. context 서비스** | cwd/git repo/branch/dirty 자동감지, `cstui context set/show` | AC#2, unknown 표기 |
| **M3. capture + block-store** | `cstui run "<cmd>"` → PTY 실행 → blocks.jsonl 저장 | AC#3, #4 |
| **M4. export + clipboard** | Markdown 템플릿(성공/실패), `cstui block copy-last` | AC#6, #7, #8 |
| **M5. TUI 브라우저** | Ink: context bar + block list(j/k/enter) + viewer + 단축키(§15) | AC#5, 블록 리뷰 |
| **M6. dogfood 검증** | §17 시나리오(GitHub PR Review Handoff) 실제 수행, README | AC 전체 + Strong v0.1 |
| **v0.2** | observe 모드(shell hook→tmux), last-N export, motif 시각화, SQLite 검토 | Excellent v0.1 |
| **v0.3 후보** | MCP 서버, secret redaction, PR comment draft | §11 F8 optional |

M1~M4만으로 "Minimum Working Product"(§16) 10개 항목 중 9개가 충족된다
(#5 블록 리스트 열람은 M4에서 `cstui block list`로 텍스트 충족, M5에서 TUI 충족).
**TUI가 늦어져도 제품 가치는 M4에서 이미 검증 가능** — 이것이 리스크 헤지의 핵심.

## 7. 리스크 대응 (§18 매핑)

| 리스크 | 대응 |
|---|---|
| R1 캡처 신뢰성 | PTY run-mode 먼저 (캡처를 소유). observe는 v0.2. `capture_method` 필드로 신뢰 수준 명시 |
| R2 터미널 UI 과잉 | Ink로 list+viewer만. 임베디드 풀 터미널 에뮬레이션 안 함. 인터랙티브 명령(vim 등)은 v0.1에서 "passthrough + 캡처 제한 경고" |
| R3 범위 과소 | block list/viewer/세션 저장을 v0.1에 포함 (PRD 응답 그대로) |
| R4 범위 과대 | 필수 결과 고정: 블록 + 컨텍스트 + copy/export. MCP·LLM 요약·GitHub 통합은 전부 dogfood 통과 후 |
| (추가) Ink 렌더링 취약성 (§13 Weakness) | 긴 출력은 TUI에서 truncate + "전체는 viewer/export"로 우회. 출력 스트리밍 중에는 Ink 리렌더 최소화(static 영역 사용) |
| (추가) Windows | v0.1은 macOS/Linux 우선. node-pty Windows(ConPTY)는 v0.2 검증 항목 |

## 8. 열린 결정 (§19) — 본 전략의 답

1. 첫 모드 → **Run/Workspace**
2. 저장 → **JSONL** (v0.2에서 SQLite 재평가)
3. CLI 이름 → **`cstui`** 주 명령 + `campsite-tui` alias (bin 두 개 등록)
4. TUI 언어 → **Node/TypeScript**
5. tmux 통합 → **v0.2**
6. stdout/stderr → **v0.1 combined** (PTY 특성상 합류됨, `capture_method`로 명시 — §11 F2 허용)
7. motif → **v0.1 텍스트+이모지 라벨** (🏕️ 등, §10.4 "small label" 충족)
8. GitHub-flavored Markdown → **기본 GFM 1종만** (variant는 수요 확인 후)

## 9. 비개발자 우선 전략 조정 (§0 반영)

§1~§9의 기술 결정은 유지하되, 우선순위가 다음과 같이 바뀐다:

1. **Hero flow 재정의**: "개발자의 PR 핸드오프"가 아니라
   **"가이드 N단계에서 명령이 실패 → `cstui` 열기 → 실패 블록 선택 → 복사 →
   Telegram에 붙여넣기 → 운영자가 즉시 진단"**. dogfood 시나리오(§17)보다
   이 지원 시나리오가 v0.1 검증 기준이다.
2. **설치는 한 줄**: 비개발자가 가이드 슬라이드에서 복사할 수 있는
   `curl -fsSL .../install.sh | bash` 또는 `npx cstui` 한 줄. 헤르메스 설치
   가이드(슬라이드 8단계)에 "8.5단계"로 끼워 넣을 수 있는 형태가 배포 전략의 전부다.
   가이드를 소유하고 있다는 것이 이 제품의 유일하고 강력한 유통 채널이다.
3. **한국어 우선 UI**: 도움말·에러 메시지·단축키 안내는 한국어 기본 + 영어 폴백.
   비개발자에게 영어 TUI는 또 하나의 장벽이다.
4. **저사양 환경 검증**: e2-micro(1GB RAM)에서 동작 확인이 CI 항목.
   Node 런타임은 가이드 7단계에서 이미 설치되는 패키지에 추가돼야 함.
5. **task 필드 = 가이드 단계**: `cstui context set --task "가이드 5단계: 서버 생성"`
   처럼 가이드 단계를 컨텍스트로 쓰면 운영자가 받는 블록만으로 진단 가능.
6. **이슈 환류 경로**: 내보낸 Markdown이 GitHub 이슈 템플릿과 그대로 호환되게 설계
   → 운영자가 받은 블록을 복사 한 번으로 Campsite TUI 이슈로 등록.
7. **수익화 섹션 무효화**: §사업 모델 논의는 적용하지 않는다. 대신 플라이휠 지표로 대체:
   - 지원 1건당 왕복 횟수 (스크린샷 핑퐁 → 블록 1회)
   - 가이드 완주율 / 중도 포기 지점
   - 수집된 이슈 수와 그중 Campsite Messenger 백로그로 환류된 수

**Hermes와의 역할 경계**: Hermes가 살아 있으면 사용자는 에이전트에게 물어보면 된다.
Campsite TUI가 필요한 순간은 정확히 **에이전트가 아직 없거나(설치 중) 죽었을 때**다.
즉 이 제품은 "에이전트 설치·운영의 구조대"이며, 에이전트와 경쟁하지 않는다.

### 9.1 포지셔닝 확정 (2026-06-11, 첫 dogfood 피드백 반영)

첫 dogfood에서 "TUI 화면이 비개발자용 agent inbox가 아니라 터미널 로그 뷰어로
보인다"는 비판을 받았다. 결론은 화면을 inbox로 위장하는 것이 아니라 **역할 분리**다:

| 표면 | 대상 | 역할 |
|---|---|---|
| `cstui run` / `block copy-last` (원라이너) | **비개발자** (가이드 구조 단계) | 화면 학습 없이 한 줄로 실패 블록을 Telegram에 전달 |
| `cstui open` (TUI 화면) | **운영자/개발자** (본인 포함) | 로컬 evidence 블록 브라우저 — 수집·리뷰·복사 |
| 승인/보류/재실행, Cronlet 결과, agent inbox | 비개발자 | **Campsite Messenger(Web/Mobile)의 영역** — TUI에 백엔드 없는 가짜 inbox를 만들지 않는다 |

TUI 표면 언어 원칙: 화살표/Enter/Esc 우선 노출(vim 키 j/k·g/G는 보조로 유지),
설정 안 된 컨텍스트는 나열하지 않음("저장소 미연결" 같은 상태 문구로 대체,
`unknown` 표기는 CLI·JSON 출력에서만 유지 — PRD §11 F1 충족),
목록 상단에 "최근 블록 N개 · 실패 M개" 요약 헤더(inbox 의미론).
TUI 내 명령 실행 패널·재실행(r)은 v0.2 백로그.

## 10. 다음 액션

1. 본 전략 승인 → M1 스캐폴드 착수 (`package.json`, tsconfig strict, 타입 정의)
2. 모듈 단위 진행: 각 마일스톤마다 테스트 실행 결과 보고 후 다음 단계
3. M6 완료 시 §17 dogfood 시나리오 녹화/기록으로 Product Standard(§22) 검증:
   *"I no longer drag terminal scrollback to share agent work. I copy the block."*
