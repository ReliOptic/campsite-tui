/** 블록 복사 글루 — CLI(copy-last)와 TUI(m/o/c 단축키)가 공유한다. */
import { join } from 'node:path';
import { detectTerminalEnv } from '../config/terminal-env.js';
import type { CommandBlock } from '../types/block.types.js';
import type { Logger } from '../utils/logger.js';
import { copyText, defaultClipboardPorts, type ClipboardOutcome } from './clipboard.js';
import { blockOutputText, blockToMarkdown } from './export.js';

export type CopyFormat = 'markdown' | 'output' | 'command';
export const COPY_FORMATS: readonly CopyFormat[] = ['markdown', 'output', 'command'];

export interface CopyBlockOptions {
  readonly format: CopyFormat;
  readonly redact: boolean;
  readonly maxLines?: number;
}

export interface CopyBlockResult {
  readonly outcome: ClipboardOutcome;
  readonly redactedCount: number;
  /** 사용자 표시용 합성 메시지 (마스킹 안내 포함) */
  readonly message: string;
}

export async function copyBlock(
  block: CommandBlock,
  sessionDir: string,
  options: CopyBlockOptions,
  logger: Logger,
): Promise<CopyBlockResult> {
  let text: string;
  let redactedCount = 0;
  if (options.format === 'markdown') {
    const result = blockToMarkdown(block, {
      redact: options.redact,
      ...(options.maxLines !== undefined ? { maxLines: options.maxLines } : {}),
    });
    text = result.markdown;
    redactedCount = result.redacted_count;
  } else if (options.format === 'output') {
    text = blockOutputText(block, options.redact);
  } else {
    text = block.command;
  }

  const outcome = await copyText(
    text,
    detectTerminalEnv(),
    defaultClipboardPorts(join(sessionDir, 'exports')),
  );
  logger.info('블록 복사됨', {
    block_id: block.block_id,
    format: options.format,
    method: outcome.method,
    redacted: redactedCount,
  });
  const note = redactedCount > 0 ? ` · 🔒 ${redactedCount}건 마스킹됨` : '';
  return { outcome, redactedCount, message: `${outcome.message}${note}` };
}
