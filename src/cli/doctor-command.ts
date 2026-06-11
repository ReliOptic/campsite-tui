/** `cstui doctor` — 설치 직후 캡처·저장·복사 경로 진단. */
import { detectTerminalEnv } from '../config/terminal-env.js';
import { boolFlag, type ParsedArgs } from '../utils/parse-args.js';
import { defaultDoctorPorts, runDoctor, type DoctorStatus } from '../services/doctor.js';
import type { CliDeps } from './router.js';
import type { CliResult } from './result.js';

const ICONS: Readonly<Record<DoctorStatus, string>> = { ok: '✅', warn: '⚠️', fail: '❌' };

export async function doctorCommand(args: ParsedArgs, deps: CliDeps): Promise<CliResult> {
  const report = await runDoctor(deps.config, detectTerminalEnv(), defaultDoctorPorts());
  const exitCode = report.ok ? 0 : 1;

  if (boolFlag(args, 'json')) {
    return { exitCode, output: JSON.stringify(report, null, 2) };
  }

  const rows = report.checks.map(
    (check) => `${ICONS[check.status]} ${check.label.padEnd(8)} ${check.detail}`,
  );
  const failed = report.checks.filter((check) => check.status === 'fail');
  const footer = report.ok
    ? '모든 필수 검사 통과. cstui run "명령" 으로 시작하세요.'
    : `❌ ${failed.length}개 항목을 해결한 뒤 cstui doctor 를 다시 실행하세요.`;
  return {
    exitCode,
    output: ['Campsite TUI 진단', '', ...rows, '', footer].join('\n'),
  };
}
