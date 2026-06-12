# Changelog

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
