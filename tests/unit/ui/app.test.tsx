import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import type { CommandBlock } from '../../../src/types/block.types.js';
import type { Session } from '../../../src/types/session.types.js';
import { App, type AppDeps } from '../../../src/ui/app.js';

const session: Session = {
  session_id: 'sess_ui',
  started_at: '2026-06-11T10:00:00.000Z',
  motif: 'campsite',
  cwd: '/tmp',
  repo: 'ReliOptic/campsite',
  branch: 'main',
  task: '가이드 8단계',
  agent: 'Hermes',
  mode: 'debug',
};

function makeBlock(id: string, command: string, exitCode = 0): CommandBlock {
  return {
    block_id: id,
    session_id: 'sess_ui',
    command,
    output: `${command} 출력 1\n출력 2\n출력 3\n`,
    exit_code: exitCode,
    signal: null,
    started_at: '2026-06-11T10:00:00.000Z',
    ended_at: '2026-06-11T10:00:01.000Z',
    duration_ms: 1000,
    capture_method: 'pty_runner',
    dirty: false,
    interactive: false,
    truncated: false,
    cwd: '/tmp',
    repo: 'ReliOptic/campsite',
    branch: 'main',
    task: '가이드 8단계',
    agent: 'Hermes',
    mode: 'debug',
  };
}

function makeDeps(blocks: readonly CommandBlock[]): {
  deps: AppDeps;
  copySpy: ReturnType<typeof vi.fn>;
} {
  const copySpy = vi.fn().mockResolvedValue('클립보드에 복사했습니다.');
  return {
    copySpy,
    deps: {
      session,
      loadBlocks: () => Promise.resolve({ blocks, corrupt: 0 }),
      copyBlock: copySpy as AppDeps['copyBlock'],
      viewerHeight: 10,
    },
  };
}

describe('App (TUI)', () => {
  it('컨텍스트 바와 블록 목록을 렌더링하고 최신 블록이 선택된다', async () => {
    const { deps } = makeDeps([makeBlock('blk_1', 'echo one'), makeBlock('blk_2', 'echo two', 1)]);
    const { lastFrame } = render(<App deps={deps} />);
    await vi.waitFor(() => expect(lastFrame()).toContain('echo two'));
    expect(lastFrame()).toContain('🏕️ Campsite');
    expect(lastFrame()).toContain('Hermes');
    expect(lastFrame()).toContain('❌');
    // 최신(2번째) 블록 행에 선택 마커
    const selectedLine = lastFrame()
      ?.split('\n')
      .find((line) => line.includes('▸'));
    expect(selectedLine).toContain('echo two');
  });

  it('k로 위로 이동 후 enter로 뷰어 진입, q로 목록 복귀', async () => {
    const { deps } = makeDeps([makeBlock('blk_1', 'echo one'), makeBlock('blk_2', 'echo two')]);
    const { stdin, lastFrame } = render(<App deps={deps} />);
    await vi.waitFor(() => expect(lastFrame()).toContain('echo two'));

    stdin.write('k');
    stdin.write('\r');
    await vi.waitFor(() => expect(lastFrame()).toContain('Command: echo one'));
    expect(lastFrame()).toContain('echo one 출력 1');

    stdin.write('q');
    await vi.waitFor(() => expect(lastFrame()).toContain('↑↓ 이동'));
  });

  it('c 키(기본 복사)는 마크다운 복사를 호출하고 토스트를 보여준다', async () => {
    const { deps, copySpy } = makeDeps([makeBlock('blk_1', 'echo one')]);
    const { stdin, lastFrame } = render(<App deps={deps} />);
    await vi.waitFor(() => expect(lastFrame()).toContain('echo one'));

    stdin.write('c');
    await vi.waitFor(() => expect(lastFrame()).toContain('클립보드에 복사했습니다.'));
    expect(copySpy).toHaveBeenCalledWith(
      expect.objectContaining({ block_id: 'blk_1' }),
      'markdown',
    );
  });

  it('x 키는 명령만 복사한다', async () => {
    const { deps, copySpy } = makeDeps([makeBlock('blk_1', 'echo one')]);
    const { stdin, lastFrame } = render(<App deps={deps} />);
    await vi.waitFor(() => expect(lastFrame()).toContain('echo one'));

    stdin.write('x');
    await vi.waitFor(() => expect(copySpy).toHaveBeenCalledWith(expect.anything(), 'command'));
  });

  it('블록이 없으면 온보딩(추천 시작 명령)을 보여준다', async () => {
    const { deps } = makeDeps([]);
    const { lastFrame } = render(<App deps={deps} />);
    await vi.waitFor(() => expect(lastFrame()).toContain('저장된 블록이 없습니다'));
    expect(lastFrame()).toContain('cstui run "git status"');
    expect(lastFrame()).toContain('Markdown');
  });

  it('? 키로 도움말을 열고 아무 키로 닫는다', async () => {
    const { deps } = makeDeps([makeBlock('blk_1', 'echo one')]);
    const { stdin, lastFrame } = render(<App deps={deps} />);
    await vi.waitFor(() => expect(lastFrame()).toContain('echo one'));

    stdin.write('?');
    await vi.waitFor(() => expect(lastFrame()).toContain('도움말 — Campsite TUI'));
    expect(lastFrame()).toContain('공유용 추천');

    stdin.write('z');
    await vi.waitFor(() => expect(lastFrame()).toContain('↑↓ 이동'));
  });

  it('컨텍스트 바: 설정된 값만 보이고 unknown은 노출되지 않는다', async () => {
    const { deps } = makeDeps([makeBlock('blk_1', 'echo one')]);
    const { lastFrame } = render(
      <App deps={{ ...deps, session: { ...session, repo: null, branch: null, mode: null } }} />,
    );
    await vi.waitFor(() => expect(lastFrame()).toContain('echo one'));
    expect(lastFrame()).toContain('Agent Hermes');
    expect(lastFrame()).toContain('저장소 미연결');
    expect(lastFrame()).not.toContain('unknown');
  });

  it('실패 블록이 있으면 목록 위에 실패 카운트를 보여준다 (inbox 헤더)', async () => {
    const { deps } = makeDeps([
      makeBlock('blk_1', 'echo one'),
      makeBlock('blk_2', 'npm test', 1),
    ]);
    const { lastFrame } = render(<App deps={deps} />);
    await vi.waitFor(() => expect(lastFrame()).toContain('최근 블록 2개'));
    expect(lastFrame()).toContain('실패 1개');
  });
});
