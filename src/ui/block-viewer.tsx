/** 블록 뷰어 컴포넌트 (PRD §11 F4 레이아웃) — 출력은 스크롤 가능한 창으로 표시. */
import { Box, Text } from 'ink';
import type { ReactElement } from 'react';
import type { CommandBlock } from '../types/block.types.js';
import { normalizeOutput, stripAnsi } from '../utils/ansi.js';
import { formatDuration } from '../utils/time.js';

export interface BlockViewerProps {
  readonly block: CommandBlock;
  readonly offset: number;
  readonly height: number;
}

/** 뷰어 표시용 정제 라인 — 스크롤 한계 계산에도 사용된다 */
export function viewerLines(block: CommandBlock): readonly string[] {
  return normalizeOutput(stripAnsi(block.output)).split('\n');
}

const show = (value: string | null): string => value ?? 'unknown';

export function BlockViewer({ block, offset, height }: BlockViewerProps): ReactElement {
  const lines = viewerLines(block);
  const visible = lines.slice(offset, offset + height);
  const notes = [
    block.interactive ? '🖥 인터랙티브(캡처 제한)' : null,
    block.truncated ? '✂️ 일부 생략 저장' : null,
  ].filter((note): note is string => note !== null);

  return (
    <Box flexDirection="column">
      <Text bold wrap="truncate-end">
        Command: {block.command}
      </Text>
      <Text dimColor wrap="truncate-end">
        Agent {show(block.agent)} · Mode {show(block.mode)} · Repo {show(block.repo)} · Branch{' '}
        {show(block.branch)} · Exit {block.exit_code} · {formatDuration(block.duration_ms)}
      </Text>
      <Text dimColor wrap="truncate-end">
        Task {show(block.task)}
        {notes.length > 0 ? ` · ${notes.join(' · ')}` : ''}
      </Text>
      <Text> </Text>
      {visible.map((line, index) => (
        <Text key={offset + index} wrap="truncate-end">
          {line.length > 0 ? line : ' '}
        </Text>
      ))}
      <Text dimColor>
        [{Math.min(offset + 1, lines.length)}–{Math.min(offset + height, lines.length)}/
        {lines.length}줄]
      </Text>
    </Box>
  );
}
