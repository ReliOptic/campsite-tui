/**
 * 블록 저장소 — blocks.jsonl append-only (PRD §11 F7, TECH-SPEC T8).
 * 블록 1개 = JSONL 1라인, append 후 fsync. 손상 라인은 건너뛰고 개수를 보고한다.
 */
import { mkdir, open, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { CommandBlock } from '../types/block.types.js';
import { toCampsiteError } from '../types/errors.types.js';
import type { Logger } from '../utils/logger.js';

const blockSchema = z.object({
  block_id: z.string().min(1),
  session_id: z.string().min(1),
  command: z.string(),
  output: z.string(),
  exit_code: z.number().int(),
  signal: z.number().int().nullable(),
  started_at: z.string(),
  ended_at: z.string(),
  duration_ms: z.number(),
  capture_method: z.enum(['pty_runner', 'stdin_pipe', 'wrapper']),
  dirty: z.boolean().nullable(),
  interactive: z.boolean(),
  truncated: z.boolean(),
  cwd: z.string(),
  repo: z.string().nullable(),
  branch: z.string().nullable(),
  task: z.string().nullable(),
  agent: z.string().nullable(),
  mode: z.string().nullable(),
});

export interface BlockReadResult {
  readonly blocks: readonly CommandBlock[];
  readonly corrupt: number;
}

const IO_RECOVERY = '디스크 공간과 디렉토리 권한을 확인한 뒤 다시 시도하세요.';

export function blocksPath(sessionDir: string): string {
  return join(sessionDir, 'blocks.jsonl');
}

export async function appendBlock(
  sessionDir: string,
  block: CommandBlock,
  logger: Logger,
): Promise<void> {
  try {
    await mkdir(sessionDir, { recursive: true });
    const handle = await open(blocksPath(sessionDir), 'a');
    try {
      await handle.writeFile(`${JSON.stringify(block)}\n`, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    logger.info('블록 저장됨', {
      block_id: block.block_id,
      exit_code: block.exit_code,
      output_chars: block.output.length,
      truncated: block.truncated,
    });
  } catch (error) {
    throw toCampsiteError(error, 'STORE_IO_FAILED', IO_RECOVERY);
  }
}

export async function readBlocks(
  sessionDir: string,
  lastN: number | undefined,
  logger: Logger,
): Promise<BlockReadResult> {
  let raw: string;
  try {
    raw = await readFile(blocksPath(sessionDir), 'utf8');
  } catch {
    // 파일이 아직 없는 것은 정상 상태 (블록 0개)
    return { blocks: [], corrupt: 0 };
  }
  const blocks: CommandBlock[] = [];
  let corrupt = 0;
  for (const line of raw.split('\n')) {
    if (line.trim().length === 0) continue;
    try {
      const parsed = blockSchema.safeParse(JSON.parse(line));
      if (parsed.success) {
        blocks.push(parsed.data);
      } else {
        corrupt += 1;
      }
    } catch {
      corrupt += 1;
    }
  }
  if (corrupt > 0) {
    logger.warn('손상된 블록 라인을 건너뜀', { corrupt, sessionDir });
  }
  return { blocks: lastN !== undefined ? blocks.slice(-lastN) : blocks, corrupt };
}

export async function lastBlock(
  sessionDir: string,
  logger: Logger,
): Promise<CommandBlock | null> {
  const { blocks } = await readBlocks(sessionDir, 1, logger);
  return blocks[blocks.length - 1] ?? null;
}
