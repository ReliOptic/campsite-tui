/**
 * Markdown export — 붙여넣었을 때 절대 깨지지 않는 출력 (PRD §11 F5, TECH-SPEC T5).
 * 동적 펜스(출력 속 ``` 충돌 방지) + ANSI 정제 + 시크릿 마스킹 + 줄 수 제한.
 */
import type { CommandBlock } from '../types/block.types.js';
import { normalizeOutput, stripAnsi } from '../utils/ansi.js';
import { formatDuration } from '../utils/time.js';
import { redactSecrets } from './redact.js';

export interface ExportOptions {
  readonly redact: boolean;
  /** 지정 시 head/tail 보존으로 줄 수 제한 (Telegram 4096자 대응) */
  readonly maxLines?: number;
}

export interface ExportResult {
  readonly markdown: string;
  readonly redacted_count: number;
  readonly omitted_lines: number;
}

/** 본문에 포함된 최장 백틱 런보다 긴 펜스를 만든다 */
function fenceFor(text: string): string {
  const runs = text.match(/`{3,}/g);
  const longest = runs === null ? 0 : Math.max(...runs.map((run) => run.length));
  return '`'.repeat(Math.max(3, longest + 1));
}

function truncateLines(
  text: string,
  maxLines: number,
): { readonly text: string; readonly omitted: number } {
  const lines = text.split('\n');
  if (lines.length <= maxLines) return { text, omitted: 0 };
  const headCount = Math.ceil(maxLines / 2);
  const tailCount = Math.floor(maxLines / 2);
  const omitted = lines.length - headCount - tailCount;
  const merged = [
    ...lines.slice(0, headCount),
    `…(${omitted}줄 생략 — 전체는 cstui block last 로 확인)…`,
    ...lines.slice(lines.length - tailCount),
  ];
  return { text: merged.join('\n'), omitted };
}

const show = (value: string | null): string => value ?? 'unknown';

export function blockToMarkdown(block: CommandBlock, options: ExportOptions): ExportResult {
  const cleaned = normalizeOutput(stripAnsi(block.output)).replace(/\s+$/, '');
  const redacted = options.redact
    ? redactSecrets(cleaned)
    : { text: cleaned, count: 0, kinds: [] as readonly string[] };
  // 명령 문자열 자체에 시크릿이 포함될 수 있다 (예: curl -H "Bearer eyJ...")
  const command = options.redact ? redactSecrets(block.command) : { text: block.command, count: 0, kinds: [] as readonly string[] };
  const totalCount = redacted.count + command.count;
  const allKinds = [...new Set([...redacted.kinds, ...command.kinds])];
  const limited =
    options.maxLines !== undefined
      ? truncateLines(redacted.text, options.maxLines)
      : { text: redacted.text, omitted: 0 };

  const failed = block.exit_code !== 0;
  const commandFence = fenceFor(command.text);
  const outputFence = fenceFor(limited.text);

  const lines: string[] = [
    failed ? '## Terminal Block — Failed Command' : '## Terminal Block',
    '',
    'Context:',
    `- Agent: ${show(block.agent)}`,
    `- Mode: ${show(block.mode)}`,
    `- Repo: ${show(block.repo)}`,
    `- CWD: ${block.cwd}`,
    `- Branch: ${show(block.branch)}`,
    `- Task: ${show(block.task)}`,
    `- Exit: ${block.exit_code}`,
    `- Duration: ${formatDuration(block.duration_ms)}`,
    '',
    'Command:',
    `${commandFence}bash`,
    command.text,
    commandFence,
    '',
    failed ? 'Error / Output:' : 'Output:',
    `${outputFence}text`,
    limited.text,
    outputFence,
  ];
  if (totalCount > 0) {
    lines.push('', `> 🔒 시크릿 ${totalCount}건 마스킹됨 (${allKinds.join(', ')})`);
  }
  if (block.truncated) {
    lines.push('', '> ✂️ 출력이 저장 한도(2MB)를 초과하여 일부만 저장된 블록입니다.');
  }
  return {
    markdown: lines.join('\n'),
    redacted_count: totalCount,
    omitted_lines: limited.omitted,
  };
}

/** output/command 단독 복사용 정제 텍스트 */
export function blockOutputText(block: CommandBlock, redact: boolean): string {
  const cleaned = normalizeOutput(stripAnsi(block.output)).replace(/\s+$/, '');
  return redact ? redactSecrets(cleaned).text : cleaned;
}
