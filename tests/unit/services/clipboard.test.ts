import { describe, expect, it } from 'vitest';
import type { TerminalEnv } from '../../../src/config/terminal-env.js';
import { copyText, type ClipboardPorts } from '../../../src/services/clipboard.js';

interface FakeCalls {
  tools: string[];
  osc52: number;
  files: string[];
}

function makePorts(behavior: {
  toolSuccess?: readonly string[];
  osc52Success?: boolean;
}): { ports: ClipboardPorts; calls: FakeCalls } {
  const calls: FakeCalls = { tools: [], osc52: 0, files: [] };
  return {
    calls,
    ports: {
      runTool: (tool) => {
        calls.tools.push(tool);
        return Promise.resolve((behavior.toolSuccess ?? []).includes(tool));
      },
      emitOsc52: () => {
        calls.osc52 += 1;
        return behavior.osc52Success ?? false;
      },
      writeExportFile: (content) => {
        calls.files.push(content);
        return Promise.resolve('/tmp/exports/block-1.md');
      },
    },
  };
}

const macLocal: TerminalEnv = { isRemote: false, wayland: false, platform: 'darwin', shell: '/bin/zsh' };
const linuxRemote: TerminalEnv = { isRemote: true, wayland: false, platform: 'linux', shell: '/bin/bash' };

describe('copyText 폴백 체인 (TECH-SPEC T1)', () => {
  it('로컬 macOS: pbcopy 성공 시 즉시 종료', async () => {
    const { ports, calls } = makePorts({ toolSuccess: ['pbcopy'] });
    const outcome = await copyText('내용', macLocal, ports);
    expect(outcome.method).toBe('pbcopy');
    expect(calls.osc52).toBe(0);
  });

  it('SSH 원격: 로컬 도구를 건너뛰고 OSC 52로 간다', async () => {
    const { ports, calls } = makePorts({ osc52Success: true });
    const outcome = await copyText('내용', linuxRemote, ports);
    expect(outcome.method).toBe('osc52');
    expect(calls.tools).toEqual([]);
    expect(outcome.message).toContain('OSC 52');
  });

  it('OSC 52 실패 시 파일 폴백 + 경로 안내', async () => {
    const { ports } = makePorts({ osc52Success: false });
    const outcome = await copyText('내용', linuxRemote, ports);
    expect(outcome.method).toBe('file');
    expect(outcome.path).toBe('/tmp/exports/block-1.md');
    expect(outcome.message).toContain('/tmp/exports/block-1.md');
  });

  it('OSC 52 페이로드 상한 초과 시 emit 없이 파일 폴백', async () => {
    const { ports, calls } = makePorts({ osc52Success: true });
    const big = 'x'.repeat(300_000); // base64 후 200KB 초과
    const outcome = await copyText(big, linuxRemote, ports);
    expect(outcome.method).toBe('file');
    expect(calls.osc52).toBe(0);
  });

  it('로컬 Linux Wayland: wl-copy 우선, 실패 시 xclip', async () => {
    const env: TerminalEnv = { isRemote: false, wayland: true, platform: 'linux', shell: '/bin/bash' };
    const { ports, calls } = makePorts({ toolSuccess: ['xclip'] });
    const outcome = await copyText('내용', env, ports);
    expect(calls.tools).toEqual(['wl-copy', 'xclip']);
    expect(outcome.method).toBe('xclip');
  });
});
