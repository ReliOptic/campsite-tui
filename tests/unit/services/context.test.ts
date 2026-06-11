import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { detectContext, parseRepoFromRemote } from '../../../src/services/context.js';

const exec = promisify(execFile);

async function makeGitRepo(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'cstui-git-'));
  const run = (args: string[]): Promise<unknown> => exec('git', ['-C', dir, ...args]);
  await exec('git', ['init', '-b', 'main', dir]);
  await run(['config', 'user.email', 'test@example.com']);
  await run(['config', 'user.name', 'Test']);
  await writeFile(join(dir, 'a.txt'), 'hello\n');
  await run(['add', '.']);
  await run(['commit', '-m', 'init']);
  return dir;
}

describe('parseRepoFromRemote', () => {
  it('SSH/HTTPS 원격 URL에서 owner/repo를 추출한다', () => {
    expect(parseRepoFromRemote('git@github.com:ReliOptic/campsite.git')).toBe('ReliOptic/campsite');
    expect(parseRepoFromRemote('https://github.com/ReliOptic/campsite.git')).toBe('ReliOptic/campsite');
    expect(parseRepoFromRemote('https://github.com/ReliOptic/campsite')).toBe('ReliOptic/campsite');
  });
  it('해석 불가 입력은 null', () => {
    expect(parseRepoFromRemote('not a url')).toBeNull();
  });
});

describe('detectContext', () => {
  it('git 저장소: branch 감지, 커밋 직후 clean', async () => {
    const dir = await makeGitRepo();
    const ctx = await detectContext(dir);
    expect(ctx.branch).toBe('main');
    expect(ctx.dirty).toBe(false);
    expect(ctx.repo).not.toBeNull(); // 원격 없으면 디렉토리명 폴백
  });

  it('파일 변경 시 dirty=true', async () => {
    const dir = await makeGitRepo();
    await writeFile(join(dir, 'a.txt'), 'changed\n');
    expect((await detectContext(dir)).dirty).toBe(true);
  });

  it('원격 origin이 있으면 owner/repo를 사용한다', async () => {
    const dir = await makeGitRepo();
    await exec('git', ['-C', dir, 'remote', 'add', 'origin', 'git@github.com:ReliOptic/campsite.git']);
    expect((await detectContext(dir)).repo).toBe('ReliOptic/campsite');
  });

  it('git 저장소가 아니면 전부 null (정직한 unknown)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'cstui-plain-'));
    const ctx = await detectContext(dir);
    expect(ctx.repo).toBeNull();
    expect(ctx.branch).toBeNull();
    expect(ctx.dirty).toBeNull();
  });
});
