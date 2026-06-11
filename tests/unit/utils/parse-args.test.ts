import { describe, expect, it } from 'vitest';
import { boolFlag, parseArgs, stringFlag } from '../../../src/utils/parse-args.js';

describe('parseArgs', () => {
  it('위치 인수와 --key value 플래그를 분리한다', () => {
    const args = parseArgs(['run', 'npm test', '--agent', 'Codex']);
    expect(args.positionals).toEqual(['run', 'npm test']);
    expect(stringFlag(args, 'agent')).toBe('Codex');
  });

  it('--key=value 형식을 지원한다', () => {
    const args = parseArgs(['context', 'set', '--task=가이드 5단계']);
    expect(stringFlag(args, 'task')).toBe('가이드 5단계');
  });

  it('값이 없는 플래그는 불리언 true', () => {
    const args = parseArgs(['context', '--json']);
    expect(boolFlag(args, 'json')).toBe(true);
    expect(stringFlag(args, 'json')).toBeUndefined();
  });

  it('연속된 플래그에서 다음 플래그를 값으로 삼키지 않는다', () => {
    const args = parseArgs(['--json', '--agent', 'Codex']);
    expect(boolFlag(args, 'json')).toBe(true);
    expect(stringFlag(args, 'agent')).toBe('Codex');
  });
});
