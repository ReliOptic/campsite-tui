# 가이드 슬라이드 추가분 — 8.5단계 카피

> 「헤르메스 에이전트 - 구글클라우드 프리티어 호스팅하기」 슬라이드의
> 8단계(Hermes 설치)와 9단계(외부 도구 연결) 사이에 넣는 한 장.
> 기존 슬라이드 포맷(제목 → 설명 한 줄 → 코드 → 완료 기준 → 메모)을 따른다.

---

## 8.5. Campsite TUI 설치 — 막혔을 때 도움 요청하기

설치하다 막히면 화면을 찍는 대신, 실행 결과를 **블록**으로 복사해서
단톡방에 붙여넣는다. 무엇이 어디서 실패했는지가 한 번에 전달된다.

### 코드

```
curl -fsSL https://raw.githubusercontent.com/ReliOptic/campsite-tui/main/scripts/install.sh | bash
```

### 사용법 (이 두 줄만 기억)

```
cstui run "방금 실패한 명령"
cstui block copy-last
```

→ Telegram에 붙여넣기 (Mac: Cmd+V)

### 완료 기준

- ✅ `cstui --version` 이 버전을 출력
- ✅ 붙여넣은 블록에 명령·결과·종료코드가 함께 보임

### 메모

- 토큰·API 키는 자동으로 가려진다(`[REDACTED]`). 안심하고 붙여넣어도 된다.
- VM(SSH 접속 상태)에서 복사하려면 Mac 터미널로 **Ghostty 또는 iTerm2**를
  사용한다 (기본 Terminal.app은 원격 복사 미지원).
- 복사가 안 되면 파일로 저장되고 경로가 표시된다 — 그 파일 내용을 보내면 된다.

---

### (운영자 메모 — 슬라이드에는 넣지 않음)

- 0단계(Console 준비) 슬라이드에 "터미널은 Ghostty 권장" 한 줄을 추가하면
  8.5단계의 원격 복사 문제가 사전에 사라진다 (TECH-SPEC T1).
- 수강생이 보낸 블록의 `Task:` 필드가 비어 있으면, 가이드 단계를 task로
  설정하게 안내: `cstui context set --task "5단계: 서버 생성"`
- 반복해서 들어오는 실패 블록은 그대로 GitHub 이슈로 등록한다 —
  블록 Markdown이 이슈 템플릿 호환이라 복사 한 번이면 된다.
