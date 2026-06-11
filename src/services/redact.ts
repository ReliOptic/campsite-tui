/**
 * 시크릿 마스킹 — 결정적 정규식만 사용, LLM 없음 (TECH-SPEC T6).
 * 비개발자가 블록을 단톡방에 그대로 붙여넣는 사용층이므로 기본 ON.
 * 오탐(필요한 값이 가려짐) < 미탐(토큰 유출) 원칙.
 */

interface RedactRule {
  readonly kind: string;
  readonly pattern: RegExp;
  /** $1 등 캡처 그룹을 보존해야 하는 규칙의 치환 문자열 */
  readonly replacement: string;
}

const RULES: readonly RedactRule[] = [
  {
    kind: 'private_key',
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
    replacement: '[REDACTED:private_key]',
  },
  {
    kind: 'jwt',
    pattern: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}/g,
    replacement: '[REDACTED:jwt]',
  },
  {
    kind: 'google_api_key',
    pattern: /AIza[0-9A-Za-z_-]{30,}/g,
    replacement: '[REDACTED:google_api_key]',
  },
  {
    kind: 'github_token',
    pattern: /gh[pousr]_[A-Za-z0-9]{20,}/g,
    replacement: '[REDACTED:github_token]',
  },
  {
    kind: 'slack_token',
    pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g,
    replacement: '[REDACTED:slack_token]',
  },
  {
    kind: 'telegram_bot_token',
    pattern: /\b\d{6,12}:AA[A-Za-z0-9_-]{30,}\b/g,
    replacement: '[REDACTED:telegram_bot_token]',
  },
  {
    kind: 'url_secret_param',
    pattern: /([?&](?:token|key|secret|password|api_key|apikey|access_token)=)[^&\s"']+/gi,
    replacement: '$1[REDACTED:url_secret]',
  },
];

export interface RedactResult {
  readonly text: string;
  readonly count: number;
  readonly kinds: readonly string[];
}

export function redactSecrets(text: string): RedactResult {
  let out = text;
  let count = 0;
  const kinds = new Set<string>();
  for (const rule of RULES) {
    const matches = out.match(rule.pattern);
    if (matches === null) continue;
    count += matches.length;
    kinds.add(rule.kind);
    out = out.replace(rule.pattern, rule.replacement);
  }
  return { text: out, count, kinds: [...kinds] };
}
