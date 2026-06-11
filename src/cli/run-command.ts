/**
 * `cstui run "<명령>"` — 명령을 PTY로 실행하고 블록으로 저장한다 (PRD §11 F2).
 * 자식의 exit code를 그대로 전달해 스크립트/에이전트 체이닝이 가능하게 한다.
 */
import type { CommandBlock } from '../types/block.types.js';
import { createId } from '../utils/id.js';
import type { ParsedArgs } from '../utils/parse-args.js';
import { formatDuration } from '../utils/time.js';
import { captureCommand } from '../services/capture.js';
import { appendBlock } from '../services/block-store.js';
import { detectContext } from '../services/context.js';
import { createSessionService } from '../services/session.js';
import type { CliDeps } from './router.js';
import type { CliResult } from './result.js';

export async function runCommand(args: ParsedArgs, deps: CliDeps): Promise<CliResult> {
  const commandParts = args.positionals.slice(1);
  if (commandParts.length === 0) {
    return { exitCode: 1, output: '실행할 명령이 없습니다. 예: cstui run "npm test"' };
  }
  const command = commandParts.join(' ');

  const sessions = createSessionService(deps.config, deps.logger);
  const session = await sessions.loadOrCreate(deps.cwd);
  const detected = await detectContext(deps.cwd);

  const captured = await captureCommand(command, {
    cwd: deps.cwd,
    stdout: process.stdout,
    stdin: process.stdin,
  });

  const block: CommandBlock = {
    block_id: createId('blk'),
    session_id: session.session_id,
    command,
    output: captured.output,
    exit_code: captured.exit_code,
    signal: captured.signal,
    started_at: captured.started_at,
    ended_at: captured.ended_at,
    duration_ms: captured.duration_ms,
    capture_method: 'pty_runner',
    dirty: detected.dirty,
    interactive: captured.interactive,
    truncated: captured.truncated,
    cwd: deps.cwd,
    repo: detected.repo ?? session.repo,
    branch: detected.branch ?? session.branch,
    task: session.task,
    agent: session.agent,
    mode: session.mode,
  };
  await appendBlock(sessions.sessionDir(session.session_id), block, deps.logger);

  const status = captured.exit_code === 0 ? '✅' : '❌';
  const notes = [
    captured.interactive ? '🖥 인터랙티브(캡처 제한)' : null,
    captured.truncated ? '✂️ 출력 일부 생략 저장' : null,
  ].filter((note): note is string => note !== null);
  const noteText = notes.length > 0 ? ` · ${notes.join(' · ')}` : '';

  return {
    exitCode: captured.exit_code,
    output: [
      '',
      `${status} ${block.block_id} 저장됨 — exit ${captured.exit_code} · ${formatDuration(captured.duration_ms)}${noteText}`,
      '   복사: cstui block copy-last · 목록: cstui block list',
    ].join('\n'),
  };
}
