/**
 * 타입드 에러 — 모든 에러는 코드 + 복구 경로를 가진다.
 * 비개발자 사용자가 보는 메시지이므로 recovery는 한국어로, 행동 가능하게 쓴다.
 */

export type CampsiteErrorCode =
  | 'CONFIG_INVALID'
  | 'CAPTURE_SPAWN_FAILED'
  | 'STORE_IO_FAILED'
  | 'STORE_LINE_CORRUPT'
  | 'CLIPBOARD_UNAVAILABLE'
  | 'SESSION_LOCKED'
  | 'CLI_USAGE';

export interface ErrorDetails {
  readonly [key: string]: string | number | boolean | null;
}

export class CampsiteError extends Error {
  readonly code: CampsiteErrorCode;
  /** 사용자가 다음에 할 수 있는 행동 (한국어, 행동 가능한 문장) */
  readonly recovery: string;
  readonly details: ErrorDetails;

  constructor(
    code: CampsiteErrorCode,
    message: string,
    recovery: string,
    details: ErrorDetails = {},
    options?: { readonly cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'CampsiteError';
    this.code = code;
    this.recovery = recovery;
    this.details = details;
  }
}

/** unknown 에러를 CampsiteError로 정규화 (외부 호출 경계에서 사용) */
export function toCampsiteError(
  error: unknown,
  fallbackCode: CampsiteErrorCode,
  recovery: string,
): CampsiteError {
  if (error instanceof CampsiteError) return error;
  const message = error instanceof Error ? error.message : String(error);
  return new CampsiteError(fallbackCode, message, recovery, {}, { cause: error });
}
