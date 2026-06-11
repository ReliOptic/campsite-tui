/**
 * 구조화 JSON 로거 — 모든 부수효과·에러 경로에서 사용.
 * stdout은 CLI 출력(--json 포함) 전용이므로 로그는 항상 stderr로 보낸다.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogFields {
  readonly [key: string]: unknown;
}

export interface LogSink {
  write(line: string): void;
}

export interface Logger {
  debug(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  error(msg: string, fields?: LogFields): void;
}

const stderrSink: LogSink = {
  write(line: string): void {
    process.stderr.write(`${line}\n`);
  },
};

const LEVEL_ORDER: Readonly<Record<LogLevel, number>> = { debug: 0, info: 1, warn: 2, error: 3 };

function emit(sink: LogSink, level: LogLevel, msg: string, fields: LogFields): void {
  sink.write(JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields }));
}

/**
 * minLevel 미만 로그는 버린다. 기본 warn — 비개발자의 일반 사용 화면을 깨끗하게 유지하고,
 * --verbose(index.ts)에서만 debug까지 노출한다.
 */
export function createLogger(sink: LogSink = stderrSink, minLevel: LogLevel = 'warn'): Logger {
  const at =
    (level: LogLevel) =>
    (msg: string, fields: LogFields = {}): void => {
      if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
      emit(sink, level, msg, fields);
    };
  return { debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
}
