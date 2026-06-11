# Campsite TUI — 기술 구현 명세 및 난이도 분석 (v1)

> 짝 문서: `STRATEGY.md` (제품·우선순위). 본 문서는 기술적으로 무엇이 어렵고,
> 어떤 결정을 내려야 하며, 무엇을 먼저 스파이크로 검증해야 하는지를 다룬다.
> 실행 환경 전제(§0 참조): 로컬 Mac(zsh) + GCP e2-micro Ubuntu 22.04(SSH, RAM 1GB).

---

## 0. 실행 환경이 두 개라는 사실이 모든 난이도를 지배한다

가이드 슬라이드 기준 사용자의 터미널 작업은 두 곳에서 일어난다:

| 위치 | 가이드 단계 | 클립보드 | 자원 |
|---|---|---|---|
| **로컬 Mac** (Terminal.app/iTerm2) | 1~6단계 (gcloud 설치·서버 생성·SSH) | `pbcopy` 직접 사용 가능 — **쉬움** | 충분 |
| **원격 VM** (SSH 세션 내부) | 7~9단계 (서버 설정·Hermes 설치·연동) | OS 클립보드 없음 — **어려움 (최대 난제)** | RAM 1GB |

cstui는 양쪽에 모두 설치되어야 하고, 같은 코드가 두 환경에서 다르게 동작해야 한다.

---

## 1. 난이도 맵 (요약)

| # | 영역 | 난이도 | 리스크 | 결론 |
|---|---|---|---|---|
| T1 | SSH 원격에서 클립보드 (OSC 52) | **상** | v0.1 핵심 가치 직결 | OSC 52 + 단계적 폴백, 가이드에서 iTerm2 권장 |
| T2 | PTY 캡처 (node-pty) | 중 | 네이티브 빌드, 시그널 | 검증된 경로, 스파이크로 e2-micro 확인 |
| T3 | 인터랙티브 명령 (vim, gcloud init) | 중상 | UX 혼란 | raw passthrough + alternate screen 감지 |
| T4 | Ink 렌더링 성능 (대용량 출력) | 중 | TUI 멈춤 | Static 영역 + 출력 캡 (head+tail) |
| T5 | Markdown export 정합성 | 중하 | 깨진 붙여넣기 | 동적 펜스, ANSI 제거, Telegram 4096자 제한 |
| T6 | 시크릿 노출 (공유 흐름의 본질적 위험) | **상** | 사용자 보호 | v0.1부터 최소 redaction 필수로 격상 |
| T7 | 1GB RAM 환경 설치·구동 | 중 | 설치 실패 = 이탈 | 스파이크: npm install 시간·메모리 측정 |
| T8 | JSONL 저장 무결성 | 하 | 데이터 유실 | append+fsync, 손상 라인 스킵 복구 |
| T9 | stdout/stderr 분리 | 하(포기) | — | PTY 특성상 병합. PRD가 허용 (§11 F2) |
| T10 | Observe 모드 (셸 훅) | 상(연기) | — | v0.2. 본 문서 §11에 설계만 기록 |

---

## 2. T1 — 클립보드: 이 제품의 최대 기술 난제

**문제**: 사용자는 VM에 SSH로 들어가 있다. VM에는 X11도 Wayland도 없다.
`clipboardy`/`xclip`은 전부 실패한다. "복사" 버튼이 동작하지 않으면 제품 가치가 0이다.

**유일한 표준 경로는 OSC 52** — 터미널 이스케이프 시퀀스로 base64 페이로드를
로컬 터미널 에뮬레이터의 클립보드에 직접 쓴다. SSH를 그대로 관통한다.

**그러나 터미널별 지원이 갈린다 (핵심 리스크):**

| 터미널 | OSC 52 수신 | 비고 |
|---|---|---|
| macOS **Terminal.app** | ❌ 미지원 | **비개발자 기본값이라는 게 문제** |
| iTerm2 | ✅ | 설정에서 클립보드 접근 허용 필요 |
| Ghostty / kitty / WezTerm | ✅ | 기본 동작 |
| VS Code 통합 터미널 | ✅ | 1.74+ |
| tmux 경유 | △ | `set-clipboard on` 설정 필요, 패스스루 래핑 |

**결정 (단계적 폴백 체인):**

