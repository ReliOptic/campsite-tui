/**
 * 클립보드 — 단계적 폴백 체인 (TECH-SPEC T1 §2 결정).
 * 로컬: pbcopy/wl-copy/xclip → 원격(SSH)/실패: OSC 52 → 최후: 파일 저장.
 * OSC 52는 성공 여부를 알 수 없으므로(write-only) 메시지로 정직하게 안내한다.
 */
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { openSync, writeSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import type { TerminalEnv } from '../config/terminal-env.js';

/** OSC 52 페이로드 상한 — 초과 시 파일 폴백 (터미널별 한계 보호) */
const OSC52_MAX_BASE64 = 200_000;

export type ClipboardMethod = 'pbcopy' | 'wl-copy' | 'xclip' | 'osc52' | 'file';

export interface ClipboardOutcome {
  readonly method: ClipboardMethod;
  readonly path: string | null;
  readonly message: string;
}

export interface ClipboardPorts {
  runTool(tool: string, args: readonly string[], input: string): Promise<boolean>;
  emitOsc52(payloadBase64: string): boolean;
  writeExportFile(content: string): Promise<string>;
}

export function defaultClipboardPorts(exportsDir: string): ClipboardPorts {
  return {
    runTool(tool, args, input) {
      return new Promise((resolve) => {
        const child = spawn(tool, [...args], { stdio: ['pipe', 'ignore', 'ignore'] });
        child.once('error', () => resolve(false));
        child.once('close', (code) => resolve(code === 0));
        child.stdin.end(input);
      });
    },
    emitOsc52(payloadBase64) {
      try {
        const fd = openSync('/dev/tty', 'w');
        try {
          writeSync(fd, `\u001b]52;c;${payloadBase64}\u0007`);
        } finally {
          closeSync(fd);
        }
        return true;
      } catch {
        return false;
      }
    },
    async writeExportFile(content) {
      await mkdir(exportsDir, { recursive: true });
      const path = join(exportsDir, `block-${Date.now()}.md`);
      await writeFile(path, content, 'utf8');
      return path;
    },
  };
}

async function tryLocalTools(
  text: string,
  env: TerminalEnv,
  ports: ClipboardPorts,
): Promise<ClipboardOutcome | null> {
  if (env.platform === 'darwin' && (await ports.runTool('pbcopy', [], text))) {
    return { method: 'pbcopy', path: null, message: '클립보드에 복사했습니다.' };
  }
  if (env.platform === 'linux') {
    if (env.wayland && (await ports.runTool('wl-copy', [], text))) {
      return { method: 'wl-copy', path: null, message: '클립보드에 복사했습니다.' };
    }
    if (await ports.runTool('xclip', ['-selection', 'clipboard'], text)) {
      return { method: 'xclip', path: null, message: '클립보드에 복사했습니다.' };
    }
  }
  return null;
}

export async function copyText(
  text: string,
  env: TerminalEnv,
  ports: ClipboardPorts,
): Promise<ClipboardOutcome> {
  if (!env.isRemote) {
    const local = await tryLocalTools(text, env, ports);
    if (local !== null) return local;
  }

  const payload = Buffer.from(text, 'utf8').toString('base64');
  if (payload.length <= OSC52_MAX_BASE64 && ports.emitOsc52(payload)) {
    return {
      method: 'osc52',
      path: null,
      message:
        '터미널 클립보드로 전송했습니다(OSC 52). 붙여넣기가 안 되면 Ghostty/iTerm2 등 OSC 52 지원 터미널을 사용하세요.',
    };
  }

  const path = await ports.writeExportFile(text);
  return {
    method: 'file',
    path,
    message: `클립보드를 사용할 수 없어 파일로 저장했습니다: ${path}`,
  };
}
