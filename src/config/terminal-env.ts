/**
 * 터미널 환경 감지 — process.env를 읽는 config 계층 모듈.
 * 클립보드 전략(TECH-SPEC T1)과 셸 선택에 사용된다.
 */

export interface TerminalEnv {
  /** SSH 세션 여부 — OS 클립보드 도구 대신 OSC 52 경로를 써야 함 */
  readonly isRemote: boolean;
  readonly wayland: boolean;
  readonly platform: NodeJS.Platform;
  readonly shell: string;
}

export function detectTerminalEnv(env: NodeJS.ProcessEnv = process.env): TerminalEnv {
  return {
    isRemote: env['SSH_TTY'] !== undefined || env['SSH_CONNECTION'] !== undefined,
    wayland: env['WAYLAND_DISPLAY'] !== undefined,
    platform: process.platform,
    shell: env['SHELL'] ?? '/bin/sh',
  };
}
