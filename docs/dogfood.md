# Dogfood 시나리오 — v0.1 검증 기록

두 시나리오로 제품을 검증한다. 시나리오 B가 이 제품의 존재 이유다 (STRATEGY.md §9).

## 시나리오 A — GitHub PR Review Handoff (PRD §17)

```bash
cd <git 저장소>
cstui context set --agent Codex --mode review --task "review PR #1"
cstui run "gh pr view 1 --comments"
cstui run "npm test"
cstui block copy-last          # 실패/성공 블록 복사
# → GitHub 코멘트/Telegram/다른 에이전트에 붙여넣기
```

확인 항목 (PRD §17 그대로):
- [ ] 드래그 선택을 쓰지 않았다
- [ ] 컨텍스트(repo/branch/task/exit/duration)가 보존됐다
- [ ] 출력이 읽을 수 있는 상태다
- [ ] 수동 정리가 필요 없었다

**2026-06-11 실측**: 통과. 클립보드에 Markdown 블록 확인,
명령·출력 양쪽의 JWT가 `[REDACTED:jwt]`로 마스킹됨.

## 시나리오 B — 비개발자 원격 지원 (Hero Flow)

상황: 수강생이 헤르메스 가이드 N단계에서 명령 실패 → 운영자가 Telegram으로 원격 진단.

```bash
# 수강생 (GCP VM, SSH 접속 상태)
cstui context set --task "가이드 8단계: Hermes 설치"
cstui run "hermes doctor"          # 실패 재현
cstui block copy-last              # OSC 52로 로컬 클립보드에 복사됨
# → Telegram 단톡방에 붙여넣기
```

운영자가 받는 것: 어느 단계에서, 어떤 명령이, 어떤 출력과 종료코드로
실패했는지가 붙은 블록 1개. 스크린샷 핑퐁 없음.

확인 항목:
- [ ] VM(SSH)에서 복사가 동작한다 (Ghostty/iTerm2 — Terminal.app은 파일 폴백)
- [ ] 시크릿(portal 토큰 등)이 마스킹된 채 전달된다
- [ ] 운영자가 블록만 보고 단계·원인을 특정할 수 있다
- [ ] 지원 1건당 메시지 왕복이 줄었다 (목표: 스크린샷 대비 ≤ 1/2)

**상태**: 실사용 검증 대기 — 다음 교육 세션에서 수강생 1명으로 측정.

## 플라이휠 지표 (STRATEGY.md §9)

| 지표 | 측정 방법 | 기준선 |
|---|---|---|
| 지원 1건당 왕복 수 | Telegram 스레드 메시지 수 | 스크린샷 방식 대비 |
| 가이드 완주율 | 9단계 완료 보고 / 시작 인원 | 도입 전 세션 |
| 이슈 환류 | 블록 → GitHub 이슈 등록 수, 그중 Campsite Messenger 백로그 반영 수 | 0에서 시작 |
