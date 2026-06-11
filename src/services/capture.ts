/**
 * PTY 명령 캡처 — 명령 실행을 소유하여 출력/exit code/시간을 결정적으로 캡처한다.
 * 실행 중 출력은 raw 패스스루(TUI 미경유)하고 캡처는 버퍼에만 적재한다 (TECH-SPEC T3/T4).
 */
import { spawn, type IPty } from 'node-pty';
import { CampsiteError } from '../types/errors.types.js';
import { nowIso } from '../utils/time.js';

const DEFAULT_CAP_BYTES = 2 * 1024 * 1024;
const ALT_SCREEN_PATTERNS = ['\u001b[?1049h', '\u001b[?47h', '\u001b[?1047h'] as const;

export interface CaptureOptions {
  readonly cwd: string;
  readonly shell?: string;
  /** 패스스루 대상. null이면 화면 출력 없이 캡처만 한다 (테스트/파이프). */
  readonly stdout: NodeJS.WriteStream | null;
  readonly stdin: NodeJS.ReadStream | null;
  readonly maxBytes?: number;
}

export interface CaptureResult {
  readonly output: string;
  readonly exit_code: number;
  readonly signal: number | null;
  readonly started_at: string;
  readonly ended_at: string;
  readonly duration_ms: number;
  readonly interactive: boolean;
  readonly truncated: boolean;
}

/** head+tail 보존 캡 버퍼 — 무한 출력 명령으로부터 저장소를 방어한다 (TECH-SPEC T8). */
class CappedBuffer {
  private head = '';
  private tail = '';
  private headBytes = 0;
  private overflowed = false;

  constructor(private readonly halfCapBytes: number) {}

  get truncated(): boolean {
    return this.overflowed;
  }

  push(chunk: string): void {
    if (!this.overflowed) {
      const bytes = Buffer.byteLength(chunk, 'utf8');
      if (this.headBytes + bytes <= this.halfCapBytes) {
        this.head += chunk;
        this.headBytes += bytes;
        return;
      }
      this.overflowed = true;
    }
    this.tail += chunk;
    const tailBuf = Buffer.from(this.tail, 'utf8');
    if (tailBuf.length > this.halfCapBytes) {
      // 바이트 경계 절단으로 생긴 깨진 선두 문자는 제거한다
      this.tail = tailBuf
        .subarray(tailBuf.length - this.halfCapBytes)
        .toString('utf8')
        .replace(/^�+/, '');
    }
  }

  value(): string {
    if (!this.overflowed) return this.head;
    return `${this.head}\n…[출력이 저장 한도를 초과하여 중간이 생략됨]…\n${this.tail}`;
  }
}

function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) env[key] = value;
  }
  return env;
}

/** 터미널 연동(리사이즈·stdin raw 패스스루·SIGINT 전달)을 붙이고 해제 함수를 반환한다. */
function attachTerminal(
  proc: IPty,
  stdout: NodeJS.WriteStream | null,
  stdin: NodeJS.ReadStream | null,
): () => void {
  const cleanups: Array<() => void> = [];

  if (stdout !== null && stdout.isTTY) {
    const onResize = (): void => {
      proc.resize(stdout.columns, stdout.rows);
    };
    process.on('SIGWINCH', onResize);
    cleanups.push(() => process.removeListener('SIGWINCH', onResize));
  }

  if (stdin !== null && stdin.isTTY) {
    // raw mode: Ctrl+C(\x03)도 데이터로 자식 PTY에 전달된다 (TECH-SPEC T2)
    stdin.setRawMode(true);
    stdin.resume();
    const onInput = (data: Buffer): void => {
      proc.write(data.toString('utf8'));
    };
    stdin.on('data', onInput);
    cleanups.push(() => {
      stdin.removeListener('data', onInput);
      stdin.setRawMode(false);
      stdin.pause();
    });
  } else {
    // 비TTY(에이전트 호출): cstui가 받은 SIGINT를 자식에 전달
    const onSigint = (): void => {
      proc.kill('SIGINT');
    };
    process.once('SIGINT', onSigint);
    cleanups.push(() => process.removeListener('SIGINT', onSigint));
  }

  return (): void => {
    for (const fn of cleanups) fn();
  };
}

export async function captureCommand(
  command: string,
  options: CaptureOptions,
): Promise<CaptureResult> {
  const shell = options.shell ?? process.env['SHELL'] ?? '/bin/sh';
  const { stdout, stdin } = options;
  const cols = stdout !== null && stdout.isTTY ? stdout.columns : 80;
  const rows = stdout !== null && stdout.isTTY ? stdout.rows : 24;
  const startedAt = nowIso();
  const startedMs = Date.now();

  let proc: IPty;
  try {
    proc = spawn(shell, ['-c', command], {
      name: 'xterm-256color',
      cols,
      rows,
      cwd: options.cwd,
      env: cleanEnv(),
    });
  } catch (error) {
    throw new CampsiteError(
      'CAPTURE_SPAWN_FAILED',
      `명령을 시작하지 못했습니다: ${String(error)}`,
      `셸(${shell})이 실행 가능한지 확인하세요. node-pty 문제라면 npm rebuild node-pty 후 다시 시도하세요.`,
      { command, shell },
      { cause: error },
    );
  }

  const buffer = new CappedBuffer(Math.floor((options.maxBytes ?? DEFAULT_CAP_BYTES) / 2));
  let interactive = false;

  proc.onData((chunk: string) => {
    if (!interactive && ALT_SCREEN_PATTERNS.some((pattern) => chunk.includes(pattern))) {
      interactive = true;
    }
    buffer.push(chunk);
    if (stdout !== null) stdout.write(chunk);
  });

  const detachTerminal = attachTerminal(proc, stdout, stdin);
  return new Promise((resolve) => {
    proc.onExit(({ exitCode, signal }) => {
      detachTerminal();
      resolve({
        output: buffer.value(),
        exit_code: exitCode,
        signal: signal === undefined || signal === 0 ? null : signal,
        started_at: startedAt,
        ended_at: nowIso(),
        duration_ms: Date.now() - startedMs,
        interactive,
        truncated: buffer.truncated,
      });
    });
  });
}
