/**
 * 컨텍스트 타입 — PRD §10.3.
 * 필드명은 디스크 저장 포맷(JSONL)과 1:1 일치시키기 위해 snake_case를 사용한다.
 * 값을 알 수 없으면 null로 저장하고, 표시 계층에서 "unknown"으로 렌더링한다 (PRD §11 F1).
 */

/** 블록 캡처 방법 — 캡처 신뢰 수준을 블록에 정직하게 명시 (TECH-SPEC T2/T9) */
export type CaptureMethod = 'pty_runner' | 'stdin_pipe' | 'wrapper';

/** 세션/블록에 공통으로 부착되는 최소 컨텍스트 (PRD §10.3 minimum) */
export interface WorkContext {
  readonly cwd: string;
  readonly repo: string | null;
  readonly branch: string | null;
  readonly task: string | null;
  readonly agent: string | null;
  readonly mode: string | null;
}

/** v0.1에서 구현하는 선택 컨텍스트 (PRD §10.3 optional 중 일부) */
export interface OptionalContext {
  readonly dirty: boolean | null;
  readonly pr_number: number | null;
  readonly issue_number: number | null;
}