```
1. 로컬 실행 감지(SSH_TTY 없음) → clipboardy (pbcopy 등)        [Mac 1~6단계]
2. 원격 실행 → OSC 52 emit + 사용자에게 "복사됨(터미널 지원 시)" 표시
3. OSC 52 비지원 의심/실패 → exports/ 파일 저장 + 화면에 경로 출력
4. 최후: 블록을 화면에 "깨끗하게 단독 출력"하는 print 모드
   (cstui block last --print → 터미널 네이티브 전체선택-복사라도 안 깨지게)
```

OSC 52는 성공 여부를 회신받을 수 없으므로(write-only), **정직한 UI 문구**가 필수다:
"클립보드로 전송함 — 붙여넣기가 안 되면 iTerm2/Ghostty를 사용하세요" (PRD §8
"캡처 신뢰성이 불완전하면 정직하게 노출" 원칙과 일치).

**전략적 우회**: 가이드를 우리가 소유하므로, 슬라이드 0단계에 "iTerm2 설치"를
추가하면 이 문제의 80%가 사라진다. 기술이 아니라 유통으로 푸는 게 더 싸다.

추가 한계: OSC 52 페이로드는 터미널별 크기 제한이 있다(통상 ~100KB 미만,
tmux 구버전은 더 작음). → export 시 출력 truncation(§6)과 연동.

## 3. T2 — PTY 캡처 (node-pty)

**쉬운 부분**: 단일 명령 lifecycle만 다룬다. `pty.spawn(shell, ['-c', cmd])` →
data 이벤트 수집 → onExit에서 exit code/signal. Warp 같은 풀 터미널 상태 머신 불필요.

**어려운 부분과 결정:**

1. **네이티브 모듈 빌드**: node-pty는 설치 시 node-gyp 컴파일이 필요.
   가이드 7단계가 이미 `build-essential python3`를 설치하므로 VM에서는 충족.
   Mac은 Xcode CLT 필요 — 비개발자에게 추가 마찰. → **스파이크 S1**: 양 환경에서
   `npm install` 성공률·소요시간 측정. 실패 시 대안: `@lydell/node-pty`(프리빌드 포함) 검토.
2. **시그널 처리**: Ctrl+C는 자식 PTY로 전달(작업 중단), TUI 종료와 구분.
   구현: TUI 키 핸들링에서 실행 중일 때 SIGINT → `pty.kill('SIGINT')`,
   유휴 상태에서 q → TUI 종료. 자식 좀비 방지: onExit 미수신 타임아웃 + SIGKILL 에스컬레이션.
3. **터미널 크기**: spawn 시 현재 stdout의 rows/cols 전달, SIGWINCH 시 `pty.resize()`.
   안 하면 출력 줄바꿈이 캡처본에서 깨진다 — "복사가 깨지지 않는다"는 제품 약속과 직결.
4. **exit code 정확성**: shell -c 래핑 시 셸이 종료코드를 그대로 전달함. 단,
   파이프라인의 중간 실패(`pipefail`)는 v0.1에서 다루지 않음을 문서화.

## 4. T3 — 인터랙티브/전체화면 명령

사용자는 `gcloud init`(대화형 프롬프트), `vim`, `htop`(전체화면)을 실행할 수 있다.

- **대화형 입력**: PTY runner가 stdin을 raw mode로 자식에 패스스루하면 동작한다.
  Ink는 이 동안 자신의 입력 처리를 정지해야 함(입력 경합이 실제 버그 소굴).
  → 실행 중에는 Ink `useInput` 비활성 + stdin 직결, 종료 후 복귀.
- **전체화면 앱**: 캡처본이 이스케이프 시퀀스 덩어리가 됨. alternate screen buffer
  진입 시퀀스(`\x1b[?1049h`)를 감지해 블록에 `interactive: true` 플래그 →
  목록에서 "🖥 인터랙티브 세션 (출력 캡처 제한)" 으로 정직하게 표기.
- **장시간 실행** (`hermes gateway` 같은 포그라운드 서버): duration이 무한대.
  → 실행 중 블록을 "running" 상태로 표시, Ctrl+C 종료 시점에 확정.

## 5. T4 — Ink 렌더링 성능

PRD §13이 지적한 "TUI rendering can become fragile"의 실체:

- Ink는 React reconciliation으로 프레임마다 전체 재렌더. `apt-get update` 같은
  수천 줄 출력 스트림을 state로 흘리면 e2-micro에서 멈춘다.
- **결정**: ① 실행 중 출력은 Ink를 거치지 않고 stdout에 raw 패스스루(사용자는
  평소 터미널 그대로 봄), 캡처는 백그라운드 버퍼에만 적재. ② 블록 목록/뷰어 화면만
  Ink 렌더. ③ 뷰어는 마지막 N줄 페이지네이션, 전체는 export로.
