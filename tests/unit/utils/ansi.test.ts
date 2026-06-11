import { describe, expect, it } from 'vitest';
import { normalizeOutput, stripAnsi } from '../../../src/utils/ansi.js';

describe('stripAnsi', () => {
  it('색상 CSI 시퀀스를 제거하고 본문을 보존한다', () => {
    expect(stripAnsi('\u001b[31m빨강\u001b[0m plain')).toBe('빨강 plain');
  });
  it('OSC(타이틀/하이퍼링크) 시퀀스를 제거한다', () => {
    expect(stripAnsi('\u001b]0;title\u0007after')).toBe('after');
  });
  it('ANSI 없는 텍스트는 그대로 둔다', () => {
    expect(stripAnsi('가이드 5단계: 서버 생성')).toBe('가이드 5단계: 서버 생성');
  });
});

describe('normalizeOutput', () => {
  it('PTY의 \\r\\n을 \\n으로 정규화한다', () => {
    expect(normalizeOutput('a\r\nb\r\n')).toBe('a\nb\n');
  });
  it('\\r 덮어쓰기 진행 표시는 최종 상태만 남긴다', () => {
    expect(normalizeOutput('progress 10%\rprogress 50%\rprogress 100%\r\ndone\r\n')).toBe(
      'progress 100%\ndone\n',
    );
  });
});
