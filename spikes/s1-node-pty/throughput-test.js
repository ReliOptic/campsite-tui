// S3 스파이크: 대용량 출력 무손실 캡처 + 처리량 (throwaway)
// 구조 검증: 출력은 raw 버퍼에만 적재(Ink 미경유), 라인 수·정합성·속도 측정
const pty = require('node-pty');

function run(lines) {
  return new Promise((resolve) => {
    const started = Date.now();
    const chunks = [];
    const p = pty.spawn('/bin/zsh', ['-c', `seq 1 ${lines}`], {
      name: 'xterm-256color', cols: 80, rows: 24, cwd: '/tmp', env: process.env,
    });
    p.onData((d) => chunks.push(d)); // 실제 구현에선 여기서 stdout에 동시 패스스루
    p.onExit(({ exitCode }) => {
      const buf = chunks.join('');
      const got = buf.split('\r\n').filter(Boolean);
      const last = got[got.length - 1];
      resolve({
        lines, exitCode, durationMs: Date.now() - started,
        bytes: buf.length, capturedLines: got.length,
        lossless: got.length === lines && last === String(lines),
        chunkCount: chunks.length,
      });
    });
  });
}

(async () => {
  const out = [];
  for (const n of [10_000, 100_000, 1_000_000]) out.push(await run(n));
  console.log(JSON.stringify(out, null, 2));
})();
