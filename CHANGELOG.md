# Changelog

## 0.2.0 — 2026-06-13

> npm `0.1.0` 이후 누적된 첫 기능 릴리스. 미게시였던 `0.1.1`(PTY 증거 무결성 패치)을 포함한다.

### Added

- `cstui doctor` — 설치 직후 Node·PTY spawn·블록 저장소·git·클립보드·터미널(OSC 52) 경로를 점검하는 환경 진단 (PR #6, `--json` 지원).
- `cstui capture --command "..." --exit-code N` — stdin 파이프 출력을 `stdin_pipe` 블록으로 저장하는 에이전트 ingress (PR #12). `--exit-code` 필수로 결과를 추측하지 않음.
- `context --json` 확장 — `schema_version`, `detected.repo_root`, 자격증명 제거된 `detected.remote_url`, `environment`(node·platform·package_manager·package·terminal) 핸드오프 페이로드 (PR #7).

### Changed

- `CaptureMethod`에서 미구현 `wrapper` 값을 제거(타입·zod 스키마). 기존 블록 역호환 영향 없음 (PR #12).

### Fixed

- PTY 종료 후 마지막 출력(tail)이 블록에 기록되기 전 유실되던 문제를 해결 — `onExit` 후 bounded drain 윈도로 출력을 계속 버퍼링 (PR #9). `seq 1 5000` ×10 회귀 테스트로 보증.
- Linux 고정 1초 drain floor 제거 — 소량 출력은 빠르게 resolve, 대용량 출력만 quiet-window로 tail 보존, watchdog은 hang 상한 전용 (PR #11).

### Notes

- 알려진 한계: Linux 대용량 출력은 종료 후 최대 ~1초 tail-drain 지연 (속도보다 증거 무결성 우선). 후속 이슈 #10에서 추적.
- npm publish는 이 커밋이 수행하지 않음 — 게시는 메인테이너 OTP 수동 단계.

## 0.1.0 — 2026-06-11

### Added

- Initial public release of Campsite TUI: local terminal command capture, append-only block storage, context metadata, redacted copy/export surfaces, and TUI block browsing.
