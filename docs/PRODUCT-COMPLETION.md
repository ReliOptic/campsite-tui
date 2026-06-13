# campsite-tui — 제품 완성상태 아키텍처 리포트

> 테제 확정 (2026-06-12 2차 시뮬레이션): **"전달 가능한 작업 단위(transferable work units)"** —
> 캡처(provenance)·신뢰(마스킹)·이어가기(handoff)의 세 경계. PR 시퀀스는 `codex-loop.md`의 L1~L7.
>
> **진행 현황 (2026-06-13 기준, main)**
> - ✅ L1 drain 증거 무결성 (PR #9·#11) · ✅ L4 stdin ingress + `wrapper` 타입 제거 (PR #12)
> - ✅ context --json 핸드오프 페이로드 (PR #7) · ✅ `cstui doctor` (PR #6)
> - 🚧 **다음: L2 handoff** (`cstui handoff --as prompt` — "마음의 경계", 이슈 #2)
> - ⬜ L3 context 라이브+출처 · L5 bare cstui 콕핏 · L6 JSON 계약 문서 · L7 README 서사
> - npm 게시 `0.1.0`, main 미게시분 다음 릴리스 대기
>
> 아래 §1~§11은 역산 분석 원본. §8의 "9개 PR"은 `codex-loop.md`의 7개로 재구성됨 (status·sessions 연기).

---

## 1. 완성상태 테제 (Completion-State Thesis)

시드 테제("agent work를 검사·계속하는 터미널 컨트롤 서피스")를 수용하되, 이 저장소의 실제 강점에 맞게 한 단어씩 조인다:

> **Campsite TUI는 터미널 에이전트 작업을 ① 항해 가능하고(navigable) ② 신뢰 가능하고(trustworthy) ③ 이어갈 수 있는(resumable) 상태로 만든다.**

세 형용사가 곧 제품의 세 기둥이고, 각각 코드에 뿌리가 있다:

| 기둥 | 의미 | 이미 있는 뿌리 (증거) |
|---|---|---|
| Navigable | 흩어진 실행 결과가 목록·뷰어·JSON으로 탐색됨 | `src/ui/app.tsx`(목록/뷰어), `block list --json` |
| Trustworthy | 모든 표시가 증거(exit code·캡처방법·시각) 기반, 시크릿 자동 마스킹, 모르는 것은 모른다고 표기 | `capture_method` 필드, `src/services/redact.ts`, `interactive`/`truncated` 플래그 |
| Resumable | 터미널을 닫아도 상태가 살아있고, 사람/에이전트가 이어받을 수 있음 | JSONL 영속(`block-store.ts`), context payload(PR #7) — **단, 핵심 표면(handoff) 부재** |

**완성 판정 한 문장**: *"터미널을 닫고 다음 날 돌아와도, `cstui` 한 번으로 무슨 일이 있었고 무엇이 깨졌는지 10초 안에 알고, 60초 안에 다른 에이전트에게 이어받게 할 수 있다."*

피해야 할 모습(시드 브리프와 합치): 범용 CLI 유틸리티 ✗ · 장식적 TUI ✗ · raw 로그 뷰어 ✗ (이미 §9.1 포지셔닝에서 "가짜 inbox 금지"로 결정됨 — 유지).

## 2. 구체적 최종 사용자 그림 (End-User Picture)

페르소나: **에이전트 운영자** (Hermes/Claude Code/Codex를 돌리는 개발자·운영자. 비개발자는 `run`/`copy-last` 원라이너만 사용 — STRATEGY.md §9.1 유지).

완성된 제품에서의 아침 5분:

```
$ cstui                                  # bare 명령 = 콕핏 (현재는 help — 변경 대상)
🏕️ campsite-tui · main · Task PR #7 리뷰 대응
──────────────────────────────────────────────
어제 이후 새 블록 4 · ⚠️ 실패 1 · ✂️ 생략저장 1

▸ 12 ❌ npm test                    8.4s  어제 23:41   ← 실패가 위로
  11 ✅ gh pr view 7 --comments     1.2s  어제 23:39
  10 ✅ git pull                    0.8s  어제 23:38
  ...
[Enter 보기 · c 복사 · h 핸드오프 · ? 도움말]

$ cstui handoff --last 3 --as prompt | pbcopy
# → Claude Code에 붙여넣기: 컨텍스트+실패 블록+환경이 든 "이어받기 프롬프트"
#   에이전트가 추가 질문 없이 작업을 계속한다.
```

사용자가 **보고**(상태·실패), **신뢰하고**(exit code·캡처방법·마스킹 표시), **행동하고**(복사·핸드오프·재실행), **돌아오고**(어제 이후 새 블록 N), **추천하는**("핸드오프 프롬프트 하나로 에이전트가 이어가더라") 그림이다.

## 3. 타협 불가 제품 인바리언트 (Non-negotiable Invariants)

| # | 인바리언트 | 왜 중요한가 | 현재 코드/문서 위치 | 테스트 방법 |
|---|---|---|---|---|
| I1 | **증거 없는 성공 표시 금지** — 모든 ✅/❌는 기록된 exit_code에서만 파생 | 콕핏의 존재 이유가 신뢰 | `block.exit_code`, `capture_method` (`src/types/block.types.ts`) · doctor의 PTY 검사도 실제 spawn (`src/services/doctor.ts`) | 렌더 단위테스트: exit_code 없는 표시 경로가 없음을 보장. ⚠️ 이슈 #8(드레인 플레이크)는 이 인바리언트의 직접 위협 — 최우선 수정 |
| I2 | **컨텍스트는 출처와 신선도를 밝힌다** | 낡은 repo/branch는 오진단 유발 | ⚠️ **위반 중**: `context-command.ts`의 show가 세션 생성 시점 스냅샷을 렌더(dirty만 라이브) | 테스트: 세션 생성 후 branch 변경 → show가 라이브 값 + 수동/감지 출처 태그 표시 |
| I3 | **핸드오프는 단독으로 충분하다** — 받은 쪽이 추가 질문 없이 이어갈 수 있음 | resumable 기둥의 정의 | ⚠️ **표면 부재** (copy-last는 블록 1개뿐) | 골든 테스트: handoff 출력에 context+environment+블록+지시문 포함 |
| I4 | **JSON은 에이전트 계약이다** — schema_version + additive 전용 | 스크립트/에이전트가 파싱을 신뢰 | context payload에 `schema_version:1` (PR #7) · ⚠️ blocks/list·last JSON엔 없음, 계약 문서 없음 | 계약 문서 + 버전 단언 테스트 + 구라인 역호환 파싱 테스트 |
| I5 | **외부로 나가는 모든 표면은 기본 마스킹** | 공유가 쉬우면 유출도 쉽다 (TECH-SPEC T6) | `copy-block.ts` redact 기본 ON, command까지 마스킹 | 기존 테스트 유지 + handoff 경로에 동일 단언 추가 |
| I6 | **80×24에서 유용하다** | SSH·분할 페인이 주 사용 환경 | `wrap="truncate-end"`, 뷰어 페이징 (`src/ui/*.tsx`) — 명시 테스트 없음 | ink-testing-library에 작은 차원 주입 테스트 |
| I7 | **무상태에서도 우아하다** — 세션/저장소 없어도 모든 명령이 유용한 답 | 첫 사용·CI·에이전트 호출 | `NO_SESSION` 안내(`block-command.ts`), 온보딩(`ui/help.tsx`), doctor는 무전제 동작 | no-session에서 전 명령 exit/안내 표 테스트 (status·handoff 포함) |
| I8 | **로컬 전용, 네트워크 0** | PRD §8 비협상 + 신뢰 | 전 코드 fetch/원격 없음 | 리뷰 게이트 + (선택) import 린트 |

## 4. 정본 객체 모델 (Canonical Object Model)

**판정 요약: Block은 강하다. Session이 최약점이다. Evidence는 새 객체로 만들지 않는다.**

| 객체 | 정의(정본) | 필드 | 라이프사이클 | 표면 | 필요한 테스트 |
|---|---|---|---|---|---|
| **Block** | *증거 등급의 명령 기록* — 이 제품의 원자. Evidence라는 별도 객체는 만들지 않는다(블록의 provenance 필드가 곧 증거성) | 현행 + `schema_version`(추가) | run/capture 시 1회 생성, 불변, JSONL append | list/last/viewer/copy/handoff | 역호환 파싱(구라인에 새 필드 없음) |
| **Session** | 하나의 작업 맥락 + 그 블록들. ⚠️ **현행 결함: 전역 단일 포인터**(`~/.campsite-tui/current-session`) — 두 저장소를 오가면 맥락이 오염됨 | 현행 + `last_opened_at`(콕핏 "새 블록" 계산용) | create → active → (암묵) idle | context/sessions(신설)/TUI 바 | repo_root 다른 cwd에서 자동 분리 |
| **Workspace** | repo_root(없으면 cwd)로 키된 세션 묶음. **v0.2에선 객체로 만들지 말고 세션 선택 규칙으로만 구현** (과설계 방지) | — (파생) | — | `sessions` 목록의 그룹 라벨 | 선택 규칙 테스트 |
| **Context** | 세션의 수동 필드(task/agent/mode) + 라이브 감지(repo/branch/dirty/repo_root/remote_url) + environment. **수동과 감지를 구분 표기하는 것이 I2** | PR #7 payload가 정본 | 감지는 항상 라이브, 수동은 set 시점 | context [--json] | stale 시나리오 |
| **NextAction** | **저장하지 않는 파생 객체**. 실패 블록→재실행/핸드오프, 생략저장→전체보기, 무세션→시작 안내 | `{kind, label, command}` | status/콕핏 렌더 시 계산 | `status --json`의 `next_actions[]`, TUI 푸터 | 파생 규칙 단위테스트 |
| **Handoff** | context payload + 선택 블록들 + 수신자 지시문의 패키지. 포맷 3종: markdown(사람), json(스크립트), **prompt(에이전트 재시작 — 차별화 포인트)** | `{schema_version, context, environment, blocks[], instruction}` | 생성 즉시 소비(저장 안 함, exports/ 폴백만) | `handoff` 명령 (+TUI `h`) | 골든 + 마스킹 + 충분성 |
| **Diagnostic** | doctor의 검사 결과 | 현행 `DoctorCheck/Report` — 충분 | 실행 시 계산 | doctor [--json] | 현행 7케이스 유지 |
| **Agent identity** | 문자열 라벨(`session.agent`) 이상으로 **승격하지 않는다** — 인증·신원은 Campsite Messenger 영역 (§9.1 경계) | 현행 | — | context | — |

**Motif**: 유지하되 강등 확정(라벨 전용, PRD §10.4 충족). 콕핏 기능에 관여 금지.

## 5. 표면 지도 (Surface Map)

```
cstui                    [변경] bare = 콕핏 TUI (TTY+블록 존재 시) / 아니면 온보딩 help
cstui status [--json]    [신설] 콕핏의 CLI 한 줄 요약 — 에이전트가 "뭘 봐야 하나" 질의
cstui run "<cmd>"        [유지] 캡처의 정문
cstui capture            [신설] stdin 파이프 캡처 — 선언만 된 capture_method 'stdin_pipe' 구현
cstui block list|last|copy-last  [유지]
cstui context [set] [--json]     [유지+I2 수정]
cstui handoff [--last N] [--as markdown|json|prompt]  [신설] 이슈 #2 흡수·개명
cstui sessions [use <id>]        [신설·최소] 전역 포인터 결함 해소
cstui doctor [--json]    [유지]
cstui open               [유지] bare의 별칭으로 강등
```

**죽이기/강등 판정**: `--format command`(TUI `x` 키)는 문서에서 강등(도움말에만) · `campsite-tui` bin 별칭 유지 · 새 표면 추가 금지 목록: watch/serve/sync 등 네트워크성 일체(I8).

## 6. 현재 저장소 진단 (파일 증거)

**최종 그림을 이미 받치고 있는 것**
- `src/services/block-store.ts` — fsync append·손상라인 스킵: 콕핏급 증거 저장소 ✓
- `src/services/capture.ts` — provenance(캡처방법)·alt-screen 정직 표기·2MB 캡 ✓ (단, 이슈 #8 드레인 경합이 I1 위협)
- `src/services/redact.ts` + `copy-block.ts` — I5 충족, 명령 문자열까지 마스킹 ✓
- `src/services/doctor.ts` — 실증 기반 진단, ports 주입식 ✓
- PR #7 `environment.ts`/context payload — Handoff의 머리 절반이 이미 완성 ✓
- `src/ui/app.tsx` — 실패 카운트 헤더·온보딩·도움말: 콕핏 홈의 씨앗 ✓

**제품을 흐리는 것 (기술적으론 동작)**
- `session.ts:46` `current-session` 전역 포인터 — 멀티 프로젝트에서 맥락 오염 (G1)
- `context-command.ts` show가 세션 스냅샷 렌더 — I2 위반 (G4)
- `context.types.ts`의 `CaptureMethod = 'pty_runner'|'stdin_pipe'|'wrapper'` — 뒤 둘은 **선언만 존재하는 죽은 표면**: 구현(G6)하거나 제거. 판정: stdin_pipe 구현(에이전트 인제스천 최저비용), wrapper는 v0.3까지 유니언에서 제거
- bare `cstui` → help (`router.ts:44`) — 콕핏 제품의 첫 접촉이 사용법 텍스트 (G8)
- blocks JSON에 schema_version 없음, 계약 문서 부재 — I4 절반 위반 (G5)

**문서 대 코드 충돌 판정**: PRD §14는 `cstui export session`을 제시 — **코드(미구현)도 PRD도 아닌 제3안이 승자**: `handoff`가 제품 언어, `export`는 별칭. README는 비개발자 우선 톤 — 콕핏 정체성을 선두로 재배치하되 비개발자 2줄 섹션은 유지(G10).

**테스트 진단**: 90건 — 서비스 계층 견고. 부재: stale-context, no-session에서 신설 명령, 80×24, JSON 역호환.

## 7. 갭-투-완성 지도

| # | 갭 | 현재 | 목표 | 심각도 | 최소 슬라이스 | 수용 기준 |
|---|---|---|---|---|---|---|
| G0 | 캡처 신뢰(플레이크 #8) | Linux에서 tail 유실 간헐 | 결정적 드레인 | **높음(I1)** | onExit 후 드레인 유예 | Linux 반복 실행 안정, 기존 90 테스트 유지 |
| G1 | 세션 전역 포인터 | 단일 current-session | repo_root별 자동 선택 + 목록 | **높음** | `sessions` list/use + 선택 규칙 | 두 저장소 교차 사용 시 블록 분리 |
| G2 | 핸드오프 부재 | copy-last 1블록 | `handoff --as prompt` 등 3포맷 | **높음(I3)** | 명령 1개 + 골든 | 수신 에이전트가 추가 질문 없이 재개 가능한 필드 충족 |
| G3 | attention 표면 부재 | block list뿐 | `status --json` + next_actions | **높음** | 명령 1개 | 무세션 포함 전 상태에서 유용한 출력 |
| G4 | stale 컨텍스트 | 스냅샷 렌더 | 라이브+출처 태그 | 중상(I2) | show 수정 + run 시 세션 갱신 | branch 변경 시나리오 테스트 |
| G5 | JSON 계약 미문서화 | context만 버전 | 전 JSON 버전+문서 | 중간(I4) | blocks 버전 + docs/json-contract.md | 구라인 역호환 테스트 |
| G6 | stdin_pipe 미구현 | 타입만 존재 | `cstui capture` 동작 | 중간 | 명령 1개 | 파이프 입력→블록, capture_method 정확 |
| G7 | 콕핏 홈 아님 | bare=help | bare=TUI, 새 블록 마커 | 중간 | 라우팅+last_opened_at | TTY/비TTY 분기 테스트 |
| G8 | 80×24/무상태 테스트 | 암묵 | 명시 테스트 | 낮음(I6·I7) | 테스트만 추가 | 차원 주입 렌더 검증 |
| G9 | README 내러티브 | 유틸리티 톤 | 콕핏 정체성 | 낮음·효과 큼 | README+demo.md | 60초 데모가 실출력과 일치 |

## 8. PR 시퀀스 (9개 — 전부 1일 미만, 리뷰 가능 크기)

> 선행: PR #7 머지(메인테이너). 각 PR은 agent/* 브랜치, CI 그린 필수, self-merge 금지.

| PR | 제목 | 목적/왜 지금 | 주요 파일 | 수용 기준 | 지연 리스크 |
|---|---|---|---|---|---|
| A | fix(capture): exit 후 출력 드레인 보장 (#8) | I1·CI 신뢰가 모든 후속 PR의 기반 | `services/capture.ts`, capture.test | onExit 후 유예 드레인, seq 대량+즉시종료 반복 통과 | 모든 PR이 간헐 빨간 CI에 시달림 |
| B | feat(status): `cstui status --json` | G3 — 콕핏의 CLI 얼굴, 에이전트 질의 표면 | `cli/status-command.ts`(신), `services/next-action.ts`(신), router | 무세션 포함 3상태 출력, schema_version, next_actions 파생 규칙 테스트 | "뭘 봐야 하나"에 답 못하는 제품 |
| C | fix(context): 라이브 감지 + 출처 태그 렌더 | G4/I2 — 신뢰 인바리언트 위반 해소 | `cli/context-command.ts`, `services/session.ts`(run 시 갱신) | branch 변경 후 show=라이브, 수동 필드에 (set) 태그 | 낡은 컨텍스트로 오진단 |
| D | feat(handoff): `cstui handoff` 3포맷 (이슈 #2 흡수) | G2/I3 — resumable 기둥 완성, 킬러 표면 | `services/handoff.ts`(신), `cli/handoff-command.ts`(신) | 골든 3종, 마스킹 ON, --as prompt에 지시문 포함, 클립보드/파일 폴백 재사용 | 제품이 "뷰어"에 머묾 |
| E | docs+feat: blocks schema_version + JSON 계약 문서 | G5/I4 | `services/block-store.ts`, `docs/json-contract.md` | 구라인 파싱 역호환 테스트, 4표면(context/status/block/handoff) 계약 명문화 | 에이전트 통합이 비공식 추측에 의존 |
| F | feat(capture): stdin 파이프 모드 | G6 — 죽은 타입 살리기, 에이전트 인제스천 | `cli/capture-command.ts`(신), capture.test | `cmd \| cstui capture --command "..." --exit-code N` → 블록, capture_method=stdin_pipe | 타입 거짓말 지속 |
| G | feat(ui): bare cstui=콕핏 + "어제 이후 새 블록 N" | G7 — 첫 접촉을 제품답게 | `cli/router.ts`, `ui/app.tsx`, session last_opened_at | TTY→TUI/비TTY→status 텍스트 분기, 마커 테스트 | 첫인상이 help 텍스트 |
| H | feat(sessions): 목록/전환 + repo_root 자동 스코핑 | G1 — 객체 모델 최약점 해소 | `services/session.ts`, `cli/sessions-command.ts`(신) | 교차 저장소 분리 테스트, `sessions`/`sessions use` | 멀티 프로젝트 오염 지속 |
| I | docs(readme): 콕핏 내러티브 + docs/demo.md | G9 — 공개 서사 정렬 | README.md, docs/demo.md | 데모 스크립트가 실출력과 일치(검증 명령 포함) | 제품 정체성 전달 실패 |

순서 원칙: 신뢰(A) → 보기(B·C) → 이어가기(D) → 계약(E·F) → 첫인상(G·H·I). 이슈 #1(run panel)·#3(observe)·#4(rerun)는 이 시퀀스 **이후** 지평선 — #4는 D의 prompt 포맷이 부분 대체.

## 9. 첫 설득력 있는 데모 ("아침의 콕핏")

```bash
# ── 어젯밤: 에이전트(또는 운영자)가 작업
cstui context set --agent Hermes --task "PR #7 리뷰 대응"
cstui run "git pull"
cstui run "npm test"            # ❌ 실패하고 잠듦

# ── 오늘 아침: 터미널 새로 열고
cstui                           # 콕핏: "새 블록 3 · ⚠️ 실패 1" — 실패가 맨 위
# Enter → 실패 출력 확인 (exit 1 · 8.4s · 캡처방법 명시)

cstui handoff --last 3 --as prompt | pbcopy
# Claude Code/Hermes에 붙여넣기 → 에이전트가 컨텍스트+실패 증거를 들고 즉시 이어감
```

- **실패 케이스 데모**: `CAMPSITE_TUI_HOME=$(mktemp -d) cstui` → 온보딩(I7), `cstui doctor` 항목별 복구 명령(I1)
- **raw 로그/채팅 히스토리를 이기는 이유**: ① exit code·시각·캡처방법이 붙은 구조화 증거 ② 시크릿 자동 마스킹으로 그대로 붙여넣기 가능 ③ prompt 포맷이 "이어받기"를 1회 붙여넣기로 만듦 ④ 전부 로컬·무계정

## 10. README / 공개 서사

- **한 줄**: *"터미널 에이전트 작업의 콕핏 — 흩어진 실행 결과를 항해 가능하고, 신뢰 가능하고, 이어갈 수 있는 상태로."*
- **60초 오프닝**: 어젯밤 에이전트가 무엇을 했는지 오늘 아침 `cstui` 한 번으로 본다. 실패엔 증거(exit code·출력·시각)가 붙어 있고, `cstui handoff --as prompt` 한 줄이면 다른 에이전트가 그 지점부터 이어간다. 드래그 복사 없음, 시크릿 자동 마스킹, 전부 로컬.
- **is / is-not**: 콕핏·증거 저장소·핸드오프 도구다 ✓ / 터미널 교체·로그 뷰어·채팅 UI·텔레메트리가 아니다 ✗
- **현재 상태 표기(정직)**: v0.1 = run 캡처+블록+복사+doctor. 콕핏 홈·status·handoff는 PR A~I 진행 중 — README에 로드맵 체크박스로 노출.
- **강등/제거**: motif 설명은 한 줄로, `--format command`는 도움말로, 비개발자 시나리오는 "지원 핸드오프" 섹션으로 이동(삭제 아님 — STRATEGY §0 플라이휠 유지).

## 11. 메인테이너 결정 대기 항목

1. **bare `cstui` = 콕핏 승격** (PRD는 open 명시 — open을 별칭으로 강등하는 데 동의하는가) — PR G 전제
2. **`handoff` 명명** (PRD §14의 `export session`을 별칭으로 두는 안) — PR D 전제
3. **세션 스코핑 규칙**: repo_root 자동 분리 + 무저장소는 cwd 키 (제안) vs 명시 전환만 — PR H 전제
4. **stdin capture의 exit_code 계약**: `--exit-code` 필수(제안: 에이전트는 `$?`를 앎) vs nullable 허용(스키마 변경 수반) — PR F 전제
5. **blocks schema_version 소급**: 새 라인부터 부여+구라인 무버전 허용(제안) vs 마이그레이션 — PR E 전제
6. **README 언어**: 한국어 우선 유지(제안: 1차 사용자층) vs 영문 병기 (npm 공개 패키지로서의 도달 범위)
7. **이슈 #1(run panel) vs #3(observe) 차기 우선순위**: 시퀀스 이후 — 제안: #1 (콕핏 완결) 먼저, observe는 stdin capture(F)로 수요 검증 후
8. **v0.2.0 npm 릴리스 시점**: 제안 — PR D(handoff) 머지 직후 (resumable 기둥이 서는 순간이 버전을 올릴 가치가 생기는 순간)
