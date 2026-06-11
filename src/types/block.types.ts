/**
 * 명령 블록 타입 — PRD §10.2.
 * PRD 스키마와의 의도적 차이: PTY 캡처는 stdout/stderr를 분리할 수 없으므로
 * (TECH-SPEC T9, PRD §11 F2가 명시적으로 허용) 병합된 `output` 단일 필드를 쓰고,
 * `capture_method`로 그 사실을 표현한다.
 */
import type { CaptureMethod, WorkContext } from './context.types.js';

export interface CommandBlock extends WorkContext {
  readonly block_id: string;
  readonly session_id: string;
  readonly command: string;
  /** PTY 병합 출력 (ANSI 원본 보존, export 시 정제) */
  readonly output: string;
  readonly exit_code: number;
  /** 시그널로 종료된 경우 시그널 번호, 아니면 null (예: SIGINT=2) */
  readonly signal: number | null;
  /** ISO 8601 (타임존 포함) */
  readonly started_at: string;
  readonly ended_at: string;
  readonly duration_ms: number;
  readonly capture_method: CaptureMethod;
  readonly dirty: boolean | null;
  /** alternate screen buffer 감지 — 전체화면 앱은 출력 캡처가 제한됨 (TECH-SPEC T3) */
  readonly interactive: boolean;
  /** 저장 캡(2MB) 적용 여부 — 적용 시 중간 생략 마커 포함 (TECH-SPEC T8) */
  readonly truncated: boolean;
}
