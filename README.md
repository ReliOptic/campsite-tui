# Campsite TUI

**터미널 실행을 "전달 가능한 작업 단위"로 — provenance와 함께 캡처하고, 기본 마스킹으로 신뢰하고, 다른 사람·에이전트가 질문 없이 이어받는다.**

```
블록, 맥락, 액션.
드래그 선택 없음.
터미널 출력은 agent 작업의 evidence surface가 된다.
```

명령 실행 결과를 repo·branch·task·agent·종료코드가 붙은 "블록"으로 저장하고,
한 줄 명령으로 Telegram·GitHub·다른 에이전트에 붙여넣을 수 있는 Markdown을 복사합니다.
**전부 로컬에서 동작합니다 — 원격 업로드 없음, LLM 없음, API 키 없음.**

## 누구를 위한 것인가

| 사용자 | 쓰는 것 | 목적 |
|---|---|---|
| 에이전트를 운영하는 비개발자 | `cstui run` + `cstui block copy-last` 두 줄 | 막혔을 때 스크린샷 대신 블록을 복사해 단톡방에 붙여넣기 |
| 개발자/운영자 | `cstui open` (TUI 화면) · `cstui capture` (파이프) | 로컬 evidence 블록 수집·리뷰·복사 |
| 에이전트(Claude Code·Hermes·Codex 등) | `cstui capture`로 자기 실행을 밀어넣고, `--json`으로 소비 | 작업 단위를 구조화해 주고받기 |

## 상태 & 로드맵

이 제품은 터미널 작업이 신뢰 손실 없이 세 경계를 통과하면 "완성"이다:

| 경계 | 의미 | 상태 |
|---|---|---|
| **프로세스 경계** | 터미널을 닫아도 작업 상태가 살아있다 | ✅ 완료 (append-only 블록 저장) |
| **시크릿 경계** | 외부에 공유해도 유출이 없다 | ✅ 완료 (기본 마스킹) |
| **마음의 경계** | 받은 사람·에이전트가 추가 질문 없이 이어간다 | 🚧 진행 중 (handoff) |

### 출시 상태

- **npm `0.1.0`** (게시됨) — 최초 공개 릴리스.
- **main (미게시)** — `0.1.0` 이후 `cstui doctor`, `cstui capture`(stdin), `context --json` 핸드오프 페이로드 확장,
  PTY 증거 무결성(Linux tail drain) 픽스가 추가됨. 다음 릴리스 대기 중 (게시는 메인테이너 OTP 수동 단계).

### 로드맵

