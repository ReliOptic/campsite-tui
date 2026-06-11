import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../../src/config/env.js';
import { createSessionService } from '../../../src/services/session.js';
import { createLogger } from '../../../src/utils/logger.js';

const silent = createLogger({ write: () => undefined });

async function makeService(): Promise<ReturnType<typeof createSessionService>> {
  const home = await mkdtemp(join(tmpdir(), 'cstui-home-'));
  return createSessionService(loadConfig({ CAMPSITE_TUI_HOME: home }), silent);
}

describe('createSessionService', () => {
  it('세션이 없으면 current()는 null', async () => {
    const service = await makeService();
    expect(await service.current()).toBeNull();
  });

  it('loadOrCreate는 세션을 생성·영속하고 재호출 시 같은 세션을 반환한다', async () => {
    const service = await makeService();
    const created = await service.loadOrCreate(tmpdir());
    expect(created.session_id).toMatch(/^sess_/);
    expect(created.motif).toBe('campsite');
    const again = await service.loadOrCreate(tmpdir());
    expect(again.session_id).toBe(created.session_id);
    const current = await service.current();
    expect(current?.session_id).toBe(created.session_id);
  });

  it('updateContext는 지정 필드만 갱신하고 디스크에 저장한다', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cstui-home-'));
    const config = loadConfig({ CAMPSITE_TUI_HOME: home });
    const service = createSessionService(config, silent);
    await service.updateContext({ task: '가이드 8단계', agent: 'Hermes' }, tmpdir());
    const updated = await service.updateContext({ mode: 'debug' }, tmpdir());
    expect(updated.task).toBe('가이드 8단계');
    expect(updated.agent).toBe('Hermes');
    expect(updated.mode).toBe('debug');

    const raw = await readFile(
      join(config.sessionsDir, updated.session_id, 'context.json'),
      'utf8',
    );
    expect((JSON.parse(raw) as { task: string }).task).toBe('가이드 8단계');
  });

  it('손상된 context.json은 무시하고 null을 반환한다 (graceful)', async () => {
    const home = await mkdtemp(join(tmpdir(), 'cstui-home-'));
    const config = loadConfig({ CAMPSITE_TUI_HOME: home });
    const service = createSessionService(config, silent);
    const session = await service.loadOrCreate(tmpdir());
    await writeFile(join(config.sessionsDir, session.session_id, 'context.json'), '{broken');
    expect(await service.current()).toBeNull();
  });
});
