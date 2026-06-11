/** 도움말 오버레이 + 첫 사용 온보딩 — "다음에 뭘 해야 하는지"를 항상 알려준다. */
import { Box, Text } from 'ink';
import type { ReactElement } from 'react';

export function Help(): ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold>도움말 — Campsite TUI</Text>
      <Text> </Text>
      <Text>무엇을 하는 도구인가요?</Text>
      <Text dimColor>  명령 실행 결과를 repo/branch/task/agent 컨텍스트가 붙은</Text>
      <Text dimColor>  "블록"으로 저장하고, 드래그 없이 복사하는 도구입니다.</Text>
      <Text> </Text>
      <Text>사용 흐름:</Text>
      <Text dimColor>  1. 터미널에서 cstui run "명령" 으로 실행하면 블록이 저장됩니다</Text>
      <Text dimColor>  2. 이 화면(cstui open)에서 블록을 탐색합니다</Text>
      <Text dimColor>  3. m/o/c 로 복사해 Telegram·GitHub 등에 붙여넣습니다</Text>
      <Text> </Text>
      <Text>복사 키:</Text>
      <Text dimColor>  c  Markdown 블록 복사 (컨텍스트+명령+출력 — 공유용 추천, m도 동일)</Text>
      <Text dimColor>  o  출력(output)만</Text>
      <Text dimColor>  x  명령(command)만</Text>
      <Text> </Text>
      <Text>탐색 키:</Text>
      <Text dimColor>  ↑↓ 이동·스크롤 (j/k도 가능) · Enter 블록 열기 · space 페이지</Text>
      <Text dimColor>  g/G 처음/끝 · r 새로고침 · Esc(또는 q) 뒤로/종료</Text>
      <Text> </Text>
      <Text color="cyan">아무 키나 누르면 닫힙니다.</Text>
    </Box>
  );
}

export function Onboarding(): ReactElement {
  return (
    <Box flexDirection="column">
      <Text>Campsite TUI — 터미널 실행 결과를 컨텍스트가 붙은 블록으로 저장합니다.</Text>
      <Text> </Text>
      <Text>저장된 블록이 없습니다. 터미널에서 이렇게 시작해보세요:</Text>
      <Text> </Text>
      <Text color="green">  cstui run "git status"</Text>
      <Text dimColor>      git 상태를 블록으로</Text>
      <Text color="green">  cstui run "npm test"</Text>
      <Text dimColor>      테스트 결과를 블록으로</Text>
      <Text color="green">  cstui run "ls -la"</Text>
      <Text dimColor>      폴더 내용을 블록으로</Text>
      <Text> </Text>
      <Text dimColor>블록이 생기면 이 목록에 나타나고, m 키 한 번으로 컨텍스트가 붙은</Text>
      <Text dimColor>Markdown을 복사해 Telegram/GitHub에 붙여넣을 수 있습니다.</Text>
    </Box>
  );
}