| 단계 | 항목 | 상태 |
|---|---|---|
| 캡처 | `cstui run` (PTY) · `cstui capture` (stdin 파이프) | ✅ |
| 저장 | `blocks.jsonl` append-only · 세션 · 2MB head+tail 캡 | ✅ |
| 신뢰 | 시크릿 마스킹 · 캡처방법(provenance) · 증거 무결성 drain | ✅ |
| 컨텍스트 | `cstui context` · `context --json` (repo_root·remote_url·environment) | ✅ |
| 공유 | `cstui block copy-last` (markdown/output/command) · 클립보드 폴백 | ✅ |
| 리뷰 | `cstui open` TUI (목록·뷰어·복사) | ✅ |
| 진단 | `cstui doctor` (Node·PTY·저장소·git·클립보드·터미널) | ✅ |
| **핸드오프** | `cstui handoff --as prompt` — 에이전트 이어받기 패키지 | 🚧 다음 (이슈 #2) |
| 컨텍스트 신선도 | `cstui context`가 라이브 감지 + 출처 태그 표시 | ⬜ 계획 |
| 콕핏 홈 | 인자 없는 `cstui` = 작업단위 목록 + "이후 새 블록 N" | ⬜ 계획 |
| JSON 계약 | `docs/json-contract.md` + 블록 `schema_version` | ⬜ 계획 |
| Observe 모드 | 셸 훅으로 `cstui run` 없이 친 명령도 캡처 | ⬜ 지평선 (이슈 #3) |

진행 중·계획 작업은 [GitHub 이슈](https://github.com/ReliOptic/campsite-tui/issues)와
설계 근거는 [`docs/PRODUCT-COMPLETION.md`](docs/PRODUCT-COMPLETION.md)를 참고하세요.

## 설치

**한 줄 설치 (macOS / Ubuntu):**

```bash
curl -fsSL https://raw.githubusercontent.com/ReliOptic/campsite-tui/main/scripts/install.sh | bash
```

**소스에서 직접 설치:**

```bash
git clone https://github.com/ReliOptic/campsite-tui.git
cd campsite-tui
npm install && npm run build && npm link
```

요구사항: Node.js 20+ (설치 스크립트가 없으면 자동 설치), macOS 또는 Ubuntu 22.04+.
GCP e2-micro(RAM 1GB) 프리티어에서 동작 확인됨. 설치 직후 `cstui doctor`로 환경을 점검하세요.

## 60초 사용법

```bash
# (선택) 지금 무슨 작업인지 한 줄 적어두기
cstui context set --task "가이드 8단계: Hermes 설치" --agent Hermes

# 명령을 평소처럼 실행 — 결과가 자동으로 블록 저장됨
cstui run "hermes doctor"

# 마지막 블록을 클립보드로 → Telegram/GitHub에 붙여넣기 (Cmd+V)
cstui block copy-last
```

붙여넣으면 이런 모양이 됩니다:

````markdown
## Terminal Block — Failed Command

Context:
- Agent: Hermes
- Task: 가이드 8단계: Hermes 설치
- Exit: 1
- Duration: 8.4s
...

Command:
```bash
hermes doctor
```

Error / Output:
```text
✗ Docker  FAILED
```
````

에이전트가 자기 실행을 직접 밀어넣을 수도 있습니다:

```bash
npm test 2>&1 | cstui capture --command "npm test" --exit-code $?
```

## 명령 레퍼런스

| 명령 | 설명 |
|---|---|
| `cstui run "명령"` | 명령 실행 + 블록 저장 (출력은 평소 터미널 그대로) |
| `cstui capture --command "명령" --exit-code N` | stdin 파이프 출력을 블록으로 저장 (에이전트 ingress) |
| `cstui block copy-last` | 마지막 블록을 Markdown으로 클립보드 복사 |
| `cstui block copy-last --format output\|command` | 출력만 / 명령만 복사 |
| `cstui block copy-last --max-lines 40` | 긴 출력을 head+tail로 줄여 복사 (Telegram 4096자 대응) |
| `cstui block list [--n 10] [--json]` | 최근 블록 목록 |
| `cstui block last [--json]` | 마지막 블록 상세 |
| `cstui context [--json]` | 컨텍스트 확인 (`--json`은 repo_root·remote_url·environment 포함 핸드오프 페이로드) |
| `cstui context set --task "..."` | 컨텍스트 설정 (`--agent`, `--mode`, `--motif`) |
| `cstui doctor [--json]` | 환경 진단 (Node·PTY·저장소·git·클립보드·터미널) |
| `cstui open` | TUI 블록 브라우저 (↑↓ 이동 · Enter 보기 · c 복사 · ? 도움말) |
| `--json` | 조회 명령에서 에이전트가 소비 가능한 JSON 출력 (`schema_version` 포함) |
| `--verbose` | 내부 info/debug 로그 표시 |

## 시크릿 마스킹 (기본 ON)

복사·내보내기 시 JWT, Google API key, GitHub/Slack/Telegram 토큰, PEM 개인키,
URL의 `token=`/`key=` 파라미터를 `[REDACTED:종류]`로 자동 마스킹합니다.
명령 문자열 안의 시크릿도 마스킹됩니다. 해제: `--no-redact`.
원본은 로컬 저장소에 그대로 보존됩니다.

## 클립보드 동작 (정직한 안내)

1. **로컬 Mac/Linux**: pbcopy / wl-copy / xclip
2. **SSH 원격(VM)**: OSC 52 시퀀스로 로컬 터미널 클립보드에 직접 전송
   — **Ghostty, iTerm2, kitty, WezTerm, VS Code 터미널에서 동작**합니다.
   macOS 기본 Terminal.app은 OSC 52를 지원하지 않으니 Ghostty/iTerm2를 권장합니다.
3. **실패 시**: `~/.campsite-tui/sessions/<id>/exports/` 에 파일로 저장하고 경로를 알려줍니다.

## 데이터 저장

```
~/.campsite-tui/
└── sessions/<session_id>/
    ├── context.json    # 세션 컨텍스트
    ├── blocks.jsonl    # 블록 (1줄 = 1블록, append-only)
    └── exports/        # 클립보드 폴백 파일
```

모든 데이터는 이 디렉토리에만 존재합니다. 삭제하면 깨끗하게 사라집니다.

## 알려진 한계

- **stdout/stderr가 병합 저장됩니다** (PTY 특성). 블록의 `capture_method`(`pty_runner` 또는 `stdin_pipe`)가 출처를 표시합니다.
- `vim`, `htop` 등 전체화면 명령은 실행은 되지만 캡처가 제한되며, 블록에 "인터랙티브" 표시가 붙습니다.
- 블록당 출력 저장 한도 2MB (초과 시 head+tail 보존, 중간 생략 표시).
- **Linux에서 대용량 출력은 종료 후 최대 ~1초의 tail-drain 지연**이 있습니다 (속도보다 증거 무결성 우선). 소량 출력은 영향 없음.
- 기존 셸 세션 감시(observe 모드)는 아직 없습니다 — `cstui run`/`cstui capture`로 들어온 명령만 캡처됩니다.
- Windows 미지원 (macOS/Linux 전용).

## 개발

```bash
npm install        # 의존성 설치 (node-pty 권한 보정 포함)
npm run typecheck  # TypeScript strict 검사
npm test           # vitest (94 tests)
npm run build      # dist/ 빌드
```

기여는 `agent/<name>` 브랜치 → PR로 진행하며, CI(ubuntu·macos)가 통과해야 머지됩니다.

문서: [STRATEGY.md](STRATEGY.md) (제품 전략) · [TECH-SPEC.md](TECH-SPEC.md) (기술 명세·스파이크 실측) ·
[docs/PRODUCT-COMPLETION.md](docs/PRODUCT-COMPLETION.md) (완성상태·PR 시퀀스) · [docs/dogfood.md](docs/dogfood.md) (검증 시나리오)

## 라이선스

MIT
