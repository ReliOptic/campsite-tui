/** 블록 목록 컴포넌트 (PRD §11 F3 레이아웃). */
import { Box, Text } from 'ink';
import type { ReactElement } from 'react';
import type { CommandBlock } from '../types/block.types.js';
import { formatClock, formatDuration } from '../utils/time.js';

export interface BlockListProps {
  readonly blocks: readonly CommandBlock[];
  readonly selected: number;
}

function trimCommand(command: string, max: number): string {
  return command.length > max ? `${command.slice(0, max - 1)}…` : command;
}

export function BlockList({ blocks, selected }: BlockListProps): ReactElement {
  return (
    <Box flexDirection="column">
      {blocks.map((block, index) => {
        const active = index === selected;
        const status = block.exit_code === 0 ? '✅' : '❌';
        const row = [
          active ? '▸ ' : '  ',
          String(index + 1).padStart(2, '0'),
          ` ${status} `,
          trimCommand(block.command, 42).padEnd(43),
          formatDuration(block.duration_ms).padStart(7),
          `  ${formatClock(block.started_at)}`,
        ].join('');
        return (
          <Text key={block.block_id} inverse={active} wrap="truncate-end">
            {row}
          </Text>
        );
      })}
    </Box>
  );
}
