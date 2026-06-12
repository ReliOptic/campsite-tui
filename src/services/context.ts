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
  /** git 저장소 루트 절대경로 (저장소 아니면 null) */
  readonly repo_root: string | null;
  /** origin 원격 URL — 자격증명(user:token@) 제거본 */
  readonly remote_url: string | null;
}

async function git(cwd: string, args: readonly string[]): Promise<string | null> {
  try {
    const { stdout } = await exec('git', ['-C', cwd, ...args], { timeout: 3000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

/** URL에 포함된 자격증명(user:password@)을 제거한다. SCP형(git@host:path)은 그대로. */
export function stripCredentials(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.toString();
  } catch {
    // git@host:path 같은 SCP형은 URL 파싱 불가 — 자격증명 비포함 형태이므로 그대로 반환
    return url;
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
    return { cwd, repo: null, branch: null, dirty: null, repo_root: null, remote_url: null };
  }
  const [branch, remote, status, toplevel] = await Promise.all([
    git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
    git(cwd, ['remote', 'get-url', 'origin']),
    git(cwd, ['status', '--porcelain']),
    git(cwd, ['rev-parse', '--show-toplevel']),
  ]);
  const repoFromRemote = remote !== null ? parseRepoFromRemote(remote) : null;
  const repoRoot = toplevel !== null && toplevel.length > 0 ? toplevel : null;
  const repoFromDir = repoRoot !== null ? basename(repoRoot) : null;
  return {
    cwd,
    repo: repoFromRemote ?? repoFromDir,
    branch,
    dirty: status !== null ? status.length > 0 : null,
    repo_root: repoRoot,
    remote_url: remote !== null ? stripCredentials(remote) : null,
  };
}
