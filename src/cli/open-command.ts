/** `cstui open` — TUI 블록 브라우저를 연다 (PRD §14). */
import { render } from 'ink';
import { createElement } from 'react';
import { readBlocks } from '../services/block-store.js';
import { copyBlock, type CopyFormat } from '../services/copy-block.js';
import { createSessionService } from '../services/session.js';
import { App, type AppDeps } from '../ui/app.js';
import type { CliDeps } from './router.js';
import type { CliResult } from './result.js';

export async function openCommand(deps: CliDeps): Promise<CliResult> {
  if (!process.stdout.isTTY || !process.stdin.isTTY) {
    return {
      exitCode: 1,
      output:
        'TUI는 터미널(TTY)에서만 열 수 있습니다. 파이프/에이전트 환경에서는 cstui block list --json 을 사용하세요.',
    };
  }
  const sessions = createSessionService(deps.config, deps.logger);
  const session = await sessions.loadOrCreate(deps.cwd);
  const sessionDir = sessions.sessionDir(session.session_id);

  const appDeps: AppDeps = {
    session,
    loadBlocks: () => readBlocks(sessionDir, 50, deps.logger),
    copyBlock: async (block, format: CopyFormat) =>
      (await copyBlock(block, sessionDir, { format, redact: true }, deps.logger)).message,
  };
  const instance = render(createElement(App, { deps: appDeps }));
  await instance.waitUntilExit();
  return { exitCode: 0, output: '' };
}
