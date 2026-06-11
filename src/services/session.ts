/**
 * 세션 저장소 — 생성/조회/컨텍스트 갱신 (PRD §10.1, 저장 구조는 §11 F7).
 * <home>/current-session (현재 세션 포인터), <home>/sessions/<id>/context.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { AppConfig } from '../config/env.js';
import type { Motif, Session } from '../types/session.types.js';
import { toCampsiteError } from '../types/errors.types.js';
import { createId } from '../utils/id.js';
import type { Logger } from '../utils/logger.js';
import { nowIso } from '../utils/time.js';
import { detectContext } from './context.js';

const sessionSchema = z.object({
  session_id: z.string().min(1),
  started_at: z.string().min(1),
  motif: z.enum(['campsite', 'workshop', 'courtroom', 'mission_control', 'lab']),
  cwd: z.string(),
  repo: z.string().nullable(),
  branch: z.string().nullable(),
  task: z.string().nullable(),
  agent: z.string().nullable(),
  mode: z.string().nullable(),
});

export interface ContextUpdate {
  readonly task?: string;
  readonly agent?: string;
  readonly mode?: string;
  readonly motif?: Motif;
}

export interface SessionService {
  current(): Promise<Session | null>;
  loadOrCreate(cwd: string): Promise<Session>;
  updateContext(update: ContextUpdate, cwd: string): Promise<Session>;
  sessionDir(sessionId: string): string;
}

const IO_RECOVERY = '디스크 공간과 디렉토리 권한을 확인한 뒤 다시 시도하세요.';

export function createSessionService(config: AppConfig, logger: Logger): SessionService {
  const pointerPath = join(config.homeDir, 'current-session');
  const sessionDir = (sessionId: string): string => join(config.sessionsDir, sessionId);
  const contextPath = (sessionId: string): string => join(sessionDir(sessionId), 'context.json');

  async function writeSession(session: Session): Promise<void> {
    try {
      await mkdir(sessionDir(session.session_id), { recursive: true });
      await writeFile(contextPath(session.session_id), `${JSON.stringify(session, null, 2)}\n`, 'utf8');
      await writeFile(pointerPath, `${session.session_id}\n`, 'utf8');
    } catch (error) {
      throw toCampsiteError(error, 'STORE_IO_FAILED', IO_RECOVERY);
    }
  }

  async function current(): Promise<Session | null> {
    let sessionId: string;
    try {
      sessionId = (await readFile(pointerPath, 'utf8')).trim();
    } catch {
      return null;
    }
    try {
      const raw = await readFile(contextPath(sessionId), 'utf8');
      const parsed = sessionSchema.safeParse(JSON.parse(raw));
      if (!parsed.success) {
        logger.warn('세션 파일이 손상되어 무시함', { session_id: sessionId });
        return null;
      }
      return parsed.data;
    } catch {
      logger.warn('세션 파일을 읽지 못해 무시함', { session_id: sessionId });
      return null;
    }
  }

  async function loadOrCreate(cwd: string): Promise<Session> {
    const existing = await current();
    if (existing !== null) return existing;
    const detected = await detectContext(cwd);
    const session: Session = {
      session_id: createId('sess'),
      started_at: nowIso(),
      motif: 'campsite',
      cwd: detected.cwd,
      repo: detected.repo,
      branch: detected.branch,
      task: null,
      agent: null,
      mode: null,
    };
    await writeSession(session);
    logger.info('세션 생성됨', { session_id: session.session_id, repo: session.repo });
    return session;
  }

  async function updateContext(update: ContextUpdate, cwd: string): Promise<Session> {
    const base = await loadOrCreate(cwd);
    const session: Session = {
      ...base,
      ...(update.task !== undefined ? { task: update.task } : {}),
      ...(update.agent !== undefined ? { agent: update.agent } : {}),
      ...(update.mode !== undefined ? { mode: update.mode } : {}),
      ...(update.motif !== undefined ? { motif: update.motif } : {}),
    };
    await writeSession(session);
    logger.info('컨텍스트 갱신됨', { session_id: session.session_id });
    return session;
  }

  return { current, loadOrCreate, updateContext, sessionDir };
}
