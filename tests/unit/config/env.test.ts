import { describe, expect, it } from 'vitest';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../../src/config/env.js';
import { CampsiteError } from '../../../src/types/errors.types.js';

describe('loadConfig', () => {
  it('기본값: ~/.campsite-tui, lang=ko, color=true', () => {
    const config = loadConfig({});
    expect(config.homeDir).toBe(join(homedir(), '.campsite-tui'));
    expect(config.sessionsDir).toBe(join(homedir(), '.campsite-tui', 'sessions'));
    expect(config.lang).toBe('ko');
    expect(config.color).toBe(true);
  });

  it('CAMPSITE_TUI_HOME 오버라이드 시 sessionsDir도 따라간다', () => {
    const config = loadConfig({ CAMPSITE_TUI_HOME: '/tmp/cstui-test' });
    expect(config.homeDir).toBe('/tmp/cstui-test');
    expect(config.sessionsDir).toBe(join('/tmp/cstui-test', 'sessions'));
  });

  it('CSTUI_LANG=en 적용', () => {
    expect(loadConfig({ CSTUI_LANG: 'en' }).lang).toBe('en');
  });

  it('잘못된 CSTUI_LANG은 CONFIG_INVALID + 복구 경로를 던진다', () => {
    try {
      loadConfig({ CSTUI_LANG: 'fr' });
      expect.unreachable('CampsiteError가 발생해야 함');
    } catch (error) {
      expect(error).toBeInstanceOf(CampsiteError);
      const ce = error as CampsiteError;
      expect(ce.code).toBe('CONFIG_INVALID');
      expect(ce.recovery).toContain('CSTUI_LANG');
    }
  });

  it('NO_COLOR 설정 시 color=false (빈 문자열은 무시 — NO_COLOR 표준)', () => {
    expect(loadConfig({ NO_COLOR: '1' }).color).toBe(false);
    expect(loadConfig({ NO_COLOR: '' }).color).toBe(true);
  });
});
