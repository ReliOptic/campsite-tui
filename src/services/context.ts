/**
 * 컨텍스트 자동감지 — git 저장소 상태를 읽는다 (PRD §11 F1).
 * git이 없거나 저장소가 아니면 null로 정직하게 반환한다 (표시 계층에서 "unknown").
 */
import { execFile } from 'node:child_process';
import { basename } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface DetectedContext {
  readonly cwd: string;
  readonly repo: string | null;
  readonly branch: string | null;
  readonly dirty: boolean | null;
}

async function git(cwd: string, args: readonly string[]): Promise<string | null> {
  try {
    const { stdout } = await exec('git', ['-C', cwd, ...args], { timeout: 3000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

/** "git@host:owner/repo.git" 또는 "https://host/owner/repo.git" → "owner/repo" */
export function parseRepoFromRemote(url: string): string | null {
  const ssh = /^[\w.-]+@[\w.-]+:(.+?)(?:\.git)?$/.exec(url);
  const sshPath = ssh?.[1];
  if (sshPath !== undefined && sshPath.length > 0) return sshPath;
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/+/, '').replace(/\.git$/, '');
    return path.length > 0 ? path : null;
  } catch {
    return null;
  }
}

export async function detectContext(cwd: string): Promise<DetectedContext> {
  const inside = await git(cwd, ['rev-parse', '--is-inside-work-tree']);
  if (inside !== 'true') {
    return { cwd, repo: null, branch: null, dirty: null };
  }
  const [branch, remote, status, toplevel] = await Promise.all([
    git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
    git(cwd, ['remote', 'get-url', 'origin']),
    git(cwd, ['status', '--porcelain']),
    git(cwd, ['rev-parse', '--show-toplevel']),
  ]);
  const repoFromRemote = remote !== null ? parseRepoFromRemote(remote) : null;
  const repoFromDir = toplevel !== null && toplevel.length > 0 ? basename(toplevel) : null;
  return {
    cwd,
    repo: repoFromRemote ?? repoFromDir,
    branch,
    dirty: status !== null ? status.length > 0 : null,
  };
}
