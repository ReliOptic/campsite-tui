import { describe, expect, it } from 'vitest';
import { tmpdir } from 'node:os';
import { captureCommand } from '../../../src/services/capture.js';

const opts = { cwd: tmpdir(), stdout: null, stdin: null } as const;

describe('captureCommand', () => {
  it('출력·exit code 0·duration을 캡처한다', async () => {
    const result = await captureCommand('echo hello-campsite', opts);
    expect(result.output).toContain('hello-campsite');
    expect(result.exit_code).toBe(0);
    expect(result.signal).toBeNull();
    expect(result.duration_ms).toBeGreaterThanOrEqual(0);
    expect(result.interactive).toBe(false);
    expect(result.truncated).toBe(false);
  });

  it('실패 명령의 exit code를 정확히 전달한다', async () => {
    const result = await captureCommand('echo before-fail; exit 3', opts);
    expect(result.exit_code).toBe(3);
    expect(result.output).toContain('before-fail');
  });

  it('stderr도 병합 캡처된다 (PTY 특성, PRD §11 F2 허용)', async () => {
    const result = await captureCommand('echo to-stderr 1>&2; exit 1', opts);
    expect(result.exit_code).toBe(1);
    expect(result.output).toContain('to-stderr');
  });

  it('ANSI 색상과 한글을 원본 그대로 보존한다', async () => {
    const result = await captureCommand(
      'printf "\\033[31m빨강\\033[0m 가이드 5단계\\n"',
      opts,
    );
    expect(result.output).toContain('[31m');
    expect(result.output).toContain('빨강');
    expect(result.output).toContain('가이드 5단계');
  });

  it('alternate screen 진입을 인터랙티브로 감지한다', async () => {
    const result = await captureCommand('printf "\\033[?1049h"; printf "\\033[?1049l"', opts);
    expect(result.interactive).toBe(true);
  });

  it('출력이 한도를 넘으면 head+tail 보존으로 잘라낸다', async () => {
    const result = await captureCommand('seq 1 2000', { ...opts, maxBytes: 1000 });
    expect(result.truncated).toBe(true);
    expect(result.output).toContain('생략됨');
    expect(result.output).toContain('1');     // head 보존
    expect(result.output).toContain('2000');  // tail 보존
    expect(Buffer.byteLength(result.output, 'utf8')).toBeLessThan(3000);
  });

  it('빠르게 종료되는 PTY의 마지막 출력 tail을 드레인한다', async () => {
    for (let i = 0; i < 10; i += 1) {
      const result = await captureCommand('seq 1 5000', opts);
      expect(result.exit_code).toBe(0);
      expect(result.truncated).toBe(false);
      expect(result.output).toContain('5000');
    }
  });
});
