import { describe, expect, it } from 'vitest';
import { redactSecrets } from '../../../src/services/redact.js';

// 가짜 토큰을 조각으로 합성한다 — 파일 리터럴이 실제 시크릿 패턴과 일치하면
// GitHub push protection이 푸시를 차단한다 (실제로 차단당해 도입한 방식)
const fake = (...parts: readonly string[]): string => parts.join('');
const FAKE_GOOGLE = fake('AIza', 'SyA1234567890abcdefghijklmnopqrstu');
const FAKE_GITHUB = fake('ghp', '_abcdefghijklmnopqrstuvwxyz123456');
const FAKE_SLACK = fake('xoxb', '-1234567890-abcdefghijklmnop');
const FAKE_TELEGRAM = fake('1234567890', ':AA', 'abcdefghijklmnopqrstuvwxyz1234567');

describe('redactSecrets', () => {
  it('JWT를 마스킹한다 (가이드 8단계 portal URL 시나리오)', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpM';
    const result = redactSecrets(`portal: https://x.dev/?token=${jwt}`);
    expect(result.text).not.toContain(jwt);
    expect(result.count).toBeGreaterThan(0);
    expect(result.kinds).toContain('jwt');
  });

  it('Google API key / GitHub / Slack / Telegram 토큰을 마스킹한다', () => {
    const input = [
      `google: ${FAKE_GOOGLE}`,
      `github: ${FAKE_GITHUB}`,
      `slack: ${FAKE_SLACK}`,
      `telegram: ${FAKE_TELEGRAM}`,
    ].join('\n');
    const result = redactSecrets(input);
    expect(result.text).not.toContain(FAKE_GOOGLE);
    expect(result.text).not.toContain(FAKE_GITHUB);
    expect(result.text).not.toContain(FAKE_SLACK);
    expect(result.text).not.toContain(FAKE_TELEGRAM);
    expect(result.kinds).toEqual(
      expect.arrayContaining(['google_api_key', 'github_token', 'slack_token', 'telegram_bot_token']),
    );
  });

  it('PEM 개인키 블록을 마스킹한다', () => {
    const pem = '-----BEGIN PRIVATE KEY-----\nMIIEvQabc\ndef123\n-----END PRIVATE KEY-----';
    const result = redactSecrets(`before\n${pem}\nafter`);
    expect(result.text).not.toContain('MIIEvQabc');
    expect(result.text).toContain('[REDACTED:private_key]');
  });

  it('URL 쿼리의 시크릿 파라미터 값을 마스킹하되 키는 보존한다', () => {
    const result = redactSecrets('https://api.example.com/v1?api_key=supersecret123&page=2');
    expect(result.text).toContain('api_key=[REDACTED:url_secret]');
    expect(result.text).toContain('page=2');
  });

  it('시크릿이 없으면 원문 그대로, count 0', () => {
    const input = 'npm test 실패: expected 3 to be 4';
    expect(redactSecrets(input)).toEqual({ text: input, count: 0, kinds: [] });
  });
});
