import { describe, expect, it } from 'vitest';
import { createId } from '../../../src/utils/id.js';
import { formatDuration, nowIso } from '../../../src/utils/time.js';

describe('createId', () => {
  it('접두사_시간36진수+랜덤 형식이며 호출마다 다르다', () => {
    const a = createId('sess');
    const b = createId('sess');
    expect(a).toMatch(/^sess_[0-9a-z]+[0-9a-f]{8}$/);
    expect(a).not.toBe(b);
  });

  it('시간순 정렬이 가능하다', () => {
    const earlier = createId('blk', new Date('2026-06-11T10:00:00Z'));
    const later = createId('blk', new Date('2026-06-11T10:00:01Z'));
    expect(earlier < later).toBe(true);
  });
});

describe('formatDuration', () => {
  it('1분 미만은 소수점 1자리 초', () => {
    expect(formatDuration(4000)).toBe('4.0s');
    expect(formatDuration(250)).toBe('0.3s');
  });
  it('1분 이상은 m s 형식, 음수는 0.0s', () => {
    expect(formatDuration(95_000)).toBe('1m 35s');
    expect(formatDuration(-5)).toBe('0.0s');
  });
});

describe('nowIso', () => {
  it('ISO 8601 문자열을 반환한다', () => {
    expect(Number.isNaN(Date.parse(nowIso()))).toBe(false);
  });
});