- 이 결정은 PRD §8 "TUI must not make normal terminal work harder"를 기술적으로
  보장하는 구조이기도 하다 — 실행 경험은 네이티브 터미널과 동일, TUI는 사후 리뷰용.

## 6. T5 — Markdown export 정합성

"붙여넣었을 때 절대 깨지지 않는다"가 제품 약속이므로 사소해 보여도 필수 처리:

1. **펜스 충돌**: 출력에 ``` 가 포함되면 코드블록이 깨짐 → 출력 내 최장 백틱 런을
   스캔해 그보다 긴 동적 펜스(````) 사용.
2. **ANSI 제거**: 저장은 원본(ANSI 포함), export는 strip-ansi 적용본. 진행바
   (`\r` 덮어쓰기)는 최종 라인만 남기는 정규화 필요 — apt/curl 출력에서 빈발.
3. **Telegram 제한**: 메시지당 4096자. 기본 export에 `--max-lines`(기본 head 20 +
   tail 20) 적용, 전문은 파일로. 초과 시 "…N줄 생략…" 마커 삽입.
4. **한글 폭**: 목록 정렬에 string-width(East Asian Width) 사용. 한국어 task명이
   기본값이므로 테스트 필수.

## 7. T6 — 시크릿 노출 (격상된 요구사항)

가이드 8단계 화면에는 **JWT 토큰이 포함된 portal URL**이 그대로 출력된다.
비개발자는 그 블록을 그대로 Telegram 단톡방에 붙여넣을 것이다.
"공유를 쉽게 만드는 제품"은 "유출도 쉽게 만드는 제품"이다.

PRD는 secret redaction을 optional(§11 F8)로 두지만, **이 사용자층에서는 v0.1 필수로
격상한다.** 범위는 결정적 정규식만 (LLM 불필요, PRD 제약 유지):

- JWT 패턴(`eyJ...`), `AIza...`(Google API key), `ghp_`/`gho_`(GitHub), `xoxb-`(Slack),
  Telegram bot token(`\d+:AA...`), `BEGIN PRIVATE KEY`, URL 내 `token=`/`key=` 쿼리값
- 동작: export 시 `[REDACTED:jwt]`로 치환 + "N개 시크릿 마스킹됨" 표시.
  원본 저장본은 보존(로컬이므로), `--no-redact`로 해제 가능.
- 오탐 비용(필요한 값이 가려짐) < 미탐 비용(토큰 유출). 기본 ON.

## 8. T7 — e2-micro(1GB RAM) 제약

- Node 런타임 자체 ~40-60MB RSS, Ink 앱 합산 ~80-120MB 예상 → 구동은 문제없음.
  위험은 **설치**: node-gyp 컴파일이 메모리 피크를 만들 수 있으나 swap 4GB로 흡수 예상.
- VM에 Node가 기본 없음 → 설치 스크립트가 NodeSource apt repo 추가까지 포함해야 함
  ("한 줄 설치"의 실제 내용). 대안으로 단일 바이너리 패키징(`bun build --compile` 또는
  Node SEA) 검토 — node-pty 네이티브 모듈 동봉 문제가 있어 **스파이크 S4**로 검증.
- **스파이크 S1 합격 기준**: 클린 VM에서 설치 5분 이내·피크 메모리 OOM 없음·
  `cstui run "free -h"` 정상 동작.

## 9. T8 — 저장 무결성 (낮은 난이도, 그래도 규칙 명시)

- blocks.jsonl: append-only, 블록 종료 시 1라인 원자적 기록 + fsync.
  실행 중 크래시 → 해당 블록만 유실(허용). 읽기 시 파싱 실패 라인은 스킵+카운트 보고.
- 출력 캡: 블록당 저장 상한 2MB(head 1MB + tail 1MB, 중간 생략 마커).
  30GB 디스크지만 무한 로그 명령 방어 필요.
- 동시성: 같은 세션에 cstui 다중 실행 시 충돌 → 세션 디렉토리에 lockfile, 후발 인스턴스는
  읽기 전용 모드로 강등(블록 열람·복사는 가능, run은 불가).

## 10. 모듈별 구현 순서와 스파이크 계획

코드 착수 전 반나절 스파이크 4개 (전부 30~60분짜리 throwaway 스크립트):

| 스파이크 | 검증 내용 | 합격 기준 |
|---|---|---|
| **S1** | e2-micro에서 node-pty 설치+spawn | 5분 내 설치, echo 캡처+exit code 정확 |
| **S2** | OSC 52 매트릭스 (Terminal.app/iTerm2/Ghostty/VS Code, SSH 경유) | 표 §2 실측 확정 |
| **S3** | Ink + 1만 줄 출력 raw 패스스루 구조 | 입력 지연 없음, 캡처 무손실 |
| **S4** | (선택) 단일 바이너리 패키징 가능성 | node-pty 동봉 성공 여부만 확인 |

스파이크 결과가 §2·§8의 결정을 뒤집으면 본 문서를 갱신한 후 M1 착수.
모듈 순서는 STRATEGY.md §6과 동일하되, **T6(redaction)은 M4 export 모듈에 포함**로 변경.

### 스파이크 실측 결과 (2026-06-11, 스크립트: `spikes/`)

| 스파이크 | 결과 | 측정값 |
|---|---|---|
| **S1-로컬** (macOS arm64) | ✅ 통과 + **패키징 결함 발견** | node-pty 1.1.0 프리빌드 설치 0.7초. 단, `spawn-helper`에 exec 비트 누락(`posix_spawnp failed`) → **postinstall에서 `chmod +x` 필수**. 6케이스 전부 정상: exit code(3,1,7) 정확, stderr 병합, ANSI 보존, 한글 무손실, SIGINT 전달(signal 2) |
| **S1-sim** (Docker ubuntu:22.04 amd64, cgroup 1GB+swap) | ✅ 통과 | apt 47s + NodeSource Node22 16s + **node-pty 소스 컴파일 8s**(Linux 프리빌드 없음 — 가이드 7단계의 build-essential/python3 필수 의존 확인), OOM 없음, spawn·exit code 정상. ※ Apple Silicon Rosetta 경유라 시간은 낙관치 — 실제 e2-micro에서 2~5배 느려도 5분 예산 내 |
| **S2** (OSC 52) | ✅ Ghostty 확정 / Terminal.app 보류 | Ghostty: write 동작 확인, **200KB 페이로드까지 무손실 전달**. Terminal.app: 자동화 권한 필요로 실측 보류 — 문헌상 미지원(❌) 전제 유지. iTerm2/VS Code: 이 Mac에 미설치, v0.1 전 수동 확인 항목 |
| **S3** (대용량 캡처) | ✅ 통과 | 1만 줄 17ms / 10만 줄 102ms / 100만 줄(7.9MB) 831ms 무손실. (100만 줄 케이스의 "1줄 차이"는 BSD seq가 1000000을 `1e+06` 2줄로 출력한 생성기 아티팩트로 판명 — 캡처 결함 아님) |

**결정 확정**: T2(node-pty)·T4(패스스루 캡처)·T7(1GB 설치)은 위험 해소.
T1은 Ghostty 경로 검증 완료 — 가이드에 "Ghostty 또는 iTerm2 사용" 권장 추가가
공식 대응이 된다(사용자 본인도 Ghostty 사용 중). 잔여 리스크는 OSC 52 미지원
터미널 사용자뿐이며 §2 폴백 체인으로 흡수.
**신규 요구사항**: 설치 스크립트/패키지에 spawn-helper exec 비트 보정 단계 추가.

## 11. (부록) v0.2 Observe 모드가 어려운 이유 — 연기 근거 기록

- zsh `preexec/precmd` 훅으로 명령·시각·exit code는 잡히지만 **출력은 못 잡는다.**
  출력까지 잡으려면 `script(1)` 상시 래핑(성능·중첩 문제) 또는 tmux `pipe-pane`(tmux
  사용자 한정) 필요. 비개발자는 tmux를 안 쓴다.
- 프롬프트 마커(OSC 133) 기반 경계 감지는 셸 설정 주입이 필요하고 터미널 지원이 갈린다.
- 결론: run-mode가 동일 가치를 더 신뢰성 있게 제공하므로 observe는 수요 확인 후.

---

## 12. 종합: 진짜 어려운 것 3가지만 기억하면 된다

1. **T1 클립보드** — 기술(OSC 52 폴백 체인) + 유통(가이드에 iTerm2 추가)의 합동 해결.
2. **T6 시크릿** — 공유가 쉬워지는 만큼 유출도 쉬워진다. v0.1 필수로 격상했다.
3. **T3/T4 "평소 터미널을 해치지 않기"** — 실행은 raw 패스스루, TUI는 사후 리뷰 전용.
   이 구조 결정 하나가 Ink 성능 문제와 인터랙티브 명령 문제를 동시에 제거한다.

나머지는 알려진 패턴의 조립이다.
