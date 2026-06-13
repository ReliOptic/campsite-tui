# Changelog

## Unreleased (main)

> `0.1.0` 게시 이후 main에 머지됐으나 아직 npm에 게시되지 않은 변경.
> 다음 릴리스 버전(0.1.x 패치 누적 vs 0.2.0 — 기능 추가 포함)은 메인테이너 결정 대기.

### Added

- `cstui doctor` — 설치 직후 Node·PTY spawn·블록 저장소·git·클립보드·터미널(OSC 52) 경로를 점검하는 환경 진단 (PR #6, `--json` 지원).
- `cstui capture --command "..." --exit-code N` — stdin 파이프 출력을 `stdin_pipe` 블록으로 저장하는 에이전트 ingress (PR #12). `--exit-code` 필수로 결과를 추측하지 않음.
- `context --json` 확장 — `schema_version`, `detected.repo_root`, 자격증명 제거된 `detected.remote_url`, `environment`(node·platform·package_manager·package·terminal) 핸드오프 페이로드 (PR #7).

### Changed

- `CaptureMethod`에서 미구현 `wrapper` 값을 제거(타입·zod 스키마). 기존 블록 역호환 영향 없음 (PR #12).

### Fixed

- Linux 고정 1초 drain floor 제거 — 소량 출력은 빠르게 resolve, 대용량 출력만 quiet-window로 tail 보존, watchdog은 hang 상한 전용 (PR #11).

## 0.1.1 — 2026-06-12

### Fixed

- Preserved PTY tail evidence after process exit. `captureCommand` now keeps buffering output for a bounded drain window after `onExit`, so fast Linux commands do not lose their final output chunk before the block is recorded.
- Added a regression test that captures `seq 1 5000` ten times and verifies the tail value `5000` is present without truncation.

### Verification

- Local: `npm test -- tests/unit/services/capture.test.ts` → 1 file / 7 tests passed.
- Local: `npm run typecheck`, `npm test`, `npm run build`, `git diff --check` all passed.
- CI: PR #9 passed both `ubuntu-latest` and `macos-latest`.

### Notes

- This is a patch release candidate for the Linux evidence-integrity fix from PR #9.
- Follow-up issue #10 tracks non-blocking improvements: detach stdin immediately at exit and reduce Linux's conservative bounded drain latency when safe.
- npm publish is intentionally not performed by this commit; publish still requires maintainer OTP.

## 0.1.0 — 2026-06-11

### Added

- Initial public release of Campsite TUI: local terminal command capture, append-only block storage, context metadata, redacted copy/export surfaces, and TUI block browsing.
