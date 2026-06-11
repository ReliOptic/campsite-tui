/**
 * 환경 진단 — `hermes doctor`와 같은 패턴으로, 캡처·저장·복사 경로가
 * 이 환경에서 동작하는지 설치 직후 한 번에 확인한다 (이슈 #5 실측의 도구).
 */
import { execFile } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AppConfig } from '../config/env.js';
import type { TerminalEnv } from '../config/terminal-env.js';
import { captureCommand } from './capture.js';

export type DoctorStatus = 'ok' | 'warn' | 'fail';

export interface DoctorCheck {
  readonly id: string;
  readonly label: string;
  readonly status: DoctorStatus;
  readonly detail: string;
}

export interface DoctorReport {
  readonly checks: readonly DoctorCheck[];
  /** fail이 하나도 없으면 true (warn은 허용) */
  readonly ok: boolean;
}

export interface DoctorPorts {
  nodeVersion(): string;
  ptyEcho(): Promise<{ readonly exit_code: number; readonly output: string }>;
  writeProbe(dir: string): Promise<void>;
  hasTool(tool: string): Promise<boolean>;
}

export function defaultDoctorPorts(): DoctorPorts {
  return {
    nodeVersion: () => process.versions.node,
    async ptyEcho() {
      const result = await captureCommand('echo doctor-ok', {
        cwd: tmpdir(),
        stdout: null,
        stdin: null,
      });
      return { exit_code: result.exit_code, output: result.output };
    },
    async writeProbe(dir: string) {
      await mkdir(dir, { recursive: true });
      const probe = join(dir, `.doctor-probe-${Date.now()}`);
      await writeFile(probe, 'ok', 'utf8');
      await rm(probe);
    },
    hasTool(tool: string) {
      return new Promise((resolve) => {
        execFile('sh', ['-c', `command -v ${tool}`], (error) => resolve(error === null));
      });
    },
  };
}

/** OSC 52 클립보드 write를 지원하는 것으로 알려진 터미널 (TECH-SPEC §2) */
const OSC52_TERMINALS = ['ghostty', 'iTerm.app', 'WezTerm', 'kitty', 'vscode'] as const;

function checkNode(ports: DoctorPorts): DoctorCheck {
  const version = ports.nodeVersion();
  const major = Number(version.split('.')[0]);
  return {
    id: 'node',
    label: 'Node.js',
    status: major >= 20 ? 'ok' : 'fail',
    detail:
      major >= 20 ? `v${version} (>= 20)` : `v${version} — Node 20 이상이 필요합니다. 설치: https://nodejs.org`,
  };
}

async function checkPty(ports: DoctorPorts): Promise<DoctorCheck> {
  try {
    const result = await ports.ptyEcho();
    const passed = result.exit_code === 0 && result.output.includes('doctor-ok');
    return {
      id: 'pty',
      label: 'PTY 캡처',
      status: passed ? 'ok' : 'fail',
      detail: passed
        ? '명령 실행·출력 캡처 정상'
        : `echo 캡처 실패 (exit ${result.exit_code}) — npm rebuild node-pty 후 다시 시도하세요`,
    };
  } catch (error) {
    return {
      id: 'pty',
      label: 'PTY 캡처',
      status: 'fail',
      detail: `spawn 실패: ${String(error)} — node_modules/node-pty 재설치(npm rebuild node-pty)를 시도하세요`,
    };
  }
}

async function checkStore(config: AppConfig, ports: DoctorPorts): Promise<DoctorCheck> {
  try {
    await ports.writeProbe(config.homeDir);
    return { id: 'store', label: '블록 저장소', status: 'ok', detail: `${config.homeDir} 쓰기 가능` };
  } catch (error) {
    return {
      id: 'store',
      label: '블록 저장소',
      status: 'fail',
      detail: `${config.homeDir} 쓰기 실패: ${String(error)} — 디스크 공간·권한을 확인하세요`,
    };
  }
}

async function checkGit(ports: DoctorPorts): Promise<DoctorCheck> {
  const found = await ports.hasTool('git');
  return {
    id: 'git',
    label: 'git',
    status: found ? 'ok' : 'warn',
    detail: found
      ? '감지됨 — repo/branch 자동감지 활성'
      : '없음 — repo/branch가 unknown으로 기록됩니다 (sudo apt-get install -y git)',
  };
}

async function checkClipboard(env: TerminalEnv, ports: DoctorPorts): Promise<DoctorCheck> {
  if (env.isRemote) {
    return {
      id: 'clipboard',
      label: '클립보드',
      status: 'warn',
      detail: 'SSH 세션 — OSC 52로 로컬 터미널에 복사합니다 (Ghostty/iTerm2 권장, 실패 시 파일 폴백)',
    };
  }
  if (env.platform === 'darwin') {
    const found = await ports.hasTool('pbcopy');
    return {
      id: 'clipboard',
      label: '클립보드',
      status: found ? 'ok' : 'warn',
      detail: found ? 'pbcopy 사용 가능' : 'pbcopy 없음 — OSC 52/파일 폴백 사용',
    };
  }
  const tool = env.wayland && (await ports.hasTool('wl-copy')) ? 'wl-copy' : (await ports.hasTool('xclip')) ? 'xclip' : null;
  return {
    id: 'clipboard',
    label: '클립보드',
    status: tool !== null ? 'ok' : 'warn',
    detail: tool !== null ? `${tool} 사용 가능` : '클립보드 도구 없음 — OSC 52/파일 폴백 사용 (xclip 설치 권장)',
  };
}

function checkTerminal(env: TerminalEnv): DoctorCheck {
  if (env.termProgram === null) {
    return {
      id: 'terminal',
      label: '터미널',
      status: 'warn',
      detail: '종류를 알 수 없음 — 원격 복사(OSC 52) 동작 여부는 붙여넣기로 확인하세요',
    };
  }
  if ((OSC52_TERMINALS as readonly string[]).includes(env.termProgram)) {
    return { id: 'terminal', label: '터미널', status: 'ok', detail: `${env.termProgram} (OSC 52 지원)` };
  }
  if (env.termProgram === 'Apple_Terminal') {
    return {
      id: 'terminal',
      label: '터미널',
      status: 'warn',
      detail: 'Terminal.app — 원격(SSH) 복사 미지원, Ghostty/iTerm2 권장 (로컬 복사는 정상)',
    };
  }
  return { id: 'terminal', label: '터미널', status: 'warn', detail: `${env.termProgram} — OSC 52 지원 미확인` };
}

export async function runDoctor(
  config: AppConfig,
  env: TerminalEnv,
  ports: DoctorPorts,
): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [
    checkNode(ports),
    await checkPty(ports),
    await checkStore(config, ports),
    await checkGit(ports),
    await checkClipboard(env, ports),
    checkTerminal(env),
  ];
  return { checks, ok: checks.every((check) => check.status !== 'fail') };
}
