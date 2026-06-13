# Codex 루프 큐 — campsite-tui (우선순위 순)

각 항목 = 1 PR. 위에서부터 하나씩. 공통 규칙은 아래 한 번만 정의하고 각 프롬프트가 참조한다.

> **진행 현황 (2026-06-13)**: ✅ L1 (PR #9·#11) · ✅ L4 (PR #12) · ✅ 선행 게이트 PR #7(context --json) 머지됨.
> **다음: L2 (handoff)** — 게이트 해제됨. 이어서 L3·L5·L6·L7. (L5는 L1 머지로 unblock.)
> 신규 후속 이슈: #13(capped 버퍼 중복 추출). 미게시 릴리스 대기 중 (npm 0.1.0).

## 공통 규칙 (모든 프롬프트에 적용)
- 로컬 체크아웃에서 작업. 시작 전 `git checkout main && git pull`.
- 브랜치 `agent/<name>` 생성. **main 직접 커밋 금지, self-merge 금지.**
- 자격증명·npm auth·OTP·recovery code·publish 일절 건드리지 않음.
- 네트워크 호출 추가 금지(로컬 전용 인바리언트). 의존성 추가는 명시 허용 시에만.
- 완료 게이트: `npm run typecheck && npm test && npm run build && git diff --check` 전부 통과해야 커밋.
- 커밋 컨벤션 `<type>(<scope>): <why>`. push 후 `gh pr create --base main`.
- PR 본문: Summary / 문제·연결 이슈 / 변경 범위 / 변경 파일 / 검증 명령과 **실제 출력** / 한계 / 다음 증분 / AI-assisted work note.
- 파일 200줄·함수 50줄 초과 금지. `any` 금지. 기존 JSON/CLI 출력 형태는 테스트 갱신 없이 깨지 않음.

---

## L1 — fix(capture): Linux drain 레이턴시 제거 (이슈 #10) ★다음 작업
**왜 지금**: `EXIT_DRAIN_MIN_MS = MAX = 1000`(linux)이라 모든 `cstui run`이 종료 후 정확히 1초 대기.
Linux는 주력 배포 환경(GCP e2-micro)이라 제품 테제 위반. 고정 floor가 quiet-window를 무력화함.
**의존**: 없음 (즉시 가능).

요구:
1. Linux의 `EXIT_DRAIN_MIN_MS` 고정 floor(현재 1000)를 제거하고, **quiet-window를 넓히는 방식**으로 전환:
   플랫폼별 quiet 값(예: linux 120ms, darwin 30ms 유지)으로 "마지막 onData 이후 quiet만큼 조용하면 종료",
   `EXIT_DRAIN_MAX_MS`(linux 1000)는 안전 상한으로만 유지. 즉 빠른 명령은 ~quiet 후 종료, tail이 늦는 경우만 상한까지.
2. node-pty가 결정적 end-of-stream 신호(데이터 스트림 'end'/'close')를 노출하는지 조사.
   존재하면 타이머 대신 그 신호로 종료(상한은 안전망으로 유지). 없으면 1)의 quiet 방식 채택하고 PR에 근거 기록.
3. `CaptureResult` 공개 형태·`duration_ms`(exit 기준) 불변. `capture.ts` 외 src 수정 금지.

수용 기준:
- 이슈 #8 회귀 테스트(`seq 1 5000` ×10) 유지·통과.
- **신규 측정 테스트**: trivial 명령(`echo hi`) 캡처가 종료 후 quiet+여유(예: linux ≤300ms) 내 resolve — CI 양 플랫폼 통과.
- 스트레스 테스트 타임아웃을 15s→기본(5s) 가깝게 되돌릴 수 있으면 되돌림(불가 시 PR에 사유).
- ubuntu CI에서 plakeness 0 (재실행 없이 1회 통과).

포함 금지: capture 외 기능 변경, observe 모드, stdin 모드(L4 별도).

---

## L2 — feat(handoff): `cstui handoff` 3포맷 (이슈 #2 흡수) ★제품의 마지막 조각
**왜 지금**: "전달 가능한 작업 단위"의 egress 절반. 받은 에이전트가 되묻지 않고 이어가게 하는 킬러 표면.
**의존**: **PR #7(context --json) 머지 후** (environment/context payload 재사용). #7 미머지면 이 작업 보류.

