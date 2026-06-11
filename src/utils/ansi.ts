/** ANSI 이스케이프 처리 (순수 함수). 저장은 원본, export는 정제본 (TECH-SPEC T5). */

// OSC: ESC ] ... (BEL 또는 ESC \ 로 종료) — 하이퍼링크/타이틀/OSC52 등
const OSC_PATTERN = /\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/g;
// CSI: ESC [ 파라미터 중간바이트 최종바이트 — 색상/커서/모드 등
const CSI_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]/g;
// 그 외 2바이트 ESC 시퀀스 (ESC c, ESC ( B 등)
const SINGLE_PATTERN = /\u001b[@-Z\\-_]|\u001b\([@-~]/g;

export function stripAnsi(text: string): string {
  return text.replace(OSC_PATTERN, '').replace(CSI_PATTERN, '').replace(SINGLE_PATTERN, '');
}

/**
 * PTY의 \r\n 줄바꿈을 \n으로 정규화하고,
 * \r 덮어쓰기 진행 표시(progress bar)는 각 줄의 최종 상태만 남긴다.
 */
export function normalizeOutput(text: string): string {
  const unix = text.replace(/\r\n/g, '\n');
  return unix
    .split('\n')
    .map((line) => {
      const lastCr = line.lastIndexOf('\r');
      return lastCr === -1 ? line : line.slice(lastCr + 1);
    })
    .join('\n');
}
