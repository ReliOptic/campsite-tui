import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TerminalEnv } from '../../../src/config/terminal-env.js';
import { detectEnvironment } from '../../../src/services/environment.js';

const term: TerminalEnv = {
  isRemote: false,
  wayland: false,
  platform: 'darwin',
  shell: '/bin/zsh',
  termProgram: 'ghostty',
};

async function makeDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'cstui-env-'));
}

describe('detectEnvironment', () => {
  it('빈 디렉토리: package_manager/package는 null, 런타임 정보는 채워진다', async () => {
    const dir = await makeDir();
    const env = await detectEnvironment(dir, term);
    expect(env.package_manager).toBeNull();
    expect(env.package).toBeNull();
    expect(env.node).toBe(process.versions.node);
    expect(env.platform).toBe(process.platform);
    expect(env.terminal).toEqual({ term_program: 'ghostty', remote: false });
  });

  it('락파일로 패키지 매니저를 감지한다 (pnpm 우선순위 포함)', async () => {
    const dir = await makeDir();
    await writeFile(join(dir, 'package-lock.json'), '{}');
    expect((await detectEnvironment(dir, term)).package_manager).toBe('npm');
    await writeFile(join(dir, 'pnpm-lock.yaml'), '');
    expect((await detectEnvironment(dir, term)).package_manager).toBe('pnpm');
  });

  it('package.json의 name/version만 읽는다 (그 외 필드 미포함)', async () => {
    const dir = await makeDir();
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'demo-app', version: '1.2.3', scripts: { secret: 'x' } }),
    );
    const env = await detectEnvironment(dir, term);
    expect(env.package).toEqual({ name: 'demo-app', version: '1.2.3' });
  });

  it('깨진 package.json은 null로 처리한다 (graceful)', async () => {
    const dir = await makeDir();
    await writeFile(join(dir, 'package.json'), '{broken');
    expect((await detectEnvironment(dir, term)).package).toBeNull();
  });

  it('SSH 원격 터미널 정보를 반영한다', async () => {
    const dir = await makeDir();
    const env = await detectEnvironment(dir, { ...term, isRemote: true, termProgram: null });
    expect(env.terminal).toEqual({ term_program: null, remote: true });
  });
});
