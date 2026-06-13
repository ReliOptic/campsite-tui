/**
 * `cstui capture` — 이미 실행된 명령의 stdin 출력을 블록으로 저장한다.
 * 에이전트/스크립트가 자신의 실행 결과를 파이프로 밀어 넣는 정직한 ingress 표면이다.
 */
import { appendBlock } from '../services/block-store.js';
import { detectContext } from '../services/context.js';
import { createSessionService } from '../services/session.js';
import type { CommandBlock } from '../types/block.types.js';
import { createId } from '../utils/id.js';
import type { ParsedArgs } from '../utils/parse-args.js';
import { stringFlag } from '../utils/parse-args.js';
import { formatDuration, nowIso } from '../utils/time.js';
import type { CliDeps } from './router.js';
import type { CliResult } from './result.js';

const DEFAULT_CAP_BYTES = 2 * 1024 * 1024;

class StdinBuffer {
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

function parseExitCode(raw: string | undefined): number | null {
  if (raw === undefined || raw.trim().length === 0) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

async function readStdin(
  stdin: NodeJS.ReadableStream,
): Promise<{ output: string; truncated: boolean }> {
  const buffer = new StdinBuffer(Math.floor(DEFAULT_CAP_BYTES / 2));
  for await (const chunk of stdin as AsyncIterable<Buffer | string>) {
    buffer.push(Buffer.isBuffer(chunk) ? chunk.toString('utf8') : chunk);
  }
  return { output: buffer.value(), truncated: buffer.truncated };
}

export async function captureCommand(args: ParsedArgs, deps: CliDeps): Promise<CliResult> {
  const command = stringFlag(args, 'command');
  if (command === undefined || command.length === 0) {
    return {
      exitCode: 1,
      output: '캡처할 명령 문자열이 필요합니다. 예: cstui capture --command "npm test" --exit-code 1',
    };
  }

  const exitCode = parseExitCode(stringFlag(args, 'exit-code'));
  if (exitCode === null) {
    return {
      exitCode: 1,
      output: '--exit-code 값이 필요합니다. stdin 파이프 캡처는 실행 결과를 추측하지 않습니다.',
    };
  }

  const startedAt = nowIso();
  const startedMs = Date.now();
  const captured = await readStdin(deps.stdin ?? process.stdin);
  const endedAt = nowIso();
  const durationMs = Date.now() - startedMs;
  const sessions = createSessionService(deps.config, deps.logger);
  const session = await sessions.loadOrCreate(deps.cwd);
  const detected = await detectContext(deps.cwd);

  const block: CommandBlock = {
    block_id: createId('blk'),
    session_id: session.session_id,
    command,
    output: captured.output,
    exit_code: exitCode,
    signal: null,
    started_at: startedAt,
    ended_at: endedAt,
    duration_ms: durationMs,
    capture_method: 'stdin_pipe',
    dirty: detected.dirty,
    interactive: false,
    truncated: captured.truncated,
    cwd: deps.cwd,
    repo: detected.repo ?? session.repo,
    branch: detected.branch ?? session.branch,
    task: session.task,
    agent: session.agent,
    mode: session.mode,
  };
  await appendBlock(sessions.sessionDir(session.session_id), block, deps.logger);

  const status = exitCode === 0 ? '✅' : '❌';
  const noteText = captured.truncated ? ' · ✂️ 출력 일부 생략 저장' : '';
  return {
    exitCode,
    output: [
      '',
      `${status} ${block.block_id} 저장됨 — stdin_pipe · exit ${exitCode} · ${formatDuration(durationMs)}${noteText}`,
      '   복사: cstui block copy-last · 목록: cstui block list',
    ].join('\n'),
  };
}
