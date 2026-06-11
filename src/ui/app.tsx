/**
 * TUI 메인 앱 — 컨텍스트 바 + 블록 목록/뷰어 + 복사 단축키 (PRD §11 F3/F4, §15).
 * 의존성(블록 로딩·복사)은 주입받아 테스트 가능하게 유지한다.
 */
import { Box, Text, useApp, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import type { CommandBlock } from '../types/block.types.js';
import type { Session } from '../types/session.types.js';
import { MOTIF_LABELS } from '../types/session.types.js';
import type { CopyFormat } from '../services/copy-block.js';
import { BlockList } from './block-list.js';
import { BlockViewer, viewerLines } from './block-viewer.js';
import { Help, Onboarding } from './help.js';

export interface AppDeps {
  readonly session: Session;
  loadBlocks(): Promise<{ readonly blocks: readonly CommandBlock[]; readonly corrupt: number }>;
  copyBlock(block: CommandBlock, format: CopyFormat): Promise<string>;
  /** 테스트용 출력 창 높이 오버라이드 */
  readonly viewerHeight?: number;
}

type Mode = { readonly kind: 'list' } | { readonly kind: 'viewer'; readonly offset: number };

export function App({ deps }: { readonly deps: AppDeps }): ReactElement {
  const { exit } = useApp();
  const [blocks, setBlocks] = useState<readonly CommandBlock[]>([]);
  const [corrupt, setCorrupt] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>({ kind: 'list' });
  const [toast, setToast] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const firstLoad = useRef(true);

  const height = deps.viewerHeight ?? Math.max(5, (process.stdout.rows ?? 24) - 12);

  const reload = useCallback(async (): Promise<void> => {
    const result = await deps.loadBlocks();
    setBlocks(result.blocks);
    setCorrupt(result.corrupt);
    const lastIndex = Math.max(result.blocks.length - 1, 0);
    if (firstLoad.current) {
      setSelected(lastIndex);
      firstLoad.current = false;
    } else {
      setSelected((prev) => Math.min(prev, lastIndex));
    }
    setLoaded(true);
  }, [deps]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const doCopy = useCallback(
    (format: CopyFormat): void => {
      const block = blocks[selected];
      if (block === undefined) return;
      setToast('복사 중…');
      void deps.copyBlock(block, format).then(
        (message) => setToast(message),
        (error: unknown) => setToast(`복사 실패: ${String(error)}`),
      );
    },
    [blocks, selected, deps],
  );

  useInput((input, key) => {
    if (showHelp) {
      setShowHelp(false);
      return;
    }
    if (input === '?') {
      setShowHelp(true);
      return;
    }
    if (mode.kind === 'viewer') {
      const block = blocks[selected];
      const total = block === undefined ? 0 : viewerLines(block).length;
      const maxOffset = Math.max(0, total - height);
      if (input === 'q' || key.escape) return setMode({ kind: 'list' });
      if (input === 'j' || key.downArrow)
        return setMode({ kind: 'viewer', offset: Math.min(mode.offset + 1, maxOffset) });
      if (input === 'k' || key.upArrow)
        return setMode({ kind: 'viewer', offset: Math.max(mode.offset - 1, 0) });
      if (input === ' ')
        return setMode({ kind: 'viewer', offset: Math.min(mode.offset + height, maxOffset) });
      if (input === 'g') return setMode({ kind: 'viewer', offset: 0 });
      if (input === 'G') return setMode({ kind: 'viewer', offset: maxOffset });
    } else {
      if (input === 'q' || key.escape) return exit();
      if (input === 'j' || key.downArrow)
        return setSelected((prev) => Math.min(prev + 1, Math.max(blocks.length - 1, 0)));
      if (input === 'k' || key.upArrow) return setSelected((prev) => Math.max(prev - 1, 0));
      if (key.return && blocks.length > 0) return setMode({ kind: 'viewer', offset: 0 });
      if (input === 'r') {
        setToast(null);
        void reload();
        return;
      }
    }
    // c = 기본 복사(공유용 Markdown), m = 동의어, o = 출력만, x = 명령만
    if (input === 'c' || input === 'm') doCopy('markdown');
    else if (input === 'o') doCopy('output');
    else if (input === 'x') doCopy('command');
  });

  const session = deps.session;
  const selectedBlock = blocks[selected];
  const failedCount = blocks.filter((block) => block.exit_code !== 0).length;

  // 설정된 컨텍스트만 보여준다 — unknown 나열은 내부 디버그 정보지 사용자 정보가 아니다
  const barParts: string[] = [MOTIF_LABELS[session.motif]];
  if (session.task !== null) barParts.push(`Task ${session.task}`);
  if (session.agent !== null) {
    barParts.push(`Agent ${session.agent}${session.mode !== null ? ` (${session.mode})` : ''}`);
  }
  barParts.push(
    session.repo !== null
      ? `${session.repo}${session.branch !== null ? ` · ${session.branch}` : ''}`
      : '저장소 미연결',
  );

  return (
    <Box flexDirection="column">
      <Text wrap="truncate-end">{barParts.join(' · ')}</Text>
      <Text dimColor>{'─'.repeat(Math.min(process.stdout.columns ?? 80, 80))}</Text>
      {!showHelp && loaded && blocks.length > 0 && mode.kind === 'list' ? (
        <Text>
          최근 블록 {blocks.length}개
          {failedCount > 0 ? <Text color="yellow"> · ⚠️ 실패 {failedCount}개</Text> : null}
        </Text>
      ) : null}
      {showHelp ? (
        <Help />
      ) : !loaded ? (
        <Text>불러오는 중…</Text>
      ) : blocks.length === 0 ? (
        <Onboarding />
      ) : mode.kind === 'list' ? (
        <BlockList blocks={blocks} selected={selected} />
      ) : selectedBlock !== undefined ? (
        <BlockViewer block={selectedBlock} offset={mode.offset} height={height} />
      ) : (
        <Text>선택된 블록이 없습니다.</Text>
      )}
      {corrupt > 0 ? <Text color="yellow">⚠️ 손상된 라인 {corrupt}개 건너뜀</Text> : null}
      {toast !== null ? <Text color="cyan">{toast}</Text> : null}
      <Text dimColor>
        {showHelp
          ? '아무 키나 누르면 도움말이 닫힙니다'
          : mode.kind === 'list'
            ? '↑↓ 이동 · Enter 보기 · c 복사 · r 새로고침 · ? 도움말 · Esc 종료'
            : '↑↓ 스크롤 · space 페이지 · c 복사 · ? 도움말 · Esc 뒤로'}
      </Text>
    </Box>
  );
}
