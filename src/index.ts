#!/usr/bin/env node
/** 엔트리 포인트 — 설정 로딩, CLI 라우팅 결과 출력, 종료 코드 설정만 한다. */
import { createRequire } from 'node:module';
import { loadConfig } from './config/env.js';
import { CampsiteError } from './types/errors.types.js';
import { createLogger } from './utils/logger.js';
import { runCli } from './cli/router.js';

const require = createRequire(import.meta.url);
const { version } = require('../package.json') as { version: string };

async function main(): Promise<void> {
  const config = loadConfig();
  const argv = process.argv.slice(2);
  const verbose = argv.includes('--verbose');
  const logger = createLogger(undefined, verbose ? 'debug' : 'warn');
  const result = await runCli(
    argv.filter((arg) => arg !== '--verbose'),
    {
      version,
      config,
      logger,
      cwd: process.cwd(),
    },
  );
  process.stdout.write(`${result.output}\n`);
  process.exitCode = result.exitCode;
}

main().catch((error: unknown) => {
  if (error instanceof CampsiteError) {
    process.stderr.write(`오류: ${error.message}\n해결: ${error.recovery}\n`);
  } else {
    process.stderr.write(`예기치 못한 오류: ${String(error)}\n`);
  }
  process.exitCode = 1;
});