요구:
1. `src/services/handoff.ts` 신설: context payload(detected+environment, PR #7) + 선택 블록 N개 + 수신자 지시문을
   하나로 묶는 순수 함수. 저장 안 함.
2. `cstui handoff [--last N=1] [--as markdown|json|prompt] [--no-redact]`:
   - markdown: 사람용. 컨텍스트 헤더 + 블록들(기존 export 포맷 재사용) + provenance 푸터.
   - json: schema_version 포함, 에이전트/스크립트 소비.
   - **prompt: 에이전트 재시작용** — "다음 작업을 이어가라" 지시문 + 컨텍스트 + 실패/최근 블록 증거. 차별화 핵심.
   - 클립보드/파일 폴백은 기존 `clipboard.ts`·`copy-block.ts` 경로 재사용.
3. 마스킹 기본 ON(인바리언트), 명령 문자열까지 — 기존 redact 경로 통과.

수용 기준:
- 골든 테스트 3종(markdown/json/prompt) + 마스킹 단언 + 무세션 시 안내.
- "충분성 체크리스트" 테스트: prompt 출력에 task·repo·branch·exit·output·지시문이 모두 존재.
- PRD §14 `export session`을 별칭으로 등록(`cstui export session`→handoff markdown).

포함 금지: 저장/히스토리, TUI `h` 키(후속 PR), 새 마스킹 패턴.

---

## L3 — fix(context): 라이브 감지 + 출처 태그 (의존: PR #7 머지)
**왜**: `context` show가 세션 생성 시점 스냅샷 렌더(dirty만 라이브) → "출처·신선도 표기" 인바리언트 위반.
요구: show가 repo/branch/dirty를 호출 시점 라이브 값으로 렌더, 수동 필드(task/agent/mode)에 `(set)` 출처 태그.
`run` 실행 시 세션의 repo/branch를 갱신. 수용: branch 변경 후 show=라이브 테스트, JSON 형태 불변(또는 테스트 갱신).
포함 금지: 스키마 개편.

---

## L4 — feat(capture): stdin 파이프 모드 + `wrapper` 죽은 타입 제거
**왜**: `CaptureMethod`의 `'stdin_pipe'|'wrapper'`가 타입 선언만 존재(거짓말). stdin은 에이전트가 자기 실행을 밀어넣는 ingress.
요구: `cmd | cstui capture --command "cmd" --exit-code $?` → stdin 읽어 블록 저장(capture_method='stdin_pipe').
`--exit-code` 필수(에이전트는 `$?`를 앎). `CaptureMethod`에서 `'wrapper'` 제거(미구현). 의존: 없음(L1 후 권장).
수용: 파이프 e2e 테스트, exit-code 누락 시 명확한 에러. 포함 금지: TTY 자동감지, observe 흉내.

---

## L5 — feat(ui): bare `cstui` = 작업단위 목록 + "어제 이후 N"
**왜**: 첫 접촉이 help 텍스트. 제품의 얼굴을 목록으로.
요구: 인자 없는 `cstui`가 TTY면 TUI 목록(open과 동일 뷰), 비TTY면 텍스트 요약. 세션에 `last_opened_at` 추가해
"이후 새 블록 N" 마커. `cstui open`은 별칭으로 유지. 의존: L1(안정), 가능하면 L2 뒤. 수용: TTY/비TTY 분기 테스트, 마커 테스트.
포함 금지: status 명령 신설, 승인/보류 UI(Messenger 영역).

---

## L6 — docs+feat: JSON 계약 문서 + block schema_version
**왜**: context만 버전 있음. 에이전트 통합이 비공식 추측에 의존.
요구: `docs/json-contract.md`(context/block/handoff/doctor 각 JSON 형태·버전 정책 additive), blocks.jsonl 새 라인에 schema_version 부여(구라인 무버전 허용). 의존: L2(handoff 계약 포함). 수용: 구라인 역호환 파싱 테스트, 버전 단언.

---

## L7 — docs(readme): 전달 서사 + docs/demo.md
**왜**: README가 "복사 도구" 톤. 제품 정체성을 "전달 가능한 작업 단위"로.
요구: 한 줄·60초 오프닝·is/is-not 재작성(`docs/PRODUCT-COMPLETION.md` §10 기반), `docs/demo.md`의 "양방향 전달" 데모가
실제 출력과 일치(검증 명령 포함), 비개발자 절은 "지원 핸드오프"로 이동(삭제 아님). 의존: L2·L4·L5 머지 후. 포함 금지: 기능 추가.

---

## 루프 밖 (사람/메인테이너 전용)
- PR #7 머지 — L2/L3/L6의 선행 게이트.
- v0.1.1 npm publish (OTP) → `npx campsite-tui@0.1.1` 검증.
- v0.1.2 = L1 머지 후. v0.2.0 = L2(handoff) 머지 후.
- 이슈 #5(e2-micro 실기), #1/#3/#4(run panel/observe/rerun)는 이 큐 이후 지평선.
