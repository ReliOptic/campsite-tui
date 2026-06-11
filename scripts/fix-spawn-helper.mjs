#!/usr/bin/env node
/**
 * node-pty 1.1.0 프리빌드의 spawn-helper에 exec 비트가 누락되는 문제 보정.
 * (TECH-SPEC 스파이크 S1에서 발견 — 없으면 macOS에서 posix_spawnp failed)
 */
import { chmodSync, existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

let packageDir;
try {
  packageDir = dirname(require.resolve('node-pty/package.json'));
} catch {
  // node-pty 미설치(설치 도중) — 보정할 것이 없으므로 정상 종료
  process.exit(0);
}

const prebuilds = join(packageDir, 'prebuilds');
if (!existsSync(prebuilds)) process.exit(0);

for (const platform of readdirSync(prebuilds)) {
  const helper = join(prebuilds, platform, 'spawn-helper');
  if (!existsSync(helper)) continue;
  try {
    chmodSync(helper, 0o755);
  } catch (error) {
    console.error(
      JSON.stringify({ level: 'warn', msg: 'spawn-helper 권한 보정 실패', helper, error: String(error) }),
    );
  }
}
