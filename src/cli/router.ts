/**
 * CLI 라우터 — argv를 받아 결과를 반환한다.
 * 엔트리(index.ts)는 이 결과를 출력하고 종료 코드만 설정한다.
 */
import type { AppConfig } from '../config/env.js';
import type { Logger } from '../utils/logger.js';
import { parseArgs } from '../utils/parse-args.js';
import { blockCommand } from './block-command.js';
import { captureCommand } from './capture-command.js';
import { contextCommand } from './context-command.js';
import { doctorCommand } from './doctor-command.js';
import { openCommand } from './open-command.js';
import { runCommand } from './run-command.js';
import type { CliResult } from './result.js';

export type { CliResult } from './result.js';

export interface CliDeps {
  readonly version: string;
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly cwd: string;
  readonly stdin?: NodeJS.ReadableStream;
}

const USAGE = `Campsite TUI — 터미널 작업을 증거 블록으로 (블록, 맥락, 액션)

사용법:
  cstui open                             TUI 블록 브라우저 열기
  cstui run "명령"                       명령을 실행하고 블록으로 저장
  cstui capture --command "명령"         stdin을 블록으로 저장 (--exit-code 필수)
  cstui block list [--n 10] [--json]     최근 블록 목록
  cstui block last [--json]              마지막 블록 상세
  cstui block copy-last                  마지막 블록을 클립보드로 복사
        [--format markdown|output|command] [--max-lines 40] [--no-redact]
  cstui context                          현재 컨텍스트 표시 (--json 지원)
  cstui context set [--task "..."]       컨텍스트 설정
                    [--agent Codex] [--mode review] [--motif campsite]
  cstui doctor [--json]                  환경 진단 (캡처·저장·복사 경로)
  cstui --version | -v                   버전 출력
  cstui --help | -h                      이 도움말 출력

전역 플래그:
  --verbose                              내부 info/debug 로그 표시`;

export async function runCli(argv: readonly string[], deps: CliDeps): Promise<CliResult> {
  const first = argv[0];
  if (first === undefined || first === '--help' || first === '-h') {
    return { exitCode: 0, output: USAGE };
  }
  if (first === '--version' || first === '-v') {
    return { exitCode: 0, output: deps.version };
  }

  const args = parseArgs(argv);
  switch (args.positionals[0]) {
    case 'context':
      return contextCommand(args, deps.config, deps.logger, deps.cwd);
    case 'run':
      return runCommand(args, deps);
    case 'capture':
      return captureCommand(args, deps);
    case 'block':
      return blockCommand(args, deps);
    case 'open':
      return openCommand(deps);
    case 'doctor':
      return doctorCommand(args, deps);
    default:
      return { exitCode: 1, output: `알 수 없는 인수: ${first}\n\n${USAGE}` };
  }
}
