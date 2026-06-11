import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../../src/config/env.js';
import type { TerminalEnv } from '../../../src/config/terminal-env.js';
import { runDoctor, type DoctorPorts } from '../../../src/services/doctor.js';

const config = loadConfig({ CAMPSITE_TUI_HOME: '/tmp/cstui-doctor-test' });

const macLocal: TerminalEnv = {
  isRemote: false,
  wayland: false,
  platform: 'darwin',
  shell: '/bin/zsh',
  termProgram: 'ghostty',
};

function makePorts(overrides: Partial<DoctorPorts> = {}): DoctorPorts {
  return {
    nodeVersion: () => '22.22.3',
    ptyEcho: () => Promise.resolve({ exit_code: 0, output: 'doctor-ok\r\n' }),
    writeProbe: () => Promise.resolve(),
    hasTool: () => Promise.resolve(true),
    ...overrides,
  };
}

function statusOf(report: Awaited<ReturnType<typeof runDoctor>>, id: string): string {
  const check = report.checks.find((c) => c.id === id);
  if (check === undefined) throw new Error(`check 없음: ${id}`);
  return check.status;
}

describe('runDoctor', () => {
  it('정상 환경: 6개 검사 전부 ok, report.ok=true', async () => {
    const report = await runDoctor(config, macLocal, makePorts());
    expect(report.checks).toHaveLength(6);
    expect(report.checks.every((c) => c.status === 'ok')).toBe(true);
    expect(report.ok).toBe(true);
  });

  it('Node 20 미만이면 node=fail, report.ok=false', async () => {
    const report = await runDoctor(config, macLocal, makePorts({ nodeVersion: () => '18.19.0' }));
    expect(statusOf(report, 'node')).toBe('fail');
    expect(report.ok).toBe(false);
  });

  it('PTY spawn이 throw하면 pty=fail + 복구 안내 포함', async () => {
    const report = await runDoctor(
      config,
      macLocal,
      makePorts({ ptyEcho: () => Promise.reject(new Error('posix_spawnp failed')) }),
    );
    expect(statusOf(report, 'pty')).toBe('fail');
    const pty = report.checks.find((c) => c.id === 'pty');
    expect(pty?.detail).toContain('npm rebuild node-pty');
    expect(report.ok).toBe(false);
  });

  it('저장소 쓰기 실패는 store=fail', async () => {
    const report = await runDoctor(
      config,
      macLocal,
      makePorts({ writeProbe: () => Promise.reject(new Error('EACCES')) }),
    );
    expect(statusOf(report, 'store')).toBe('fail');
  });

  it('git 없음은 fail이 아니라 warn (동작은 가능)', async () => {
    const report = await runDoctor(
      config,
      macLocal,
      makePorts({ hasTool: (tool) => Promise.resolve(tool !== 'git') }),
    );
    expect(statusOf(report, 'git')).toBe('warn');
    expect(report.ok).toBe(true);
  });

  it('SSH 원격은 clipboard=warn + OSC 52 안내', async () => {
    const remote: TerminalEnv = { ...macLocal, isRemote: true, platform: 'linux', termProgram: null };
    const report = await runDoctor(config, remote, makePorts());
    expect(statusOf(report, 'clipboard')).toBe('warn');
    const clip = report.checks.find((c) => c.id === 'clipboard');
    expect(clip?.detail).toContain('OSC 52');
  });

  it('Terminal.app은 terminal=warn (원격 복사 미지원 안내)', async () => {
    const report = await runDoctor(
      config,
      { ...macLocal, termProgram: 'Apple_Terminal' },
      makePorts(),
    );
    expect(statusOf(report, 'terminal')).toBe('warn');
  });
});
