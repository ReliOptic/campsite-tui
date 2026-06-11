/**
 * `cstui block list|last` — 저장된 블록 조회 (PRD §11 F3/F4의 CLI 형태).
 * copy-last는 M4(export+clipboard)에서 추가된다.
 */
import type { CommandBlock } from '../types/block.types.js';
import { boolFlag, stringFlag, type ParsedArgs } from '../utils/parse-args.js';
import { formatClock, formatDuration } from '../utils/time.js';
import { lastBlock, readBlocks } from '../services/block-store.js';
import { COPY_FORMATS, copyBlock, type CopyFormat } from '../services/copy-block.js';
import { createSessionService } from '../services/session.js';
import type { CliDeps } from './router.js';
import type { CliResult } from './result.js';

const NO_SESSION: CliResult = {
  exitCode: 1,
  output: '세션이 없습니다. cstui run "명령" 으로 첫 블록을 만들어보세요.',
};

export async function blockCommand(args: ParsedArgs, deps: CliDeps): Promise<CliResult> {
  const sessions = createSessionService(deps.config, deps.logger);
  const session = await sessions.current();
  if (session === null) return NO_SESSION;
  const sessionDir = sessions.sessionDir(session.session_id);

  switch (args.positionals[1]) {
    case 'list':
      return listBlocks(args, sessionDir, deps);
    case 'last':
      return showLast(args, sessionDir, deps);
    case 'copy-last':
      return copyLast(args, sessionDir, deps);
    default:
      return {
        exitCode: 1,
        output: `알 수 없는 block 하위 명령: ${args.positionals[1] ?? '(없음)'} (사용 가능: list, last, copy-last)`,
      };
  }
}

async function listBlocks(
  args: ParsedArgs,
  sessionDir: string,
  deps: CliDeps,
): Promise<CliResult> {
  const rawN = Number(stringFlag(args, 'n') ?? '10');
  const n = Number.isInteger(rawN) && rawN > 0 ? rawN : 10;
  const { blocks, corrupt } = await readBlocks(sessionDir, n, deps.logger);

  if (boolFlag(args, 'json')) {
    return { exitCode: 0, output: JSON.stringify({ blocks, corrupt }, null, 2) };
  }
  if (blocks.length === 0) {
    return { exitCode: 0, output: '저장된 블록이 없습니다. cstui run "명령" 으로 만들어보세요.' };
  }
  const rows = blocks.map((block, index) => {
    const status = block.exit_code === 0 ? '✅' : '❌';
    const order = String(index + 1).padStart(2, '0');
    const command = block.command.length > 44 ? `${block.command.slice(0, 43)}…` : block.command;
    return `${order} ${status} ${command.padEnd(45)} ${formatDuration(block.duration_ms).padStart(7)}  ${formatClock(block.started_at)}`;
  });
  const footer = corrupt > 0 ? `\n⚠️ 손상된 라인 ${corrupt}개를 건너뛰었습니다.` : '';
  return { exitCode: 0, output: `${rows.join('\n')}${footer}` };
}

async function showLast(
  args: ParsedArgs,
  sessionDir: string,
  deps: CliDeps,
): Promise<CliResult> {
  const block = await lastBlock(sessionDir, deps.logger);
  if (block === null) {
    return { exitCode: 1, output: '저장된 블록이 없습니다. cstui run "명령" 으로 만들어보세요.' };
  }
  if (boolFlag(args, 'json')) {
    return { exitCode: 0, output: JSON.stringify(block, null, 2) };
  }
  return { exitCode: 0, output: renderBlock(block) };
}

async function copyLast(
  args: ParsedArgs,
  sessionDir: string,
  deps: CliDeps,
): Promise<CliResult> {
  const block = await lastBlock(sessionDir, deps.logger);
  if (block === null) {
    return { exitCode: 1, output: '저장된 블록이 없습니다. cstui run "명령" 으로 만들어보세요.' };
  }
  const format = (stringFlag(args, 'format') ?? 'markdown') as CopyFormat;
  if (!COPY_FORMATS.includes(format)) {
    return { exitCode: 1, output: `알 수 없는 format: ${format} (허용: ${COPY_FORMATS.join(', ')})` };
  }
  const rawMaxLines = stringFlag(args, 'max-lines');
  const maxLines = rawMaxLines !== undefined ? Number(rawMaxLines) : undefined;

  const result = await copyBlock(
    block,
    sessionDir,
    {
      format,
      redact: !boolFlag(args, 'no-redact'),
      ...(maxLines !== undefined && Number.isInteger(maxLines) && maxLines > 0
        ? { maxLines }
        : {}),
    },
    deps.logger,
  );
  const redactNote =
    result.redactedCount > 0
      ? `\n🔒 시크릿 ${result.redactedCount}건 마스킹됨 (--no-redact 로 해제 가능)`
      : '';
  return {
    exitCode: 0,
    output: `📋 ${block.block_id} (${format}) — ${result.outcome.message}${redactNote}`,
  };
}

const show = (value: string | null): string => value ?? 'unknown';

function renderBlock(block: CommandBlock): string {
  return [
    'Command:',
    block.command,
    '',
    'Context:',
    `  Agent:    ${show(block.agent)}`,
    `  Mode:     ${show(block.mode)}`,
    `  Repo:     ${show(block.repo)}`,
    `  Branch:   ${show(block.branch)}`,
    `  Task:     ${show(block.task)}`,
    `  Exit:     ${block.exit_code}`,
    `  Duration: ${formatDuration(block.duration_ms)}`,
    '',
    'Output:',
    block.output,
  ].join('\n');
}
