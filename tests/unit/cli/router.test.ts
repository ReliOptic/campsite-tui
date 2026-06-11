import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../../src/config/env.js';
import { createLogger } from '../../../src/utils/logger.js';
import { runCli, type CliDeps } from '../../../src/cli/router.js';

const VERSION = '0.1.0-test';

async function makeDeps(): Promise<CliDeps> {
  const home = await mkdtemp(join(tmpdir(), 'cstui-cli-'));
  return {
    version: VERSION,
    config: loadConfig({ CAMPSITE_TUI_HOME: home }),
    logger: createLogger({ write: () => undefined }),
    cwd: home,
  };
}

describe('runCli', () => {
  it('--version / -v 는 버전을 출력하고 0으로 종료한다', async () => {
    const deps = await makeDeps();
    expect(await runCli(['--version'], deps)).toEqual({ exitCode: 0, output: VERSION });
    expect(await runCli(['-v'], deps)).toEqual({ exitCode: 0, output: VERSION });
  });

  it('--help / -h / 무인수는 사용법을 출력하고 0으로 종료한다', async () => {
    const deps = await makeDeps();
    for (const argv of [['--help'], ['-h'], []]) {
      const result = await runCli(argv, deps);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain('사용법');
      expect(result.output).toContain('cstui');
    }
  });

  it('알 수 없는 인수는 1로 종료하고 사용법을 함께 보여준다', async () => {
    const deps = await makeDeps();
    const result = await runCli(['--nope'], deps);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('알 수 없는 인수: --nope');
    expect(result.output).toContain('사용법');
  });

  it('context: 세션 없으면 자동감지 + 안내, set 후에는 세션 정보를 보여준다', async () => {
    const deps = await makeDeps();
    const before = await runCli(['context'], deps);
    expect(before.exitCode).toBe(0);
    expect(before.output).toContain('자동감지된 컨텍스트');
    expect(before.output).toContain('unknown');

    const set = await runCli(
      ['context', 'set', '--task', '가이드 8단계: Hermes 설치', '--agent', 'Hermes'],
      deps,
    );
    expect(set.exitCode).toBe(0);
    expect(set.output).toContain('가이드 8단계: Hermes 설치');

    const after = await runCli(['context'], deps);
    expect(after.output).toContain('sess_');
    expect(after.output).toContain('Hermes');
  });

  it('context --json은 파싱 가능한 JSON을 출력한다', async () => {
    const deps = await makeDeps();
    await runCli(['context', 'set', '--task', 't1'], deps);
    const result = await runCli(['context', '--json'], deps);
    const parsed = JSON.parse(result.output) as {
      session: { task: string };
      detected: { cwd: string };
    };
    expect(parsed.session.task).toBe('t1');
    expect(parsed.detected.cwd).toBe(deps.cwd);
  });

  it('잘못된 motif는 1로 종료하고 허용값을 안내한다', async () => {
    const deps = await makeDeps();
    const result = await runCli(['context', 'set', '--motif', 'castle'], deps);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('campsite');
  });
});
