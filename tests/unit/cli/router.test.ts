import { describe, expect, it } from 'vitest';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { loadConfig } from '../../../src/config/env.js';
import { createLogger } from '../../../src/utils/logger.js';
import { runCli, type CliDeps } from '../../../src/cli/router.js';

const VERSION = '0.1.0-test';

async function makeDeps(stdin?: NodeJS.ReadableStream): Promise<CliDeps> {
  const home = await mkdtemp(join(tmpdir(), 'cstui-cli-'));
  return {
    version: VERSION,
    config: loadConfig({ CAMPSITE_TUI_HOME: home }),
    logger: createLogger({ write: () => undefined }),
    cwd: home,
    ...(stdin !== undefined ? { stdin } : {}),
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

  it('context --json: schema_version·session·detected·environment 핸드오프 페이로드', async () => {
    const deps = await makeDeps();
    await runCli(['context', 'set', '--task', 't1'], deps);
    const result = await runCli(['context', '--json'], deps);
    const parsed = JSON.parse(result.output) as {
      schema_version: number;
      session: { task: string };
      detected: { cwd: string; repo_root: string | null; remote_url: string | null };
      environment: { node: string; platform: string; terminal: { remote: boolean } };
    };
    expect(parsed.schema_version).toBe(1);
    expect(parsed.session.task).toBe('t1');
    expect(parsed.detected.cwd).toBe(deps.cwd);
    expect(parsed.detected.repo_root).toBeNull(); // tmpdir는 git 저장소 아님
    expect(parsed.environment.node).toBe(process.versions.node);
    expect(typeof parsed.environment.terminal.remote).toBe('boolean');
  });

  it('context --json: 세션이 없어도 동일 스키마(session=null)로 출력한다', async () => {
    const deps = await makeDeps();
    const result = await runCli(['context', '--json'], deps);
    const parsed = JSON.parse(result.output) as {
      schema_version: number;
      session: null;
      environment: { node: string };
    };
    expect(parsed.schema_version).toBe(1);
    expect(parsed.session).toBeNull();
    expect(parsed.environment.node).toBe(process.versions.node);
  });

  it('잘못된 motif는 1로 종료하고 허용값을 안내한다', async () => {
    const deps = await makeDeps();
    const result = await runCli(['context', 'set', '--motif', 'castle'], deps);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('campsite');
  });

  it('capture: stdin 파이프를 stdin_pipe 블록으로 저장한다', async () => {
    const deps = await makeDeps(Readable.from(['one\n', 'two\n']));
    const capture = await runCli(
      ['capture', '--command', 'printf "one\\ntwo\\n"', '--exit-code', '7'],
      deps,
    );
    expect(capture.exitCode).toBe(7);
    expect(capture.output).toContain('stdin_pipe');

    const last = await runCli(['block', 'last', '--json'], deps);
    const block = JSON.parse(last.output) as {
      command: string;
      output: string;
      exit_code: number;
      capture_method: string;
      signal: number | null;
      interactive: boolean;
    };
    expect(block.command).toBe('printf "one\\ntwo\\n"');
    expect(block.output).toBe('one\ntwo\n');
    expect(block.exit_code).toBe(7);
    expect(block.capture_method).toBe('stdin_pipe');
    expect(block.signal).toBeNull();
    expect(block.interactive).toBe(false);
  });

  it('capture: --exit-code 없이는 실행 결과를 추측하지 않는다', async () => {
    const deps = await makeDeps(Readable.from(['output\n']));
    const result = await runCli(['capture', '--command', 'npm test'], deps);
    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('--exit-code');
  });
});
