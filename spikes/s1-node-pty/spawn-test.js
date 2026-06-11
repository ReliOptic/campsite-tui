// S1 스파이크: node-pty spawn 캡처 정확성 (throwaway)
// 검증: ① 출력 캡처 ② exit code ③ duration ④ ANSI 보존 ⑤ SIGINT 전달
const pty = require('node-pty');

function runCase(name, cmd, opts = {}) {
  return new Promise((resolve) => {
    const started = Date.now();
    let buf = '';
    const p = pty.spawn('/bin/zsh', ['-c', cmd], {
      name: 'xterm-256color', cols: 80, rows: 24, cwd: process.cwd(), env: process.env,
    });
    p.onData((d) => { buf += d; });
    if (opts.sigintAfterMs) setTimeout(() => p.kill('SIGINT'), opts.sigintAfterMs);
    p.onExit(({ exitCode, signal }) => {
      resolve({ name, exitCode, signal, durationMs: Date.now() - started, bytes: buf.length, sample: JSON.stringify(buf.slice(0, 80)) });
    });
  });
}

(async () => {
  const results = [];
  results.push(await runCase('basic echo', 'echo hello-campsite'));
  results.push(await runCase('exit code 3', 'echo before-fail; exit 3'));
  results.push(await runCase('stderr merge', 'echo to-stdout; echo to-stderr 1>&2; exit 1'));
  results.push(await runCase('ansi color', 'printf "\\e[31mRED\\e[0m plain\\n"'));
  results.push(await runCase('korean width', 'echo "가이드 5단계: 서버 생성"'));
  results.push(await runCase('sigint passthrough', 'sleep 30', { sigintAfterMs: 500 }));
  console.log(JSON.stringify(results, null, 2));
})();
