import { describe, expect, it } from 'vitest';
import { appendFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CommandBlock } from '../../../src/types/block.types.js';
import {
  appendBlock,
  blocksPath,
  lastBlock,
  readBlocks,
} from '../../../src/services/block-store.js';
import { createLogger } from '../../../src/utils/logger.js';

const silent = createLogger({ write: () => undefined });

function makeBlock(id: string, command: string): CommandBlock {
  return {
    block_id: id,
    session_id: 'sess_test',
    command,
    output: `${command} 출력\n`,
    exit_code: 0,
    signal: null,
    started_at: '2026-06-11T10:00:00.000Z',
    ended_at: '2026-06-11T10:00:01.000Z',
    duration_ms: 1000,
    capture_method: 'pty_runner',
    dirty: false,
    interactive: false,
    truncated: false,
    cwd: '/tmp',
    repo: 'ReliOptic/campsite',
    branch: 'main',
    task: '테스트',
    agent: 'Hermes',
    mode: 'debug',
  };
}

describe('block-store', () => {
  it('append 후 read 라운드트립이 무손실이다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cstui-store-'));
    const block = makeBlock('blk_1', 'echo one');
    await appendBlock(dir, block, silent);
    const { blocks, corrupt } = await readBlocks(dir, undefined, silent);
    expect(corrupt).toBe(0);
    expect(blocks).toEqual([block]);
  });

  it('파일이 없으면 빈 결과 (정상 상태)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cstui-store-'));
    expect(await readBlocks(dir, undefined, silent)).toEqual({ blocks: [], corrupt: 0 });
    expect(await lastBlock(dir, silent)).toBeNull();
  });

  it('손상 라인은 건너뛰고 개수를 보고하며 나머지는 읽는다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cstui-store-'));
    await appendBlock(dir, makeBlock('blk_1', 'echo one'), silent);
    await appendFile(blocksPath(dir), '{broken json\n');
    await appendFile(blocksPath(dir), '{"valid_json": "but wrong shape"}\n');
    await appendBlock(dir, makeBlock('blk_2', 'echo two'), silent);

    const { blocks, corrupt } = await readBlocks(dir, undefined, silent);
    expect(corrupt).toBe(2);
    expect(blocks.map((b) => b.block_id)).toEqual(['blk_1', 'blk_2']);
  });

  it('lastN은 마지막 N개만, lastBlock은 마지막 1개를 반환한다', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cstui-store-'));
    for (let i = 1; i <= 5; i += 1) {
      await appendBlock(dir, makeBlock(`blk_${i}`, `echo ${i}`), silent);
    }
    const { blocks } = await readBlocks(dir, 2, silent);
    expect(blocks.map((b) => b.block_id)).toEqual(['blk_4', 'blk_5']);
    expect((await lastBlock(dir, silent))?.block_id).toBe('blk_5');
  });
});
