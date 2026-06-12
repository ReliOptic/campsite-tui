/**
 * 실행 환경 감지 — `cstui context --json`의 에이전트 핸드오프 페이로드용.
 * 로컬 파일시스템과 프로세스 정보만 읽는다 (네트워크 호출 없음, env 시크릿 미포함).
 */
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TerminalEnv } from '../config/terminal-env.js';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun';

export interface PackageInfo {
  readonly name: string | null;
  readonly version: string | null;
}

export interface EnvironmentInfo {
  readonly node: string;
  readonly platform: NodeJS.Platform;
  /** 락파일 기반 감지 — 락파일이 없으면 null (추측하지 않음) */
  readonly package_manager: PackageManager | null;
  /** package.json의 name/version만 — 의존성·스크립트는 포함하지 않음 */
  readonly package: PackageInfo | null;
  readonly terminal: {
    readonly term_program: string | null;
    readonly remote: boolean;
  };
}

const LOCKFILES: ReadonlyArray<readonly [string, PackageManager]> = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['yarn.lock', 'yarn'],
  ['bun.lock', 'bun'],
  ['bun.lockb', 'bun'],
  ['package-lock.json', 'npm'],
];

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function detectPackageManager(dir: string): Promise<PackageManager | null> {
  for (const [lockfile, manager] of LOCKFILES) {
    if (await exists(join(dir, lockfile))) return manager;
  }
  return null;
}

async function readPackageInfo(dir: string): Promise<PackageInfo | null> {
  try {
    const raw = await readFile(join(dir, 'package.json'), 'utf8');
    const parsed = JSON.parse(raw) as { name?: unknown; version?: unknown };
    return {
      name: typeof parsed.name === 'string' ? parsed.name : null,
      version: typeof parsed.version === 'string' ? parsed.version : null,
    };
  } catch {
    // package.json 부재/파싱 불가는 정상 상태 (Node 프로젝트가 아님)
    return null;
  }
}

/** dir는 보통 repo_root, 저장소가 아니면 cwd */
export async function detectEnvironment(
  dir: string,
  terminalEnv: TerminalEnv,
): Promise<EnvironmentInfo> {
  const [packageManager, packageInfo] = await Promise.all([
    detectPackageManager(dir),
    readPackageInfo(dir),
  ]);
  return {
    node: process.versions.node,
    platform: process.platform,
    package_manager: packageManager,
    package: packageInfo,
    terminal: {
      term_program: terminalEnv.termProgram,
      remote: terminalEnv.isRemote,
    },
  };
}
