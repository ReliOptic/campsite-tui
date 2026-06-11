/**
 * `cstui context` — 현재 컨텍스트 표시 / `cstui context set` — 수동 설정 (PRD §11 F1).
 * 읽기(show)는 세션을 만들지 않고, set은 필요 시 세션을 생성한다.
 */
import type { AppConfig } from '../config/env.js';
import type { Motif } from '../types/session.types.js';
import { MOTIF_LABELS } from '../types/session.types.js';
import type { Logger } from '../utils/logger.js';
import { boolFlag, stringFlag, type ParsedArgs } from '../utils/parse-args.js';
import { detectContext } from '../services/context.js';
import { createSessionService, type ContextUpdate } from '../services/session.js';
import type { CliResult } from './result.js';

const MOTIFS: readonly Motif[] = ['campsite', 'workshop', 'courtroom', 'mission_control', 'lab'];

const show = (value: string | null): string => (value !== null && value.length > 0 ? value : 'unknown');
const showDirty = (dirty: boolean | null): string =>
  dirty === null ? 'unknown' : dirty ? 'dirty' : 'clean';

export async function contextCommand(
  args: ParsedArgs,
  config: AppConfig,
  logger: Logger,
  cwd: string,
): Promise<CliResult> {
  const sessions = createSessionService(config, logger);
  const sub = args.positionals[1];

  if (sub === 'set') {
    const motifFlag = stringFlag(args, 'motif');
    if (motifFlag !== undefined && !MOTIFS.includes(motifFlag as Motif)) {
      return {
        exitCode: 1,
        output: `알 수 없는 motif: ${motifFlag}\n허용값: ${MOTIFS.join(', ')}`,
      };
    }
    const task = stringFlag(args, 'task');
    const agent = stringFlag(args, 'agent');
    const mode = stringFlag(args, 'mode');
    const update: ContextUpdate = {
      ...(task !== undefined ? { task } : {}),
      ...(agent !== undefined ? { agent } : {}),
      ...(mode !== undefined ? { mode } : {}),
      ...(motifFlag !== undefined ? { motif: motifFlag as Motif } : {}),
    };
    const session = await sessions.updateContext(update, cwd);
    return { exitCode: 0, output: renderSession(session, await liveDirty(cwd)) };
  }

  if (sub !== undefined) {
    return { exitCode: 1, output: `알 수 없는 context 하위 명령: ${sub} (사용 가능: set)` };
  }

  const session = await sessions.current();
  const detected = await detectContext(cwd);
  if (session === null) {
    if (boolFlag(args, 'json')) {
      return { exitCode: 0, output: JSON.stringify({ session: null, detected }, null, 2) };
    }
    return {
      exitCode: 0,
      output: `${renderDetected(detected)}\n\n세션이 없습니다. cstui context set --task "..." 으로 시작하세요.`,
    };
  }
  if (boolFlag(args, 'json')) {
    return {
      exitCode: 0,
      output: JSON.stringify({ session, detected }, null, 2),
    };
  }
  return { exitCode: 0, output: renderSession(session, detected.dirty) };
}

async function liveDirty(cwd: string): Promise<boolean | null> {
  return (await detectContext(cwd)).dirty;
}

function renderDetected(detected: {
  readonly cwd: string;
  readonly repo: string | null;
  readonly branch: string | null;
  readonly dirty: boolean | null;
}): string {
  return [
    '자동감지된 컨텍스트:',
    `  CWD:     ${detected.cwd}`,
    `  Repo:    ${show(detected.repo)}`,
    `  Branch:  ${show(detected.branch)}`,
    `  Dirty:   ${showDirty(detected.dirty)}`,
  ].join('\n');
}

function renderSession(
  session: {
    readonly session_id: string;
    readonly motif: Motif;
    readonly cwd: string;
    readonly repo: string | null;
    readonly branch: string | null;
    readonly task: string | null;
    readonly agent: string | null;
    readonly mode: string | null;
  },
  dirty: boolean | null,
): string {
  return [
    `세션:    ${session.session_id} (${MOTIF_LABELS[session.motif]})`,
    `  CWD:     ${session.cwd}`,
    `  Repo:    ${show(session.repo)}`,
    `  Branch:  ${show(session.branch)}`,
    `  Dirty:   ${showDirty(dirty)}`,
    `  Task:    ${show(session.task)}`,
    `  Agent:   ${show(session.agent)}`,
    `  Mode:    ${show(session.mode)}`,
  ].join('\n');
}
