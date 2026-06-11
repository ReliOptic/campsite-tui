import { describe, expect, it } from 'vitest';
import { createLogger, type LogSink } from '../../../src/utils/logger.js';

function captureSink(): { sink: LogSink; lines: string[] } {
  const lines: string[] = [];
  return { sink: { write: (line) => lines.push(line) }, lines };
}

describe('createLogger', () => {
  it('레벨·메시지·필드를 포함한 유효한 JSON 한 줄을 기록한다', () => {
    const { sink, lines } = captureSink();
    createLogger(sink, 'debug').info('블록 저장됨', { block_id: 'blk_001', bytes: 42 });

    expect(lines).toHaveLength(1);
    const entry = JSON.parse(lines[0] as string) as Record<string, unknown>;
    expect(entry['level']).toBe('info');
    expect(entry['msg']).toBe('블록 저장됨');
    expect(entry['block_id']).toBe('blk_001');
    expect(entry['bytes']).toBe(42);
    expect(typeof entry['ts']).toBe('string');
    expect(Number.isNaN(Date.parse(entry['ts'] as string))).toBe(false);
  });

  it('verbose(debug) 레벨에서는 4개 레벨 모두 기록한다', () => {
    const { sink, lines } = captureSink();
    const logger = createLogger(sink, 'debug');
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    const levels = lines.map(
      (line) => (JSON.parse(line) as Record<string, unknown>)['level'],
    );
    expect(levels).toEqual(['debug', 'info', 'warn', 'error']);
  });

  it('기본(warn)에서는 info/debug를 버린다 — 비개발자 화면 보호', () => {
    const { sink, lines } = captureSink();
    const logger = createLogger(sink);
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    const levels = lines.map(
      (line) => (JSON.parse(line) as Record<string, unknown>)['level'],
    );
    expect(levels).toEqual(['warn', 'error']);
  });
});
