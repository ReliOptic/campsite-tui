import { describe, expect, it } from 'vitest';
import type { CommandBlock } from '../../../src/types/block.types.js';
import { blockOutputText, blockToMarkdown } from '../../../src/services/export.js';

// 가짜 토큰 조각 합성 — 리터럴이 시크릿 패턴과 일치하면 GitHub push protection에 차단됨
const fake = (...parts: readonly string[]): string => parts.join('');
const FAKE_GITHUB = fake('ghp', '_abcdefghijklmnopqrstuvwxyz123456');
const FAKE_SLACK = fake('xoxb', '-1234567890-abcdef');

function makeBlock(overrides: Partial<CommandBlock> = {}): CommandBlock {
  return {
    block_id: 'blk_1',
    session_id: 'sess_1',
    command: 'gh pr view 1 --comments',
    output: 'PR #1 내용\n',
    exit_code: 0,
    signal: null,
    started_at: '2026-06-11T10:00:00.000Z',
    ended_at: '2026-06-11T10:00:01.200Z',
    duration_ms: 1200,
    capture_method: 'pty_runner',
    dirty: false,
    interactive: false,
    truncated: false,
    cwd: '~/projects/campsite',
    repo: 'ReliOptic/campsite',
    branch: 'main',
    task: 'public repo cleanup',
    agent: 'Codex',
    mode: 'review',
    ...overrides,
  };
}

describe('blockToMarkdown', () => {
  it('성공 블록: PRD §11 F5 템플릿 구조를 따른다', () => {
    const { markdown } = blockToMarkdown(makeBlock(), { redact: true });
    expect(markdown).toContain('## Terminal Block');
    expect(markdown).not.toContain('Failed Command');
    expect(markdown).toContain('- Agent: Codex');
    expect(markdown).toContain('- Repo: ReliOptic/campsite');
    expect(markdown).toContain('- Exit: 0');
    expect(markdown).toContain('- Duration: 1.2s');
    expect(markdown).toContain('```bash\ngh pr view 1 --comments\n```');
    expect(markdown).toContain('Output:');
    expect(markdown).toContain('PR #1 내용');
  });

  it('실패 블록: Failed Command 제목과 Error/Output 헤딩', () => {
    const { markdown } = blockToMarkdown(makeBlock({ exit_code: 1 }), { redact: true });
    expect(markdown).toContain('## Terminal Block — Failed Command');
    expect(markdown).toContain('Error / Output:');
  });

  it('null 컨텍스트는 unknown으로 표기한다', () => {
    const { markdown } = blockToMarkdown(makeBlock({ agent: null, repo: null }), { redact: true });
    expect(markdown).toContain('- Agent: unknown');
    expect(markdown).toContain('- Repo: unknown');
  });

  it('출력에 ```가 있으면 더 긴 펜스로 감싼다 (펜스 충돌 방지)', () => {
    const { markdown } = blockToMarkdown(
      makeBlock({ output: '코드:\n```js\nconsole.log(1)\n```\n' }),
      { redact: true },
    );
    expect(markdown).toContain('````text');
    expect(markdown).toContain('\n````');
  });

  it('ANSI를 제거하고 시크릿을 마스킹한다', () => {
    const { markdown, redacted_count } = blockToMarkdown(
      makeBlock({ output: `\u001b[32mOK\u001b[0m token: ${FAKE_GITHUB}\r\n` }),
      { redact: true },
    );
    expect(markdown).toContain('OK');
    expect(markdown).not.toContain('[32m');
    expect(markdown).not.toContain(FAKE_GITHUB);
    expect(markdown).toContain('🔒 시크릿 1건 마스킹됨');
    expect(redacted_count).toBe(1);
  });

  it('명령 문자열에 든 시크릿도 마스킹한다 (E2E 스모크에서 발견된 결함 회귀 방지)', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIn0.abcdefghijklmnop';
    const { markdown, redacted_count } = blockToMarkdown(
      makeBlock({ command: `curl -H "Authorization: Bearer ${jwt}" https://api.x.dev` }),
      { redact: true },
    );
    expect(markdown).not.toContain(jwt);
    expect(markdown).toContain('[REDACTED:jwt]');
    expect(redacted_count).toBe(1);
  });

  it('maxLines 초과 시 head+tail 보존 + 생략 마커', () => {
    const output = Array.from({ length: 100 }, (_, i) => `line-${i + 1}`).join('\n');
    const { markdown, omitted_lines } = blockToMarkdown(makeBlock({ output }), {
      redact: true,
      maxLines: 10,
    });
    expect(omitted_lines).toBe(90);
    expect(markdown).toContain('line-1');
    expect(markdown).toContain('line-100');
    expect(markdown).toContain('90줄 생략');
  });
});

describe('blockOutputText', () => {
  it('정제된 출력만 반환하며 redact를 적용한다', () => {
    const text = blockOutputText(
      makeBlock({ output: `\u001b[31mERR\u001b[0m ${FAKE_SLACK}\r\n` }),
      true,
    );
    expect(text).toBe('ERR [REDACTED:slack_token]');
  });
});
