# Campsite TUI

**터미널 출력을 드래그 없이, 컨텍스트가 붙은 블록으로 복사한다.**

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
| 개발자/운영자 | `cstui open` (TUI 화면) | 로컬 evidence 블록 수집·리뷰·복사 |

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
GCP e2-micro(RAM 1GB) 프리티어에서 동작 확인됨.

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

## 명령 레퍼런스

| 명령 | 설명 |
|---|---|
| `cstui run "명령"` | 명령 실행 + 블록 저장 (출력은 평소 터미널 그대로) |
| `cstui block copy-last` | 마지막 블록을 Markdown으로 클립보드 복사 |
| `cstui block copy-last --format output\|command` | 출력만 / 명령만 복사 |
| `cstui block copy-last --max-lines 40` | 긴 출력을 head+tail로 줄여 복사 (Telegram 4096자 대응) |
| `cstui block list [--n 10] [--json]` | 최근 블록 목록 |
| `cstui block last [--json]` | 마지막 블록 상세 |
| `cstui context` / `context set --task "..."` | 컨텍스트 확인/설정 (`--agent`, `--mode`, `--motif`) |
| `cstui open` | TUI 블록 브라우저 (↑↓ 이동 · Enter 보기 · c 복사 · ? 도움말) |
| `--json` | 모든 조회 명령에서 에이전트가 소비 가능한 JSON 출력 |
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

## 알려진 한계 (v0.1)

- **stdout/stderr가 병합 저장됩니다** (PTY 특성). 블록의 `capture_method: "pty_runner"`가 이를 표시합니다.
- `vim`, `htop` 등 전체화면 명령은 실행은 되지만 캡처가 제한되며, 블록에 "인터랙티브" 표시가 붙습니다.
- 블록당 출력 저장 한도 2MB (초과 시 head+tail 보존, 중간 생략 표시).
- 기존 셸 세션 감시(observe 모드)는 아직 없습니다 — `cstui run`으로 실행한 명령만 캡처됩니다.
- Windows 미지원 (macOS/Linux 전용).

## 개발

```bash
npm install        # 의존성 설치 (node-pty 권한 보정 포함)
npm run typecheck  # TypeScript strict 검사
npm test           # vitest (74 tests)
npm run build      # dist/ 빌드
```

문서: [STRATEGY.md](STRATEGY.md) (제품 전략) · [TECH-SPEC.md](TECH-SPEC.md) (기술 명세·스파이크 실측) · [docs/dogfood.md](docs/dogfood.md) (검증 시나리오)

## 라이선스

MIT
