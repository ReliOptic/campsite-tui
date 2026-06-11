/**
 * 환경 설정 로딩 — process.env를 읽는 유일한 모듈.
 * 환경변수: CAMPSITE_TUI_HOME(저장 루트), CSTUI_LANG(ko|en), NO_COLOR(색상 비활성).
 */
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { CampsiteError } from '../types/errors.types.js';

const envSchema = z.object({
  CAMPSITE_TUI_HOME: z.string().min(1).optional(),
  CSTUI_LANG: z.enum(['ko', 'en']).optional(),
  NO_COLOR: z.string().optional(),
});

export type Lang = 'ko' | 'en';

export interface AppConfig {
  /** 블록 저장 루트 (기본: ~/.campsite-tui) */
  readonly homeDir: string;
  readonly sessionsDir: string;
  readonly lang: Lang;
  readonly color: boolean;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new CampsiteError(
      'CONFIG_INVALID',
      `환경변수가 올바르지 않습니다: ${issues}`,
      'CSTUI_LANG은 ko 또는 en만 허용됩니다. 잘못된 환경변수를 해제하고 다시 실행하세요.',
      { issues },
    );
  }
  const homeDir = parsed.data.CAMPSITE_TUI_HOME ?? join(homedir(), '.campsite-tui');
  return {
    homeDir,
    sessionsDir: join(homeDir, 'sessions'),
    lang: parsed.data.CSTUI_LANG ?? 'ko',
    color: parsed.data.NO_COLOR === undefined || parsed.data.NO_COLOR === '',
  };
}
